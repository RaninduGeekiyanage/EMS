<?php

declare(strict_types=1);

namespace Tests\Feature\M02;

use App\Models\Employee;
use App\Models\LeaveRequest;
use App\Models\LeaveType;
use App\Models\PayrollRun;
use App\Models\RosterEntry;
use App\Models\Shift;
use App\Models\Tenant;
use App\Models\User;
use App\Services\RosterService;
use Carbon\Carbon;
use Database\Seeders\RolesAndPermissionsSeeder;
use DomainException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

final class RosterEnterpriseHardeningTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;
    private User $manager;
    private Shift $dayShift;
    private Shift $nightShift;
    private Employee $employee;
    private RosterService $rosterService;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);

        $this->tenant = Tenant::create([
            'name' => 'Highland Tea Estate',
            'slug' => 'highland-tea-estate',
            'is_active' => true,
        ]);

        session(['tenant_id' => $this->tenant->id]);
        app()->instance('current_tenant_id', $this->tenant->id);
        if (function_exists('setPermissionsTeamId')) {
            setPermissionsTeamId($this->tenant->id);
        }

        $this->manager = User::factory()->create([
            'name' => 'Roster Manager',
            'email' => 'manager@highland.com',
            'tenant_id' => $this->tenant->id,
        ]);
        $this->manager->assignRole('HR Manager');

        $this->dayShift = Shift::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'General Day',
            'code' => 'GEN-DAY',
            'shift_type' => 'regular',
            'start_time' => '08:30:00',
            'end_time' => '17:00:00',
            'break_minutes' => 60,
            'grace_minutes' => 10,
            'ot_threshold_minutes' => 480,
            'is_night_shift' => false,
        ]);

        $this->nightShift = Shift::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Factory Night',
            'code' => 'ROT-NIGHT',
            'shift_type' => 'night',
            'start_time' => '22:00:00',
            'end_time' => '06:00:00',
            'break_minutes' => 30,
            'grace_minutes' => 10,
            'ot_threshold_minutes' => 480,
            'is_night_shift' => true,
        ]);

        $this->employee = Employee::create([
            'tenant_id' => $this->tenant->id,
            'emp_no' => 'EMP-701',
            'nic' => '199077777777',
            'full_name' => 'Nuwan Pradeep',
            'employment_type' => 'permanent',
            'employment_status' => 'active',
        ]);

        $this->rosterService = app(RosterService::class);
    }

    public function test_generate_roster_preserves_approved_leaves(): void
    {
        $leaveType = LeaveType::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Annual Leave',
            'code' => 'AL',
            'days_per_year' => 14,
            'is_paid' => true,
        ]);

        // Employee has approved leave on 2026-05-15
        LeaveRequest::create([
            'tenant_id' => $this->tenant->id,
            'employee_id' => $this->employee->id,
            'leave_type_id' => $leaveType->id,
            'start_date' => '2026-05-15',
            'end_date' => '2026-05-15',
            'days_count' => 1.0,
            'status' => 'approved',
            'reason' => 'Family vacation',
        ]);

        // Generate roster with preserve_leaves = true
        $this->rosterService->generateRoster([
            'employee_ids' => [$this->employee->id],
            'start_date' => '2026-05-01',
            'end_date' => '2026-05-31',
            'pattern_mode' => 'daily',
            'daily_config' => ['shift_id' => $this->dayShift->id, 'rest_days' => ['Sunday']],
            'preserve_leaves' => true,
        ]);

        // May 15 should NOT have a generated work shift
        $leaveDayEntry = RosterEntry::where('employee_id', $this->employee->id)
            ->whereDate('roster_date', '2026-05-15')
            ->first();

        $this->assertNull($leaveDayEntry);

        // May 14 should have a generated work shift
        $workDayEntry = RosterEntry::where('employee_id', $this->employee->id)
            ->whereDate('roster_date', '2026-05-14')
            ->first();

        $this->assertNotNull($workDayEntry);
        $this->assertEquals('shift', $workDayEntry->schedule_type);
    }

    public function test_detects_fatigue_rest_turnaround_less_than_11_hours(): void
    {
        // Day 1 (May 10): Night Shift 22:00 - 06:00 (ends 06:00 AM on May 11)
        RosterEntry::create([
            'tenant_id' => $this->tenant->id,
            'employee_id' => $this->employee->id,
            'roster_date' => '2026-05-10',
            'shift_id' => $this->nightShift->id,
            'schedule_type' => 'shift',
            'status' => 'published',
        ]);

        // Day 2 (May 11): Day Shift starting at 08:30 AM (only 2.5 hours rest after night shift ends at 06:00 AM!)
        RosterEntry::create([
            'tenant_id' => $this->tenant->id,
            'employee_id' => $this->employee->id,
            'roster_date' => '2026-05-11',
            'shift_id' => $this->dayShift->id,
            'schedule_type' => 'shift',
            'status' => 'published',
        ]);

        $matrix = $this->rosterService->getMonthMatrix(2026, 5);
        $empRow = collect($matrix['matrix'])->firstWhere('employee.id', $this->employee->id);
        $may11Cell = $empRow['cells']['2026-05-11'] ?? null;

        $this->assertNotNull($may11Cell);
        $this->assertTrue($may11Cell['fatigue_warning']);
        $this->assertEquals(2.5, $may11Cell['rest_hours']);
    }

    public function test_cannot_modify_roster_entries_for_locked_payroll_month(): void
    {
        // Create locked payroll run for May 2026
        PayrollRun::create([
            'tenant_id' => $this->tenant->id,
            'period_year' => 2026,
            'period_month' => 5,
            'status' => 'locked',
        ]);

        $this->expectException(DomainException::class);
        $this->expectExceptionMessage('Cannot modify roster schedules for May 2026 because payroll has been finalized and locked.');

        $this->rosterService->updateEntry(
            $this->employee->id,
            '2026-05-20',
            $this->dayShift->id,
            'shift'
        );
    }

    public function test_can_export_noticeboard_matrix_as_csv(): void
    {
        // Populate an entry
        RosterEntry::create([
            'tenant_id' => $this->tenant->id,
            'employee_id' => $this->employee->id,
            'roster_date' => '2026-05-01',
            'shift_id' => $this->dayShift->id,
            'schedule_type' => 'shift',
            'status' => 'published',
        ]);

        $response = $this->actingAs($this->manager)
            ->withHeaders(['X-Tenant-ID' => $this->tenant->id])
            ->get('/roster/export?year=2026&month=5');

        $response->assertOk();
        $this->assertEquals('text/csv; charset=UTF-8', $response->headers->get('Content-Type'));
        $this->assertStringContainsString('attachment; filename="Duty_Roster_2026_05.csv"', (string) $response->headers->get('Content-Disposition'));

        ob_start();
        $response->sendContent();
        $content = ob_get_clean();

        $this->assertStringContainsString('"Employee No"', (string) $content);
        $this->assertStringContainsString('EMP-701', (string) $content);
        $this->assertStringContainsString('Nuwan Pradeep', (string) $content);
        $this->assertStringContainsString('GEN-DAY', (string) $content);
        $this->assertStringContainsString('--- DAILY COVERAGE HEADCOUNT SUMMARY ---', (string) $content);
    }
}
