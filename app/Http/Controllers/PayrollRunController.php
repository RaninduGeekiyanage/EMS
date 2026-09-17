<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\Department;
use App\Models\PayrollRun;
use App\Models\Tenant;
use App\Services\PayrollCalculationService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

final class PayrollRunController extends Controller
{
    public function __construct(
        private readonly PayrollCalculationService $calculationService,
    ) {}

    /**
     * Display the list of payroll runs and financial aggregates.
     */
    public function index(Request $request): Response
    {
        /** @var Tenant|null $tenant */
        $tenant = $this->resolveTenant($request);
        if ($tenant === null) {
            abort(404, 'Tenant not found.');
        }

        $year = (int) ($request->query('year') ?? Carbon::now()->year);

        $runs = PayrollRun::query()
            ->where('tenant_id', $tenant->id)
            ->where('period_year', $year)
            ->with(['runBy:id,name', 'approvedBy:id,name'])
            ->orderBy('period_month', 'desc')
            ->get()
            ->map(function (PayrollRun $run): array {
                return [
                    'id' => $run->id,
                    'period_year' => $run->period_year,
                    'period_month' => $run->period_month,
                    'period_label' => $run->period_label,
                    'status' => $run->status,
                    'total_gross' => (float) $run->total_gross,
                    'total_net' => (float) $run->total_net,
                    'total_epf_employee' => (float) $run->total_epf_employee,
                    'total_epf_employer' => (float) $run->total_epf_employer,
                    'total_etf' => (float) $run->total_etf,
                    'total_apit' => (float) $run->total_apit,
                    'total_deductions' => (float) $run->total_deductions,
                    'employee_count' => $run->employee_count,
                    'run_by' => $run->runBy?->name,
                    'approved_by' => $run->approvedBy?->name,
                    'approved_at' => $run->approved_at?->format('Y-m-d H:i'),
                    'notes' => $run->notes,
                    'created_at' => $run->created_at?->format('Y-m-d H:i'),
                ];
            });

        // Summary metrics for the year
        $annualGross = (float) PayrollRun::where('tenant_id', $tenant->id)->where('period_year', $year)->sum('total_gross');
        $annualNet = (float) PayrollRun::where('tenant_id', $tenant->id)->where('period_year', $year)->sum('total_net');
        $annualEpfEmployer = (float) PayrollRun::where('tenant_id', $tenant->id)->where('period_year', $year)->sum('total_epf_employer');
        $annualEtf = (float) PayrollRun::where('tenant_id', $tenant->id)->where('period_year', $year)->sum('total_etf');
        $totalRunsCount = PayrollRun::where('tenant_id', $tenant->id)->where('period_year', $year)->count();

        // Tenant statutory configuration
        $settings = [
            'epf_enabled' => (bool) $tenant->getSetting('epf_enabled', true),
            'epf_employee_rate' => (float) $tenant->getSetting('epf_employee_rate', 8.00),
            'epf_employer_rate' => (float) $tenant->getSetting('epf_employer_rate', 12.00),
            'etf_employer_rate' => (float) $tenant->getSetting('etf_employer_rate', 3.00),
            'shop_office_nopay_divisor' => (int) $tenant->getSetting('shop_office_nopay_divisor', 30),
            'wages_board_nopay_divisor' => (int) $tenant->getSetting('wages_board_nopay_divisor', 26),
        ];

        return Inertia::render('Payroll/Index', [
            'runs' => $runs,
            'selectedYear' => $year,
            'availableYears' => [Carbon::now()->year - 1, Carbon::now()->year, Carbon::now()->year + 1],
            'metrics' => [
                'annual_gross' => $annualGross,
                'annual_net' => $annualNet,
                'annual_epf_employer' => $annualEpfEmployer,
                'annual_etf' => $annualEtf,
                'total_runs' => $totalRunsCount,
            ],
            'settings' => $settings,
        ]);
    }

    /**
     * Preview calculation for a given month and year (dry run).
     */
    public function preview(Request $request): JsonResponse
    {
        /** @var Tenant|null $tenant */
        $tenant = $this->resolveTenant($request);
        if ($tenant === null) {
            abort(404, 'Tenant not found.');
        }

        $year = (int) $request->input('period_year', Carbon::now()->year);
        $month = (int) $request->input('period_month', Carbon::now()->month);

        $result = $this->calculationService->processPayroll(
            tenant: $tenant,
            year: $year,
            month: $month,
            runByUser: $request->user(),
            isDryRun: true
        );

        return response()->json($result);
    }

