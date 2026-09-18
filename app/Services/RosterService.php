<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\Department;
use App\Models\Employee;
use App\Models\LeaveRequest;
use App\Models\PublicHoliday;
use App\Models\RosterEntry;
use App\Models\RosterPattern;
use App\Models\Shift;
use Carbon\Carbon;
use Carbon\CarbonInterface;
use Carbon\CarbonPeriod;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

final class RosterService
{
    public function __construct(
        private readonly ShiftService $shiftService,
    ) {}

    /**
     * Retrieve complete month roster matrix and metadata for the planner UI.
     *
     * @return array<string, mixed>
     */
    public function getMonthMatrix(int $year, int $month, ?string $departmentId = null): array
    {
        $startDate = Carbon::createFromDate($year, $month, 1)->startOfMonth();
        $endDate = $startDate->copy()->endOfMonth();
        $daysInMonth = $startDate->daysInMonth;

        // 1. Generate Days list for headers
        $days = [];
        $holidays = PublicHoliday::whereBetween('holiday_date', [$startDate->toDateString(), $endDate->toDateString()])
            ->get()
            ->keyBy(fn (PublicHoliday $h) => $h->holiday_date->toDateString());

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

        // 3. Query Roster Entries for this month
        $entries = RosterEntry::query()
            ->whereIn('employee_id', $employeeIds)
            ->whereBetween('roster_date', [$startDate->toDateString(), $endDate->toDateString()])
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

            for ($d = 1; $d <= $daysInMonth; $d++) {
                $dateString = Carbon::createFromDate($year, $month, $d)->toDateString();
                $entry = $empEntries->get($dateString);
                $leave = $leaveMap[$emp->id][$dateString] ?? null;

                if ($entry !== null) {
                    if ($entry->schedule_type === 'shift' && $entry->shift !== null) {
                        $scheduledWorkDays++;
                        $totalScheduledShifts++;

                        // Calculate shift length in hours
                        $start = Carbon::parse($entry->shift->start_time);
                        $end = Carbon::parse($entry->shift->end_time);
                        if ($end->lt($start)) {
                            $end->addDay();
                        }
                        $diffMinutes = $start->diffInMinutes($end);
                        $netHours = max(0, ($diffMinutes - ($entry->shift->break_minutes ?? 0)) / 60);
                        $totalHours += $netHours;
                    } elseif ($entry->schedule_type === 'rest_day' || $entry->schedule_type === 'off') {
                        $scheduledRestDays++;
                        $totalRestDays++;
                    }

                    if ($entry->status === 'draft') {
                        $totalDraftEntries++;
                    } else {
                        $totalPublishedEntries++;
                    }
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
     * Bulk generate roster entries across a date range using one of the pattern modes.
     *
     * @param  array<string, mixed>  $data
     * @return array{created: int, updated: int, total: int}
     */
    public function generateRoster(array $data): array
    {
        return DB::transaction(function () use ($data): array {
            $startDate = Carbon::parse($data['start_date'])->startOfDay();
            $endDate = Carbon::parse($data['end_date'])->endOfDay();
            $patternMode = $data['pattern_mode'] ?? 'weekly'; // daily, weekly, cyclical, copy_month
            $conflictMode = $data['conflict_mode'] ?? 'overwrite'; // overwrite, preserve
            $status = $data['status'] ?? 'published';
            $userId = Auth::id();

            // Determine target employees
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

            // Prepare days in period
            $dates = [];
            $period = CarbonPeriod::create($startDate, $endDate);
            foreach ($period as $date) {
                $dates[] = $date->copy();
            }

            $createdCount = 0;
            $updatedCount = 0;

            // Preload existing entries in target range to optimize
            $existingEntries = RosterEntry::query()
                ->whereIn('employee_id', $targetEmployees->pluck('id'))
                ->whereBetween('roster_date', [$startDate->toDateString(), $endDate->toDateString()])
                ->get()
                ->groupBy('employee_id');

            // Copy month source entries cache if copy_month mode
            $sourceCopyEntries = null;
            if ($patternMode === 'copy_month' && ! empty($data['copy_config'])) {
                $srcYear = (int) $data['copy_config']['source_year'];
                $srcMonth = (int) $data['copy_config']['source_month'];
                $sourceCopyEntries = RosterEntry::query()
                    ->whereIn('employee_id', $targetEmployees->pluck('id'))
                    ->forMonth($srcYear, $srcMonth)
                    ->get()
                    ->groupBy('employee_id');
            }

            foreach ($targetEmployees as $emp) {
                $empExisting = $existingEntries->get($emp->id, collect())->keyBy(function (RosterEntry $e) {
                    return $e->roster_date instanceof CarbonInterface
                        ? $e->roster_date->toDateString()
                        : Carbon::parse($e->roster_date)->toDateString();
                });

                $empSourceCopy = $sourceCopyEntries?->get($emp->id, collect());

                $cycleIndex = 0;
                $cyclicalAnchor = ! empty($data['cyclical_config']['anchor_date'])
                    ? Carbon::parse($data['cyclical_config']['anchor_date'])
                    : $startDate->copy();
                $cyclicalSteps = $data['cyclical_config']['steps'] ?? [];
                $cyclicalCount = count($cyclicalSteps);

                foreach ($dates as $date) {
                    $dateString = $date->toDateString();
                    $existing = $empExisting->get($dateString);

                    if ($existing && $conflictMode === 'preserve') {
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

                    $attributes = [
                        'shift_id' => $resolved['shift_id'],
                        'schedule_type' => $resolved['schedule_type'],
                        'status' => $status,
                        'is_overridden' => false,
                        'notes' => $resolved['notes'] ?? null,
                        'created_by' => $userId,
                    ];

                    if ($existing) {
                        $existing->update($attributes);
                        $updatedCount++;
                    } else {
                        RosterEntry::create(array_merge($attributes, [
                            'employee_id' => $emp->id,
                            'roster_date' => $dateString,
                        ]));
                        $createdCount++;
                    }
                }
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
        // Carbon dayOfWeekIso: 1 (Mon) to 7 (Sun)
        $isoDay = $date->dayOfWeekIso - 1; // 0..6
        $dayConfig = $weeklyConfig[$isoDay] ?? $weeklyConfig[(string) $isoDay] ?? null;

        if ($dayConfig === null) {
            // Default Sunday to rest day if not configured
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
        // Find entry with matching day of month in source
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
     * Update single cell roster entry.
     */
    public function updateEntry(
        string $employeeId,
        string $date,
        ?string $shiftId,
        string $scheduleType,
        ?string $notes = null,
        string $status = 'published'
    ): RosterEntry {
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
     * Atomic shift swap between two employees on a given date.
     *
     * @return array{employee_a: ?RosterEntry, employee_b: ?RosterEntry}
     */
    public function swapShift(string $employeeAId, string $employeeBId, string $date): array
    {
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
        $startDate = Carbon::createFromDate($year, $month, 1)->startOfMonth();
        $endDate = $startDate->copy()->endOfMonth();
        $targetStatus = $publish ? 'published' : 'draft';

        $query = RosterEntry::query()
            ->whereBetween('roster_date', [$startDate->toDateString(), $endDate->toDateString()]);

        if ($departmentId !== null && $departmentId !== '' && $departmentId !== 'all') {
            $query->whereHas('employee', fn ($q) => $q->where('department_id', $departmentId));
        }

        return $query->update(['status' => $targetStatus]);
    }

    /**
     * Clear roster entries for a given month and optional department.
     */
    public function clearRoster(int $year, int $month, ?string $departmentId = null, bool $onlyDrafts = false): int
    {
        $startDate = Carbon::createFromDate($year, $month, 1)->startOfMonth();
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
    }
}
