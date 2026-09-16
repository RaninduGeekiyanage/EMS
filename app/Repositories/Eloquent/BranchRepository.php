<?php

declare(strict_types=1);

namespace App\Repositories\Eloquent;

use App\Models\Branch;
use App\Repositories\Contracts\BranchRepositoryInterface;
use Illuminate\Database\Eloquent\Collection;

final class BranchRepository implements BranchRepositoryInterface
{
    public function findById(string $id): ?Branch
    {
        return Branch::with('company')->find($id);
    }

    /**
     * @return Collection<int, Branch>
     */
    public function findByCompany(string $companyId): Collection
    {
        return Branch::where('company_id', $companyId)->get();
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function create(array $data): Branch
    {
        return Branch::create($data);
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function update(string $id, array $data): Branch
    {
        $branch = Branch::findOrFail($id);
        $branch->update($data);

        return $branch->fresh();
    }

    public function delete(string $id): bool
    {
        $branch = Branch::findOrFail($id);

        return (bool) $branch->delete();
    }
}
