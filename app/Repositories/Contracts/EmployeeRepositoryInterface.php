<?php

declare(strict_types=1);

namespace App\Repositories\Contracts;

use App\Models\Employee;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

interface EmployeeRepositoryInterface
{
    /**
     * @param  array<int, string>  $relations
     */
    public function findById(string $id, array $relations = ['department', 'designation', 'branch', 'paymentInfo', 'bankInfo', 'epfInfo']): ?Employee;

    public function findByEmpNo(string $empNo): ?Employee;

    /**
     * @param  array<string, mixed>  $filters
     */
    public function paginate(int $perPage = 15, array $filters = []): LengthAwarePaginator;

    /**
     * @param  array<string, mixed>  $data
     */
    public function create(array $data): Employee;

    /**
     * @param  array<string, mixed>  $data
     */
    public function update(string $id, array $data): Employee;

    public function delete(string $id): bool;

    public function getNextEmpNo(): string;
}
