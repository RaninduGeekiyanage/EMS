<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\AttendanceDaily;
use App\Models\Employee;
use App\Models\LeaveEntitlement;
use App\Models\LeaveRequest;
use App\Models\LeaveType;
use App\Models\PublicHoliday;
use App\Models\User;
use Carbon\Carbon;
use Carbon\CarbonPeriod;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

final class LeaveService
{
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
    ];

    /**
     * Seed Sri Lankan statutory leave types for a tenant.
     *
     * @return Collection<int, LeaveType>
     */
    public function seedStatutoryTypes(string $tenantId): Collection
    {
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

        // If no joining date or joined before the calculation year, full standard entitlement
        if ($joinDate === null || $joinDate->year < $year) {
            return (float) $leaveType->days_per_year;
        }

        // If joined in a future year
        if ($joinDate->year > $year) {
            return 0.0;
        }

        // Employee joined mid-year in $year:
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
        $leaveTypes = LeaveType::where('tenant_id', $tenantId)
            ->where('is_active', true)
            ->get();

        if ($leaveTypes->isEmpty()) {
            $this->seedStatutoryTypes($tenantId);
            $leaveTypes = LeaveType::where('tenant_id', $tenantId)->where('is_active', true)->get();
        }

        $employeesQuery = Employee::where('tenant_id', $tenantId)
            ->where('employment_status', 'active');

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
    }

    /**
     * Compute working days for a proposed leave span (excluding Sundays & statutory holidays).
     */
    public function calculateLeaveDays(
        string $tenantId,
        Carbon $startDate,
        Carbon $endDate,
        bool $isHalfDay = false
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

        $days = 0.0;
        $period = CarbonPeriod::create($startDate, $endDate);

        foreach ($period as $date) {
            // Exclude Sunday rest day
            if ($date->isSunday()) {
                continue;
            }

            // Exclude public holidays
            if (in_array($date->toDateString(), $holidays, true)) {
                continue;
            }

            $days += 1.0;
        }

        // If span entirely falls on non-working days, return 0.0
        return $days;
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

        if ($startDate->gt($endDate)) {
            throw ValidationException::withMessages([
                'end_date' => ['The end date cannot be earlier than the start date.'],
            ]);
        }

        $employee = Employee::where('tenant_id', $tenantId)->findOrFail($data['employee_id']);
        $leaveType = LeaveType::where('tenant_id', $tenantId)->findOrFail($data['leave_type_id']);

        // Check for existing overlapping requests
        $hasOverlap = LeaveRequest::query()
            ->where('tenant_id', $tenantId)
            ->overlapping($employee->id, $startDate->toDateString(), $endDate->toDateString())
            ->exists();

        if ($hasOverlap) {
            throw ValidationException::withMessages([
                'start_date' => ['The requested dates overlap with an existing pending or approved leave request.'],
            ]);
        }

        // Calculate actual leave days required
        $daysCount = $this->calculateLeaveDays($tenantId, $startDate, $endDate, $isHalfDay);

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

        // Check entitlement balance for paid leave types
        $year = $startDate->year;
        $entitlement = null;

        if ($leaveType->code !== 'NO_PAY') {
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

        return DB::transaction(function () use ($data, $tenantId, $employee, $leaveType, $startDate, $endDate, $daysCount, $isHalfDay, $entitlement): LeaveRequest {
            $request = LeaveRequest::create([
                'tenant_id' => $tenantId,
                'employee_id' => $employee->id,
                'leave_type_id' => $leaveType->id,
                'start_date' => $startDate->toDateString(),
                'end_date' => $endDate->toDateString(),
                'days_count' => $daysCount,
                'is_half_day' => $isHalfDay,
                'half_day_type' => $isHalfDay ? ($data['half_day_type'] ?? 'first_half') : null,
                'reason' => $data['reason'],
                'status' => 'pending',
            ]);

            if ($entitlement !== null) {
                $entitlement->increment('pending_days', $daysCount);
            }

            return $request->load(['employee', 'leaveType']);
        });
    }

    /**
     * Approve a pending leave request.
     */
    public function approveLeave(LeaveRequest $request, User $approver): LeaveRequest
    {
        if ($request->status !== 'pending') {
            throw ValidationException::withMessages([
                'status' => ['Only pending leave requests can be approved.'],
            ]);
        }

        return DB::transaction(function () use ($request, $approver): LeaveRequest {
            $year = Carbon::parse($request->start_date)->year;

            // Update entitlement: shift pending to used
            if ($request->leaveType->code !== 'NO_PAY') {
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

            $request->update([
                'status' => 'approved',
                'actioned_by' => $approver->id,
                'actioned_at' => now(),
            ]);

            // Sync with Attendance Daily Ledger
            $this->syncAttendanceLedgerForLeave($request);

            return $request->load(['employee', 'leaveType', 'actionedBy']);
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

            if ($request->leaveType->code !== 'NO_PAY') {
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
                'actioned_by' => $actor->id,
                'actioned_at' => now(),
                'rejection_reason' => $reason,
            ]);

            return $request->load(['employee', 'leaveType', 'actionedBy']);
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

            if ($request->leaveType->code !== 'NO_PAY') {
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

            $request->update([
                'status' => 'cancelled',
                'actioned_by' => $actor->id,
                'actioned_at' => now(),
            ]);

            // If was approved, revert any attendance daily records marked as leave
            if ($wasApproved) {
                AttendanceDaily::where('tenant_id', $request->tenant_id)
                    ->where('employee_id', $request->employee_id)
                    ->whereBetween('attendance_date', [$request->start_date, $request->end_date])
                    ->where('status', 'leave')
                    ->where('calculation_breakdown->leave_request_id', $request->id)
                    ->delete();
            }

            return $request->load(['employee', 'leaveType', 'actionedBy']);
        });
    }

    /**
     * Reflect approved leave in the Daily Attendance Ledger.
     */
    public function syncAttendanceLedgerForLeave(LeaveRequest $request): void
    {
        $period = CarbonPeriod::create(
            Carbon::parse($request->start_date),
            Carbon::parse($request->end_date)
        );

        $holidays = PublicHoliday::where('tenant_id', $request->tenant_id)
            ->whereBetween('holiday_date', [$request->start_date, $request->end_date])
            ->pluck('holiday_date')
            ->toArray();

        foreach ($period as $date) {
            $dateStr = $date->toDateString();

            // Skip Sundays and Public Holidays
            if ($date->isSunday() || in_array($dateStr, $holidays, true)) {
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
                    'leave_type' => $request->leaveType->name,
                    'leave_type_code' => $request->leaveType->code,
                    'leave_request_id' => $request->id,
                    'is_paid' => $request->leaveType->is_paid,
                    'is_half_day' => $request->is_half_day,
                    'half_day_type' => $request->half_day_type,
                    'notes' => "Approved {$request->leaveType->name}",
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
