<?php

declare(strict_types=1);

namespace App\Repositories\Eloquent;

use App\Models\Department;
use App\Repositories\Contracts\DepartmentRepositoryInterface;
use Illuminate\Database\Eloquent\Collection;

final class DepartmentRepository implements DepartmentRepositoryInterface
{
    public function findById(string $id): ?Department
    {
        return Department::with(['parent', 'children'])->find($id);
    }

    /**
     * @return Collection<int, Department>
     */
    public function all(): Collection
    {
        return Department::with(['parent', 'head.employee:id,emp_no,full_name,email'])->orderBy('name')->get();
    }

    /**
     * @return Collection<int, Department>
     */
    public function getTree(): Collection
    {
        return Department::whereNull('parent_id')
            ->with([
                'head.employee:id,emp_no,full_name,email',
                'children.head.employee:id,emp_no,full_name,email',
                'children.children',
            ])
            ->orderBy('name')
            ->get();
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function create(array $data): Department
    {
        return Department::create($data);
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function update(string $id, array $data): Department
    {
        $department = Department::findOrFail($id);
        $department->update($data);

        return $department->fresh(['parent', 'children']);
    }

    public function delete(string $id): bool
    {
        $department = Department::findOrFail($id);

        return (bool) $department->delete();
    }
}
