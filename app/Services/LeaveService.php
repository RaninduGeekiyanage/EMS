<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\AttendanceDaily;
use App\Models\AttendancePeriodLock;
use App\Models\CompensatoryLeaveRecord;
use App\Models\DepartmentHead;
use App\Models\Employee;
use App\Models\LeaveEntitlement;
use App\Models\LeaveRequest;
use App\Models\LeaveType;
use App\Models\PublicHoliday;
use App\Models\User;
use Carbon\Carbon;
use Carbon\CarbonInterface;
use Carbon\CarbonPeriod;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

final class LeaveService
{
    public function __construct(
        private readonly ?ShiftService $shiftService = null
    ) {}

    /**
     * Sri Lankan Statutory Leave Type Presets.
     */
    public const STATUTORY_PRESETS = [
        [
            'code' => 'ANNUAL',
            'name' => 'Annual Leave',
            'days_per_year' => 14.0,
            'is_paid' => true,
            'carry_forward_allowed' => true,
            'max_carry_forward_days' => 7.0,
            'color' => '#3b82f6', // blue
            'description' => 'Statutory annual leave under Shop & Office Employees Act (14 days per annum following 1 year of continuous service).',
        ],
        [
            'code' => 'CASUAL',
            'name' => 'Casual Leave',
            'days_per_year' => 7.0,
            'is_paid' => true,
            'carry_forward_allowed' => false,
            'max_carry_forward_days' => 0.0,
            'color' => '#10b981', // emerald
            'description' => 'Statutory casual leave for private personal and unforeseen matters (7 days per annum).',
        ],
        [
            'code' => 'MEDICAL',
            'name' => 'Medical / Sick Leave',
            'days_per_year' => 7.0,
            'is_paid' => true,
            'carry_forward_allowed' => false,
            'max_carry_forward_days' => 0.0,
            'requires_attachment' => true,
            'color' => '#f59e0b', // amber
            'description' => 'Medical leave for illness with medical certification requirements.',
        ],
        [
            'code' => 'MATERNITY',
            'name' => 'Maternity Leave',
            'days_per_year' => 84.0,
            'is_paid' => true,
            'carry_forward_allowed' => false,
            'max_carry_forward_days' => 0.0,
            'max_consecutive_days' => 84,
            'color' => '#ec4899', // pink
            'description' => 'Statutory maternity leave of 84 working days (12 weeks) for female employees.',
        ],
        [
            'code' => 'NO_PAY',
            'name' => 'No-Pay Leave',
            'days_per_year' => 0.0,
            'is_paid' => false,
            'carry_forward_allowed' => false,
            'max_carry_forward_days' => 0.0,
            'color' => '#ef4444', // red
            'description' => 'Unpaid leave automatically recorded for downstream payroll salary deductions.',
        ],
        [
            'code' => 'COMPENSATORY',
            'name' => 'Compensatory Off (C-Off)',
            'days_per_year' => 0.0,
            'is_paid' => true,
            'carry_forward_allowed' => false,
            'max_carry_forward_days' => 0.0,
            'color' => '#8b5cf6', // purple
            'description' => 'Compensatory off-in-lieu granted for working on rest days or public holidays, valid for 90 days.',
        ],
    ];

    /**
     * Seed Sri Lankan statutory leave types for a tenant.
     *
     * @return Collection<int, LeaveType>
     */
    public function seedStatutoryTypes(string $tenantId): Collection
    {
        return DB::transaction(function () use ($tenantId): Collection {
            $createdTypes = new Collection;

            foreach (self::STATUTORY_PRESETS as $preset) {
                $type = LeaveType::updateOrCreate(
                    [
                        'tenant_id' => $tenantId,
                        'code' => $preset['code'],
                    ],
                    array_merge($preset, [
                        'tenant_id' => $tenantId,
                        'is_active' => true,
                    ])
                );
                $createdTypes->push($type);
            }

            return $createdTypes;
        });
    }

