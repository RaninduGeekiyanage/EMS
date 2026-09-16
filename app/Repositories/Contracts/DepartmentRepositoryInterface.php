<?php

declare(strict_types=1);

namespace App\Repositories\Contracts;

use App\Models\Department;
use Illuminate\Database\Eloquent\Collection;

interface DepartmentRepositoryInterface
{
    public function findById(string $id): ?Department;

    /**
     * @return Collection<int, Department>
     */
    public function all(): Collection;

    /**
     * @return Collection<int, Department>
     */
    public function getTree(): Collection;

    /**
     * @param  array<string, mixed>  $data
     */
    public function create(array $data): Department;

    /**
     * @param  array<string, mixed>  $data
     */
    public function update(string $id, array $data): Department;

    public function delete(string $id): bool;
}
