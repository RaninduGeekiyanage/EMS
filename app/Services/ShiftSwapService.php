<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\DepartmentHead;
use App\Models\Employee;
use App\Models\LeaveRequest;
use App\Models\RosterEntry;
use App\Models\Shift;
use App\Models\ShiftSwapRequest;
use App\Models\User;
use Carbon\Carbon;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

final class ShiftSwapService
{
    public function __construct(
        private readonly RosterService $rosterService,
        private readonly ShiftService $shiftService,
    ) {}

    /**
     * Submit a shift swap request (or execute immediately if auto_approve is requested by authorized manager).
     *
     * @param  array<string, mixed>  $data
     */
    public function requestSwap(array $data, string $tenantId, ?User $proposer = null): ShiftSwapRequest
    {
        return DB::transaction(function () use ($data, $tenantId, $proposer): ShiftSwapRequest {
            $requestingEmp = Employee::where('tenant_id', $tenantId)->findOrFail($data['requesting_employee_id']);
            $targetEmp = Employee::where('tenant_id', $tenantId)->findOrFail($data['target_employee_id']);

            // 1. Department isolation guard (unless both belong to general/unassigned pool)
            if ($requestingEmp->department_id !== null && $targetEmp->department_id !== null && $requestingEmp->department_id !== $targetEmp->department_id) {
                throw ValidationException::withMessages([
                    'target_employee_id' => ['Shift swap requests can only be made between employees in the same department.'],
                ]);
            }

            $shiftDate = Carbon::parse($data['shift_date']);
            $targetDate = ! empty($data['target_date']) ? Carbon::parse($data['target_date']) : $shiftDate->copy();
            $swapType = ($data['swap_type'] ?? 'same_day') === 'cross_day' || ! $shiftDate->isSameDay($targetDate)
                ? 'cross_day'
                : 'same_day';

            // 2. Ensure neither date belongs to a locked payroll cycle
            if ($this->rosterService->isPeriodLocked($shiftDate)) {
                throw ValidationException::withMessages([
                    'shift_date' => ["Cannot swap shifts on {$shiftDate->format('Y-m-d')} because payroll has been finalized and locked."],
                ]);
            }

            if ($swapType === 'cross_day' && $this->rosterService->isPeriodLocked($targetDate)) {
                throw ValidationException::withMessages([
                    'target_date' => ["Cannot swap shifts on {$targetDate->format('Y-m-d')} because payroll has been finalized and locked."],
                ]);
            }

            // 3. Resolve current schedules
            $schedA1 = $this->getEmployeeScheduleOnDate($requestingEmp, $shiftDate, $tenantId);
            $schedB1 = $this->getEmployeeScheduleOnDate($targetEmp, $shiftDate, $tenantId);


            $schedA2 = $swapType === 'cross_day' ? $this->getEmployeeScheduleOnDate($requestingEmp, $targetDate, $tenantId) : null;
            $schedB2 = $swapType === 'cross_day' ? $this->getEmployeeScheduleOnDate($targetEmp, $targetDate, $tenantId) : null;

            // 4. Check for approved leave collisions
            if ($schedA1['leave'] !== null) {
                throw ValidationException::withMessages([
                    'shift_date' => ["{$requestingEmp->full_name} has an approved leave ({$schedA1['leave']['type_name']}) on {$shiftDate->format('Y-m-d')}."],
                ]);
            }
            if ($schedB1['leave'] !== null && $swapType === 'same_day') {
                throw ValidationException::withMessages([
                    'shift_date' => ["{$targetEmp->full_name} has an approved leave ({$schedB1['leave']['type_name']}) on {$shiftDate->format('Y-m-d')}."],
                ]);
            }
            if ($swapType === 'cross_day') {
                if ($schedA2['leave'] !== null) {
                    throw ValidationException::withMessages([
                        'target_date' => ["{$requestingEmp->full_name} has an approved leave ({$schedA2['leave']['type_name']}) on {$targetDate->format('Y-m-d')}."],
                    ]);
                }
                if ($schedB2['leave'] !== null) {
                    throw ValidationException::withMessages([
                        'target_date' => ["{$targetEmp->full_name} has an approved leave ({$schedB2['leave']['type_name']}) on {$targetDate->format('Y-m-d')}."],
                    ]);
                }
            }

            // 5. Check for identical shift redundancy
            if ($swapType === 'same_day') {
                $sameShift = ($schedA1['shift']['id'] ?? null) === ($schedB1['shift']['id'] ?? null);
                $sameType = $schedA1['schedule_type'] === $schedB1['schedule_type'];
                if ($sameShift && $sameType) {
                    throw ValidationException::withMessages([
                        'target_employee_id' => ['Both employees already share the identical schedule on this date.'],
                    ]);
                }
            } else {
                // If on both dates, swapping produces no change
                $sameA1B2 = ($schedA1['shift']['id'] ?? null) === ($schedB2['shift']['id'] ?? null) && $schedA1['schedule_type'] === $schedB2['schedule_type'];
                $sameB1A2 = ($schedB1['shift']['id'] ?? null) === ($schedA2['shift']['id'] ?? null) && $schedB1['schedule_type'] === $schedA2['schedule_type'];
                if ($sameA1B2 && $sameB1A2) {
                    throw ValidationException::withMessages([
                        'target_date' => ['The proposed cross-date swap produces no change in schedule.'],
                    ]);
                }
            }

            // 6. Check pending swap collision
            $existingPendingQuery = ShiftSwapRequest::where('tenant_id', $tenantId)
                ->where('status', 'pending')
                ->where(function ($q) use ($requestingEmp, $targetEmp) {
                    $q->whereIn('requesting_employee_id', [$requestingEmp->id, $targetEmp->id])
                        ->orWhereIn('target_employee_id', [$requestingEmp->id, $targetEmp->id]);
                })
                ->where(function ($q) use ($shiftDate, $targetDate, $swapType) {
                    $q->whereDate('shift_date', $shiftDate->toDateString())
                        ->orWhereDate('target_date', $shiftDate->toDateString());

                    if ($swapType === 'cross_day') {
                        $q->orWhereDate('shift_date', $targetDate->toDateString())
                            ->orWhereDate('target_date', $targetDate->toDateString());
                    }
                });

            if ($existingPendingQuery->exists()) {
                throw ValidationException::withMessages([
                    'shift_date' => ['A pending shift swap request already exists for this date range involving one or both employees.'],
                ]);
            }

            // 7. Calculate fatigue warnings
            $warnings = [];
            $newShiftForA1 = $schedB1['shift_model'] ?? null;
            $newShiftForB1 = $schedA1['shift_model'] ?? null;
            $warningA1 = $this->checkTurnaroundWarning($requestingEmp, $shiftDate, $newShiftForA1, $tenantId);
            $warningB1 = $this->checkTurnaroundWarning($targetEmp, $shiftDate, $newShiftForB1, $tenantId);
            if ($warningA1) {
                $warnings[] = $warningA1;
            }
            if ($warningB1) {
                $warnings[] = $warningB1;
            }

            if ($swapType === 'cross_day') {
                $newShiftForA2 = $schedB2['shift_model'] ?? null;
                $newShiftForB2 = $schedA2['shift_model'] ?? null;
                $warningA2 = $this->checkTurnaroundWarning($requestingEmp, $targetDate, $newShiftForA2, $tenantId);
                $warningB2 = $this->checkTurnaroundWarning($targetEmp, $targetDate, $newShiftForB2, $tenantId);
                if ($warningA2) {
                    $warnings[] = $warningA2;
                }
                if ($warningB2) {
                    $warnings[] = $warningB2;
                }
            }

            // 8. Snapshot metadata
            $metadata = [
                'swap_type' => $swapType,
                'warnings' => $warnings,
                'snapshot_date_a' => [
                    'date' => $shiftDate->toDateString(),
                    'requesting' => $schedA1,
                    'target' => $schedB1,
                ],
                'snapshot_date_b' => $swapType === 'cross_day' ? [
                    'date' => $targetDate->toDateString(),
                    'requesting' => $schedA2,
                    'target' => $schedB2,
                ] : null,
            ];

            $requestingShiftId = $schedA1['shift']['id'] ?? null;
            $targetShiftId = $swapType === 'cross_day' ? ($schedB2['shift']['id'] ?? null) : ($schedB1['shift']['id'] ?? null);

            $swapRequest = ShiftSwapRequest::create([
                'tenant_id' => $tenantId,
                'department_id' => $requestingEmp->department_id,
                'requesting_employee_id' => $requestingEmp->id,
                'target_employee_id' => $targetEmp->id,
                'shift_date' => $shiftDate->toDateString(),
                'target_date' => $targetDate->toDateString(),
                'swap_type' => $swapType,
                'requesting_shift_id' => $requestingShiftId,
                'target_shift_id' => $targetShiftId,
                'requesting_schedule_type' => $schedA1['schedule_type'],
                'target_schedule_type' => $swapType === 'cross_day' ? $schedB2['schedule_type'] : $schedB1['schedule_type'],
                'reason' => $data['reason'] ?? null,
                'target_status' => 'pending',
                'status' => 'pending',
                'metadata' => $metadata,
            ]);

            // 9. Instant Manager Execution (if requested and user is authorized)
            $autoApprove = ! empty($data['auto_approve']) && $proposer !== null && $this->canUserApprove($proposer, $swapRequest, $tenantId);
            if ($autoApprove) {
                $this->approveSwap($swapRequest, $proposer, $tenantId, 'Directly executed and approved by manager');
            }

            return $swapRequest;
        });
    }

