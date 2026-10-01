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
        $tenantId = session('tenant_id') ?? (app()->bound('current_tenant_id') ? app('current_tenant_id') : null);

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
        $tenantId = session('tenant_id') ?? (app()->bound('current_tenant_id') ? app('current_tenant_id') : null);
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
     * Delegates to AttendanceProcessingService (Single Source of Truth).
     *
     * @return array{days: array<int, array<string, mixed>>, summary: array<string, mixed>}
     */
    private function buildTimesheetDays(Employee $employee, Carbon $startDate, Carbon $endDate, ?string $tenantId): array
    {
        return $this->processingService->buildTimesheetDays($employee, $startDate, $endDate, $tenantId);
    }
}
