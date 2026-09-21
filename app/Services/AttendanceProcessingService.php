<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\AttendanceDaily;
use App\Models\AttendanceLog;
use App\Models\AttendanceRule;
use App\Models\Employee;
use App\Models\LeaveRequest;
use App\Models\PublicHoliday;
use App\Models\Shift;
use App\Models\User;
use Carbon\Carbon;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;

final class AttendanceProcessingService
{
    public function __construct(
        private readonly ShiftService $shiftService,
        private readonly OvertimeCalculationService $overtimeService,
    ) {}

    /**
     * Process daily attendance for all active employees (or specific employee/department) on a date.
     *
     * @return array{
     *     processed: int,
     *     present: int,
     *     absent: int,
     *     late: int,
     *     missing_punch: int,
     *     half_day: int,
     *     records: Collection<int, AttendanceDaily>
     * }
     */
    public function processDate(
        CarbonInterface $date,
        ?string $employeeId = null,
        ?string $departmentId = null,
        bool $overwriteManual = false,
        ?string $tenantId = null
    ): array {
        $tenantId = $tenantId
            ?? session('tenant_id')
            ?? (app()->has('current_tenant_id') ? app('current_tenant_id') : null);

        if ($tenantId === null) {
            throw new \RuntimeException('Tenant context could not be resolved for attendance processing.');
        }

        $dateString = $date->toDateString();

        // 1. Check if public/company holiday on this date
        $holiday = $this->shiftService->isHoliday($date);

        // 2. Query target employees
        $employeesQuery = Employee::query()
            ->where('tenant_id', $tenantId)
            ->where('employment_status', 'active');

        if ($employeeId !== null) {
            $employeesQuery->where('id', $employeeId);
        }

        if ($departmentId !== null) {
            $employeesQuery->where('department_id', $departmentId);
        }

        $employees = $employeesQuery->with('department:id,name')->get();

        return DB::transaction(function () use (
            $tenantId,
            $date,
            $dateString,
            $holiday,
            $employees,
            $overwriteManual
        ): array {
            $processedCount = 0;
            $presentCount = 0;
            $absentCount = 0;
            $lateCount = 0;
            $missingPunchCount = 0;
            $halfDayCount = 0;
            $savedRecords = new Collection;

            foreach ($employees as $employee) {
                // Check if existing record is manual override
                $existing = AttendanceDaily::where('tenant_id', $tenantId)
                    ->where('employee_id', $employee->id)
                    ->whereDate('attendance_date', $dateString)
                    ->first();

                if ($existing && $existing->is_manual && ! $overwriteManual) {
                    $savedRecords->push($existing);
                    continue;
                }

                // Resolve effective shift for employee on this date
                $shift = $this->shiftService->getEffectiveShiftForEmployee($employee, $date);

                // Resolve applicable management rule (shift-level or tenant default)
                $rule = AttendanceRule::resolveRuleForShift($shift, $tenantId);

                // Query punches within window
                $punches = $this->getPunchesForDate($tenantId, $employee->id, $date, $shift);

                // Calculate attendance record
                $calculatedData = $this->calculateDailyAttendance(
                    $employee,
                    $date,
                    $shift,
                    $rule,
                    $holiday,
                    $punches
                );

                $recordData = array_merge($calculatedData, [
                    'tenant_id' => $tenantId,
                    'employee_id' => $employee->id,
                    'shift_id' => $shift?->id,
                    'is_manual' => false,
                    'manual_reason' => null,
                    'manual_edited_by' => null,
                ]);

                if ($existing) {
                    $existing->update($recordData);
                    $record = $existing;
                } else {
                    $record = AttendanceDaily::create(array_merge($recordData, [
                        'attendance_date' => $dateString,
                    ]));
                }

                // Flag matched logs as processed without mutating or deleting raw logs
                if ($punches->isNotEmpty()) {
                    AttendanceLog::whereIn('id', $punches->pluck('id'))
                        ->update([
                            'is_processed' => true,
                            'processed_at' => Carbon::now(),
                        ]);
                }

                $savedRecords->push($record);
                $processedCount++;

                match ($record->status) {
                    'present' => $presentCount++,
                    'absent' => $absentCount++,
                    'missing_punch' => $missingPunchCount++,
                    'half_day' => $halfDayCount++,
                    default => null,
                };

                if ($record->late_minutes > 0) {
                    $lateCount++;
                }
            }

            return [
                'processed' => $processedCount,
                'present' => $presentCount,
                'absent' => $absentCount,
                'late' => $lateCount,
                'missing_punch' => $missingPunchCount,
                'half_day' => $halfDayCount,
                'records' => $savedRecords,
            ];
        });
    }

