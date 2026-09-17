<?php

declare(strict_types=1);

namespace Tests\Unit\Payroll;

use App\Models\Department;
use App\Models\Employee;
use App\Models\EmployeeEpfInfo;
use App\Models\Tenant;
use App\Services\Statutory\EpfEtfCalculatorService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

final class EpfCalculationTest extends TestCase
{
    use RefreshDatabase;

    private EpfEtfCalculatorService $calculator;
    private Tenant $tenant;

    protected function setUp(): void
    {
        parent::setUp();

        $this->calculator = new EpfEtfCalculatorService();

        $this->tenant = Tenant::create([
            'name' => 'Lanka Garments Ltd',
            'slug' => 'lanka-garments',
            'is_active' => true,
            'is_payroll_enabled' => true,
        ]);

        session(['tenant_id' => $this->tenant->id]);
        app()->instance('current_tenant_id', $this->tenant->id);
    }

    public function test_standard_statutory_rates_calculation_8_12_3(): void
    {
        $epfEligibleEarnings = 100000.00;
        $grossPay = 120000.00;

        $result = $this->calculator->calculate(
            epfEligibleEarnings: $epfEligibleEarnings,
            grossPay: $grossPay,
            isCompanyEpfEnabled: true,
            isEmployeeEpfMember: true
        );

        $this->assertTrue($result['is_epf_eligible']);
        $this->assertEquals(100000.00, $result['epf_eligible_earnings']);
        $this->assertEquals(8.00, $result['epf_employee_rate']);
        $this->assertEquals(8000.00, $result['epf_employee']);
        $this->assertEquals(12.00, $result['epf_employer_rate']);
        $this->assertEquals(12000.00, $result['epf_employer']);
        $this->assertEquals(20000.00, $result['total_epf']);
        $this->assertEquals(3.00, $result['etf_employer_rate']);
        $this->assertEquals(3600.00, $result['etf_employer']); // 3% of 120,000
        $this->assertEquals(23600.00, $result['total_statutory']);
    }

    public function test_statutory_calculation_precision_and_rounding(): void
    {
        $epfEligibleEarnings = 33333.33;
        $grossPay = 44444.44;

        $result = $this->calculator->calculate(
            epfEligibleEarnings: $epfEligibleEarnings,
            grossPay: $grossPay
        );

        // 33,333.33 * 0.08 = 2,666.6664 => 2,666.67
        $this->assertEquals(2666.67, $result['epf_employee']);
        // 33,333.33 * 0.12 = 3,999.9996 => 4,000.00
        $this->assertEquals(4000.00, $result['epf_employer']);
        $this->assertEquals(6666.67, $result['total_epf']);
        // 44,444.44 * 0.03 = 1,333.3332 => 1,333.33
        $this->assertEquals(1333.33, $result['etf_employer']);
        $this->assertEquals(8000.00, $result['total_statutory']);
    }

    public function test_statutory_calculation_with_company_epf_disabled(): void
    {
        $result = $this->calculator->calculate(
            epfEligibleEarnings: 80000.00,
            grossPay: 95000.00,
            isCompanyEpfEnabled: false,
            isEmployeeEpfMember: true
        );

        $this->assertFalse($result['is_epf_eligible']);
        $this->assertEquals(0.00, $result['epf_employee']);
        $this->assertEquals(0.00, $result['epf_employer']);
        $this->assertEquals(0.00, $result['total_epf']);
        $this->assertEquals(0.00, $result['etf_employer']);
        $this->assertEquals(0.00, $result['total_statutory']);
    }

    public function test_statutory_calculation_for_non_epf_member_employee(): void
    {
        $result = $this->calculator->calculate(
            epfEligibleEarnings: 150000.00,
            grossPay: 150000.00,
            isCompanyEpfEnabled: true,
            isEmployeeEpfMember: false
        );

        $this->assertFalse($result['is_epf_eligible']);
        $this->assertEquals(0.00, $result['epf_employee']);
        $this->assertEquals(0.00, $result['epf_employer']);
        $this->assertEquals(0.00, $result['total_epf']);
        $this->assertEquals(0.00, $result['etf_employer']);
        $this->assertEquals(0.00, $result['total_statutory']);
    }

