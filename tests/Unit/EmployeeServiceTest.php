<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Enums\EmploymentType;
use App\Enums\PaymentMode;
use App\Models\Tenant;
use App\Services\EmployeeService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

final class EmployeeServiceTest extends TestCase
{
    use RefreshDatabase;

    private EmployeeService $employeeService;

    protected function setUp(): void
    {
        parent::setUp();
        $this->employeeService = app(EmployeeService::class);
    }

    public function test_can_create_employee_with_sub_profiles_in_transaction(): void
    {
        $tenant = Tenant::create([
            'name' => 'Orion Tech',
            'slug' => 'orion',
            'is_active' => true,
        ]);

        session(['tenant_id' => $tenant->id]);

        $employee = $this->employeeService->createEmployee(
            employeeData: [
                'tenant_id' => $tenant->id,
                'full_name' => 'Kamal Wickramasinghe',
                'nic' => '198811223344',
                'employment_type' => EmploymentType::Permanent,
                'employment_status' => 'active',
            ],
            paymentData: [
                'tenant_id' => $tenant->id,
                'payment_mode' => PaymentMode::Daily,
                'daily_rate' => 3500.00,
            ],
            bankData: [
                'tenant_id' => $tenant->id,
                'bank_name' => 'Sampath Bank',
                'account_no' => '001234567890',
            ],
            epfData: [
                'tenant_id' => $tenant->id,
                'is_epf_member' => true,
                'epf_no' => '9988',
            ]
        );

        $this->assertNotNull($employee->id);
        $this->assertStringStartsWith('EMP-', $employee->emp_no);
        $this->assertEquals('Kamal Wickramasinghe', $employee->full_name);
        $this->assertEquals(PaymentMode::Daily, $employee->paymentInfo->payment_mode);
        $this->assertEquals('3500.00', $employee->paymentInfo->daily_rate);
        $this->assertEquals('001234567890', $employee->bankInfo->account_no);
        $this->assertEquals('9988', $employee->epfInfo->epf_no);
    }

    public function test_can_update_employee_profiles(): void
    {
        $tenant = Tenant::create([
            'name' => 'Apex Solutions',
            'slug' => 'apex-sol',
            'is_active' => true,
        ]);

        session(['tenant_id' => $tenant->id]);

        $employee = $this->employeeService->createEmployee(
            employeeData: [
                'tenant_id' => $tenant->id,
                'emp_no' => 'EMP-100',
                'full_name' => 'Initial Name',
                'nic' => '199011112222',
                'employment_type' => EmploymentType::Probationary,
                'employment_status' => 'active',
            ],
            paymentData: [
                'tenant_id' => $tenant->id,
                'payment_mode' => PaymentMode::Hourly,
                'hourly_rate' => 500.00,
            ]
        );

        $updated = $this->employeeService->updateEmployee(
            id: (string) $employee->id,
            employeeData: [
                'full_name' => 'Confirmed Name',
                'employment_type' => EmploymentType::Permanent,
            ],
            paymentData: [
                'payment_mode' => PaymentMode::Monthly,
                'basic_salary' => 95000.00,
            ]
        );

        $this->assertEquals('Confirmed Name', $updated->full_name);
        $this->assertEquals(EmploymentType::Permanent, $updated->employment_type);
        $this->assertEquals(PaymentMode::Monthly, $updated->paymentInfo->payment_mode);
        $this->assertEquals('95000.00', $updated->paymentInfo->basic_salary);
    }
}
