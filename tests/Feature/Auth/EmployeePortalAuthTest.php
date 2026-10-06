<?php

declare(strict_types=1);

namespace Tests\Feature\Auth;

use App\Models\Employee;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

final class EmployeePortalAuthTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;
    private Employee $employee;
    private User $user;

    protected function setUp(): void
    {
        parent::setUp();

        $this->tenant = Tenant::create([
            'name' => 'Ceylon Tea Corp',
            'slug' => 'ceylon-tea',
            'is_active' => true,
        ]);

        $this->employee = Employee::create([
            'tenant_id' => $this->tenant->id,
            'emp_no' => '1002',
            'full_name' => 'Nimal Perera',
            'nic' => '199012345678',
            'email' => null,
            'phone' => '0771234567',
            'hire_date' => '2025-01-01',
            'status' => 'active',
        ]);

        setPermissionsTeamId($this->tenant->id);
        $staffRole = Role::firstOrCreate(['name' => 'Staff', 'guard_name' => 'web']);

        $this->user = User::create([
            'tenant_id' => $this->tenant->id,
            'employee_id' => $this->employee->id,
            'name' => 'Nimal Perera',
            'username' => 'EMP1002',
            'email' => null,
            'phone' => '0771234567',
            'password' => Hash::make('123456'),
            'must_change_password' => true,
        ]);

        $this->user->assignRole($staffRole);
    }

    public function test_employee_can_login_with_emp_prefix_and_redirects_to_force_password_change(): void
    {
        $response = $this->post('/login', [
            'login' => 'EMP1002',
            'password' => '123456',
        ]);

        $this->assertAuthenticatedAs($this->user);
        $response->assertRedirect('/force-password-change');
    }

    public function test_employee_can_login_with_pure_numeric_emp_no(): void
    {
        $response = $this->post('/login', [
            'login' => '1002',
            'password' => '123456',
        ]);

        $this->assertAuthenticatedAs($this->user);
        $response->assertRedirect('/force-password-change');
    }

    public function test_forced_password_change_middleware_blocks_access_to_portal_dashboard(): void
    {
        $response = $this->actingAs($this->user)->get('/portal/dashboard');
        $response->assertRedirect('/force-password-change');
    }

    public function test_employee_can_update_password_and_access_portal_dashboard(): void
    {
        $response = $this->actingAs($this->user)->post('/force-password-change', [
            'current_password' => '123456',
            'password' => 'NewPassword@2026',
            'password_confirmation' => 'NewPassword@2026',
        ]);

        $response->assertRedirect('/portal/dashboard');

        $this->user->refresh();
        $this->assertFalse((bool) $this->user->must_change_password);
        $this->assertTrue(Hash::check('NewPassword@2026', $this->user->password));

        $dashboardResponse = $this->actingAs($this->user)->get('/portal/dashboard');
        $dashboardResponse->assertStatus(200);
    }
}
