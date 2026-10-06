<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Http\Requests\Attendance\ActionRegularizationRequest;
use App\Http\Requests\Attendance\StoreRegularizationRequest;
use App\Models\AttendanceRegularizationRequest;
use App\Models\Department;
use App\Models\Employee;
use App\Services\AttendanceRegularizationService;
use Carbon\Carbon;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

final class AttendanceRegularizationController extends Controller
{
    public function __construct(
        private readonly AttendanceRegularizationService $regularizationService,
    ) {}

    /**
     * Display a paginated/filtered list of attendance regularization requests.
     */
    public function index(Request $request): Response
    {
        $tenantId = session('tenant_id') ?? (app()->bound('current_tenant_id') ? app('current_tenant_id') : null);
        $user = $request->user();

        $status = $request->query('status');
        $employeeId = $request->query('employee_id');
        $departmentId = $request->query('department_id');
        $dateFrom = $request->query('date_from');
        $dateTo = $request->query('date_to');

        $query = AttendanceRegularizationRequest::query()
            ->when($tenantId, fn ($q) => $q->where('tenant_id', $tenantId))
            ->with([
                'employee:id,emp_no,full_name,department_id,designation_id',
                'employee.department:id,name',
                'employee.designation:id,title',
                'hod:id,name',
                'hr:id,name',
            ])
            ->latest('attendance_date');

        if ($status) {
            $query->where('status', $status);
        }

        if ($employeeId) {
            $query->where('employee_id', $employeeId);
        }

        if ($departmentId) {
            $query->whereHas('employee', fn ($q) => $q->where('department_id', $departmentId));
        }

        if ($dateFrom) {
            $query->whereDate('attendance_date', '>=', $dateFrom);
        }

        if ($dateTo) {
            $query->whereDate('attendance_date', '<=', $dateTo);
        }

        $requests = $query->paginate(25)->withQueryString();

        $stats = [
            'pending_hod' => AttendanceRegularizationRequest::when($tenantId, fn ($q) => $q->where('tenant_id', $tenantId))->where('status', 'pending_hod')->count(),
            'pending_hr' => AttendanceRegularizationRequest::when($tenantId, fn ($q) => $q->where('tenant_id', $tenantId))->where('status', 'pending_hr')->count(),
            'approved' => AttendanceRegularizationRequest::when($tenantId, fn ($q) => $q->where('tenant_id', $tenantId))->where('status', 'approved')->count(),
            'rejected' => AttendanceRegularizationRequest::when($tenantId, fn ($q) => $q->where('tenant_id', $tenantId))->where('status', 'rejected')->count(),
        ];

        $departments = Department::when($tenantId, fn ($q) => $q->where('tenant_id', $tenantId))->orderBy('name')->get(['id', 'name']);
        $employees = Employee::when($tenantId, fn ($q) => $q->where('tenant_id', $tenantId))->orderBy('full_name')->get(['id', 'emp_no', 'full_name']);

        return Inertia::render('Attendance/Regularizations', [
            'requests' => $requests,
            'stats' => $stats,
            'departments' => $departments,
            'employees' => $employees,
            'filters' => [
                'status' => $status,
                'employee_id' => $employeeId,
                'department_id' => $departmentId,
                'date_from' => $dateFrom,
                'date_to' => $dateTo,
            ],
            'userPermissions' => [
                'canHodApprove' => $user->can('attendance.hod_approve_regularization') || $user->hasRole(['Supervisor', 'Company Admin', 'Company Owner', 'Super Admin']),
                'canHrConfirm' => $user->can('attendance.hr_confirm_regularization') || $user->hasRole(['HR Manager', 'Company Admin', 'Company Owner', 'Super Admin']),
                'canHrBypass' => $user->can('hr.bypass_all') || $user->hasRole(['Company Owner', 'Super Admin']),
            ],
        ]);
    }

    /**
     * Submit a new attendance regularization request.
     */
    public function store(StoreRegularizationRequest $request): RedirectResponse
    {
        $user = $request->user();
        $validated = $request->validated();
        $tenantId = session('tenant_id') ?? (app()->bound('current_tenant_id') ? app('current_tenant_id') : null);

        // Resolve target employee
        $employee = null;
        if (! empty($validated['employee_id'])) {
            $employee = Employee::when($tenantId, fn ($q) => $q->where('tenant_id', $tenantId))->findOrFail($validated['employee_id']);
        } else {
            if (! empty($user->employee_id)) {
                $employee = Employee::when($tenantId, fn ($q) => $q->where('tenant_id', $tenantId))->find($user->employee_id);
            }
            if (! $employee && ! empty($user->username)) {
                $empNo = preg_replace('/^EMP-?/i', '', (string) $user->username);
                $employee = Employee::when($tenantId, fn ($q) => $q->where('tenant_id', $tenantId))->where('emp_no', $empNo)->first();
            }
            if (! $employee && ! empty($user->email)) {
                $employee = Employee::when($tenantId, fn ($q) => $q->where('tenant_id', $tenantId))->where('email', $user->email)->first();
            }

            if (! $employee) {
                return redirect()->back()->with('error', 'No linked employee profile found for your account. Please select an employee.');
            }
        }

        // Handle attachment file upload
        if ($request->hasFile('attachment')) {
            $path = $request->file('attachment')->store('regularizations', 'public');
            $validated['attachment_path'] = $path;
        }

        $this->regularizationService->submitRegularization($validated, $employee, $user);

        return redirect()->back()->with('success', 'Attendance regularization request submitted successfully.');
    }

    /**
     * Action request as HOD (Stage 1: Recommendation or Rejection).
     */
    public function hodAction(ActionRegularizationRequest $request, AttendanceRegularizationRequest $regularization): RedirectResponse
    {
        $user = $request->user();
        $validated = $request->validated();

        $this->regularizationService->actionByHod(
            $regularization,
            $user,
            $validated['decision'],
            $validated['remarks'] ?? null
        );

        $msg = $validated['decision'] === 'approve'
            ? 'Regularization request recommended and forwarded to HR for final confirmation.'
            : 'Regularization request rejected by Department Head.';

        return redirect()->back()->with('success', $msg);
    }

    /**
     * Action request as HR (Stage 2: Final confirmation or Direct Bypass).
     */
    public function hrAction(ActionRegularizationRequest $request, AttendanceRegularizationRequest $regularization): RedirectResponse
    {
        $user = $request->user();
        $validated = $request->validated();

        $isBypass = $regularization->isPendingHod() || (bool) $request->input('is_bypass', false);

        $this->regularizationService->actionByHr(
            $regularization,
            $user,
            $validated['decision'],
            $validated['remarks'] ?? null,
            $isBypass
        );

        $msg = $validated['decision'] === 'approve'
            ? 'Regularization request finalized, approved, and synchronized with daily punch ledger.'
            : 'Regularization request rejected by HR.';

        return redirect()->back()->with('success', $msg);
    }
}