    public function test_custom_tenant_rates_override(): void
    {
        $this->tenant->setSetting('epf_employee_rate', 10.00);
        $this->tenant->setSetting('epf_employer_rate', 15.00);
        $this->tenant->setSetting('etf_employer_rate', 3.00);

        $result = $this->calculator->calculate(
            epfEligibleEarnings: 50000.00,
            grossPay: 60000.00,
            isCompanyEpfEnabled: true,
            isEmployeeEpfMember: true,
            tenant: $this->tenant
        );

        $this->assertEquals(10.00, $result['epf_employee_rate']);
        $this->assertEquals(5000.00, $result['epf_employee']); // 10% of 50,000
        $this->assertEquals(15.00, $result['epf_employer_rate']);
        $this->assertEquals(7500.00, $result['epf_employer']); // 15% of 50,000
        $this->assertEquals(12500.00, $result['total_epf']);
        $this->assertEquals(1800.00, $result['etf_employer']); // 3% of 60,000
        $this->assertEquals(14300.00, $result['total_statutory']);
    }

    public function test_explicit_rate_overrides_take_precedence(): void
    {
        $result = $this->calculator->calculate(
            epfEligibleEarnings: 100000.00,
            grossPay: 100000.00,
            isCompanyEpfEnabled: true,
            isEmployeeEpfMember: true,
            tenant: $this->tenant,
            employeeRateOverride: 9.00,
            employerEpfRateOverride: 14.00,
            etfRateOverride: 4.00
        );

        $this->assertEquals(9.00, $result['epf_employee_rate']);
        $this->assertEquals(9000.00, $result['epf_employee']);
        $this->assertEquals(14.00, $result['epf_employer_rate']);
        $this->assertEquals(14000.00, $result['epf_employer']);
        $this->assertEquals(4.00, $result['etf_employer_rate']);
        $this->assertEquals(4000.00, $result['etf_employer']);
    }

    public function test_zero_and_negative_earnings_handling(): void
    {
        $zeroResult = $this->calculator->calculate(
            epfEligibleEarnings: 0.00,
            grossPay: 0.00
        );

        $this->assertEquals(0.00, $zeroResult['epf_employee']);
        $this->assertEquals(0.00, $zeroResult['epf_employer']);
        $this->assertEquals(0.00, $zeroResult['etf_employer']);
        $this->assertEquals(0.00, $zeroResult['total_statutory']);

        $negativeResult = $this->calculator->calculate(
            epfEligibleEarnings: -5000.00,
            grossPay: -5000.00
        );

        $this->assertEquals(0.00, $negativeResult['epf_employee']);
        $this->assertEquals(0.00, $negativeResult['epf_employer']);
        $this->assertEquals(0.00, $negativeResult['etf_employer']);
        $this->assertEquals(0.00, $negativeResult['total_statutory']);
    }

    public function test_calculate_for_employee_model_helper(): void
    {
        $department = Department::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Finance & Compliance',
        ]);

        $employee = Employee::create([
            'tenant_id' => $this->tenant->id,
            'emp_no' => 'EMP-FIN-01',
            'full_name' => 'Dilshan Rodrigo',
            'nic' => '199201020304',
            'department_id' => $department->id,
            'employment_type' => 'permanent',
            'employment_status' => 'active',
        ]);

        EmployeeEpfInfo::create([
            'tenant_id' => $this->tenant->id,
            'employee_id' => $employee->id,
            'is_epf_member' => true,
            'epf_no' => 'EPF-7890',
        ]);

        $employee->load('epfInfo');

        $result = $this->calculator->calculateForEmployee(
            employee: $employee,
            epfEligibleEarnings: 75000.00,
            grossPay: 82000.00,
            tenant: $this->tenant
        );

        $this->assertTrue($result['is_epf_eligible']);
        $this->assertEquals(6000.00, $result['epf_employee']);
        $this->assertEquals(9000.00, $result['epf_employer']);
        $this->assertEquals(2460.00, $result['etf_employer']);
    }
}
