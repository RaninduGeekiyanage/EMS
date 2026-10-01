<?php

declare(strict_types=1);

namespace Tests\Feature\M04;

use App\Models\AttendanceDaily;
use App\Models\Department;
use App\Models\Employee;
use App\Models\EmployeeEpfInfo;
use App\Models\EmployeeLoan;
use App\Models\EmployeeLoanInstallment;
use App\Models\EmployeePaymentInfo;
use App\Models\EmployeePayItem;
use App\Models\PayItem;
use App\Models\PayrollMonthlyAdjustment;
use App\Models\PayrollRun;
use App\Models\Tenant;
use App\Models\User;
use App\Services\PayrollCalculationService;
use App\Services\Payroll\PayItemService;
use App\Services\Payroll\StaffLoanService;
use Carbon\Carbon;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

final class PayrollPhaseThreeTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;
    private User $hrManager;
    private Department $department;
    private Employee $employee;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);

        $this->tenant = Tenant::create([
            'name' => 'Lanka Garments & Apparel Ltd',
            'slug' => 'lanka-garments',
            'is_active' => true,
            'is_ams_enabled' => true,
            'is_payroll_enabled' => true,
        ]);

        session(['tenant_id' => $this->tenant->id]);
        app()->instance('current_tenant_id', $this->tenant->id);
        app()->instance('current_tenant', $this->tenant);
        if (function_exists('setPermissionsTeamId')) {
            setPermissionsTeamId($this->tenant->id);
        }

        $this->hrManager = User::factory()->create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Payroll Controller',
            'email' => 'payroll@lankagarments.lk',
        ]);
        $this->hrManager->assignRole('HR Manager');

        $this->department = Department::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Quality Assurance',
        ]);

        $this->employee = Employee::create([
            'tenant_id' => $this->tenant->id,
            'emp_no' => 'EMP-050',
            'full_name' => 'Nimal Wijesinghe',
            'nic' => '198811223344',
            'department_id' => $this->department->id,
            'employment_type' => 'permanent',
            'employment_status' => 'active',
        ]);

        EmployeePaymentInfo::create([
            'tenant_id' => $this->tenant->id,
            'employee_id' => $this->employee->id,
            'payment_mode' => 'monthly',
            'basic_salary' => 80000.00,
            'effective_date' => '2026-01-01',
        ]);

        EmployeeEpfInfo::create([
            'tenant_id' => $this->tenant->id,
            'employee_id' => $this->employee->id,
            'is_epf_member' => true,
            'epf_no' => 'EPF-5050',
        ]);
    }

    public function test_can_view_pay_items_master_dashboard(): void
    {
        $response = $this->actingAs($this->hrManager)
            ->withSession(['tenant_id' => $this->tenant->id])
            ->get('/payroll/pay-items');

        $response->assertStatus(200)
            ->assertInertia(fn ($page) => $page
                ->component('Payroll/PayItems')
                ->has('payItems')
                ->has('employeePayItems')
                ->has('employees')
                ->has('metrics')
            );
    }

    public function test_can_seed_standard_sri_lankan_pay_items(): void
    {
        $response = $this->actingAs($this->hrManager)
            ->withSession(['tenant_id' => $this->tenant->id])
            ->post('/payroll/pay-items/seed-statutory');

        $response->assertRedirect();
        $this->assertDatabaseHas('pay_items', [
            'tenant_id' => $this->tenant->id,
            'code' => 'BRA_2005',
            'is_epf_eligible' => true,
            'default_amount' => 1000.00,
        ]);
        $this->assertDatabaseHas('pay_items', [
            'tenant_id' => $this->tenant->id,
            'code' => 'BRA_2016',
            'is_epf_eligible' => true,
            'default_amount' => 2500.00,
        ]);
        $this->assertDatabaseHas('pay_items', [
            'tenant_id' => $this->tenant->id,
            'code' => 'ATTENDANCE_INCENTIVE',
            'is_epf_eligible' => false,
        ]);
    }

    public function test_can_create_custom_pay_item_and_assign_to_employee(): void
    {
        $createResponse = $this->actingAs($this->hrManager)
            ->withSession(['tenant_id' => $this->tenant->id])
            ->post('/payroll/pay-items', [
                'code' => 'SPECIAL_SKILL_ALLOWANCE',
                'name' => 'Special Technical Skill Allowance',
                'item_type' => 'earning',
                'calculation_type' => 'fixed',
                'default_amount' => 15000.00,
                'is_epf_eligible' => false,
                'is_taxable' => true,
                'is_active' => true,
            ]);

        $createResponse->assertRedirect();
        $payItem = PayItem::where('tenant_id', $this->tenant->id)->where('code', 'SPECIAL_SKILL_ALLOWANCE')->first();
        $this->assertNotNull($payItem);

        $assignResponse = $this->actingAs($this->hrManager)
            ->withSession(['tenant_id' => $this->tenant->id])
            ->post('/payroll/pay-items/assign-employee', [
                'employee_id' => $this->employee->id,
                'pay_item_id' => $payItem->id,
                'amount' => 15000.00,
                'effective_from' => '2026-01-01',
                'is_active' => true,
            ]);

        $assignResponse->assertRedirect();
        $this->assertDatabaseHas('employee_pay_items', [
            'tenant_id' => $this->tenant->id,
            'employee_id' => $this->employee->id,
            'pay_item_id' => $payItem->id,
            'amount' => 15000.00,
        ]);
    }

    public function test_can_view_loans_dashboard_and_issue_staff_loan_with_installments(): void
    {
        $indexResponse = $this->actingAs($this->hrManager)
            ->withSession(['tenant_id' => $this->tenant->id])
            ->get('/payroll/loans');

        $indexResponse->assertStatus(200)
            ->assertInertia(fn ($page) => $page
                ->component('Payroll/Loans')
                ->has('loans')
                ->has('metrics')
            );

        $loanResponse = $this->actingAs($this->hrManager)
            ->withSession(['tenant_id' => $this->tenant->id])
            ->post('/payroll/loans', [
                'employee_id' => $this->employee->id,
                'loan_reference_no' => 'LN-2026-FESTIVAL',
                'loan_title' => 'New Year Festival Advance',
                'principal_amount' => 50000.00,
                'interest_rate_percentage' => 0.00,
                'installment_count' => 10,
                'disbursed_at' => '2026-01-10',
                'deduction_start_month' => '2026-01-01',
            ]);

        $loanResponse->assertRedirect();

        $loan = EmployeeLoan::where('tenant_id', $this->tenant->id)->where('loan_reference_no', 'LN-2026-FESTIVAL')->first();
        $this->assertNotNull($loan);
        $this->assertEquals(50000.00, (float) $loan->principal_amount);
        $this->assertEquals(5000.00, (float) $loan->monthly_installment);
        $this->assertEquals(10, $loan->installment_count);
        $this->assertEquals(10, $loan->installments()->count());

        $firstInstallment = $loan->installments()->where('installment_number', 1)->first();
        $this->assertNotNull($firstInstallment);
        $this->assertEquals(2026, $firstInstallment->due_year);
        $this->assertEquals(1, $firstInstallment->due_month);
        $this->assertEquals(5000.00, (float) $firstInstallment->amount);
        $this->assertEquals('scheduled', $firstInstallment->status);
    }

    public function test_can_skip_installment_and_extend_loan_schedule(): void
    {
        /** @var StaffLoanService $loanService */
        $loanService = app(StaffLoanService::class);
        $loan = $loanService->createLoan($this->tenant, [
            'employee_id' => $this->employee->id,
            'loan_reference_no' => 'LN-2026-DEFER',
            'loan_title' => 'Emergency Distress Loan',
            'principal_amount' => 30000.00,
            'installment_count' => 3,
            'disbursed_at' => '2026-01-01',
            'deduction_start_month' => '2026-01-01',
        ]);

        $firstInstallment = $loan->installments()->where('installment_number', 1)->first();
        $this->assertNotNull($firstInstallment);

        $skipResponse = $this->actingAs($this->hrManager)
            ->withSession(['tenant_id' => $this->tenant->id])
            ->post("/payroll/loans/installments/{$firstInstallment->id}/skip", [
                'remarks' => 'Hardship deferral granted by management',
            ]);

        $skipResponse->assertRedirect();
        $this->assertEquals('skipped', $firstInstallment->fresh()->status);
        $this->assertEquals(4, $loan->fresh()->installment_count);
        $this->assertEquals(4, $loan->fresh()->installments()->count());
    }

    public function test_can_create_and_approve_monthly_variable_adjustments(): void
    {
        $response = $this->actingAs($this->hrManager)
            ->withSession(['tenant_id' => $this->tenant->id])
            ->post('/payroll/variable-inputs', [
                'employee_id' => $this->employee->id,
                'period_year' => 2026,
                'period_month' => 1,
                'entry_type' => 'addition',
                'title' => 'Spot Delivery Achievement Bonus',
                'amount' => 7500.00,
                'is_epf_eligible' => false,
                'is_taxable' => true,
            ]);

        $response->assertRedirect();
        $adj = PayrollMonthlyAdjustment::where('tenant_id', $this->tenant->id)
            ->where('employee_id', $this->employee->id)
            ->first();

        $this->assertNotNull($adj);
        $this->assertEquals(7500.00, (float) $adj->amount);
        $this->assertEquals('approved', $adj->status);
    }

    public function test_dynamic_payroll_calculation_incorporates_bra_loans_adjustments_and_approved_ot(): void
    {
        // 1. Seed standard pay items (includes BRA 2005 = 1,000 and BRA 2016 = 2,500)
        /** @var PayItemService $payItemService */
        $payItemService = app(PayItemService::class);
        $payItemService->seedStandardPayItems($this->tenant);

        $bra2005 = PayItem::where('tenant_id', $this->tenant->id)->where('code', 'BRA_2005')->first();
        $bra2016 = PayItem::where('tenant_id', $this->tenant->id)->where('code', 'BRA_2016')->first();

        // 2. Assign BRA 2005 and BRA 2016 as recurring earnings to the employee
        EmployeePayItem::create([
            'tenant_id' => $this->tenant->id,
            'employee_id' => $this->employee->id,
            'pay_item_id' => $bra2005->id,
            'amount' => 1000.00,
            'effective_from' => '2026-01-01',
            'is_active' => true,
        ]);
        EmployeePayItem::create([
            'tenant_id' => $this->tenant->id,
            'employee_id' => $this->employee->id,
            'pay_item_id' => $bra2016->id,
            'amount' => 2500.00,
            'effective_from' => '2026-01-01',
            'is_active' => true,
        ]);

        // 3. Issue staff loan: LKR 40,000 in 4 installments of LKR 10,000 starting Jan 2026
        /** @var StaffLoanService $loanService */
        $loanService = app(StaffLoanService::class);
        $loan = $loanService->createLoan($this->tenant, [
            'employee_id' => $this->employee->id,
            'loan_reference_no' => 'LN-2026-ACTIVE',
            'loan_title' => 'Equipment Advance',
            'principal_amount' => 40000.00,
            'installment_count' => 4,
            'disbursed_at' => '2026-01-01',
            'deduction_start_month' => '2026-01-01',
        ]);

        // 4. Create variable adjustment: LKR 5,000 addition
        PayrollMonthlyAdjustment::create([
            'tenant_id' => $this->tenant->id,
            'employee_id' => $this->employee->id,
            'period_year' => 2026,
            'period_month' => 1,
            'entry_type' => 'addition',
            'title' => 'Safety Compliance Bonus',
            'amount' => 5000.00,
            'is_epf_eligible' => false,
            'is_taxable' => true,
            'status' => 'approved',
        ]);

        // 5. Add attendance log with approved OT hours: 10 hours approved OT
        AttendanceDaily::create([
            'tenant_id' => $this->tenant->id,
            'employee_id' => $this->employee->id,
            'attendance_date' => '2026-01-15',
            'worked_hours' => 18.00,
            'regular_hours' => 8.00,
            'ot_hours' => 10.00,
            'approved_ot_hours' => 10.00,
            'ot_approval_status' => 'hr_confirmed',
            'status' => 'present',
        ]);

        // 6. Process Payroll for January 2026
        // Base Salary = 80,000.00
        // Hourly Rate = 80,000 / 200 = 400.00
        // Approved OT: 10 hrs * 400 * 1.5 = 6,000.00
        // Allowances: Recurring BRA (1,000 + 2,500) + Variable Bonus (5,000) = 8,500.00
        // Gross Pay = 80,000 + 6,000 + 8,500 = 94,500.00
        //
        // EPF Eligible Earnings = 80,000 (Basic) + 1,000 (BRA 2005) + 2,500 (BRA 2016) = 83,500.00
        // Employee EPF (8%) = 83,500 * 0.08 = 6,680.00
        // Employer EPF (12%) = 83,500 * 0.12 = 10,020.00
        // Employer ETF (3%) = 94,500 * 0.03 = 2,835.00
        //
        // Loan installment deducted = 10,000.00
        //
        // APIT Tax: Projected annual gross = 94,500 * 12 = 1,134,000. Below threshold (1,200,000) -> Tax = 0.00
        //
        // Net Pay = Gross (94,500) - EPF (6,680) - Loan (10,000) = 77,820.00
        /** @var PayrollCalculationService $calcService */
        $calcService = app(PayrollCalculationService::class);
        $result = $calcService->processPayroll(
            tenant: $this->tenant,
            year: 2026,
            month: 1,
            runByUser: $this->hrManager,
            isDryRun: false
        );

        $this->assertNotNull($result['run']);
        $payrollEmp = $result['run']->payrollEmployees()->where('employee_id', $this->employee->id)->first();
        $this->assertNotNull($payrollEmp);

        $this->assertEquals(94500.00, (float) $payrollEmp->gross_pay);
        $this->assertEquals(83500.00, (float) $payrollEmp->epf_eligible_earnings);
        $this->assertEquals(6680.00, (float) $payrollEmp->epf_employee);
        $this->assertEquals(10020.00, (float) $payrollEmp->epf_employer);
        $this->assertEquals(2835.00, (float) $payrollEmp->etf_employer);
        $this->assertEquals(10000.00, (float) $payrollEmp->other_deductions);
        $this->assertEquals(77820.00, (float) $payrollEmp->net_pay);

        // Verify loan installment was marked as deducted
        $inst = $loan->installments()->where('due_year', 2026)->where('due_month', 1)->first();
        $this->assertEquals('deducted', $inst->fresh()->status);
        $this->assertEquals(10000.00, (float) $inst->fresh()->paid_amount);
        $this->assertEquals(10000.00, (float) $loan->fresh()->total_paid_amount);
        $this->assertEquals(30000.00, (float) $loan->fresh()->remaining_balance);
    }
}
