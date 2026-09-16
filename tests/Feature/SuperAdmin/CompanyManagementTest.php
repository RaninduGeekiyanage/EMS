<?php

declare(strict_types=1);

namespace Tests\Feature\SuperAdmin;

use App\Models\Tenant;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

final class CompanyManagementTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);
    }

    public function test_super_admin_can_view_platform_dashboard(): void
    {
        $superAdmin = User::create([
            'name' => 'Super Admin',
            'email' => 'superadmin@ems.test',
            'password' => Hash::make('password123'),
            'tenant_id' => null,
            'is_super_admin' => true,
        ]);

        $response = $this->actingAs($superAdmin)->get('/admin/dashboard');

        $response->assertStatus(200);
    }

    public function test_super_admin_can_provision_company_and_owner(): void
    {
        $superAdmin = User::create([
            'name' => 'Super Admin',
            'email' => 'superadmin@ems.test',
            'password' => Hash::make('password123'),
            'tenant_id' => null,
            'is_super_admin' => true,
        ]);

        $response = $this->actingAs($superAdmin)->post('/admin/companies', [
            'name' => 'Lanka Freight Ltd',
            'slug' => 'lanka-freight',
            'owner_name' => 'Kasun Silva',
            'owner_email' => 'kasun@lankafreight.com',
            'owner_password' => 'pass123456',
            'is_ams_enabled' => true,
            'is_payroll_enabled' => false,
        ]);

        $response->assertSessionHas('success');

        $this->assertDatabaseHas('tenants', [
            'name' => 'Lanka Freight Ltd',
            'slug' => 'lanka-freight',
            'is_ams_enabled' => true,
            'is_payroll_enabled' => false,
        ]);

        $tenant = Tenant::where('slug', 'lanka-freight')->firstOrFail();

        $this->assertDatabaseHas('users', [
            'email' => 'kasun@lankafreight.com',
            'tenant_id' => $tenant->id,
        ]);
    }

    public function test_super_admin_can_reset_company_owner_password(): void
    {
        $superAdmin = User::create([
            'name' => 'Super Admin',
            'email' => 'superadmin@ems.test',
            'password' => Hash::make('password123'),
            'tenant_id' => null,
            'is_super_admin' => true,
        ]);

        $tenant = Tenant::create([
            'name' => 'Apex Co',
            'slug' => 'apex',
            'is_active' => true,
        ]);

        $owner = User::create([
            'name' => 'Apex Owner',
            'email' => 'owner@apex.test',
            'password' => Hash::make('oldpassword'),
            'tenant_id' => $tenant->id,
        ]);

        $response = $this->actingAs($superAdmin)->post("/admin/companies/{$tenant->id}/reset-admin-password", [
            'password' => 'brandnewpass123',
        ]);

        $response->assertSessionHas('success');
        $this->assertTrue(Hash::check('brandnewpass123', (string) $owner->fresh()->password));
    }

    public function test_super_admin_can_toggle_module_access(): void
    {
        $superAdmin = User::create([
            'name' => 'Super Admin',
            'email' => 'superadmin@ems.test',
            'password' => Hash::make('password123'),
            'tenant_id' => null,
            'is_super_admin' => true,
        ]);

        $tenant = Tenant::create([
            'name' => 'Tea Corp',
            'slug' => 'tea-corp',
            'is_active' => true,
            'is_ams_enabled' => true,
            'is_payroll_enabled' => true,
        ]);

        $this->actingAs($superAdmin)->post("/admin/companies/{$tenant->id}/toggle-module/ams");

        $this->assertFalse($tenant->fresh()->is_ams_enabled);
    }

    public function test_super_admin_can_impersonate_company_and_exit(): void
    {
        $superAdmin = User::create([
            'name' => 'Super Admin',
            'email' => 'superadmin@ems.test',
            'password' => Hash::make('password123'),
            'tenant_id' => null,
            'is_super_admin' => true,
        ]);

        $tenant = Tenant::create([
            'name' => 'Tea Corp',
            'slug' => 'tea-corp',
            'is_active' => true,
        ]);

        $response = $this->actingAs($superAdmin)->post("/admin/companies/{$tenant->id}/impersonate");

        $response->assertRedirect('/dashboard');
        $this->assertEquals($tenant->id, session('impersonated_tenant_id'));

        // Exit
        $exitResponse = $this->actingAs($superAdmin)->post('/admin/impersonate/exit');
        $exitResponse->assertRedirect('/admin/dashboard');
        $this->assertNull(session('impersonated_tenant_id'));
    }
}
