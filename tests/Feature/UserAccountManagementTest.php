<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\Tenant;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

final class UserAccountManagementTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);
    }

    public function test_company_admin_can_view_users_page(): void
    {
        $tenant = Tenant::create([
            'name' => 'Ceylon Tea Co',
            'slug' => 'ceylon-tea',
            'is_active' => true,
        ]);

        $owner = User::create([
            'name' => 'Tea Owner',
            'email' => 'owner@ceylon.test',
            'password' => Hash::make('password123'),
            'tenant_id' => $tenant->id,
        ]);

        setPermissionsTeamId($tenant->id);
        $owner->assignRole('Company Owner');

        $staff = User::create([
            'name' => 'Staff Member',
            'email' => 'staff@ceylon.test',
            'password' => Hash::make('password123'),
            'tenant_id' => $tenant->id,
        ]);
        $staff->assignRole('Staff');

        $response = $this->actingAs($owner)
            ->withSession(['tenant_id' => $tenant->id])
            ->get('/users');

        $response->assertStatus(200);
    }

    public function test_company_admin_can_create_new_user(): void
    {
        $tenant = Tenant::create([
            'name' => 'Ceylon Tea Co',
            'slug' => 'ceylon-tea',
            'is_active' => true,
        ]);

        $owner = User::create([
            'name' => 'Tea Owner',
            'email' => 'owner@ceylon.test',
            'password' => Hash::make('password123'),
            'tenant_id' => $tenant->id,
        ]);

        setPermissionsTeamId($tenant->id);
        $owner->assignRole('Company Owner');

        $response = $this->actingAs($owner)
            ->withSession(['tenant_id' => $tenant->id])
            ->post('/users', [
                'name' => 'Kasun Manager',
                'email' => 'kasun@ceylon.test',
                'password' => 'secret1234',
                'password_confirmation' => 'secret1234',
                'role' => 'HR Manager',
            ]);

        $response->assertSessionHas('success');

        $this->assertDatabaseHas('users', [
            'name' => 'Kasun Manager',
            'email' => 'kasun@ceylon.test',
            'tenant_id' => $tenant->id,
        ]);

        $newUser = User::where('email', 'kasun@ceylon.test')->firstOrFail();
        setPermissionsTeamId($tenant->id);
        $this->assertTrue($newUser->hasRole('HR Manager'));
    }

    public function test_company_admin_can_reset_password_for_any_user_in_company(): void
    {
        $tenant = Tenant::create([
            'name' => 'Ceylon Tea Co',
            'slug' => 'ceylon-tea',
            'is_active' => true,
        ]);

        $owner = User::create([
            'name' => 'Tea Owner',
            'email' => 'owner@ceylon.test',
            'password' => Hash::make('password123'),
            'tenant_id' => $tenant->id,
        ]);

        setPermissionsTeamId($tenant->id);
        $owner->assignRole('Company Owner');

        $targetUser = User::create([
            'name' => 'Target User',
            'email' => 'target@ceylon.test',
            'password' => Hash::make('oldpassword'),
            'tenant_id' => $tenant->id,
        ]);

        $response = $this->actingAs($owner)
            ->withSession(['tenant_id' => $tenant->id])
            ->post("/users/{$targetUser->id}/reset-password", [
                'password' => 'brandnewpass999',
            ]);

        $response->assertSessionHas('success');

        $this->assertTrue(Hash::check('brandnewpass999', $targetUser->fresh()->password));
    }

    public function test_company_admin_cannot_reset_password_for_user_in_another_company(): void
    {
        $tenantA = Tenant::create([
            'name' => 'Company A',
            'slug' => 'company-a',
            'is_active' => true,
        ]);

        $tenantB = Tenant::create([
            'name' => 'Company B',
            'slug' => 'company-b',
            'is_active' => true,
        ]);

        $ownerA = User::create([
            'name' => 'Owner A',
            'email' => 'owner@companya.test',
            'password' => Hash::make('password123'),
            'tenant_id' => $tenantA->id,
        ]);

        setPermissionsTeamId($tenantA->id);
        $ownerA->assignRole('Company Owner');

        $userB = User::create([
            'name' => 'User B',
            'email' => 'user@companyb.test',
            'password' => Hash::make('originalpass123'),
            'tenant_id' => $tenantB->id,
        ]);

        $response = $this->actingAs($ownerA)
            ->withSession(['tenant_id' => $tenantA->id])
            ->post("/users/{$userB->id}/reset-password", [
                'password' => 'hackedpassword',
            ]);

        $response->assertStatus(403);
        $this->assertFalse(Hash::check('hackedpassword', $userB->fresh()->password));
    }

    public function test_super_admin_can_reset_company_admin_password_via_admin_route(): void
    {
        $superAdmin = User::create([
            'name' => 'Super Admin',
            'email' => 'superadmin@ems.test',
            'password' => Hash::make('admin123'),
            'tenant_id' => null,
            'is_super_admin' => true,
        ]);

        $tenant = Tenant::create([
            'name' => 'Global Corp',
            'slug' => 'global-corp',
            'is_active' => true,
        ]);

        $companyAdmin = User::create([
            'name' => 'Company Admin',
            'email' => 'admin@globalcorp.test',
            'password' => Hash::make('oldadminpass'),
            'tenant_id' => $tenant->id,
        ]);

        setPermissionsTeamId($tenant->id);
        $companyAdmin->assignRole('Company Admin');

        $response = $this->actingAs($superAdmin)
            ->post("/admin/users/{$companyAdmin->id}/reset-password", [
                'password' => 'supernewadminpass777',
            ]);

        $response->assertSessionHas('success');
        $this->assertTrue(Hash::check('supernewadminpass777', $companyAdmin->fresh()->password));
    }

    public function test_super_admin_can_reset_company_admin_password_via_tenant_users_route(): void
    {
        $superAdmin = User::create([
            'name' => 'Super Admin',
            'email' => 'superadmin@ems.test',
            'password' => Hash::make('admin123'),
            'tenant_id' => null,
            'is_super_admin' => true,
        ]);

        $tenant = Tenant::create([
            'name' => 'Global Corp',
            'slug' => 'global-corp',
            'is_active' => true,
        ]);

        $companyAdmin = User::create([
            'name' => 'Company Admin',
            'email' => 'admin@globalcorp.test',
            'password' => Hash::make('oldadminpass'),
            'tenant_id' => $tenant->id,
        ]);

        setPermissionsTeamId($tenant->id);
        $companyAdmin->assignRole('Company Admin');

        $response = $this->actingAs($superAdmin)
            ->withSession([
                'impersonated_tenant_id' => $tenant->id,
                'tenant_id' => $tenant->id,
            ])
            ->post("/users/{$companyAdmin->id}/reset-password", [
                'password' => 'impersonatednewpass888',
            ]);

        $response->assertSessionHas('success');
        $this->assertTrue(Hash::check('impersonatednewpass888', $companyAdmin->fresh()->password));
    }
}
