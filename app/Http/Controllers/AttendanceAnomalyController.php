<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Http\Requests\Attendance\ApproveOvertimeRequest;
use App\Http\Requests\Attendance\FreezeAttendancePeriodRequest;
use App\Http\Requests\Attendance\ResolveAnomalyRequest;
use App\Models\AttendanceDaily;
use App\Models\AttendancePeriodLock;
use App\Models\AttendanceRegularizationRequest;
use App\Models\Department;
use App\Models\Employee;
use App\Models\LeaveType;
use App\Services\AttendanceProcessingService;
use App\Services\AttendanceRegularizationService;
use Carbon\Carbon;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

final class AttendanceAnomalyController extends Controller
{
    public function __construct(
        private readonly AttendanceRegularizationService $regularizationService,
        private readonly AttendanceProcessingService $processingService,
    ) {}

    /**
     * Display the Attendance Exception Action Center & Overtime Approval Console.
     */
    public function index(Request $request): Response
    {
        $tenantId = session('tenant_id') ?? (app()->bound('current_tenant_id') ? app('current_tenant_id') : null);
        $user = $request->user();

        $monthInput = $request->query('month') ?? Carbon::today()->format('Y-m');
        $monthDate = Carbon::parse($monthInput . '-01');
        $startDate = $monthDate->copy()->startOfMonth();
        $endDate = $monthDate->copy()->endOfMonth();
        $today = Carbon::today();
        $effectiveEndDate = $endDate->gt($today) ? $today : $endDate;

        $departmentId = $request->query('department_id');
        $employeeId = $request->query('employee_id');
        $activeTab = $request->query('tab', 'anomalies'); // anomalies, overtime, regularizations, freeze

        // Enforce single source of truth: reconcile unpunched schedules in date range against Duty Roster, Leaves & Holidays
        $this->processingService->reconcileMonthlySchedules($startDate, $endDate, $tenantId);

        // 1. Outstanding Punch Anomalies (Missing punches, Unapproved Half Days)
        $anomaliesQuery = AttendanceDaily::query()
            ->when($tenantId, fn ($q) => $q->where('tenant_id', $tenantId))
            ->with([
                'employee:id,emp_no,full_name,department_id,designation_id',
                'employee.department:id,name',
                'employee.designation:id,title',
                'shift:id,name,code,start_time,end_time',
            ])
            ->whereBetween('attendance_date', [$startDate->toDateString(), $effectiveEndDate->toDateString()])
            ->where(function ($q): void {
                $q->where('status', 'missing_punch')
                    ->orWhere('status', 'half_day')
                    ->orWhere(function ($sub) {
                        $sub->whereNotNull('check_in')->whereNull('check_out');
                    })
                    ->orWhere(function ($sub) {
                        $sub->whereNull('check_in')->whereNotNull('check_out');
                    })
                    ->orWhereRaw("JSON_LENGTH(anomalies) > 0");
            })
            ->latest('attendance_date');

        if ($departmentId) {
            $anomaliesQuery->whereHas('employee', fn ($q) => $q->where('department_id', $departmentId));
        }

        if ($employeeId) {
            $anomaliesQuery->where('employee_id', $employeeId);
        }

        $allAnomalies = $anomaliesQuery->get()->filter(function ($item) use ($effectiveEndDate) {
            return $this->processingService->isRecordActionableAnomaly($item, $effectiveEndDate->toDateString());
        })->values();

        // 2. Overtime Approvals Queue
        $otQuery = AttendanceDaily::query()
            ->when($tenantId, fn ($q) => $q->where('tenant_id', $tenantId))
            ->with([
                'employee:id,emp_no,full_name,department_id,designation_id',
                'employee.department:id,name',
                'employee.designation:id,title',
                'shift:id,name,code,start_time,end_time',
                'otApprover:id,name',
            ])
            ->whereBetween('attendance_date', [$startDate->toDateString(), $endDate->toDateString()])
            ->where(function ($q): void {
                $q->where('ot_hours', '>', 0)->orWhere('double_ot_hours', '>', 0);
            })
            ->latest('attendance_date');

        if ($departmentId) {
            $otQuery->whereHas('employee', fn ($q) => $q->where('department_id', $departmentId));
        }

        if ($employeeId) {
            $otQuery->where('employee_id', $employeeId);
        }

        $overtimeRecords = $otQuery->get();

        // 3. Regularization Requests
        $regularizationsQuery = AttendanceRegularizationRequest::query()
            ->when($tenantId, fn ($q) => $q->where('tenant_id', $tenantId))
            ->with([
                'employee:id,emp_no,full_name,department_id,designation_id',
                'employee.department:id,name',
                'employee.designation:id,title',
                'hod:id,name',
                'hr:id,name',
            ])
            ->whereBetween('attendance_date', [$startDate->toDateString(), $endDate->toDateString()])
            ->latest('created_at');

        if ($departmentId) {
            $regularizationsQuery->whereHas('employee', fn ($q) => $q->where('department_id', $departmentId));
        }

        if ($employeeId) {
            $regularizationsQuery->where('employee_id', $employeeId);
        }

        $regularizations = $regularizationsQuery->get();

        // 4. Period Locks for current month
        $periodLocks = AttendancePeriodLock::query()
            ->when($tenantId, fn ($q) => $q->where('tenant_id', $tenantId))
            ->with(['department:id,name', 'hodUser:id,name', 'hrUser:id,name'])
            ->where('year', $monthDate->year)
            ->where('month', $monthDate->month)
            ->get();

        $companyWideLock = $periodLocks->firstWhere('department_id', null);

        // 5. Lookups
        $departments = Department::when($tenantId, fn ($q) => $q->where('tenant_id', $tenantId))
            ->orderBy('name')
            ->get(['id', 'name']);

        $leaveTypes = LeaveType::when($tenantId, fn ($q) => $q->where('tenant_id', $tenantId))
            ->orderBy('name')
            ->get(['id', 'name', 'code', 'is_paid']);

        $employees = Employee::when($tenantId, fn ($q) => $q->where('tenant_id', $tenantId))
            ->orderBy('full_name')
            ->get(['id', 'emp_no', 'full_name', 'department_id']);

        // Summary Counts (single source of truth with Timesheet)
        $summary = [
            'total_anomalies' => $allAnomalies->count(),
            'unapproved_half_days' => $allAnomalies->filter(fn ($item) => $this->processingService->isUnapprovedHalfDay($item))->count(),
            'missing_punches' => $allAnomalies->filter(fn ($item) => $this->processingService->isMissingPunch($item))->count(),
            'pending_ot_hours' => round((float) $overtimeRecords->where('ot_approval_status', 'pending')->sum('ot_hours'), 2),
            'pending_double_ot_hours' => round((float) $overtimeRecords->where('ot_approval_status', 'pending')->sum('double_ot_hours'), 2),
            'pending_ot_count' => $overtimeRecords->where('ot_approval_status', 'pending')->count(),
            'pending_regularizations' => $regularizations->whereIn('status', ['pending_hod', 'pending_hr'])->count(),
            'is_month_locked' => (bool) ($companyWideLock && $companyWideLock->isLocked()),
        ];

        return Inertia::render('Attendance/Anomalies', [
            'anomalies' => $allAnomalies,
            'overtimeRecords' => $overtimeRecords,
            'regularizations' => $regularizations,
            'periodLocks' => $periodLocks,
            'companyWideLock' => $companyWideLock,
            'summary' => $summary,
            'departments' => $departments,
            'leaveTypes' => $leaveTypes,
            'employees' => $employees,
            'selectedMonth' => $monthDate->format('Y-m'),
            'monthLabel' => $monthDate->format('F Y'),
            'selectedDepartmentId' => $departmentId,
            'selectedEmployeeId' => $employeeId,
            'activeTab' => $activeTab,
            'userPermissions' => [
                'canHodApproveOt' => $user->can('attendance.hod_approve_ot') || $user->hasRole(['Supervisor', 'Company Admin', 'Company Owner', 'Super Admin']),
                'canHrConfirmOt' => $user->can('attendance.hr_confirm_ot') || $user->hasRole(['HR Manager', 'Company Admin', 'Company Owner', 'Super Admin']),
                'canHodApproveRegularization' => $user->can('attendance.hod_approve_regularization') || $user->hasRole(['Supervisor', 'Company Admin', 'Company Owner', 'Super Admin']),
                'canHrConfirmRegularization' => $user->can('attendance.hr_confirm_regularization') || $user->hasRole(['HR Manager', 'Company Admin', 'Company Owner', 'Super Admin']),
                'canPeriodFreeze' => $user->can('attendance.period_freeze') || $user->hasRole(['HR Manager', 'Company Admin', 'Company Owner', 'Super Admin']),
                'canHrBypass' => $user->can('hr.bypass_all') || $user->hasRole(['Company Owner', 'Super Admin']) || $user->isSuperAdmin(),
            ],
        ]);
    }

