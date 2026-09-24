<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\Department;
use App\Models\Employee;
use App\Models\LeaveRequest;
use App\Models\PayrollRun;
use App\Models\PublicHoliday;
use App\Models\Roster;
use App\Models\RosterEmployeeAllocation;
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
    public function getMonthMatrix(int $year, int $month, ?string $departmentId = null, ?string $rosterId = null): array
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
            ->withCount(['entries'])
            ->where('status', '!=', 'archived')
            ->orderBy('start_date', 'desc')
            ->get();

        $activeRoster = null;
        if ($rosterId !== null && $rosterId !== '' && $rosterId !== 'all') {
            $activeRoster = Roster::with([
                'department:id,name,code',
            ])->find($rosterId);
        }

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

        // 2. Query Employees: If no roster is selected, return empty matrix (Requirement 1 & 2)
        $employees = collect();
        $targetDeptId = $departmentId ?? $activeRoster?->department_id;

        if ($activeRoster !== null) {
            $allocatedEmpIds = RosterEmployeeAllocation::query()
                ->where('roster_id', $activeRoster->id)
                ->where('effective_from', '<=', $endDate->toDateString())
                ->where('effective_to', '>=', $startDate->toDateString())
                ->pluck('employee_id');

            $entryEmpIds = RosterEntry::query()
                ->where('roster_id', $activeRoster->id)
                ->whereBetween('roster_date', [$startDate->toDateString(), $endDate->toDateString()])
                ->pluck('employee_id');

            $allAllocatedIds = $allocatedEmpIds->concat($entryEmpIds)->unique()->filter()->values()->all();

            $employeeQuery = Employee::query()
                ->select('id', 'emp_no', 'full_name', 'department_id', 'date_of_joining')
                ->with(['department:id,name'])
                ->where('employment_status', 'active')
                ->whereIn('id', $allAllocatedIds)
                ->orderBy('emp_no');

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

            $empHireDate = $emp->date_of_joining ? Carbon::parse($emp->date_of_joining)->startOfDay() : null;

            for ($d = 1; $d <= $daysInMonth; $d++) {
                $dateObj = Carbon::createFromDate($year, $month, $d);
                $dateString = $dateObj->toDateString();
                $entry = $empEntries->get($dateString);
                $leave = $leaveMap[$emp->id][$dateString] ?? null;

                $isPreHire = $empHireDate && $dateObj->lt($empHireDate);
                $fatigueWarning = false;
                $restHours = null;

                if ($leave !== null) {
                    $coverageSummary[$dateString]['total_leave']++;
                }

                if ($entry !== null && ! $isPreHire) {
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
                            if ($gapMinutes < 660 && $gapMinutes >= 0) { // Under 11 hours
                                $fatigueWarning = true;
                                $restHours = round($gapMinutes / 60, 1);
                            }
                        }

                        // Update prevShiftEndDateTime for the next iteration
                        $currEnd = Carbon::parse("{$dateString} {$entry->shift->end_time}");
                        if ($entry->shift->is_night_shift) {
                            $currEnd->addDay();
                        }
                        $prevShiftEndDateTime = $currEnd;
                    } elseif ($entry->schedule_type === 'rest_day' || $entry->schedule_type === 'off') {
                        $scheduledRestDays++;
                        $totalRestDays++;
                        $coverageSummary[$dateString]['total_rest']++;
                        $prevShiftEndDateTime = null; // Full rest day resets fatigue interval
                    }

                    if ($entry->status === 'draft') {
                        $totalDraftEntries++;
                    } elseif ($entry->status === 'published') {
                        $totalPublishedEntries++;
                    }
                } else {
                    $prevShiftEndDateTime = null;
                }

                $cellData = [
                    'day' => $d,
                    'date' => $dateString,
                    'entry_id' => $isPreHire ? null : $entry?->id,
                    'schedule_type' => $isPreHire ? null : ($entry?->schedule_type ?? ($leave ? 'leave' : null)),
                    'shift' => (! $isPreHire && $entry?->shift) ? [
                        'id' => $entry->shift->id,
                        'name' => $entry->shift->name,
                        'code' => $entry->shift->code,
                        'color' => $entry->shift->color,
                        'start_time' => $entry->shift->start_time,
                        'end_time' => $entry->shift->end_time,
                        'is_night_shift' => (bool) $entry->shift->is_night_shift,
                    ] : null,
                    'original_shift' => (! $isPreHire && $entry?->originalShift) ? [
                        'id' => $entry->originalShift->id,
                        'name' => $entry->originalShift->name,
                        'code' => $entry->originalShift->code,
                        'color' => $entry->originalShift->color,
                    ] : null,
                    'status' => $isPreHire ? null : ($entry?->status ?? null),
                    'is_overridden' => $isPreHire ? false : ($entry ? (bool) $entry->is_overridden : false),
                    'override_reason' => $isPreHire ? null : $entry?->override_reason,
                    'overridden_by' => $isPreHire ? null : $entry?->overriddenBy?->name,
                    'notes' => $isPreHire ? "Joined on " . $emp->date_of_joining?->format('Y-m-d') : $entry?->notes,
                    'leave' => $isPreHire ? null : $leave,
                    'fatigue_warning' => $isPreHire ? false : $fatigueWarning,
                    'rest_hours' => $isPreHire ? null : $restHours,
                    'is_pre_hire' => $isPreHire,
                ];

                $dailyCells[$d] = $cellData;
                $dailyCells[$dateString] = $cellData;
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

        // 8. Query Available Employees for Roster Assignment (Exclusivity Filter)
        $availableEmployees = $this->getAvailableEmployees(
            $activeRoster?->start_date?->toDateString() ?? $startDate->toDateString(),
            $activeRoster?->end_date?->toDateString() ?? $endDate->toDateString(),
            $targetDeptId,
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
            'selected_department' => $targetDeptId,
            'rosters' => $allRosters,
            'active_roster' => $activeRoster,
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
                        $anchorDate = $startDate->copy()->subDays($startingStep - 1)->toDateString();
                    } else {
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
            $targetEmployees = $employeeQuery->get(['id', 'date_of_joining']);

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
            $rosterPatternId = $data['pattern_id'] ?? null;

            foreach ($targetEmployees as $emp) {
                $empSourceCopy = $sourceCopyEntries?->get($emp->id, collect());
                $empHireDate = $emp->date_of_joining ? Carbon::parse($emp->date_of_joining)->startOfDay() : null;

                foreach ($dates as $date) {
                    // Hire Date Clamping
                    if ($empHireDate && $date->lt($empHireDate)) {
                        continue;
                    }

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
            $chunks = array_chunk($rowsToUpsert, 250);
            foreach ($chunks as $chunk) {
                RosterEntry::upsert(
                    $chunk,
                    ['tenant_id', 'employee_id', 'roster_date'],
                    ['shift_id', 'schedule_type', 'status', 'roster_id', 'roster_pattern_id', 'notes', 'updated_at']
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
        string $mode,
        array $data,
        CarbonInterface $cyclicalAnchor,
        array $cyclicalSteps,
        int $cyclicalCount,
        ?Collection $sourceCopyEntries
    ): ?array {
        return match ($mode) {
            'daily' => $this->resolveDailyMode($date, $data['daily_config'] ?? []),
            'weekly' => $this->resolveWeeklyMode($date, $data['weekly_config'] ?? []),
            'cyclical' => $this->resolveCyclicalMode($date, $cyclicalAnchor, $cyclicalSteps, $cyclicalCount),
            'copy_month' => $this->resolveCopyMonthMode($date, $sourceCopyEntries),
            default => null,
        };
    }

    /**
     * Resolve schedule under Daily Single Shift Mode.
     *
     * @param  array<string, mixed>  $config
     * @return array{shift_id: ?string, schedule_type: string, notes: ?string}
     */
    private function resolveDailyMode(CarbonInterface $date, array $config): array
    {
        $dayOfWeek = (int) $date->dayOfWeekIso; // 1 (Mon) - 7 (Sun)
        $restDays = $config['rest_days'] ?? [7]; // default Sunday off

        if (in_array($dayOfWeek, $restDays, true)) {
            return ['shift_id' => null, 'schedule_type' => 'rest_day', 'notes' => 'Rest Day'];
        }

        return [
            'shift_id' => $config['shift_id'] ?? null,
            'schedule_type' => 'shift',
            'notes' => $config['notes'] ?? null,
        ];
    }

    /**
     * Resolve schedule under 7-Day Weekly Matrix Mode.
     *
     * @param  array<int, array<string, mixed>>  $weeklyConfig
     * @return array{shift_id: ?string, schedule_type: string, notes: ?string}
     */
    private function resolveWeeklyMode(CarbonInterface $date, array $weeklyConfig): array
    {
        // $date->dayOfWeekIso returns 1 (Mon) to 7 (Sun).
        // In our weekly matrix, day 0 = Mon, 6 = Sun
        $dayIndex = (int) $date->dayOfWeekIso - 1;

        $dayConfig = collect($weeklyConfig)->first(function ($item, $key) use ($dayIndex) {
            if (isset($item['day'])) {
                return (int) $item['day'] === $dayIndex;
            }

            return (int) $key === $dayIndex;
        });

        if (! $dayConfig || ! empty($dayConfig['is_rest_day']) || empty($dayConfig['shift_id'])) {
            return ['shift_id' => null, 'schedule_type' => 'rest_day', 'notes' => 'Weekly Rest Day'];
        }

        return [
            'shift_id' => $dayConfig['shift_id'],
            'schedule_type' => 'shift',
            'notes' => $dayConfig['notes'] ?? null,
        ];
    }

    /**
     * Resolve schedule under Rolling N-Day Cyclical Mode.
     *
     * @param  array<int, array<string, mixed>>  $steps
     * @return array{shift_id: ?string, schedule_type: string, notes: ?string}
     */
    private function resolveCyclicalMode(
        CarbonInterface $date,
        CarbonInterface $anchorDate,
        array $steps,
        int $cycleLength
    ): array {
        if ($cycleLength <= 0 || empty($steps)) {
            return ['shift_id' => null, 'schedule_type' => 'rest_day', 'notes' => 'Empty Cycle'];
        }

        // Calculate days elapsed from anchor date
        $diffDays = (int) $anchorDate->diffInDays($date, false);

        // Modulo arithmetic supporting both forward and backward historical dates
        $stepIndex = (($diffDays % $cycleLength) + $cycleLength) % $cycleLength;

        // Steps can be keyed by step property or pure array index
        $step = $steps[$stepIndex] ?? null;

        if (! $step || ! empty($step['is_rest_day']) || empty($step['shift_id'])) {
            return ['shift_id' => null, 'schedule_type' => 'rest_day', 'notes' => "Cyclical Step #".($stepIndex + 1).' (Rest)'];
        }

        return [
            'shift_id' => $step['shift_id'],
            'schedule_type' => 'shift',
            'notes' => "Cyclical Step #".($stepIndex + 1),
        ];
    }

    /**
     * Resolve schedule under Month-to-Month Clone Mode.
     *
     * @param  Collection<int, RosterEntry>|null  $sourceEntries
     * @return array{shift_id: ?string, schedule_type: string, notes: ?string}|null
     */
    private function resolveCopyMonthMode(CarbonInterface $date, ?Collection $sourceEntries): ?array
    {
        if ($sourceEntries === null || $sourceEntries->isEmpty()) {
            return null;
        }

        $dayNumber = $date->day;
        $match = $sourceEntries->first(function (RosterEntry $entry) use ($dayNumber) {
            $eDate = $entry->roster_date instanceof CarbonInterface
                ? $entry->roster_date
                : Carbon::parse($entry->roster_date);

            return $eDate->day === $dayNumber;
        });

        if (! $match) {
            return null;
        }

        return [
            'shift_id' => $match->shift_id,
            'schedule_type' => $match->schedule_type,
            'notes' => 'Cloned from previous month',
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
        ?string $rosterId = null
    ): RosterEntry {
        $this->ensureNotLocked($date);

        return DB::transaction(function () use ($employeeId, $date, $shiftId, $scheduleType, $notes, $status, $overrideReason, $rosterId): RosterEntry {
            $entry = RosterEntry::where('employee_id', $employeeId)
                ->whereDate('roster_date', $date)
                ->first();

            $originalShiftId = $entry ? ($entry->original_shift_id ?? $entry->shift_id) : null;
            $newShiftId = ($scheduleType === 'rest_day' || $scheduleType === 'off') ? null : $shiftId;

            $targetRosterId = $rosterId ?? $entry?->roster_id;

            if ($targetRosterId === null) {
                $targetRosterId = Roster::where('start_date', '<=', $date)
                    ->where('end_date', '>=', $date)
                    ->where('status', '!=', 'archived')
                    ->value('id');
            }

            $attributes = [
                'roster_id' => $targetRosterId,
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
            $notes ?? 'Extended operational relief duty',
            'published',
            'Relief Shift Extension'
        );
    }

    /**
     * Mutual shift swap between two employees on a designated operational date.
     *
     * @return array{employee_a: RosterEntry, employee_b: RosterEntry}
     */
    public function swapShift(string $employeeAId, string $employeeBId, string $date, ?string $reason = null): array
    {
        $this->ensureNotLocked($date);

        return DB::transaction(function () use ($employeeAId, $employeeBId, $date, $reason): array {
            $entryA = RosterEntry::where('employee_id', $employeeAId)->whereDate('roster_date', $date)->first();
            $entryB = RosterEntry::where('employee_id', $employeeBId)->whereDate('roster_date', $date)->first();

            $shiftAId = $entryA?->shift_id;
            $typeA = $entryA?->schedule_type ?? 'rest_day';

            $shiftBId = $entryB?->shift_id;
            $typeB = $entryB?->schedule_type ?? 'rest_day';

            $swapReason = $reason ?? 'Mutual Operational Shift Swap';

            $updatedA = $this->updateEntry(
                $employeeAId,
                $date,
                $shiftBId,
                $typeB,
                "Swapped shift with employee #{$employeeBId}",
                'published',
                $swapReason
            );

            $updatedB = $this->updateEntry(
                $employeeBId,
                $date,
                $shiftAId,
                $typeA,
                "Swapped shift with employee #{$employeeAId}",
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
     * Store a newly created Named Roster.
     *
     * @param  array<string, mixed>  $data
     */
    public function createRoster(array $data): Roster
    {
        $startDate = Carbon::parse($data['start_date'])->startOfDay();
        $endDate = Carbon::parse($data['end_date'])->endOfDay();

        $this->ensureNotLockedInRange($startDate, $endDate);

        $empIds = $data['employee_ids'] ?? [];
        if (! empty($empIds)) {
            $this->validateNoRosterOverlap($empIds, $startDate->toDateString(), $endDate->toDateString());
        }

        $code = ! empty($data['code'])
            ? strtoupper(trim($data['code']))
            : 'RST-' . $startDate->format('Y-m') . '-' . strtoupper(Str::random(4));

        return DB::transaction(function () use ($data, $startDate, $endDate, $code, $empIds): Roster {
            $roster = Roster::create([
                'name' => trim($data['name']),
                'code' => $code,
                'department_id' => ! empty($data['department_id']) && $data['department_id'] !== 'all' ? $data['department_id'] : null,
                'start_date' => $startDate->toDateString(),
                'end_date' => $endDate->toDateString(),
                'status' => $data['status'] ?? 'draft',
                'published_at' => null,
                'published_by' => null,
                'notes' => $data['notes'] ?? null,
                'created_by' => Auth::id(),
            ]);

            // If an initial pattern is selected, immediately generate entries for target employees
            if (! empty($data['pattern_id'])) {
                $targetEmpIds = $empIds;
                if (empty($targetEmpIds) && ! empty($roster->department_id)) {
                    $targetEmpIds = Employee::where('department_id', $roster->department_id)
                        ->where('employment_status', 'active')
                        ->pluck('id')
                        ->all();
                }

                if (! empty($targetEmpIds)) {
                    $this->generateRoster([
                        'pattern_id' => $data['pattern_id'],
                        'start_date' => $startDate->toDateString(),
                        'end_date' => $endDate->toDateString(),
                        'employee_ids' => $targetEmpIds,
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

        $newStart = isset($data['start_date']) ? Carbon::parse($data['start_date'])->startOfDay() : $roster->start_date;
        $newEnd = isset($data['end_date']) ? Carbon::parse($data['end_date'])->endOfDay() : $roster->end_date;

        $this->ensureNotLockedInRange($newStart, $newEnd);

        return DB::transaction(function () use ($roster, $data, $newStart, $newEnd): Roster {
            $roster->update([
                'name' => isset($data['name']) ? trim($data['name']) : $roster->name,
                'code' => isset($data['code']) ? strtoupper(trim($data['code'])) : $roster->code,
                'department_id' => array_key_exists('department_id', $data) ? ($data['department_id'] !== 'all' ? $data['department_id'] : null) : $roster->department_id,
                'start_date' => $newStart instanceof CarbonInterface ? $newStart->toDateString() : (string) $newStart,
                'end_date' => $newEnd instanceof CarbonInterface ? $newEnd->toDateString() : (string) $newEnd,
                'notes' => array_key_exists('notes', $data) ? $data['notes'] : $roster->notes,
                'updated_by' => Auth::id(),
            ]);

            return $roster->fresh('department');
        });
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
     * Clone an entire Roster and its entries to a new target date range.
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
                'published_at' => null,
                'published_by' => null,
                'notes' => $data['notes'] ?? "Cloned from {$sourceRoster->name}",
                'created_by' => Auth::id(),
            ]);

            // Clone entries mapped to new dates
            $sourceEntries = RosterEntry::where('roster_id', $sourceRoster->id)->get();
            $sourceStart = Carbon::parse($sourceRoster->start_date);
            $now = Carbon::now();

            $newEntries = [];
            foreach ($sourceEntries as $entry) {
                $entryDate = Carbon::parse($entry->roster_date);
                $dayOffset = $sourceStart->diffInDays($entryDate);
                $targetDate = $startDate->copy()->addDays($dayOffset);

                if ($targetDate->gt($endDate)) {
                    continue;
                }

                $newEntries[] = [
                    'id' => (string) Str::ulid(),
                    'tenant_id' => $entry->tenant_id,
                    'roster_id' => $newRoster->id,
                    'roster_pattern_id' => $entry->roster_pattern_id,
                    'employee_id' => $entry->employee_id,
                    'roster_date' => $targetDate->toDateString(),
                    'shift_id' => $entry->shift_id,
                    'schedule_type' => $entry->schedule_type,
                    'status' => 'draft',
                    'is_overridden' => false,
                    'notes' => $entry->notes,
                    'created_by' => Auth::id(),
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
            }

            foreach (array_chunk($newEntries, 250) as $chunk) {
                RosterEntry::upsert(
                    $chunk,
                    ['tenant_id', 'employee_id', 'roster_date'],
                    ['shift_id', 'schedule_type', 'status', 'roster_id', 'roster_pattern_id', 'notes', 'updated_at']
                );
            }

            return $newRoster->fresh('department');
        });
    }

    /**
     * Validate that no employees are double-booked into another active roster during overlapping dates.
     *
     * @param  array<int, string>  $employeeIds
     */
    public function validateNoRosterOverlap(
        array $employeeIds,
        string $startDate,
        string $endDate,
        ?string $excludeRosterId = null
    ): void {
        if (empty($employeeIds)) {
            return;
        }

        $start = Carbon::parse($startDate)->toDateString();
        $end = Carbon::parse($endDate)->toDateString();

        $overlappingEntry = RosterEntry::query()
            ->whereIn('employee_id', $employeeIds)
            ->whereBetween('roster_date', [$start, $end])
            ->whereHas('roster', function ($q) use ($excludeRosterId) {
                $q->where('status', '!=', 'archived');
                if ($excludeRosterId) {
                    $q->where('id', '!=', $excludeRosterId);
                }
            })
            ->with(['roster:id,name,start_date,end_date', 'employee:id,full_name,emp_no'])
            ->first();

        if ($overlappingEntry) {
            $empName = $overlappingEntry->employee?->full_name ?? 'Employee';
            $empNo = $overlappingEntry->employee?->emp_no ?? '';
            $rosterName = $overlappingEntry->roster?->name ?? 'Another Roster';

            throw new DomainException(
                "Conflict: Employee '{$empName}' ({$empNo}) is already scheduled in active roster '{$rosterName}'. Overlapping roster assignments are not permitted."
            );
        }
    }

    /**
     * Query available active employees for enrollment with strict Roster Exclusivity filtering.
     *
     * @return Collection<int, array<string, mixed>>
     */
    public function getAvailableEmployees(
        string $startDate,
        string $endDate,
        ?string $departmentId = null,
        ?string $excludeRosterId = null
    ): \Illuminate\Support\Collection {
        $start = Carbon::parse($startDate)->toDateString();
        $end = Carbon::parse($endDate)->toDateString();

        // 1. Find all active entries in overlapping active rosters
        $activeEntries = RosterEntry::query()
            ->with(['roster:id,name,code,status'])
            ->whereBetween('roster_date', [$start, $end])
            ->whereHas('roster', function ($q) use ($excludeRosterId) {
                $q->where('status', '!=', 'archived');
                if ($excludeRosterId) {
                    $q->where('id', '!=', $excludeRosterId);
                }
            })
            ->get()
            ->groupBy('employee_id');

        // 2. Query active employees
        $query = Employee::query()
            ->select('id', 'emp_no', 'full_name', 'department_id', 'designation_id', 'date_of_joining')
            ->with(['department:id,name,code', 'designation:id,title'])
            ->where('employment_status', 'active')
            ->orderBy('emp_no');

        if ($departmentId !== null && $departmentId !== '' && $departmentId !== 'all') {
            $query->where('department_id', $departmentId);
        }

        $allEmployees = $query->get();

        return $allEmployees->map(function ($emp) use ($activeEntries) {
            $entries = $activeEntries->get($emp->id);
            $firstRoster = $entries?->first()?->roster;
            $isEnrolledElsewhere = $firstRoster !== null;

            return [
                'id' => $emp->id,
                'emp_no' => $emp->emp_no,
                'full_name' => $emp->full_name,
                'department_id' => $emp->department_id,
                'date_of_joining' => $emp->date_of_joining?->toDateString(),
                'hire_date' => $emp->date_of_joining?->toDateString(),
                'department_name' => $emp->department?->name ?? 'General',
                'designation_title' => $emp->designation?->title ?? 'Staff',
                'is_available' => ! $isEnrolledElsewhere,
                'exclusion_reason' => $isEnrolledElsewhere
                    ? "Assigned to {$firstRoster->name}"
                    : null,
                'current_roster' => $firstRoster ? [
                    'id' => $firstRoster->id,
                    'name' => $firstRoster->name,
                    'code' => $firstRoster->code,
                ] : null,
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
     * Allocate an employee or multiple employees to a roster for a specified date range.
     *
     * @param  array<int, string>|string  $employeeIds
     */
    public function allocateEmployee(
        string $rosterId,
        array|string $employeeIds,
        string $effectiveFrom,
        string $effectiveTo,
        ?string $patternId = null,
        ?string $notes = null
    ): int {
        $roster = Roster::findOrFail($rosterId);
        $empIds = (array) $employeeIds;

        if (empty($empIds)) {
            return 0;
        }

        $userId = Auth::id();
        $tenantId = session('tenant_id')
            ?? (app()->has('current_tenant_id') ? app('current_tenant_id') : null)
            ?? Auth::user()?->tenant_id;

        return DB::transaction(function () use ($roster, $empIds, $effectiveFrom, $effectiveTo, $patternId, $notes, $userId, $tenantId): int {
            $createdCount = 0;

            foreach ($empIds as $empId) {
                // Remove overlapping allocation for this employee in this roster if any exists
                RosterEmployeeAllocation::where('roster_id', $roster->id)
                    ->where('employee_id', $empId)
                    ->where('effective_from', '<=', $effectiveTo)
                    ->where('effective_to', '>=', $effectiveFrom)
                    ->delete();

                RosterEmployeeAllocation::create([
                    'tenant_id' => $tenantId,
                    'roster_id' => $roster->id,
                    'employee_id' => $empId,
                    'effective_from' => $effectiveFrom,
                    'effective_to' => $effectiveTo,
                    'notes' => $notes,
                    'created_by' => $userId,
                ]);

                $createdCount++;
            }

            // If patternId is supplied, auto-generate shift entries for allocated range
            if ($patternId !== null && $patternId !== '') {
                $this->generateRoster([
                    'roster_id' => $roster->id,
                    'pattern_id' => $patternId,
                    'employee_ids' => $empIds,
                    'start_date' => $effectiveFrom,
                    'end_date' => $effectiveTo,
                ]);
            }

            return $createdCount;
        });
    }

    /**
     * Deallocate an employee from a roster (full month or from effective removal date).
     */
    public function deallocateEmployee(
        string $rosterId,
        string $employeeId,
        ?string $effectiveRemovalDate = null
    ): bool {
        return DB::transaction(function () use ($rosterId, $employeeId, $effectiveRemovalDate): bool {
            if ($effectiveRemovalDate === null || $effectiveRemovalDate === '') {
                // Full removal from roster
                RosterEmployeeAllocation::where('roster_id', $rosterId)
                    ->where('employee_id', $employeeId)
                    ->delete();

                RosterEntry::where('roster_id', $rosterId)
                    ->where('employee_id', $employeeId)
                    ->delete();

                return true;
            }

            $removalDate = Carbon::parse($effectiveRemovalDate)->toDateString();
            $allocations = RosterEmployeeAllocation::where('roster_id', $rosterId)
                ->where('employee_id', $employeeId)
                ->get();

            foreach ($allocations as $alloc) {
                $allocStart = $alloc->effective_from->toDateString();
                $allocEnd = $alloc->effective_to->toDateString();

                if ($allocStart >= $removalDate) {
                    $alloc->delete();
                } elseif ($allocEnd >= $removalDate) {
                    $alloc->update([
                        'effective_to' => Carbon::parse($removalDate)->subDay()->toDateString(),
                    ]);
                }
            }

            // Clear entries for remove_date onwards
            RosterEntry::where('roster_id', $rosterId)
                ->where('employee_id', $employeeId)
                ->where('roster_date', '>=', $removalDate)
                ->delete();

            return true;
        });
    }

    /**
     * Transfer an employee from source roster to target roster starting on transfer date.
     */
    public function transferEmployee(
        string $sourceRosterId,
        string $targetRosterId,
        string $employeeId,
        string $transferDate,
        ?string $patternId = null
    ): bool {
        return DB::transaction(function () use ($sourceRosterId, $targetRosterId, $employeeId, $transferDate, $patternId): bool {
            $targetRoster = Roster::findOrFail($targetRosterId);

            if ($sourceRosterId === $targetRosterId) {
                // Same Roster Shift Pattern Switch: Apply pattern starting from transferDate
                if ($patternId !== null && $patternId !== '') {
                    $this->generateRoster([
                        'roster_id' => $targetRosterId,
                        'pattern_id' => $patternId,
                        'employee_ids' => [$employeeId],
                        'start_date' => $transferDate,
                        'end_date' => $targetRoster->end_date instanceof CarbonInterface ? $targetRoster->end_date->toDateString() : (string) $targetRoster->end_date,
                        'conflict_mode' => 'overwrite',
                    ]);
                }
                return true;
            }

            // 1. Deallocate from source roster from transferDate onwards
            $this->deallocateEmployee($sourceRosterId, $employeeId, $transferDate);

            // 2. Allocate to target roster from transferDate to targetRoster end_date
            $targetEnd = $targetRoster->end_date instanceof CarbonInterface ? $targetRoster->end_date->toDateString() : (string) $targetRoster->end_date;
            $this->allocateEmployee(
                $targetRoster->id,
                [$employeeId],
                $transferDate,
                $targetEnd,
                $patternId
            );

            return true;
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
