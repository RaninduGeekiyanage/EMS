<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Http\Requests\Leave\AllocateEntitlementRequest;
use App\Http\Requests\Leave\ApplyLeaveRequest;
use App\Http\Requests\Leave\RejectLeaveRequest;
use App\Http\Requests\Leave\StoreLeaveTypeRequest;
use App\Models\Employee;
use App\Models\LeaveEntitlement;
use App\Models\LeaveRequest;
use App\Models\LeaveType;
use App\Services\LeaveService;
use Carbon\Carbon;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

final class LeaveRequestController extends Controller
{
    public function __construct(
        private readonly LeaveService $leaveService,
    ) {}

    /**
     * Display the Leave Management & Requests Portal.
     */
    public function index(Request $request): Response
    {
        $tenantId = session('tenant_id') ?? (app()->has('current_tenant_id') ? app('current_tenant_id') : null);
        $currentYear = (int) ($request->query('year') ?? Carbon::today()->year);
        $status = $request->query('status');
        $employeeId = $request->query('employee_id');
        $leaveTypeId = $request->query('leave_type_id');
        $search = $request->query('search');

        // Auto-seed statutory leave types if none exist
        $existingTypesCount = LeaveType::where('tenant_id', $tenantId)->count();
        if ($existingTypesCount === 0 && $tenantId !== null) {
            $this->leaveService->seedStatutoryTypes((string) $tenantId);
        }

        $query = LeaveRequest::query()
            ->with([
                'employee:id,emp_no,full_name,email,department_id',
                'employee.department:id,name',
                'leaveType:id,name,code,color,is_paid,days_per_year',
                'actionedBy:id,name',
            ])
            ->latest('created_at');

        if ($tenantId !== null) {
            $query->where('tenant_id', $tenantId);
        }

        if (! empty($status) && $status !== 'all') {
            $query->where('status', $status);
        }

        if (! empty($employeeId)) {
            $query->where('employee_id', $employeeId);
        }

        if (! empty($leaveTypeId)) {
            $query->where('leave_type_id', $leaveTypeId);
        }

        if (! empty($search)) {
            $query->where(function ($q) use ($search): void {
                $q->whereHas('employee', function ($eq) use ($search): void {
                    $eq->where('full_name', 'like', "%{$search}%")
                        ->orWhere('emp_no', 'like', "%{$search}%");
                })->orWhere('reason', 'like', "%{$search}%");
            });
        }

        $requests = $query->paginate(20)->withQueryString();

        $leaveTypes = LeaveType::where('tenant_id', $tenantId)
            ->where('is_active', true)
            ->orderBy('name')
            ->get();

        $employees = Employee::where('tenant_id', $tenantId)
            ->where('employment_status', 'active')
            ->select(['id', 'emp_no', 'full_name', 'department_id', 'date_of_joining'])
            ->with('department:id,name')
            ->orderBy('full_name')
            ->get();

        // Entitlements for the selected year
        $entitlements = LeaveEntitlement::where('tenant_id', $tenantId)
            ->where('year', $currentYear)
            ->with([
                'employee:id,emp_no,full_name',
                'leaveType:id,name,code,color',
            ])
            ->get();

        // Metrics
        $today = Carbon::today()->toDateString();
        $metrics = [
            'pending_count' => LeaveRequest::where('tenant_id', $tenantId)->where('status', 'pending')->count(),
            'approved_count' => LeaveRequest::where('tenant_id', $tenantId)->where('status', 'approved')->count(),
            'rejected_count' => LeaveRequest::where('tenant_id', $tenantId)->where('status', 'rejected')->count(),
            'on_leave_today' => LeaveRequest::where('tenant_id', $tenantId)
                ->where('status', 'approved')
                ->whereDate('start_date', '<=', $today)
                ->whereDate('end_date', '>=', $today)
                ->count(),
        ];

        return Inertia::render('Leave/Requests', [
            'requests' => $requests,
            'leaveTypes' => $leaveTypes,
            'employees' => $employees,
            'entitlements' => $entitlements,
            'metrics' => $metrics,
            'filters' => [
                'year' => $currentYear,
                'status' => $status ?? 'all',
                'employee_id' => $employeeId,
                'leave_type_id' => $leaveTypeId,
                'search' => $search,
            ],
        ]);
    }

    /**
     * Submit a new leave request.
     */
    public function store(ApplyLeaveRequest $request): RedirectResponse
    {
        $tenantId = (string) (session('tenant_id') ?? (app()->has('current_tenant_id') ? app('current_tenant_id') : null));

        $this->leaveService->applyLeave($request->validated(), $tenantId, $request->user());

        return back()->with('success', 'Leave request submitted successfully.');
    }

    /**
     * Approve a leave request.
     */
    public function approve(Request $request, LeaveRequest $leaveRequest): RedirectResponse
    {
        $this->leaveService->approveLeave($leaveRequest, $request->user());

        return back()->with('success', 'Leave request approved successfully and synchronized with attendance ledger.');
    }

    /**
     * Reject a leave request.
     */
    public function reject(RejectLeaveRequest $request, LeaveRequest $leaveRequest): RedirectResponse
    {
        $this->leaveService->rejectLeave($leaveRequest, $request->user(), $request->validated('rejection_reason'));

        return back()->with('success', 'Leave request rejected.');
    }

    /**
     * Cancel a leave request.
     */
    public function cancel(Request $request, LeaveRequest $leaveRequest): RedirectResponse
    {
        $this->leaveService->cancelLeave($leaveRequest, $request->user());

        return back()->with('success', 'Leave request cancelled.');
    }

    /**
     * Seed Sri Lankan statutory leave types.
     */
    public function seedStatutoryTypes(): RedirectResponse
    {
        $tenantId = (string) (session('tenant_id') ?? (app()->has('current_tenant_id') ? app('current_tenant_id') : null));

        $this->leaveService->seedStatutoryTypes($tenantId);

        return back()->with('success', 'Sri Lankan statutory leave types seeded successfully.');
    }

    /**
     * Allocate annual entitlements.
     */
    public function allocateEntitlements(AllocateEntitlementRequest $request): RedirectResponse
    {
        $tenantId = (string) (session('tenant_id') ?? (app()->has('current_tenant_id') ? app('current_tenant_id') : null));

        $result = $this->leaveService->allocateEntitlements(
            $tenantId,
            (int) $request->validated('year'),
            $request->validated('employee_id')
        );

        return back()->with('success', "Successfully allocated entitlements ({$result['total_allocated']} records) for {$result['year']}.");
    }

    /**
     * Create a new custom leave type.
     */
    public function storeType(StoreLeaveTypeRequest $request): RedirectResponse
    {
        $tenantId = (string) (session('tenant_id') ?? (app()->has('current_tenant_id') ? app('current_tenant_id') : null));

        LeaveType::create(array_merge($request->validated(), [
            'tenant_id' => $tenantId,
            'code' => strtoupper((string) $request->validated('code')),
            'is_active' => $request->validated('is_active', true),
        ]));

        return back()->with('success', 'Leave type created successfully.');
    }
}
