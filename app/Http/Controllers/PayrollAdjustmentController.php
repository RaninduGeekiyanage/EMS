<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Http\Requests\Payroll\BulkPayrollAdjustmentRequest;
use App\Http\Requests\Payroll\StorePayrollAdjustmentRequest;
use App\Models\Employee;
use App\Models\PayItem;
use App\Models\PayrollMonthlyAdjustment;
use App\Models\Tenant;
use App\Services\Payroll\PayrollAdjustmentService;
use Carbon\Carbon;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

final class PayrollAdjustmentController extends Controller
{
    public function __construct(
        private readonly PayrollAdjustmentService $adjustmentService
    ) {}

    /**
     * Display Monthly Variable Inputs & Ad-hoc Adjustments.
     */
    public function index(Request $request): Response
    {
        /** @var Tenant|null $tenant */
        $tenant = $this->resolveTenant($request);
        if ($tenant === null) {
            abort(404, 'Tenant context not found.');
        }

        $now = Carbon::now();
        $year = (int) $request->input('year', $now->year);
        $month = (int) $request->input('month', $now->month);

        $adjustments = PayrollMonthlyAdjustment::query()
            ->where('tenant_id', $tenant->id)
            ->where('period_year', $year)
            ->where('period_month', $month)
            ->with(['employee.department', 'payItem', 'creator', 'approver'])
            ->orderByDesc('created_at')
            ->get();

        $employees = Employee::query()
            ->where('tenant_id', $tenant->id)
            ->where('employment_status', 'active')
            ->with('department')
            ->orderBy('emp_no')
            ->get(['id', 'emp_no', 'full_name', 'department_id']);

        $payItems = PayItem::query()
            ->where('tenant_id', $tenant->id)
            ->where('is_active', true)
            ->orderBy('display_order')
            ->get();

        $totalAdditions = (float) $adjustments->where('entry_type', 'addition')->whereIn('status', ['approved', 'processed'])->sum('amount');
        $totalDeductions = (float) $adjustments->where('entry_type', 'deduction')->whereIn('status', ['approved', 'processed'])->sum('amount');
        $pendingCount = $adjustments->where('status', 'pending')->count();
        $affectedEmployees = $adjustments->pluck('employee_id')->unique()->count();

        $metrics = [
            'total_additions' => $totalAdditions,
            'total_deductions' => $totalDeductions,
            'pending_count' => $pendingCount,
            'affected_employees_count' => $affectedEmployees,
        ];

        return Inertia::render('Payroll/VariableInputs', [
            'adjustments' => $adjustments,
            'employees' => $employees,
            'payItems' => $payItems,
            'metrics' => $metrics,
            'selectedYear' => $year,
            'selectedMonth' => $month,
            'availableYears' => [$now->year - 1, $now->year, $now->year + 1],
        ]);
    }

    /**
     * Store an individual monthly adjustment.
     */
    public function store(StorePayrollAdjustmentRequest $request): RedirectResponse
    {
        /** @var Tenant $tenant */
        $tenant = $this->resolveTenant($request);
        $this->adjustmentService->createAdjustment($tenant, $request->validated(), $request->user());

        return back()->with('success', 'Monthly variable adjustment created successfully.');
    }

    /**
     * Store multiple monthly adjustments in bulk.
     */
    public function bulkStore(BulkPayrollAdjustmentRequest $request): RedirectResponse
    {
        /** @var Tenant $tenant */
        $tenant = $this->resolveTenant($request);
        $records = $request->validated('adjustments', []);
        $created = $this->adjustmentService->bulkCreateAdjustments($tenant, $records, $request->user());

        return back()->with('success', "Batch of {$created->count()} variable adjustments successfully added.");
    }

    /**
     * Approve a pending monthly adjustment.
     */
    public function approve(PayrollMonthlyAdjustment $adjustment, Request $request): RedirectResponse
    {
        $tenant = $this->resolveTenant($request);
        if ($adjustment->tenant_id !== $tenant?->id) {
            abort(403, 'Unauthorized adjustment access.');
        }

        $this->adjustmentService->approveAdjustment($adjustment, $request->user());

        return back()->with('success', 'Adjustment approved successfully.');
    }

    /**
     * Delete an un-processed adjustment.
     */
    public function destroy(PayrollMonthlyAdjustment $adjustment, Request $request): RedirectResponse
    {
        $tenant = $this->resolveTenant($request);
        if ($adjustment->tenant_id !== $tenant?->id) {
            abort(403, 'Unauthorized adjustment access.');
        }

        $this->adjustmentService->deleteAdjustment($adjustment);

        return back()->with('success', 'Adjustment deleted successfully.');
    }

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
