<?php

declare(strict_types=1);

namespace App\Repositories\Eloquent;

use App\Models\Company;
use App\Repositories\Contracts\CompanyRepositoryInterface;
use App\Scopes\TenantScope;

final class CompanyRepository implements CompanyRepositoryInterface
{
    public function findById(string $id): ?Company
    {
        return Company::with('branches')->find($id);
    }

    public function findByTenant(string $tenantId): ?Company
    {
        return Company::withoutGlobalScope(TenantScope::class)
            ->where('tenant_id', $tenantId)
            ->with('branches')
            ->first();
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function create(array $data): Company
    {
        return Company::create($data);
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function update(string $id, array $data): Company
    {
        $company = Company::findOrFail($id);
        $company->update($data);

        return $company->fresh(['branches']);
    }

    public function delete(string $id): bool
    {
        $company = Company::findOrFail($id);

        return (bool) $company->delete();
    }
}
