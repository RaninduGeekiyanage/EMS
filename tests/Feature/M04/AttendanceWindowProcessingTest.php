<?php

declare(strict_types=1);

namespace Tests\Feature\M04;

use App\Models\AttendanceDaily;
use App\Models\AttendanceLog;
use App\Models\Branch;
use App\Models\Department;
use App\Models\Designation;
use App\Models\Employee;
use App\Models\Shift;
use App\Models\Tenant;
use App\Models\User;
use App\Services\AttendanceProcessingService;
use Carbon\Carbon;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

final class AttendanceWindowProcessingTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;
    private User $user;
    private Employee $employee;
    private Shift $shift;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);

        $this->tenant = Tenant::create([
            'name' => 'Window Testing Corp',
            'slug' => 'window-testing-corp',
            'is_active' => true,
        ]);

        session(['tenant_id' => $this->tenant->id]);
        app()->instance('current_tenant_id', $this->tenant->id);
        app()->instance('current_tenant', $this->tenant);
        setPermissionsTeamId($this->tenant->id);

        $this->user = User::factory()->create([
            'tenant_id' => $this->tenant->id,
        ]);
        $this->user->assignRole('HR Manager');

        $department = Department::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Operations',
            'code' => 'OPS',
            'is_active' => true,
        ]);

        $this->shift = Shift::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Standard Window Shift',
            'code' => 'SWS',
            'shift_type' => 'regular',
            'start_time' => '08:00',
            'end_time' => '17:00',
            'break_minutes' => 60,
            'in_window_before_start' => 60,   // [07:00 .. 10:00]
            'in_window_after_start' => 120,
            'out_window_before_end' => 120,   // [15:00 .. 20:00]
            'out_window_after_end' => 180,
            'is_night_shift' => false,
            'is_active' => true,
        ]);

        $this->employee = Employee::create([
            'tenant_id' => $this->tenant->id,
            'emp_no' => 'EMP-WIN-01',
            'full_name' => 'Window Punch Worker',
            'nic' => '199055555555',
            'department_id' => $department->id,
            'default_shift_id' => $this->shift->id,
            'employment_type' => 'permanent',
            'employment_status' => 'active',
            'date_of_joining' => '2026-01-01',
            'attendance_mode' => 'both',
        ]);
    }

    public function test_sliding_window_matches_punches_correctly_and_marks_raw_logs_processed(): void
    {
        $date = Carbon::parse('2026-09-22'); // A Tuesday

        // Raw punch 1: In window (07:45 - inside [07:00..10:00])
        $inLog = AttendanceLog::create([
            'tenant_id' => $this->tenant->id,
            'employee_id' => $this->employee->id,
            'punch_datetime' => '2026-09-22 07:45:00',
            'punch_type' => 'auto',
            'device_id' => 'DEV01',
            'source' => 'biometric_device',
        ]);

        // Raw punch 2: Out window (17:15 - inside [15:00..20:00])
        $outLog = AttendanceLog::create([
            'tenant_id' => $this->tenant->id,
            'employee_id' => $this->employee->id,
            'punch_datetime' => '2026-09-22 17:15:00',
            'punch_type' => 'auto',
            'device_id' => 'DEV01',
            'source' => 'biometric_device',
        ]);

        /** @var AttendanceProcessingService $service */
        $service = app(AttendanceProcessingService::class);
        $result = $service->processDate($date, $this->employee->id);

        $this->assertEquals(1, $result['processed']);
        $this->assertEquals(1, $result['present']);

        // Check daily ledger record
        $daily = AttendanceDaily::where('tenant_id', $this->tenant->id)
            ->where('employee_id', $this->employee->id)
            ->whereDate('attendance_date', '2026-09-22')
            ->first();

        $this->assertNotNull($daily);
        $this->assertEquals('2026-09-22 07:45:00', $daily->check_in->toDateTimeString());
        $this->assertEquals('2026-09-22 17:15:00', $daily->check_out->toDateTimeString());
        $this->assertEquals('present', $daily->status);

        // Verify raw logs are flagged as processed and NOT deleted
        $inLog->refresh();
        $outLog->refresh();
        $this->assertTrue($inLog->is_processed);
        $this->assertNotNull($inLog->processed_at);
        $this->assertTrue($outLog->is_processed);
        $this->assertNotNull($outLog->processed_at);
    }

    public function test_sliding_window_detects_missing_punches_and_records_anomalies(): void
    {
        $date = Carbon::parse('2026-09-23');

        // Only an in punch (08:15) - late arrival (+15m beyond grace)
        $inLog = AttendanceLog::create([
            'tenant_id' => $this->tenant->id,
            'employee_id' => $this->employee->id,
            'punch_datetime' => '2026-09-23 08:15:00',
            'punch_type' => 'auto',
            'device_id' => 'DEV01',
            'source' => 'biometric_device',
        ]);

        /** @var AttendanceProcessingService $service */
        $service = app(AttendanceProcessingService::class);
        $result = $service->processDate($date, $this->employee->id);

        $this->assertEquals(1, $result['missing_punch']);

        $daily = AttendanceDaily::where('tenant_id', $this->tenant->id)
            ->where('employee_id', $this->employee->id)
            ->whereDate('attendance_date', '2026-09-23')
            ->first();

        $this->assertNotNull($daily);
        $this->assertEquals('missing_punch', $daily->status);
        $this->assertNotEmpty($daily->anomalies);
        $this->assertEquals('MISSING_OUT', $daily->anomalies[0]['type']);
    }

    public function test_reprocess_date_range_recomputes_from_immutable_raw_logs(): void
    {
        $startDate = Carbon::parse('2026-09-22');
        $endDate = Carbon::parse('2026-09-23');

        // Day 1 logs: in & out => present
        AttendanceLog::create([
            'tenant_id' => $this->tenant->id,
            'employee_id' => $this->employee->id,
            'punch_datetime' => '2026-09-22 07:45:00',
            'punch_type' => 'auto',
            'device_id' => 'DEV01',
            'source' => 'biometric_device',
        ]);
        AttendanceLog::create([
            'tenant_id' => $this->tenant->id,
            'employee_id' => $this->employee->id,
            'punch_datetime' => '2026-09-22 17:15:00',
            'punch_type' => 'auto',
            'device_id' => 'DEV01',
            'source' => 'biometric_device',
        ]);

        // Day 2 logs: single in => missing_punch
        AttendanceLog::create([
            'tenant_id' => $this->tenant->id,
            'employee_id' => $this->employee->id,
            'punch_datetime' => '2026-09-23 08:00:00',
            'punch_type' => 'auto',
            'device_id' => 'DEV01',
            'source' => 'biometric_device',
        ]);

        /** @var AttendanceProcessingService $service */
        $service = app(AttendanceProcessingService::class);
        $reprocessResult = $service->reprocessDateRange($startDate, $endDate, $this->employee->id);

        $this->assertEquals(2, $reprocessResult['total_processed']);
        $this->assertEquals(1, $reprocessResult['present']);
        $this->assertEquals(1, $reprocessResult['missing_punch']);
    }
}
