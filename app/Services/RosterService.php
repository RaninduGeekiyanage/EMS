<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\Department;
use App\Models\Employee;
use App\Models\LeaveRequest;
use App\Models\PayrollRun;
use App\Models\PublicHoliday;
use App\Models\Roster;
use App\Models\RosterEntry;
use App\Models\RosterGroup;
use App\Models\RosterGroupMember;
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
    public function getMonthMatrix(int $year, int $month, ?string $departmentId = null, ?string $rosterId = null, ?string $squadId = null): array
    {
        $startDate = Carbon::createFromDate($year, $month, 1)->startOfMonth();
        $endDate = $startDate->copy()->endOfMonth();
        $daysInMonth = $startDate->daysInMonth;

        // Check if this month is finalized & locked by M03 Payroll
        $isPayrollLocked = PayrollRun::where('period_year', $year)
            ->where('period_month', $month)
            ->where('status', 'locked')
            ->exists();

        // 0. Query all active (non-archived) Rosters for the switcher
        $allRosters = Roster::query()
            ->with(['department:id,name,code', 'publisher:id,name'])
            ->withCount(['groups', 'entries'])
            ->where('status', '!=', 'archived')
            ->orderBy('start_date', 'desc')
            ->get();

        $activeRoster = null;
        if ($rosterId !== null && $rosterId !== '' && $rosterId !== 'all') {
            $activeRoster = Roster::with([
                'department:id,name,code',
                'groups.pattern:id,name,code,cycle_length_days,pattern_type',
                'groups.employees' => function ($q) {
                    $q->select('employees.id', 'emp_no', 'full_name', 'department_id')
                        ->with('department:id,name');
                },
            ])->find($rosterId);
        }

        if ($activeRoster === null) {
            $activeRoster = Roster::with([
                'department:id,name,code',
                'groups.pattern:id,name,code,cycle_length_days,pattern_type',
                'groups.employees' => function ($q) {
                    $q->select('employees.id', 'emp_no', 'full_name', 'department_id')
                        ->with('department:id,name');
                },
            ])->where('status', '!=', 'archived')->forMonth($year, $month)->first() ?? $allRosters->first();
        }

        $squads = $activeRoster ? $activeRoster->groups : collect();

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

        // 2. Query Employees and map squad membership without hiding non-squad employees
        $employees = collect();
        $employeeSquadMap = [];

        if ($activeRoster && $squads->isNotEmpty()) {
            foreach ($squads as $sq) {
                foreach ($sq->employees as $emp) {
                    $employeeSquadMap[$emp->id] = $sq;
                }
            }
        }

        // If explicitly filtering by a specific squad
        if ($squadId !== null && $squadId !== '' && $squadId !== 'all') {
            $targetSquad = $squads->firstWhere('id', $squadId);
            if ($targetSquad) {
                $employees = $targetSquad->employees;
            }
        } else {
            // Load all department (or company) active employees so no one is hidden
            $employeeQuery = Employee::query()
                ->select('id', 'emp_no', 'full_name', 'department_id')
                ->with(['department:id,name'])
                ->where('employment_status', 'active')
                ->orderBy('emp_no');

            $targetDeptId = $activeRoster?->department_id ?? $departmentId;
            if ($targetDeptId !== null && $targetDeptId !== '' && $targetDeptId !== 'all') {
                $employeeQuery->where('department_id', $targetDeptId);
            }

            $employees = $employeeQuery->get();
        }

        $employeeIds = $employees->pluck('id')->all();

        // 3. Query Roster Entries for this month (plus last day of previous month for fatigue calculation)
        $prevMonthLastDay = $startDate->copy()->subDay()->toDateString();
        $entries = RosterEntry::query()
            ->whereIn('employee_id', $employeeIds)
            ->whereBetween('roster_date', [$prevMonthLastDay, $endDate->toDateString()])
            ->with([
                'shift:id,name,code,color,start_time,end_time,is_night_shift',
                'originalShift:id,name,code,color',
                'overriddenBy:id,name',
            ])
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
                    'original_shift' => $entry?->originalShift ? [
                        'id' => $entry->originalShift->id,
                        'name' => $entry->originalShift->name,
                        'code' => $entry->originalShift->code,
                        'color' => $entry->originalShift->color,
                    ] : null,
                    'status' => $entry?->status ?? null,
                    'is_overridden' => $entry ? (bool) $entry->is_overridden : false,
                    'override_reason' => $entry?->override_reason,
                    'overridden_by' => $entry?->overriddenBy?->name,
                    'notes' => $entry?->notes,
                    'leave' => $leave,
                    'fatigue_warning' => $fatigueWarning,
                    'rest_hours' => $restHours,
                ];
            }

            $squad = $employeeSquadMap[$emp->id] ?? null;
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
                'squad' => $squad ? [
                    'id' => $squad->id,
                    'name' => $squad->name,
                    'code' => $squad->code,
                    'color' => $squad->color,
                    'pattern_name' => $squad->pattern?->name,
                ] : null,
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

        // 8. Query Available Employees for Enrollment (Exclusivity Filter)
        $availableEmployees = $this->getAvailableEmployees(
            $activeRoster?->start_date?->toDateString() ?? $startDate->toDateString(),
            $activeRoster?->end_date?->toDateString() ?? $endDate->toDateString(),
            $activeRoster?->department_id,
            $activeRoster?->id
        );

        $allActiveEmployees = Employee::query()
            ->select('id', 'emp_no', 'full_name', 'department_id', 'designation_id')
            ->with(['department:id,name,code', 'designation:id,title'])
            ->where('employment_status', 'active')
            ->orderBy('emp_no')
            ->get();

        return [
            'year' => $year,
            'month' => $month,
            'month_name' => $startDate->format('F Y'),
            'days' => $days,
            'matrix' => $matrix,
            'shifts' => $shifts,
            'patterns' => $patterns,
            'departments' => $departments,
            'all_employees' => $allActiveEmployees,
            'selected_department' => $departmentId,
            'rosters' => $allRosters,
            'active_roster' => $activeRoster,
            'squads' => $squads,
            'available_employees' => $availableEmployees,
            'coverage_summary' => $coverageSummary,
            'is_payroll_locked' => $isPayrollLocked,
            'summary' => [
                'total_employees' => count($matrix),
                'total_scheduled_shifts' => $totalScheduledShifts,
                'total_rest_days' => $totalRestDays,
                'draft_entries' => $totalDraftEntries,
                'published_entries' => $totalPublishedEntries,
                'is_published' => $activeRoster ? $activeRoster->status === 'published' : ($totalDraftEntries === 0 && $totalPublishedEntries > 0),
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

            // 3. Preload existing entry IDs and operational overrides for conflict mode & protection
            $existingLookup = RosterEntry::query()
                ->whereIn('employee_id', $empIds)
                ->whereBetween('roster_date', [$startDate->toDateString(), $endDate->toDateString()])
                ->pluck('id', DB::raw("CONCAT(employee_id, ':', roster_date)"))
                ->all();

            $existingOverrideLookup = RosterEntry::query()
                ->whereIn('employee_id', $empIds)
                ->whereBetween('roster_date', [$startDate->toDateString(), $endDate->toDateString()])
                ->where('is_overridden', true)
                ->pluck('is_overridden', DB::raw("CONCAT(employee_id, ':', roster_date)"))
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

            $rosterId = $data['roster_id'] ?? null;
            $rosterGroupId = $data['roster_group_id'] ?? null;
            $rosterPatternId = $data['pattern_id'] ?? null;

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

                    // Protect supervisor operational overrides from being wiped out by re-generation
                    if ($hasExisting && ! empty($existingOverrideLookup[$lookupKey])) {
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
                        'roster_id' => $rosterId,
                        'roster_group_id' => $rosterGroupId,
                        'roster_pattern_id' => $rosterPatternId,
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
                    ['shift_id', 'schedule_type', 'status', 'roster_id', 'roster_group_id', 'roster_pattern_id', 'notes', 'updated_at']
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
     * Update single cell roster entry with audit trail, override tracking, and financial lock protection.
     */
    public function updateEntry(
        string $employeeId,
        string $date,
        ?string $shiftId,
        string $scheduleType,
        ?string $notes = null,
        string $status = 'published',
        ?string $overrideReason = null,
        ?string $rosterId = null,
        ?string $rosterGroupId = null
    ): RosterEntry {
        $this->ensureNotLocked($date);

        return DB::transaction(function () use ($employeeId, $date, $shiftId, $scheduleType, $notes, $status, $overrideReason, $rosterId, $rosterGroupId): RosterEntry {
            $entry = RosterEntry::where('employee_id', $employeeId)
                ->whereDate('roster_date', $date)
                ->first();

            $originalShiftId = $entry ? ($entry->original_shift_id ?? $entry->shift_id) : null;
            $newShiftId = ($scheduleType === 'rest_day' || $scheduleType === 'off') ? null : $shiftId;

            $targetRosterId = $rosterId ?? $entry?->roster_id;
            $targetGroupId = $rosterGroupId ?? $entry?->roster_group_id;

            if ($targetRosterId === null) {
                $targetRosterId = Roster::where('start_date', '<=', $date)
                    ->where('end_date', '>=', $date)
                    ->where('status', '!=', 'archived')
                    ->value('id');
            }

            $attributes = [
                'roster_id' => $targetRosterId,
                'roster_group_id' => $targetGroupId,
                'shift_id' => $newShiftId,
                'schedule_type' => $scheduleType,
                'status' => $status,
                'is_overridden' => true,
                'original_shift_id' => $originalShiftId,
                'override_reason' => $overrideReason ?? ($entry ? 'Supervisor Operational Reassignment' : 'Direct Manual Allocation'),
                'overridden_by' => Auth::id(),
                'notes' => $notes,
            ];

            if ($entry) {
                $entry->update($attributes);

                return $entry->load(['shift:id,name,code,color,start_time,end_time,is_night_shift', 'originalShift:id,name,code,color', 'overriddenBy:id,name']);
            }

            return RosterEntry::create(array_merge($attributes, [
                'employee_id' => $employeeId,
                'roster_date' => $date,
                'created_by' => Auth::id(),
            ]))->load(['shift:id,name,code,color,start_time,end_time,is_night_shift', 'originalShift:id,name,code,color', 'overriddenBy:id,name']);
        });
    }

    /**
     * Schedule an extended operational shift or extra relief duty on a given date.
     */
    public function extendShift(string $employeeId, string $date, string $shiftId, ?string $notes = null): RosterEntry
    {
        return $this->updateEntry(
            $employeeId,
            $date,
            $shiftId,
            'shift',
            $notes ?? 'Extended operational duty / emergency coverage',
            'published',
            'Extra Duty / Extend'
        );
    }

    /**
     * Atomic shift swap between two employees on a given date with financial lock protection.
     *
     * @return array{employee_a: ?RosterEntry, employee_b: ?RosterEntry}
     */
    public function swapShift(string $employeeAId, string $employeeBId, string $date, ?string $reason = null): array
    {
        $this->ensureNotLocked($date);

        return DB::transaction(function () use ($employeeAId, $employeeBId, $date, $reason): array {
            $entryA = RosterEntry::where('employee_id', $employeeAId)->whereDate('roster_date', $date)->first();
            $entryB = RosterEntry::where('employee_id', $employeeBId)->whereDate('roster_date', $date)->first();

            $shiftA = $entryA?->shift_id;
            $typeA = $entryA?->schedule_type ?? 'shift';

            $shiftB = $entryB?->shift_id;
            $typeB = $entryB?->schedule_type ?? 'shift';

            $swapReason = $reason ?? 'Approved Shift Swap';

            // Apply A's shift to B
            $updatedB = $this->updateEntry(
                $employeeBId,
                $date,
                $shiftA,
                $typeA,
                "Swapped with Employee {$employeeAId}",
                'published',
                $swapReason
            );

            // Apply B's shift to A
            $updatedA = $this->updateEntry(
                $employeeAId,
                $date,
                $shiftB,
                $typeB,
                "Swapped with Employee {$employeeBId}",
                'published',
                $swapReason
            );

            return [
                'employee_a' => $updatedA,
                'employee_b' => $updatedB,
            ];
        });
    }

    /**
     * Create a new Named Roster Header.
     *
     * @param  array<string, mixed>  $data
     */
    public function createRoster(array $data): Roster
    {
        $startDate = Carbon::parse($data['start_date'])->startOfDay();
        $endDate = Carbon::parse($data['end_date'])->endOfDay();

        $this->ensureNotLockedInRange($startDate, $endDate);

        $code = ! empty($data['code'])
            ? strtoupper(trim($data['code']))
            : 'RST-' . $startDate->format('Y-m') . '-' . strtoupper(Str::random(4));

        return DB::transaction(function () use ($data, $startDate, $endDate, $code): Roster {
            $roster = Roster::create([
                'name' => trim($data['name']),
                'code' => $code,
                'department_id' => ! empty($data['department_id']) && $data['department_id'] !== 'all' ? $data['department_id'] : null,
                'start_date' => $startDate->toDateString(),
                'end_date' => $endDate->toDateString(),
                'status' => $data['status'] ?? 'draft',
                'notes' => $data['notes'] ?? null,
                'created_by' => Auth::id(),
            ]);

            $generationMode = $data['generation_mode'] ?? 'blank';
            $defaultColors = ['#3b82f6', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b', '#06b6d4', '#f97316', '#6366f1'];
            $alphabet = range('A', 'Z');

            if ($generationMode === 'auto_stagger_squads') {
                $basePatternId = $data['base_pattern_id'] ?? null;
                $basePattern = $basePatternId ? RosterPattern::find($basePatternId) : null;
                $squadCount = (int) ($data['squad_count'] ?? count($data['squads'] ?? []) ?: 4);
                $staggerDays = (int) ($data['stagger_days'] ?? 2);

                $steps = $basePattern ? ($basePattern->pattern_data['steps'] ?? $basePattern->pattern_data ?? []) : [];
                $count = count($steps);
                $baseName = $basePattern ? preg_replace('/(\s*-\s*Group\s*[A-Z].*)$/i', '', $basePattern->name) : 'Shift Squad';
                $baseCode = $basePattern ? preg_replace('/(-GRP-[A-Z].*)$/i', '', $basePattern->code) : 'SQD';

                $squadsData = ! empty($data['squads']) ? $data['squads'] : [];
                if (empty($squadsData)) {
                    for ($i = 0; $i < $squadCount; $i++) {
                        $letter = $alphabet[$i] ?? ('G' . ($i + 1));
                        $squadsData[] = [
                            'name' => "Squad {$letter}",
                            'code' => "SQD-{$letter}",
                            'color' => $defaultColors[$i % count($defaultColors)],
                            'offset_days' => ($i * $staggerDays) % max($count, 1),
                            'employee_ids' => [],
                        ];
                    }
                }

                foreach ($squadsData as $idx => $squadDef) {
                    $letter = $alphabet[$idx] ?? ('G' . ($idx + 1));
                    $squadPatternId = $squadDef['pattern_id'] ?? null;

                    if (empty($squadPatternId) && $basePattern && $count > 0) {
                        if ($idx === 0) {
                            $squadPatternId = $basePattern->id;
                        } else {
                            $offset = isset($squadDef['offset_days'])
                                ? (int) $squadDef['offset_days']
                                : (($idx * $staggerDays) % $count);

                            $rotated = [];
                            for ($i = 0; $i < $count; $i++) {
                                $src = $steps[($i + $offset) % $count];
                                $rotated[] = [
                                    'step' => $i + 1,
                                    'shift_id' => $src['shift_id'] ?? null,
                                    'is_rest_day' => (bool) ($src['is_rest_day'] ?? false),
                                ];
                            }

                            $newPatternCode = "{$baseCode}-GRP-{$letter}";
                            $squadPattern = RosterPattern::firstOrCreate(
                                ['code' => $newPatternCode],
                                [
                                    'name' => "{$baseName} - Group {$letter}",
                                    'pattern_type' => 'cyclical',
                                    'start_date' => $basePattern->start_date,
                                    'end_date' => $basePattern->end_date,
                                    'cycle_length_days' => $count,
                                    'pattern_data' => ['steps' => $rotated],
                                    'is_active' => true,
                                ]
                            );
                            $squadPatternId = $squadPattern->id;
                        }
                    }

                    $squadGroup = RosterGroup::create([
                        'roster_id' => $roster->id,
                        'roster_pattern_id' => $squadPatternId,
                        'name' => ! empty($squadDef['name']) ? trim($squadDef['name']) : "Squad {$letter}",
                        'code' => strtoupper(trim($squadDef['code'] ?? "SQD-{$letter}")),
                        'color' => $squadDef['color'] ?? $defaultColors[$idx % count($defaultColors)],
                    ]);

                    if (! empty($squadDef['employee_ids'])) {
                        $this->enrollEmployees($squadGroup, (array) $squadDef['employee_ids']);
                    }
                }
            } elseif ($generationMode === 'multi_pattern' && ! empty($data['squads'])) {
                foreach ($data['squads'] as $idx => $squadDef) {
                    $letter = $alphabet[$idx] ?? ('G' . ($idx + 1));
                    $squadGroup = RosterGroup::create([
                        'roster_id' => $roster->id,
                        'roster_pattern_id' => ! empty($squadDef['pattern_id']) ? $squadDef['pattern_id'] : null,
                        'name' => ! empty($squadDef['name']) ? trim($squadDef['name']) : "Squad {$letter}",
                        'code' => strtoupper(trim($squadDef['code'] ?? "SQD-{$letter}")),
                        'color' => $squadDef['color'] ?? $defaultColors[$idx % count($defaultColors)],
                    ]);

                    if (! empty($squadDef['employee_ids'])) {
                        $this->enrollEmployees($squadGroup, (array) $squadDef['employee_ids']);
                    }
                }
            } elseif ($generationMode === 'direct_pattern' && ! empty($data['pattern_id'])) {
                $empIds = $data['employee_ids'] ?? [];
                if (empty($empIds) && ! empty($data['department_id']) && $data['department_id'] !== 'all') {
                    $empIds = Employee::where('department_id', $data['department_id'])
                        ->where('employment_status', 'active')
                        ->pluck('id')
                        ->all();
                }

                if (! empty($empIds)) {
                    $this->generateRoster([
                        'pattern_id' => $data['pattern_id'],
                        'start_date' => $startDate->toDateString(),
                        'end_date' => $endDate->toDateString(),
                        'employee_ids' => $empIds,
                        'conflict_mode' => 'overwrite',
                        'status' => $roster->status === 'published' ? 'published' : 'draft',
                        'preserve_leaves' => true,
                        'roster_id' => $roster->id,
                    ]);
                }
            }

            return $roster;
        });
    }

    /**
     * Update an existing Named Roster.
     *
     * @param  array<string, mixed>  $data
     */
    public function updateRoster(Roster $roster, array $data): Roster
    {
        if ($roster->status === 'locked') {
            throw new DomainException("Roster '{$roster->name}' is locked and cannot be modified.");
        }

        $startDate = isset($data['start_date']) ? Carbon::parse($data['start_date'])->startOfDay() : $roster->start_date;
        $endDate = isset($data['end_date']) ? Carbon::parse($data['end_date'])->endOfDay() : $roster->end_date;

        $this->ensureNotLockedInRange($startDate, $endDate);

        $roster->update([
            'name' => isset($data['name']) ? trim($data['name']) : $roster->name,
            'code' => isset($data['code']) ? strtoupper(trim($data['code'])) : $roster->code,
            'department_id' => array_key_exists('department_id', $data)
                ? (! empty($data['department_id']) && $data['department_id'] !== 'all' ? $data['department_id'] : null)
                : $roster->department_id,
            'start_date' => $startDate instanceof CarbonInterface ? $startDate->toDateString() : (string) $startDate,
            'end_date' => $endDate instanceof CarbonInterface ? $endDate->toDateString() : (string) $endDate,
            'notes' => array_key_exists('notes', $data) ? $data['notes'] : $roster->notes,
            'updated_by' => Auth::id(),
        ]);

        return $roster->fresh(['department', 'groups.pattern']);
    }

    /**
     * Delete a Named Roster and its associated draft entries.
     * Guarded: Rosters that have been published at least once cannot be deleted to protect historical attendance.
     */
    public function deleteRoster(Roster $roster): bool
    {
        if ($roster->status === 'locked') {
            throw new DomainException("Roster '{$roster->name}' is locked and cannot be deleted.");
        }

        if ($roster->published_at !== null) {
            throw new DomainException("Roster '{$roster->name}' has previously been published and cannot be deleted. Published rosters must be archived to protect historical attendance records and biometric integrity.");
        }

        $this->ensureNotLockedInRange($roster->start_date, $roster->end_date);

        return DB::transaction(function () use ($roster): bool {
            // Delete associated entries
            RosterEntry::where('roster_id', $roster->id)->delete();

            return (bool) $roster->delete();
        });
    }

    /**
     * Archive an official roster to withdraw from active planning while preserving historical biometric audit trails.
     */
    public function archiveRoster(Roster $roster): void
    {
        if ($roster->status === 'locked') {
            throw new DomainException("Roster '{$roster->name}' is locked and cannot be archived.");
        }

        $this->ensureNotLockedInRange($roster->start_date, $roster->end_date);

        DB::transaction(function () use ($roster): void {
            $roster->update([
                'status' => 'archived',
                'updated_by' => Auth::id(),
            ]);
        });
    }

    /**
     * Publish or unpublish a Named Roster.
     * When reverted to draft, published_at is intentionally preserved so the roster cannot be deleted.
     */
    public function publishNamedRoster(Roster $roster, bool $publish = true): void
    {
        if ($roster->status === 'locked') {
            throw new DomainException("Roster '{$roster->name}' is locked and cannot be modified.");
        }

        $this->ensureNotLockedInRange($roster->start_date, $roster->end_date);

        DB::transaction(function () use ($roster, $publish): void {
            $newStatus = $publish ? 'published' : 'draft';

            $roster->update([
                'status' => $newStatus,
                'published_at' => $publish ? ($roster->published_at ?? now()) : $roster->published_at,
                'published_by' => $publish ? ($roster->published_by ?? Auth::id()) : $roster->published_by,
                'updated_by' => Auth::id(),
            ]);

            RosterEntry::where('roster_id', $roster->id)->update([
                'status' => $newStatus,
                'updated_at' => now(),
            ]);
        });
    }

    /**
     * Clone an entire Roster, its Squads, and its Member Enrollments to a new target date range.
     *
     * @param  array<string, mixed>  $data
     */
    public function cloneRoster(Roster $sourceRoster, array $data): Roster
    {
        $startDate = Carbon::parse($data['start_date'])->startOfDay();
        $endDate = Carbon::parse($data['end_date'])->endOfDay();

        $this->ensureNotLockedInRange($startDate, $endDate);

        return DB::transaction(function () use ($sourceRoster, $data, $startDate, $endDate): Roster {
            $newRoster = Roster::create([
                'name' => trim($data['name']),
                'code' => ! empty($data['code'])
                    ? strtoupper(trim($data['code']))
                    : 'RST-' . $startDate->format('Y-m') . '-' . strtoupper(Str::random(4)),
                'department_id' => $sourceRoster->department_id,
                'start_date' => $startDate->toDateString(),
                'end_date' => $endDate->toDateString(),
                'status' => 'draft',
                'notes' => "Cloned from {$sourceRoster->name}",
                'created_by' => Auth::id(),
            ]);

            // Clone Squads and Memberships
            $sourceGroups = $sourceRoster->groups()->with('memberEnrollments')->get();

            foreach ($sourceGroups as $srcGroup) {
                $newGroup = RosterGroup::create([
                    'roster_id' => $newRoster->id,
                    'roster_pattern_id' => $srcGroup->roster_pattern_id,
                    'name' => $srcGroup->name,
                    'code' => $srcGroup->code,
                    'color' => $srcGroup->color,
                    'description' => $srcGroup->description,
                ]);

                foreach ($srcGroup->memberEnrollments as $member) {
                    RosterGroupMember::create([
                        'roster_group_id' => $newGroup->id,
                        'employee_id' => $member->employee_id,
                        'start_date' => $startDate->toDateString(),
                        'end_date' => $endDate->toDateString(),
                    ]);
                }
            }

            // Sync entries for newly created roster
            $this->syncRosterDates($newRoster);

            return $newRoster->fresh(['groups.pattern', 'department']);
        });
    }

    /**
     * Create a new Shift Squad under a Roster.
     *
     * @param  array<string, mixed>  $data
     */
    public function createSquad(Roster $roster, array $data): RosterGroup
    {
        if ($roster->status === 'locked') {
            throw new DomainException("Roster '{$roster->name}' is locked and cannot be modified.");
        }

        return DB::transaction(function () use ($roster, $data): RosterGroup {
            $code = strtoupper(trim($data['code'] ?? 'SQD-' . strtoupper(Str::random(4))));

            $squad = RosterGroup::create([
                'roster_id' => $roster->id,
                'roster_pattern_id' => ! empty($data['roster_pattern_id']) ? $data['roster_pattern_id'] : null,
                'name' => trim($data['name']),
                'code' => $code,
                'color' => $data['color'] ?? '#3b82f6',
                'description' => $data['description'] ?? null,
            ]);

            if (! empty($data['employee_ids'])) {
                $this->enrollEmployees($squad, (array) $data['employee_ids']);
                if ($squad->roster_pattern_id) {
                    $this->syncRosterDates($roster);
                }
            }

            return $squad->load(['pattern', 'employees']);
        });
    }

    /**
     * Update an existing Shift Squad.
     *
     * @param  array<string, mixed>  $data
     */
    public function updateSquad(RosterGroup $squad, array $data): RosterGroup
    {
        $squad->update([
            'name' => isset($data['name']) ? trim($data['name']) : $squad->name,
            'code' => isset($data['code']) ? strtoupper(trim($data['code'])) : $squad->code,
            'color' => $data['color'] ?? $squad->color,
            'roster_pattern_id' => array_key_exists('roster_pattern_id', $data)
                ? (! empty($data['roster_pattern_id']) ? $data['roster_pattern_id'] : null)
                : $squad->roster_pattern_id,
            'description' => array_key_exists('description', $data) ? $data['description'] : $squad->description,
        ]);

        return $squad->fresh(['pattern']);
    }

    /**
     * Delete a Shift Squad and its members.
     */
    public function deleteSquad(RosterGroup $squad): bool
    {
        return DB::transaction(function () use ($squad): bool {
            RosterEntry::where('roster_group_id', $squad->id)->delete();

            return (bool) $squad->delete();
        });
    }

    /**
     * Query available active employees for enrollment with strict Roster Exclusivity filtering.
     * Employees already enrolled in an active roster during this overlapping date range are excluded.
     *
     * @return \Illuminate\Support\Collection<int, array<string, mixed>>
     */
    public function getAvailableEmployees(
        string $startDate,
        string $endDate,
        ?string $departmentId = null,
        ?string $excludeRosterId = null
    ): \Illuminate\Support\Collection {
        $start = Carbon::parse($startDate)->toDateString();
        $end = Carbon::parse($endDate)->toDateString();

        // 1. Find all employee IDs already enrolled in another active roster during overlapping dates
        $squadEmpIds = RosterGroupMember::query()
            ->whereHas('group.roster', function ($q) use ($start, $end, $excludeRosterId) {
                $q->where('start_date', '<=', $end)
                    ->where('end_date', '>=', $start)
                    ->where('status', '!=', 'archived');
                if ($excludeRosterId !== null) {
                    $q->where('id', '!=', $excludeRosterId);
                }
            })
            ->pluck('employee_id');

        $entryEmpIds = RosterEntry::query()
            ->whereBetween('roster_date', [$start, $end])
            ->whereNotNull('roster_id')
            ->whereHas('roster', function ($q) use ($start, $end, $excludeRosterId) {
                $q->where('status', '!=', 'archived');
                if ($excludeRosterId !== null) {
                    $q->where('id', '!=', $excludeRosterId);
                }
            })
            ->pluck('employee_id');

        $excludedEmpIds = $squadEmpIds->concat($entryEmpIds)->unique()->all();

        // 2. Query active employees
        $query = Employee::query()
            ->select('id', 'emp_no', 'full_name', 'department_id', 'designation_id')
            ->with(['department:id,name,code', 'designation:id,title'])
            ->where('employment_status', 'active')
            ->orderBy('emp_no');

        if ($departmentId !== null && $departmentId !== '' && $departmentId !== 'all') {
            $query->where('department_id', $departmentId);
        }

        $allEmployees = $query->get();

        return $allEmployees->map(function ($emp) use ($excludedEmpIds) {
            $isRosteredElsewhere = in_array($emp->id, $excludedEmpIds, true);

            return [
                'id' => $emp->id,
                'emp_no' => $emp->emp_no,
                'full_name' => $emp->full_name,
                'department_name' => $emp->department?->name ?? 'General',
                'designation_title' => $emp->designation?->title ?? 'Staff',
                'is_available' => ! $isRosteredElsewhere,
                'exclusion_reason' => $isRosteredElsewhere ? 'Enrolled in another active roster' : null,
            ];
        });
    }

    /**
     * Enroll one or multiple employees into a Squad with exclusivity protection and instant sync.
     *
     * @param  array<int, string>  $employeeIds
     * @return array<int, string> Enrolled employee IDs
     */
    public function enrollEmployees(RosterGroup $group, array $employeeIds): array
    {
        $roster = $group->roster;
        if ($roster === null) {
            throw new DomainException('Target squad does not have an associated roster.');
        }

        $enrolled = [];

        DB::transaction(function () use ($group, $roster, $employeeIds, &$enrolled): void {
            $startDate = $roster->start_date instanceof CarbonInterface ? $roster->start_date->toDateString() : (string) $roster->start_date;
            $endDate = $roster->end_date instanceof CarbonInterface ? $roster->end_date->toDateString() : (string) $roster->end_date;

            foreach ($employeeIds as $empId) {
                // Check if already in another roster
                $inOtherRoster = RosterGroupMember::query()
                    ->where('employee_id', $empId)
                    ->whereHas('group.roster', function ($q) use ($startDate, $endDate, $roster) {
                        $q->where('id', '!=', $roster->id)
                            ->where('start_date', '<=', $endDate)
                            ->where('end_date', '>=', $startDate)
                            ->where('status', '!=', 'archived');
                    })
                    ->exists();

                $inOtherRosterEntries = RosterEntry::query()
                    ->where('employee_id', $empId)
                    ->whereBetween('roster_date', [$startDate, $endDate])
                    ->whereNotNull('roster_id')
                    ->where('roster_id', '!=', $roster->id)
                    ->whereHas('roster', function ($q) {
                        $q->where('status', '!=', 'archived');
                    })
                    ->exists();

                if ($inOtherRoster || $inOtherRosterEntries) {
                    $emp = Employee::find($empId);
                    throw new DomainException("Employee '{$emp?->full_name}' ({$emp?->emp_no}) is already assigned to another active roster during this period.");
                }

                RosterGroupMember::updateOrCreate(
                    [
                        'roster_group_id' => $group->id,
                        'employee_id' => $empId,
                    ],
                    [
                        'start_date' => $startDate,
                        'end_date' => $endDate,
                    ]
                );

                $enrolled[] = $empId;
            }

            // Sync newly enrolled employees if group has an attached pattern
            if ($group->roster_pattern_id) {
                $pattern = $group->pattern;
                if ($pattern) {
                    $this->generateRoster([
                        'pattern_id' => $pattern->id,
                        'start_date' => $startDate,
                        'end_date' => $endDate,
                        'employee_ids' => $enrolled,
                        'conflict_mode' => 'overwrite',
                        'status' => $roster->status === 'published' ? 'published' : 'draft',
                        'preserve_leaves' => true,
                        'roster_id' => $roster->id,
                        'roster_group_id' => $group->id,
                    ]);
                }
            }
        });

        return $enrolled;
    }

    /**
     * Remove an employee from a Squad and clean their future uncompleted roster entries.
     */
    public function removeEmployeeFromSquad(RosterGroup $group, string $employeeId): bool
    {
        $roster = $group->roster;

        return DB::transaction(function () use ($group, $roster, $employeeId): bool {
            RosterGroupMember::where('roster_group_id', $group->id)
                ->where('employee_id', $employeeId)
                ->delete();

            if ($roster) {
                // Delete entries in this roster that haven't been locked
                RosterEntry::where('roster_id', $roster->id)
                    ->where('employee_id', $employeeId)
                    ->where('status', '!=', 'locked')
                    ->delete();
            }

            return true;
        });
    }

    /**
     * 1-Click Synchronize and generate calendar entries for all enrolled squads in a Named Roster.
     *
     * @return array{created: int, updated: int, total: int}
     */
    public function syncRosterDates(Roster $roster): array
    {
        $startDate = $roster->start_date instanceof CarbonInterface ? $roster->start_date->toDateString() : (string) $roster->start_date;
        $endDate = $roster->end_date instanceof CarbonInterface ? $roster->end_date->toDateString() : (string) $roster->end_date;

        $groups = $roster->groups()->with(['pattern', 'employees'])->get();
        $totalCreated = 0;
        $totalUpdated = 0;

        foreach ($groups as $group) {
            if (! $group->roster_pattern_id || ! $group->pattern) {
                continue;
            }

            $empIds = $group->employees->pluck('id')->all();
            if (empty($empIds)) {
                continue;
            }

            $res = $this->generateRoster([
                'pattern_id' => $group->pattern->id,
                'start_date' => $startDate,
                'end_date' => $endDate,
                'employee_ids' => $empIds,
                'conflict_mode' => 'overwrite',
                'status' => $roster->status === 'published' ? 'published' : 'draft',
                'preserve_leaves' => true,
                'roster_id' => $roster->id,
                'roster_group_id' => $group->id,
            ]);

            $totalCreated += $res['created'];
            $totalUpdated += $res['updated'];
        }

        return [
            'created' => $totalCreated,
            'updated' => $totalUpdated,
            'total' => $totalCreated + $totalUpdated,
        ];
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


    /**
     * Automatically generate complementary rotated squad group cards from an existing cyclical pattern.
     *
     * @return array<int, RosterPattern>
     */
    public function generateComplementarySquads(RosterPattern $sourcePattern, ?int $totalSquads = null, ?int $staggerDays = null): array
    {
        if ($sourcePattern->pattern_type !== 'cyclical') {
            throw new DomainException('Complementary squads can only be generated for cyclical patterns.');
        }

        $steps = $sourcePattern->pattern_data['steps'] ?? $sourcePattern->pattern_data ?? [];
        $count = count($steps);
        if ($count <= 1) {
            throw new DomainException('Cycle length must be at least 2 to generate complementary squads.');
        }

        // Auto-detect uniform block size (e.g. 2-2-2-2 in 8-step cycle -> block size 2 -> 4 squads)
        if ($totalSquads === null || $totalSquads < 2) {
            $blockSize = $this->detectBlockSize($steps);
            if ($blockSize > 1 && ($count % $blockSize) === 0) {
                $totalSquads = (int) ($count / $blockSize);
            } else {
                $totalSquads = $count;
            }
        }

        // Cap squads to 26 (A-Z)
        $totalSquads = min($totalSquads, 26);

        if ($staggerDays === null || $staggerDays < 1) {
            $staggerDays = max(1, (int) round($count / $totalSquads));
        }

        return DB::transaction(function () use ($sourcePattern, $steps, $count, $totalSquads, $staggerDays): array {
            $created = [];
            $alphabet = range('A', 'Z');
            $baseName = preg_replace('/(\s*-\s*Group\s*[A-Z].*)$/i', '', $sourcePattern->name);
            $baseCode = preg_replace('/(-GRP-[A-Z].*)$/i', '', $sourcePattern->code);

            for ($squadIndex = 1; $squadIndex < $totalSquads; $squadIndex++) {
                $letter = $alphabet[$squadIndex] ?? ('G'.($squadIndex + 1));
                $offset = ($squadIndex * $staggerDays) % $count;
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
     * Detect if a cyclical step sequence is arranged in uniform blocks (e.g. 2 Morn, 2 Eve, 2 Night, 2 Off -> block size 2).
     */
    private function detectBlockSize(array $steps): int
    {
        $count = count($steps);
        if ($count < 2) {
            return 1;
        }

        // Count length of first consecutive block
        $firstShiftId = $steps[0]['shift_id'] ?? null;
        $firstIsRest = (bool) ($steps[0]['is_rest_day'] ?? false);
        $firstBlockLen = 0;
        for ($i = 0; $i < $count; $i++) {
            $shiftId = $steps[$i]['shift_id'] ?? null;
            $isRest = (bool) ($steps[$i]['is_rest_day'] ?? false);
            if ($shiftId === $firstShiftId && $isRest === $firstIsRest) {
                $firstBlockLen++;
            } else {
                break;
            }
        }

        if ($firstBlockLen <= 1 || ($count % $firstBlockLen) !== 0) {
            return 1;
        }

        // Verify if all subsequent blocks match this uniform block length
        $pos = 0;
        while ($pos < $count) {
            $blockShiftId = $steps[$pos]['shift_id'] ?? null;
            $blockIsRest = (bool) ($steps[$pos]['is_rest_day'] ?? false);
            for ($k = 0; $k < $firstBlockLen; $k++) {
                if ($pos + $k >= $count) {
                    return 1;
                }
                $sId = $steps[$pos + $k]['shift_id'] ?? null;
                $iRest = (bool) ($steps[$pos + $k]['is_rest_day'] ?? false);
                if ($sId !== $blockShiftId || $iRest !== $blockIsRest) {
                    return 1;
                }
            }
            $pos += $firstBlockLen;
        }

        return $firstBlockLen;
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
