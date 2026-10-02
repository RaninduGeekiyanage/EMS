<?php

declare(strict_types=1);

namespace Tests\Feature\M04;

use App\Models\Branch;
use App\Models\Company;
use App\Models\Department;
use App\Models\DepartmentHead;
use App\Models\Employee;
use App\Models\PayrollRun;
use App\Models\Payslip;
use App\Models\Tenant;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

final class EmployeePortalAndHodAuthorityTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;
    private User $admin;
    private User $hodUser;
    private User $staffUser;
    private Employee $hodEmployee;
    private Employee $staffEmployee;
    private Department $department;
    private Company $company;
    private Branch $branch;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);

        $this->tenant = Tenant::create([
            'name' => 'Lanka Industries Ltd',
            'slug' => 'lanka-ind',
            'is_active' => true,
            'is_ams_enabled' => true,
            'is_payroll_enabled' => true,
        ]);

        session(['tenant_id' => $this->tenant->id]);
        if (function_exists('setPermissionsTeamId')) {
            setPermissionsTeamId($this->tenant->id);
        }

        $this->company = Company::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Lanka HQ',
        ]);

        $this->branch = Branch::create([
            'tenant_id' => $this->tenant->id,
            'company_id' => $this->company->id,
            'name' => 'Colombo Branch',
        ]);

        $this->department = Department::create([
            'tenant_id' => $this->tenant->id,
            'company_id' => $this->company->id,
            'name' => 'Engineering',
            'code' => 'ENG',
        ]);

        $this->admin = User::factory()->create([
            'tenant_id' => $this->tenant->id,
            'email' => 'admin@lanka.com',
            'is_super_admin' => false,
        ]);
        $this->admin->assignRole('Company Admin');

        $this->hodUser = User::factory()->create([
            'tenant_id' => $this->tenant->id,
            'email' => 'hod@lanka.com',
            'is_super_admin' => false,
        ]);
        $this->hodUser->assignRole('Staff');

        $this->hodEmployee = Employee::create([
            'tenant_id' => $this->tenant->id,
            'company_id' => $this->company->id,
            'branch_id' => $this->branch->id,
            'department_id' => $this->department->id,
            'emp_no' => 'EMP-001',
            'full_name' => 'Kasun Perera',
            'email' => 'hod@lanka.com',
            'nic' => '199012345678',
            'employment_status' => 'active',
            'is_active' => true,
        ]);

        DepartmentHead::create([
            'tenant_id' => $this->tenant->id,
            'department_id' => $this->department->id,
            'employee_id' => $this->hodEmployee->id,
            'is_active' => true,
            'assigned_date' => '2024-01-01',
        ]);

        $this->staffUser = User::factory()->create([
            'tenant_id' => $this->tenant->id,
            'email' => 'staff@lanka.com',
            'is_super_admin' => false,
        ]);
        $this->staffUser->assignRole('Staff');

        $this->staffEmployee = Employee::create([
            'tenant_id' => $this->tenant->id,
            'company_id' => $this->company->id,
            'branch_id' => $this->branch->id,
            'department_id' => $this->department->id,
            'emp_no' => 'EMP-002',
            'full_name' => 'Nimal Silva',
            'email' => 'staff@lanka.com',
            'nic' => '199212345678',
            'employment_status' => 'active',
            'is_active' => true,
        ]);
    }

    public function test_staff_can_view_my_attendance_portal(): void
    {
        $response = $this->actingAs($this->staffUser)
            ->withHeaders(['X-Tenant-ID' => $this->tenant->id])
            ->get('/portal/attendance');

        $response->assertOk();
    }

    public function test_staff_can_view_my_leaves_portal(): void
    {
        $response = $this->actingAs($this->staffUser)
            ->withHeaders(['X-Tenant-ID' => $this->tenant->id])
            ->get('/portal/leaves');

        $response->assertOk();
    }

    public function test_staff_can_view_my_payslips_portal(): void
    {
        $response = $this->actingAs($this->staffUser)
            ->withHeaders(['X-Tenant-ID' => $this->tenant->id])
            ->get('/portal/payslips');

        $response->assertOk();
    }

    public function test_staff_cannot_download_foreign_payslip(): void
    {
        $payrollRun = PayrollRun::create([
            'tenant_id' => $this->tenant->id,
            'period_year' => 2026,
            'period_month' => 1,
            'status' => 'paid',
        ]);

        // Payslip belonging to HOD
        $hodPayslip = \App\Models\PayrollEmployee::create([
            'tenant_id' => $this->tenant->id,
            'payroll_run_id' => $payrollRun->id,
            'employee_id' => $this->hodEmployee->id,
            'gross_pay' => 150000,
            'net_pay' => 135000,
            'basic_salary' => 100000,
            'payment_mode' => 'bank_transfer',
        ]);

        // Attempting to download HOD payslip as staff user must be forbidden (403)
        $response = $this->actingAs($this->staffUser)
            ->withHeaders(['X-Tenant-ID' => $this->tenant->id])
            ->get("/portal/payslips/{$hodPayslip->id}/download");

        $response->assertForbidden();
    }

    public function test_admin_can_manage_hod_authority_permissions(): void
    {
        // 1. Grant all HOD permissions
        $response = $this->actingAs($this->admin)
            ->withHeaders(['X-Tenant-ID' => $this->tenant->id])
            ->post("/access-control/users/{$this->hodUser->id}/hod-authority", [
                'action' => 'grant_all',
            ]);

        $response->assertRedirect();
        $this->hodUser->refresh();
        $this->assertTrue($this->hodUser->hasPermissionTo('attendance.hod_approve_regularization'));
        $this->assertTrue($this->hodUser->hasPermissionTo('attendance.hod_approve_ot'));
        $this->assertTrue($this->hodUser->hasPermissionTo('shift_swap.approve_department'));
        $this->assertTrue($this->hodUser->hasPermissionTo('leave.approve'));
        $this->assertTrue($this->hodUser->hasPermissionTo('evaluation.hod_submit'));
        $this->assertTrue($this->hodUser->hasPermissionTo('attendance.period_freeze'));

        // 2. Toggle one permission off
        $response = $this->actingAs($this->admin)
            ->withHeaders(['X-Tenant-ID' => $this->tenant->id])
            ->post("/access-control/users/{$this->hodUser->id}/hod-authority", [
                'action' => 'toggle',
                'permission' => 'attendance.period_freeze',
            ]);

        $response->assertRedirect();
        $this->hodUser->refresh();
        $this->assertFalse($this->hodUser->hasPermissionTo('attendance.period_freeze'));

        // 3. Revoke all HOD permissions
        $response = $this->actingAs($this->admin)
            ->withHeaders(['X-Tenant-ID' => $this->tenant->id])
            ->post("/access-control/users/{$this->hodUser->id}/hod-authority", [
                'action' => 'revoke_all',
            ]);

        $response->assertRedirect();
        $this->hodUser->refresh();
        $this->assertFalse($this->hodUser->hasPermissionTo('attendance.hod_approve_regularization'));
        $this->assertFalse($this->hodUser->hasPermissionTo('attendance.hod_approve_ot'));
    }
}
