<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\AttendanceDaily;
use App\Models\Department;
use App\Models\Employee;
use App\Models\LeaveRequest;
use App\Models\PublicHoliday;
use App\Models\RosterEntry;
use App\Models\Shift;
use App\Services\AttendanceProcessingService;
use App\Services\ShiftService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

final class AttendanceTimesheetController extends Controller
{
    public function __construct(
        private readonly AttendanceProcessingService $processingService,
        private readonly ShiftService $shiftService,
    ) {}

    /**
     * Display the dedicated Monthly Employee Timesheet & Roster reconciliation view.
     */
    public function index(Request $request): Response
    {
        $tenantId = session('tenant_id') ?? app()->make('current_tenant_id') ?? null;

        // Employees list for selection dropdown
        $employees = Employee::query()
            ->when($tenantId, fn ($q) => $q->where('tenant_id', $tenantId))
            ->with('department:id,name')
            ->orderBy('full_name')
            ->get(['id', 'emp_no', 'full_name', 'department_id', 'designation_id']);

        // Selected month
        $monthInput = $request->query('month') ?? Carbon::today()->format('Y-m');
        $monthDate = Carbon::parse($monthInput . '-01');
        $startDate = $monthDate->copy()->startOfMonth();
        $endDate = $monthDate->copy()->endOfMonth();

        // Selected employee
        $employeeId = $request->query('employee_id');
        $empNo = $request->query('emp_no');

        $selectedEmployee = null;
        if (! empty($employeeId)) {
            $selectedEmployee = $employees->firstWhere('id', $employeeId);
        } elseif (! empty($empNo)) {
            $selectedEmployee = $employees->firstWhere('emp_no', $empNo);
        }

        if (! $selectedEmployee && $employees->isNotEmpty()) {
            $selectedEmployee = $employees->first();
        }

        $timesheetData = null;
        $summary = null;

        if ($selectedEmployee) {
            $built = $this->buildTimesheetDays($selectedEmployee, $startDate, $endDate, $tenantId);
            $timesheetData = $built['days'];
            $summary = $built['summary'];
        }

        $departments = Department::query()
            ->when($tenantId, fn ($q) => $q->where('tenant_id', $tenantId))
            ->orderBy('name')
            ->get(['id', 'name']);

        $shifts = Shift::query()
            ->when($tenantId, fn ($q) => $q->where('tenant_id', $tenantId))
            ->orderBy('name')
            ->get();

        $departmentId = $request->query('department_id');

        return Inertia::render('Attendance/Timesheet', [
            'employees' => $employees,
            'selectedEmployee' => $selectedEmployee,
            'selectedMonth' => $monthDate->format('Y-m'),
            'monthLabel' => $monthDate->format('F Y'),
            'timesheetDays' => $timesheetData ?? [],
            'summary' => $summary,
            'departments' => $departments,
            'shifts' => $shifts,
            'selectedDepartmentId' => $departmentId,
        ]);
    }

    /**
     * Export the monthly timesheet to CSV (Full Month or Missing Punches Only).
     */
    public function exportCsv(Request $request): StreamedResponse
    {
        $tenantId = session('tenant_id') ?? app()->make('current_tenant_id') ?? null;
        $employeeId = $request->query('employee_id');
        $monthInput = $request->query('month') ?? Carbon::today()->format('Y-m');
        $onlyMissing = (bool) $request->query('only_missing', false);

        $monthDate = Carbon::parse($monthInput . '-01');
        $startDate = $monthDate->copy()->startOfMonth();
        $endDate = $monthDate->copy()->endOfMonth();

        $employee = Employee::query()
            ->when($tenantId, fn ($q) => $q->where('tenant_id', $tenantId))
            ->with('department:id,name')
            ->findOrFail($employeeId);

        $built = $this->buildTimesheetDays($employee, $startDate, $endDate, $tenantId);
        $days = $built['days'];

        if ($onlyMissing) {
            $days = array_filter($days, fn ($d) => $d['is_missing_punch'] || $d['is_manual'] || ($d['is_scheduled_work'] && empty($d['check_in'])));
        }

        $cleanEmpNo = preg_replace('/[^A-Za-z0-9_-]/', '_', $employee->emp_no);
        $prefix = $onlyMissing ? 'Missing_Punches' : 'Monthly_Timesheet';
        $filename = sprintf('%s_%s_%s.csv', $prefix, $cleanEmpNo, $monthDate->format('Y_m'));

        $headers = [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => "attachment; filename=\"{$filename}\"",
            'Pragma' => 'no-cache',
            'Cache-Control' => 'must-revalidate, post-check=0, pre-check=0',
            'Expires' => '0',
        ];

        return response()->stream(function () use ($days, $employee, $monthDate): void {
            $handle = fopen('php://output', 'w');
            if ($handle === false) {
                return;
            }

            // UTF-8 BOM for Microsoft Excel
            fputs($handle, "\xEF\xBB\xBF");

            // Metadata rows
            fputcsv($handle, ['Employee Timesheet Report', $monthDate->format('F Y')]);
            fputcsv($handle, ['Employee No', $employee->emp_no, 'Name', $employee->full_name, 'Department', $employee->department?->name ?? 'N/A']);
            fputcsv($handle, []); // Blank separator

            // Table Header row
            fputcsv($handle, [
                '#',
                'Date',
                'Day',
                'Roster Schedule',
                'Shift Times',
                'Punch In',
                'Punch Out',
                'Worked Hours',
                'Late (Minutes)',
                'Early Leave (Minutes)',
                '1.5x OT (Hours)',
                '2.0x OT (Hours)',
                'Attendance Status',
                'Manual Adjusted',
                'Audit Reason',
            ]);

            $index = 1;
            foreach ($days as $day) {
                fputcsv($handle, [
                    $index++,
                    $day['date'],
                    $day['day_name'],
                    $day['roster_label'],
                    $day['shift_times'] ?? '—',
                    $day['check_in'] ?? '—',
                    $day['check_out'] ?? '—',
                    number_format((float) $day['worked_hours'], 2),
                    $day['late_minutes'] > 0 ? $day['late_minutes'] : '0',
                    $day['early_departure_minutes'] > 0 ? $day['early_departure_minutes'] : '0',
                    number_format((float) $day['ot_hours'], 2),
                    number_format((float) $day['double_ot_hours'], 2),
                    strtoupper(str_replace('_', ' ', (string) $day['status'])),
                    $day['is_manual'] ? 'YES' : 'NO',
                    $day['manual_reason'] ?? '—',
                ]);
            }

            fclose($handle);
        }, 200, $headers);
    }

