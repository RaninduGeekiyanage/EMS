<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\AttendanceDaily;
use App\Models\AttendanceLog;
use App\Models\AttendanceRule;
use App\Models\Employee;
use App\Models\LeaveRequest;
use App\Models\PayrollRun;
use App\Models\PublicHoliday;
use App\Models\RosterEntry;
use App\Models\Shift;
use App\Models\ShiftAssignment;
use App\Models\Tenant;
use App\Models\User;
use Carbon\Carbon;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;

final class AttendanceProcessingService
{
    /**
     * Enterprise Industry-Standard Default Attendance Calculation Settings.
     *
     * @var array<string, mixed>
     */
    public const DEFAULT_SETTINGS = [
        'ignore_terminal_punch_type' => true,      // Direction-agnostic telemetry: derive IN/OUT contextually
        'anti_passback_minutes' => 3,              // Compress rapid duplicate biometric swipes within 3 mins
        'auto_detect_shift' => true,               // Auto-detect matching company shift if worker swaps or works unscheduled
        'allow_early_in_as_ot' => false,           // Pre-shift arrival does not count towards OT unless authorized
        'overtime_minimum_minutes' => 15,          // Minimum extra late minutes required to qualify for OT
    ];

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
            ?? (app()->bound('current_tenant_id') ? app('current_tenant_id') : null);

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
            $inProgressCount = 0;
            $scheduledCount = 0;
            $savedRecords = new Collection;

            // Load global tenant attendance policy & calculation settings
            $tenantSettings = $this->getTenantAttendanceSettings($tenantId);

