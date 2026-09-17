<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\Tenant;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

final class AccessControlTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;
    private User $superAdmin;
    private User $owner;
    private User $staff;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(RolesAndPermissionsSeeder::class);

        $this->tenant = Tenant::create([
            'name' => 'Acme Corporation',
            'slug' => 'acme',
            'is_active' => true,
            'is_ams_enabled' => true,
            'is_payroll_enabled' => true,
        ]);

        if (function_exists('setPermissionsTeamId')) {
            setPermissionsTeamId($this->tenant->id);
        }

        $this->superAdmin = User::create([
            'name' => 'Platform Super Admin',
            'email' => 'superadmin@ems.test',
            'password' => bcrypt('password123'),
            'is_super_admin' => true,
            'email_verified_at' => now(),
        ]);

        $this->owner = User::create([
            'name' => 'Acme Owner',
            'email' => 'owner@acme.test',
            'password' => bcrypt('password123'),
            'tenant_id' => $this->tenant->id,
            'email_verified_at' => now(),
        ]);
        $this->owner->assignRole('Company Owner');

        $this->staff = User::create([
            'name' => 'Acme Staff',
            'email' => 'staff@acme.test',
            'password' => bcrypt('password123'),
            'tenant_id' => $this->tenant->id,
            'email_verified_at' => now(),
        ]);
        $this->staff->assignRole('Staff');
    }

    public function test_super_admin_can_view_global_access_control(): void
    {
        $response = $this->actingAs($this->superAdmin)
            ->get('/admin/access-control');

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('SuperAdmin/AccessControl')
            ->has('tenants')
            ->has('groupedPermissions')
            ->has('availableRoles')
        );
    }

    public function test_super_admin_can_grant_and_revoke_permissions_for_user_in_tenant(): void
    {
        if (function_exists('setPermissionsTeamId')) {
            setPermissionsTeamId($this->tenant->id);
        }

        // Grant direct permission 'attendance.import' and change role to 'Supervisor'
        $response = $this->actingAs($this->superAdmin)
            ->put("/admin/access-control/{$this->tenant->id}/users/{$this->staff->id}", [
                'role' => 'Supervisor',
                'direct_permissions' => ['attendance.import', 'payroll.export'],
            ]);

        $response->assertRedirect();
        $response->assertSessionHas('success');

        $this->staff->refresh();
        $this->assertTrue($this->staff->hasRole('Supervisor'));
        $this->assertTrue($this->staff->can('attendance.import'));
        $this->assertTrue($this->staff->can('payroll.export'));

        // Now test reset to role defaults
        $resetResponse = $this->actingAs($this->superAdmin)
            ->post("/admin/access-control/{$this->tenant->id}/users/{$this->staff->id}/reset");

        $resetResponse->assertRedirect();
        $resetResponse->assertSessionHas('success');

        $this->staff->refresh();
        $this->assertEmpty($this->staff->getDirectPermissions());
        $this->assertTrue($this->staff->hasRole('Supervisor'));
    }

    public function test_company_owner_can_view_tenant_access_control(): void
    {
        $response = $this->actingAs($this->owner)
            ->get('/access-control');

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('AccessControl/Index')
            ->has('users')
            ->has('groupedPermissions')
            ->has('availableRoles')
            ->where('canManageAccess', true)
        );
    }

    public function test_company_owner_can_update_staff_member_permissions(): void
    {
        if (function_exists('setPermissionsTeamId')) {
            setPermissionsTeamId($this->tenant->id);
        }

        $response = $this->actingAs($this->owner)
            ->put("/access-control/users/{$this->staff->id}", [
                'role' => 'HR Executive',
                'direct_permissions' => ['leave.manage-types'],
            ]);

        $response->assertRedirect();
        $response->assertSessionHas('success');

        $this->staff->refresh();
        $this->assertTrue($this->staff->hasRole('HR Executive'));
        $this->assertTrue($this->staff->can('leave.manage-types'));
    }

    public function test_anti_self_lockout_prevents_owner_from_demoting_themselves(): void
    {
        $response = $this->actingAs($this->owner)
            ->put("/access-control/users/{$this->owner->id}", [
                'role' => 'Staff',
                'direct_permissions' => [],
            ]);

        $response->assertSessionHasErrors(['role']);
    }

    public function test_anti_privilege_escalation_prevents_granting_tenant_manage(): void
    {
        $response = $this->actingAs($this->owner)
            ->put("/access-control/users/{$this->staff->id}", [
                'role' => 'Staff',
                'direct_permissions' => ['tenant.manage'],
            ]);

        $response->assertSessionHasErrors(['direct_permissions']);
    }

    public function test_staff_user_cannot_access_access_control(): void
    {
        $response = $this->actingAs($this->staff)
            ->get('/access-control');

        $response->assertForbidden();
    }
}
