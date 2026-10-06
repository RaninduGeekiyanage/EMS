<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\AttendanceDaily;
use App\Models\AttendanceRegularizationRequest;
use App\Models\Employee;
use App\Models\EmployeeLoan;
use App\Models\LeaveEntitlement;
use App\Models\LeaveRequest;
use App\Models\LeaveType;
use App\Models\PayrollEmployee;
use App\Models\Tenant;
use App\Models\User;
use App\Services\LeaveService;
use App\Services\PayslipGeneratorService;
use App\Models\RosterEntry;
use App\Models\Shift;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Inertia\Response as InertiaResponse;

final class PortalController extends Controller
{
    public function __construct(
        private readonly LeaveService $leaveService,
        private readonly PayslipGeneratorService $payslipService,
    ) {}

    /**
     * Resolve the Employee model for the current authenticated user safely.
     */
    private function resolveCurrentEmployee(User $user, Tenant $tenant): ?Employee
    {
        if (! empty($user->employee_id)) {
            $emp = Employee::where('tenant_id', $tenant->id)
                ->where('id', $user->employee_id)
                ->with(['department', 'designation', 'branch'])
                ->first();

            if ($emp !== null) {
                return $emp;
            }
        }

        if (! empty($user->username)) {
            $empNo = preg_replace('/^EMP-?/i', '', (string) $user->username);
            $emp = Employee::where('tenant_id', $tenant->id)
                ->where('emp_no', $empNo)
                ->with(['department', 'designation', 'branch'])
                ->first();

            if ($emp !== null) {
                return $emp;
            }
        }

        if (! empty($user->email)) {
            return Employee::where('tenant_id', $tenant->id)
                ->where('email', $user->email)
                ->with(['department', 'designation', 'branch'])
                ->first();
        }

        return null;
    }