            foreach ($employees as $employee) {
                // Check if existing record is manual override
                $existing = AttendanceDaily::where('tenant_id', $tenantId)
                    ->where('employee_id', $employee->id)
                    ->whereDate('attendance_date', $dateString)
                    ->first();

                // Resolve effective shift for employee on this date
                $shift = $this->shiftService->getEffectiveShiftForEmployee($employee, $date);

                // Auto-detect shift if employee is unrostered or swapped and policy allows
                if ($shift === null && ($tenantSettings['auto_detect_shift'] ?? true)) {
                    $candidatePunches = $this->getPunchesForDate($tenantId, $employee, $date, null);
                    $firstPunch = $candidatePunches->first();

                    if ($firstPunch !== null) {
                        $shift = $this->autoDetectShiftForPunch($tenantId, $date, Carbon::parse($firstPunch->punch_datetime), $employee);
                    }
                }

                if ($existing && $existing->is_manual && ! $overwriteManual) {
                    // Reconcile raw biometric punches so they don't remain dangling/unprocessed
                    $punches = $this->getPunchesForDate($tenantId, $employee, $date, $shift);
                    if ($punches->isEmpty() && ($tenantSettings['auto_detect_shift'] ?? true)) {
                        $unconsumed = $this->getPunchesForDate($tenantId, $employee, $date, null);
                        $firstUnconsumed = $unconsumed->first();
                        if ($firstUnconsumed !== null) {
                            $detected = $this->autoDetectShiftForPunch($tenantId, $date, Carbon::parse($firstUnconsumed->punch_datetime), $employee);
                            if ($detected !== null) {
                                $shift = $detected;
                                $punches = $this->getPunchesForDate($tenantId, $employee, $date, $shift);
                            }
                        }
                    }

                    if ($punches->isNotEmpty()) {
                        AttendanceLog::whereIn('id', $punches->pluck('id'))
                            ->where('is_processed', false)
                            ->update([
                                'is_processed' => true,
                                'processed_at' => Carbon::now(),
                            ]);

                        $breakdown = $existing->calculation_breakdown ?? [];
                        $breakdown['machine_reconciliation'] = [
                            'reconciled_at' => Carbon::now()->toIso8601String(),
                            'matched_punches_count' => $punches->count(),
                            'note' => 'Raw biometric punches reconciled with manual HR adjustment; manual values preserved.',
                        ];
                        $existing->update(['calculation_breakdown' => $breakdown]);
                    }

                    $savedRecords->push($existing);
                    $processedCount++;

                    match ($existing->status) {
                        'present' => $presentCount++,
                        'absent' => $absentCount++,
                        'missing_punch' => $missingPunchCount++,
                        'half_day' => $halfDayCount++,
                        'in_progress' => $inProgressCount++,
                        'scheduled' => $scheduledCount++,
                        default => null,
                    };

                    if ($existing->late_minutes > 0) {
                        $lateCount++;
                    }

                    continue;
                }

                // Query punches within window
                $punches = $this->getPunchesForDate($tenantId, $employee, $date, $shift);

                // If scheduled shift produced zero punches in its window, but unconsumed candidate punches exist on this date (shift swap or unscheduled shift work)
                if ($punches->isEmpty() && ($tenantSettings['auto_detect_shift'] ?? true)) {
                    $unconsumedPunches = $this->getPunchesForDate($tenantId, $employee, $date, null);
                    $firstPunch = $unconsumedPunches->first();

                    if ($firstPunch !== null) {
                        $detectedShift = $this->autoDetectShiftForPunch(
                            $tenantId,
                            $date,
                            Carbon::parse($firstPunch->punch_datetime),
                            $employee
                        );

                        if ($detectedShift !== null && ($shift === null || $detectedShift->id !== $shift->id)) {
                            $shift = $detectedShift;
                            $punches = $this->getPunchesForDate($tenantId, $employee, $date, $shift);
                        }
                    }
                }

                // Resolve applicable management rule (shift-level or tenant default)
                $rule = AttendanceRule::resolveRuleForShift($shift, $tenantId);

                // Calculate attendance record
                $calculatedData = $this->calculateDailyAttendance(
                    $employee,
                    $date,
                    $shift,
                    $rule,
                    $holiday,
                    $punches,
                    $tenantSettings
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
                    'in_progress' => $inProgressCount++,
                    'scheduled' => $scheduledCount++,
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
                'in_progress' => $inProgressCount,
                'scheduled' => $scheduledCount,
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
        $today = Carbon::today();
        if ($startDate->gt($today)) {
            return [
                'start_date' => $startDate->toDateString(),
                'end_date' => $endDate->toDateString(),
                'total_processed' => 0,
                'present' => 0,
                'absent' => 0,
                'late' => 0,
                'missing_punch' => 0,
            ];
        }

        $clampedEnd = $endDate->gt($today) ? $today : $endDate;
        $current = $startDate->copy();
        $totalProcessed = 0;
        $totalPresent = 0;
        $totalAbsent = 0;
        $totalLate = 0;
        $totalMissingPunch = 0;

        while ($current->lte($clampedEnd)) {
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
        Collection $punches,
        array $tenantSettings = []
    ): array {
        $isSunday = $date->isSunday();
        $isHoliday = $holiday !== null;

        // Check for explicit roster entry on this date
        $rosterEntry = $this->shiftService->getRosterEntryForEmployee($employee, $date);
        $isRosterRestDay = $rosterEntry !== null && ($rosterEntry->schedule_type === 'rest_day' || $rosterEntry->schedule_type === 'off');
        $isSundayRestDay = $isSunday && ($rosterEntry === null || $rosterEntry->schedule_type !== 'shift');
        $isRestDay = $isRosterRestDay || $isSundayRestDay;

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
                    'anomalies' => [],
                    'calculation_breakdown' => [
                        'rule' => $rule->rule_name,
                        'leave_type' => $approvedLeave->leaveType?->name,
                        'leave_type_code' => $approvedLeave->leaveType?->code,
                        'leave_request_id' => $approvedLeave->id,
                        'is_half_day' => (bool) $approvedLeave->is_half_day,
                        'half_day_type' => $approvedLeave->half_day_type,
                        'is_paid' => (bool) ($approvedLeave->leaveType?->is_paid ?? true),
                        'notes' => "Approved Leave: {$approvedLeave->leaveType?->name}",
                    ],
                ];
            }

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
            } elseif ($date->isToday() && $shift !== null) {
                $shiftStart = Carbon::parse($date->toDateString().' '.$shift->start_time);
                if (Carbon::now()->lt($shiftStart)) {
                    $status = 'scheduled';
                    $notes = 'Shift scheduled for today; start time is in the future.';
                } else {
                    $status = 'absent';
                    $notes = 'No biometric punches recorded';
                }
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
                'anomalies' => [],
                'calculation_breakdown' => [
                    'rule' => $rule->rule_name,
                    'punches_count' => 0,
                    'notes' => $notes,
                ],
            ];
        }

        // Apply anti-passback debouncing on raw punches
        $antiPassbackMinutes = (int) ($tenantSettings['anti_passback_minutes'] ?? 3);
        $debouncedPunches = $this->applyAntiPassbackDebounce($punches, $antiPassbackMinutes);

        // Pair Check-in and Check-out
        [$checkIn, $checkOut, $isSinglePunch] = $this->pairPunches($debouncedPunches, $shift, $date, $tenantSettings);

        // Case B: Incomplete Single Punch (Missing punch policy)
        if ($isSinglePunch || $checkIn === null || $checkOut === null) {
            // Check if shift is currently on-going today (Clocked in, waiting to clock out)
            if ($checkIn !== null && $checkOut === null && $date->isToday()) {
                $isShiftOngoing = false;
                if ($shift !== null) {
                    $shiftEnd = Carbon::parse($date->toDateString().' '.$shift->end_time);
                    if ($shift->is_night_shift) {
                        $shiftEnd->addDay();
                    }
                    // Consider ongoing if current time is before shift end + 30 minutes buffer
                    $isShiftOngoing = Carbon::now()->lt($shiftEnd->copy()->addMinutes(30));
                } else {
                    $isShiftOngoing = Carbon::now()->hour < 19;
                }

                if ($isShiftOngoing) {
                    $lateMinutes = 0;
                    if ($shift !== null) {
                        $shiftStart = Carbon::parse($date->toDateString().' '.$shift->start_time);
                        $graceMinutes = $rule->grace_period_minutes ?? $shift->grace_minutes ?? 10;
                        if ($checkIn->gt($shiftStart->copy()->addMinutes($graceMinutes))) {
                            $lateMinutes = (int) abs($checkIn->diffInMinutes($shiftStart));
                        }
                    }

                    $anomalies = [];
                    if ($lateMinutes > 0) {
                        $anomalies[] = [
                            'type' => 'LATE_ARRIVAL',
                            'label' => "Late Check-in ({$lateMinutes}m)",
                            'color' => '#FBBF24',
                            'severity' => 'medium',
                            'minutes' => $lateMinutes,
                        ];
                    }

                    return [
                        'check_in' => $checkIn->toDateTimeString(),
                        'check_out' => null,
                        'worked_hours' => 0.00,
                        'regular_hours' => 0.00,
                        'late_minutes' => $lateMinutes,
                        'early_departure_minutes' => 0,
                        'ot_hours' => 0.00,
                        'double_ot_hours' => 0.00,
                        'status' => 'in_progress',
                        'anomalies' => $anomalies,
                        'calculation_breakdown' => [
                            'rule' => $rule->rule_name,
                            'punches_count' => $punches->count(),
                            'notes' => 'Shift currently in progress. Employee has clocked in and is on duty.',
                        ],
                    ];
                }
            }

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
        $punchMode = $shift?->punch_mode ?? 'first_last';
        $breakDeductionType = $shift?->break_deduction_type ?? 'auto_deduct';
        $scheduledBreakMinutes = (int) ($shift?->break_minutes ?? 0);
        $minBreakQualifyingMinutes = (int) ($shift?->min_work_hours_for_break ?? 300);
        $isActualSegments = ($punchMode === 'actual_segments');
        $allowEarlyInAsOt = (bool) ($tenantSettings['allow_early_in_as_ot'] ?? false);
        $segmentBreakdown = null;

        if ($isActualSegments && $debouncedPunches->count() >= 4) {
            $sortedPunches = $debouncedPunches->sortBy('punch_datetime')->values();
            $segmentPairs = [];
            $breakIntervals = [];
            $totalSegmentMinutes = 0;
            $totalActualBreakMinutes = 0;

            for ($i = 0; $i < $sortedPunches->count() - 1; $i += 2) {
                $pIn = Carbon::parse($sortedPunches[$i]->punch_datetime);
                $pOut = Carbon::parse($sortedPunches[$i + 1]->punch_datetime);
                $duration = max(0, (int) abs($pOut->diffInMinutes($pIn)));
                $totalSegmentMinutes += $duration;
                $segmentPairs[] = [
                    'in' => $pIn->format('H:i'),
                    'out' => $pOut->format('H:i'),
                    'duration_hours' => round($duration / 60.0, 2),
                ];

                if ($i + 2 < $sortedPunches->count()) {
                    $nextIn = Carbon::parse($sortedPunches[$i + 2]->punch_datetime);
                    $breakDur = max(0, (int) abs($nextIn->diffInMinutes($pOut)));
                    $totalActualBreakMinutes += $breakDur;
                    $breakIntervals[] = [
                        'out' => $pOut->format('H:i'),
                        'in' => $nextIn->format('H:i'),
                        'duration_minutes' => $breakDur,
                    ];
                }
            }

            $rawMinutes = $totalSegmentMinutes + $totalActualBreakMinutes;

            $breakMinutes = match ($breakDeductionType) {
                'no_deduction' => 0,
                'auto_deduct' => ($rawMinutes >= $minBreakQualifyingMinutes ? $scheduledBreakMinutes : 0),
                'actual_punches' => $totalActualBreakMinutes,
                default => $totalActualBreakMinutes,
            };

            $netMinutes = max(0, $rawMinutes - $breakMinutes);
            $workedHours = round($netMinutes / 60.0, 2);

            $segmentBreakdown = [
                'mode' => 'actual_segments',
                'break_deduction_type' => $breakDeductionType,
                'segments' => $segmentPairs,
                'breaks' => $breakIntervals,
                'total_break_minutes' => $breakMinutes,
            ];
        } else {
            // First-Last mode (Standard shift break deduction policy)
            $rawMinutes = (int) abs($checkOut->diffInMinutes($checkIn));

            $breakMinutes = 0;
            if ($breakDeductionType === 'no_deduction') {
                $breakMinutes = 0;
            } elseif ($breakDeductionType === 'actual_punches') {
                // If intermediate punches exist, calculate actual duration between intermediate out & in
                if ($debouncedPunches->count() >= 4) {
                    $sorted = $debouncedPunches->sortBy('punch_datetime')->values();
                    $actualBreak = 0;
                    for ($i = 1; $i < $sorted->count() - 1; $i += 2) {
                        $pOut = Carbon::parse($sorted[$i]->punch_datetime);
                        $pIn = Carbon::parse($sorted[$i + 1]->punch_datetime);
                        if ($pIn->gt($pOut)) {
                            $actualBreak += (int) abs($pIn->diffInMinutes($pOut));
                        }
                    }
                    $breakMinutes = $actualBreak;
                } else {
                    $breakMinutes = 0;
                }
            } else {
                // 'auto_deduct': deduct scheduled break if employee worked at least min_work_hours_for_break
                if ($scheduledBreakMinutes > 0 && $rawMinutes >= $minBreakQualifyingMinutes) {
                    $breakMinutes = $scheduledBreakMinutes;
                }
            }

            $netMinutes = max(0, $rawMinutes - $breakMinutes);
            $workedHours = round($netMinutes / 60.0, 2);
        }

        // 3. Calculate late arrival minutes
        $lateMinutes = 0;
        if ($shift !== null) {
            $shiftStart = Carbon::parse($date->toDateString().' '.$shift->start_time);
            $graceMinutes = $shift->grace_minutes ?? $rule->grace_period_minutes ?? 10;
            $graceCutoff = $shiftStart->copy()->addMinutes($graceMinutes);

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

            $earlyGraceMinutes = $shift->early_departure_grace_minutes ?? $rule->early_departure_grace_minutes ?? 0;
            $earlyCutoff = $shiftEnd->copy()->subMinutes($earlyGraceMinutes);
            if ($checkOut->lt($earlyCutoff)) {
                $earlyDepartureMinutes = (int) abs($shiftEnd->diffInMinutes($checkOut));
            }
        }

        // 5. Overtime Calculation via Engine (applying pre-shift arrival OT policy)
        $earlyArrivalMinutes = 0;
        $hoursForOt = $workedHours;
        $isEarlyInAsOt = $allowEarlyInAsOt || (bool) ($shift?->early_in_as_ot ?? false);
        if ($shift !== null && ! $isEarlyInAsOt) {
            $shiftStart = Carbon::parse($date->toDateString().' '.$shift->start_time);
            if ($checkIn->lt($shiftStart)) {
                $earlyArrivalMinutes = (int) abs($shiftStart->diffInMinutes($checkIn));
                $hoursForOt = max(0.00, round(($netMinutes - $earlyArrivalMinutes) / 60.0, 2));
            }
        }

        $otResult = $this->overtimeService->calculate($rule, $shift, $date, $hoursForOt, $holiday, $isRestDay);

        // 6. Collect Structured Anomalies
        $anomalies = [];
        if ($earlyArrivalMinutes > 0) {
            $anomalies[] = [
                'type' => 'EARLY_ARRIVAL',
                'label' => "Early Arrival ({$earlyArrivalMinutes}m)",
                'minutes' => $earlyArrivalMinutes,
                'color' => '#60A5FA', // blue-400
                'severity' => 'low',
            ];
        }
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
        } elseif ($isRestDay) {
            $status = 'present';
        } elseif ($approvedLeave && $approvedLeave->is_half_day) {
            $status = 'half_day';
        } elseif ($shift && $shift->shift_type === 'half_day') {
            $status = 'half_day';
        } elseif ($workedHours >= $rule->half_day_min_hours && $workedHours < $rule->half_day_max_hours) {
            $status = 'half_day';
        } elseif ($workedHours < $rule->half_day_min_hours) {
            $status = 'absent';
        }

        $regularHours = $otResult['regular_hours'];
        if ($approvedLeave && $approvedLeave->is_half_day) {
            $regularHours = min(8.00, round($regularHours + 4.00, 2));
        }

        $isScheduledHalfDay = $shift && $shift->shift_type === 'half_day';
        $isPaid = true;
        if ($approvedLeave) {
            $isPaid = (bool) ($approvedLeave->leaveType?->is_paid ?? true);
        } elseif ($status === 'half_day' && ! $isScheduledHalfDay) {
            // Unauthorized half day (worked half day without approved leave or scheduled half-day shift)
            $isPaid = false;
            $anomalies[] = [
                'type' => 'UNAPPROVED_HALF_DAY',
                'label' => 'Unapproved Half Day',
                'minutes' => $lateMinutes,
                'color' => '#EF4444', // red-500
                'severity' => 'high',
                'note' => 'Worked half-day duration without approved leave. Requires managerial/HR approval or roster adjustment.',
            ];
        }

        return [
            'check_in' => $checkIn->toDateTimeString(),
            'check_out' => $checkOut->toDateTimeString(),
            'worked_hours' => $workedHours,
            'regular_hours' => $regularHours,
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
                'debounced_punches_count' => $debouncedPunches->count(),
                'punch_mode' => $punchMode,
                'break_deduction_type' => $breakDeductionType,
                'intermediate_punch_mode' => $punchMode,
                'segments_breakdown' => $segmentBreakdown,
                'holiday_name' => $holiday?->name,
                'is_roster_rest_day' => $isRestDay,
                'is_scheduled_half_day' => $isScheduledHalfDay,
                'is_paid' => $isPaid,
                'uncredited_early_arrival_minutes' => $earlyArrivalMinutes,
                'leave_type' => $approvedLeave?->leaveType?->name,
                'leave_type_code' => $approvedLeave?->leaveType?->code,
                'leave_request_id' => $approvedLeave?->id,
                'is_half_day' => (bool) ($approvedLeave?->is_half_day ?? false),
            ],
        ];
    }

    /**
     * Pair raw punches into check-in and check-out timestamps, utilizing shift sliding windows when defined.
     *
     * @param  Collection<int, AttendanceLog>  $punches
     * @param  array<string, mixed>  $tenantSettings
     * @return array{0: ?Carbon, 1: ?Carbon, 2: bool}
     */
    private function pairPunches(
        Collection $punches,
        ?Shift $shift = null,
        ?CarbonInterface $date = null,
        array $tenantSettings = []
    ): array {
        if ($punches->isEmpty()) {
            return [null, null, false];
        }

        $ignoreTerminalPunchType = (bool) ($tenantSettings['ignore_terminal_punch_type'] ?? true);

        // Tier 1: Hardware-keyed punch check ONLY if ignore_terminal_punch_type is false
        if (! $ignoreTerminalPunchType) {
            $inPunch = $punches->firstWhere('punch_type', 'in');
            $outPunch = $punches->reverse()->firstWhere('punch_type', 'out');

            if ($inPunch && $outPunch && $inPunch->id !== $outPunch->id) {
                $inTime = Carbon::parse($inPunch->punch_datetime);
                $outTime = Carbon::parse($outPunch->punch_datetime);

                if ($outTime->gt($inTime)) {
                    return [$inTime, $outTime, false];
                }
            }
        }

        // Tier 2: Shift sliding window matching (with Elastic Out-Window)
        if ($shift !== null && $date !== null) {
            [$inStart, $inEnd] = $shift->getInWindow($date);
            [$outStart, $outEnd] = $shift->getOutWindow($date);

            // Add +/- 5 minute operational grace margin
            $inStartGrace = $inStart->copy()->subMinutes(5);
            $inEndGrace = $inEnd->copy()->addMinutes(5);
            $outStartGrace = $outStart->copy()->subMinutes(5);

            $inCandidates = $punches->filter(function (AttendanceLog $log) use ($inStartGrace, $inEndGrace) {
                $time = Carbon::parse($log->punch_datetime);
                return $time->gte($inStartGrace) && $time->lte($inEndGrace);
            })->sortBy('punch_datetime');

            $matchedIn = $inCandidates->first();

            // Tier 2.1: If no normal start candidate found, check if employee punched for 2nd half
            if (! $matchedIn) {
                $secondHalfWindow = $shift->getSecondHalfInWindow($date);
                if ($secondHalfWindow !== null) {
                    [$halfInStart, $halfInEnd] = $secondHalfWindow;
                    $halfInCandidates = $punches->filter(function (AttendanceLog $log) use ($halfInStart, $halfInEnd) {
                        $time = Carbon::parse($log->punch_datetime);
                        return $time->gte($halfInStart) && $time->lte($halfInEnd);
                    })->sortBy('punch_datetime');

                    $matchedIn = $halfInCandidates->first();
                }
            }

            // Tier 2.1b: Early arrival on non-rotational shift
            // If employee arrived earlier than standard in-window (e.g. 06:00 AM for 08:30 AM shift),
            // match early arrival punch as Check-In when early_in_as_att_in is enabled or when no standard window candidate exists
            if ($shift->shift_type !== 'rotational' && ! $shift->is_night_shift) {
                $earlyCandidates = $punches->filter(function (AttendanceLog $log) use ($inStartGrace, $outStartGrace) {
                    $time = Carbon::parse($log->punch_datetime);
                    return $time->lt($inStartGrace) && $time->lt($outStartGrace);
                })->sortBy('punch_datetime');

                if ($earlyCandidates->isNotEmpty()) {
                    if (($shift->early_in_as_att_in ?? true) || ! $matchedIn) {
                        $matchedIn = $earlyCandidates->first();
                    }
                }
            }

            if ($matchedIn) {
                $inTime = Carbon::parse($matchedIn->punch_datetime);

                // Elastic Out-Window: Match any punch after In-punch that is at or past outStartGrace,
                // or if staying late (overtime past outEndGrace), or separated by reasonable shift time
                $outCandidates = $punches->filter(function (AttendanceLog $log) use ($inTime, $outStartGrace) {
                    $time = Carbon::parse($log->punch_datetime);
                    return $time->gt($inTime) && ($time->gte($outStartGrace) || abs($time->diffInMinutes($inTime)) >= 30);
                })->sortByDesc('punch_datetime');

                $matchedOut = $outCandidates->first();

                if ($matchedOut && $matchedIn->id !== $matchedOut->id) {
                    $outTime = Carbon::parse($matchedOut->punch_datetime);
                    if ($outTime->gt($inTime)) {
                        return [$inTime, $outTime, false];
                    }
                }

                // If only In-punch was found
                return [$inTime, null, true];
            }

            // Tier 2.2: If employee has multiple punches separated by work time, never discard the first punch!
            // When multiple punches exist on this date, pair the earliest and latest as In and Out
            // (e.g. employee arrived mid-day without a predefined 2nd half window and left at shift end)
            if ($punches->count() >= 2) {
                $sorted = $punches->sortBy('punch_datetime')->values();
                $earliest = Carbon::parse($sorted->first()->punch_datetime);
                $latest = Carbon::parse($sorted->last()->punch_datetime);

                if (abs($latest->diffInMinutes($earliest)) >= 30) {
                    return [$earliest, $latest, false];
                }
            }

            // If only single punch exists and it's near/in Out window, treat as Out-only
            $outOnlyCandidates = $punches->filter(function (AttendanceLog $log) use ($outStartGrace) {
                $time = Carbon::parse($log->punch_datetime);
                return $time->gte($outStartGrace);
            })->sortByDesc('punch_datetime');

            if ($outOnlyCandidates->isNotEmpty()) {
                return [null, Carbon::parse($outOnlyCandidates->first()->punch_datetime), true];
            }
        }

        // Tier 3: Chronological pairing
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
     * Query raw attendance logs for an employee on a date, accounting for night shifts and consumed checkout punches.
     *
     * @return Collection<int, AttendanceLog>
     */
    private function getPunchesForDate(string $tenantId, Employee $employee, CarbonInterface $date, ?Shift $shift): Collection
    {
        $dateStr = $date->toDateString();
        $employeeId = $employee->id;

        // Check if previous day had a night shift to avoid claiming Day D-1 checkout punches as Day D check-in
        $prevDate = $date->copy()->subDay();
        $consumedCheckoutCutoff = null;

        $prevAttendance = AttendanceDaily::where('tenant_id', $tenantId)
            ->where('employee_id', $employeeId)
            ->whereDate('attendance_date', $prevDate->toDateString())
            ->first();

        if ($prevAttendance && $prevAttendance->check_out) {
            $prevCheckOut = Carbon::parse($prevAttendance->check_out);
            if ($prevCheckOut->toDateString() === $dateStr) {
                // If previous shift checked out on this date, all punches on or prior to that checkout
                // belong to the previous day's shift and must not leak into today
                $consumedCheckoutCutoff = $prevCheckOut;
            }
        } else {
            // Check if previous date had a late evening in-punch or night shift to avoid morning checkout leakage
            $prevInPunch = AttendanceLog::where('tenant_id', $tenantId)
                ->where('employee_id', $employeeId)
                ->whereBetween('punch_datetime', [
                    Carbon::parse($prevDate->toDateString().' 18:00:00'),
                    Carbon::parse($dateStr.' 04:00:00'),
                ])
                ->first();

            if ($prevInPunch) {
                $morningOutPunch = AttendanceLog::where('tenant_id', $tenantId)
                    ->where('employee_id', $employeeId)
                    ->whereBetween('punch_datetime', [
                        Carbon::parse($dateStr.' 04:00:01'),
                        Carbon::parse($dateStr.' 12:00:00'),
                    ])
                    ->orderByDesc('punch_datetime')
                    ->first();

                if ($morningOutPunch) {
                    $consumedCheckoutCutoff = Carbon::parse($morningOutPunch->punch_datetime);
                }
            }
        }

        if ($shift) {
            [$inStart, $inEnd] = $shift->getInWindow($date);
            [$outStart, $outEnd] = $shift->getOutWindow($date);

            // For non-rotational day shifts (regular, half_day, flexible), the employee has a single fixed schedule
            // on this duty roster date. Early morning arrivals on that date (e.g. 06:00 AM for 08:30 AM shift)
            // must not be clipped by a narrow window.
            // For rotational and night shifts, keep sliding windows to avoid cross-shift punch collision.
            if ($shift->shift_type !== 'rotational' && ! $shift->is_night_shift) {
                $windowStart = Carbon::parse($dateStr . ' 00:00:00');
            } else {
                $windowStart = $inStart->copy()->subMinutes(60);
            }

            $windowEnd = $outEnd->copy()->addMinutes(180);

            $query = AttendanceLog::query()
                ->where('tenant_id', $tenantId)
                ->where('employee_id', $employeeId)
                ->whereBetween('punch_datetime', [$windowStart, $windowEnd]);
        } else {
            // No shift assigned (e.g. rest day, holiday, or off day)
            // If employee swiped late in the evening (>= 18:00), allow query window to extend into morning of D+1 (up to 12:00:00)
            $hasLateEvening = AttendanceLog::where('tenant_id', $tenantId)
                ->where('employee_id', $employeeId)
                ->whereBetween('punch_datetime', [
                    Carbon::parse($dateStr.' 18:00:00'),
                    Carbon::parse($dateStr.' 23:59:59'),
                ])
                ->exists();

            if ($hasLateEvening) {
                $query = AttendanceLog::query()
                    ->where('tenant_id', $tenantId)
                    ->where('employee_id', $employeeId)
                    ->whereBetween('punch_datetime', [
                        Carbon::parse($dateStr.' 00:00:00'),
                        Carbon::parse($dateStr.' 12:00:00')->addDay(),
                    ]);
            } else {
                $query = AttendanceLog::query()
                    ->where('tenant_id', $tenantId)
                    ->where('employee_id', $employeeId)
                    ->whereDate('punch_datetime', $dateStr);
            }
        }

        if ($consumedCheckoutCutoff !== null) {
            $query->where('punch_datetime', '>', $consumedCheckoutCutoff->toDateTimeString());
        }

        return $query->orderBy('punch_datetime')->get();
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

            if (! $shift && $record->employee) {
                $shift = $this->shiftService->getEffectiveShiftForEmployee($record->employee, $date);
                if ($shift) {
                    $record->shift_id = $shift->id;
                }
            }

            $rule = AttendanceRule::resolveRuleForShift($shift, $tenantId);
            $holiday = $this->shiftService->isHoliday($date);

            $checkIn = ! empty($data['check_in']) ? Carbon::parse($data['check_in']) : null;
            $checkOut = ! empty($data['check_out']) ? Carbon::parse($data['check_out']) : null;

            $workedHours = 0.00;
            $lateMinutes = 0;
            $earlyDepartureMinutes = 0;

            if ($checkIn && $checkOut && $checkOut->gt($checkIn)) {
                $rawMinutes = (int) abs($checkOut->diffInMinutes($checkIn));
                $breakMinutes = 0;
                $breakDeductionType = $shift?->break_deduction_type ?? 'auto_deduct';
                $minQualifying = (int) ($shift?->min_work_hours_for_break ?? 300);

                if ($breakDeductionType === 'auto_deduct' && $shift && $shift->break_minutes > 0 && $rawMinutes >= $minQualifying) {
                    $breakMinutes = $shift->break_minutes;
                }

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

            $isPaid = (bool) ($record->is_paid ?? true);
            if ($status === 'present' || ($checkIn && $checkOut)) {
                $isPaid = true;
            }

            // Filter out resolved punch anomalies if punches are now complete
            $anomalies = $record->anomalies ?? [];
            if ($checkIn && $checkOut && is_array($anomalies)) {
                $anomalies = array_values(array_filter($anomalies, function ($a) {
                    $type = is_array($a) ? ($a['type'] ?? '') : '';
                    return ! in_array($type, ['MISSING_IN', 'MISSING_OUT', 'INCOMPLETE_PUNCH', 'UNAPPROVED_HALF_DAY'], true);
                }));
            }

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
                'is_paid' => $isPaid,
                'anomalies' => $anomalies,
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
            'in_progress' => $records->where('status', 'in_progress')->count(),
            'scheduled' => $records->where('status', 'scheduled')->count(),
            'manual_adjusted' => $records->where('is_manual', true)->count(),
            'total_worked_hours' => round((float) $records->sum('worked_hours'), 2),
            'total_regular_hours' => round((float) $records->sum('regular_hours'), 2),
            'total_ot_hours' => round((float) $records->sum('ot_hours'), 2),
            'total_double_ot_hours' => round((float) $records->sum('double_ot_hours'), 2),
        ];
    }

    /**
     * Get a summary of all raw biometric logs pending processing.
     *
     * @return array{
     *     unprocessed_count: int,
     *     unprocessed_dates_count: int,
     *     dates: array<int, array{date: string, count: int}>,
     *     oldest_date: ?string,
     *     newest_date: ?string
     * }
     */
    public function getUnprocessedSummary(?string $tenantId = null): array
    {
        $tenantId = $tenantId
            ?? session('tenant_id')
            ?? (app()->has('current_tenant_id') ? app('current_tenant_id') : null);

        $query = AttendanceLog::query()->where('is_processed', false);

        if ($tenantId !== null) {
            $query->where('tenant_id', $tenantId);
        }

        $count = (clone $query)->count();
        $dates = (clone $query)
            ->selectRaw('DATE(punch_datetime) as punch_date, count(*) as punches_count')
            ->groupBy('punch_date')
            ->orderBy('punch_date')
            ->get()
            ->map(fn ($r) => [
                'date' => (string) $r->punch_date,
                'count' => (int) $r->punches_count,
            ])
            ->values()
            ->toArray();

        return [
            'unprocessed_count' => $count,
            'unprocessed_dates_count' => count($dates),
            'dates' => $dates,
            'oldest_date' => ! empty($dates) ? $dates[0]['date'] : null,
            'newest_date' => ! empty($dates) ? $dates[count($dates) - 1]['date'] : null,
        ];
    }

    /**
     * Process all dates containing unprocessed biometric punch logs.
     *
     * @return array{
     *     dates_count: int,
     *     processed_dates: array<int, string>,
     *     total_processed: int,
     *     present: int,
     *     absent: int,
     *     late: int,
     *     missing_punch: int
     * }
     */
    public function processUnprocessedBacklog(?string $tenantId = null, bool $overwriteManual = false): array
    {
        $tenantId = $tenantId
            ?? session('tenant_id')
            ?? (app()->has('current_tenant_id') ? app('current_tenant_id') : null);

        $summary = $this->getUnprocessedSummary($tenantId);
        $dates = $summary['dates'];

        $totalProcessed = 0;
        $totalPresent = 0;
        $totalAbsent = 0;
        $totalLate = 0;
        $totalMissingPunch = 0;
        $processedDates = [];

        foreach ($dates as $item) {
            $date = Carbon::parse($item['date']);
            $res = $this->processDate(
                date: $date,
                overwriteManual: $overwriteManual,
                tenantId: $tenantId
            );

            $totalProcessed += $res['processed'];
            $totalPresent += $res['present'];
            $totalAbsent += $res['absent'];
            $totalLate += $res['late'];
            $totalMissingPunch += $res['missing_punch'];
            $processedDates[] = $item['date'];
        }

        return [
            'dates_count' => count($processedDates),
            'processed_dates' => $processedDates,
            'total_processed' => $totalProcessed,
            'present' => $totalPresent,
            'absent' => $totalAbsent,
            'late' => $totalLate,
            'missing_punch' => $totalMissingPunch,
        ];
    }

    /**
     * Check if a given date falls within a finalized/approved payroll cycle.
     */
    public function isDateInLockedPayrollPeriod(CarbonInterface $date, ?string $tenantId = null): bool
    {
        $tenantId = $tenantId
            ?? session('tenant_id')
            ?? (app()->has('current_tenant_id') ? app('current_tenant_id') : null);

        if ($tenantId === null) {
            return false;
        }

        return PayrollRun::where('tenant_id', $tenantId)
            ->where('period_year', (int) $date->year)
            ->where('period_month', (int) $date->month)
            ->whereIn('status', ['approved', 'locked'])
            ->exists();
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

    /**
     * Get tenant attendance calculation settings with enterprise defaults.
     *
     * @return array<string, mixed>
     */
    public function getTenantAttendanceSettings(string $tenantId): array
    {
        $tenant = Tenant::find($tenantId);
        $tenantDefaultRule = AttendanceRule::where('tenant_id', $tenantId)->whereNull('shift_id')->first();

        return [
            'ignore_terminal_punch_type' => filter_var($tenant?->getSetting('ignore_terminal_punch_type', self::DEFAULT_SETTINGS['ignore_terminal_punch_type']), FILTER_VALIDATE_BOOLEAN),
            'anti_passback_minutes' => (int) ($tenant?->getSetting('anti_passback_minutes', self::DEFAULT_SETTINGS['anti_passback_minutes']) ?? self::DEFAULT_SETTINGS['anti_passback_minutes']),
            'auto_detect_shift' => filter_var($tenant?->getSetting('auto_detect_shift', self::DEFAULT_SETTINGS['auto_detect_shift']), FILTER_VALIDATE_BOOLEAN),
            'allow_early_in_as_ot' => filter_var($tenant?->getSetting('allow_early_in_as_ot', self::DEFAULT_SETTINGS['allow_early_in_as_ot']), FILTER_VALIDATE_BOOLEAN),
            'overtime_minimum_minutes' => (int) ($tenant?->getSetting('overtime_minimum_minutes', $tenantDefaultRule?->ot_minimum_minutes ?? self::DEFAULT_SETTINGS['overtime_minimum_minutes']) ?? self::DEFAULT_SETTINGS['overtime_minimum_minutes']),
        ];
    }

    /**
     * Save tenant attendance calculation settings and synchronize default overtime threshold.
     *
     * @param  array<string, mixed>  $settings
     * @return array<string, mixed>
     */
    public function saveTenantAttendanceSettings(string $tenantId, array $settings): array
    {
        return DB::transaction(function () use ($tenantId, $settings): array {
            $tenant = Tenant::findOrFail($tenantId);

            foreach ($settings as $key => $value) {
                $tenant->setSetting($key, $value);
            }

            // Sync overtime_minimum_minutes with tenant default AttendanceRule to prevent duplicate divergence
            if (isset($settings['overtime_minimum_minutes'])) {
                AttendanceRule::updateOrCreate(
                    [
                        'tenant_id' => $tenantId,
                        'shift_id' => null,
                    ],
                    [
                        'rule_name' => 'Default Company Policy',
                        'ot_minimum_minutes' => (int) $settings['overtime_minimum_minutes'],
                    ]
                );
            }

            return $this->getTenantAttendanceSettings($tenantId);
        });
    }

    /**
     * Apply anti-passback debouncing: compress rapid duplicate swipes within X minutes into a single punch.
     *
     * @param  Collection<int, AttendanceLog>  $punches
     * @return Collection<int, AttendanceLog>
     */
    public function applyAntiPassbackDebounce(Collection $punches, int $antiPassbackMinutes): Collection
    {
        if ($antiPassbackMinutes <= 0 || $punches->count() <= 1) {
            return $punches;
        }

        $sorted = $punches->sortBy('punch_datetime')->values();
        $debounced = new Collection;
        $lastPunchTime = null;

        foreach ($sorted as $punch) {
            $punchTime = Carbon::parse($punch->punch_datetime);
            if ($lastPunchTime === null) {
                $debounced->push($punch);
                $lastPunchTime = $punchTime;
            } elseif (abs($punchTime->diffInMinutes($lastPunchTime)) >= $antiPassbackMinutes) {
                $debounced->push($punch);
                $lastPunchTime = $punchTime;
            }
        }

        return $debounced;
    }

    /**
     * Auto-detect the best matching active company shift based on punch arrival time.
     * Prioritizes shifts associated with the employee's roster or assignments if provided.
     */
    public function autoDetectShiftForPunch(
        string $tenantId,
        CarbonInterface $date,
        CarbonInterface $punchTime,
        ?Employee $employee = null
    ): ?Shift {
        $shifts = Shift::where('tenant_id', $tenantId)->where('is_active', true)->get();
        if ($shifts->isEmpty()) {
            return null;
        }

        $preferredShiftIds = collect();
        if ($employee !== null) {
            $rosterShiftIds = RosterEntry::where('employee_id', $employee->id)
                ->whereNotNull('shift_id')
                ->pluck('shift_id');
            $assignedShiftIds = ShiftAssignment::where('employee_id', $employee->id)
                ->pluck('shift_id');
            $preferredShiftIds = $rosterShiftIds->merge($assignedShiftIds)->filter()->unique();
        }

        $evaluateShift = function (Shift $candidate) use ($date, $punchTime): ?int {
            [$inStart, $inEnd] = $candidate->getInWindow($date);
            $inStartGrace = $inStart->copy()->subMinutes(30);
            $inEndGrace = $inEnd->copy()->addMinutes(30);

            if ($punchTime->gte($inStartGrace) && $punchTime->lte($inEndGrace)) {
                $shiftStart = Carbon::parse($date->toDateString().' '.$candidate->start_time);
                return (int) abs($punchTime->diffInMinutes($shiftStart));
            }

            return null;
        };

        // Pass 1: Prioritize employee's assigned or rostered shift family (e.g. 8HM, 8HE, 8HN)
        if ($preferredShiftIds->isNotEmpty()) {
            $preferredCandidates = $shifts->whereIn('id', $preferredShiftIds);
            $bestPreferred = null;
            $smallestDiff = null;

            foreach ($preferredCandidates as $candidate) {
                $diff = $evaluateShift($candidate);
                if ($diff !== null && ($smallestDiff === null || $diff < $smallestDiff)) {
                    $smallestDiff = $diff;
                    $bestPreferred = $candidate;
                }
            }

            if ($bestPreferred !== null) {
                return $bestPreferred;
            }
        }

        // Pass 2: Fallback across all active company shifts
        $bestShift = null;
        $smallestDiff = null;

        foreach ($shifts as $candidate) {
            $diff = $evaluateShift($candidate);
            if ($diff !== null && ($smallestDiff === null || $diff < $smallestDiff)) {
                $smallestDiff = $diff;
                $bestShift = $candidate;
            }
        }

        return $bestShift;
    }

    /**
     * Check if a daily attendance record represents an active missing punch anomaly.
     */
    public function isMissingPunch(AttendanceDaily $daily): bool
    {
        if ($daily->status === 'missing_punch') {
            return true;
        }

        $hasIn = ! empty($daily->check_in);
        $hasOut = ! empty($daily->check_out);

        return ($hasIn && ! $hasOut) || (! $hasIn && $hasOut);
    }

    /**
     * Check if a daily attendance record represents an unapproved half day.
     */
    public function isUnapprovedHalfDay(AttendanceDaily $daily): bool
    {
        if ($daily->status !== 'half_day') {
            return false;
        }

        if (! $daily->is_paid) {
            return true;
        }

        // Check if explicitly flagged with unapproved half-day anomaly tag
        if (! empty($daily->anomalies) && is_array($daily->anomalies)) {
            foreach ($daily->anomalies as $anomaly) {
                if (is_array($anomaly) && ($anomaly['type'] ?? '') === 'UNAPPROVED_HALF_DAY') {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * Check if a daily record has actionable structured anomaly flags.
     */
    public function hasActionableAnomaly(AttendanceDaily $daily): bool
    {
        if (empty($daily->anomalies) || ! is_array($daily->anomalies)) {
            return false;
        }

        foreach ($daily->anomalies as $anomaly) {
            $type = is_array($anomaly) ? ($anomaly['type'] ?? '') : '';
            if (in_array($type, ['MISSING_IN', 'MISSING_OUT', 'INCOMPLETE_PUNCH', 'UNAPPROVED_HALF_DAY'], true)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Check if a record is an actionable anomaly requiring managerial resolution.
     */
    public function isRecordActionableAnomaly(AttendanceDaily $daily, ?string $maxDate = null): bool
    {
        $maxDate = $maxDate ?? Carbon::today()->toDateString();
        $attDate = Carbon::parse($daily->attendance_date)->toDateString();

        if ($attDate > $maxDate) {
            return false;
        }

        return $this->isMissingPunch($daily)
            || $this->isUnapprovedHalfDay($daily)
            || $this->hasActionableAnomaly($daily);
    }

    /**
     * Reconcile unpunched absent records for a month against Duty Rosters, Holidays, and Approved Leaves.
     * Enforces single source of truth across Timesheets and Exception Center.
     */
    public function reconcileMonthlySchedules(CarbonInterface $startDate, CarbonInterface $endDate, ?string $tenantId = null): int
    {
        $tenantId = $tenantId
            ?? session('tenant_id')
            ?? (app()->bound('current_tenant_id') ? app('current_tenant_id') : null);

        if (! $tenantId) {
            return 0;
        }

        $candidates = AttendanceDaily::query()
            ->where('tenant_id', $tenantId)
            ->whereBetween('attendance_date', [$startDate->toDateString(), $endDate->toDateString()])
            ->where('is_manual', false)
            ->whereNull('check_in')
            ->whereNull('check_out')
            ->where('status', 'absent')
            ->with(['employee'])
            ->get();

        if ($candidates->isEmpty()) {
            return 0;
        }

        $employeeIds = $candidates->pluck('employee_id')->unique();

        $rosters = RosterEntry::query()
            ->where('tenant_id', $tenantId)
            ->whereIn('employee_id', $employeeIds)
            ->whereBetween('roster_date', [$startDate->toDateString(), $endDate->toDateString()])
            ->with('shift:id,name,code,start_time,end_time,color')
            ->get()
            ->groupBy('employee_id');

        $leaves = LeaveRequest::query()
            ->where('tenant_id', $tenantId)
            ->whereIn('employee_id', $employeeIds)
            ->where('status', 'approved')
            ->where(function ($q) use ($startDate, $endDate) {
                $q->whereBetween('start_date', [$startDate, $endDate])
                    ->orWhereBetween('end_date', [$startDate, $endDate]);
            })
            ->with('leaveType:id,name,code,is_paid')
            ->get()
            ->groupBy('employee_id');

        $holidays = PublicHoliday::query()
            ->whereBetween('holiday_date', [$startDate, $endDate])
            ->get()
            ->keyBy(fn ($h) => Carbon::parse($h->holiday_date)->toDateString());

        $reconciledCount = 0;

        foreach ($candidates as $daily) {
            if (! $daily->employee) {
                continue;
            }

            $current = Carbon::parse($daily->attendance_date);
            $dateStr = $current->toDateString();
            $empId = $daily->employee_id;

            $empRosters = $rosters->get($empId, collect());
            $roster = $empRosters->firstWhere('roster_date', $dateStr);

            $empLeaves = $leaves->get($empId, collect());
            $activeLeave = $empLeaves->first(function ($l) use ($current) {
                return $current->between(Carbon::parse($l->start_date), Carbon::parse($l->end_date));
            });

            $holiday = $holidays->get($dateStr);

            $schedule = $this->shiftService->resolveDailySchedule(
                $daily->employee,
                $current,
                $roster,
                $activeLeave,
                $holiday
            );

            $newStatus = null;
            if ($activeLeave) {
                $newStatus = $activeLeave->is_half_day ? 'half_day' : 'leave';
            } elseif ($holiday) {
                $newStatus = 'holiday';
            } elseif ($schedule['is_off']) {
                $newStatus = 'rest_day';
            }

            if ($newStatus !== null && $newStatus !== $daily->status) {
                $daily->update(['status' => $newStatus]);
                $reconciledCount++;
            }
        }

        // Ensure unapproved half-days carry is_paid = false until adjudicated
        $unapprovedHalfDays = AttendanceDaily::query()
            ->where('tenant_id', $tenantId)
            ->whereBetween('attendance_date', [$startDate->toDateString(), $endDate->toDateString()])
            ->where('status', 'half_day')
            ->where('is_paid', true)
            ->where('is_manual', false)
            ->get();

        foreach ($unapprovedHalfDays as $hd) {
            if ($this->isUnapprovedHalfDay($hd)) {
                $hd->update(['is_paid' => false]);
                $reconciledCount++;
            }
        }

        return $reconciledCount;
    }

    /**
     * Build day-by-day roster and attendance records for an employee across a calendar month.
     * Serves as the Single Source of Truth for Employee Timesheet & Auditing.
     *
     * @return array{days: array<int, array<string, mixed>>, summary: array<string, mixed>}
     */
    public function buildTimesheetDays(Employee $employee, Carbon $startDate, Carbon $endDate, ?string $tenantId = null): array
    {
        $tenantId = $tenantId
            ?? session('tenant_id')
            ?? (app()->bound('current_tenant_id') ? app('current_tenant_id') : null);

        // Pre-reconcile unpunched absent records for this month
        $this->reconcileMonthlySchedules($startDate, $endDate, $tenantId);

        // 1. Fetch all attendance dailies
        $dailies = AttendanceDaily::query()
            ->with(['shift:id,name,code,start_time,end_time,color', 'editor:id,name', 'otApprover:id,name'])
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
            ->with('leaveType:id,name,code,is_paid')
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
        $totalApprovedOtHours = 0.0;
        $totalApprovedDoubleOtHours = 0.0;
        $presentDays = 0;
        $absentDays = 0;
        $restDays = 0;
        $holidayDays = 0;
        $leaveDays = 0;
        $halfDays = 0;
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
            $approvedOtHours = 0.0;
            $approvedDoubleOtHours = 0.0;
            $otApprovalStatus = 'pending';
            $isPaid = true;
            $checkIn = null;
            $checkOut = null;
            $isManual = false;
            $manualReason = null;
            $anomalies = [];
            $dailyId = null;

            if ($daily) {
                $dailyId = $daily->id;
                $status = $daily->status;
                $workedHours = (float) $daily->worked_hours;
                $lateMinutes = (int) $daily->late_minutes;
                $earlyMinutes = (int) $daily->early_departure_minutes;
                $otHours = (float) $daily->ot_hours;
                $doubleOtHours = (float) $daily->double_ot_hours;
                $approvedOtHours = (float) ($daily->approved_ot_hours ?? 0.0);
                $approvedDoubleOtHours = (float) ($daily->approved_double_ot_hours ?? 0.0);
                $otApprovalStatus = $daily->ot_approval_status ?? 'pending';
                $isPaid = (bool) $daily->is_paid;
                $checkIn = $daily->check_in?->format('Y-m-d H:i:s');
                $checkOut = $daily->check_out?->format('Y-m-d H:i:s');
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
            $isMissingPunch = $daily ? $this->isMissingPunch($daily) : false;
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
            $totalApprovedOtHours += $approvedOtHours;
            $totalApprovedDoubleOtHours += $approvedDoubleOtHours;

            match ($status) {
                'present' => $presentDays++,
                'absent' => $absentDays++,
                'rest_day' => $restDays++,
                'holiday' => $holidayDays++,
                'leave' => $leaveDays++,
                'half_day' => $halfDays++,
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
                    'shift_type' => $rosterShift->shift_type,
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
                'approved_ot_hours' => $approvedOtHours,
                'approved_double_ot_hours' => $approvedDoubleOtHours,
                'ot_approval_status' => $otApprovalStatus,
                'is_paid' => $isPaid,
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
            'half_days' => $halfDays,
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
            'total_approved_ot_hours' => round($totalApprovedOtHours, 2),
            'total_approved_double_ot_hours' => round($totalApprovedDoubleOtHours, 2),
        ];

        return [
            'days' => $days,
            'summary' => $summary,
        ];
    }
}