    /**
     * Preview shift swap schedules, feasibility, fatigue warnings, and collisions.
     *
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    public function previewSwap(array $data, string $tenantId): array
    {
        $requestingEmp = Employee::where('tenant_id', $tenantId)->find($data['requesting_employee_id'] ?? null);
        $targetEmp = Employee::where('tenant_id', $tenantId)->find($data['target_employee_id'] ?? null);

        if (! $requestingEmp || ! $targetEmp) {
            return [
                'can_swap' => false,
                'errors' => ['Please select both the requesting employee and the target peer.'],
                'warnings' => [],
            ];
        }

        $shiftDate = ! empty($data['shift_date']) ? Carbon::parse($data['shift_date']) : Carbon::today();
        $targetDate = ! empty($data['target_date']) ? Carbon::parse($data['target_date']) : $shiftDate->copy();
        $swapType = ($data['swap_type'] ?? 'same_day') === 'cross_day' || ! $shiftDate->isSameDay($targetDate)
            ? 'cross_day'
            : 'same_day';

        $errors = [];
        $warnings = [];

        // Department check
        if ($requestingEmp->department_id !== null && $targetEmp->department_id !== null && $requestingEmp->department_id !== $targetEmp->department_id) {
            $errors[] = 'Shift swap requests can only be made between employees in the same department.';
        }

        // Locked payroll check
        if ($this->rosterService->isPeriodLocked($shiftDate)) {
            $errors[] = "Roster for {$shiftDate->format('F Y')} is locked because payroll has been finalized.";
        }
        if ($swapType === 'cross_day' && $this->rosterService->isPeriodLocked($targetDate)) {
            $errors[] = "Roster for {$targetDate->format('F Y')} is locked because payroll has been finalized.";
        }

        // Current schedules
        $schedA1 = $this->getEmployeeScheduleOnDate($requestingEmp, $shiftDate, $tenantId);
        $schedB1 = $this->getEmployeeScheduleOnDate($targetEmp, $shiftDate, $tenantId);

        $schedA2 = $swapType === 'cross_day' ? $this->getEmployeeScheduleOnDate($requestingEmp, $targetDate, $tenantId) : null;
        $schedB2 = $swapType === 'cross_day' ? $this->getEmployeeScheduleOnDate($targetEmp, $targetDate, $tenantId) : null;

        // Leave checks
        if ($schedA1['leave'] !== null) {
            $errors[] = "{$requestingEmp->full_name} is on approved leave ({$schedA1['leave']['type_name']}) on {$shiftDate->format('M d, Y')}.";
        }
        if ($schedB1['leave'] !== null && $swapType === 'same_day') {
            $errors[] = "{$targetEmp->full_name} is on approved leave ({$schedB1['leave']['type_name']}) on {$shiftDate->format('M d, Y')}.";
        }
        if ($swapType === 'cross_day') {
            if ($schedA2['leave'] !== null) {
                $errors[] = "{$requestingEmp->full_name} is on approved leave ({$schedA2['leave']['type_name']}) on {$targetDate->format('M d, Y')}.";
            }
            if ($schedB2['leave'] !== null) {
                $errors[] = "{$targetEmp->full_name} is on approved leave ({$schedB2['leave']['type_name']}) on {$targetDate->format('M d, Y')}.";
            }
        }

        // Identical schedules
        if ($swapType === 'same_day') {
            $sameShift = ($schedA1['shift']['id'] ?? null) === ($schedB1['shift']['id'] ?? null);
            $sameType = $schedA1['schedule_type'] === $schedB1['schedule_type'];
            if ($sameShift && $sameType) {
                $errors[] = 'Both employees already share the identical schedule on this date.';
            }
        } else {
            $sameA1B2 = ($schedA1['shift']['id'] ?? null) === ($schedB2['shift']['id'] ?? null) && $schedA1['schedule_type'] === $schedB2['schedule_type'];
            $sameB1A2 = ($schedB1['shift']['id'] ?? null) === ($schedA2['shift']['id'] ?? null) && $schedB1['schedule_type'] === $schedA2['schedule_type'];
            if ($sameA1B2 && $sameB1A2) {
                $errors[] = 'The proposed cross-date swap produces no change in schedule.';
            }
        }

        // Fatigue turnaround
        $warnA1 = $this->checkTurnaroundWarning($requestingEmp, $shiftDate, $schedB1['shift_model'] ?? null, $tenantId);
        $warnB1 = $this->checkTurnaroundWarning($targetEmp, $shiftDate, $schedA1['shift_model'] ?? null, $tenantId);
        if ($warnA1) {
            $warnings[] = $warnA1;
        }
        if ($warnB1) {
            $warnings[] = $warnB1;
        }

        if ($swapType === 'cross_day') {
            $warnA2 = $this->checkTurnaroundWarning($requestingEmp, $targetDate, $schedB2['shift_model'] ?? null, $tenantId);
            $warnB2 = $this->checkTurnaroundWarning($targetEmp, $targetDate, $schedA2['shift_model'] ?? null, $tenantId);
            if ($warnA2) {
                $warnings[] = $warnA2;
            }
            if ($warnB2) {
                $warnings[] = $warnB2;
            }
        }

        // Remove shift_model before serialization
        unset($schedA1['shift_model'], $schedB1['shift_model']);
        if ($schedA2) {
            unset($schedA2['shift_model']);
        }
        if ($schedB2) {
            unset($schedB2['shift_model']);
        }

        return [
            'can_swap' => empty($errors),
            'errors' => $errors,
            'warnings' => $warnings,
            'swap_type' => $swapType,
            'date_a' => [
                'date' => $shiftDate->toDateString(),
                'requesting' => [
                    'current' => $schedA1,
                    'proposed' => $schedB1,
                ],
                'target' => [
                    'current' => $schedB1,
                    'proposed' => $schedA1,
                ],
            ],
            'date_b' => $swapType === 'cross_day' ? [
                'date' => $targetDate->toDateString(),
                'requesting' => [
                    'current' => $schedA2,
                    'proposed' => $schedB2,
                ],
                'target' => [
                    'current' => $schedB2,
                    'proposed' => $schedA2,
                ],
            ] : null,
        ];
    }

    /**
     * Resolve effective schedule for an employee on a specific date.
     *
     * @return array<string, mixed>
     */
    public function getEmployeeScheduleOnDate(Employee $emp, CarbonInterface $date, string $tenantId): array
    {
        $dateString = $date->toDateString();

        // 1. Check for approved leave
        $leave = LeaveRequest::where('tenant_id', $tenantId)
            ->where('employee_id', $emp->id)
            ->where('status', 'approved')
            ->whereDate('start_date', '<=', $dateString)
            ->whereDate('end_date', '>=', $dateString)
            ->with('leaveType:id,name,code')
            ->first();

        // 2. Check for roster entry
        $entry = RosterEntry::where('tenant_id', $tenantId)
            ->where('employee_id', $emp->id)
            ->whereDate('roster_date', $dateString)
            ->with('shift:id,name,code,start_time,end_time,color,is_night_shift')
            ->first();

        $shiftModel = null;
        if ($entry !== null) {
            $scheduleType = $entry->schedule_type;
            $shiftModel = $entry->shift;
        } else {
            $shiftModel = $this->shiftService->getEffectiveShiftForEmployee($emp, $date);
            $scheduleType = $shiftModel !== null ? 'shift' : 'rest_day';
        }

        return [
            'employee_id' => $emp->id,
            'employee_name' => $emp->full_name,
            'emp_no' => $emp->emp_no,
            'date' => $dateString,
            'schedule_type' => $scheduleType,
            'shift_model' => $shiftModel,
            'shift' => $shiftModel ? [
                'id' => $shiftModel->id,
                'name' => $shiftModel->name,
                'code' => $shiftModel->code,
                'start_time' => $shiftModel->start_time,
                'end_time' => $shiftModel->end_time,
                'color' => $shiftModel->color,
                'is_night_shift' => (bool) $shiftModel->is_night_shift,
            ] : null,
            'leave' => $leave ? [
                'id' => $leave->id,
                'type_name' => $leave->leaveType?->name ?? 'Leave',
                'type_code' => $leave->leaveType?->code ?? 'LV',
            ] : null,
            'is_locked' => $this->rosterService->isPeriodLocked($date),
        ];
    }

