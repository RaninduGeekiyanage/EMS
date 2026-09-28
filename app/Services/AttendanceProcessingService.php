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
use App\Models\Shift;
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
        'intermediate_punch_mode' => 'first_last', // 'first_last' (Corporate default) or 'actual_segments' (Factory default)
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
                    $firstPunch = AttendanceLog::where('tenant_id', $tenantId)
                        ->where('employee_id', $employee->id)
                        ->whereDate('punch_datetime', $dateString)
                        ->orderBy('punch_datetime')
                        ->first();

                    if ($firstPunch !== null) {
                        $shift = $this->autoDetectShiftForPunch($tenantId, $date, Carbon::parse($firstPunch->punch_datetime));
                    }
                }

                if ($existing && $existing->is_manual && ! $overwriteManual) {
                    // Reconcile raw biometric punches so they don't remain dangling/unprocessed
                    $punches = $this->getPunchesForDate($tenantId, $employee->id, $date, $shift);
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
        Collection $punches,
        array $tenantSettings = []
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
        $isActualSegments = ($tenantSettings['intermediate_punch_mode'] ?? 'first_last') === 'actual_segments';
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

            $rawMinutes = $totalSegmentMinutes;
            $breakMinutes = $totalActualBreakMinutes;
            $netMinutes = max(0, $rawMinutes);
            $workedHours = round($netMinutes / 60.0, 2);

            $segmentBreakdown = [
                'mode' => 'actual_segments',
                'segments' => $segmentPairs,
                'breaks' => $breakIntervals,
                'total_break_minutes' => $totalActualBreakMinutes,
            ];
        } else {
            // First-Last mode (Standard flat shift break deduction)
            $rawMinutes = (int) abs($checkOut->diffInMinutes($checkIn));
            $breakMinutes = ($shift && $shift->break_minutes > 0 && $rawMinutes >= ($shift->break_minutes + 60))
                ? $shift->break_minutes
                : 0;

            $netMinutes = max(0, $rawMinutes - $breakMinutes);
            $workedHours = round($netMinutes / 60.0, 2);
        }

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

        // 5. Overtime Calculation via Engine (applying pre-shift arrival OT policy)
        $hoursForOt = $workedHours;
        if ($shift !== null && ! $allowEarlyInAsOt) {
            $shiftStart = Carbon::parse($date->toDateString().' '.$shift->start_time);
            if ($checkIn->lt($shiftStart)) {
                $earlyMinutes = (int) abs($shiftStart->diffInMinutes($checkIn));
                $hoursForOt = max(0.00, round(($netMinutes - $earlyMinutes) / 60.0, 2));
            }
        }

        $otResult = $this->overtimeService->calculate($rule, $shift, $date, $hoursForOt, $holiday);

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
                'debounced_punches_count' => $debouncedPunches->count(),
                'intermediate_punch_mode' => $tenantSettings['intermediate_punch_mode'] ?? 'first_last',
                'segments_breakdown' => $segmentBreakdown,
                'holiday_name' => $holiday?->name,
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

            if ($matchedIn) {
                $inTime = Carbon::parse($matchedIn->punch_datetime);

                // Elastic Out-Window: Match any punch after In-punch that is at or past outStartGrace,
                // or if staying late (overtime past outEndGrace), or separated by reasonable shift time
                $outCandidates = $punches->filter(function (AttendanceLog $log) use ($inTime, $outStartGrace) {
                    $time = Carbon::parse($log->punch_datetime);
                    return $time->gt($inTime) && ($time->gte($outStartGrace) || $time->diffInMinutes($inTime) >= 30);
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

            // If no In candidate found in window, check if Out candidate exists
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

            if (! $shift && $record->employee) {
                $rosterEntry = $this->shiftService->getRosterEntryForEmployee($record->employee, $date);
                $shift = $rosterEntry?->shift ?? Shift::where('tenant_id', $tenantId)->first();
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
            'intermediate_punch_mode' => (string) ($tenant?->getSetting('intermediate_punch_mode', self::DEFAULT_SETTINGS['intermediate_punch_mode']) ?? self::DEFAULT_SETTINGS['intermediate_punch_mode']),
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
     */
    public function autoDetectShiftForPunch(string $tenantId, CarbonInterface $date, CarbonInterface $punchTime): ?Shift
    {
        $shifts = Shift::where('tenant_id', $tenantId)->where('is_active', true)->get();
        $bestShift = null;
        $smallestDiff = null;

        foreach ($shifts as $candidate) {
            [$inStart, $inEnd] = $candidate->getInWindow($date);
            $inStartGrace = $inStart->subMinutes(30);
            $inEndGrace = $inEnd->addMinutes(30);

            if ($punchTime->gte($inStartGrace) && $punchTime->lte($inEndGrace)) {
                $shiftStart = Carbon::parse($date->toDateString().' '.$candidate->start_time);
                $diff = abs($punchTime->diffInMinutes($shiftStart));
                if ($smallestDiff === null || $diff < $smallestDiff) {
                    $smallestDiff = $diff;
                    $bestShift = $candidate;
                }
            }
        }

        return $bestShift;
    }
}

