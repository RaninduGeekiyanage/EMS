<?php

declare(strict_types=1);

namespace Tests\Feature\M01;

use App\Enums\EmploymentType;
use App\Enums\PaymentMode;
use App\Models\Branch;
use App\Models\Company;
use App\Models\Department;
use App\Models\Designation;
use App\Models\Employee;
use App\Models\Tenant;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

final class EmployeeCrudTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;
    private User $manager;
    private User $staff;
    private Company $company;
    private Department $department;
    private Branch $branch;
    private Designation $designation;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);

        $this->tenant = Tenant::create([
            'name' => 'Lanka Plantations Ltd',
            'slug' => 'lanka-plantations',
            'is_active' => true,
        ]);

        session(['tenant_id' => $this->tenant->id]);
        setPermissionsTeamId($this->tenant->id);

        $this->company = Company::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Lanka Plantations PLC',
        ]);

        $this->department = Department::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Agriculture & Estates',
        ]);

        $this->branch = Branch::create([
            'tenant_id' => $this->tenant->id,
            'company_id' => $this->company->id,
            'name' => 'Nuwara Eliya Estate',
            'code' => 'NE-01',
        ]);

        $this->designation = Designation::create([
            'tenant_id' => $this->tenant->id,
            'title' => 'Estate Field Officer',
            'code' => 'EFO',
        ]);

        $this->manager = User::factory()->create(['email' => 'hr.manager@lankaplantations.lk']);
        $this->manager->assignRole('HR Manager');

        $this->staff = User::factory()->create(['email' => 'viewer@lankaplantations.lk']);
        $this->staff->assignRole('Staff');
    }

    public function test_displays_employee_index_for_authorized_user(): void
    {
        Employee::create([
            'tenant_id' => $this->tenant->id,
            'emp_no' => 'EMP-001',
            'full_name' => 'Nuwan Pradeep',
            'nic' => '198511223344',
            'department_id' => $this->department->id,
            'branch_id' => $this->branch->id,
            'designation_id' => $this->designation->id,
            'employment_type' => EmploymentType::Permanent,
            'employment_status' => 'active',
        ]);

        $response = $this->actingAs($this->manager)
            ->withHeaders(['X-Tenant-ID' => (string) $this->tenant->id])
            ->get('/employees?search=Nuwan');

        $response->assertStatus(200);
    }

    public function test_displays_employee_create_screen_for_authorized_user(): void
    {
        $response = $this->actingAs($this->manager)
            ->withHeaders(['X-Tenant-ID' => (string) $this->tenant->id])
            ->get('/employees/create');

        $response->assertStatus(200);
    }

    public function test_can_store_employee_via_http_post(): void
    {
        $payload = [
            'emp_no' => 'EMP-101',
            'full_name' => 'Kasun Chamara',
            'calling_name' => 'Kasun',
            'nic' => '199201019999',
            'department_id' => $this->department->id,
            'branch_id' => $this->branch->id,
            'designation_id' => $this->designation->id,
            'employment_type' => 'permanent',
            'employment_status' => 'active',
            'date_joined' => '2026-01-15',
            'payment_mode' => 'monthly',
            'basic_salary' => 85000.00,
            'payment_method' => 'bank_transfer',
            'bank_name' => 'Bank of Ceylon',
            'branch_name' => 'Kandy Branch',
            'account_number' => '76543210',
            'account_name' => 'K C Perera',
            'is_epf_member' => true,
            'epf_no' => 'EPF-78901',
        ];

        $response = $this->actingAs($this->manager)
            ->withHeaders(['X-Tenant-ID' => (string) $this->tenant->id])
            ->post('/employees', $payload);

        $response->assertRedirect('/employees');
        $this->assertDatabaseHas('employees', [
            'tenant_id' => $this->tenant->id,
            'emp_no' => 'EMP-101',
            'full_name' => 'Kasun Chamara',
        ]);
        $this->assertDatabaseHas('employee_payment_info', [
            'tenant_id' => $this->tenant->id,
            'payment_mode' => PaymentMode::Monthly->value,
            'basic_salary' => 85000.00,
        ]);
        $this->assertDatabaseHas('employee_epf_info', [
            'tenant_id' => $this->tenant->id,
            'epf_no' => 'EPF-78901',
            'is_epf_member' => true,
        ]);
    }

    public function test_can_update_employee_via_http_put(): void
    {
        $emp = Employee::create([
            'tenant_id' => $this->tenant->id,
            'emp_no' => 'EMP-102',
            'full_name' => 'Sunil Shantha',
            'nic' => '198001018888',
            'department_id' => $this->department->id,
            'branch_id' => $this->branch->id,
            'designation_id' => $this->designation->id,
            'employment_type' => EmploymentType::Permanent,
            'employment_status' => 'active',
        ]);

        $payload = [
            'emp_no' => 'EMP-102',
            'full_name' => 'Sunil Shantha Updated',
            'nic' => '198001018888',
            'department_id' => $this->department->id,
            'branch_id' => $this->branch->id,
            'designation_id' => $this->designation->id,
            'employment_type' => 'permanent',
            'employment_status' => 'active',
            'payment_mode' => 'monthly',
            'basic_salary' => 95000.00,
        ];

        $response = $this->actingAs($this->manager)
            ->withHeaders(['X-Tenant-ID' => (string) $this->tenant->id])
            ->put("/employees/{$emp->id}", $payload);

        $response->assertRedirect('/employees');
        $this->assertDatabaseHas('employees', [
            'id' => $emp->id,
            'full_name' => 'Sunil Shantha Updated',
        ]);
    }

    public function test_can_soft_delete_employee(): void
    {
        $emp = Employee::create([
            'tenant_id' => $this->tenant->id,
            'emp_no' => 'EMP-103',
            'full_name' => 'Kamal Silva',
            'nic' => '198201017777',
            'department_id' => $this->department->id,
            'employment_type' => EmploymentType::Contract,
            'employment_status' => 'active',
        ]);

        $response = $this->actingAs($this->manager)
            ->withHeaders(['X-Tenant-ID' => (string) $this->tenant->id])
            ->delete("/employees/{$emp->id}");

        $response->assertRedirect('/employees');
        $this->assertSoftDeleted('employees', [
            'id' => $emp->id,
        ]);
    }

    public function test_rbac_unauthorized_user_receives_403_forbidden(): void
    {
        // Staff role has employee.view, but not employee.create or employee.delete
        $createResponse = $this->actingAs($this->staff)
            ->withHeaders(['X-Tenant-ID' => (string) $this->tenant->id])
            ->get('/employees/create');

        $createResponse->assertStatus(403);

        $postResponse = $this->actingAs($this->staff)
            ->withHeaders(['X-Tenant-ID' => (string) $this->tenant->id])
            ->post('/employees', [
                'emp_no' => 'EMP-FORBIDDEN',
                'full_name' => 'Forbidden Employee',
                'nic' => '199999999999',
            ]);

        $postResponse->assertStatus(403);
    }

    public function test_rbac_sensitive_data_masked_for_user_without_permission(): void
    {
        Employee::create([
            'tenant_id' => $this->tenant->id,
            'emp_no' => 'EMP-SENSITIVE',
            'full_name' => 'Sensitive Data Employee',
            'nic' => '198765432100',
            'department_id' => $this->department->id,
            'employment_type' => EmploymentType::Permanent,
            'employment_status' => 'active',
        ]);

        // Staff does NOT have 'employee.view-sensitive'
        $response = $this->actingAs($this->staff)
            ->withHeaders(['X-Tenant-ID' => (string) $this->tenant->id])
            ->get('/employees');

        $response->assertStatus(200);
        $employees = $response->viewData('page')['props']['employees']['data'];
        $this->assertNotEmpty($employees);
        $emp = $employees[0];
        $this->assertEquals('********2100', $emp['nic']);
    }
}