    /**
     * Compute turnaround interval rest hours and check if under 11.0 hours.
     */
    public function checkTurnaroundWarning(Employee $employee, CarbonInterface $date, ?Shift $newShift, string $tenantId): ?string
    {
        if ($newShift === null) {
            return null; // Rest days eliminate fatigue
        }

        // 1. Check previous day
        $prevDate = $date->copy()->subDay();
        $prevSched = $this->getEmployeeScheduleOnDate($employee, $prevDate, $tenantId);
        if ($prevSched['schedule_type'] === 'shift' && $prevSched['shift_model'] !== null) {
            $prevEnd = Carbon::parse("{$prevDate->toDateString()} {$prevSched['shift_model']->end_time}");
            if ($prevSched['shift_model']->is_night_shift) {
                $prevEnd->addDay();
            }
            $currStart = Carbon::parse("{$date->toDateString()} {$newShift->start_time}");
            $gapMinutes = $prevEnd->diffInMinutes($currStart, false);
            if ($gapMinutes >= 0 && $gapMinutes < 660) {
                $restHours = round($gapMinutes / 60, 1);

                return "Turnaround rest interval for {$employee->full_name} between {$prevDate->format('M d')} and {$date->format('M d')} is {$restHours}h (< 11.0h statutory minimum).";
            }
        }

        // 2. Check subsequent day
        $nextDate = $date->copy()->addDay();
        $nextSched = $this->getEmployeeScheduleOnDate($employee, $nextDate, $tenantId);
        if ($nextSched['schedule_type'] === 'shift' && $nextSched['shift_model'] !== null) {
            $currEnd = Carbon::parse("{$date->toDateString()} {$newShift->end_time}");
            if ($newShift->is_night_shift) {
                $currEnd->addDay();
            }
            $nextStart = Carbon::parse("{$nextDate->toDateString()} {$nextSched['shift_model']->start_time}");
            $gapMinutes = $currEnd->diffInMinutes($nextStart, false);
            if ($gapMinutes >= 0 && $gapMinutes < 660) {
                $restHours = round($gapMinutes / 60, 1);

                return "Turnaround rest interval for {$employee->full_name} between {$date->format('M d')} and {$nextDate->format('M d')} is {$restHours}h (< 11.0h statutory minimum).";
            }
        }

        return null;
    }

