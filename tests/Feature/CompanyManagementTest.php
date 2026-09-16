<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\Branch;
use App\Models\Company;
use App\Models\Department;
use App\Models\Tenant;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

final class CompanyManagementTest extends TestCase
{
    use RefreshDatabase;

    public function test_displays_company_profile_for_active_tenant(): void
    {
        $tenant = Tenant::create([
            'name' => 'Lanka Retailers',
            'slug' => 'lanka-ret',
            'is_active' => true,
        ]);

        $response = $this->withHeaders([
            'X-Tenant-ID' => (string) $tenant->id,
        ])->get('/company/profile');

        $response->assertStatus(200);
        $this->assertDatabaseHas('companies', [
            'tenant_id' => $tenant->id,
        ]);
    }

    public function test_can_update_company_profile(): void
    {
        $tenant = Tenant::create([
            'name' => 'Lanka Logistics',
            'slug' => 'lanka-log',
            'is_active' => true,
        ]);

        $company = Company::create([
            'tenant_id' => $tenant->id,
            'name' => 'Original Name',
        ]);

        $response = $this->withHeaders([
            'X-Tenant-ID' => (string) $tenant->id,
        ])->put("/company/{$company->id}", [
            'name' => 'Lanka Logistics Holdings PVT LTD',
            'br_number' => 'PV98765',
            'epf_number' => 'EPF/COL/1234',
            'etf_number' => 'ETF/5678',
            'email' => 'info@lankalogistics.lk',
            'phone' => '+94112000000',
            'address' => 'No 45, Galle Road, Colombo 03',
        ]);

        $response->assertRedirect();
        $this->assertDatabaseHas('companies', [
            'id' => $company->id,
            'name' => 'Lanka Logistics Holdings PVT LTD',
            'br_number' => 'PV98765',
            'epf_number' => 'EPF/COL/1234',
        ]);
    }

    public function test_branch_crud_operations(): void
    {
        $tenant = Tenant::create([
            'name' => 'Apex Enterprises',
            'slug' => 'apex',
            'is_active' => true,
        ]);

        $company = Company::create([
            'tenant_id' => $tenant->id,
            'name' => 'Apex Main',
        ]);

        // Create branch
        $createResponse = $this->withHeaders([
            'X-Tenant-ID' => (string) $tenant->id,
        ])->post('/branches', [
            'company_id' => (string) $company->id,
            'name' => 'Kandy Branch',
            'code' => 'KDY-01',
            'phone' => '+94812233445',
            'is_head_office' => true,
            'is_active' => true,
        ]);

        $createResponse->assertRedirect();
        $branch = Branch::where('company_id', $company->id)->first();
        $this->assertNotNull($branch);
        $this->assertEquals('Kandy Branch', $branch->name);
        $this->assertTrue($branch->is_head_office);

        // Update branch
        $updateResponse = $this->withHeaders([
            'X-Tenant-ID' => (string) $tenant->id,
        ])->put("/branches/{$branch->id}", [
            'name' => 'Kandy Regional Office',
            'code' => 'KDY-REG',
        ]);

        $updateResponse->assertRedirect();
        $this->assertDatabaseHas('branches', [
            'id' => $branch->id,
            'name' => 'Kandy Regional Office',
            'code' => 'KDY-REG',
        ]);

        // Delete branch (soft delete)
        $deleteResponse = $this->withHeaders([
            'X-Tenant-ID' => (string) $tenant->id,
        ])->delete("/branches/{$branch->id}");

        $deleteResponse->assertRedirect();
        $this->assertSoftDeleted('branches', [
            'id' => $branch->id,
        ]);
    }

    public function test_department_crud_and_hierarchy(): void
    {
        $tenant = Tenant::create([
            'name' => 'Vertex Solutions',
            'slug' => 'vertex',
            'is_active' => true,
        ]);

        // 1. Index
        $indexResponse = $this->withHeaders([
            'X-Tenant-ID' => (string) $tenant->id,
        ])->get('/departments');
        $indexResponse->assertStatus(200);

        // 2. Create Parent
        $parentResponse = $this->withHeaders([
            'X-Tenant-ID' => (string) $tenant->id,
        ])->post('/departments', [
            'name' => 'Human Resources',
            'code' => 'HR',
            'cost_center' => 'CC-HR',
            'is_active' => true,
        ]);
        $parentResponse->assertRedirect();
        $parent = Department::where('code', 'HR')->first();
        $this->assertNotNull($parent);

        // 3. Create Child
        $childResponse = $this->withHeaders([
            'X-Tenant-ID' => (string) $tenant->id,
        ])->post('/departments', [
            'name' => 'Talent Acquisition',
            'code' => 'HR-TA',
            'parent_id' => (string) $parent->id,
            'cost_center' => 'CC-HR-TA',
            'is_active' => true,
        ]);
        $childResponse->assertRedirect();
        $child = Department::where('code', 'HR-TA')->first();
        $this->assertNotNull($child);
        $this->assertEquals($parent->id, $child->parent_id);

        // 4. Update
        $updateResponse = $this->withHeaders([
            'X-Tenant-ID' => (string) $tenant->id,
        ])->put("/departments/{$child->id}", [
            'name' => 'Talent Acquisition & Onboarding',
        ]);
        $updateResponse->assertRedirect();
        $this->assertDatabaseHas('departments', [
            'id' => $child->id,
            'name' => 'Talent Acquisition & Onboarding',
        ]);

        // 5. Delete
        $deleteResponse = $this->withHeaders([
            'X-Tenant-ID' => (string) $tenant->id,
        ])->delete("/departments/{$child->id}");
        $deleteResponse->assertRedirect();
        $this->assertSoftDeleted('departments', [
            'id' => $child->id,
        ]);
    }

    public function test_tenant_isolation_on_organization_resources(): void
    {
        $tenantA = Tenant::create([
            'name' => 'Tenant A Corp',
            'slug' => 'tenant-a',
            'is_active' => true,
        ]);

        $tenantB = Tenant::create([
            'name' => 'Tenant B Corp',
            'slug' => 'tenant-b',
            'is_active' => true,
        ]);

        session(['tenant_id' => $tenantA->id]);

        $deptA = Department::create([
            'tenant_id' => $tenantA->id,
            'name' => 'Secret Dept A',
            'code' => 'SEC-A',
        ]);

        // Switch to Tenant B session/request
        session()->flush();

        // Tenant B requests departments index
        $response = $this->withHeaders([
            'X-Tenant-ID' => (string) $tenantB->id,
        ])->get('/departments');

        $response->assertStatus(200);

        // Department from Tenant A should not be visible to Tenant B
        $tree = $response->viewData('page')['props']['departments'] ?? [];
        $deptNames = collect($tree)->pluck('name')->all();
        $this->assertNotContains('Secret Dept A', $deptNames);
    }
}