    /**
     * Display personal attendance ledger and punch exceptions for current employee.
     */
    public function myAttendance(Request $request): InertiaResponse
    {
        /** @var Tenant $tenant */
        $tenant = app('current_tenant');
        /** @var User $user */
        $user = Auth::user();

        $employee = $this->resolveCurrentEmployee($user, $tenant);

        $selectedMonth = (string) $request->query('month', now()->format('Y-m'));
        $startDate = Carbon::parse($selectedMonth . '-01')->startOfMonth();
        $endDate = $startDate->copy()->endOfMonth();

        $records = [];
        $kpis = [
            'total_scheduled' => 0,
            'present_days' => 0,
            'late_days' => 0,
            'total_late_minutes' => 0,
            'half_days' => 0,
            'absent_days' => 0,
            'worked_hours' => 0.0,
            'approved_ot_hours' => 0.0,
            'raw_ot_hours' => 0.0,
            'pending_regularizations' => 0,
        ];
        $regularizations = [];

        if ($employee !== null) {
            $dailyRecords = AttendanceDaily::where('tenant_id', $tenant->id)
                ->where('employee_id', $employee->id)
                ->whereBetween('attendance_date', [$startDate->toDateString(), $endDate->toDateString()])
                ->with('shift')
                ->orderBy('attendance_date', 'asc')
                ->get();

            $records = $dailyRecords->map(function (AttendanceDaily $record): array {
                return [
                    'id' => $record->id,
                    'attendance_date' => $record->attendance_date,
                    'shift' => $record->shift ? [
                        'code' => $record->shift->code,
                        'name' => $record->shift->name,
                        'start_time' => $record->shift->start_time,
                        'end_time' => $record->shift->end_time,
                    ] : null,
                    'check_in' => $record->check_in,
                    'check_out' => $record->check_out,
                    'worked_hours' => (float) $record->worked_hours,
                    'late_minutes' => (int) $record->late_minutes,
                    'early_departure_minutes' => (int) $record->early_departure_minutes,
                    'ot_hours' => (float) $record->ot_hours,
                    'double_ot_hours' => (float) $record->double_ot_hours,
                    'approved_ot_hours' => (float) $record->approved_ot_hours,
                    'approved_double_ot_hours' => (float) $record->approved_double_ot_hours,
                    'ot_approval_status' => $record->ot_approval_status,
                    'status' => $record->status,
                    'is_paid' => (bool) $record->is_paid,
                    'is_manual' => (bool) $record->is_manual,
                ];
            })->toArray();

            $kpis['total_scheduled'] = $dailyRecords->where('status', '!=', 'rest_day')->count();
            $kpis['present_days'] = $dailyRecords->where('status', 'present')->count();
            $kpis['late_days'] = $dailyRecords->where('late_minutes', '>', 0)->count();
            $kpis['total_late_minutes'] = (int) $dailyRecords->sum('late_minutes');
            $kpis['half_days'] = $dailyRecords->where('status', 'half_day')->count();
            $kpis['absent_days'] = $dailyRecords->where('status', 'absent')->count();
            $kpis['worked_hours'] = round((float) $dailyRecords->sum('worked_hours'), 2);
            $kpis['approved_ot_hours'] = round((float) $dailyRecords->sum('approved_ot_hours') + (float) $dailyRecords->sum('approved_double_ot_hours'), 2);
            $kpis['raw_ot_hours'] = round((float) $dailyRecords->sum('ot_hours') + (float) $dailyRecords->sum('double_ot_hours'), 2);

            $regularizationRequests = AttendanceRegularizationRequest::where('tenant_id', $tenant->id)
                ->where('employee_id', $employee->id)
                ->orderBy('attendance_date', 'desc')
                ->take(30)
                ->get();

            $kpis['pending_regularizations'] = $regularizationRequests->whereIn('status', ['pending_hod', 'pending_hr'])->count();

            $regularizations = $regularizationRequests->map(function (AttendanceRegularizationRequest $req): array {
                return [
                    'id' => $req->id,
                    'attendance_date' => $req->attendance_date->toDateString(),
                    'request_type' => $req->request_type,
                    'status' => $req->status,
                    'requested_check_in' => $req->requested_check_in?->format('H:i'),
                    'requested_check_out' => $req->requested_check_out?->format('H:i'),
                    'reason' => $req->reason,
                    'hod_remarks' => $req->hod_remarks,
                    'rejection_reason' => $req->rejection_reason,
                    'created_at' => $req->created_at?->format('Y-m-d H:i'),
                ];
            })->toArray();
        }

        return Inertia::render('Portal/MyAttendance', [
            'employee' => $employee ? [
                'id' => $employee->id,
                'emp_no' => $employee->emp_no,
                'full_name' => $employee->full_name,
                'email' => $employee->email,
                'department_name' => $employee->department?->name,
                'designation_name' => $employee->designation?->name,
            ] : null,
            'selectedMonth' => $selectedMonth,
            'records' => $records,
            'kpis' => $kpis,
            'regularizations' => $regularizations,
        ]);
    }