    /**
     * Granular Overtime Approval (M04-A06).
     */
    public function approveOt(ApproveOvertimeRequest $request, AttendanceDaily $attendanceDaily): RedirectResponse
    {
        $user = $request->user();
        $validated = $request->validated();

        $this->regularizationService->approveOvertime(
            $attendanceDaily,
            $user,
            $validated['mode'],
            isset($validated['approved_ot_hours']) ? (float) $validated['approved_ot_hours'] : null,
            isset($validated['approved_double_ot_hours']) ? (float) $validated['approved_double_ot_hours'] : null,
            $validated['remarks'] ?? null
        );

        return redirect()->back()->with('success', 'Overtime hours successfully updated and logged.');
    }

    /**
     * Resolve Unapproved Half-Day Anomaly (M04-A07).
     */
    public function resolveAnomaly(ResolveAnomalyRequest $request, AttendanceDaily $attendanceDaily): RedirectResponse
    {
        $user = $request->user();
        $validated = $request->validated();

        $this->regularizationService->resolveUnapprovedHalfDay(
            $attendanceDaily,
            $user,
            $validated['mechanism'],
            $validated
        );

        $messages = [
            'paid_waiver' => 'Paid Half-Day Waiver successfully granted with audit log.',
            'retro_leave' => 'Unapproved half day converted to retroactive leave and deducted from balance.',
            'no_pay' => 'Unpaid Half-Day confirmed for payroll deduction.',
        ];

        return redirect()->back()->with('success', $messages[$validated['mechanism']] ?? 'Anomaly successfully resolved.');
    }

    /**
     * Freeze, Sign-Off, or Lock Monthly Attendance Period (M04-A09).
     */
    public function freezePeriod(FreezeAttendancePeriodRequest $request): RedirectResponse
    {
        $user = $request->user();
        $validated = $request->validated();
        $tenantId = session('tenant_id') ?? (app()->bound('current_tenant_id') ? app('current_tenant_id') : null);

        if (! $tenantId) {
            return redirect()->back()->with('error', 'Tenant context could not be identified.');
        }

        $this->regularizationService->freezePeriod(
            $tenantId,
            (int) $validated['year'],
            (int) $validated['month'],
            $validated['department_id'] ?? null,
            $user,
            $validated['action'],
            $validated['notes'] ?? null
        );

        $actionMessages = [
            'hod_sign_off' => 'Department attendance period successfully signed off by HOD.',
            'hr_lock' => 'Attendance period locked by HR. All records frozen against modifications.',
            'unlock' => 'Attendance period unlocked for administrative adjustments.',
        ];

        return redirect()->back()->with('success', $actionMessages[$validated['action']] ?? 'Attendance period status updated.');
    }
}
