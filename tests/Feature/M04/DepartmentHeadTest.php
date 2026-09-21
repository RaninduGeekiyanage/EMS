<?php

declare(strict_types=1);

namespace Tests\Feature\M04;

use App\Models\Branch;
use App\Models\Company;
use App\Models\Department;
use App\Models\DepartmentHead;
use App\Models\Employee;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

final class DepartmentHeadTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;
    private User $admin;
    private Company $company;
    private Branch $branch;
    private Department $deptA;
    private Department $deptB;
    private Employee $emp1;
    private Employee $emp2;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(\Database\Seeders\RolesAndPermissionsSeeder::class);

        $this->tenant = Tenant::create([
            'name' => 'Apex Enterprises',
            'slug' => 'apex',
            'is_active' => true,
        ]);

        session(['tenant_id' => $this->tenant->id]);
        if (function_exists('setPermissionsTeamId')) {
            setPermissionsTeamId($this->tenant->id);
        }

        $this->admin = User::factory()->create([
            'tenant_id' => $this->tenant->id,
            'is_super_admin' => false,
        ]);
        $this->admin->assignRole('Company Admin');

        $this->company = Company::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Apex HQ',
        ]);

        $this->branch = Branch::create([
            'tenant_id' => $this->tenant->id,
            'company_id' => $this->company->id,
            'name' => 'Colombo Branch',
            'code' => 'COL-01',
        ]);

        $this->deptA = Department::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Engineering',
            'code' => 'ENG',
        ]);

        $this->deptB = Department::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Finance',
            'code' => 'FIN',
        ]);

        $this->emp1 = Employee::create([
            'tenant_id' => $this->tenant->id,
            'emp_no' => 'EMP-001',
            'full_name' => 'Kasun Perera',
            'nic' => '199012345678',
            'department_id' => $this->deptA->id,
            'branch_id' => $this->branch->id,
            'employment_status' => 'active',
        ]);

        $this->emp2 = Employee::create([
            'tenant_id' => $this->tenant->id,
            'emp_no' => 'EMP-002',
            'full_name' => 'Dilini Silva',
            'nic' => '199212345678',
            'department_id' => $this->deptA->id,
            'branch_id' => $this->branch->id,
            'employment_status' => 'active',
        ]);
    }

    public function test_can_assign_and_change_department_head(): void
    {
        // 1. Assign emp1 as HOD of deptA
        $response = $this->actingAs($this->admin)->post("/departments/{$this->deptA->id}/hod", [
            'employee_id' => $this->emp1->id,
        ]);

        $response->assertRedirect();
        $this->assertDatabaseHas('department_heads', [
            'tenant_id' => $this->tenant->id,
            'department_id' => $this->deptA->id,
            'employee_id' => $this->emp1->id,
        ]);

        // 2. Replace with emp2 (atomic change)
        $response2 = $this->actingAs($this->admin)->post("/departments/{$this->deptA->id}/hod", [
            'employee_id' => $this->emp2->id,
        ]);

        $response2->assertRedirect();
        $this->assertDatabaseHas('department_heads', [
            'tenant_id' => $this->tenant->id,
            'department_id' => $this->deptA->id,
            'employee_id' => $this->emp2->id,
        ]);

        // Department only has 1 active HOD
        $this->assertSame(1, DepartmentHead::where('department_id', $this->deptA->id)->count());
    }

    public function test_prevents_single_employee_from_heading_multiple_departments(): void
    {
        // Assign emp1 to deptA
        $this->actingAs($this->admin)->post("/departments/{$this->deptA->id}/hod", [
            'employee_id' => $this->emp1->id,
        ]);

        // Attempt to assign emp1 to deptB as well
        $response = $this->actingAs($this->admin)->post("/departments/{$this->deptB->id}/hod", [
            'employee_id' => $this->emp1->id,
        ]);

        $response->assertSessionHasErrors(['employee_id']);
        $this->assertDatabaseMissing('department_heads', [
            'department_id' => $this->deptB->id,
            'employee_id' => $this->emp1->id,
        ]);
    }

    public function test_can_remove_department_head(): void
    {
        $this->actingAs($this->admin)->post("/departments/{$this->deptA->id}/hod", [
            'employee_id' => $this->emp1->id,
        ]);

        $response = $this->actingAs($this->admin)->delete("/departments/{$this->deptA->id}/hod");
        $response->assertRedirect();

        $this->assertSoftDeleted('department_heads', [
            'department_id' => $this->deptA->id,
            'employee_id' => $this->emp1->id,
        ]);
    }
}