    /**
     * Calculate prorated annual entitlement for an employee based on Sri Lankan labor standards.
     */
    public function calculateProratedEntitlement(Employee $employee, LeaveType $leaveType, int $year): float
    {
        if (! $leaveType->is_paid || $leaveType->code === 'NO_PAY') {
            return 0.0;
        }

        $joinDate = $employee->date_of_joining ? Carbon::parse($employee->date_of_joining) : null;

        // If joined in a future year
        if ($joinDate !== null && $joinDate->year > $year) {
            return 0.0;
        }

        // Check if employee falls under Wages Board Ordinance (formula based on actual days worked)
        if ($employee->employment_category === 'wages_board') {
            $wagesBoard = $employee->wagesBoardCategory;

            if ($leaveType->code === 'ANNUAL') {
                if ($wagesBoard !== null) {
                    $startDay = $wagesBoard->entitle_start_day ?? 216;
                    $divisor = $wagesBoard->devided_days_by ?? 4;
                    $maxAnnual = $wagesBoard->max_annual_leave ?? 14;

                    // Compute actual days worked in previous year from attendance ledger
                    $previousYear = $year - 1;
                    $workedDays = AttendanceDaily::where('tenant_id', $employee->tenant_id)
                        ->where('employee_id', $employee->id)
                        ->whereYear('attendance_date', $previousYear)
                        ->whereIn('status', ['present', 'half_day'])
                        ->count();

                    if ($workedDays === 0) {
                        // If no historical records and joined in calculation year, pro-rate by remainder of year
                        if ($joinDate !== null && $joinDate->year === $year) {
                            $remainingDays = max(0, 365 - $joinDate->dayOfYear);
                            $estimatedWorked = (int) round(($remainingDays / 365.0) * $startDay);
                            $excessDays = max(0, $estimatedWorked - $startDay);
                            $calculated = $divisor > 0 ? floor($excessDays / $divisor) : 0;

                            return (float) min($maxAnnual, max(0, $calculated));
                        }

                        return 0.0;
                    }

                    $excessDays = max(0, $workedDays - $startDay);
                    $calculated = $divisor > 0 ? floor($excessDays / $divisor) : 0;

                    return (float) min($maxAnnual, max(0, $calculated));
                }

                return 0.0;
            }

            if ($leaveType->code === 'CASUAL') {
                // Wages Board standard typically does not mandate 7-day casual leave unless specified in category
                return (float) ($wagesBoard->casual_leave_days ?? 0.0);
            }
        }

        // If no joining date or joined before the calculation year under Shop & Office, full standard entitlement
        if ($joinDate === null || $joinDate->year < $year) {
            return (float) $leaveType->days_per_year;
        }

        // Employee joined mid-year in $year under Shop & Office Act:
        if ($leaveType->code === 'ANNUAL') {
            // Under Sri Lankan Shop & Office Employees Act:
            // Quarter 1 (Jan 1 - Mar 31): 14 days
            // Quarter 2 (Apr 1 - Jun 30): 10 days
            // Quarter 3 (Jul 1 - Sep 30): 7 days
            // Quarter 4 (Oct 1 - Dec 31): 4 days
            $month = $joinDate->month;
            if ($month <= 3) {
                return 14.0;
            } elseif ($month <= 6) {
                return 10.0;
            } elseif ($month <= 9) {
                return 7.0;
            } else {
                return 4.0;
            }
        }

        if ($leaveType->code === 'CASUAL') {
            // 1 day for each completed 2 months of service in first year, up to 7
            $remainingMonths = max(0, 12 - $joinDate->month + 1);

            return (float) min(7.0, floor($remainingMonths / 2));
        }

        // General pro-rata based on remaining months
        $remainingMonths = max(0, 12 - $joinDate->month + 1);

        return round(($leaveType->days_per_year / 12.0) * $remainingMonths, 1);
    }

    /**
     * Allocate leave entitlements for all or a specific employee for a given year.
     *
     * @return array{total_allocated: int, year: int}
     */
    public function allocateEntitlements(string $tenantId, int $year, ?string $employeeId = null): array
    {
        return DB::transaction(function () use ($tenantId, $year, $employeeId): array {
            $leaveTypes = LeaveType::where('tenant_id', $tenantId)
                ->where('is_active', true)
                ->get();

            if ($leaveTypes->isEmpty()) {
                $this->seedStatutoryTypes($tenantId);
                $leaveTypes = LeaveType::where('tenant_id', $tenantId)->where('is_active', true)->get();
            }

            $employeesQuery = Employee::where('tenant_id', $tenantId)
                ->where('employment_status', 'active')
                ->with('wagesBoardCategory');

            if ($employeeId !== null) {
                $employeesQuery->where('id', $employeeId);
            }

            $employees = $employeesQuery->get();
            $count = 0;

            foreach ($employees as $employee) {
                foreach ($leaveTypes as $type) {
                    // If gender is male and type is Maternity, skip
                    if ($type->code === 'MATERNITY' && isset($employee->gender) && strtolower((string) $employee->gender) === 'male') {
                        continue;
                    }

                    $allocatedDays = $this->calculateProratedEntitlement($employee, $type, $year);

                    // Check previous year carry forward if allowed
                    $carriedForwardDays = 0.0;
                    if ($type->carry_forward_allowed) {
                        $prevEntitlement = LeaveEntitlement::where('tenant_id', $tenantId)
                            ->where('employee_id', $employee->id)
                            ->where('leave_type_id', $type->id)
                            ->where('year', $year - 1)
                            ->first();

                        if ($prevEntitlement) {
                            $unused = max(0.0, ($prevEntitlement->allocated_days + $prevEntitlement->carried_forward_days) - $prevEntitlement->used_days);
                            $carriedForwardDays = min((float) $type->max_carry_forward_days, $unused);
                        }
                    }

                    LeaveEntitlement::updateOrCreate(
                        [
                            'tenant_id' => $tenantId,
                            'employee_id' => $employee->id,
                            'leave_type_id' => $type->id,
                            'year' => $year,
                        ],
                        [
                            'tenant_id' => $tenantId,
                            'allocated_days' => $allocatedDays,
                            'carried_forward_days' => $carriedForwardDays,
                            'notes' => "Automated entitlement allocation for {$year}",
                        ]
                    );

                    $count++;
                }
            }

            return [
                'total_allocated' => $count,
                'year' => $year,
            ];
        });
    }

