<?php

declare(strict_types=1);

namespace App\Repositories\Eloquent;

use App\Models\Employee;
use App\Repositories\Contracts\EmployeeRepositoryInterface;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

final class EmployeeRepository implements EmployeeRepositoryInterface
{
    /**
     * @param  array<int, string>  $relations
     */
    public function findById(string $id, array $relations = ['department', 'designation', 'branch', 'paymentInfo', 'bankInfo', 'epfInfo']): ?Employee
    {
        return Employee::with($relations)->find($id);
    }

    public function findByEmpNo(string $empNo): ?Employee
    {
        return Employee::where('emp_no', $empNo)->first();
    }

    /**
     * @param  array<string, mixed>  $filters
     */
    public function paginate(int $perPage = 15, array $filters = []): LengthAwarePaginator
    {
        $query = Employee::with(['department', 'designation', 'branch', 'paymentInfo'])
            ->latest();

        if (! empty($filters['search'])) {
            $search = (string) $filters['search'];
            $query->where(function ($q) use ($search): void {
                $q->where('full_name', 'like', "%{$search}%")
                    ->orWhere('emp_no', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%");
            });
        }

        if (! empty($filters['department_id'])) {
            $query->where('department_id', $filters['department_id']);
        }

        if (! empty($filters['branch_id'])) {
            $query->where('branch_id', $filters['branch_id']);
        }

        if (! empty($filters['employment_status'])) {
            $query->where('employment_status', $filters['employment_status']);
        }

        return $query->paginate($perPage)->withQueryString();
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function create(array $data): Employee
    {
        return Employee::create($data);
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function update(string $id, array $data): Employee
    {
        $employee = Employee::findOrFail($id);
        $employee->update($data);

        return $employee->fresh(['department', 'designation', 'branch', 'paymentInfo', 'bankInfo', 'epfInfo']);
    }

    public function delete(string $id): bool
    {
        $employee = Employee::findOrFail($id);

        return (bool) $employee->delete();
    }

    public function getNextEmpNo(): string
    {
        $count = Employee::withTrashed()->count() + 1;

        return 'EMP-'.str_pad((string) $count, 4, '0', STR_PAD_LEFT);
    }
}