    /**
     * Check if a user has managerial authorization to approve a shift swap request.
     */
    public function canUserApprove(User $user, ShiftSwapRequest $swapRequest, string $tenantId): bool
    {
        $isCompanyAdmin = $user->hasRole(['Company Admin', 'Company Owner', 'Super Admin']) || $user->can('shift_swap.approve_all');
        if ($isCompanyAdmin) {
            return true;
        }

        $isDepartmentHod = $swapRequest->department_id !== null && DepartmentHead::where('tenant_id', $tenantId)
            ->where('department_id', $swapRequest->department_id)
            ->whereHas('employee', fn ($q) => $q->where('email', $user->email))
            ->exists();

        $hasDepartmentPermission = $user->can('shift_swap.approve_department');

        return $isDepartmentHod || $hasDepartmentPermission;
    }

    /**
     * Target employee accepts or rejects the proposed swap.
     */
    public function respondAsTarget(ShiftSwapRequest $swapRequest, bool $accept, string $tenantId): ShiftSwapRequest
    {
        if ($swapRequest->tenant_id !== $tenantId) {
            throw new \RuntimeException('Tenant mismatch.');
        }

        if ($swapRequest->status !== 'pending') {
            throw ValidationException::withMessages([
                'status' => ['This swap request has already been finalized.'],
            ]);
        }

        $swapRequest->target_status = $accept ? 'accepted' : 'rejected';
        if (! $accept) {
            $swapRequest->status = 'rejected';
            $swapRequest->admin_notes = 'Target employee declined the swap proposal.';
        }

        $swapRequest->save();

        return $swapRequest;
    }