    /**
     * Process daily attendance across a date range.
     *
     * @return array<string, mixed>
     */
    public function processRange(
        CarbonInterface $startDate,
        CarbonInterface $endDate,
        ?string $employeeId = null
    ): array {
        $current = $startDate->copy();
        $totalProcessed = 0;

        while ($current->lte($endDate)) {
            $result = $this->processDate($current, $employeeId);
            $totalProcessed += $result['processed'];
            $current->addDay();
        }

        return [
            'start_date' => $startDate->toDateString(),
            'end_date' => $endDate->toDateString(),
            'total_processed' => $totalProcessed,
        ];
    }

    /**
     * Retroactively reprocess attendance from raw biometric logs for a date range.
     * Preserves raw logs, safely recalculates daily ledgers, and updates processing status.
     *
     * @return array<string, mixed>
     */
    public function reprocessDateRange(
        CarbonInterface $startDate,
        CarbonInterface $endDate,
        ?string $employeeId = null,
        ?string $departmentId = null,
        bool $overwriteManual = false
    ): array {
        $current = $startDate->copy();
        $totalProcessed = 0;
        $totalPresent = 0;
        $totalAbsent = 0;
        $totalLate = 0;
        $totalMissingPunch = 0;

        while ($current->lte($endDate)) {
            $result = $this->processDate(
                $current,
                $employeeId,
                $departmentId,
                $overwriteManual
            );

            $totalProcessed += $result['processed'];
            $totalPresent += $result['present'];
            $totalAbsent += $result['absent'];
            $totalLate += $result['late'];
            $totalMissingPunch += $result['missing_punch'];

            $current->addDay();
        }

        return [
            'start_date' => $startDate->toDateString(),
            'end_date' => $endDate->toDateString(),
            'total_processed' => $totalProcessed,
            'present' => $totalPresent,
            'absent' => $totalAbsent,
            'late' => $totalLate,
            'missing_punch' => $totalMissingPunch,
        ];
    }

