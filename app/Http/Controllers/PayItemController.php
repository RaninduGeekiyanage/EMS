<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Http\Requests\Payroll\AssignEmployeePayItemRequest;
use App\Http\Requests\Payroll\StorePayItemRequest;
use App\Http\Requests\Payroll\UpdatePayItemRequest;
use App\Models\Employee;
use App\Models\EmployeePayItem;
use App\Models\PayItem;
use App\Models\Tenant;
use App\Services\Payroll\PayItemService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

final class PayItemController extends Controller
{
    public function __construct(
        private readonly PayItemService $payItemService
    ) {}

    /**
     * Display Pay Items Master and Recurring Employee Assignments.
     */
    public function index(Request $request): Response
    {
        /** @var Tenant|null $tenant */
        $tenant = $this->resolveTenant($request);
        if ($tenant === null) {
            abort(404, 'Tenant context not found.');
        }

        $payItems = PayItem::query()
            ->where('tenant_id', $tenant->id)
            ->withCount(['employeePayItems' => function ($query): void {
                $query->where('is_active', true);
            }])
            ->orderBy('display_order')
            ->orderBy('code')
            ->get();

        $employeePayItems = EmployeePayItem::query()
            ->where('tenant_id', $tenant->id)
            ->with(['employee.department', 'payItem'])
            ->orderByDesc('created_at')
            ->get();

        $employees = Employee::query()
            ->where('tenant_id', $tenant->id)
            ->where('employment_status', 'active')
            ->with('department')
            ->orderBy('emp_no')
            ->get(['id', 'emp_no', 'full_name', 'department_id']);

        $metrics = [
            'total_items' => $payItems->count(),
            'active_earnings' => $payItems->where('item_type', 'earning')->where('is_active', true)->count(),
            'active_deductions' => $payItems->where('item_type', 'deduction')->where('is_active', true)->count(),
            'epf_eligible_count' => $payItems->where('is_epf_eligible', true)->count(),
            'assigned_staff_count' => $employeePayItems->where('is_active', true)->pluck('employee_id')->unique()->count(),
        ];

        return Inertia::render('Payroll/PayItems', [
            'payItems' => $payItems,
            'employeePayItems' => $employeePayItems,
            'employees' => $employees,
            'metrics' => $metrics,
        ]);
    }

    /**
     * Create a new pay item.
     */
    public function store(StorePayItemRequest $request): RedirectResponse
    {
        /** @var Tenant $tenant */
        $tenant = $this->resolveTenant($request);
        $this->payItemService->createPayItem($tenant, $request->validated());

        return back()->with('success', 'Pay item successfully created.');
    }

    /**
     * Update an existing pay item.
     */
    public function update(PayItem $payItem, UpdatePayItemRequest $request): RedirectResponse
    {
        $tenant = $this->resolveTenant($request);
        if ($payItem->tenant_id !== $tenant?->id) {
            abort(403, 'Unauthorized pay item access.');
        }

        $this->payItemService->updatePayItem($payItem, $request->validated());

        return back()->with('success', "Pay item '{$payItem->code}' updated successfully.");
    }

    /**
     * Delete a custom pay item.
     */
    public function destroy(PayItem $payItem, Request $request): RedirectResponse
    {
        $tenant = $this->resolveTenant($request);
        if ($payItem->tenant_id !== $tenant?->id) {
            abort(403, 'Unauthorized pay item access.');
        }

        $this->payItemService->deletePayItem($payItem);

        return back()->with('success', "Pay item '{$payItem->code}' deleted successfully.");
    }

    /**
     * Seed or sync standard Sri Lankan statutory & common pay items.
     */
    public function seedStatutory(Request $request): RedirectResponse
    {
        /** @var Tenant $tenant */
        $tenant = $this->resolveTenant($request);
        $seeded = $this->payItemService->seedStandardPayItems($tenant);

        return back()->with('success', "Successfully synced {$seeded->count()} standard Sri Lankan pay items.");
    }

    /**
     * Assign recurring pay item to an employee.
     */
    public function assignEmployee(AssignEmployeePayItemRequest $request): RedirectResponse
    {
        /** @var Tenant $tenant */
        $tenant = $this->resolveTenant($request);
        $this->payItemService->assignPayItemToEmployee($tenant, $request->validated());

        return back()->with('success', 'Recurring pay item allocated to employee successfully.');
    }

    /**
     * Remove or cancel an employee's recurring pay item.
     */
    public function removeEmployeeItem(EmployeePayItem $employeePayItem, Request $request): RedirectResponse
    {
        $tenant = $this->resolveTenant($request);
        if ($employeePayItem->tenant_id !== $tenant?->id) {
            abort(403, 'Unauthorized access.');
        }

        $this->payItemService->removeEmployeePayItem($employeePayItem);

        return back()->with('success', 'Employee recurring pay item removed successfully.');
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