    /**
     * Display personal leave entitlements, balances, and application portal.
     */
    public function myLeaves(Request $request): InertiaResponse
    {
        /** @var Tenant $tenant */
        $tenant = app('current_tenant');
        /** @var User $user */
        $user = Auth::user();

        $employee = $this->resolveCurrentEmployee($user, $tenant);

        $selectedYear = (int) $request->query('year', now()->year);

        $entitlements = [];
        $remainingShortLeaves = 2;
        $availableCompensatoryDays = 0.0;
        $leaveRequests = [];
        $coveringStaff = [];
        $leaveTypes = [];

        if ($employee !== null) {
            // Entitlements
            $entitlementsRecords = LeaveEntitlement::where('tenant_id', $tenant->id)
                ->where('employee_id', $employee->id)
                ->where('year', $selectedYear)
                ->with('leaveType')
                ->get();

            $entitlements = $entitlementsRecords->map(function (LeaveEntitlement $ent): array {
                return [
                    'id' => $ent->id,
                    'type_name' => $ent->leaveType?->name ?? 'Standard Leave',
                    'type_code' => $ent->leaveType?->code ?? 'LEAVE',
                    'allocated_days' => (float) $ent->allocated_days,
                    'used_days' => (float) $ent->used_days,
                    'remaining_days' => (float) $ent->remaining_days,
                ];
            })->toArray();

            // Short leaves quota (max 2 per calendar month)
            $remainingShortLeaves = $this->leaveService->getRemainingMonthlyShortLeaves($employee->id, $tenant->id, now()->startOfMonth());

            // Compensatory off balance
            $availableCompensatoryDays = $this->leaveService->getAvailableCompensatoryDays($employee->id, $tenant->id);

            // History of requests
            $reqs = LeaveRequest::where('tenant_id', $tenant->id)
                ->where('employee_id', $employee->id)
                ->with(['leaveType', 'coveringEmployee', 'hod', 'actionedBy'])
                ->orderBy('start_date', 'desc')
                ->take(50)
                ->get();

            $leaveRequests = $reqs->map(function (LeaveRequest $lr): array {
                return [
                    'id' => $lr->id,
                    'leave_type_name' => $lr->leaveType?->name ?? 'Standard',
                    'leave_type_code' => $lr->leaveType?->code ?? 'STD',
                    'start_date' => $lr->start_date->toDateString(),
                    'end_date' => $lr->end_date->toDateString(),
                    'days_count' => (float) $lr->days_count,
                    'is_half_day' => (bool) $lr->is_half_day,
                    'half_day_type' => $lr->half_day_type,
                    'is_short_leave' => (bool) $lr->is_short_leave,
                    'short_leave_from' => $lr->short_leave_from,
                    'short_leave_to' => $lr->short_leave_to,
                    'short_leave_duration_minutes' => $lr->short_leave_duration_minutes,
                    'status' => $lr->status,
                    'approval_stage' => $lr->approval_stage ?? $lr->status,
                    'reason' => $lr->reason,
                    'covering_employee_name' => $lr->coveringEmployee?->full_name,
                    'hod_remarks' => $lr->hod_remarks,
                    'rejection_reason' => $lr->rejection_reason,
                    'created_at' => $lr->created_at?->format('Y-m-d H:i'),
                ];
            })->toArray();

            // Covering staff from active employees in tenant
            $coveringStaff = Employee::where('tenant_id', $tenant->id)
                ->where('id', '!=', $employee->id)
                ->where('employment_status', 'active')
                ->orderBy('full_name')
                ->get(['id', 'emp_no', 'full_name', 'department_id'])
                ->toArray();

            // Available leave types
            $leaveTypes = LeaveType::where('tenant_id', $tenant->id)
                ->where('is_active', true)
                ->get(['id', 'name', 'code', 'is_paid', 'requires_attachment'])
                ->toArray();
        }

        return Inertia::render('Portal/MyLeaves', [
            'employee' => $employee ? [
                'id' => $employee->id,
                'emp_no' => $employee->emp_no,
                'full_name' => $employee->full_name,
                'department_name' => $employee->department?->name,
            ] : null,
            'selectedYear' => $selectedYear,
            'entitlements' => $entitlements,
            'remainingShortLeaves' => $remainingShortLeaves,
            'availableCompensatoryDays' => $availableCompensatoryDays,
            'leaveRequests' => $leaveRequests,
            'coveringStaff' => $coveringStaff,
            'leaveTypes' => $leaveTypes,
        ]);
    }