    /**
     * Compute working days for a proposed leave span (excluding scheduled rest days & statutory holidays).
     */
    public function calculateLeaveDays(
        string $tenantId,
        Carbon $startDate,
        Carbon $endDate,
        bool $isHalfDay = false,
        ?string $employeeId = null
    ): float {
        if ($isHalfDay) {
            return 0.5;
        }

        if ($startDate->gt($endDate)) {
            return 0.0;
        }

        $holidays = PublicHoliday::where('tenant_id', $tenantId)
            ->whereBetween('holiday_date', [$startDate->toDateString(), $endDate->toDateString()])
            ->pluck('holiday_date')
            ->map(fn ($d) => Carbon::parse($d)->toDateString())
            ->toArray();

        $employee = $employeeId ? Employee::find($employeeId) : null;
        $shiftService = $this->shiftService ?? app(ShiftService::class);

        $days = 0.0;
        $period = CarbonPeriod::create($startDate, $endDate);

        foreach ($period as $date) {
            $dateStr = $date->toDateString();

            // Exclude public holidays
            if (in_array($dateStr, $holidays, true)) {
                continue;
            }

            // Exclude rest day (schedule-aware if employee provided, otherwise default Sunday)
            if ($employee !== null) {
                $schedule = $shiftService->resolveDailySchedule($employee, $date);
                if (($schedule['schedule_type'] ?? '') === 'rest_day' || ! empty($schedule['is_rest_day'])) {
                    continue;
                }
            } elseif ($date->isSunday()) {
                continue;
            }

            $days += 1.0;
        }

        // If span entirely falls on non-working days, return 0.0
        return $days;
    }

    /**
     * Check if a given date and department is covered by a finalized HR lock.
     */
    public function isPeriodLocked(CarbonInterface|string $date, ?string $departmentId, string $tenantId): bool
    {
        $dateStr = $date instanceof CarbonInterface ? $date->toDateString() : (string) $date;

        return AttendancePeriodLock::query()
            ->where('tenant_id', $tenantId)
            ->where('status', AttendancePeriodLock::STATUS_HR_LOCKED)
            ->where('period_start', '<=', $dateStr)
            ->where('period_end', '>=', $dateStr)
            ->where(function ($sub) use ($departmentId): void {
                $sub->whereNull('department_id');
                if ($departmentId !== null) {
                    $sub->orWhere('department_id', $departmentId);
                }
            })
            ->exists();
    }

    /**
     * Validate shift coverage colleague (must be active, cannot be self, cannot have overlapping leave, cannot be on rest day).
     */
    public function validateShiftCoverage(
        Employee $employee,
        string $coveringEmployeeId,
        Carbon $startDate,
        Carbon $endDate,
        string $tenantId
    ): Employee {
        if ($coveringEmployeeId === $employee->id) {
            throw ValidationException::withMessages([
                'covering_employee_id' => ['An employee cannot be designated as their own covering colleague.'],
            ]);
        }

        $coveringEmployee = Employee::where('tenant_id', $tenantId)
            ->where('employment_status', 'active')
            ->findOrFail($coveringEmployeeId);

        // Check if covering employee has any approved/pending leave during proposed dates
        $hasConflictingLeave = LeaveRequest::query()
            ->where('tenant_id', $tenantId)
            ->overlapping($coveringEmployeeId, $startDate->toDateString(), $endDate->toDateString())
            ->exists();

        if ($hasConflictingLeave) {
            throw ValidationException::withMessages([
                'covering_employee_id' => ["Covering employee {$coveringEmployee->full_name} ({$coveringEmployee->emp_no}) has an existing pending or approved leave during this requested period."],
            ]);
        }

        // Check roster / rest day conflicts for covering employee
        $shiftService = $this->shiftService ?? app(ShiftService::class);
        $period = CarbonPeriod::create($startDate, $endDate);

        foreach ($period as $date) {
            $schedule = $shiftService->resolveDailySchedule($coveringEmployee, $date);
            if (($schedule['schedule_type'] ?? '') === 'rest_day' || ! empty($schedule['is_rest_day'])) {
                throw ValidationException::withMessages([
                    'covering_employee_id' => ["Covering employee {$coveringEmployee->full_name} is scheduled for a rest day on {$date->toDateString()} and cannot provide active shift coverage."],
                ]);
            }
        }

        return $coveringEmployee;
    }

