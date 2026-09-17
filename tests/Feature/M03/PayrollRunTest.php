<?php

declare(strict_types=1);

namespace Tests\Feature\M03;

use App\Models\AttendanceDaily;
use App\Models\Department;
use App\Models\Designation;
use App\Models\Employee;
use App\Models\EmployeeEpfInfo;
use App\Models\EmployeePaymentInfo;
use App\Models\PayrollEmployee;
use App\Models\PayrollRun;
use App\Models\Tenant;
use App\Models\User;
use App\Models\WagesBoardCategory;
use App\Services\PayrollCalculationService;
use Carbon\Carbon;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

final class PayrollRunTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;
    private User $hrManager;
    private Department $department;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);

        $this->tenant = Tenant::create([
            'name' => 'Ceylon Manufacturing PLC',
            'slug' => 'ceylon-manufacturing',
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
            'name' => 'HR Payroll Director',
            'email' => 'payroll@ceylonmfg.com',
        ]);
        $this->hrManager->assignRole('HR Manager');

        $this->department = Department::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Operations & Engineering',
        ]);
    }

    public function test_can_view_payroll_index_dashboard(): void
    {
        $response = $this->actingAs($this->hrManager)
            ->withSession(['tenant_id' => $this->tenant->id])
            ->get('/payroll');

        $response->assertStatus(200)
            ->assertInertia(fn ($page) => $page
                ->component('Payroll/Index')
                ->has('runs')
                ->has('metrics')
                ->has('settings')
            );
    }

    public function test_monthly_salaried_shop_and_office_calculation_with_ot_and_epf(): void
    {
        // 1. Employee setup: Shop & Office Act, Monthly Salaried LKR 100,000, EPF member
        $employee = Employee::create([
            'tenant_id' => $this->tenant->id,
            'emp_no' => 'EMP-001',
            'full_name' => 'Kasun Perera',
            'nic' => '199012345678',
            'department_id' => $this->department->id,
            'employment_type' => 'permanent',
            'employment_status' => 'active',
        ]);

        EmployeePaymentInfo::create([
            'tenant_id' => $this->tenant->id,
            'employee_id' => $employee->id,
            'payment_mode' => 'monthly',
            'basic_salary' => 100000.00,
            'effective_date' => '2026-01-01',
        ]);

        EmployeeEpfInfo::create([
            'tenant_id' => $this->tenant->id,
            'employee_id' => $employee->id,
            'is_epf_member' => true,
            'epf_no' => 'EPF-1001',
        ]);

        // 2. Attendance log: 10 OT hours logged in January 2026
        AttendanceDaily::create([
            'tenant_id' => $this->tenant->id,
            'employee_id' => $employee->id,
            'attendance_date' => '2026-01-15',
            'worked_hours' => 12.00,
            'regular_hours' => 8.00,
            'ot_hours' => 4.00,
            'double_ot_hours' => 0.00,
            'status' => 'present',
        ]);
        AttendanceDaily::create([
            'tenant_id' => $this->tenant->id,
            'employee_id' => $employee->id,
            'attendance_date' => '2026-01-16',
            'worked_hours' => 14.00,
            'regular_hours' => 8.00,
            'ot_hours' => 6.00,
            'double_ot_hours' => 0.00,
            'status' => 'present',
        ]);

        // 3. Process Payroll for Jan 2026 (Total 10 OT hrs)
        // Hourly rate = 100,000 / 200 = 500.00
        // OT pay = 500 * 1.5 * 10 = 7,500.00
        // Gross = 107,500.00
        // EPF eligible = 100,000.00
        // Employee EPF 8% = 8,000.00
        // Employer EPF 12% = 12,000.00
        // Employer ETF 3% = 3,225.00 (3% on gross 107,500)
        // APIT Tax: Projected annual = 107,500 * 12 = 1,290,000.
        // Slab 1 taxable (1,290,000 - 1,200,000) = 90,000 at 6% = 5,400 / 12 = 450.00
        // Net Pay = 107,500 - (8,000 + 450) = 99,050.00
        $service = app(PayrollCalculationService::class);
        $result = $service->processPayroll(
            tenant: $this->tenant,
            year: 2026,
            month: 1,
            runByUser: $this->hrManager
        );

        $run = $result['run'];
        $this->assertInstanceOf(PayrollRun::class, $run);
        $this->assertEquals(2026, $run->period_year);
        $this->assertEquals(1, $run->period_month);
        $this->assertEquals(107500.00, (float) $run->total_gross);
        $this->assertEquals(8000.00, (float) $run->total_epf_employee);
        $this->assertEquals(12000.00, (float) $run->total_epf_employer);
        $this->assertEquals(3225.00, (float) $run->total_etf);
        $this->assertEquals(450.00, (float) $run->total_apit);
        $this->assertEquals(99050.00, (float) $run->total_net);

        $lineItem = PayrollEmployee::where('payroll_run_id', $run->id)->first();
        $this->assertNotNull($lineItem);
        $this->assertEquals('monthly', $lineItem->payment_mode);
        $this->assertEquals('shop_and_office', $lineItem->labor_act);
        $this->assertEquals(7500.00, (float) $lineItem->ot_pay);
        $this->assertEquals(107500.00, (float) $lineItem->gross_pay);
        $this->assertEquals(99050.00, (float) $lineItem->net_pay);
    }

    public function test_wages_board_daily_rate_calculation(): void
    {
        // 1. Create Wages Board Category and Designation
        $wboCat = WagesBoardCategory::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Engineering & Metal Trade',
            'minimum_wage' => 22000.00,
        ]);

        $designation = Designation::create([
            'tenant_id' => $this->tenant->id,
            'title' => 'Machinist Technician',
            'wages_board_category_id' => $wboCat->id,
        ]);

        // 2. Employee on Daily Rate LKR 2,500
        $employee = Employee::create([
            'tenant_id' => $this->tenant->id,
            'emp_no' => 'TECH-002',
            'full_name' => 'Nimal Silva',
            'nic' => '198812345678',
            'department_id' => $this->department->id,
            'designation_id' => $designation->id,
            'employment_type' => 'permanent',
            'employment_status' => 'active',
        ]);

        EmployeePaymentInfo::create([
            'tenant_id' => $this->tenant->id,
            'employee_id' => $employee->id,
            'payment_mode' => 'daily',
            'daily_rate' => 2500.00,
            'effective_date' => '2026-02-01',
        ]);

        EmployeeEpfInfo::create([
            'tenant_id' => $this->tenant->id,
            'employee_id' => $employee->id,
            'is_epf_member' => true,
        ]);

        // 3. Log 20 days worked in February 2026
        for ($i = 1; $i <= 20; $i++) {
            AttendanceDaily::create([
                'tenant_id' => $this->tenant->id,
                'employee_id' => $employee->id,
                'attendance_date' => Carbon::create(2026, 2, $i)->toDateString(),
                'worked_hours' => 8.00,
                'regular_hours' => 8.00,
                'status' => 'present',
            ]);
        }

        // 4. Calculate Payroll
        // Basic = 20 days * 2,500 = 50,000.00
        // Gross = 50,000.00
        // EPF 8% = 4,000.00
        // Employer EPF 12% = 6,000.00
        // ETF 3% = 1,500.00
        // APIT: Exempt (< 100k) = 0.00
        // Net = 46,000.00
        $service = app(PayrollCalculationService::class);
        $result = $service->processPayroll(
            tenant: $this->tenant,
            year: 2026,
            month: 2,
            runByUser: $this->hrManager
        );

        $lineItem = PayrollEmployee::where('payroll_run_id', $result['run']->id)->first();
        $this->assertEquals('daily', $lineItem->payment_mode);
        $this->assertEquals('wages_board', $lineItem->labor_act);
        $this->assertEquals(20.00, (float) $lineItem->worked_days);
        $this->assertEquals(50000.00, (float) $lineItem->gross_pay);
        $this->assertEquals(4000.00, (float) $lineItem->epf_employee);
        $this->assertEquals(6000.00, (float) $lineItem->epf_employer);
        $this->assertEquals(1500.00, (float) $lineItem->etf_employer);
        $this->assertEquals(46000.00, (float) $lineItem->net_pay);
    }

    public function test_contract_basis_employee_without_epf_skips_statutory_deductions(): void
    {
        // Contract Consultant LKR 150,000, non-EPF member
        $consultant = Employee::create([
            'tenant_id' => $this->tenant->id,
            'emp_no' => 'CON-003',
            'full_name' => 'Dr. Sunimal Fernando',
            'nic' => '197512345678',
            'department_id' => $this->department->id,
            'employment_type' => 'contract',
            'employment_status' => 'active',
        ]);

        EmployeePaymentInfo::create([
            'tenant_id' => $this->tenant->id,
            'employee_id' => $consultant->id,
            'payment_mode' => 'monthly',
            'basic_salary' => 150000.00,
        ]);

        EmployeeEpfInfo::create([
            'tenant_id' => $this->tenant->id,
            'employee_id' => $consultant->id,
            'is_epf_member' => false, // Non-EPF contract worker
        ]);

        $service = app(PayrollCalculationService::class);
        $result = $service->processPayroll(
            tenant: $this->tenant,
            year: 2026,
            month: 3,
            runByUser: $this->hrManager
        );

        $lineItem = PayrollEmployee::where('payroll_run_id', $result['run']->id)->first();
        $this->assertFalse($lineItem->is_epf_eligible);
        $this->assertEquals(0.00, (float) $lineItem->epf_employee);
        $this->assertEquals(0.00, (float) $lineItem->epf_employer);
        $this->assertEquals(0.00, (float) $lineItem->etf_employer);
        // APIT tax should still be computed on 150,000 monthly
        // Annual projected = 1,800,000.
        // Slab 1 (1.2M - 1.7M) = 500,000 @ 6% = 30,000
        // Slab 2 (1.7M - 1.8M) = 100,000 @ 12% = 12,000
        // Total annual tax = 42,000 / 12 = 3,500.00
        $this->assertEquals(3500.00, (float) $lineItem->apit_tax);
        $this->assertEquals(150000.00 - 3500.00, (float) $lineItem->net_pay);
    }

    public function test_company_level_epf_disabled_skips_all_epf_etf(): void
    {
        // Disable EPF at tenant level
        $this->tenant->setSetting('epf_enabled', false);

        $employee = Employee::create([
            'tenant_id' => $this->tenant->id,
            'emp_no' => 'EMP-004',
            'full_name' => 'Kamal Wijeratne',
            'nic' => '198512345678',
            'department_id' => $this->department->id,
            'employment_type' => 'permanent',
            'employment_status' => 'active',
        ]);

        EmployeePaymentInfo::create([
            'tenant_id' => $this->tenant->id,
            'employee_id' => $employee->id,
            'payment_mode' => 'monthly',
            'basic_salary' => 80000.00,
        ]);

        EmployeeEpfInfo::create([
            'tenant_id' => $this->tenant->id,
            'employee_id' => $employee->id,
            'is_epf_member' => true,
        ]);

        $service = app(PayrollCalculationService::class);
        $result = $service->processPayroll(
            tenant: $this->tenant,
            year: 2026,
            month: 4,
            runByUser: $this->hrManager
        );

        $run = $result['run'];
        $this->assertEquals(0.00, (float) $run->total_epf_employee);
        $this->assertEquals(0.00, (float) $run->total_epf_employer);
        $this->assertEquals(0.00, (float) $run->total_etf);
        $this->assertEquals(80000.00, (float) $run->total_net);
    }

    public function test_payroll_run_approval_and_lock_lifecycle(): void
    {
        $employee = Employee::create([
            'tenant_id' => $this->tenant->id,
            'emp_no' => 'EMP-005',
            'full_name' => 'Saman Jayasinghe',
            'nic' => '199512345678',
            'department_id' => $this->department->id,
            'employment_type' => 'permanent',
            'employment_status' => 'active',
        ]);

        EmployeePaymentInfo::create([
            'tenant_id' => $this->tenant->id,
            'employee_id' => $employee->id,
            'payment_mode' => 'monthly',
            'basic_salary' => 75000.00,
        ]);

        // 1. Trigger payroll run via HTTP POST
        $postResponse = $this->actingAs($this->hrManager)
            ->withSession(['tenant_id' => $this->tenant->id])
            ->post('/payroll/runs', [
                'period_year' => 2026,
                'period_month' => 5,
                'notes' => 'May 2026 salary cycle',
            ]);

        $payrollRun = PayrollRun::where('tenant_id', $this->tenant->id)
            ->where('period_year', 2026)
            ->where('period_month', 5)
            ->first();

        $this->assertNotNull($payrollRun);
        $this->assertEquals('draft', $payrollRun->status);
        $postResponse->assertRedirect(route('payroll.show', $payrollRun->id));

        // 2. Approve run
        $approveResponse = $this->actingAs($this->hrManager)
            ->withSession(['tenant_id' => $this->tenant->id])
            ->post("/payroll/{$payrollRun->id}/approve");

        $payrollRun->refresh();
        $this->assertEquals('approved', $payrollRun->status);
        $this->assertNotNull($payrollRun->approved_at);

        // 3. Lock run
        $lockResponse = $this->actingAs($this->hrManager)
            ->withSession(['tenant_id' => $this->tenant->id])
            ->post("/payroll/{$payrollRun->id}/lock");

        $payrollRun->refresh();
        $this->assertEquals('locked', $payrollRun->status);

        // 4. Attempt to recalculate locked run should be blocked
        $recalcResponse = $this->actingAs($this->hrManager)
            ->withSession(['tenant_id' => $this->tenant->id])
            ->post("/payroll/{$payrollRun->id}/recalculate");

        $recalcResponse->assertSessionHas('error');
    }

    public function test_can_update_statutory_settings_via_http(): void
    {
        $response = $this->actingAs($this->hrManager)
            ->withSession(['tenant_id' => $this->tenant->id])
            ->post('/payroll/settings', [
                'epf_enabled' => true,
                'epf_employee_rate' => 10.00,
                'epf_employer_rate' => 15.00,
                'etf_employer_rate' => 3.00,
                'shop_office_nopay_divisor' => 30,
                'wages_board_nopay_divisor' => 26,
            ]);

        $response->assertSessionHas('success');
        $this->assertEquals('10', $this->tenant->getSetting('epf_employee_rate'));
        $this->assertEquals('15', $this->tenant->getSetting('epf_employer_rate'));
    }
}