    /**
     * Compute single employee daily attendance metrics from punches and rules.
     *
     * @param  Collection<int, AttendanceLog>  $punches
     * @return array<string, mixed>
     */
    private function calculateDailyAttendance(
        Employee $employee,
        CarbonInterface $date,
        ?Shift $shift,
        AttendanceRule $rule,
        ?PublicHoliday $holiday,
        Collection $punches
    ): array {
        $isSunday = $date->isSunday();
        $isHoliday = $holiday !== null;

        // Check for active approved leave on this date
        $approvedLeave = LeaveRequest::where('tenant_id', $employee->tenant_id)
            ->where('employee_id', $employee->id)
            ->where('status', 'approved')
            ->whereDate('start_date', '<=', $date->toDateString())
            ->whereDate('end_date', '>=', $date->toDateString())
            ->with('leaveType')
            ->first();

        // Case A: No punch logs recorded
        if ($punches->isEmpty()) {
            if ($approvedLeave !== null) {
                $status = $approvedLeave->is_half_day ? 'half_day' : 'leave';

                return [
                    'check_in' => null,
                    'check_out' => null,
                    'worked_hours' => $approvedLeave->is_half_day ? 4.00 : 0.00,
                    'regular_hours' => $approvedLeave->is_half_day ? 4.00 : 0.00,
                    'late_minutes' => 0,
                    'early_departure_minutes' => 0,
                    'ot_hours' => 0.00,
                    'double_ot_hours' => 0.00,
                    'status' => $status,
                    'calculation_breakdown' => [
                        'rule' => $rule->rule_name,
                        'leave_type' => $approvedLeave->leaveType->name,
                        'leave_type_code' => $approvedLeave->leaveType->code,
                        'leave_request_id' => $approvedLeave->id,
                        'is_half_day' => $approvedLeave->is_half_day,
                        'half_day_type' => $approvedLeave->half_day_type,
                        'notes' => "Approved Leave: {$approvedLeave->leaveType->name}",
                    ],
                ];
            }

            // Check for explicit roster entry on this date
            $rosterEntry = $this->shiftService->getRosterEntryForEmployee($employee, $date);
            $isRosterRestDay = $rosterEntry !== null && ($rosterEntry->schedule_type === 'rest_day' || $rosterEntry->schedule_type === 'off');

            if ($isHoliday) {
                $status = 'holiday';
                $notes = "Holiday: {$holiday->name}";
            } elseif ($isRosterRestDay) {
                $status = 'rest_day';
                $notes = 'Scheduled Rest Day (Duty Roster)';
            } elseif ($rosterEntry !== null && $rosterEntry->schedule_type === 'shift') {
                $status = 'absent';
                $notes = 'No biometric punches recorded for scheduled roster shift';
            } elseif ($isSunday) {
                $status = 'rest_day';
                $notes = 'Rest Day (Sunday)';
            } else {
                $status = 'absent';
                $notes = 'No biometric punches recorded';
            }

            return [
                'check_in' => null,
                'check_out' => null,
                'worked_hours' => 0.00,
                'regular_hours' => 0.00,
                'late_minutes' => 0,
                'early_departure_minutes' => 0,
                'ot_hours' => 0.00,
                'double_ot_hours' => 0.00,
                'status' => $status,
                'calculation_breakdown' => [
                    'rule' => $rule->rule_name,
                    'punches_count' => 0,
                    'notes' => $notes,
                ],
            ];
        }

        // Pair Check-in and Check-out
        [$checkIn, $checkOut, $isSinglePunch] = $this->pairPunches($punches, $shift, $date);

        // Case B: Incomplete Single Punch (Missing punch policy)
        if ($isSinglePunch || $checkIn === null || $checkOut === null) {
            $missingAnomalies = [];
            if ($checkIn === null && $checkOut !== null) {
                $missingAnomalies[] = [
                    'type' => 'MISSING_IN',
                    'label' => 'Missing In-Punch',
                    'color' => '#F87171',
                    'severity' => 'high',
                ];
            } elseif ($checkIn !== null && $checkOut === null) {
                $missingAnomalies[] = [
                    'type' => 'MISSING_OUT',
                    'label' => 'Missing Out-Punch',
                    'color' => '#F87171',
                    'severity' => 'high',
                ];
            } else {
                $missingAnomalies[] = [
                    'type' => 'INCOMPLETE_PUNCH',
                    'label' => 'Incomplete Punch',
                    'color' => '#F87171',
                    'severity' => 'high',
                ];
            }

            return [
                'check_in' => $checkIn?->toDateTimeString(),
                'check_out' => $checkOut?->toDateTimeString(),
                'worked_hours' => 0.00,
                'regular_hours' => 0.00,
                'late_minutes' => 0,
                'early_departure_minutes' => 0,
                'ot_hours' => 0.00,
                'double_ot_hours' => 0.00,
                'status' => 'missing_punch',
                'anomalies' => $missingAnomalies,
                'calculation_breakdown' => [
                    'rule' => $rule->rule_name,
                    'punches_count' => $punches->count(),
                    'notes' => 'Incomplete punch recorded (missing check-out or check-in). Awaiting managerial correction.',
                ],
            ];
        }

        // Case C: Valid Punch Pair
        // 1. Calculate raw worked minutes
        $rawMinutes = (int) abs($checkOut->diffInMinutes($checkIn));

        // 2. Deduct break minutes if applicable
        $breakMinutes = ($shift && $shift->break_minutes > 0 && $rawMinutes >= ($shift->break_minutes + 60))
            ? $shift->break_minutes
            : 0;

        $netMinutes = max(0, $rawMinutes - $breakMinutes);
        $workedHours = round($netMinutes / 60.0, 2);

        // 3. Calculate late arrival minutes
        $lateMinutes = 0;
        if ($shift !== null) {
            $shiftStart = Carbon::parse($date->toDateString().' '.$shift->start_time);
            $graceCutoff = $shiftStart->copy()->addMinutes($rule->grace_period_minutes);

            if ($checkIn->gt($graceCutoff)) {
                $lateMinutes = (int) abs($checkIn->diffInMinutes($shiftStart));
            }
        }

        // 4. Calculate early departure minutes
        $earlyDepartureMinutes = 0;
        if ($shift !== null) {
            $shiftEnd = Carbon::parse($date->toDateString().' '.$shift->end_time);
            if ($shift->is_night_shift) {
                $shiftEnd->addDay();
            }

            $earlyCutoff = $shiftEnd->copy()->subMinutes($rule->early_departure_grace_minutes);
            if ($checkOut->lt($earlyCutoff)) {
                $earlyDepartureMinutes = (int) abs($shiftEnd->diffInMinutes($checkOut));
            }
        }

        // 5. Overtime Calculation via Engine
        $otResult = $this->overtimeService->calculate($rule, $shift, $date, $workedHours, $holiday);

        // 6. Collect Structured Anomalies
        $anomalies = [];
        if ($lateMinutes > 0) {
            $anomalies[] = [
                'type' => 'LATE_ARRIVAL',
                'label' => 'Late Arrival',
                'minutes' => $lateMinutes,
                'color' => '#FB923C', // orange-400
                'severity' => $lateMinutes > 30 ? 'high' : 'medium',
            ];
        }
        if ($earlyDepartureMinutes > 0) {
            $anomalies[] = [
                'type' => 'EARLY_DEPARTURE',
                'label' => 'Early Departure',
                'minutes' => $earlyDepartureMinutes,
                'color' => '#F87171', // red-400
                'severity' => $earlyDepartureMinutes > 30 ? 'high' : 'medium',
            ];
        }

        // 7. Determine final status
        $status = 'present';
        if ($isHoliday) {
            $status = 'present';
        } elseif ($isSunday) {
            $status = 'present';
        } elseif ($shift && $shift->shift_type === 'half_day') {
            $status = 'half_day';
        } elseif ($workedHours >= $rule->half_day_min_hours && $workedHours < $rule->half_day_max_hours) {
            $status = 'half_day';
        } elseif ($workedHours < $rule->half_day_min_hours) {
            $status = 'absent';
        }

        return [
            'check_in' => $checkIn->toDateTimeString(),
            'check_out' => $checkOut->toDateTimeString(),
            'worked_hours' => $workedHours,
            'regular_hours' => $otResult['regular_hours'],
            'late_minutes' => $lateMinutes,
            'early_departure_minutes' => $earlyDepartureMinutes,
            'ot_hours' => $otResult['ot_hours'],
            'double_ot_hours' => $otResult['double_ot_hours'],
            'status' => $status,
            'anomalies' => $anomalies,
            'calculation_breakdown' => [
                'rule' => $rule->rule_name,
                'break_minutes_deducted' => $breakMinutes,
                'day_type' => $otResult['day_type'],
                'applied_rate' => $otResult['applied_rate'],
                'punches_count' => $punches->count(),
                'holiday_name' => $holiday?->name,
            ],
        ];
    }