    /**
     * Calculate remaining short leaves for an employee in a given calendar month (max 2 per month).
     */
    public function getRemainingMonthlyShortLeaves(string $employeeId, string $tenantId, CarbonInterface|string|null $date = null): int
    {
        $d = $date ? Carbon::parse($date) : Carbon::today();
        $usedCount = LeaveRequest::where('tenant_id', $tenantId)
            ->where('employee_id', $employeeId)
            ->where('is_short_leave', true)
            ->whereYear('start_date', $d->year)
            ->whereMonth('start_date', $d->month)
            ->whereIn('status', ['pending', 'approved'])
            ->count();

        return max(0, 2 - $usedCount);
    }

    /**
     * Credit Compensatory Leave days (C-Off) with standard 90-day expiry.
     */
    public function creditCompensatoryLeave(
        string $tenantId,
        string $employeeId,
        string $earnedDate,
        float $days,
        string $reason,
        ?int $createdByUserId = null
    ): CompensatoryLeaveRecord {
        $earned = Carbon::parse($earnedDate);
        $expiresAt = $earned->copy()->addDays(90);

        return CompensatoryLeaveRecord::create([
            'tenant_id' => $tenantId,
            'employee_id' => $employeeId,
            'earned_date' => $earned->toDateString(),
            'earned_days' => $days,
            'used_days' => 0.00,
            'remaining_days' => $days,
            'expires_at' => $expiresAt->toDateString(),
            'status' => CompensatoryLeaveRecord::STATUS_AVAILABLE,
            'reason' => $reason,
            'created_by' => $createdByUserId,
        ]);
    }

    /**
     * Get available, unexpired Compensatory Off balance for an employee.
     */
    public function getAvailableCompensatoryDays(
        string $employeeId,
        string $tenantId,
        CarbonInterface|string|null $asOfDate = null
    ): float {
        $this->expireOverdueCompensatoryRecords($tenantId);

        return (float) CompensatoryLeaveRecord::where('tenant_id', $tenantId)
            ->forEmployee($employeeId)
            ->available($asOfDate)
            ->sum('remaining_days');
    }

    /**
     * Expire compensatory records that passed their 90-day validity window.
     */
    public function expireOverdueCompensatoryRecords(string $tenantId): int
    {
        return CompensatoryLeaveRecord::where('tenant_id', $tenantId)
            ->where('status', CompensatoryLeaveRecord::STATUS_AVAILABLE)
            ->where('expires_at', '<', Carbon::today()->toDateString())
            ->update(['status' => CompensatoryLeaveRecord::STATUS_EXPIRED]);
    }