    /**
     * Department HOD or Company Admin approves the swap request and executes atomic roster mutation.
     */
    public function approveSwap(ShiftSwapRequest $swapRequest, User $approver, string $tenantId, ?string $adminNotes = null): ShiftSwapRequest
    {
        if ($swapRequest->tenant_id !== $tenantId) {
            throw new \RuntimeException('Tenant mismatch.');
        }

        if ($swapRequest->status !== 'pending') {
            throw ValidationException::withMessages([
                'status' => ['This swap request has already been finalized.'],
            ]);
        }

        if (! $this->canUserApprove($approver, $swapRequest, $tenantId)) {
            throw ValidationException::withMessages([
                'authorization' => ['Only the Department Head (HOD) or an authorized Company Administrator can approve this shift swap.'],
            ]);
        }

        return DB::transaction(function () use ($swapRequest, $approver, $adminNotes): ShiftSwapRequest {
            $targetDate = $swapRequest->target_date ? $swapRequest->target_date->toDateString() : null;

            // Execute atomic roster swap (supports both same-date and cross-date)
            $this->rosterService->swapShift(
                $swapRequest->requesting_employee_id,
                $swapRequest->target_employee_id,
                $swapRequest->shift_date->toDateString(),
                $targetDate,
                $swapRequest->reason ?? 'Approved Shift Swap',
                $approver->id
            );

            $swapRequest->update([
                'status' => 'approved',
                'target_status' => 'accepted',
                'approved_by' => $approver->id,
                'approved_at' => Carbon::now(),
                'admin_notes' => $adminNotes,
            ]);

            return $swapRequest;
        });
    }

    /**
     * Reject swap request.
     */
    public function rejectSwap(ShiftSwapRequest $swapRequest, User $approver, string $tenantId, ?string $adminNotes = null): ShiftSwapRequest
    {
        if ($swapRequest->tenant_id !== $tenantId) {
            throw new \RuntimeException('Tenant mismatch.');
        }

        $swapRequest->update([
            'status' => 'rejected',
            'approved_by' => $approver->id,
            'approved_at' => Carbon::now(),
            'admin_notes' => $adminNotes,
        ]);

        return $swapRequest;
    }
}
