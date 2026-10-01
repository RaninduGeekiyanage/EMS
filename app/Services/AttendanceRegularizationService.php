<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\AttendanceDaily;
use App\Models\AttendancePeriodLock;
use App\Models\AttendanceRegularizationRequest;
use App\Models\DepartmentHead;
use App\Models\Employee;
use App\Models\LeaveEntitlement;
use App\Models\LeaveRequest;
use App\Models\LeaveType;
use App\Models\User;
use Carbon\Carbon;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

final class AttendanceRegularizationService
{
    public function __construct(
        private readonly AttendanceProcessingService $processingService,
        private readonly LeaveService $leaveService,
    ) {}

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
     * Submit an attendance regularization request with anti-overlap and cut-off checks.
     *
     * @param  array<string, mixed>  $data
     */
    public function submitRegularization(array $data, Employee $employee, User $actor): AttendanceRegularizationRequest
    {
        $tenantId = $employee->tenant_id;
        $attendanceDate = Carbon::parse($data['attendance_date']);

        if ($attendanceDate->isFuture()) {
            throw ValidationException::withMessages([
                'attendance_date' => ['Cannot submit attendance regularization for future dates.'],
            ]);
        }

        // 1. Cut-off freeze validation
        if ($this->isPeriodLocked($attendanceDate, $employee->department_id, $tenantId)) {
            throw ValidationException::withMessages([
                'attendance_date' => ['The attendance period for this date has been finalized and locked by HR. No adjustments can be submitted.'],
            ]);
        }

        // 2. Anti-overlap validation
        $existing = AttendanceRegularizationRequest::where('tenant_id', $tenantId)
            ->where('employee_id', $employee->id)
            ->where('attendance_date', $attendanceDate->toDateString())
            ->whereIn('status', [
                AttendanceRegularizationRequest::STATUS_PENDING_HOD,
                AttendanceRegularizationRequest::STATUS_PENDING_HR,
                AttendanceRegularizationRequest::STATUS_APPROVED,
            ])
            ->exists();

        if ($existing) {
            throw ValidationException::withMessages([
                'attendance_date' => ['A pending or approved regularization request already exists for this employee on this date.'],
            ]);
        }

        // 3. Time validation
        $checkIn = ! empty($data['requested_check_in']) ? Carbon::parse($data['requested_check_in']) : null;
        $checkOut = ! empty($data['requested_check_out']) ? Carbon::parse($data['requested_check_out']) : null;

        if ($checkIn && $checkOut && $checkOut->lte($checkIn)) {
            throw ValidationException::withMessages([
                'requested_check_out' => ['Requested check-out time must be after check-in time.'],
            ]);
        }

        // 4. Determine initial approval stage (HOD routing vs Direct HR routing)
        $initialStatus = AttendanceRegularizationRequest::STATUS_PENDING_HR;
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

                if ($hodUser && ($hodUser->can('attendance.hod_approve_regularization') || $hodUser->hasRole(['Supervisor', 'Company Admin', 'Company Owner', 'Super Admin']))) {
                    $initialStatus = AttendanceRegularizationRequest::STATUS_PENDING_HOD;
                }
            }
        }

        return AttendanceRegularizationRequest::create([
            'tenant_id' => $tenantId,
            'employee_id' => $employee->id,
            'attendance_date' => $attendanceDate->toDateString(),
            'request_type' => $data['request_type'],
            'requested_check_in' => $checkIn?->toDateTimeString(),
            'requested_check_out' => $checkOut?->toDateTimeString(),
            'reason' => $data['reason'],
            'attachment_path' => $data['attachment_path'] ?? null,
            'status' => $initialStatus,
        ]);
    }

    /**
     * HOD Review & Action (Approve to advance to HR, or Reject).
     */
    public function actionByHod(
        AttendanceRegularizationRequest $request,
        User $hodUser,
        string $decision,
        ?string $remarks = null
    ): AttendanceRegularizationRequest {
        if (! $request->isPendingHod()) {
            throw ValidationException::withMessages([
                'status' => ['Only requests pending HOD review can be actioned at this stage.'],
            ]);
        }

        if ($decision === 'approve') {
            $request->update([
                'status' => AttendanceRegularizationRequest::STATUS_PENDING_HR,
                'hod_id' => $hodUser->id,
                'hod_actioned_at' => now(),
                'hod_remarks' => $remarks,
            ]);
        } else {
            $request->update([
                'status' => AttendanceRegularizationRequest::STATUS_REJECTED,
                'hod_id' => $hodUser->id,
                'hod_actioned_at' => now(),
                'hod_remarks' => $remarks,
                'rejection_reason' => $remarks ?? 'Rejected by Department Head',
            ]);
        }

        return $request->fresh();
    }

    /**
     * HR Review, Confirmation or Direct Bypass.
     */
    public function actionByHr(
        AttendanceRegularizationRequest $request,
        User $hrUser,
        string $decision,
        ?string $remarks = null,
        bool $isBypass = false
    ): AttendanceRegularizationRequest {
        if (! $request->canBeActionedByHr()) {
            throw ValidationException::withMessages([
                'status' => ['This request has already been finalized.'],
            ]);
        }

        $wasPendingHod = $request->isPendingHod();
        $isActualBypass = $isBypass || $wasPendingHod;

        return DB::transaction(function () use ($request, $hrUser, $decision, $remarks, $isActualBypass): AttendanceRegularizationRequest {
            if ($decision === 'approve') {
                $request->update([
                    'status' => AttendanceRegularizationRequest::STATUS_APPROVED,
                    'hr_id' => $hrUser->id,
                    'hr_actioned_at' => now(),
                    'is_bypassed_by_hr' => $isActualBypass,
                ]);

                // Synchronize punch ledger & daily attendance
                $this->syncPunchLedgerForApprovedRegularization($request, $hrUser);
            } else {
                $request->update([
                    'status' => AttendanceRegularizationRequest::STATUS_REJECTED,
                    'hr_id' => $hrUser->id,
                    'hr_actioned_at' => now(),
                    'is_bypassed_by_hr' => $isActualBypass,
                    'rejection_reason' => $remarks ?? 'Rejected by HR',
                ]);
            }

            return $request->fresh();
        });
    }

    /**
     * Synchronize approved regularization data into attendance_daily record.
     */
    public function syncPunchLedgerForApprovedRegularization(
        AttendanceRegularizationRequest $request,
        User $hrUser
    ): AttendanceDaily {
        $daily = AttendanceDaily::firstOrCreate(
            [
                'tenant_id' => $request->tenant_id,
                'employee_id' => $request->employee_id,
                'attendance_date' => Carbon::parse($request->attendance_date)->toDateString(),
            ],
            [
                'status' => 'present',
                'worked_hours' => 0.00,
                'regular_hours' => 0.00,
                'late_minutes' => 0,
                'early_departure_minutes' => 0,
                'ot_hours' => 0.00,
                'double_ot_hours' => 0.00,
                'is_paid' => true,
                'is_manual' => true,
            ]
        );

        $adjustData = [
            'status' => 'present',
            'manual_reason' => sprintf(
                'Regularization approved (#%s, Type: %s): %s',
                $request->id,
                $request->request_type,
                $request->reason
            ),
        ];

        if ($request->requested_check_in) {
            $adjustData['check_in'] = $request->requested_check_in;
        }
        if ($request->requested_check_out) {
            $adjustData['check_out'] = $request->requested_check_out;
        }

        // Adjust record and recompute stats
        $updatedDaily = $this->processingService->adjustDailyRecord($daily, $adjustData, $hrUser);

        // Filter out resolved anomalies and ensure is_paid is true
        $filteredAnomalies = array_filter(
            $updatedDaily->anomalies ?? [],
            fn ($a) => ! in_array($a['type'] ?? '', ['MISSING_PUNCH', 'UNAPPROVED_HALF_DAY'], true)
        );

        $updatedDaily->update([
            'is_paid' => true,
            'anomalies' => array_values($filteredAnomalies),
        ]);

        return $updatedDaily;
    }

    /**
     * Granular Overtime (OT) Approval (M04-A06).
     */
    public function approveOvertime(
        AttendanceDaily $daily,
        User $actor,
        string $mode,
        ?float $approvedOt = null,
        ?float $approvedDoubleOt = null,
        ?string $remarks = null
    ): AttendanceDaily {
        $tenantId = $daily->tenant_id;
        $date = Carbon::parse($daily->attendance_date);

        if ($this->isPeriodLocked($date, $daily->employee?->department_id, $tenantId)) {
            throw ValidationException::withMessages([
                'attendance_date' => ['Cannot adjust overtime: Period is locked by HR.'],
            ]);
        }

        $rawOt = (float) $daily->ot_hours;
        $rawDoubleOt = (float) $daily->double_ot_hours;

        $finalApprovedOt = 0.00;
        $finalApprovedDoubleOt = 0.00;

        if ($mode === 'approve_all') {
            $finalApprovedOt = $rawOt;
            $finalApprovedDoubleOt = $rawDoubleOt;
        } elseif ($mode === 'partial') {
            $finalApprovedOt = max(0.00, (float) ($approvedOt ?? 0.00));
            $finalApprovedDoubleOt = max(0.00, (float) ($approvedDoubleOt ?? 0.00));

            if ($finalApprovedOt > $rawOt || $finalApprovedDoubleOt > $rawDoubleOt) {
                if (empty($remarks)) {
                    throw ValidationException::withMessages([
                        'remarks' => ['Justification remarks are mandatory when approving OT exceeding recorded biometric hours.'],
                    ]);
                }
            }
        } elseif ($mode === 'reject') {
            $finalApprovedOt = 0.00;
            $finalApprovedDoubleOt = 0.00;
        } else {
            throw ValidationException::withMessages([
                'mode' => ['Invalid overtime approval mode.'],
            ]);
        }

        // Determine if HR final confirmation vs HOD recommendation
        $isHr = $actor->can('attendance.hr_confirm_ot')
            || $actor->can('hr.bypass_all')
            || $actor->hasRole(['HR Manager', 'Company Owner', 'Company Admin', 'Super Admin'])
            || $actor->isSuperAdmin();

        $status = $mode === 'reject'
            ? 'rejected'
            : ($isHr ? 'hr_confirmed' : 'hod_approved');

        $daily->update([
            'approved_ot_hours' => $finalApprovedOt,
            'approved_double_ot_hours' => $finalApprovedDoubleOt,
            'ot_approval_status' => $status,
            'ot_approved_by' => $actor->id,
            'ot_approval_remarks' => $remarks,
        ]);

        return $daily->fresh(['otApprover']);
    }

    /**
     * Resolve Unapproved Half-Day Anomaly (M04-A07).
     * Mechanisms:
     * - 'paid_waiver': Managerial discretion paid waiver
     * - 'retro_leave': Convert to retroactive Half-Day Leave
     * - 'no_pay': Confirm as unapproved / no-pay
     *
     * @param  array<string, mixed>  $params
     */
    public function resolveUnapprovedHalfDay(
        AttendanceDaily $daily,
        User $actor,
        string $mechanism,
        array $params = []
    ): AttendanceDaily {
        $tenantId = $daily->tenant_id;
        $date = Carbon::parse($daily->attendance_date);

        if ($this->isPeriodLocked($date, $daily->employee?->department_id, $tenantId)) {
            throw ValidationException::withMessages([
                'attendance_date' => ['Period is locked by HR. Cannot modify attendance anomalies.'],
            ]);
        }

        return DB::transaction(function () use ($daily, $actor, $mechanism, $params, $date): AttendanceDaily {
            $anomalies = array_filter(
                $daily->anomalies ?? [],
                fn ($a) => ($a['type'] ?? '') !== 'UNAPPROVED_HALF_DAY'
            );

            if ($mechanism === 'paid_waiver') {
                $justification = $params['justification'] ?? 'Managerial discretion paid waiver granted';
                $daily->update([
                    'is_paid' => true,
                    'is_manual' => true,
                    'manual_reason' => sprintf('Paid Half-Day Waiver by %s: %s', $actor->name, $justification),
                    'manual_edited_by' => $actor->id,
                    'anomalies' => array_values($anomalies),
                    'calculation_breakdown' => array_merge($daily->calculation_breakdown ?? [], [
                        'is_paid' => true,
                        'paid_half_day_waiver' => [
                            'granted_by' => $actor->name,
                            'granted_at' => now()->toIso8601String(),
                            'justification' => $justification,
                        ],
                    ]),
                ]);
            } elseif ($mechanism === 'retro_leave') {
                $leaveTypeId = $params['leave_type_id'] ?? null;
                if (! $leaveTypeId) {
                    throw ValidationException::withMessages([
                        'leave_type_id' => ['A valid leave type is required to convert to retroactive leave.'],
                    ]);
                }

                $leaveType = LeaveType::where('tenant_id', $daily->tenant_id)->findOrFail($leaveTypeId);
                $year = $date->year;

                // Create approved half-day leave request
                $leaveRequest = LeaveRequest::create([
                    'tenant_id' => $daily->tenant_id,
                    'employee_id' => $daily->employee_id,
                    'leave_type_id' => $leaveType->id,
                    'start_date' => $daily->attendance_date,
                    'end_date' => $daily->attendance_date,
                    'days_count' => 0.5,
                    'is_half_day' => true,
                    'half_day_type' => 'second_half',
                    'reason' => 'Retroactive conversion for unapproved half-day: ' . ($params['justification'] ?? 'HR conversion'),
                    'status' => 'approved',
                    'actioned_by' => $actor->id,
                    'actioned_at' => now(),
                ]);

                // Update entitlement
                if ($leaveType->code !== 'NO_PAY') {
                    $entitlement = LeaveEntitlement::where('tenant_id', $daily->tenant_id)
                        ->where('employee_id', $daily->employee_id)
                        ->where('leave_type_id', $leaveType->id)
                        ->where('year', $year)
                        ->first();

                    if ($entitlement) {
                        $entitlement->used_days += 0.5;
                        $entitlement->save();
                    }
                }

                $daily->update([
                    'status' => 'half_day',
                    'is_paid' => (bool) $leaveType->is_paid,
                    'is_manual' => true,
                    'manual_reason' => sprintf('Converted to 0.5 %s leave by %s', $leaveType->name, $actor->name),
                    'manual_edited_by' => $actor->id,
                    'anomalies' => array_values($anomalies),
                    'calculation_breakdown' => array_merge($daily->calculation_breakdown ?? [], [
                        'is_paid' => (bool) $leaveType->is_paid,
                        'retroactive_leave_id' => $leaveRequest->id,
                        'leave_type' => $leaveType->name,
                    ]),
                ]);
            } elseif ($mechanism === 'no_pay') {
                $daily->update([
                    'is_paid' => false,
                    'status' => 'half_day',
                    'is_manual' => true,
                    'manual_reason' => sprintf('Confirmed as Unpaid Half Day by %s: %s', $actor->name, $params['justification'] ?? 'No-Pay confirmed'),
                    'manual_edited_by' => $actor->id,
                    'anomalies' => array_values($anomalies),
                    'calculation_breakdown' => array_merge($daily->calculation_breakdown ?? [], [
                        'is_paid' => false,
                        'no_pay_confirmed_by' => $actor->name,
                        'no_pay_confirmed_at' => now()->toIso8601String(),
                    ]),
                ]);
            }

            return $daily->fresh();
        });
    }

    /**
     * Freeze, Sign-Off, or Lock Monthly Attendance Period (M04-A09).
     */
    public function freezePeriod(
        string $tenantId,
        int $year,
        int $month,
        ?string $departmentId,
        User $actor,
        string $action,
        ?string $notes = null
    ): AttendancePeriodLock {
        $periodStart = Carbon::createFromDate($year, $month, 1)->startOfMonth();
        $periodEnd = $periodStart->copy()->endOfMonth();

        $lock = AttendancePeriodLock::firstOrCreate(
            [
                'tenant_id' => $tenantId,
                'year' => $year,
                'month' => $month,
                'department_id' => $departmentId,
            ],
            [
                'period_start' => $periodStart->toDateString(),
                'period_end' => $periodEnd->toDateString(),
                'status' => AttendancePeriodLock::STATUS_OPEN,
            ]
        );

        if ($action === 'hod_sign_off') {
            if ($lock->isLocked()) {
                throw ValidationException::withMessages([
                    'status' => ['Period is already locked by HR.'],
                ]);
            }

            $lock->update([
                'status' => AttendancePeriodLock::STATUS_HOD_SIGNED_OFF,
                'hod_signed_off_by' => $actor->id,
                'hod_signed_off_at' => now(),
                'notes' => $notes ?? $lock->notes,
            ]);
        } elseif ($action === 'hr_lock') {
            $lock->update([
                'status' => AttendancePeriodLock::STATUS_HR_LOCKED,
                'hr_locked_by' => $actor->id,
                'hr_locked_at' => now(),
                'notes' => $notes ?? $lock->notes,
            ]);
        } elseif ($action === 'unlock') {
            // Only Super Admin or Company Owner can unlock
            if (! $actor->hasRole(['Company Owner', 'Super Admin']) && ! $actor->isSuperAdmin()) {
                throw ValidationException::withMessages([
                    'action' => ['Only Company Owner or Super Admin has authorization to unlock a finalized attendance period.'],
                ]);
            }

            $lock->update([
                'status' => AttendancePeriodLock::STATUS_OPEN,
                'notes' => sprintf('Unlocked by %s: %s', $actor->name, $notes ?? 'Administrative unlock'),
            ]);
        }

        return $lock->fresh(['department', 'hodUser', 'hrUser']);
    }
}
