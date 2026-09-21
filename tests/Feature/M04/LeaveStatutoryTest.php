<?php

declare(strict_types=1);

namespace Tests\Feature\M04;

use App\Models\AttendanceDaily;
use App\Models\Department;
use App\Models\Employee;
use App\Models\LeaveEntitlement;
use App\Models\LeaveType;
use App\Models\Tenant;
use App\Models\WagesBoardCategory;
use App\Services\LeaveService;
use Carbon\Carbon;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

final class LeaveStatutoryTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;
    private Department $department;
    private WagesBoardCategory $teaTrade;
    private LeaveService $leaveService;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);

        $this->tenant = Tenant::create([
            'name' => 'Statutory Tea Ltd',
            'slug' => 'statutory-tea-ltd',
            'is_active' => true,
        ]);

        session(['tenant_id' => $this->tenant->id]);
        app()->instance('current_tenant_id', $this->tenant->id);
        app()->instance('current_tenant', $this->tenant);
        setPermissionsTeamId($this->tenant->id);

        $this->department = Department::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Estate Field',
            'code' => 'EST-FLD',
            'is_active' => true,
        ]);

        // Tea growing trade: 216 days threshold, 1 day for every 4 days worked above 216, max 14 days
        $this->teaTrade = WagesBoardCategory::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Tea Growing & Manufacturing Trade',
            'code' => 'TEA-TRADE',
            'minimum_wage' => 30000.00,
            'entitle_start_day' => 216,
            'devided_days_by' => 4,
            'max_annual_leave' => 14,
            'casual_leave_days' => 0.0,
            'is_active' => true,
        ]);

        $this->leaveService = app(LeaveService::class);
        $this->leaveService->seedStatutoryTypes($this->tenant->id);
    }

    public function test_calculates_wages_board_annual_leave_based_on_worked_days_over_threshold(): void
    {
        $employee = Employee::create([
            'tenant_id' => $this->tenant->id,
            'emp_no' => 'WB-PLUCK-01',
            'full_name' => 'Kamala Devi',
            'nic' => '198855555555',
            'department_id' => $this->department->id,
            'employment_category' => 'wages_board',
            'wages_board_category_id' => $this->teaTrade->id,
            'employment_type' => 'permanent',
            'employment_status' => 'active',
            'date_of_joining' => '2024-01-01',
        ]);

        // Simulate 240 days worked in previous year (2025)
        // Excess = 240 - 216 = 24 days. Entitlement = 24 / 4 = 6 days.
        for ($i = 1; $i <= 240; $i++) {
            $month = (int) ceil($i / 20);
            $day = (($i - 1) % 20) + 1;
            $dateStr = sprintf('2025-%02d-%02d', min(12, $month), min(28, $day));

            AttendanceDaily::create([
                'tenant_id' => $this->tenant->id,
                'employee_id' => $employee->id,
                'attendance_date' => $dateStr,
                'status' => 'present',
                'worked_hours' => 8.0,
                'regular_hours' => 8.0,
                'late_minutes' => 0,
                'early_departure_minutes' => 0,
                'ot_hours' => 0,
                'double_ot_hours' => 0,
                'is_manual' => false,
            ]);
        }

        $annualType = LeaveType::where('tenant_id', $this->tenant->id)->where('code', 'ANNUAL')->firstOrFail();
        $entitlement = $this->leaveService->calculateProratedEntitlement($employee, $annualType, 2026);

        $this->assertEquals(6.0, $entitlement);
    }

    public function test_allocates_entitlements_for_wages_board_employee(): void
    {
        $employee = Employee::create([
            'tenant_id' => $this->tenant->id,
            'emp_no' => 'WB-PLUCK-02',
            'full_name' => 'Periyasamy Muthu',
            'nic' => '199255555555',
            'department_id' => $this->department->id,
            'employment_category' => 'wages_board',
            'wages_board_category_id' => $this->teaTrade->id,
            'employment_type' => 'permanent',
            'employment_status' => 'active',
            'date_of_joining' => '2025-01-01',
        ]);

        // 256 days worked in 2025 => (256 - 216) / 4 = 10 days
        for ($i = 1; $i <= 256; $i++) {
            $month = (int) ceil($i / 22);
            $day = (($i - 1) % 22) + 1;
            $dateStr = sprintf('2025-%02d-%02d', min(12, $month), min(28, $day));

            AttendanceDaily::create([
                'tenant_id' => $this->tenant->id,
                'employee_id' => $employee->id,
                'attendance_date' => $dateStr,
                'status' => 'present',
                'worked_hours' => 8.0,
                'regular_hours' => 8.0,
                'late_minutes' => 0,
                'early_departure_minutes' => 0,
                'ot_hours' => 0,
                'double_ot_hours' => 0,
                'is_manual' => false,
            ]);
        }

        $result = $this->leaveService->allocateEntitlements($this->tenant->id, 2026, $employee->id);
        $this->assertGreaterThan(0, $result['total_allocated']);

        $annualRecord = LeaveEntitlement::where('tenant_id', $this->tenant->id)
            ->where('employee_id', $employee->id)
            ->where('year', 2026)
            ->whereHas('leaveType', fn ($q) => $q->where('code', 'ANNUAL'))
            ->first();

        $this->assertNotNull($annualRecord);
        $this->assertEquals(10.0, (float) $annualRecord->allocated_days);

        // Casual leave under tea wages board should be 0.0
        $casualRecord = LeaveEntitlement::where('tenant_id', $this->tenant->id)
            ->where('employee_id', $employee->id)
            ->where('year', 2026)
            ->whereHas('leaveType', fn ($q) => $q->where('code', 'CASUAL'))
            ->first();

        $this->assertNotNull($casualRecord);
        $this->assertEquals(0.0, (float) $casualRecord->allocated_days);
    }
}
