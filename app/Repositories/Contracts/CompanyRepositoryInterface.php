<?php

declare(strict_types=1);

namespace App\Repositories\Contracts;

use App\Models\Company;

interface CompanyRepositoryInterface
{
    public function findById(string $id): ?Company;

    public function findByTenant(string $tenantId): ?Company;

    /**
     * @param  array<string, mixed>  $data
     */
    public function create(array $data): Company;

    /**
     * @param  array<string, mixed>  $data
     */
    public function update(string $id, array $data): Company;

    public function delete(string $id): bool;
}
