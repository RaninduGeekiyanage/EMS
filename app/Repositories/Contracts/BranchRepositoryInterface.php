<?php

declare(strict_types=1);

namespace App\Repositories\Contracts;

use App\Models\Branch;
use Illuminate\Database\Eloquent\Collection;

interface BranchRepositoryInterface
{
    public function findById(string $id): ?Branch;

    /**
     * @return Collection<int, Branch>
     */
    public function findByCompany(string $companyId): Collection;

    /**
     * @param  array<string, mixed>  $data
     */
    public function create(array $data): Branch;

    /**
     * @param  array<string, mixed>  $data
     */
    public function update(string $id, array $data): Branch;

    public function delete(string $id): bool;
}
