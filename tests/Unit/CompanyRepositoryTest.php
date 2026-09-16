<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Models\Branch;
use App\Models\Company;
use App\Models\Tenant;
use App\Repositories\Contracts\CompanyRepositoryInterface;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

final class CompanyRepositoryTest extends TestCase
{
    use RefreshDatabase;

    private CompanyRepositoryInterface $repository;

    protected function setUp(): void
    {
        parent::setUp();
        $this->repository = app(CompanyRepositoryInterface::class);
    }

    public function test_can_create_and_find_company_by_tenant(): void
    {
        $tenant = Tenant::create([
            'name' => 'Acme Corp',
            'slug' => 'acme',
            'is_active' => true,
        ]);

        $company = $this->repository->create([
            'tenant_id' => $tenant->id,
            'name' => 'Acme Holding PVT LTD',
            'br_number' => 'PV12345',
            'epf_number' => 'EPF-999',
            'etf_number' => 'ETF-888',
        ]);

        $this->assertNotEmpty($company->id);
        $this->assertEquals(26, strlen($company->id));
        $this->assertEquals('Acme Holding PVT LTD', $company->name);

        $found = $this->repository->findByTenant((string) $tenant->id);
        $this->assertNotNull($found);
        $this->assertEquals($company->id, $found->id);
    }

    public function test_can_update_company_profile(): void
    {
        $tenant = Tenant::create([
            'name' => 'Beta Industries',
            'slug' => 'beta',
            'is_active' => true,
        ]);

        $company = $this->repository->create([
            'tenant_id' => $tenant->id,
            'name' => 'Initial Name',
            'email' => 'old@beta.lk',
        ]);

        $updated = $this->repository->update((string) $company->id, [
            'name' => 'Updated Name PVT LTD',
            'email' => 'new@beta.lk',
            'phone' => '+94112345678',
        ]);

        $this->assertEquals('Updated Name PVT LTD', $updated->name);
        $this->assertEquals('new@beta.lk', $updated->email);
    }

    public function test_branch_relationship(): void
    {
        $tenant = Tenant::create([
            'name' => 'Gamma Logistics',
            'slug' => 'gamma',
            'is_active' => true,
        ]);

        session(['tenant_id' => $tenant->id]);

        $company = Company::create([
            'tenant_id' => $tenant->id,
            'name' => 'Gamma Main',
        ]);

        $branch = Branch::create([
            'tenant_id' => $tenant->id,
            'company_id' => $company->id,
            'name' => 'Colombo Fort Branch',
            'is_head_office' => true,
        ]);

        $this->assertEquals(1, $company->branches()->count());
        $this->assertEquals($company->id, $branch->company->id);
    }
}
