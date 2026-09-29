<?php

declare(strict_types=1);

namespace Tests\Feature\M02;

use App\Models\Employee;
use App\Models\RosterEntry;
use App\Models\Shift;
use App\Models\Tenant;
use App\Services\AttendanceProcessingService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

final class AttendanceRosterIntegrationTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;
    private Employee $employee;
    private Shift $shift;
    private AttendanceProcessingService $processingService;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(\Database\Seeders\RolesAndPermissionsSeeder::class);

        $this->tenant = Tenant::create([
            'name' => 'Lanka Tea Processors',
            'slug' => 'lanka-tea',
            'is_active' => true,
        ]);

        session(['tenant_id' => $this->tenant->id]);
        app()->instance('current_tenant_id', $this->tenant->id);

        $this->shift = Shift::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Factory Shift',
            'code' => 'FAC-01',
            'shift_type' => 'regular',
            'start_time' => '08:00:00',
            'end_time' => '16:30:00',
            'break_minutes' => 60,
            'grace_minutes' => 10,
            'ot_threshold_minutes' => 480,
        ]);

        $this->employee = Employee::create([
            'tenant_id' => $this->tenant->id,
            'emp_no' => 'EMP-300',
            'nic' => '199112345678',
            'full_name' => 'Mahesh Fernando',
            'employment_type' => 'permanent',
            'employment_status' => 'active',
        ]);

        $this->processingService = app(AttendanceProcessingService::class);
    }

    public function test_attendance_marks_rostered_weekday_rest_day_as_rest_day_instead_of_absent(): void
    {
        // 2026-05-12 is a Tuesday
        $tuesday = Carbon::parse('2026-05-12');

        // Assign Tuesday as scheduled Rest Day in Roster
        RosterEntry::create([
            'tenant_id' => $this->tenant->id,
            'employee_id' => $this->employee->id,
            'roster_date' => $tuesday->toDateString(),
            'schedule_type' => 'rest_day',
            'shift_id' => null,
            'status' => 'published',
        ]);

        // Process attendance with zero biometric punches
        $result = $this->processingService->processDate($tuesday, $this->employee->id, null, false, $this->tenant->id);

        $this->assertEquals(1, $result['processed']);
        $this->assertEquals(0, $result['absent']);

        $record = $result['records']->first();
        $this->assertNotNull($record);
        $this->assertEquals('rest_day', $record->status);
        $this->assertEquals('Scheduled Rest Day (Duty Roster)', $record->calculation_breakdown['notes']);
    }

    public function test_attendance_marks_rostered_shift_without_punch_as_absent(): void
    {
        // 2026-05-13 is a Wednesday
        $wednesday = Carbon::parse('2026-05-13');

        // Assign Wednesday as a working Shift in Roster
        RosterEntry::create([
            'tenant_id' => $this->tenant->id,
            'employee_id' => $this->employee->id,
            'roster_date' => $wednesday->toDateString(),
            'schedule_type' => 'shift',
            'shift_id' => $this->shift->id,
            'status' => 'published',
        ]);

        // Process attendance with zero punches
        $result = $this->processingService->processDate($wednesday, $this->employee->id, null, false, $this->tenant->id);

        $this->assertEquals(1, $result['processed']);
        $this->assertEquals(1, $result['absent']);

        $record = $result['records']->first();
        $this->assertNotNull($record);
        $this->assertEquals('absent', $record->status);
    }

    public function test_timesheet_accurately_reconciles_rostered_rest_day_and_avoids_unassigned_or_standard_shift(): void
    {
        $user = \App\Models\User::factory()->create(['tenant_id' => $this->tenant->id]);
        $user->givePermissionTo('attendance.view');

        // Tuesday 2026-05-12 is scheduled Rest Day
        $tuesday = Carbon::parse('2026-05-12');
        RosterEntry::create([
            'tenant_id' => $this->tenant->id,
            'employee_id' => $this->employee->id,
            'roster_date' => $tuesday->toDateString(),
            'schedule_type' => 'rest_day',
            'shift_id' => null,
            'status' => 'published',
        ]);

        $response = $this->actingAs($user)
            ->get(route('attendance.timesheet.index', [
                'employee_id' => $this->employee->id,
                'month' => '2026-05',
            ]));

        $response->assertOk();
        $days = $response->viewData('page')['props']['timesheetDays'];
        $tuesdayDay = collect($days)->firstWhere('date', '2026-05-12');

        $this->assertNotNull($tuesdayDay);
        $this->assertTrue($tuesdayDay['is_roster_off']);
        $this->assertFalse($tuesdayDay['is_scheduled_work']);
        $this->assertEquals('Rest Day (Off)', $tuesdayDay['roster_label']);
        $this->assertNull($tuesdayDay['shift']);
        $this->assertEquals('rest_day', $tuesdayDay['status']);
    }

    public function test_publishing_roster_retroactively_reprocesses_stale_attendance_records(): void
    {
        $tuesday = Carbon::parse('2026-05-12');

        // Initially processed as absent before roster existed
        \App\Models\AttendanceDaily::create([
            'tenant_id' => $this->tenant->id,
            'employee_id' => $this->employee->id,
            'attendance_date' => $tuesday->toDateString(),
            'shift_id' => null,
            'status' => 'absent',
            'worked_hours' => 0.00,
        ]);

        // Create and publish a roster covering this date
        $roster = \App\Models\Roster::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'May Operations Roster',
            'code' => 'MAY-OPS',
            'start_date' => '2026-05-01',
            'end_date' => '2026-05-31',
            'status' => 'draft',
        ]);

        RosterEntry::create([
            'tenant_id' => $this->tenant->id,
            'roster_id' => $roster->id,
            'employee_id' => $this->employee->id,
            'roster_date' => $tuesday->toDateString(),
            'schedule_type' => 'rest_day',
            'shift_id' => null,
            'status' => 'draft',
        ]);

        // Publish the roster via RosterService
        $rosterService = app(\App\Services\RosterService::class);
        $rosterService->publishNamedRoster($roster, true);

        // Daily attendance record should now be updated to rest_day
        $daily = \App\Models\AttendanceDaily::where('employee_id', $this->employee->id)
            ->whereDate('attendance_date', $tuesday->toDateString())
            ->first();

        $this->assertNotNull($daily);
        $this->assertEquals('rest_day', $daily->status);
    }
}