    /**
     * Display personal finalized confidential payslips.
     */
    public function myPayslips(Request $request): InertiaResponse
    {
        /** @var Tenant $tenant */
        $tenant = app('current_tenant');
        /** @var User $user */
        $user = Auth::user();

        $employee = $this->resolveCurrentEmployee($user, $tenant);

        $payslips = [];
        $loans = [];
        $metrics = [
            'latest_net_pay' => 0.0,
            'ytd_gross_pay' => 0.0,
            'ytd_epf_employee' => 0.0,
            'ytd_epf_employer' => 0.0,
            'total_loan_balance' => 0.0,
        ];

        if ($employee !== null) {
            $records = PayrollEmployee::where('tenant_id', $tenant->id)
                ->where('employee_id', $employee->id)
                ->whereHas('payrollRun', function ($q): void {
                    $q->whereIn('status', ['approved', 'locked', 'completed', 'paid']);
                })
                ->with('payrollRun')
                ->orderBy('created_at', 'desc')
                ->get();

            $payslips = $records->map(function (PayrollEmployee $pe): array {
                return [
                    'id' => $pe->id,
                    'period' => $pe->payrollRun?->period_label ?? $pe->created_at?->format('Y-m'),
                    'payment_mode' => $pe->payment_mode,
                    'worked_days' => (float) $pe->worked_days,
                    'ot_hours' => (float) $pe->ot_hours + (float) $pe->double_ot_hours,
                    'basic_salary' => (float) $pe->basic_salary,
                    'allowances' => (float) $pe->allowances,
                    'ot_pay' => (float) $pe->ot_pay,
                    'gross_pay' => (float) $pe->gross_pay,
                    'epf_employee' => (float) $pe->epf_employee,
                    'epf_employer' => (float) $pe->epf_employer,
                    'etf_employer' => (float) $pe->etf_employer,
                    'apit_tax' => (float) $pe->apit_tax,
                    'no_pay_deduction' => (float) $pe->no_pay_deduction,
                    'other_deductions' => (float) $pe->other_deductions,
                    'net_pay' => (float) $pe->net_pay,
                    'breakdown_json' => $pe->breakdown_json,
                    'run_status' => $pe->payrollRun?->status ?? 'approved',
                    'created_at' => $pe->created_at?->format('Y-m-d'),
                ];
            })->toArray();

            $metrics['latest_net_pay'] = (float) ($records->first()?->net_pay ?? 0.0);
            $metrics['ytd_gross_pay'] = (float) $records->sum('gross_pay');
            $metrics['ytd_epf_employee'] = (float) $records->sum('epf_employee');
            $metrics['ytd_epf_employer'] = (float) $records->sum('epf_employer');

            // Active Loans
            $loanRecords = EmployeeLoan::where('tenant_id', $tenant->id)
                ->where('employee_id', $employee->id)
                ->whereIn('status', ['active', 'paused', 'completed'])
                ->with('installments')
                ->get();

            $loans = $loanRecords->map(function (EmployeeLoan $loan): array {
                return [
                    'id' => $loan->id,
                    'loan_type' => $loan->loan_type,
                    'principal_amount' => (float) $loan->principal_amount,
                    'monthly_installment' => (float) $loan->monthly_installment,
                    'remaining_balance' => (float) $loan->remaining_balance,
                    'installment_count' => (int) $loan->installment_count,
                    'paid_installments_count' => $loan->installments->where('status', 'paid')->count(),
                    'status' => $loan->status,
                    'disbursement_date' => $loan->disbursement_date?->format('Y-m-d'),
                ];
            })->toArray();

            $metrics['total_loan_balance'] = (float) $loanRecords->where('status', 'active')->sum('remaining_balance');
        }

        return Inertia::render('Portal/MyPayslips', [
            'employee' => $employee ? [
                'id' => $employee->id,
                'emp_no' => $employee->emp_no,
                'full_name' => $employee->full_name,
                'department_name' => $employee->department?->name,
                'designation_name' => $employee->designation?->name,
            ] : null,
            'payslips' => $payslips,
            'loans' => $loans,
            'metrics' => $metrics,
        ]);
    }

    /**
     * Download individual confidential payslip PDF for current authenticated employee.
     */
    public function downloadPayslip(PayrollEmployee $payrollEmployee, Request $request): Response
    {
        /** @var Tenant $tenant */
        $tenant = app('current_tenant');
        /** @var User $user */
        $user = Auth::user();

        if ($payrollEmployee->tenant_id !== $tenant->id) {
            abort(404, 'Payslip not found.');
        }

        $employee = $this->resolveCurrentEmployee($user, $tenant);

        // Enforce employee identity boundary unless user has administrative payslip permission
        if (! $user->isSuperAdmin() && ! $user->isCompanyOwner() && ! $user->can('payslip.view')) {
            if ($employee === null || $payrollEmployee->employee_id !== $employee->id) {
                abort(403, 'Unauthorized access to confidential payslip record.');
            }
        }

        $pdf = $this->payslipService->generate($payrollEmployee);
        $empNo = $payrollEmployee->employee?->emp_no ?? 'EMP';
        $period = $payrollEmployee->payrollRun?->period_label ?? date('Y-m');
        $filename = "Payslip-{$empNo}-" . str_replace(' ', '-', $period) . '.pdf';

        return $pdf->download($filename);
    }

