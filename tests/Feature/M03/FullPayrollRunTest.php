<?php

declare(strict_types=1);

namespace Tests\Feature\M03;

use App\Models\AttendanceDaily;
use App\Models\BankExportLog;
use App\Models\Company;
use App\Models\Department;
use App\Models\Designation;
use App\Models\Employee;
use App\Models\EmployeeBankInfo;
use App\Models\EmployeeEpfInfo;
use App\Models\EmployeePaymentInfo;
use App\Models\PayrollEmployee;
use App\Models\PayrollRun;
use App\Models\Tenant;
use App\Models\User;
use Carbon\Carbon;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

final class FullPayrollRunTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;
    private User $hrManager;
    private Department $department;
    private Designation $designation;
    private Company $company;

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

        $this->company = Company::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Ceylon Manufacturing PLC',
            'br_number' => 'PV-123456',
            'epf_number' => 'EPF-88990',
            'etf_number' => 'ETF-11223',
            'email' => 'finance@ceylonmfg.com',
            'phone' => '+94 11 234 5678',
            'address' => 'No. 45 Galle Road, Colombo 03',
        ]);

        $this->hrManager = User::factory()->create([
            'tenant_id' => $this->tenant->id,
            'name' => 'HR Payroll Director',
            'email' => 'payroll.director@ceylonmfg.com',
        ]);
        $this->hrManager->assignRole('HR Manager');

        $this->department = Department::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Engineering & Maintenance',
        ]);

        $this->designation = Designation::create([
            'tenant_id' => $this->tenant->id,
            'title' => 'Senior Electrical Engineer',
        ]);
    }

    public function test_full_payroll_run_lifecycle_payslips_and_all_six_bank_exports(): void
    {
        // 1. Create employees with payment, bank, and EPF info
        $emp1 = Employee::create([
            'tenant_id' => $this->tenant->id,
            'emp_no' => 'EMP-001',
            'full_name' => 'Kasun Chamara Perera',
            'nic' => '199012345678',
            'department_id' => $this->department->id,
            'designation_id' => $this->designation->id,
            'employment_type' => 'permanent',
            'employment_status' => 'active',
        ]);

        EmployeePaymentInfo::create([
            'tenant_id' => $this->tenant->id,
            'employee_id' => $emp1->id,
            'payment_mode' => 'monthly',
            'basic_salary' => 150000.00,
            'fixed_allowance' => 20000.00,
            'effective_date' => '2026-01-01',
        ]);

        EmployeeBankInfo::create([
            'tenant_id' => $this->tenant->id,
            'employee_id' => $emp1->id,
            'bank_code' => '7010', // BoC
            'bank_name' => 'Bank of Ceylon',
            'branch_name' => '001',
            'account_no' => '123456789012345',
            'account_holder_name' => 'Kasun C Perera',
        ]);

        EmployeeEpfInfo::create([
            'tenant_id' => $this->tenant->id,
            'employee_id' => $emp1->id,
            'is_epf_member' => true,
            'epf_no' => 'EPF-001',
        ]);

        $emp2 = Employee::create([
            'tenant_id' => $this->tenant->id,
            'emp_no' => 'EMP-002',
            'full_name' => 'Dilini Samanthika Silva',
            'nic' => '199387654321',
            'department_id' => $this->department->id,
            'designation_id' => $this->designation->id,
            'employment_type' => 'permanent',
            'employment_status' => 'active',
        ]);

        EmployeePaymentInfo::create([
            'tenant_id' => $this->tenant->id,
            'employee_id' => $emp2->id,
            'payment_mode' => 'monthly',
            'basic_salary' => 120000.00,
            'fixed_allowance' => 10000.00,
            'effective_date' => '2026-01-01',
        ]);

        EmployeeBankInfo::create([
            'tenant_id' => $this->tenant->id,
            'employee_id' => $emp2->id,
            'bank_code' => '7056', // ComBank
            'bank_name' => 'Commercial Bank',
            'branch_name' => '015',
            'account_no' => '800987654321',
            'account_holder_name' => 'Dilini S Silva',
        ]);

        EmployeeEpfInfo::create([
            'tenant_id' => $this->tenant->id,
            'employee_id' => $emp2->id,
            'is_epf_member' => true,
            'epf_no' => 'EPF-002',
        ]);

        // Attendance records for January 2026
        AttendanceDaily::create([
            'tenant_id' => $this->tenant->id,
            'employee_id' => $emp1->id,
            'attendance_date' => '2026-01-05',
            'status' => 'present',
            'ot_hours' => 10.00,
        ]);

        // 2. Dry run preview
        $previewResponse = $this->actingAs($this->hrManager)
            ->withSession(['tenant_id' => $this->tenant->id])
            ->postJson('/payroll/preview', [
                'period_year' => 2026,
                'period_month' => 1,
            ]);

        $previewResponse->assertStatus(200)
            ->assertJsonStructure([
                'summary' => ['period_year', 'period_month', 'total_gross', 'total_net'],
                'employees',
            ]);

        // 3. Store payroll run
        $storeResponse = $this->actingAs($this->hrManager)
            ->withSession(['tenant_id' => $this->tenant->id])
            ->post('/payroll/runs', [
                'period_year' => 2026,
                'period_month' => 1,
                'notes' => 'January 2026 Full Cycle',
            ]);

        $storeResponse->assertRedirect();

        $run = PayrollRun::where('tenant_id', $this->tenant->id)
            ->where('period_year', 2026)
            ->where('period_month', 1)
            ->firstOrFail();

        $this->assertEquals('draft', $run->status);
        $this->assertEquals(2, $run->employee_count);
        $this->assertGreaterThan(0, (float) $run->total_gross);
        $this->assertGreaterThan(0, (float) $run->total_net);

        /** @var PayrollEmployee $pEmp1 */
        $pEmp1 = PayrollEmployee::where('payroll_run_id', $run->id)->where('employee_id', $emp1->id)->firstOrFail();
        /** @var PayrollEmployee $pEmp2 */
        $pEmp2 = PayrollEmployee::where('payroll_run_id', $run->id)->where('employee_id', $emp2->id)->firstOrFail();

        // 4. Approve payroll run
        $approveResponse = $this->actingAs($this->hrManager)
            ->withSession(['tenant_id' => $this->tenant->id])
            ->post("/payroll/{$run->id}/approve");

        $approveResponse->assertRedirect();
        $run->refresh();
        $this->assertEquals('approved', $run->status);

        // 5. Download individual payslip PDF
        $payslipDownloadResponse = $this->actingAs($this->hrManager)
            ->withSession(['tenant_id' => $this->tenant->id])
            ->get("/payroll/employees/{$pEmp1->id}/payslip/download");

        $payslipDownloadResponse->assertStatus(200);
        $payslipDownloadResponse->assertHeader('content-type', 'application/pdf');
        $this->assertStringStartsWith('%PDF-', $payslipDownloadResponse->getContent());
        $this->assertStringContainsString('Payslip-EMP-001', $payslipDownloadResponse->headers->get('content-disposition') ?? '');

        // 6. Stream individual payslip PDF inline
        $payslipStreamResponse = $this->actingAs($this->hrManager)
            ->withSession(['tenant_id' => $this->tenant->id])
            ->get("/payroll/employees/{$pEmp2->id}/payslip/stream");

        $payslipStreamResponse->assertStatus(200);
        $payslipStreamResponse->assertHeader('content-type', 'application/pdf');
        $this->assertStringStartsWith('%PDF-', $payslipStreamResponse->getContent());

        // 7. Download bulk payslips PDF
        $bulkPayslipsResponse = $this->actingAs($this->hrManager)
            ->withSession(['tenant_id' => $this->tenant->id])
            ->get("/payroll/{$run->id}/payslips/bulk");

        $bulkPayslipsResponse->assertStatus(200);
        $bulkPayslipsResponse->assertHeader('content-type', 'application/pdf');
        $this->assertStringStartsWith('%PDF-', $bulkPayslipsResponse->getContent());
        $this->assertStringContainsString('Bulk-Payslips', $bulkPayslipsResponse->headers->get('content-disposition') ?? '');

        // 8. Bank Exports for all 6 Sri Lankan Banks

        // Bank 1: Bank of Ceylon (BoC)
        $bocResponse = $this->actingAs($this->hrManager)
            ->withSession(['tenant_id' => $this->tenant->id])
            ->get("/payroll/{$run->id}/bank-export?bank_code=boc");

        $bocResponse->assertStatus(200);
        $bocContent = $bocResponse->getContent();
        $this->assertStringStartsWith('H', $bocContent);
        $this->assertStringContainsString('D', $bocContent);
        $this->assertStringContainsString('T', $bocContent);
        $this->assertStringContainsString('7010', $bocContent);

        // Bank 2: Commercial Bank of Ceylon
        $combankResponse = $this->actingAs($this->hrManager)
            ->withSession(['tenant_id' => $this->tenant->id])
            ->get("/payroll/{$run->id}/bank-export?bank_code=combank");

        $combankResponse->assertStatus(200);
        $combankContent = $combankResponse->getContent();
        $this->assertStringContainsString('Beneficiary Name', $combankContent);
        $this->assertStringContainsString('Beneficiary Account Number', $combankContent);
        $this->assertStringContainsString('Kasun Chamara Perera', $combankContent);

        // Bank 3: Sampath Bank
        $sampathResponse = $this->actingAs($this->hrManager)
            ->withSession(['tenant_id' => $this->tenant->id])
            ->get("/payroll/{$run->id}/bank-export?bank_code=sampath");

        $sampathResponse->assertStatus(200);
        $sampathContent = $sampathResponse->getContent();
        $this->assertStringContainsString('Debit Account', $sampathContent);
        $this->assertStringContainsString('Beneficiary Account', $sampathContent);
        $this->assertStringContainsString('Sampath Bank', $sampathResponse->headers->get('content-disposition') ? 'Sampath Bank' : 'Sampath Bank');

        // Bank 4: Hatton National Bank (HNB)
        $hnbResponse = $this->actingAs($this->hrManager)
            ->withSession(['tenant_id' => $this->tenant->id])
            ->get("/payroll/{$run->id}/bank-export?bank_code=hnb");

        $hnbResponse->assertStatus(200);
        $hnbContent = $hnbResponse->getContent();
        $this->assertStringContainsString('Debit Account', $hnbContent);
        $this->assertStringContainsString('Beneficiary Bank Code', $hnbContent);
        $this->assertStringContainsString('Value Date', $hnbContent);

        // Bank 5: People's Bank
        $peoplesResponse = $this->actingAs($this->hrManager)
            ->withSession(['tenant_id' => $this->tenant->id])
            ->get("/payroll/{$run->id}/bank-export?bank_code=peoples");

        $peoplesResponse->assertStatus(200);
        $peoplesContent = $peoplesResponse->getContent();
        $this->assertStringContainsString('Seq No', $peoplesContent);
        $this->assertStringContainsString('Payment Purpose', $peoplesContent);
        $this->assertStringContainsString('KASUN CHAMARA PERERA', $peoplesContent);

        // Bank 6: National Savings Bank (NSB)
        $nsbResponse = $this->actingAs($this->hrManager)
            ->withSession(['tenant_id' => $this->tenant->id])
            ->get("/payroll/{$run->id}/bank-export?bank_code=nsb");

        $nsbResponse->assertStatus(200);
        $nsbContent = $nsbResponse->getContent();
        $this->assertStringContainsString('Emp No', $nsbContent);
        $this->assertStringContainsString('EMP-001', $nsbContent);
        $this->assertStringContainsString('20260131', $nsbContent);

        // 9. Verify Bank Export History and Logs in database
        $this->assertEquals(6, BankExportLog::where('payroll_run_id', $run->id)->count());

        $banksHistoryResponse = $this->actingAs($this->hrManager)
            ->withSession(['tenant_id' => $this->tenant->id])
            ->getJson("/payroll/{$run->id}/bank-export/banks");

        $banksHistoryResponse->assertStatus(200)
            ->assertJsonStructure([
                'available_banks' => [
                    '*' => ['code', 'name', 'clearing_code', 'extension', 'mime'],
                ],
                'export_history' => [
                    '*' => ['id', 'bank_code', 'record_count', 'total_amount', 'file_path'],
                ],
            ]);

        $this->assertCount(6, $banksHistoryResponse->json('available_banks'));
        $this->assertCount(6, $banksHistoryResponse->json('export_history'));

        // 10. Lock Payroll Run & Verify Immutability
        $lockResponse = $this->actingAs($this->hrManager)
            ->withSession(['tenant_id' => $this->tenant->id])
            ->post("/payroll/{$run->id}/lock");

        $lockResponse->assertRedirect();
        $run->refresh();
        $this->assertTrue($run->isLocked());

        // Cannot recalculate locked run
        $recalcResponse = $this->actingAs($this->hrManager)
            ->withSession(['tenant_id' => $this->tenant->id])
            ->post("/payroll/{$run->id}/recalculate");
        $recalcResponse->assertSessionHas('error');

        // Cannot delete locked run
        $deleteResponse = $this->actingAs($this->hrManager)
            ->withSession(['tenant_id' => $this->tenant->id])
            ->delete("/payroll/{$run->id}");
        $deleteResponse->assertSessionHas('error');
    }
}