    /**
     * Submit a leave application.
     *
     * @param  array<string, mixed>  $data
     */
    public function applyLeave(array $data, string $tenantId, ?User $actor = null): LeaveRequest
    {
        $startDate = Carbon::parse($data['start_date']);
        $endDate = Carbon::parse($data['end_date']);
        $isHalfDay = (bool) ($data['is_half_day'] ?? false);
        $isShortLeave = (bool) ($data['is_short_leave'] ?? false);

        if ($startDate->gt($endDate)) {
            throw ValidationException::withMessages([
                'end_date' => ['The end date cannot be earlier than the start date.'],
            ]);
        }

        $employee = Employee::where('tenant_id', $tenantId)->findOrFail($data['employee_id']);
        $leaveType = LeaveType::where('tenant_id', $tenantId)->findOrFail($data['leave_type_id']);

        // 1. Period Lock check: cannot apply for leaves in HR locked attendance periods
        if ($this->isPeriodLocked($startDate, $employee->department_id, $tenantId) ||
            $this->isPeriodLocked($endDate, $employee->department_id, $tenantId)) {
            throw ValidationException::withMessages([
                'start_date' => ['The attendance/leave period for these dates has been finalized and locked by HR.'],
            ]);
        }

        // 2. Validate shift coverage if covering employee selected
        if (! empty($data['covering_employee_id'])) {
            $this->validateShiftCoverage($employee, (string) $data['covering_employee_id'], $startDate, $endDate, $tenantId);
        }

        // 3. Short Leave handling
        $shortLeaveDurationMinutes = null;
        $shortLeaveFrom = null;
        $shortLeaveTo = null;

        if ($isShortLeave) {
            if ($startDate->toDateString() !== $endDate->toDateString()) {
                throw ValidationException::withMessages([
                    'end_date' => ['Short leave can only be requested for a single date.'],
                ]);
            }

            if (empty($data['short_leave_from']) || empty($data['short_leave_to'])) {
                throw ValidationException::withMessages([
                    'short_leave_from' => ['Both start time and end time are required for a short leave.'],
                ]);
            }

            $shortLeaveFrom = (string) $data['short_leave_from'];
            $shortLeaveTo = (string) $data['short_leave_to'];

            $timeFrom = Carbon::parse("{$startDate->toDateString()} {$shortLeaveFrom}");
            $timeTo = Carbon::parse("{$startDate->toDateString()} {$shortLeaveTo}");

            if ($timeTo->lte($timeFrom)) {
                throw ValidationException::withMessages([
                    'short_leave_to' => ['Short leave end time must be after the start time.'],
                ]);
            }

            $shortLeaveDurationMinutes = (int) $timeFrom->diffInMinutes($timeTo);

            // Industry standard: Max 120 minutes (2 hours) per short leave
            if ($shortLeaveDurationMinutes > 120) {
                throw ValidationException::withMessages([
                    'short_leave_to' => ["Short leave duration cannot exceed 120 minutes (2 hours). Requested: {$shortLeaveDurationMinutes} minutes."],
                ]);
            }

            // Monthly quota: Max 2 short leaves per calendar month
            $remainingShortLeaves = $this->getRemainingMonthlyShortLeaves($employee->id, $tenantId, $startDate);
            if ($remainingShortLeaves <= 0) {
                throw ValidationException::withMessages([
                    'is_short_leave' => ['Monthly short leave quota exceeded. Employees are permitted a maximum of 2 short leaves per calendar month.'],
                ]);
            }

            $daysCount = 0.00; // Zero statutory leave balance deduction
            $isHalfDay = false;
        } else {
            // Check for existing overlapping requests
            $hasOverlap = LeaveRequest::query()
                ->where('tenant_id', $tenantId)
                ->where('is_short_leave', false)
                ->overlapping($employee->id, $startDate->toDateString(), $endDate->toDateString())
                ->exists();

            if ($hasOverlap) {
                throw ValidationException::withMessages([
                    'start_date' => ['The requested dates overlap with an existing pending or approved leave request.'],
                ]);
            }

            // Calculate actual leave days required
            $daysCount = $this->calculateLeaveDays($tenantId, $startDate, $endDate, $isHalfDay, $employee->id);

            if ($daysCount <= 0.0) {
                throw ValidationException::withMessages([
                    'start_date' => ['Selected date range contains no working days (all dates are holidays or rest days).'],
                ]);
            }

            // Check consecutive day limits if configured
            if ($leaveType->max_consecutive_days && $daysCount > $leaveType->max_consecutive_days) {
                throw ValidationException::withMessages([
                    'days_count' => ["{$leaveType->name} cannot exceed {$leaveType->max_consecutive_days} consecutive days."],
                ]);
            }
        }

        // 4. Check entitlement / compensatory balances
        $year = $startDate->year;
        $entitlement = null;

        if (! $isShortLeave) {
            if ($leaveType->code === 'COMPENSATORY') {
                $availableCof = $this->getAvailableCompensatoryDays($employee->id, $tenantId, $startDate);
                if ($availableCof < $daysCount) {
                    throw ValidationException::withMessages([
                        'leave_type_id' => [
                            "Insufficient Compensatory Off balance. Available: {$availableCof} days (valid within 90 days), Requested: {$daysCount} days.",
                        ],
                    ]);
                }
            } elseif ($leaveType->code !== 'NO_PAY') {
                $entitlement = LeaveEntitlement::firstOrCreate(
                    [
                        'tenant_id' => $tenantId,
                        'employee_id' => $employee->id,
                        'leave_type_id' => $leaveType->id,
                        'year' => $year,
                    ],
                    [
                        'allocated_days' => $this->calculateProratedEntitlement($employee, $leaveType, $year),
                        'used_days' => 0.0,
                        'pending_days' => 0.0,
                        'carried_forward_days' => 0.0,
                    ]
                );

                if ($entitlement->remaining_days < $daysCount) {
                    throw ValidationException::withMessages([
                        'leave_type_id' => [
                            "Insufficient leave balance for {$leaveType->name}. Available: {$entitlement->remaining_days} days, Requested: {$daysCount} days.",
                        ],
                    ]);
                }
            }
        }

        // 5. Determine multi-tier routing (HOD vs HR direct)
        $initialStage = LeaveRequest::STAGE_PENDING_HR;
        $hodId = null;

        if ($employee->department_id) {
            $departmentHead = DepartmentHead::where('tenant_id', $tenantId)
                ->where('department_id', $employee->department_id)
                ->with('employee')
                ->first();

            if ($departmentHead && $departmentHead->employee?->email) {
                $hodUser = User::where('email', $departmentHead->employee->email)
                    ->where(function ($q) use ($tenantId): void {
                        $q->where('tenant_id', $tenantId)->orWhereNull('tenant_id');
                    })
                    ->first();

                if ($hodUser && ($hodUser->can('leave.hod_approve') || $hodUser->hasRole(['Supervisor', 'Company Admin', 'Company Owner', 'Super Admin']))) {
                    $initialStage = LeaveRequest::STAGE_PENDING_HOD;
                    $hodId = $hodUser->id;
                }
            }
        }

        return DB::transaction(function () use (
            $data,
            $tenantId,
            $employee,
            $leaveType,
            $startDate,
            $endDate,
            $daysCount,
            $isHalfDay,
            $isShortLeave,
            $shortLeaveFrom,
            $shortLeaveTo,
            $shortLeaveDurationMinutes,
            $initialStage,
            $hodId,
            $entitlement
        ): LeaveRequest {
            $request = LeaveRequest::create([
                'tenant_id' => $tenantId,
                'employee_id' => $employee->id,
                'leave_type_id' => $leaveType->id,
                'start_date' => $startDate->toDateString(),
                'end_date' => $endDate->toDateString(),
                'days_count' => $daysCount,
                'is_half_day' => $isHalfDay,
                'half_day_type' => $isHalfDay ? ($data['half_day_type'] ?? 'first_half') : null,
                'is_short_leave' => $isShortLeave,
                'short_leave_from' => $shortLeaveFrom,
                'short_leave_to' => $shortLeaveTo,
                'short_leave_duration_minutes' => $shortLeaveDurationMinutes,
                'covering_employee_id' => $data['covering_employee_id'] ?? null,
                'reason' => $data['reason'],
                'status' => 'pending',
                'approval_stage' => $initialStage,
                'hod_id' => $hodId,
            ]);

            if ($entitlement !== null) {
                $entitlement->increment('pending_days', $daysCount);
            }

            return $request->load(['employee', 'leaveType', 'coveringEmployee']);
        });
    }