    /**
     * Display the dedicated Employee Self-Service Dashboard (Home Hub).
     */
    public function dashboard(Request $request): InertiaResponse
    {
        /** @var Tenant $tenant */
        $tenant = app('current_tenant');
        /** @var User $user */
        $user = Auth::user();

        $employee = $this->resolveCurrentEmployee($user, $tenant);

        if ($employee === null) {
            return Inertia::render('Portal/Dashboard', [
                'employee' => null,
                'schedule' => ['last_month' => [], 'this_month' => [], 'next_month' => [], 'keys' => []],
                'timesheet' => ['last_month' => [], 'this_month' => []],
                'leave_balances' => [],
                'recent_requests' => [],
                'latest_payslip' => null,
                'leave_types' => [],
            ]);
        }

        // 1. Single Source of Truth: 3-Month Duty Schedule from RosterEntry
        $lastMonthStart = now()->subMonth()->startOfMonth();
        $nextMonthEnd = now()->addMonth()->endOfMonth();

        $rosterEntries = RosterEntry::where('tenant_id', $tenant->id)
            ->where('employee_id', $employee->id)
            ->whereBetween('roster_date', [$lastMonthStart->toDateString(), $nextMonthEnd->toDateString()])
            ->with('shift')
            ->orderBy('roster_date')
            ->get();

        $lastMonthKey = now()->subMonth()->format('Y-m');
        $thisMonthKey = now()->format('Y-m');
        $nextMonthKey = now()->addMonth()->format('Y-m');

        $formatRosterEntry = function (RosterEntry $entry): array {
            $shift = $entry->shift;

            return [
                'id' => $entry->id,
                'date' => $entry->roster_date?->format('Y-m-d') ?? (string) $entry->roster_date,
                'day_name' => Carbon::parse($entry->roster_date)->format('D'),
                'day_num' => Carbon::parse($entry->roster_date)->format('j'),
                'schedule_type' => $entry->schedule_type ?? 'shift',
                'status' => $entry->status,
                'shift_name' => $shift?->name ?? ($entry->schedule_type === 'rest_day' ? 'Rest Day' : 'Day Off'),
                'start_time' => $shift ? substr((string) $shift->start_time, 0, 5) : null,
                'end_time' => $shift ? substr((string) $shift->end_time, 0, 5) : null,
                'is_night' => (bool) ($shift?->is_night_shift ?? false),
            ];
        };

        $schedule = [
            'last_month' => $rosterEntries->filter(fn ($e) => Carbon::parse($e->roster_date)->format('Y-m') === $lastMonthKey)->map($formatRosterEntry)->values()->toArray(),
            'this_month' => $rosterEntries->filter(fn ($e) => Carbon::parse($e->roster_date)->format('Y-m') === $thisMonthKey)->map($formatRosterEntry)->values()->toArray(),
            'next_month' => $rosterEntries->filter(fn ($e) => Carbon::parse($e->roster_date)->format('Y-m') === $nextMonthKey)->map($formatRosterEntry)->values()->toArray(),
            'keys' => [
                'last_month' => ['key' => $lastMonthKey, 'label' => now()->subMonth()->format('F Y')],
                'this_month' => ['key' => $thisMonthKey, 'label' => now()->format('F Y')],
                'next_month' => ['key' => $nextMonthKey, 'label' => now()->addMonth()->format('F Y')],
            ],
        ];

        // 2. Interactive Day-by-Day Timesheet Comparison (Last Month & This Month)
        $buildTimesheet = function (Carbon $month) use ($tenant, $employee, $rosterEntries): array {
            $start = $month->copy()->startOfMonth();
            $end = $month->copy()->endOfMonth();
            $limitDate = $month->isCurrentMonth() ? now() : $end;

            $attendanceRecords = AttendanceDaily::where('tenant_id', $tenant->id)
                ->where('employee_id', $employee->id)
                ->whereBetween('attendance_date', [$start->toDateString(), $end->toDateString()])
                ->with('shift')
                ->get()
                ->keyBy(fn ($a) => Carbon::parse($a->attendance_date)->format('Y-m-d'));

            $regularizationRecords = AttendanceRegularizationRequest::where('tenant_id', $tenant->id)
                ->where('employee_id', $employee->id)
                ->whereBetween('attendance_date', [$start->toDateString(), $end->toDateString()])
                ->get()
                ->keyBy(fn ($r) => Carbon::parse($r->attendance_date)->format('Y-m-d'));

            $days = [];
            $curr = $start->copy();
            while ($curr->lte($end)) {
                $dateStr = $curr->format('Y-m-d');
                $att = $attendanceRecords->get($dateStr);
                $roster = $rosterEntries->first(fn ($r) => Carbon::parse($r->roster_date)->format('Y-m-d') === $dateStr);
                $reg = $regularizationRecords->get($dateStr);

                $schedShift = $roster?->shift?->name ?? ($roster?->schedule_type === 'rest_day' ? 'Rest Day' : ($att?->shift?->name ?? 'General Shift'));
                $schedStart = $roster?->shift?->start_time ?? $att?->shift?->start_time;
                $schedEnd = $roster?->shift?->end_time ?? $att?->shift?->end_time;

                $status = 'scheduled';
                if ($curr->lte($limitDate)) {
                    if ($att !== null) {
                        $status = $att->status ?? 'present';
                    } elseif ($roster?->schedule_type === 'rest_day') {
                        $status = 'rest_day';
                    } else {
                        $status = 'absent';
                    }
                } elseif ($roster?->schedule_type === 'rest_day') {
                    $status = 'rest_day';
                }

                $punchIn = $att?->check_in ? Carbon::parse($att->check_in)->format('H:i') : null;
                $punchOut = $att?->check_out ? Carbon::parse($att->check_out)->format('H:i') : null;

                $days[] = [
                    'date' => $dateStr,
                    'day_name' => $curr->format('D'),
                    'day_num' => $curr->format('j'),
                    'is_past_or_today' => $curr->lte($limitDate),
                    'scheduled_shift' => $schedShift,
                    'scheduled_time' => ($schedStart && $schedEnd) ? substr((string) $schedStart, 0, 5) . ' - ' . substr((string) $schedEnd, 0, 5) : null,
                    'punch_in' => $punchIn,
                    'punch_out' => $punchOut,
                    'worked_hours' => (float) ($att?->worked_hours ?? 0.0),
                    'late_minutes' => (int) ($att?->late_minutes ?? 0),
                    'early_departure_minutes' => (int) ($att?->early_departure_minutes ?? 0),
                    'status' => $status,
                    'is_late' => (bool) (($att?->late_minutes ?? 0) > 0 || $att?->status === 'late'),
                    'is_half_day' => (bool) ($att?->status === 'half_day'),
                    'has_missing_punch' => (bool) ($att && (! $att->check_in || ! $att->check_out) && $status !== 'rest_day'),
                    'leave_type_name' => null,
                    'has_regularization' => $reg !== null,
                    'regularization_status' => $reg?->status,
                ];

                $curr->addDay();
            }

            return $days;
        };

        $timesheet = [
            'last_month' => $buildTimesheet(now()->subMonth()),
            'this_month' => $buildTimesheet(now()),
        ];

        // 3. Leave Balances
        $entitlements = LeaveEntitlement::where('tenant_id', $tenant->id)
            ->where('employee_id', $employee->id)
            ->where('year', (int) now()->year)
            ->with('leaveType')
            ->get()
            ->map(fn ($e) => [
                'id' => $e->id,
                'leave_type' => $e->leaveType?->name ?? 'Standard Leave',
                'allocated_days' => (float) $e->allocated_days,
                'utilized_days' => (float) $e->used_days,
                'balance_days' => max(0, (float) $e->allocated_days - (float) $e->used_days),
                'color' => $e->leaveType?->color ?? '#6366f1',
            ])->toArray();

        // 4. Recent Requests (Leaves & Regularizations)
        $recentLeaves = LeaveRequest::where('tenant_id', $tenant->id)
            ->where('employee_id', $employee->id)
            ->with('leaveType')
            ->latest()
            ->take(5)
            ->get()
            ->map(function ($l) {
                $start = Carbon::parse($l->start_date)->toDateString();
                $end = Carbon::parse($l->end_date)->toDateString();
                return [
                    'id' => $l->id,
                    'type' => 'leave',
                    'title' => ($l->leaveType?->name ?? 'Leave') . ' (' . (float) $l->days_count . 'd)',
                    'dates' => $start === $end ? $start : ($start . ' to ' . $end),
                    'status' => $l->status,
                    'approval_stage' => $l->approval_stage,
                    'is_bypassed_by_hr' => (bool) $l->is_bypassed_by_hr,
                    'submitted_at' => $l->created_at?->diffForHumans() ?? 'Recently',
                ];
            })->toArray();

        $recentRegs = AttendanceRegularizationRequest::where('tenant_id', $tenant->id)
            ->where('employee_id', $employee->id)
            ->latest()
            ->take(5)
            ->get()
            ->map(function ($r) {
                $date = Carbon::parse($r->attendance_date)->toDateString();
                return [
                    'id' => $r->id,
                    'type' => 'regularization',
                    'title' => 'Punch Regularization (' . $date . ')',
                    'dates' => $date,
                    'status' => $r->status,
                    'approval_stage' => $r->approval_stage ?? $r->status,
                    'is_bypassed_by_hr' => (bool) $r->is_bypassed_by_hr,
                    'submitted_at' => $r->created_at?->diffForHumans() ?? 'Recently',
                ];
            })->toArray();

        $recentRequests = array_slice(array_merge($recentLeaves, $recentRegs), 0, 6);

        // 5. Latest Payslip Snapshot
        $latestPe = PayrollEmployee::where('tenant_id', $tenant->id)
            ->where('employee_id', $employee->id)
            ->whereHas('payrollRun', fn ($q) => $q->whereIn('status', ['approved', 'locked', 'completed', 'paid']))
            ->with('payrollRun')
            ->latest('created_at')
            ->first();

        $latestPayslip = $latestPe ? [
            'id' => $latestPe->id,
            'period' => $latestPe->payrollRun?->period_label ?? $latestPe->created_at?->format('Y-m'),
            'net_pay' => (float) $latestPe->net_pay,
            'gross_pay' => (float) $latestPe->gross_pay,
            'epf_employee' => (float) $latestPe->epf_employee,
            'worked_days' => (float) $latestPe->worked_days,
            'download_url' => route('portal.payslips.download', $latestPe->id),
        ] : null;

        // 6. Leave Types for Quick Apply Modal
        $leaveTypes = LeaveType::where('tenant_id', $tenant->id)->where('is_active', true)->get();

        return Inertia::render('Portal/Dashboard', [
            'employee' => [
                'id' => $employee->id,
                'emp_no' => $employee->emp_no,
                'full_name' => $employee->full_name,
                'department_name' => $employee->department?->name ?? 'Operations',
                'designation_name' => $employee->designation?->name ?? 'Staff Member',
                'branch_name' => $employee->branch?->name ?? 'HQ',
                'date_of_joining' => $employee->date_of_joining,
            ],
            'schedule' => $schedule,
            'timesheet' => $timesheet,
            'leave_balances' => $entitlements,
            'recent_requests' => $recentRequests,
            'latest_payslip' => $latestPayslip,
            'leave_types' => $leaveTypes,
        ]);
    }
}