    /**
     * Build day-by-day roster and attendance records for an employee across a calendar month.
     *
     * @return array{days: array<int, array<string, mixed>>, summary: array<string, mixed>}
     */
    private function buildTimesheetDays(Employee $employee, Carbon $startDate, Carbon $endDate, ?string $tenantId): array
    {
        // 1. Fetch all attendance dailies
        $dailies = AttendanceDaily::query()
            ->with(['shift:id,name,code,start_time,end_time,color', 'editor:id,name'])
            ->where('employee_id', $employee->id)
            ->whereBetween('attendance_date', [$startDate->toDateString(), $endDate->toDateString()])
            ->get()
            ->keyBy(fn ($r) => Carbon::parse($r->attendance_date)->toDateString());

        // 2. Fetch duty roster entries
        $rosters = RosterEntry::query()
            ->with('shift:id,name,code,start_time,end_time,color')
            ->where('employee_id', $employee->id)
            ->whereBetween('roster_date', [$startDate->toDateString(), $endDate->toDateString()])
            ->get()
            ->keyBy(fn ($r) => Carbon::parse($r->roster_date)->toDateString());

        // 3. Fetch approved leaves
        $leaves = LeaveRequest::query()
            ->with('leaveType:id,name,code')
            ->where('employee_id', $employee->id)
            ->where('status', 'approved')
            ->where(function ($q) use ($startDate, $endDate) {
                $q->whereBetween('start_date', [$startDate, $endDate])
                    ->orWhereBetween('end_date', [$startDate, $endDate]);
            })
            ->get();

        // 4. Fetch holidays
        $holidays = PublicHoliday::query()
            ->whereBetween('holiday_date', [$startDate, $endDate])
            ->get()
            ->keyBy(fn ($h) => Carbon::parse($h->holiday_date)->toDateString());

        $days = [];
        $totalWorkedHours = 0.0;
        $totalOtHours = 0.0;
        $totalDoubleOtHours = 0.0;
        $presentDays = 0;
        $absentDays = 0;
        $restDays = 0;
        $holidayDays = 0;
        $leaveDays = 0;
        $missingPunchesCount = 0;
        $lateDaysCount = 0;
        $manualAdjustedCount = 0;

        $current = $startDate->copy();
        $dayIndex = 1;

        while ($current->lte($endDate)) {
            $dateStr = $current->toDateString();
            $daily = $dailies->get($dateStr);
            $roster = $rosters->get($dateStr);
            $holiday = $holidays->get($dateStr);

            // Check if on leave
            $activeLeave = $leaves->first(function ($l) use ($current) {
                return $current->between(Carbon::parse($l->start_date), Carbon::parse($l->end_date));
            });

            // Determine Roster & Schedule info via unified ShiftService schedule resolver
            $schedule = $this->shiftService->resolveDailySchedule(
                $employee,
                $current,
                $roster,
                $activeLeave,
                $holiday
            );

            $rosterShift = $schedule['shift'] ?? $daily?->shift;
            $isRosterOff = $schedule['is_off'];
            $rosterLabel = $schedule['label'];
            $shiftTimes = $schedule['shift_times'] ?? ($rosterShift ? substr($rosterShift->start_time, 0, 5) . ' - ' . substr($rosterShift->end_time, 0, 5) : null);

            // Attendance details
            $status = 'scheduled';
            $workedHours = 0.0;
            $lateMinutes = 0;
            $earlyMinutes = 0;
            $otHours = 0.0;
            $doubleOtHours = 0.0;
            $checkIn = null;
            $checkOut = null;
            $isManual = false;
            $manualReason = null;
            $anomalies = [];
            $dailyId = null;

            if ($daily) {
                $dailyId = $daily->id;
                $status = $daily->status;

                // Reconcile non-manual unpunched absent records if duty roster or holiday designates this as rest day, holiday or leave
                if (! $daily->is_manual && empty($daily->check_in) && empty($daily->check_out) && $status === 'absent') {
                    if ($activeLeave) {
                        $status = $activeLeave->is_half_day ? 'half_day' : 'leave';
                    } elseif ($holiday) {
                        $status = 'holiday';
                    } elseif ($isRosterOff) {
                        $status = 'rest_day';
                    }
                }

                $workedHours = (float) $daily->worked_hours;
                $lateMinutes = (int) $daily->late_minutes;
                $earlyMinutes = (int) $daily->early_departure_minutes;
                $otHours = (float) $daily->ot_hours;
                $doubleOtHours = (float) $daily->double_ot_hours;
                $checkIn = $daily->check_in;
                $checkOut = $daily->check_out;
                $isManual = (bool) $daily->is_manual;
                $manualReason = $daily->manual_reason;
                $anomalies = $daily->anomalies ?? [];
            } elseif ($activeLeave) {
                $status = 'leave';
            } elseif ($holiday) {
                $status = 'holiday';
            } elseif ($isRosterOff) {
                $status = 'rest_day';
            } elseif ($current->isPast()) {
                $status = 'unprocessed';
            }

            // Flags
            $isMissingPunch = ($status === 'missing_punch') || ($daily && ! empty($daily->check_in) && empty($daily->check_out));
            if ($isMissingPunch) {
                $missingPunchesCount++;
            }

            if ($lateMinutes > 0) {
                $lateDaysCount++;
            }

            if ($isManual) {
                $manualAdjustedCount++;
            }

            // Summary metrics accumulation
            $totalWorkedHours += $workedHours;
            $totalOtHours += $otHours;
            $totalDoubleOtHours += $doubleOtHours;

            match ($status) {
                'present' => $presentDays++,
                'absent' => $absentDays++,
                'rest_day' => $restDays++,
                'holiday' => $holidayDays++,
                'leave' => $leaveDays++,
                default => null,
            };

            $days[] = [
                'index' => $dayIndex++,
                'date' => $dateStr,
                'day_number' => $current->day,
                'day_name' => $current->format('D'),
                'is_weekend' => $current->isWeekend(),
                'daily_id' => $dailyId,
                'roster_label' => $rosterLabel,
                'is_roster_off' => $isRosterOff,
                'is_scheduled_work' => ! $isRosterOff,
                'shift' => $rosterShift ? [
                    'id' => $rosterShift->id,
                    'name' => $rosterShift->name,
                    'code' => $rosterShift->code,
                    'color' => $rosterShift->color,
                ] : null,
                'shift_times' => $shiftTimes,
                'holiday' => $holiday ? ['name' => $holiday->name, 'type' => $holiday->type] : null,
                'leave' => $activeLeave ? ['type' => $activeLeave->leaveType?->name ?? 'Approved Leave'] : null,
                'check_in' => $checkIn,
                'check_out' => $checkOut,
                'worked_hours' => $workedHours,
                'late_minutes' => $lateMinutes,
                'early_departure_minutes' => $earlyMinutes,
                'ot_hours' => $otHours,
                'double_ot_hours' => $doubleOtHours,
                'status' => $status,
                'is_manual' => $isManual,
                'manual_reason' => $manualReason,
                'anomalies' => $anomalies,
                'is_missing_punch' => $isMissingPunch,
            ];

            $current->addDay();
        }

        $summary = [
            'total_calendar_days' => count($days),
            'present_days' => $presentDays,
            'absent_days' => $absentDays,
            'rest_days' => $restDays,
            'holiday_days' => $holidayDays,
            'leave_days' => $leaveDays,
            'missing_punches' => $missingPunchesCount,
            'late_days' => $lateDaysCount,
            'manual_adjusted_days' => $manualAdjustedCount,
            'total_worked_hours' => round($totalWorkedHours, 2),
            'total_ot_hours' => round($totalOtHours, 2),
            'total_double_ot_hours' => round($totalDoubleOtHours, 2),
        ];

        return [
            'days' => $days,
            'summary' => $summary,
        ];
    }
}