    /**
     * Pair raw punches into check-in and check-out timestamps, utilizing shift sliding windows when defined.
     *
     * @param  Collection<int, AttendanceLog>  $punches
     * @return array{0: ?Carbon, 1: ?Carbon, 2: bool}
     */
    private function pairPunches(Collection $punches, ?Shift $shift = null, ?CarbonInterface $date = null): array
    {
        if ($punches->isEmpty()) {
            return [null, null, false];
        }

        // Check if explicit 'in' and 'out' types exist
        $inPunch = $punches->firstWhere('punch_type', 'in');
        $outPunch = $punches->reverse()->firstWhere('punch_type', 'out');

        if ($inPunch && $outPunch && $inPunch->id !== $outPunch->id) {
            $inTime = Carbon::parse($inPunch->punch_datetime);
            $outTime = Carbon::parse($outPunch->punch_datetime);

            if ($outTime->gt($inTime)) {
                return [$inTime, $outTime, false];
            }
        }

        // Sliding 4-Window punch contract matching if shift & date provided
        if ($shift !== null && $date !== null) {
            [$inStart, $inEnd] = $shift->getInWindow($date);
            [$outStart, $outEnd] = $shift->getOutWindow($date);

            // Add +/- 5 minute operational grace margin
            $inStartGrace = $inStart->copy()->subMinutes(5);
            $inEndGrace = $inEnd->copy()->addMinutes(5);
            $outStartGrace = $outStart->copy()->subMinutes(5);
            $outEndGrace = $outEnd->copy()->addMinutes(5);

            $inCandidates = $punches->filter(function (AttendanceLog $log) use ($inStartGrace, $inEndGrace) {
                $time = Carbon::parse($log->punch_datetime);
                return $time->gte($inStartGrace) && $time->lte($inEndGrace);
            })->sortBy('punch_datetime');

            $outCandidates = $punches->filter(function (AttendanceLog $log) use ($outStartGrace, $outEndGrace) {
                $time = Carbon::parse($log->punch_datetime);
                return $time->gte($outStartGrace) && $time->lte($outEndGrace);
            })->sortByDesc('punch_datetime');

            $matchedIn = $inCandidates->first();
            $matchedOut = $outCandidates->first();

            if ($matchedIn && $matchedOut && $matchedIn->id !== $matchedOut->id) {
                $inTime = Carbon::parse($matchedIn->punch_datetime);
                $outTime = Carbon::parse($matchedOut->punch_datetime);

                if ($outTime->gt($inTime)) {
                    return [$inTime, $outTime, false];
                }
            } elseif ($matchedIn && ! $matchedOut) {
                return [Carbon::parse($matchedIn->punch_datetime), null, true];
            } elseif (! $matchedIn && $matchedOut) {
                return [null, Carbon::parse($matchedOut->punch_datetime), true];
            }
        }

        // Fallback chronological pairing for auto or mixed types
        $sorted = $punches->sortBy('punch_datetime')->values();

        if ($sorted->count() === 1) {
            return [Carbon::parse($sorted[0]->punch_datetime), null, true];
        }

        $earliest = Carbon::parse($sorted->first()->punch_datetime);
        $latest = Carbon::parse($sorted->last()->punch_datetime);

        // If distinct punches are separated by at least 5 minutes
        if (abs($latest->diffInMinutes($earliest)) >= 5) {
            return [$earliest, $latest, false];
        }

        // Clustered duplicate punch
        return [$earliest, null, true];
    }

