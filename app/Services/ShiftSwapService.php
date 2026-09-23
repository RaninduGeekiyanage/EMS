<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\DepartmentHead;
use App\Models\Employee;
use App\Models\RosterEntry;
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
    ) {}

    /**
     * Submit a shift swap request.
     *
     * @param  array<string, mixed>  $data
     */
    public function requestSwap(array $data, string $tenantId): ShiftSwapRequest
    {
        return DB::transaction(function () use ($data, $tenantId): ShiftSwapRequest {
            $requestingEmp = Employee::where('tenant_id', $tenantId)->findOrFail($data['requesting_employee_id']);
            $targetEmp = Employee::where('tenant_id', $tenantId)->findOrFail($data['target_employee_id']);

            if ($requestingEmp->department_id !== $targetEmp->department_id) {
                throw ValidationException::withMessages([
                    'target_employee_id' => ['Shift swap requests can only be made between employees in the same department.'],
                ]);
            }

            $shiftDate = Carbon::parse($data['shift_date']);

            // Find current roster entries for both
            $entryA = RosterEntry::where('tenant_id', $tenantId)
                ->where('employee_id', $requestingEmp->id)
                ->whereDate('roster_date', $shiftDate->toDateString())
                ->first();

            $entryB = RosterEntry::where('tenant_id', $tenantId)
                ->where('employee_id', $targetEmp->id)
                ->whereDate('roster_date', $shiftDate->toDateString())
                ->first();

            // Check if there is already a pending swap request for either employee on this date
            $existingPending = ShiftSwapRequest::where('tenant_id', $tenantId)
                ->where('status', 'pending')
                ->whereDate('shift_date', $shiftDate->toDateString())
                ->where(function ($q) use ($requestingEmp, $targetEmp) {
                    $q->whereIn('requesting_employee_id', [$requestingEmp->id, $targetEmp->id])
                        ->orWhereIn('target_employee_id', [$requestingEmp->id, $targetEmp->id]);
                })
                ->exists();

            if ($existingPending) {
                throw ValidationException::withMessages([
                    'shift_date' => ['A pending shift swap request already exists for this date involving one or both employees.'],
                ]);
            }

            return ShiftSwapRequest::create([
                'tenant_id' => $tenantId,
                'department_id' => $requestingEmp->department_id,
                'requesting_employee_id' => $requestingEmp->id,
                'target_employee_id' => $targetEmp->id,
                'shift_date' => $shiftDate->toDateString(),
                'requesting_shift_id' => $entryA?->shift_id,
                'target_shift_id' => $entryB?->shift_id,
                'reason' => $data['reason'] ?? null,
                'target_status' => 'pending',
                'status' => 'pending',
            ]);
        });
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

        // Authorisation check: Is approver Company Admin or HOD of the department or granted permission?
        $isCompanyAdmin = $approver->hasRole(['Company Admin', 'Company Owner', 'Super Admin']) || $approver->can('shift_swap.approve_all');

        if (! $isCompanyAdmin) {
            $isDepartmentHod = $swapRequest->department_id !== null && DepartmentHead::where('tenant_id', $tenantId)
                ->where('department_id', $swapRequest->department_id)
                ->whereHas('employee', function ($q) use ($approver) {
                    $q->where('email', $approver->email);
                })
                ->exists();

            $hasDepartmentPermission = $approver->can('shift_swap.approve_department');

            if (! $isDepartmentHod && ! $hasDepartmentPermission) {
                throw ValidationException::withMessages([
                    'authorization' => ['Only the Department Head (HOD) or an authorized Company Administrator can approve this shift swap.'],
                ]);
            }
        }

        return DB::transaction(function () use ($swapRequest, $approver, $adminNotes): ShiftSwapRequest {
            // Execute atomic roster swap
            $this->rosterService->swapShift(
                $swapRequest->requesting_employee_id,
                $swapRequest->target_employee_id,
                $swapRequest->shift_date->toDateString()
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
