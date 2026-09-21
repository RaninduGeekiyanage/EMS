<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Http\Requests\Department\StoreDepartmentRequest;
use App\Http\Requests\Department\UpdateDepartmentRequest;
use App\Services\CompanyService;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

final class DepartmentController extends Controller
{
    public function __construct(
        private readonly CompanyService $companyService,
    ) {}

    /**
     * Display a listing of the departments and hierarchy.
     */
    public function index(): Response
    {
        $tree = $this->companyService->getDepartmentTree();
        $all = $this->companyService->listDepartments();
        $employees = \App\Models\Employee::query()
            ->select('id', 'emp_no', 'full_name', 'department_id')
            ->where('employment_status', 'active')
            ->orderBy('full_name')
            ->get();

        return Inertia::render('Departments/Index', [
            'departmentTree' => $tree,
            'departments' => $all,
            'employees' => $employees,
        ]);
    }

    /**
     * Store a newly created department.
     */
    public function store(StoreDepartmentRequest $request): RedirectResponse
    {
        $this->companyService->createDepartment($request->validated());

        return redirect()->back()->with('success', 'Department created successfully.');
    }

    /**
     * Update the specified department.
     */
    public function update(UpdateDepartmentRequest $request, string $department): RedirectResponse
    {
        $this->companyService->updateDepartment($department, $request->validated());

        return redirect()->back()->with('success', 'Department updated successfully.');
    }

    /**
     * Remove the specified department.
     */
    public function destroy(string $department): RedirectResponse
    {
        $this->companyService->deleteDepartment($department);

        return redirect()->back()->with('success', 'Department deleted successfully.');
    }

    /**
     * Assign or update the Department Head (HOD).
     */
    public function assignHod(\Illuminate\Http\Request $request, string $department): RedirectResponse
    {
        $validated = $request->validate([
            'employee_id' => ['required', 'exists:employees,id'],
        ]);

        try {
            $this->companyService->assignDepartmentHead($department, $validated['employee_id']);
            return redirect()->back()->with('success', 'Department Head assigned successfully.');
        } catch (\InvalidArgumentException $e) {
            return redirect()->back()->withErrors(['employee_id' => $e->getMessage()]);
        }
    }

    /**
     * Remove the Department Head (HOD).
     */
    public function removeHod(string $department): RedirectResponse
    {
        $this->companyService->removeDepartmentHead($department);

        return redirect()->back()->with('success', 'Department Head removed successfully.');
    }
}
