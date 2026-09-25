<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\Department;
use App\Models\Employee;
use App\Models\ShiftSwapRequest;
use App\Services\ShiftSwapService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

final class ShiftSwapController extends Controller
{
    public function __construct(
        private readonly ShiftSwapService $shiftSwapService,
    ) {}

    /**
     * Display shift swap requests dashboard.
     */
    public function index(Request $request): Response
    {
        $tenantId = session('tenant_id') ?? app()->make('current_tenant_id') ?? null;
        $user = $request->user();

        $query = ShiftSwapRequest::query()
            ->with([
                'department:id,name,code',
                'requestingEmployee:id,emp_no,full_name',
                'targetEmployee:id,emp_no,full_name',
                'requestingShift:id,name,code,start_time,end_time,color',
                'targetShift:id,name,code,start_time,end_time,color',
                'approver:id,name',
            ])
            ->where('tenant_id', $tenantId);

        if ($request->filled('department_id')) {
            $query->where('department_id', $request->query('department_id'));
        }

        if ($request->filled('status') && $request->query('status') !== 'all') {
            $query->where('status', $request->query('status'));
        }

        $swaps = $query->orderBy('created_at', 'desc')->paginate(15)->withQueryString();

        $departments = Department::where('tenant_id', $tenantId)
            ->where('is_active', true)
            ->get(['id', 'name', 'code']);

        $employees = Employee::where('tenant_id', $tenantId)
            ->where('employment_status', 'active')
            ->get(['id', 'emp_no', 'full_name', 'department_id']);

        return Inertia::render('Roster/ShiftSwaps', [
            'swaps' => $swaps,
            'departments' => $departments,
            'employees' => $employees,
            'filters' => [
                'department_id' => $request->query('department_id', ''),
                'status' => $request->query('status', 'all'),
            ],
            'canApprove' => $user->hasRole(['Company Admin', 'Company Owner', 'Super Admin']) || $user->can('shift_swap.approve_all') || $user->can('shift_swap.approve_department'),
        ]);
    }

    /**
     * Preview shift swap schedules, warnings and feasibility.
     */
    public function preview(Request $request): JsonResponse
    {
        $tenantId = session('tenant_id') ?? app()->make('current_tenant_id') ?? null;

        $validated = $request->validate([
            'requesting_employee_id' => ['required', 'string', 'exists:employees,id'],
            'target_employee_id' => ['required', 'string', 'exists:employees,id', 'different:requesting_employee_id'],
            'shift_date' => ['required', 'date'],
            'target_date' => ['nullable', 'date'],
            'swap_type' => ['nullable', 'string', 'in:same_day,cross_day'],
        ]);

        $result = $this->shiftSwapService->previewSwap($validated, (string) $tenantId);

        return response()->json($result);
    }

    /**
     * Propose or directly execute a shift swap.
     */
    public function store(Request $request): RedirectResponse
    {
        $tenantId = session('tenant_id') ?? app()->make('current_tenant_id') ?? null;
        $user = $request->user();

        $validated = $request->validate([
            'requesting_employee_id' => ['required', 'string', 'exists:employees,id'],
            'target_employee_id' => ['required', 'string', 'exists:employees,id', 'different:requesting_employee_id'],
            'shift_date' => ['required', 'date'],
            'target_date' => ['nullable', 'date'],
            'swap_type' => ['nullable', 'string', 'in:same_day,cross_day'],
            'reason' => ['nullable', 'string', 'max:500'],
            'auto_approve' => ['nullable', 'boolean'],
        ]);

        $swap = $this->shiftSwapService->requestSwap($validated, (string) $tenantId, $user);

        $message = $swap->status === 'approved'
            ? 'Shift swap executed and duty roster automatically updated.'
            : 'Shift swap proposal submitted successfully.';

        return redirect()->back()->with('success', $message);
    }

    /**
     * Approve a shift swap request.
     */
    public function approve(Request $request, ShiftSwapRequest $swap): RedirectResponse
    {
        $tenantId = session('tenant_id') ?? app()->make('current_tenant_id') ?? null;
        $user = $request->user();

        $validated = $request->validate([
            'admin_notes' => ['nullable', 'string', 'max:500'],
        ]);

        $this->shiftSwapService->approveSwap($swap, $user, $tenantId, $validated['admin_notes'] ?? null);

        return redirect()->back()->with('success', 'Shift swap request approved and roster automatically synchronized.');
    }

    /**
     * Reject a shift swap request.
     */
    public function reject(Request $request, ShiftSwapRequest $swap): RedirectResponse
    {
        $tenantId = session('tenant_id') ?? app()->make('current_tenant_id') ?? null;
        $user = $request->user();

        $validated = $request->validate([
            'admin_notes' => ['nullable', 'string', 'max:500'],
        ]);

        $this->shiftSwapService->rejectSwap($swap, $user, $tenantId, $validated['admin_notes'] ?? null);

        return redirect()->back()->with('success', 'Shift swap request rejected.');
    }
}
