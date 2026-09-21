<?php

declare(strict_types=1);

namespace Tests\Feature\M04;

use App\Models\Branch;
use App\Models\Company;
use App\Models\Department;
use App\Models\Employee;
use App\Models\Tenant;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CustomReportTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;
    private User $admin;
    private Department $department;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);

        $this->tenant = Tenant::create([
            'name' => 'Report Test Tenant',
            'slug' => 'report-test-tenant',
            'is_active' => true,
        ]);

        session(['tenant_id' => $this->tenant->id]);
        app()->instance('current_tenant_id', $this->tenant->id);
        app()->instance('current_tenant', $this->tenant);
        setPermissionsTeamId($this->tenant->id);

        $this->admin = User::factory()->create([
            'tenant_id' => $this->tenant->id,
        ]);
        $this->admin->assignRole('Company Admin');

        $company = Company::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Report Test Co',
        ]);

        $branch = Branch::create([
            'tenant_id' => $this->tenant->id,
            'company_id' => $company->id,
            'name' => 'HQ Branch',
            'code' => 'HQ',
        ]);

        $this->department = Department::create([
            'tenant_id' => $this->tenant->id,
            'branch_id' => $branch->id,
            'name' => 'Engineering',
            'code' => 'ENG',
        ]);

        // Create sample employees
        Employee::create([
            'tenant_id' => $this->tenant->id,
            'department_id' => $this->department->id,
            'branch_id' => $branch->id,
            'emp_no' => 'EMP001',
            'full_name' => 'Alice Walker',
            'calling_name' => 'Alice',
            'email' => 'alice@reporttest.com',
            'nic' => '901234567V',
            'designation' => 'Lead Engineer',
            'date_of_joining' => '2023-01-15',
            'basic_salary' => 150000.00,
            'employment_status' => 'active',
            'employment_type' => 'permanent',
            'employment_category' => 'shop_office',
            'attendance_mode' => 'biometric',
            'gender' => 'female',
        ]);

        Employee::create([
            'tenant_id' => $this->tenant->id,
            'department_id' => $this->department->id,
            'branch_id' => $branch->id,
            'emp_no' => 'EMP002',
            'full_name' => 'Bob Builder',
            'calling_name' => 'Bob',
            'email' => 'bob@reporttest.com',
            'nic' => '911234567V',
            'designation' => 'Technician',
            'date_of_joining' => '2023-03-01',
            'basic_salary' => 80000.00,
            'employment_status' => 'active',
            'employment_type' => 'permanent',
            'employment_category' => 'wages_board',
            'attendance_mode' => 'biometric',
            'gender' => 'male',
        ]);
    }

    public function test_can_view_custom_report_builder_page(): void
    {
        $response = $this->actingAs($this->admin)
            ->get(route('reports.custom.index'));

        $response->assertOk();
        $response->assertInertia(fn ($page) =>
            $page->component('Reports/CustomBuilder')
                ->has('availableColumns')
                ->has('departments')
                ->has('previewData')
        );
    }

    public function test_can_export_streamed_csv(): void
    {
        $response = $this->actingAs($this->admin)
            ->get(route('reports.custom.csv', [
                'columns' => ['emp_no', 'full_name', 'department', 'basic_salary'],
                'department_id' => $this->department->id,
            ]));

        $response->assertOk();
        $this->assertEquals('text/csv; charset=UTF-8', $response->headers->get('content-type'));
        $this->assertStringContainsString('attachment; filename=', (string) $response->headers->get('content-disposition'));
    }

    public function test_can_generate_pdf_export(): void
    {
        $response = $this->actingAs($this->admin)
            ->get(route('reports.custom.pdf', [
                'columns' => ['emp_no', 'full_name', 'designation', 'employment_category'],
            ]));

        $response->assertOk();
        $this->assertEquals('application/pdf', $response->headers->get('content-type'));
    }
}
