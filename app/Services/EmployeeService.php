<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\Employee;
use App\Repositories\Contracts\EmployeeRepositoryInterface;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;

final class EmployeeService
{
    public function __construct(
        private readonly EmployeeRepositoryInterface $employeeRepository,
    ) {}

    /**
     * Paginate employees with filters.
     *
     * @param  array<string, mixed>  $filters
     */
    public function paginateEmployees(int $perPage = 15, array $filters = []): LengthAwarePaginator
    {
        return $this->employeeRepository->paginate($perPage, $filters);
    }

    /**
     * Find employee by ID with related profiles.
     */
    public function getEmployee(string $id): ?Employee
    {
        return $this->employeeRepository->findById($id);
    }

    /**
     * Get auto-generated next employee number.
     */
    public function getNextEmpNo(): string
    {
        return $this->employeeRepository->getNextEmpNo();
    }

    /**
     * Create employee and associated payment, bank, and EPF records in a transaction.
     *
     * @param  array<string, mixed>  $employeeData
     * @param  array<string, mixed>  $paymentData
     * @param  array<string, mixed>  $bankData
     * @param  array<string, mixed>  $epfData
     */
    public function createEmployee(
        array $employeeData,
        array $paymentData = [],
        array $bankData = [],
        array $epfData = []
    ): Employee {
        return DB::transaction(function () use ($employeeData, $paymentData, $bankData, $epfData): Employee {
            if (empty($employeeData['emp_no'])) {
                $employeeData['emp_no'] = $this->employeeRepository->getNextEmpNo();
            }

            $employee = $this->employeeRepository->create($employeeData);

            // 1. Payment Info
            if (! empty($paymentData)) {
                $employee->paymentInfo()->create($paymentData);
            }

            // 2. Bank Info
            if (! empty($bankData)) {
                $employee->bankInfo()->create($bankData);
            }

            // 3. EPF Info
            if (! empty($epfData)) {
                $employee->epfInfo()->create($epfData);
            }

            // 4. Auto-initialize statutory leave balances for employee joining year
            try {
                $joiningYear = $employee->date_of_joining ? \Carbon\Carbon::parse($employee->date_of_joining)->year : (int) date('Y');
                app(LeaveService::class)->allocateEntitlements((string) $employee->tenant_id, $joiningYear, (string) $employee->id);
            } catch (\Throwable $e) {
                // Log and gracefully continue without failing employee creation
                \Illuminate\Support\Facades\Log::warning("Auto-allocation of leave entitlements failed for employee {$employee->id}: " . $e->getMessage());
            }

            return $employee->fresh(['department', 'designation', 'branch', 'jobGrade', 'wagesBoardCategory', 'paymentInfo', 'bankInfo', 'epfInfo']);
        });
    }

    /**
     * Update employee profile and linked sub-records.
     *
     * @param  array<string, mixed>  $employeeData
     * @param  array<string, mixed>|null  $paymentData
     * @param  array<string, mixed>|null  $bankData
     * @param  array<string, mixed>|null  $epfData
     */
    public function updateEmployee(
        string $id,
        array $employeeData,
        ?array $paymentData = null,
        ?array $bankData = null,
        ?array $epfData = null
    ): Employee {
        return DB::transaction(function () use ($id, $employeeData, $paymentData, $bankData, $epfData): Employee {
            $employee = $this->employeeRepository->update($id, $employeeData);

            if ($paymentData !== null) {
                $employee->paymentInfo()->updateOrCreate([], $paymentData);
            }

            if ($bankData !== null) {
                $employee->bankInfo()->updateOrCreate([], $bankData);
            }

            if ($epfData !== null) {
                $employee->epfInfo()->updateOrCreate([], $epfData);
            }

            return $employee->fresh(['department', 'designation', 'branch', 'paymentInfo', 'bankInfo', 'epfInfo']);
        });
    }

    /**
     * Soft delete an employee.
     */
    public function deleteEmployee(string $id): bool
    {
        return $this->employeeRepository->delete($id);
    }
}
