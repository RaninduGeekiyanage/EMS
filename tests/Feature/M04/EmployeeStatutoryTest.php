<?php

declare(strict_types=1);

namespace Tests\Feature\M04;

use App\Models\Department;
use App\Models\Employee;
use App\Models\JobGrade;
use App\Models\LeaveEntitlement;
use App\Models\LeaveType;
use App\Models\Tenant;
use App\Models\User;
use App\Models\WagesBoardCategory;
use App\Services\LeaveService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

final class EmployeeStatutoryTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;
    private User $admin;
    private Department $dept;
    private JobGrade $grade;
    private WagesBoardCategory $wbc;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(\Database\Seeders\RolesAndPermissionsSeeder::class);

        $this->tenant = Tenant::create([
            'name' => 'Lanka Manufacturing Ltd',
            'slug' => 'lanka-mfg',
            'is_active' => true,
            'is_ams_enabled' => true,
        ]);

        session(['tenant_id' => $this->tenant->id]);
        if (function_exists('setPermissionsTeamId')) {
            setPermissionsTeamId($this->tenant->id);
        }

        $this->admin = User::factory()->create([
            'tenant_id' => $this->tenant->id,
            'is_super_admin' => false,
        ]);
        $this->admin->assignRole('HR Manager');

        $this->dept = Department::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Operations',
            'code' => 'OPS',
        ]);

        $this->grade = JobGrade::create([
            'tenant_id' => $this->tenant->id,
            'code' => 'GRADE-91',
            'name' => 'General Worker',
            'rank_order' => 1,
        ]);

        $this->wbc = WagesBoardCategory::create([
            'tenant_id' => $this->tenant->id,
            'code' => 'ENG-TRADE',
            'name' => 'Engineering Trade',
            'minimum_wage' => 35000.00,
            'casual_leave_days' => 7.0,
        ]);

        // Seed statutory leave types for the tenant
        app(LeaveService::class)->seedStatutoryTypes($this->tenant->id);
    }

    public function test_creates_employee_with_statutory_and_demographic_fields(): void
    {
        $response = $this->actingAs($this->admin)->post('/employees', [
            'emp_no' => 'EMP-101',
            'full_name' => 'Sunil Shantha',
            'nic' => '198512345678',
            'gender' => 'male',
            'date_of_birth' => '1985-06-15',
            'marital_status' => 'married',
            'email' => 'sunil@lanka.com',
            'phone' => '0771234567',
            'permanent_address' => 'No 12, Main Street, Kandy',
            'city' => 'Kandy',
            'department_id' => $this->dept->id,
            'job_grade_id' => $this->grade->id,
            'wages_board_category_id' => $this->wbc->id,
            'employment_type' => 'permanent',
            'employment_category' => 'wages_board',
            'employment_status' => 'active',
            'attendance_mode' => 'shift',
            'date_of_joining' => '2026-01-15',
            'payment_mode' => 'monthly',
            'basic_salary' => 55000.00,
            'is_epf_member' => true,
        ]);

        $response->assertRedirect('/employees');

        $emp = Employee::where('emp_no', 'EMP-101')->first();
        $this->assertNotNull($emp);
        $this->assertSame('Sunil Shantha', $emp->full_name);
        $this->assertSame('male', $emp->gender);
        $this->assertSame('wages_board', $emp->employment_category);
        $this->assertSame('shift', $emp->attendance_mode);
        $this->assertSame($this->grade->id, $emp->job_grade_id);
        $this->assertSame($this->wbc->id, $emp->wages_board_category_id);

        // Verify that leave entitlements were auto-initialized upon employee creation!
        $entitlements = LeaveEntitlement::where('employee_id', $emp->id)
            ->where('year', 2026)
            ->get();

        $this->assertNotEmpty($entitlements);
        // Casual leave allocated for Wages Board employee
        $casual = $entitlements->firstWhere('leave_type_id', LeaveType::where('tenant_id', $this->tenant->id)->where('code', 'CASUAL')->value('id'));
        $this->assertNotNull($casual);
        $this->assertGreaterThan(0, $casual->allocated_days);

        // Annual leave under Wages Board is 0 in 1st year (earned based on worked days in year 2)
        $annual = $entitlements->firstWhere('leave_type_id', LeaveType::where('tenant_id', $this->tenant->id)->where('code', 'ANNUAL')->value('id'));
        $this->assertNotNull($annual);
        $this->assertEquals(0.0, $annual->allocated_days);

        // Male should NOT have maternity leave
        $maternityTypeId = LeaveType::where('tenant_id', $this->tenant->id)->where('code', 'MATERNITY')->value('id');
        $maternity = $entitlements->firstWhere('leave_type_id', $maternityTypeId);
        $this->assertNull($maternity);
    }
}