    /**
     * HOD Review & Action (Approve to advance to HR, or Reject).
     */
    public function hodAction(
        LeaveRequest $request,
        User $hodUser,
        string $decision,
        ?string $remarks = null
    ): LeaveRequest {
        if (! $request->isPendingHod()) {
            throw ValidationException::withMessages([
                'status' => ['Only leave requests awaiting HOD recommendation can be actioned at this stage.'],
            ]);
        }

        if ($decision === 'approve') {
            $request->update([
                'approval_stage' => LeaveRequest::STAGE_PENDING_HR,
                'hod_id' => $hodUser->id,
                'hod_actioned_at' => now(),
                'hod_remarks' => $remarks,
            ]);

            return $request->load(['employee', 'leaveType', 'hod', 'actionedBy']);
        }

        if ($decision === 'reject') {
            return $this->rejectLeave($request, $hodUser, $remarks ?? 'Declined by Department Head.');
        }

        throw ValidationException::withMessages([
            'decision' => ['Invalid action decision. Must be approve or reject.'],
        ]);
    }

    /**
     * Approve a leave request (HR final approval or direct HR bypass).
     */
    public function approveLeave(LeaveRequest $request, User $approver, bool $isDirectBypass = false): LeaveRequest
    {
        if ($request->status !== 'pending') {
            throw ValidationException::withMessages([
                'status' => ['Only pending leave requests can be approved.'],
            ]);
        }

        return DB::transaction(function () use ($request, $approver, $isDirectBypass): LeaveRequest {
            $year = Carbon::parse($request->start_date)->year;
            $isBypassed = $isDirectBypass || $request->isPendingHod();

            // 1. Update entitlement or compensatory balance
            if (! $request->is_short_leave) {
                if ($request->leaveType->code === 'COMPENSATORY') {
                    // FIFO deduction from available compensatory leave records
                    $records = CompensatoryLeaveRecord::where('tenant_id', $request->tenant_id)
                        ->where('employee_id', $request->employee_id)
                        ->available($request->start_date)
                        ->orderBy('earned_date', 'asc')
                        ->get();

                    $remainingToDeduct = $request->days_count;
                    foreach ($records as $record) {
                        if ($remainingToDeduct <= 0.0) {
                            break;
                        }
                        $deduct = min($record->remaining_days, $remainingToDeduct);
                        $record->remaining_days = max(0.0, $record->remaining_days - $deduct);
                        $record->used_days += $deduct;
                        if ($record->remaining_days <= 0.001) {
                            $record->status = CompensatoryLeaveRecord::STATUS_USED;
                        }
                        $record->leave_request_id = $request->id;
                        $record->save();
                        $remainingToDeduct -= $deduct;
                    }
                } elseif ($request->leaveType->code !== 'NO_PAY') {
                    $entitlement = LeaveEntitlement::where('tenant_id', $request->tenant_id)
                        ->where('employee_id', $request->employee_id)
                        ->where('leave_type_id', $request->leave_type_id)
                        ->where('year', $year)
                        ->first();

                    if ($entitlement) {
                        $entitlement->pending_days = max(0.0, $entitlement->pending_days - $request->days_count);
                        $entitlement->used_days += $request->days_count;
                        $entitlement->save();
                    }
                }
            }

            $request->update([
                'status' => 'approved',
                'approval_stage' => LeaveRequest::STAGE_APPROVED,
                'is_bypassed_by_hr' => $isBypassed,
                'actioned_by' => $approver->id,
                'actioned_at' => now(),
            ]);

            // Sync with Attendance Daily Ledger
            $this->syncAttendanceLedgerForLeave($request);

            return $request->load(['employee', 'leaveType', 'coveringEmployee', 'actionedBy', 'hod']);
        });
    }

