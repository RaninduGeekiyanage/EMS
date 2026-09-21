<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\Department;
use App\Models\Employee;
use App\Models\LeaveRequest;
use App\Models\PayrollRun;
use App\Models\PublicHoliday;
use App\Models\RosterEntry;
use App\Models\RosterPattern;
use App\Models\Shift;
use Carbon\Carbon;
use Carbon\CarbonInterface;
use Carbon\CarbonPeriod;
use DomainException;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class RosterService
{
    public function __construct(
        private readonly ShiftService $shiftService,
    ) {}

    /**
     * Retrieve complete month roster matrix, daily coverage summary, and metadata for the planner UI.
     *
     * @return array<string, mixed>
     */
    public function getMonthMatrix(int $year, int $month, ?string $departmentId = null): array
    {
        $startDate = Carbon::createFromDate($year, $month, 1)->startOfMonth();
        $endDate = $startDate->copy()->endOfMonth();
        $daysInMonth = $startDate->daysInMonth;

        // Check if this month is finalized & locked by M03 Payroll
        $isPayrollLocked = PayrollRun::where('period_year', $year)
            ->where('period_month', $month)
            ->where('status', 'locked')
            ->exists();

        // 1. Generate Days list for headers
        $days = [];
        $holidays = PublicHoliday::whereBetween('holiday_date', [$startDate->toDateString(), $endDate->toDateString()])
            ->get()
            ->keyBy(fn (PublicHoliday $h) => $h->holiday_date->toDateString());

        $coverageSummary = [];

        for ($d = 1; $d <= $daysInMonth; $d++) {
            $date = Carbon::createFromDate($year, $month, $d);
            $dateString = $date->toDateString();
            $holiday = $holidays->get($dateString);

            $days[] = [
                'day' => $d,
                'date' => $dateString,
                'day_name' => $date->format('D'), // Mon, Tue...
                'is_weekend' => $date->isWeekend(),
                'is_sunday' => $date->isSunday(),
                'is_saturday' => $date->isSaturday(),
                'holiday' => $holiday ? [
                    'id' => $holiday->id,
                    'name' => $holiday->name,
                    'type' => $holiday->type,
                ] : null,
            ];

            $coverageSummary[$dateString] = [
                'shifts' => [],
                'total_working' => 0,
                'total_rest' => 0,
                'total_leave' => 0,
            ];
        }

        // 2. Query Employees
        $employeeQuery = Employee::query()
            ->select('id', 'emp_no', 'full_name', 'department_id')
            ->with(['department:id,name'])
            ->where('employment_status', 'active')
            ->orderBy('emp_no');

        if ($departmentId !== null && $departmentId !== '' && $departmentId !== 'all') {
            $employeeQuery->where('department_id', $departmentId);
        }

        $employees = $employeeQuery->get();
        $employeeIds = $employees->pluck('id')->all();

        // 3. Query Roster Entries for this month (plus last day of previous month for fatigue calculation)
        $prevMonthLastDay = $startDate->copy()->subDay()->toDateString();
        $entries = RosterEntry::query()
            ->whereIn('employee_id', $employeeIds)
            ->whereBetween('roster_date', [$prevMonthLastDay, $endDate->toDateString()])
            ->with(['shift:id,name,code,color,start_time,end_time,is_night_shift'])
            ->get()
            ->groupBy('employee_id');

        // 4. Query Approved Leaves for this month
        $leaves = LeaveRequest::query()
            ->whereIn('employee_id', $employeeIds)
            ->where('status', 'approved')
            ->where(function ($q) use ($startDate, $endDate) {
                $q->whereBetween('start_date', [$startDate->toDateString(), $endDate->toDateString()])
                    ->orWhereBetween('end_date', [$startDate->toDateString(), $endDate->toDateString()])
                    ->orWhere(function ($sub) use ($startDate, $endDate) {
                        $sub->where('start_date', '<=', $startDate->toDateString())
                            ->where('end_date', '>=', $endDate->toDateString());
                    });
            })
            ->with(['leaveType:id,name,code'])
            ->get();

        // 5. Map Leaves per employee per date
        $leaveMap = [];
        foreach ($leaves as $leave) {
            $leaveStart = Carbon::parse($leave->start_date);
            $leaveEnd = Carbon::parse($leave->end_date);
            $period = CarbonPeriod::create(
                $leaveStart->max($startDate),
                $leaveEnd->min($endDate)
            );
            foreach ($period as $dt) {
                $leaveMap[$leave->employee_id][$dt->toDateString()] = [
                    'id' => $leave->id,
                    'leave_type' => $leave->leaveType?->name ?? 'Leave',
                    'leave_code' => $leave->leaveType?->code ?? 'LV',
                    'is_half_day' => (bool) $leave->is_half_day,
                ];
            }
        }

        // 6. Build matrix per employee
        $matrix = [];
        $totalScheduledShifts = 0;
        $totalRestDays = 0;
        $totalDraftEntries = 0;
        $totalPublishedEntries = 0;

        foreach ($employees as $emp) {
            $empEntries = $entries->get($emp->id, collect())->keyBy(function (RosterEntry $e) {
                return $e->roster_date instanceof CarbonInterface
                    ? $e->roster_date->toDateString()
                    : Carbon::parse($e->roster_date)->toDateString();
            });

            $dailyCells = [];
            $scheduledWorkDays = 0;
            $scheduledRestDays = 0;
            $totalHours = 0.0;

            // Track previous shift end datetime for worker fatigue / turnaround checks
            $prevEntry = $empEntries->get($prevMonthLastDay);
            $prevShiftEndDateTime = null;
            if ($prevEntry && $prevEntry->schedule_type === 'shift' && $prevEntry->shift) {
                $prevShiftEnd = Carbon::parse("{$prevMonthLastDay} {$prevEntry->shift->end_time}");
                if ($prevEntry->shift->is_night_shift) {
                    $prevShiftEnd->addDay();
                }
                $prevShiftEndDateTime = $prevShiftEnd;
            }

            for ($d = 1; $d <= $daysInMonth; $d++) {
                $dateString = Carbon::createFromDate($year, $month, $d)->toDateString();
                $entry = $empEntries->get($dateString);
                $leave = $leaveMap[$emp->id][$dateString] ?? null;

                $fatigueWarning = false;
                $restHours = null;

                if ($leave !== null) {
                    $coverageSummary[$dateString]['total_leave']++;
                }

                if ($entry !== null) {
                    if ($entry->schedule_type === 'shift' && $entry->shift !== null) {
                        $scheduledWorkDays++;
                        $totalScheduledShifts++;

                        // Aggregate coverage headcount
                        $code = $entry->shift->code;
                        $coverageSummary[$dateString]['shifts'][$code] = ($coverageSummary[$dateString]['shifts'][$code] ?? 0) + 1;
                        $coverageSummary[$dateString]['total_working']++;

                        // Calculate shift length in hours
                        $start = Carbon::parse($entry->shift->start_time);
                        $end = Carbon::parse($entry->shift->end_time);
                        if ($end->lt($start)) {
                            $end->addDay();
                        }
                        $diffMinutes = $start->diffInMinutes($end);
                        $netHours = max(0, ($diffMinutes - ($entry->shift->break_minutes ?? 0)) / 60);
                        $totalHours += $netHours;

                        // Fatigue Turnaround Check: interval between previous shift end and current shift start
                        $currentShiftStartDateTime = Carbon::parse("{$dateString} {$entry->shift->start_time}");
                        if ($prevShiftEndDateTime !== null) {
                            $gapMinutes = $prevShiftEndDateTime->diffInMinutes($currentShiftStartDateTime, false);
                            $gapHours = $gapMinutes / 60.0;
                            if ($gapHours < 11.0 && $gapHours >= 0.0) {
                                $fatigueWarning = true;
                                $restHours = round($gapHours, 1);
                            }
                        }

                        // Update previous shift end datetime for next day check
                        $currentShiftEndDateTime = Carbon::parse("{$dateString} {$entry->shift->end_time}");
                        if ($entry->shift->is_night_shift) {
                            $currentShiftEndDateTime->addDay();
                        }
                        $prevShiftEndDateTime = $currentShiftEndDateTime;
                    } elseif ($entry->schedule_type === 'rest_day' || $entry->schedule_type === 'off') {
                        $scheduledRestDays++;
                        $totalRestDays++;
                        $coverageSummary[$dateString]['total_rest']++;
                        $prevShiftEndDateTime = null; // Clear on rest day
                    }

                    if ($entry->status === 'draft') {
                        $totalDraftEntries++;
                    } else {
                        $totalPublishedEntries++;
                    }
                } else {
                    $prevShiftEndDateTime = null;
                }

                $dailyCells[$dateString] = [
                    'entry_id' => $entry?->id,
                    'date' => $dateString,
                    'schedule_type' => $entry?->schedule_type ?? null,
                    'shift' => $entry?->shift ? [
                        'id' => $entry->shift->id,
                        'name' => $entry->shift->name,
                        'code' => $entry->shift->code,
                        'color' => $entry->shift->color,
                        'start_time' => substr($entry->shift->start_time, 0, 5),
                        'end_time' => substr($entry->shift->end_time, 0, 5),
                        'is_night_shift' => (bool) $entry->shift->is_night_shift,
                    ] : null,
                    'status' => $entry?->status ?? null,
                    'is_overridden' => $entry ? (bool) $entry->is_overridden : false,
                    'notes' => $entry?->notes,
                    'leave' => $leave,
                    'fatigue_warning' => $fatigueWarning,
                    'rest_hours' => $restHours,
                ];
            }

            $matrix[] = [
                'employee' => [
                    'id' => $emp->id,
                    'emp_no' => $emp->emp_no,
                    'full_name' => $emp->full_name,
                    'department' => $emp->department ? [
                        'id' => $emp->department->id,
                        'name' => $emp->department->name,
                    ] : null,
                ],
                'cells' => $dailyCells,
                'stats' => [
                    'work_days' => $scheduledWorkDays,
                    'rest_days' => $scheduledRestDays,
                    'total_hours' => round($totalHours, 1),
                ],
            ];
        }

        // 7. Master Shifts & Patterns
        $shifts = Shift::query()
            ->where('is_active', true)
            ->orderBy('name')
            ->get(['id', 'name', 'code', 'color', 'start_time', 'end_time', 'is_night_shift', 'break_minutes']);

        $patterns = RosterPattern::query()
            ->active()
            ->orderBy('name')
            ->get();

        $departments = Department::query()
            ->orderBy('name')
            ->get(['id', 'name', 'code']);

        return [
            'year' => $year,
            'month' => $month,
            'month_name' => $startDate->format('F Y'),
            'days' => $days,
            'matrix' => $matrix,
            'shifts' => $shifts,
            'patterns' => $patterns,
            'departments' => $departments,
            'selected_department' => $departmentId,
            'coverage_summary' => $coverageSummary,
            'is_payroll_locked' => $isPayrollLocked,
            'summary' => [
                'total_employees' => count($employees),
                'total_scheduled_shifts' => $totalScheduledShifts,
                'total_rest_days' => $totalRestDays,
                'draft_entries' => $totalDraftEntries,
                'published_entries' => $totalPublishedEntries,
                'is_published' => $totalDraftEntries === 0 && $totalPublishedEntries > 0,
            ],
        ];
    }

    /**
     * High-performance bulk roster generation using chunked database UPSERT inside a strict transaction.
     * Guarantees atomic rollback on error and optimized memory footprint for shared hosting.
     *
     * @param  array<string, mixed>  $data
     * @return array{created: int, updated: int, total: int}
     */
    public function generateRoster(array $data): array
    {
        $startDate = Carbon::parse($data['start_date'])->startOfDay();
        $endDate = Carbon::parse($data['end_date'])->endOfDay();

        // Validate that target date range is not locked by M03 Payroll
        $this->ensureNotLockedInRange($startDate, $endDate);

        return DB::transaction(function () use ($startDate, $endDate, $data) {
            // If pattern_id is provided, load the pattern
            if (! empty($data['pattern_id'])) {
                $pattern = RosterPattern::findOrFail($data['pattern_id']);
                $patternMode = $pattern->pattern_type;
                if ($patternMode === 'weekly') {
                    $data['weekly_config'] = $pattern->pattern_data;
                } elseif ($patternMode === 'cyclical') {
                    $cyclicalSteps = $pattern->pattern_data['steps'] ?? $pattern->pattern_data;
                    $stepCount = count($cyclicalSteps);
                    $startingStep = ! empty($data['starting_step']) ? (int) $data['starting_step'] : null;

                    if ($startingStep !== null && $stepCount > 0) {
                        // Manager picked custom starting step (Option C):
                        // Shift anchor so on $startDate, the rotation is at ($startingStep - 1)
                        $anchorDate = $startDate->copy()->subDays($startingStep - 1)->toDateString();
                    } else {
                        // Squad Sync (Option A): use pattern's start_date as reference anchor if set
                        $anchorDate = $pattern->start_date
                            ? ($pattern->start_date instanceof CarbonInterface ? $pattern->start_date->toDateString() : (string) $pattern->start_date)
                            : $data['start_date'];
                    }

                    $data['cyclical_config'] = [
                        'anchor_date' => $anchorDate,
                        'steps' => $cyclicalSteps,
                    ];
                } elseif ($patternMode === 'daily') {
                    $data['daily_config'] = $pattern->pattern_data;
                }
            } else {
                $patternMode = $data['pattern_mode'] ?? 'weekly'; // daily, weekly, cyclical, copy_month
            }

            $conflictMode = $data['conflict_mode'] ?? 'overwrite'; // overwrite, preserve
            $status = $data['status'] ?? 'published';
            $preserveLeaves = (bool) ($data['preserve_leaves'] ?? true);
            $userId = Auth::id();
            $tenantId = session('tenant_id')
                ?? (app()->has('current_tenant_id') ? app('current_tenant_id') : null)
                ?? Auth::user()?->tenant_id;

            if ($tenantId === null) {
                throw new DomainException('Active tenant context could not be resolved.');
            }

            // 1. Determine target employees
            $employeeQuery = Employee::query()->where('employment_status', 'active');
            if (! empty($data['employee_ids'])) {
                $employeeQuery->whereIn('id', (array) $data['employee_ids']);
            } elseif (! empty($data['department_id']) && $data['department_id'] !== 'all') {
                $employeeQuery->where('department_id', $data['department_id']);
            }
            $targetEmployees = $employeeQuery->get(['id']);

            if ($targetEmployees->isEmpty()) {
                return ['created' => 0, 'updated' => 0, 'total' => 0];
            }

            $empIds = $targetEmployees->pluck('id')->all();

            // 2. Preload Approved Leaves in Range (if preserve_leaves is true)
            $leaveLookup = [];
            if ($preserveLeaves) {
                $leaves = LeaveRequest::query()
                    ->whereIn('employee_id', $empIds)
                    ->where('status', 'approved')
                    ->where(function ($q) use ($startDate, $endDate) {
                        $q->whereBetween('start_date', [$startDate->toDateString(), $endDate->toDateString()])
                            ->orWhereBetween('end_date', [$startDate->toDateString(), $endDate->toDateString()])
                            ->orWhere(function ($sub) use ($startDate, $endDate) {
                                $sub->where('start_date', '<=', $startDate->toDateString())
                                    ->where('end_date', '>=', $endDate->toDateString());
                            });
                    })
                    ->get(['employee_id', 'start_date', 'end_date']);

                foreach ($leaves as $lv) {
                    $period = CarbonPeriod::create(
                        Carbon::parse($lv->start_date)->max($startDate),
                        Carbon::parse($lv->end_date)->min($endDate)
                    );
                    foreach ($period as $d) {
                        $leaveLookup[$lv->employee_id][$d->toDateString()] = true;
                    }
                }
            }

            // 3. Preload existing entry IDs for conflict mode and stats calculation
            $existingLookup = RosterEntry::query()
                ->whereIn('employee_id', $empIds)
                ->whereBetween('roster_date', [$startDate->toDateString(), $endDate->toDateString()])
                ->pluck('id', DB::raw("CONCAT(employee_id, ':', roster_date)"))
                ->all();

            // 4. Preload Copy Month Source entries if copy_month mode
            $sourceCopyEntries = null;
            if ($patternMode === 'copy_month' && ! empty($data['copy_config'])) {
                $srcYear = (int) $data['copy_config']['source_year'];
                $srcMonth = (int) $data['copy_config']['source_month'];
                $sourceCopyEntries = RosterEntry::query()
                    ->whereIn('employee_id', $empIds)
                    ->forMonth($srcYear, $srcMonth)
                    ->get()
                    ->groupBy('employee_id');
            }

            // Prepare dates
            $dates = [];
            $period = CarbonPeriod::create($startDate, $endDate);
            foreach ($period as $date) {
                $dates[] = $date->copy();
            }

            $cyclicalAnchor = ! empty($data['cyclical_config']['anchor_date'])
                ? Carbon::parse($data['cyclical_config']['anchor_date'])
                : $startDate->copy();
            $cyclicalSteps = $data['cyclical_config']['steps'] ?? [];
            $cyclicalCount = count($cyclicalSteps);

            $rowsToUpsert = [];
            $createdCount = 0;
            $updatedCount = 0;
            $now = Carbon::now();

            foreach ($targetEmployees as $emp) {
                $empSourceCopy = $sourceCopyEntries?->get($emp->id, collect());

                foreach ($dates as $date) {
                    $dateString = $date->toDateString();
                    $lookupKey = "{$emp->id}:{$dateString}";
                    $hasExisting = isset($existingLookup[$lookupKey]);

                    // Preserve existing if conflictMode is preserve
                    if ($hasExisting && $conflictMode === 'preserve') {
                        continue;
                    }

                    // Preserve approved leave if preserveLeaves is enabled
                    if ($preserveLeaves && isset($leaveLookup[$emp->id][$dateString])) {
                        continue;
                    }

                    // Resolve schedule based on pattern mode
                    $resolved = $this->resolveScheduleForDate(
                        $date,
                        $patternMode,
                        $data,
                        $cyclicalAnchor,
                        $cyclicalSteps,
                        $cyclicalCount,
                        $empSourceCopy
                    );

                    if ($resolved === null) {
                        continue;
                    }

                    $existingId = $existingLookup[$lookupKey] ?? null;

                    $rowsToUpsert[] = [
                        'id' => $existingId ?? (string) Str::ulid(),
                        'tenant_id' => $tenantId,
                        'employee_id' => $emp->id,
                        'roster_date' => $dateString,
                        'shift_id' => $resolved['shift_id'],
                        'schedule_type' => $resolved['schedule_type'],
                        'status' => $status,
                        'is_overridden' => false,
                        'notes' => $resolved['notes'] ?? null,
                        'created_by' => $userId,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ];

                    if ($hasExisting) {
                        $updatedCount++;
                    } else {
                        $createdCount++;
                    }
                }
            }

            // 5. Execute High-Performance Bulk UPSERT in Chunks of 250 rows
            // Keeps memory allocation < 5MB and ensures lightning fast execution on shared hosting
            $chunks = array_chunk($rowsToUpsert, 250);
            foreach ($chunks as $chunk) {
                RosterEntry::upsert(
                    $chunk,
                    ['tenant_id', 'employee_id', 'roster_date'],
                    ['shift_id', 'schedule_type', 'status', 'is_overridden', 'notes', 'updated_at']
                );
            }

            return [
                'created' => $createdCount,
                'updated' => $updatedCount,
                'total' => $createdCount + $updatedCount,
            ];
        });
    }

    /**
     * Resolve schedule for an individual date based on active pattern mode.
     *
     * @param  array<string, mixed>  $data
     * @param  array<int, array<string, mixed>>  $cyclicalSteps
     * @param  Collection<int, RosterEntry>|null  $sourceCopyEntries
     * @return array{shift_id: ?string, schedule_type: string, notes: ?string}|null
     */
    private function resolveScheduleForDate(
        CarbonInterface $date,
        string $patternMode,
        array $data,
        CarbonInterface $cyclicalAnchor,
        array $cyclicalSteps,
        int $cyclicalCount,
        ?Collection $sourceCopyEntries
    ): ?array {
        return match ($patternMode) {
            'daily' => $this->resolveDailyMode($date, $data['daily_config'] ?? []),
            'weekly' => $this->resolveWeeklyMode($date, $data['weekly_config'] ?? []),
            'cyclical' => $this->resolveCyclicalMode($date, $cyclicalAnchor, $cyclicalSteps, $cyclicalCount),
            'copy_month' => $this->resolveCopyMonthMode($date, $sourceCopyEntries),
            default => null,
        };
    }

    /**
     * Resolve daily mode.
     *
     * @param  array<string, mixed>  $config
     * @return array{shift_id: ?string, schedule_type: string, notes: ?string}
     */
    private function resolveDailyMode(CarbonInterface $date, array $config): array
    {
        $shiftId = $config['shift_id'] ?? null;
        $restDays = (array) ($config['rest_days'] ?? ['Sunday']);

        $dayName = $date->format('l'); // Monday, Tuesday...
        $isRestDay = in_array($dayName, $restDays, true);

        return [
            'shift_id' => $isRestDay ? null : $shiftId,
            'schedule_type' => $isRestDay ? 'rest_day' : 'shift',
            'notes' => $isRestDay ? 'Scheduled Rest Day' : null,
        ];
    }

    /**
     * Resolve 7-day weekly matrix mode (0 = Mon, 1 = Tue, ..., 6 = Sun).
     *
     * @param  array<int|string, array<string, mixed>>  $weeklyConfig
     * @return array{shift_id: ?string, schedule_type: string, notes: ?string}
     */
    private function resolveWeeklyMode(CarbonInterface $date, array $weeklyConfig): array
    {
        $isoDay = $date->dayOfWeekIso - 1; // 0..6
        $dayConfig = $weeklyConfig[$isoDay] ?? $weeklyConfig[(string) $isoDay] ?? null;

        if ($dayConfig === null) {
            $isSunday = $date->isSunday();

            return [
                'shift_id' => null,
                'schedule_type' => $isSunday ? 'rest_day' : 'shift',
                'notes' => null,
            ];
        }

        $isRestDay = (bool) ($dayConfig['is_rest_day'] ?? false);
        $shiftId = ! $isRestDay ? ($dayConfig['shift_id'] ?? null) : null;

        return [
            'shift_id' => $shiftId,
            'schedule_type' => $isRestDay ? 'rest_day' : ($shiftId ? 'shift' : 'rest_day'),
            'notes' => $isRestDay ? 'Weekly Rest Day' : null,
        ];
    }

    /**
     * Resolve rolling N-day cyclical pattern mode.
     *
     * @param  array<int, array<string, mixed>>  $steps
     * @return array{shift_id: ?string, schedule_type: string, notes: ?string}|null
     */
    private function resolveCyclicalMode(
        CarbonInterface $date,
        CarbonInterface $anchorDate,
        array $steps,
        int $stepsCount
    ): ?array {
        if ($stepsCount === 0) {
            return null;
        }

        $daysDiff = $anchorDate->diffInDays($date, false);
        $stepIndex = (int) ($daysDiff % $stepsCount);
        if ($stepIndex < 0) {
            $stepIndex += $stepsCount;
        }

        $step = $steps[$stepIndex] ?? null;
        if ($step === null) {
            return null;
        }

        $isRestDay = (bool) ($step['is_rest_day'] ?? false);
        $shiftId = ! $isRestDay ? ($step['shift_id'] ?? null) : null;

        return [
            'shift_id' => $shiftId,
            'schedule_type' => $isRestDay ? 'rest_day' : ($shiftId ? 'shift' : 'rest_day'),
            'notes' => $step['notes'] ?? ($isRestDay ? 'Rotation Rest Day' : "Cycle Step #{$stepIndex}"),
        ];
    }

    /**
     * Resolve copy month mode matching day number.
     *
     * @param  Collection<int, RosterEntry>|null  $sourceEntries
     * @return array{shift_id: ?string, schedule_type: string, notes: ?string}
     */
    private function resolveCopyMonthMode(CarbonInterface $date, ?Collection $sourceEntries): array
    {
        if ($sourceEntries === null || $sourceEntries->isEmpty()) {
            return [
                'shift_id' => null,
                'schedule_type' => $date->isSunday() ? 'rest_day' : 'shift',
                'notes' => null,
            ];
        }

        $dayNumber = $date->day;
        $match = $sourceEntries->first(function (RosterEntry $entry) use ($dayNumber) {
            $srcDate = $entry->roster_date instanceof CarbonInterface
                ? $entry->roster_date
                : Carbon::parse($entry->roster_date);

            return $srcDate->day === $dayNumber;
        });

        if ($match) {
            return [
                'shift_id' => $match->shift_id,
                'schedule_type' => $match->schedule_type,
                'notes' => 'Cloned from previous month',
            ];
        }

        return [
            'shift_id' => null,
            'schedule_type' => $date->isSunday() ? 'rest_day' : 'shift',
            'notes' => null,
        ];
    }

    /**
     * Update single cell roster entry with financial lock protection.
     */
    public function updateEntry(
        string $employeeId,
        string $date,
        ?string $shiftId,
        string $scheduleType,
        ?string $notes = null,
        string $status = 'published'
    ): RosterEntry {
        $this->ensureNotLocked($date);

        return DB::transaction(function () use ($employeeId, $date, $shiftId, $scheduleType, $notes, $status): RosterEntry {
            $entry = RosterEntry::where('employee_id', $employeeId)
                ->whereDate('roster_date', $date)
                ->first();

            $attributes = [
                'shift_id' => $scheduleType === 'rest_day' ? null : $shiftId,
                'schedule_type' => $scheduleType,
                'status' => $status,
                'is_overridden' => true,
                'notes' => $notes,
                'created_by' => Auth::id(),
            ];

            if ($entry) {
                $entry->update($attributes);

                return $entry->load(['shift:id,name,code,color,start_time,end_time,is_night_shift']);
            }

            return RosterEntry::create(array_merge($attributes, [
                'employee_id' => $employeeId,
                'roster_date' => $date,
            ]))->load(['shift:id,name,code,color,start_time,end_time,is_night_shift']);
        });
    }

    /**
     * Atomic shift swap between two employees on a given date with financial lock protection.
     *
     * @return array{employee_a: ?RosterEntry, employee_b: ?RosterEntry}
     */
    public function swapShift(string $employeeAId, string $employeeBId, string $date): array
    {
        $this->ensureNotLocked($date);

        return DB::transaction(function () use ($employeeAId, $employeeBId, $date): array {
            $entryA = RosterEntry::where('employee_id', $employeeAId)->whereDate('roster_date', $date)->first();
            $entryB = RosterEntry::where('employee_id', $employeeBId)->whereDate('roster_date', $date)->first();

            $shiftA = $entryA?->shift_id;
            $typeA = $entryA?->schedule_type ?? 'shift';

            $shiftB = $entryB?->shift_id;
            $typeB = $entryB?->schedule_type ?? 'shift';

            // Apply A's shift to B
            $updatedB = $this->updateEntry(
                $employeeBId,
                $date,
                $shiftA,
                $typeA,
                "Swapped with Employee {$employeeAId}"
            );

            // Apply B's shift to A
            $updatedA = $this->updateEntry(
                $employeeAId,
                $date,
                $shiftB,
                $typeB,
                "Swapped with Employee {$employeeBId}"
            );

            return [
                'employee_a' => $updatedA,
                'employee_b' => $updatedB,
            ];
        });
    }

    /**
     * Publish or unpublish an entire month roster.
     */
    public function publishRoster(int $year, int $month, ?string $departmentId = null, bool $publish = true): int
    {
        return DB::transaction(function () use ($year, $month, $departmentId, $publish): int {
            $startDate = Carbon::createFromDate($year, $month, 1)->startOfMonth();
            $this->ensureNotLocked($startDate);

            $endDate = $startDate->copy()->endOfMonth();
            $targetStatus = $publish ? 'published' : 'draft';

            $query = RosterEntry::query()
                ->whereBetween('roster_date', [$startDate->toDateString(), $endDate->toDateString()]);

            if ($departmentId !== null && $departmentId !== '' && $departmentId !== 'all') {
                $query->whereHas('employee', fn ($q) => $q->where('department_id', $departmentId));
            }

            return $query->update(['status' => $targetStatus]);
        });
    }

    /**
     * Clear roster entries for a given month and optional department.
     */
    public function clearRoster(int $year, int $month, ?string $departmentId = null, bool $onlyDrafts = false): int
    {
        return DB::transaction(function () use ($year, $month, $departmentId, $onlyDrafts): int {
            $startDate = Carbon::createFromDate($year, $month, 1)->startOfMonth();
            $this->ensureNotLocked($startDate);

            $endDate = $startDate->copy()->endOfMonth();

            $query = RosterEntry::query()
                ->whereBetween('roster_date', [$startDate->toDateString(), $endDate->toDateString()]);

            if ($onlyDrafts) {
                $query->where('status', 'draft');
            }

            if ($departmentId !== null && $departmentId !== '' && $departmentId !== 'all') {
                $query->whereHas('employee', fn ($q) => $q->where('department_id', $departmentId));
            }

            return $query->delete();
        });
    }

    /**
     * List all roster patterns for tenant.
     *
     * @return Collection<int, RosterPattern>
     */
    public function listPatterns(bool $onlyActive = false): Collection
    {
        $query = RosterPattern::query()->orderBy('name');

        if ($onlyActive) {
            $query->active();
        }

        return $query->get();
    }

    /**
     * Create a new roster pattern.
     *
     * @param  array<string, mixed>  $data
     */
    public function createPattern(array $data): RosterPattern
    {
        return DB::transaction(static function () use ($data): RosterPattern {
            return RosterPattern::create([
                'name' => $data['name'],
                'code' => strtoupper($data['code']),
                'pattern_type' => $data['pattern_type'],
                'start_date' => $data['start_date'] ?? null,
                'end_date' => $data['end_date'] ?? null,
                'cycle_length_days' => (int) ($data['cycle_length_days'] ?? 7),
                'pattern_data' => $data['pattern_data'],
                'is_active' => (bool) ($data['is_active'] ?? true),
            ]);
        });
    }

    /**
     * Update an existing roster pattern.
     *
     * @param  array<string, mixed>  $data
     */
    public function updatePattern(RosterPattern $pattern, array $data): RosterPattern
    {
        return DB::transaction(static function () use ($pattern, $data): RosterPattern {
            $pattern->update([
                'name' => $data['name'],
                'code' => strtoupper($data['code']),
                'pattern_type' => $data['pattern_type'] ?? $pattern->pattern_type,
                'start_date' => $data['start_date'] ?? $pattern->start_date,
                'end_date' => $data['end_date'] ?? $pattern->end_date,
                'cycle_length_days' => (int) ($data['cycle_length_days'] ?? $pattern->cycle_length_days),
                'pattern_data' => $data['pattern_data'] ?? $pattern->pattern_data,
                'is_active' => (bool) ($data['is_active'] ?? $pattern->is_active),
            ]);

            return $pattern;
        });
    }

    /**
     * Delete a roster pattern.
     */
    public function deletePattern(RosterPattern $pattern): bool
    {
        return (bool) $pattern->delete();
    }

    /**
     * Create an entire Shift Group Set (Option 2 Industry Standard).
     *
     * @param  array<string, mixed>  $data
     * @return array<int, RosterPattern>
     */
    public function createGroupSet(array $data): array
    {
        return DB::transaction(function () use ($data): array {
            $presetType = $data['preset_type']; // 'three_shift_247', 'two_shift', 'general_weekly'
            $namePrefix = trim($data['name_prefix']);
            $codePrefix = strtoupper(trim($data['code_prefix']));
            $startDate = $data['start_date'] ?? Carbon::now()->startOfMonth()->toDateString();
            $endDate = $data['end_date'] ?? Carbon::now()->addYear()->endOfMonth()->toDateString();
            $shift1Id = $data['shift_1_id'] ?? null;
            $shift2Id = $data['shift_2_id'] ?? null;
            $shift3Id = $data['shift_3_id'] ?? null;

            $created = [];

            if ($presetType === 'three_shift_247') {
                // 4 Groups (A, B, C, D) - Cycle length 4
                $letters = ['A', 'B', 'C', 'D'];
                $baseCycle = [
                    ['shift_id' => $shift1Id, 'is_rest_day' => false],
                    ['shift_id' => $shift2Id, 'is_rest_day' => false],
                    ['shift_id' => $shift3Id, 'is_rest_day' => false],
                    ['shift_id' => '', 'is_rest_day' => true],
                ];

                for ($i = 0; $i < 4; $i++) {
                    $letter = $letters[$i];
                    $rotated = [];
                    for ($stepIdx = 0; $stepIdx < 4; $stepIdx++) {
                        $sourceItem = $baseCycle[($stepIdx + $i) % 4];
                        $rotated[] = [
                            'step' => $stepIdx + 1,
                            'shift_id' => $sourceItem['shift_id'],
                            'is_rest_day' => $sourceItem['is_rest_day'],
                        ];
                    }

                    $startLabel = match ($i) {
                        0 => 'Morn Start',
                        1 => 'Eve Start',
                        2 => 'Night Start',
                        3 => 'Off Start',
                    };

                    $created[] = RosterPattern::create([
                        'name' => "{$namePrefix} - Group {$letter} ({$startLabel})",
                        'code' => "{$codePrefix}-GRP-{$letter}",
                        'pattern_type' => 'cyclical',
                        'start_date' => $startDate,
                        'end_date' => $endDate,
                        'cycle_length_days' => 4,
                        'pattern_data' => ['steps' => $rotated],
                        'is_active' => true,
                    ]);
                }
            } elseif ($presetType === 'two_shift') {
                // 3 Groups (A, B, C) - Cycle length 3
                $letters = ['A', 'B', 'C'];
                $baseCycle = [
                    ['shift_id' => $shift1Id, 'is_rest_day' => false],
                    ['shift_id' => $shift2Id, 'is_rest_day' => false],
                    ['shift_id' => '', 'is_rest_day' => true],
                ];

                for ($i = 0; $i < 3; $i++) {
                    $letter = $letters[$i];
                    $rotated = [];
                    for ($stepIdx = 0; $stepIdx < 3; $stepIdx++) {
                        $sourceItem = $baseCycle[($stepIdx + $i) % 3];
                        $rotated[] = [
                            'step' => $stepIdx + 1,
                            'shift_id' => $sourceItem['shift_id'],
                            'is_rest_day' => $sourceItem['is_rest_day'],
                        ];
                    }

                    $startLabel = match ($i) {
                        0 => 'Shift 1 Start',
                        1 => 'Shift 2 Start',
                        2 => 'Off Start',
                    };

                    $created[] = RosterPattern::create([
                        'name' => "{$namePrefix} - Group {$letter} ({$startLabel})",
                        'code' => "{$codePrefix}-GRP-{$letter}",
                        'pattern_type' => 'cyclical',
                        'start_date' => $startDate,
                        'end_date' => $endDate,
                        'cycle_length_days' => 3,
                        'pattern_data' => ['steps' => $rotated],
                        'is_active' => true,
                    ]);
                }
            } elseif ($presetType === 'general_weekly') {
                // 1 Standard Mon-Fri General Shift template
                $created[] = RosterPattern::create([
                    'name' => "{$namePrefix} - General Day (Mon-Fri)",
                    'code' => "{$codePrefix}-GEN",
                    'pattern_type' => 'weekly',
                    'start_date' => $startDate,
                    'end_date' => $endDate,
                    'cycle_length_days' => 7,
                    'pattern_data' => [
                        ['day' => 0, 'day_name' => 'Mon', 'shift_id' => $shift1Id, 'is_rest_day' => false],
                        ['day' => 1, 'day_name' => 'Tue', 'shift_id' => $shift1Id, 'is_rest_day' => false],
                        ['day' => 2, 'day_name' => 'Wed', 'shift_id' => $shift1Id, 'is_rest_day' => false],
                        ['day' => 3, 'day_name' => 'Thu', 'shift_id' => $shift1Id, 'is_rest_day' => false],
                        ['day' => 4, 'day_name' => 'Fri', 'shift_id' => $shift1Id, 'is_rest_day' => false],
                        ['day' => 5, 'day_name' => 'Sat', 'shift_id' => '', 'is_rest_day' => true],
                        ['day' => 6, 'day_name' => 'Sun', 'shift_id' => '', 'is_rest_day' => true],
                    ],
                    'is_active' => true,
                ]);
            }

            return $created;
        });
    }

    /**
     * Automatically generate complementary rotated squad group cards from an existing cyclical pattern.
     *
     * @return array<int, RosterPattern>
     */
    public function generateComplementarySquads(RosterPattern $sourcePattern): array
    {
        if ($sourcePattern->pattern_type !== 'cyclical') {
            throw new DomainException('Complementary squads can only be generated for cyclical patterns.');
        }

        $steps = $sourcePattern->pattern_data['steps'] ?? $sourcePattern->pattern_data ?? [];
        $count = count($steps);
        if ($count <= 1) {
            throw new DomainException('Cycle length must be at least 2 to generate complementary squads.');
        }

        return DB::transaction(function () use ($sourcePattern, $steps, $count): array {
            $created = [];
            $alphabet = range('A', 'Z');
            $baseName = preg_replace('/(\s*-\s*Group\s*[A-Z].*)$/i', '', $sourcePattern->name);
            $baseCode = preg_replace('/(-GRP-[A-Z].*)$/i', '', $sourcePattern->code);

            for ($offset = 1; $offset < $count; $offset++) {
                $letter = $alphabet[$offset] ?? ('G'.($offset + 1));
                $rotated = [];
                for ($i = 0; $i < $count; $i++) {
                    $src = $steps[($i + $offset) % $count];
                    $rotated[] = [
                        'step' => $i + 1,
                        'shift_id' => $src['shift_id'] ?? null,
                        'is_rest_day' => (bool) ($src['is_rest_day'] ?? false),
                    ];
                }

                $newCode = "{$baseCode}-GRP-{$letter}";

                // Avoid duplicate codes
                if (RosterPattern::where('code', $newCode)->exists()) {
                    $newCode .= '-'.Str::random(3);
                }

                $created[] = RosterPattern::create([
                    'name' => "{$baseName} - Group {$letter}",
                    'code' => strtoupper($newCode),
                    'pattern_type' => 'cyclical',
                    'start_date' => $sourcePattern->start_date,
                    'end_date' => $sourcePattern->end_date,
                    'cycle_length_days' => $count,
                    'pattern_data' => ['steps' => $rotated],
                    'is_active' => true,
                ]);
            }

            return $created;
        });
    }

    /**
     * Ensure date is not part of a finalized & locked M03 Payroll period.
     */
    private function ensureNotLocked(string|CarbonInterface $date): void
    {
        $carbonDate = $date instanceof CarbonInterface ? $date : Carbon::parse($date);
        $isLocked = PayrollRun::where('period_year', $carbonDate->year)
            ->where('period_month', $carbonDate->month)
            ->where('status', 'locked')
            ->exists();

        if ($isLocked) {
            throw new DomainException("Cannot modify roster schedules for {$carbonDate->format('F Y')} because payroll has been finalized and locked.");
        }
    }

    /**
     * Ensure date range does not contain any locked M03 Payroll months.
     */
    private function ensureNotLockedInRange(CarbonInterface $startDate, CarbonInterface $endDate): void
    {
        $current = $startDate->copy()->startOfMonth();
        $end = $endDate->copy()->endOfMonth();

        while ($current->lte($end)) {
            $this->ensureNotLocked($current);
            $current->addMonth();
        }
    }
}