    /**
     * Query raw attendance logs for an employee on a date, accounting for night shifts.
     *
     * @return Collection<int, AttendanceLog>
     */
    private function getPunchesForDate(string $tenantId, string $employeeId, CarbonInterface $date, ?Shift $shift): Collection
    {
        $dateStr = $date->toDateString();

        if ($shift && $shift->is_night_shift) {
            // Night shift window: from 18:00 on date to 12:00 on next day
            $windowStart = Carbon::parse($dateStr.' 18:00:00');
            $windowEnd = Carbon::parse($dateStr.' 12:00:00')->addDay();

            return AttendanceLog::query()
                ->where('tenant_id', $tenantId)
                ->where('employee_id', $employeeId)
                ->whereBetween('punch_datetime', [$windowStart, $windowEnd])
                ->orderBy('punch_datetime')
                ->get();
        }

        return AttendanceLog::query()
            ->where('tenant_id', $tenantId)
            ->where('employee_id', $employeeId)
            ->whereDate('punch_datetime', $dateStr)
            ->orderBy('punch_datetime')
            ->get();
    }

    /**
     * Manually adjust an attendance daily record with mandatory audit justification.
     *
     * @param  array<string, mixed>  $data
     */
    public function adjustDailyRecord(AttendanceDaily $record, array $data, ?User $editor = null): AttendanceDaily
    {
        return DB::transaction(function () use ($record, $data, $editor): AttendanceDaily {
            $shift = $record->shift;
            $tenantId = $record->tenant_id;
            $date = Carbon::parse($record->attendance_date);
            $rule = AttendanceRule::resolveRuleForShift($shift, $tenantId);
            $holiday = $this->shiftService->isHoliday($date);

            $checkIn = ! empty($data['check_in']) ? Carbon::parse($data['check_in']) : null;
            $checkOut = ! empty($data['check_out']) ? Carbon::parse($data['check_out']) : null;

            $workedHours = 0.00;
            $lateMinutes = 0;
            $earlyDepartureMinutes = 0;

            if ($checkIn && $checkOut && $checkOut->gt($checkIn)) {
                $rawMinutes = (int) abs($checkOut->diffInMinutes($checkIn));
                $breakMinutes = ($shift && $shift->break_minutes > 0 && $rawMinutes >= ($shift->break_minutes + 60))
                    ? $shift->break_minutes
                    : 0;

                $netMinutes = max(0, $rawMinutes - $breakMinutes);
                $workedHours = round($netMinutes / 60.0, 2);

                if ($shift !== null) {
                    $shiftStart = Carbon::parse($date->toDateString().' '.$shift->start_time);
                    if ($checkIn->gt($shiftStart->copy()->addMinutes($rule->grace_period_minutes))) {
                        $lateMinutes = (int) abs($checkIn->diffInMinutes($shiftStart));
                    }

                    $shiftEnd = Carbon::parse($date->toDateString().' '.$shift->end_time);
                    if ($shift->is_night_shift) {
                        $shiftEnd->addDay();
                    }
                    if ($checkOut->lt($shiftEnd->copy()->subMinutes($rule->early_departure_grace_minutes))) {
                        $earlyDepartureMinutes = (int) abs($shiftEnd->diffInMinutes($checkOut));
                    }
                }
            }

            $otResult = $this->overtimeService->calculate($rule, $shift, $date, $workedHours, $holiday);

            $status = $data['status'] ?? $record->status;

            $record->update([
                'check_in' => $checkIn?->toDateTimeString(),
                'check_out' => $checkOut?->toDateTimeString(),
                'worked_hours' => $workedHours,
                'regular_hours' => $otResult['regular_hours'],
                'late_minutes' => $lateMinutes,
                'early_departure_minutes' => $earlyDepartureMinutes,
                'ot_hours' => $otResult['ot_hours'],
                'double_ot_hours' => $otResult['double_ot_hours'],
                'status' => $status,
                'is_manual' => true,
                'manual_reason' => $data['manual_reason'],
                'manual_edited_by' => $editor?->id,
                'calculation_breakdown' => array_merge($record->calculation_breakdown ?? [], [
                    'last_manual_adjustment' => [
                        'adjusted_at' => Carbon::now()->toIso8601String(),
                        'adjusted_by' => $editor?->name ?? 'System Admin',
                        'reason' => $data['manual_reason'],
                    ],
                ]),
            ]);

            return $record;
        });
    }