    /**
     * Reject a pending leave request.
     */
    public function rejectLeave(LeaveRequest $request, User $actor, string $reason): LeaveRequest
    {
        if ($request->status !== 'pending') {
            throw ValidationException::withMessages([
                'status' => ['Only pending leave requests can be rejected.'],
            ]);
        }

        return DB::transaction(function () use ($request, $actor, $reason): LeaveRequest {
            $year = Carbon::parse($request->start_date)->year;

            if (! $request->is_short_leave && $request->leaveType->code !== 'NO_PAY' && $request->leaveType->code !== 'COMPENSATORY') {
                $entitlement = LeaveEntitlement::where('tenant_id', $request->tenant_id)
                    ->where('employee_id', $request->employee_id)
                    ->where('leave_type_id', $request->leave_type_id)
                    ->where('year', $year)
                    ->first();

                if ($entitlement) {
                    $entitlement->pending_days = max(0.0, $entitlement->pending_days - $request->days_count);
                    $entitlement->save();
                }
            }

            $request->update([
                'status' => 'rejected',
                'approval_stage' => LeaveRequest::STAGE_REJECTED,
                'actioned_by' => $actor->id,
                'actioned_at' => now(),
                'rejection_reason' => $reason,
            ]);

            return $request->load(['employee', 'leaveType', 'coveringEmployee', 'actionedBy', 'hod']);
        });
    }

    /**
     * Cancel an existing leave request.
     */
    public function cancelLeave(LeaveRequest $request, User $actor): LeaveRequest
    {
        if (! in_array($request->status, ['pending', 'approved'], true)) {
            throw ValidationException::withMessages([
                'status' => ['Only pending or approved leave requests can be cancelled.'],
            ]);
        }

        return DB::transaction(function () use ($request, $actor): LeaveRequest {
            $year = Carbon::parse($request->start_date)->year;
            $wasApproved = $request->status === 'approved';

            if (! $request->is_short_leave) {
                if ($request->leaveType->code === 'COMPENSATORY') {
                    if ($wasApproved) {
                        // Restore deducted compensatory records
                        $records = CompensatoryLeaveRecord::where('leave_request_id', $request->id)->get();
                        foreach ($records as $record) {
                            $record->remaining_days += $record->used_days;
                            $record->used_days = 0.00;
                            $record->status = CompensatoryLeaveRecord::STATUS_AVAILABLE;
                            $record->leave_request_id = null;
                            $record->save();
                        }
                    }
                } elseif ($request->leaveType->code !== 'NO_PAY') {
                    $entitlement = LeaveEntitlement::where('tenant_id', $request->tenant_id)
                        ->where('employee_id', $request->employee_id)
                        ->where('leave_type_id', $request->leave_type_id)
                        ->where('year', $year)
                        ->first();

                    if ($entitlement) {
                        if ($wasApproved) {
                            $entitlement->used_days = max(0.0, $entitlement->used_days - $request->days_count);
                        } else {
                            $entitlement->pending_days = max(0.0, $entitlement->pending_days - $request->days_count);
                        }
                        $entitlement->save();
                    }
                }
            }

            $request->update([
                'status' => 'cancelled',
                'approval_stage' => LeaveRequest::STAGE_CANCELLED,
                'actioned_by' => $actor->id,
                'actioned_at' => now(),
            ]);

            // If was approved, recalculate attendance daily records accurately instead of deleting
            if ($wasApproved) {
                $attendanceProcessingService = app(AttendanceProcessingService::class);
                $period = CarbonPeriod::create(
                    Carbon::parse($request->start_date),
                    Carbon::parse($request->end_date)
                );

                foreach ($period as $date) {
                    $attendanceProcessingService->processDate($date, $request->employee_id, null, true);
                }
            }

            return $request->load(['employee', 'leaveType', 'coveringEmployee', 'actionedBy', 'hod']);
        });
    }

