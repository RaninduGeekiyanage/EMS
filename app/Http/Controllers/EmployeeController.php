<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Enums\EmploymentType;
use App\Enums\PaymentMode;
use App\Http\Requests\Employee\StoreEmployeeRequest;
use App\Http\Requests\Employee\UpdateEmployeeRequest;
use App\Models\Branch;
use App\Models\Designation;
use App\Services\CompanyService;
use App\Services\EmployeeService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

final class EmployeeController extends Controller
{
    public function __construct(
        private readonly EmployeeService $employeeService,
        private readonly CompanyService $companyService,
    ) {}

    /**
     * Display a paginated listing of employees with filters.
     */
    public function index(Request $request): Response
    {
        if ($request->user() !== null) {
            $this->authorize('viewAny', \App\Models\Employee::class);
        }

        $filters = $request->only(['search', 'department_id', 'branch_id', 'employment_status']);
        $employees = $this->employeeService->paginateEmployees(15, $filters);
        $departments = $this->companyService->listDepartments();
        $branches = Branch::orderBy('name')->get();

        $canViewSensitive = $request->user() === null || $request->user()->can('employee.view-sensitive');

        if (! $canViewSensitive) {
            $employees->getCollection()->transform(function ($emp) {
                if (! empty($emp->nic)) {
                    $emp->nic = str_repeat('*', max(0, strlen((string) $emp->nic) - 4)) . substr((string) $emp->nic, -4);
                }
                return $emp;
            });
        }

        return Inertia::render('Employees/Index', [
            'employees' => $employees,
            'departments' => $departments,
            'branches' => $branches,
            'filters' => $filters,
            'canViewSensitive' => $canViewSensitive,
        ]);
    }

    /**
     * Show the form for creating a new employee.
     */
    public function create(Request $request): Response
    {
        if ($request->user() !== null) {
            $this->authorize('create', \App\Models\Employee::class);
        }

        return Inertia::render('Employees/Create', [
            'nextEmpNo' => $this->employeeService->getNextEmpNo(),
            'departments' => $this->companyService->listDepartments(),
            'designations' => Designation::where('is_active', true)->orderBy('title')->get(),
            'branches' => Branch::where('is_active', true)->orderBy('name')->get(),
            'employmentTypes' => collect(EmploymentType::cases())->map(fn ($type) => [
                'value' => $type->value,
                'label' => $type->label(),
            ]),
            'paymentModes' => collect(PaymentMode::cases())->map(fn ($mode) => [
                'value' => $mode->value,
                'label' => $mode->label(),
            ]),
        ]);
    }

    /**
     * Store a newly created employee with all related sub-profiles.
     */
    public function store(StoreEmployeeRequest $request): RedirectResponse
    {
        if ($request->user() !== null) {
            $this->authorize('create', \App\Models\Employee::class);
        }

        $this->employeeService->createEmployee(
            $request->employeeData(),
            $request->paymentData(),
            $request->bankData(),
            $request->epfData()
        );

        return redirect()->route('employees.index')->with('success', 'Employee record created successfully.');
    }

    /**
     * Show the form for editing the specified employee.
     */
    public function edit(Request $request, string $employee): Response
    {
        $emp = $this->employeeService->getEmployee($employee);

        if ($emp === null) {
            abort(404, 'Employee not found.');
        }

        if ($request->user() !== null) {
            $this->authorize('update', $emp);
        }

        return Inertia::render('Employees/Edit', [
            'employee' => $emp,
            'departments' => $this->companyService->listDepartments(),
            'designations' => Designation::where('is_active', true)->orderBy('title')->get(),
            'branches' => Branch::where('is_active', true)->orderBy('name')->get(),
            'employmentTypes' => collect(EmploymentType::cases())->map(fn ($type) => [
                'value' => $type->value,
                'label' => $type->label(),
            ]),
            'paymentModes' => collect(PaymentMode::cases())->map(fn ($mode) => [
                'value' => $mode->value,
                'label' => $mode->label(),
            ]),
        ]);
    }

    /**
     * Update the specified employee and sub-records.
     */
    public function update(UpdateEmployeeRequest $request, string $employee): RedirectResponse
    {
        $emp = $this->employeeService->getEmployee($employee);

        if ($emp === null) {
            abort(404, 'Employee not found.');
        }

        if ($request->user() !== null) {
            $this->authorize('update', $emp);
        }

        $this->employeeService->updateEmployee(
            $employee,
            $request->employeeData(),
            $request->paymentData(),
            $request->bankData(),
            $request->epfData()
        );

        return redirect()->route('employees.index')->with('success', 'Employee record updated successfully.');
    }

    /**
     * Remove the specified employee (soft delete).
     */
    public function destroy(Request $request, string $employee): RedirectResponse
    {
        $emp = $this->employeeService->getEmployee($employee);

        if ($emp === null) {
            abort(404, 'Employee not found.');
        }

        if ($request->user() !== null) {
            $this->authorize('delete', $emp);
        }

        $this->employeeService->deleteEmployee($employee);

        return redirect()->route('employees.index')->with('success', 'Employee record deactivated.');
    }
}