    /**
     * Get aggregate statistics for the daily attendance ledger on a given date.
     *
     * @return array<string, mixed>
     */
    public function getDailyLedgerStats(CarbonInterface $date): array
    {
        $tenantId = session('tenant_id') ?? (app()->has('current_tenant_id') ? app('current_tenant_id') : null);
        if ($tenantId === null) {
            return [];
        }

        $dateString = $date->toDateString();

        $records = AttendanceDaily::where('tenant_id', $tenantId)
            ->whereDate('attendance_date', $dateString)
            ->get();

        return [
            'date' => $dateString,
            'total_records' => $records->count(),
            'present' => $records->where('status', 'present')->count(),
            'absent' => $records->where('status', 'absent')->count(),
            'late' => $records->where('late_minutes', '>', 0)->count(),
            'missing_punch' => $records->where('status', 'missing_punch')->count(),
            'half_day' => $records->where('status', 'half_day')->count(),
            'holiday' => $records->where('status', 'holiday')->count(),
            'rest_day' => $records->where('status', 'rest_day')->count(),
            'manual_adjusted' => $records->where('is_manual', true)->count(),
            'total_worked_hours' => round((float) $records->sum('worked_hours'), 2),
            'total_regular_hours' => round((float) $records->sum('regular_hours'), 2),
            'total_ot_hours' => round((float) $records->sum('ot_hours'), 2),
            'total_double_ot_hours' => round((float) $records->sum('double_ot_hours'), 2),
        ];
    }

    /**
     * Save or update an attendance management rule.
     *
     * @param  array<string, mixed>  $data
     */
    public function saveAttendanceRule(array $data, string $tenantId): AttendanceRule
    {
        return DB::transaction(function () use ($data, $tenantId): AttendanceRule {
            $shiftId = ! empty($data['shift_id']) ? $data['shift_id'] : null;

            return AttendanceRule::updateOrCreate(
                [
                    'tenant_id' => $tenantId,
                    'shift_id' => $shiftId,
                ],
                [
                    'rule_name' => $data['rule_name'] ?? 'Custom Policy',
                    'grace_period_minutes' => (int) ($data['grace_period_minutes'] ?? 10),
                    'ot_buffer_minutes' => (int) ($data['ot_buffer_minutes'] ?? 0),
                    'ot_minimum_minutes' => (int) ($data['ot_minimum_minutes'] ?? 15),
                    'ot_rate_weekday' => (float) ($data['ot_rate_weekday'] ?? 1.50),
                    'ot_rate_rest_day' => (float) ($data['ot_rate_rest_day'] ?? 1.50),
                    'ot_rate_holiday' => (float) ($data['ot_rate_holiday'] ?? 2.00),
                    'half_day_min_hours' => (float) ($data['half_day_min_hours'] ?? 4.00),
                    'half_day_max_hours' => (float) ($data['half_day_max_hours'] ?? 6.00),
                    'early_departure_grace_minutes' => (int) ($data['early_departure_grace_minutes'] ?? 5),
                    'round_ot_interval_minutes' => (int) ($data['round_ot_interval_minutes'] ?? 15),
                    'is_active' => (bool) ($data['is_active'] ?? true),
                ]
            );
        });
    }
}