    /**
     * Execute and store a payroll run.
     */
    public function store(Request $request): RedirectResponse
    {
        /** @var Tenant|null $tenant */
        $tenant = $this->resolveTenant($request);
        if ($tenant === null) {
            abort(404, 'Tenant not found.');
        }

        $validated = $request->validate([
            'period_year' => ['required', 'integer', 'min:2020', 'max:2050'],
            'period_month' => ['required', 'integer', 'min:1', 'max:12'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ]);

        $result = $this->calculationService->processPayroll(
            tenant: $tenant,
            year: (int) $validated['period_year'],
            month: (int) $validated['period_month'],
            runByUser: $request->user(),
            isDryRun: false,
            notes: $validated['notes'] ?? null
        );

        return redirect()->route('payroll.show', $result['run']->id)
            ->with('success', "Payroll run for {$result['summary']['period_label']} successfully generated.");
    }

    /**
     * View detailed employee roster and line items for a specific payroll run.
     */
    public function show(PayrollRun $payrollRun, Request $request): Response
    {
        /** @var Tenant|null $tenant */
        $tenant = $this->resolveTenant($request);
        if ($tenant === null || $payrollRun->tenant_id !== $tenant->id) {
            abort(404, 'Payroll run not found.');
        }

        $payrollRun->load(['runBy:id,name', 'approvedBy:id,name']);

        $departmentId = $request->query('department_id');
        $paymentMode = $request->query('payment_mode');
        $search = $request->query('search');

        $query = $payrollRun->payrollEmployees()
            ->with([
                'employee:id,emp_no,full_name,email,department_id,designation_id',
                'employee.department:id,name',
                'employee.designation:id,title',
                'wagesBoardCategory:id,name',
            ]);

        if (! empty($departmentId)) {
            $query->whereHas('employee', function ($q) use ($departmentId): void {
                $q->where('department_id', $departmentId);
            });
        }

        if (! empty($paymentMode)) {
            $query->where('payment_mode', $paymentMode);
        }

        if (! empty($search)) {
            $query->whereHas('employee', function ($q) use ($search): void {
                $q->where('full_name', 'like', "%{$search}%")
                    ->orWhere('emp_no', 'like', "%{$search}%");
            });
        }

        $employees = $query->get()->map(function ($record): array {
            return [
                'id' => $record->id,
                'employee_id' => $record->employee_id,
                'emp_no' => $record->employee?->emp_no ?? 'N/A',
                'full_name' => $record->employee?->full_name ?? 'N/A',
                'department' => $record->employee?->department?->name ?? 'General',
                'designation' => $record->employee?->designation?->title ?? 'N/A',
                'payment_mode' => $record->payment_mode,
                'employment_type' => $record->employment_type,
                'labor_act' => $record->labor_act,
                'wages_board_category' => $record->wagesBoardCategory?->name,
                'is_epf_eligible' => (bool) $record->is_epf_eligible,
                'worked_days' => (float) $record->worked_days,
                'no_pay_days' => (float) $record->no_pay_days,
                'ot_hours' => (float) $record->ot_hours,
                'double_ot_hours' => (float) $record->double_ot_hours,
                'basic_salary' => (float) $record->basic_salary,
                'hourly_rate' => (float) $record->hourly_rate,
                'ot_pay' => (float) $record->ot_pay,
                'allowances' => (float) $record->allowances,
                'no_pay_deduction' => (float) $record->no_pay_deduction,
                'gross_pay' => (float) $record->gross_pay,
                'epf_eligible_earnings' => (float) $record->epf_eligible_earnings,
                'epf_employee' => (float) $record->epf_employee,
                'epf_employer' => (float) $record->epf_employer,
                'etf_employer' => (float) $record->etf_employer,
                'apit_tax' => (float) $record->apit_tax,
                'other_deductions' => (float) $record->other_deductions,
                'net_pay' => (float) $record->net_pay,
                'breakdown' => $record->breakdown_json,
            ];
        });

        $departments = Department::query()
            ->where('tenant_id', $tenant->id)
            ->select('id', 'name')
            ->orderBy('name')
            ->get();

        return Inertia::render('Payroll/Run', [
            'run' => [
                'id' => $payrollRun->id,
                'period_year' => $payrollRun->period_year,
                'period_month' => $payrollRun->period_month,
                'period_label' => $payrollRun->period_label,
                'status' => $payrollRun->status,
                'total_gross' => (float) $payrollRun->total_gross,
                'total_net' => (float) $payrollRun->total_net,
                'total_epf_employee' => (float) $payrollRun->total_epf_employee,
                'total_epf_employer' => (float) $payrollRun->total_epf_employer,
                'total_etf' => (float) $payrollRun->total_etf,
                'total_apit' => (float) $payrollRun->total_apit,
                'total_deductions' => (float) $payrollRun->total_deductions,
                'employee_count' => $payrollRun->employee_count,
                'run_by' => $payrollRun->runBy?->name,
                'approved_by' => $payrollRun->approvedBy?->name,
                'approved_at' => $payrollRun->approved_at?->format('Y-m-d H:i'),
                'notes' => $payrollRun->notes,
                'created_at' => $payrollRun->created_at?->format('Y-m-d H:i'),
            ],
            'employees' => $employees,
            'departments' => $departments,
            'filters' => [
                'department_id' => $departmentId,
                'payment_mode' => $paymentMode,
                'search' => $search,
            ],
        ]);
    }

    /**
     * Approve a payroll run.
     */
    public function approve(PayrollRun $payrollRun, Request $request): RedirectResponse
    {
        /** @var Tenant|null $tenant */
        $tenant = $this->resolveTenant($request);
        if ($tenant === null || $payrollRun->tenant_id !== $tenant->id) {
            abort(404, 'Payroll run not found.');
        }

        if ($payrollRun->isLocked()) {
            return back()->with('error', 'Cannot modify a locked payroll run.');
        }

        $payrollRun->update([
            'status' => 'approved',
            'approved_by' => $request->user()?->id,
            'approved_at' => now(),
        ]);

        return back()->with('success', "Payroll run for {$payrollRun->period_label} has been approved.");
    }

    /**
     * Lock a payroll run against further edits.
     */
    public function lock(PayrollRun $payrollRun, Request $request): RedirectResponse
    {
        /** @var Tenant|null $tenant */
        $tenant = $this->resolveTenant($request);
        if ($tenant === null || $payrollRun->tenant_id !== $tenant->id) {
            abort(404, 'Payroll run not found.');
        }

        $payrollRun->update([
            'status' => 'locked',
        ]);

        return back()->with('success', "Payroll run for {$payrollRun->period_label} is now locked.");
    }

    /**
     * Recalculate an existing unlocked payroll run.
     */
    public function recalculate(PayrollRun $payrollRun, Request $request): RedirectResponse
    {
        /** @var Tenant|null $tenant */
        $tenant = $this->resolveTenant($request);
        if ($tenant === null || $payrollRun->tenant_id !== $tenant->id) {
            abort(404, 'Payroll run not found.');
        }

        if ($payrollRun->isLocked()) {
            return back()->with('error', 'Cannot recalculate a locked payroll run.');
        }

        $this->calculationService->processPayroll(
            tenant: $tenant,
            year: $payrollRun->period_year,
            month: $payrollRun->period_month,
            runByUser: $request->user(),
            isDryRun: false,
            notes: $payrollRun->notes
        );

        return back()->with('success', "Payroll run for {$payrollRun->period_label} successfully recalculated.");
    }

    /**
     * Delete a draft payroll run.
     */
    public function destroy(PayrollRun $payrollRun, Request $request): RedirectResponse
    {
        /** @var Tenant|null $tenant */
        $tenant = $this->resolveTenant($request);
        if ($tenant === null || $payrollRun->tenant_id !== $tenant->id) {
            abort(404, 'Payroll run not found.');
        }

        if ($payrollRun->isLocked()) {
            return back()->with('error', 'Cannot delete a locked payroll run.');
        }

        $label = $payrollRun->period_label;
        $payrollRun->payrollEmployees()->delete();
        $payrollRun->delete();

        return redirect()->route('payroll.index')->with('success', "Payroll run for {$label} deleted.");
    }

    /**
     * Update tenant-level statutory & labor law configuration.
     */
    public function updateSettings(Request $request): RedirectResponse
    {
        /** @var Tenant|null $tenant */
        $tenant = $this->resolveTenant($request);
        if ($tenant === null) {
            abort(404, 'Tenant not found.');
        }

        $validated = $request->validate([
            'epf_enabled' => ['required', 'boolean'],
            'epf_employee_rate' => ['required', 'numeric', 'min:0', 'max:100'],
            'epf_employer_rate' => ['required', 'numeric', 'min:0', 'max:100'],
            'etf_employer_rate' => ['required', 'numeric', 'min:0', 'max:100'],
            'shop_office_nopay_divisor' => ['required', 'integer', 'min:20', 'max:31'],
            'wages_board_nopay_divisor' => ['required', 'integer', 'min:20', 'max:31'],
        ]);

        $tenant->setSetting('epf_enabled', $validated['epf_enabled']);
        $tenant->setSetting('epf_employee_rate', $validated['epf_employee_rate']);
        $tenant->setSetting('epf_employer_rate', $validated['epf_employer_rate']);
        $tenant->setSetting('etf_employer_rate', $validated['etf_employer_rate']);
        $tenant->setSetting('shop_office_nopay_divisor', $validated['shop_office_nopay_divisor']);
        $tenant->setSetting('wages_board_nopay_divisor', $validated['wages_board_nopay_divisor']);

        return back()->with('success', 'Payroll statutory configuration updated successfully.');
    }

    /**
     * Resolve active tenant from app context or session.
     */
    private function resolveTenant(Request $request): ?Tenant
    {
        if (app()->bound('current_tenant')) {
            return app('current_tenant');
        }

        $tenantId = session('tenant_id') ?? (app()->bound('current_tenant_id') ? app('current_tenant_id') : null);
        if ($tenantId !== null) {
            return Tenant::find($tenantId);
        }

        return $request->user()?->tenant;
    }
}
