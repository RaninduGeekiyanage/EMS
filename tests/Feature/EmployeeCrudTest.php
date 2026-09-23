<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Enums\EmploymentType;
use App\Models\Department;
use App\Models\Employee;
use App\Models\Tenant;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

final class EmployeeCrudTest extends TestCase
{
    use RefreshDatabase;

    public function test_displays_employee_index_with_filters(): void
    {
        $tenant = Tenant::create([
            'name' => 'Ceylon Tea Co',
            'slug' => 'ceylon-tea',
            'is_active' => true,
        ]);

        session(['tenant_id' => $tenant->id]);

        $dept = Department::create([
            'tenant_id' => $tenant->id,
            'name' => 'Plantation Ops',
        ]);

        Employee::create([
            'tenant_id' => $tenant->id,
            'emp_no' => 'EMP-001',
            'full_name' => 'Nuwan Pradeep',
            'nic' => '198511223344',
            'department_id' => $dept->id,
            'employment_type' => EmploymentType::Permanent,
            'employment_status' => 'active',
        ]);

        $response = $this->withHeaders([
            'X-Tenant-ID' => (string) $tenant->id,
        ])->get('/employees?search=Nuwan');

        $response->assertStatus(200);
    }

    public function test_displays_employee_create_screen(): void
    {
        $tenant = Tenant::create([
            'name' => 'Ceylon Exports',
            'slug' => 'ceylon-exp',
            'is_active' => true,
        ]);

        $response = $this->withHeaders([
            'X-Tenant-ID' => (string) $tenant->id,
        ])->get('/employees/create');

        $response->assertStatus(200);
    }

    public function test_can_store_employee_via_http_post(): void
    {
        $tenant = Tenant::create([
            'name' => 'Lanka Manufacturing',
            'slug' => 'lanka-mfg',
            'is_active' => true,
        ]);

        $department = Department::create([
            'tenant_id' => $tenant->id,
            'name' => 'Engineering',
        ]);

        $response = $this->withHeaders([
            'X-Tenant-ID' => (string) $tenant->id,
        ])->post('/employees', [
            'emp_no' => 'EMP-0050',
            'full_name' => 'Anura Kumara',
            'nic' => '198012345678',
            'department_id' => $department->id,
            'email' => 'anura.k@mfg.lk',
            'phone' => '+94712345678',
            'employment_type' => 'permanent',
            'employment_status' => 'active',
            'date_of_joining' => '2026-01-15',
            'biometric_device_id' => '1050',

            // Payment
            'payment_mode' => 'monthly',
            'basic_salary' => 150000.00,
            'effective_date' => '2026-01-15',

            // Bank
            'bank_name' => 'Hatton National Bank',
            'account_no' => '00987654321',
            'account_holder_name' => 'Anura Kumara',

            // EPF
            'is_epf_member' => true,
            'epf_no' => 'EPF-7766',
        ]);

        $response->assertRedirect('/employees');

        $employee = Employee::where('emp_no', 'EMP-0050')->first();
        $this->assertNotNull($employee);
        $this->assertEquals('Anura Kumara', $employee->full_name);
        $this->assertEquals('198012345678', $employee->nic);
        $this->assertEquals($department->id, $employee->department_id);
        $this->assertDatabaseHas('employee_payment_info', [
            'employee_id' => $employee->id,
            'payment_mode' => 'monthly',
        ]);
        $this->assertDatabaseHas('employee_epf_info', [
            'employee_id' => $employee->id,
            'epf_no' => 'EPF-7766',
        ]);
    }

    public function test_store_employee_fails_validation_without_department_id(): void
    {
        $tenant = Tenant::create([
            'name' => 'Lanka Manufacturing',
            'slug' => 'lanka-mfg-2',
            'is_active' => true,
        ]);

        $response = $this->withHeaders([
            'X-Tenant-ID' => (string) $tenant->id,
        ])->post('/employees', [
            'emp_no' => 'EMP-0051',
            'full_name' => 'Anura Kumara',
            'nic' => '198012345679',
            'department_id' => '',
            'employment_type' => 'permanent',
            'employment_status' => 'active',
            'payment_mode' => 'monthly',
        ]);

        $response->assertSessionHasErrors(['department_id']);
    }

    public function test_can_update_employee_via_http_put(): void
    {
        $tenant = Tenant::create([
            'name' => 'Lanka Foods',
            'slug' => 'lanka-foods',
            'is_active' => true,
        ]);

        session(['tenant_id' => $tenant->id]);

        $employee = Employee::create([
            'tenant_id' => $tenant->id,
            'emp_no' => 'EMP-0099',
            'full_name' => 'Old Name',
            'nic' => '199122334455',
            'employment_type' => EmploymentType::Probationary,
            'employment_status' => 'active',
        ]);

        $response = $this->withHeaders([
            'X-Tenant-ID' => (string) $tenant->id,
        ])->put("/employees/{$employee->id}", [
            'full_name' => 'New Full Name',
            'employment_type' => 'permanent',
            'employment_status' => 'active',
            'nic' => '199122334455',
            'payment_mode' => 'daily',
            'daily_rate' => 4000.00,
        ]);

        $response->assertRedirect('/employees');
        $this->assertEquals('New Full Name', $employee->fresh()->full_name);
    }

    public function test_can_soft_delete_employee(): void
    {
        $tenant = Tenant::create([
            'name' => 'Lanka Marine',
            'slug' => 'lanka-marine',
            'is_active' => true,
        ]);

        session(['tenant_id' => $tenant->id]);

        $employee = Employee::create([
            'tenant_id' => $tenant->id,
            'emp_no' => 'EMP-0088',
            'full_name' => 'Ruwan Silva',
            'nic' => '199333445566',
            'employment_type' => EmploymentType::Permanent,
            'employment_status' => 'active',
        ]);

        $response = $this->withHeaders([
            'X-Tenant-ID' => (string) $tenant->id,
        ])->delete("/employees/{$employee->id}");

        $response->assertRedirect('/employees');
        $this->assertSoftDeleted('employees', [
            'id' => $employee->id,
        ]);
    }

    public function test_tenant_isolation_on_employee_records(): void
    {
        $tenantA = Tenant::create([
            'name' => 'Tenant Alpha',
            'slug' => 'tenant-alpha',
            'is_active' => true,
        ]);

        $tenantB = Tenant::create([
            'name' => 'Tenant Bravo',
            'slug' => 'tenant-bravo',
            'is_active' => true,
        ]);

        session(['tenant_id' => $tenantA->id]);

        $empA = Employee::create([
            'tenant_id' => $tenantA->id,
            'emp_no' => 'EMP-ALPHA-01',
            'full_name' => 'Secret Alpha Worker',
            'nic' => '198000000001',
            'employment_type' => EmploymentType::Permanent,
            'employment_status' => 'active',
        ]);

        session()->flush();

        // Tenant B requests employees list
        $response = $this->withHeaders([
            'X-Tenant-ID' => (string) $tenantB->id,
        ])->get('/employees');

        $response->assertStatus(200);
        $paginated = $response->viewData('page')['props']['employees']['data'] ?? [];
        $names = collect($paginated)->pluck('full_name')->all();
        $this->assertNotContains('Secret Alpha Worker', $names);
    }
}