    /**
     * Reflect approved leave in the Daily Attendance Ledger.
     */
    public function syncAttendanceLedgerForLeave(LeaveRequest $request): void
    {
        $request->loadMissing(['employee', 'leaveType']);

        // Handle short leave: waive lateness penalty & annotate calculation breakdown without replacing full day
        if ($request->is_short_leave) {
            $dateStr = Carbon::parse($request->start_date)->toDateString();
            $existing = AttendanceDaily::where('tenant_id', $request->tenant_id)
                ->where('employee_id', $request->employee_id)
                ->whereDate('attendance_date', $dateStr)
                ->first();

            $shortLeaveMinutes = $request->short_leave_duration_minutes ?? 0;
            $breakdown = $existing?->calculation_breakdown ?? [];
            if (! is_array($breakdown)) {
                $breakdown = [];
            }
            $breakdown['short_leave'] = [
                'leave_request_id' => $request->id,
                'duration_minutes' => $shortLeaveMinutes,
                'short_leave_from' => $request->short_leave_from,
                'short_leave_to' => $request->short_leave_to,
                'notes' => 'Approved Short Leave (Lateness/Early departure penalty waived)',
            ];

            if ($existing) {
                $existing->late_minutes = max(0, (int) ($existing->late_minutes ?? 0) - $shortLeaveMinutes);
                $existing->early_departure_minutes = max(0, (int) ($existing->early_departure_minutes ?? 0) - $shortLeaveMinutes);
                $existing->calculation_breakdown = $breakdown;
                $existing->save();
            } else {
                AttendanceDaily::create([
                    'tenant_id' => $request->tenant_id,
                    'employee_id' => $request->employee_id,
                    'attendance_date' => $dateStr,
                    'status' => 'present',
                    'worked_hours' => 0.00,
                    'regular_hours' => 0.00,
                    'late_minutes' => 0,
                    'early_departure_minutes' => 0,
                    'ot_hours' => 0.00,
                    'double_ot_hours' => 0.00,
                    'is_manual' => false,
                    'calculation_breakdown' => $breakdown,
                ]);
            }

            return;
        }

        $period = CarbonPeriod::create(
            Carbon::parse($request->start_date),
            Carbon::parse($request->end_date)
        );

        $holidays = PublicHoliday::where('tenant_id', $request->tenant_id)
            ->whereBetween('holiday_date', [$request->start_date, $request->end_date])
            ->pluck('holiday_date')
            ->toArray();

        $shiftService = $this->shiftService ?? app(ShiftService::class);

        foreach ($period as $date) {
            $dateStr = $date->toDateString();

            // Skip Public Holidays
            if (in_array($dateStr, $holidays, true)) {
                continue;
            }

            // Skip rest day for this employee (otherwise default Sunday)
            if ($request->employee !== null) {
                $schedule = $shiftService->resolveDailySchedule($request->employee, $date);
                if (($schedule['schedule_type'] ?? '') === 'rest_day' || ! empty($schedule['is_rest_day'])) {
                    continue;
                }
            } elseif ($date->isSunday()) {
                continue;
            }

            $status = $request->is_half_day ? 'half_day' : 'leave';

            $existing = AttendanceDaily::where('tenant_id', $request->tenant_id)
                ->where('employee_id', $request->employee_id)
                ->whereDate('attendance_date', $dateStr)
                ->first();

            $data = [
                'tenant_id' => $request->tenant_id,
                'status' => $status,
                'worked_hours' => $request->is_half_day ? 4.00 : 0.00,
                'regular_hours' => $request->is_half_day ? 4.00 : 0.00,
                'late_minutes' => 0,
                'early_departure_minutes' => 0,
                'ot_hours' => 0.00,
                'double_ot_hours' => 0.00,
                'is_manual' => false,
                'calculation_breakdown' => [
                    'leave_type' => $request->leaveType?->name,
                    'leave_type_code' => $request->leaveType?->code,
                    'leave_request_id' => $request->id,
                    'is_paid' => (bool) ($request->leaveType?->is_paid ?? true),
                    'is_half_day' => (bool) $request->is_half_day,
                    'half_day_type' => $request->half_day_type,
                    'notes' => "Approved {$request->leaveType?->name}",
                ],
            ];

            if ($existing) {
                $existing->update($data);
            } else {
                AttendanceDaily::create(array_merge($data, [
                    'employee_id' => $request->employee_id,
                    'attendance_date' => $dateStr,
                ]));
            }
        }
    }
}
