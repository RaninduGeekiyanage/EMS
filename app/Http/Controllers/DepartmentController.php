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

        return Inertia::render('Departments/Index', [
            'departmentTree' => $tree,
            'departments' => $all,
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
}
