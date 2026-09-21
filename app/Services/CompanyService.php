<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\Branch;
use App\Models\Company;
use App\Models\Department;
use App\Repositories\Contracts\BranchRepositoryInterface;
use App\Repositories\Contracts\CompanyRepositoryInterface;
use App\Repositories\Contracts\DepartmentRepositoryInterface;
use Illuminate\Database\Eloquent\Collection;
use InvalidArgumentException;

final class CompanyService
{
    public function __construct(
        private readonly CompanyRepositoryInterface $companyRepository,
        private readonly BranchRepositoryInterface $branchRepository,
        private readonly DepartmentRepositoryInterface $departmentRepository,
    ) {}

    /**
     * Get or create the company profile for a tenant.
     */
    public function getOrCreateCompany(string $tenantId, string $defaultName = 'Default Company'): Company
    {
        $company = $this->companyRepository->findByTenant($tenantId);

        if ($company === null) {
            $company = $this->companyRepository->create([
                'tenant_id' => $tenantId,
                'name' => $defaultName,
            ]);
        }

        return $company;
    }

    /**
     * Update the company profile.
     *
     * @param  array<string, mixed>  $data
     */
    public function updateCompany(string $companyId, array $data): Company
    {
        return $this->companyRepository->update($companyId, $data);
    }

    /**
     * List all branches for a company.
     *
     * @return Collection<int, Branch>
     */
    public function listBranches(string $companyId): Collection
    {
        return $this->branchRepository->findByCompany($companyId);
    }

    /**
     * Create a branch under a company.
     *
     * @param  array<string, mixed>  $data
     */
    public function createBranch(array $data): Branch
    {
        if (! empty($data['is_head_office']) && ! empty($data['company_id'])) {
            $this->demoteExistingHeadOffices((string) $data['company_id']);
        }

        return $this->branchRepository->create($data);
    }

    /**
     * Update a branch.
     *
     * @param  array<string, mixed>  $data
     */
    public function updateBranch(string $branchId, array $data): Branch
    {
        $branch = $this->branchRepository->findById($branchId);
        if ($branch !== null && ! empty($data['is_head_office'])) {
            $this->demoteExistingHeadOffices((string) $branch->company_id, $branchId);
        }

        return $this->branchRepository->update($branchId, $data);
    }

    /**
     * Ensure only one head office exists per company by demoting any current ones.
     */
    private function demoteExistingHeadOffices(string $companyId, ?string $exceptBranchId = null): void
    {
        $query = Branch::where('company_id', $companyId)
            ->where('is_head_office', true);

        if ($exceptBranchId !== null) {
            $query->where('id', '!=', $exceptBranchId);
        }

        $query->update(['is_head_office' => false]);
    }

    /**
     * Delete a branch.
     */
    public function deleteBranch(string $branchId): bool
    {
        return $this->branchRepository->delete($branchId);
    }

    /**
     * Retrieve the hierarchical department tree.
     *
     * @return Collection<int, Department>
     */
    public function getDepartmentTree(): Collection
    {
        return $this->departmentRepository->getTree();
    }

    /**
     * Retrieve a flat collection of all departments.
     *
     * @return Collection<int, Department>
     */
    public function listDepartments(): Collection
    {
        return $this->departmentRepository->all();
    }

    /**
     * Create a department.
     *
     * @param  array<string, mixed>  $data
     */
    public function createDepartment(array $data): Department
    {
        return $this->departmentRepository->create($data);
    }

    /**
     * Update a department with circular hierarchy protection.
     *
     * @param  array<string, mixed>  $data
     */
    public function updateDepartment(string $departmentId, array $data): Department
    {
        if (! empty($data['parent_id']) && $data['parent_id'] === $departmentId) {
            throw new InvalidArgumentException('A department cannot be its own parent.');
        }

        return $this->departmentRepository->update($departmentId, $data);
    }

    /**
     * Delete a department.
     */
    public function deleteDepartment(string $departmentId): bool
    {
        return $this->departmentRepository->delete($departmentId);
    }

    /**
     * Assign or replace the Department Head (HOD) for a department.
     */
    public function assignDepartmentHead(string $departmentId, string $employeeId): \App\Models\DepartmentHead
    {
        $department = Department::findOrFail($departmentId);
        $employee = \App\Models\Employee::findOrFail($employeeId);

        return \Illuminate\Support\Facades\DB::transaction(function () use ($department, $employee): \App\Models\DepartmentHead {
            $existing = \App\Models\DepartmentHead::where('employee_id', $employee->id)
                ->where('department_id', '!=', $department->id)
                ->first();

            if ($existing !== null) {
                $otherDeptName = $existing->department?->name ?? 'another department';
                throw new InvalidArgumentException("Employee {$employee->full_name} is already appointed as Head of {$otherDeptName}.");
            }

            return \App\Models\DepartmentHead::updateOrCreate(
                ['department_id' => $department->id],
                [
                    'employee_id' => $employee->id,
                    'branch_id' => $employee->branch_id,
                    'company_id' => $employee->company_id ?? null,
                    'appointed_at' => now(),
                ]
            );
        });
    }

    /**
     * Remove the Department Head (HOD) from a department.
     */
    public function removeDepartmentHead(string $departmentId): bool
    {
        $head = \App\Models\DepartmentHead::where('department_id', $departmentId)->first();
        if ($head !== null) {
            return (bool) $head->delete();
        }

        return false;
    }
}
