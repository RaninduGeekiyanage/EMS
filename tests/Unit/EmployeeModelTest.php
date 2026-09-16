<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Enums\EmploymentType;
use App\Enums\PaymentMode;
use App\Models\Branch;
use App\Models\Company;
use App\Models\Department;
use App\Models\Designation;
use App\Models\Employee;
use App\Models\Tenant;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

final class EmployeeModelTest extends TestCase
{
    use RefreshDatabase;

    public function test_employee_creation_with_ulid_and_encrypted_nic(): void
    {
        $tenant = Tenant::create([
            'name' => 'Lanka Retail',
            'slug' => 'lanka-retail',
            'is_active' => true,
        ]);

        session(['tenant_id' => $tenant->id]);

        $employee = Employee::create([
            'tenant_id' => $tenant->id,
            'emp_no' => 'EMP-001',
            'nic' => '199512345678',
            'full_name' => 'Nimal Jayasinghe',
            'employment_type' => EmploymentType::Permanent,
            'employment_status' => 'active',
        ]);

        $this->assertNotEmpty($employee->id);
        $this->assertEquals(26, strlen($employee->id));
        $this->assertEquals('199512345678', $employee->nic);

        // Check raw database storage is encrypted
        $raw = DB::table('employees')->where('id', $employee->id)->first();
        $this->assertNotEquals('199512345678', $raw->nic);
    }

    public function test_employee_relationships_and_payment_info(): void
    {
        $tenant = Tenant::create([
            'name' => 'Lanka Corp',
            'slug' => 'lanka-corp',
            'is_active' => true,
        ]);

        session(['tenant_id' => $tenant->id]);

        $company = Company::create(['tenant_id' => $tenant->id, 'name' => 'Lanka HQ']);
        $branch = Branch::create(['tenant_id' => $tenant->id, 'company_id' => $company->id, 'name' => 'Colombo']);
        $dept = Department::create(['tenant_id' => $tenant->id, 'name' => 'Finance']);
        $desig = Designation::create(['tenant_id' => $tenant->id, 'title' => 'Accountant']);

        $employee = Employee::create([
            'tenant_id' => $tenant->id,
            'emp_no' => 'EMP-002',
            'nic' => '199298765432',
            'full_name' => 'Sunil Perera',
            'department_id' => $dept->id,
            'designation_id' => $desig->id,
            'branch_id' => $branch->id,
            'employment_type' => EmploymentType::Permanent,
        ]);

        $employee->paymentInfo()->create([
            'tenant_id' => $tenant->id,
            'payment_mode' => PaymentMode::Monthly,
            'basic_salary' => 125000.00,
        ]);

        $employee->bankInfo()->create([
            'tenant_id' => $tenant->id,
            'bank_name' => 'Commercial Bank',
            'account_no' => '8001234567',
        ]);

        $employee->epfInfo()->create([
            'tenant_id' => $tenant->id,
            'is_epf_member' => true,
            'epf_no' => '54321',
        ]);

        $loaded = Employee::with(['department', 'designation', 'branch', 'paymentInfo', 'bankInfo', 'epfInfo'])->find($employee->id);

        $this->assertEquals('Finance', $loaded->department->name);
        $this->assertEquals('Accountant', $loaded->designation->title);
        $this->assertEquals('Colombo', $loaded->branch->name);
        $this->assertEquals(PaymentMode::Monthly, $loaded->paymentInfo->payment_mode);
        $this->assertEquals('125000.00', $loaded->paymentInfo->basic_salary);
        $this->assertEquals('8001234567', $loaded->bankInfo->account_no);
        $this->assertTrue($loaded->epfInfo->is_epf_member);

        // Verify bank account_no is encrypted in database
        $rawBank = DB::table('employee_bank_info')->where('employee_id', $employee->id)->first();
        $this->assertNotEquals('8001234567', $rawBank->account_no);
    }
}
