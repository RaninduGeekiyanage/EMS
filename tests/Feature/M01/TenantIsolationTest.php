<?php

declare(strict_types=1);

namespace Tests\Feature\M01;

use App\Enums\EmploymentType;
use App\Models\Branch;
use App\Models\Company;
use App\Models\Department;
use App\Models\Employee;
use App\Models\Tenant;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

final class TenantIsolationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);
    }

    public function test_resolves_tenant_via_x_tenant_id_header(): void
    {
        $tenant = Tenant::create([
            'name' => 'Ceylon Tea Co',
            'slug' => 'ceylon-tea',
            'is_active' => true,
        ]);

        $response = $this->withHeaders([
            'X-Tenant-ID' => (string) $tenant->id,
        ])->get('/departments');

        $response->assertStatus(200);
        $this->assertEquals($tenant->id, session('tenant_id'));
    }

    public function test_resolves_tenant_via_x_tenant_slug_header(): void
    {
        $tenant = Tenant::create([
            'name' => 'Highland Spices',
            'slug' => 'highland-spices',
            'is_active' => true,
        ]);

        $response = $this->withHeaders([
            'X-Tenant-Slug' => 'highland-spices',
        ])->get('/departments');

        $response->assertStatus(200);
        $this->assertEquals($tenant->id, session('tenant_id'));
    }

    public function test_resolves_tenant_via_query_parameter(): void
    {
        $tenant = Tenant::create([
            'name' => 'Lanka Logistics',
            'slug' => 'lanka-logistics',
            'is_active' => true,
        ]);

        $response = $this->get('/departments?tenant=lanka-logistics');

        $response->assertStatus(200);
        $this->assertEquals($tenant->id, session('tenant_id'));
    }

    public function test_blocks_inactive_tenant_with_forbidden(): void
    {
        $tenant = Tenant::create([
            'name' => 'Suspended Co',
            'slug' => 'suspended',
            'is_active' => false,
        ]);

        $response = $this->withHeaders([
            'X-Tenant-ID' => (string) $tenant->id,
        ])->get('/departments');

        $response->assertStatus(403);
    }

    public function test_returns_404_when_required_tenant_is_missing(): void
    {
        $response = $this->get('/departments');

        $response->assertStatus(404);
    }

    public function test_tenant_data_isolation_prevents_cross_tenant_data_leakage(): void
    {
        $tenantA = Tenant::create(['name' => 'Tenant Alpha', 'slug' => 'alpha', 'is_active' => true]);
        $tenantB = Tenant::create(['name' => 'Tenant Beta', 'slug' => 'beta', 'is_active' => true]);

        Company::create([
            'tenant_id' => $tenantA->id,
            'name' => 'Alpha Holdings Ltd',
        ]);

        Company::create([
            'tenant_id' => $tenantB->id,
            'name' => 'Beta Logistics Ltd',
        ]);

        $deptA = Department::create(['tenant_id' => $tenantA->id, 'name' => 'Engineering Alpha']);
        Department::create(['tenant_id' => $tenantB->id, 'name' => 'Operations Beta']);

        Employee::create([
            'tenant_id' => $tenantA->id,
            'emp_no' => 'A-001',
            'full_name' => 'Alpha Employee',
            'nic' => '199011111111',
            'department_id' => $deptA->id,
            'employment_type' => EmploymentType::Permanent,
            'employment_status' => 'active',
        ]);

        // Request as Tenant A
        session(['tenant_id' => $tenantA->id]);
        $employeesA = Employee::all();
        $this->assertCount(1, $employeesA);
        $this->assertEquals('A-001', $employeesA->first()->emp_no);

        // Request as Tenant B
        session(['tenant_id' => $tenantB->id]);
        $employeesB = Employee::all();
        $this->assertCount(0, $employeesB);
    }

    public function test_multi_tenant_rbac_isolation_between_teams(): void
    {
        $tenantA = Tenant::create(['name' => 'Tenant Alpha', 'slug' => 'alpha', 'is_active' => true]);
        $tenantB = Tenant::create(['name' => 'Tenant Beta', 'slug' => 'beta', 'is_active' => true]);

        $user = User::factory()->create(['email' => 'manager@alpha.com']);

        // Assign HR Manager role to user exclusively under Tenant A
        setPermissionsTeamId($tenantA->id);
        $user->assignRole('HR Manager');

        // Check user has permission under Tenant A
        $this->assertTrue($user->hasPermissionTo('employee.create'));

        // Switch to Tenant B context
        setPermissionsTeamId($tenantB->id);
        $user->unsetRelation('roles')->unsetRelation('permissions');
        $this->assertFalse($user->hasPermissionTo('employee.create'));

        // Attempting to access Tenant B as this user must return 403 Forbidden
        $response = $this->actingAs($user)
            ->withHeaders(['X-Tenant-ID' => (string) $tenantB->id])
            ->get('/employees/create');

        $response->assertStatus(403);
    }
}
