<?php

declare(strict_types=1);

namespace Tests\Feature\M02;

use App\Models\AttendanceDaily;
use App\Models\AttendanceLog;
use App\Models\AttendanceRule;
use App\Models\Department;
use App\Models\Employee;
use App\Models\PublicHoliday;
use App\Models\Shift;
use App\Models\ShiftAssignment;
use App\Models\Tenant;
use App\Models\User;
use App\Services\AttendanceProcessingService;
use Carbon\Carbon;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

final class AttendanceProcessingTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;
    private User $manager;
    private Employee $employee;
    private Shift $standardShift;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);

        $this->tenant = Tenant::create([
            'name' => 'Lanka Tea Holdings Ltd',
            'slug' => 'lanka-tea-holdings',
            'is_active' => true,
        ]);

        session(['tenant_id' => $this->tenant->id]);
        app()->instance('current_tenant_id', $this->tenant->id);
        app()->instance('current_tenant', $this->tenant);
        if (function_exists('setPermissionsTeamId')) {
            setPermissionsTeamId($this->tenant->id);
        }

        $this->manager = User::factory()->create([
            'name' => 'Operations Manager',
            'email' => 'opsmanager@lankatea.com',
        ]);
        $this->manager->assignRole('HR Manager');

        $department = Department::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Processing Unit',
        ]);

        $this->employee = Employee::create([
            'tenant_id' => $this->tenant->id,
            'department_id' => $department->id,
            'emp_no' => 'EMP-101',
            'full_name' => 'Nimal Jayasuriya',
            'nic' => '841234567V',
            'biometric_device_id' => '2001',
            'employment_status' => 'active',
        ]);

        // General 08:30 - 17:00 shift (8 hours + 1h break, 10 mins grace, 480 mins OT threshold)
        $this->standardShift = Shift::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'General Day Shift',
            'code' => 'GEN-DAY',
            'shift_type' => 'regular',
            'start_time' => '08:30:00',
            'end_time' => '17:30:00',
            'break_minutes' => 60,
            'grace_minutes' => 10,
            'ot_threshold_minutes' => 480,
            'is_night_shift' => false,
            'is_active' => true,
        ]);

        ShiftAssignment::create([
            'tenant_id' => $this->tenant->id,
            'employee_id' => $this->employee->id,
            'shift_id' => $this->standardShift->id,
            'effective_from' => '2026-01-01',
        ]);
    }

    public function test_displays_daily_attendance_ledger_page(): void
    {
        $response = $this->actingAs($this->manager)
            ->withHeaders(['X-Tenant-ID' => $this->tenant->id])
            ->get('/attendance/daily?date=2026-06-15');

        $response->assertOk();
    }

    public function test_processes_daily_attendance_from_raw_logs(): void
    {
        $date = Carbon::parse('2026-06-15'); // Monday

        // IN at 08:25, OUT at 17:30
        AttendanceLog::create([
            'tenant_id' => $this->tenant->id,
            'employee_id' => $this->employee->id,
            'punch_datetime' => '2026-06-15 08:25:00',
            'punch_type' => 'in',
            'source' => 'import',
        ]);

        AttendanceLog::create([
            'tenant_id' => $this->tenant->id,
            'employee_id' => $this->employee->id,
            'punch_datetime' => '2026-06-15 17:30:00',
            'punch_type' => 'out',
            'source' => 'import',
        ]);

        $service = app(AttendanceProcessingService::class);
        $result = $service->processDate($date);

        $this->assertEquals(1, $result['processed']);
        $this->assertEquals(1, $result['present']);

        $daily = AttendanceDaily::where('employee_id', $this->employee->id)
            ->whereDate('attendance_date', '2026-06-15')
            ->first();

        $this->assertNotNull($daily);
        $this->assertEquals('present', $daily->status);
        $this->assertEquals(8.08, $daily->worked_hours); // 9h 5m minus 60m break = 8h 5m = 8.08h
        $this->assertEquals(0, $daily->late_minutes);
    }

    public function test_pairs_earliest_in_and_latest_out_punches(): void
    {
        $date = Carbon::parse('2026-06-16'); // Tuesday

        // Intermediate punches (e.g. lunch / outdoor site visit)
        AttendanceLog::create([
            'tenant_id' => $this->tenant->id,
            'employee_id' => $this->employee->id,
            'punch_datetime' => '2026-06-16 08:15:00',
            'punch_type' => 'auto',
        ]);
        AttendanceLog::create([
            'tenant_id' => $this->tenant->id,
            'employee_id' => $this->employee->id,
            'punch_datetime' => '2026-06-16 12:30:00',
            'punch_type' => 'auto',
        ]);
        AttendanceLog::create([
            'tenant_id' => $this->tenant->id,
            'employee_id' => $this->employee->id,
            'punch_datetime' => '2026-06-16 17:35:00',
            'punch_type' => 'auto',
        ]);

        $service = app(AttendanceProcessingService::class);
        $service->processDate($date);

        $daily = AttendanceDaily::where('employee_id', $this->employee->id)
            ->whereDate('attendance_date', '2026-06-16')
            ->first();

        $this->assertNotNull($daily);
        $this->assertStringContainsString('08:15:00', (string) $daily->check_in);
        $this->assertStringContainsString('17:35:00', (string) $daily->check_out);
    }

    public function test_handles_single_punch_as_missing_punch(): void
    {
        $date = Carbon::parse('2026-06-17'); // Wednesday

        AttendanceLog::create([
            'tenant_id' => $this->tenant->id,
            'employee_id' => $this->employee->id,
            'punch_datetime' => '2026-06-17 08:30:00',
            'punch_type' => 'in',
        ]);

        $service = app(AttendanceProcessingService::class);
        $result = $service->processDate($date);

        $this->assertEquals(1, $result['missing_punch']);

        $daily = AttendanceDaily::where('employee_id', $this->employee->id)
            ->whereDate('attendance_date', '2026-06-17')
            ->first();

        $this->assertNotNull($daily);
        $this->assertEquals('missing_punch', $daily->status);
        $this->assertEquals(0.00, $daily->worked_hours);
    }

    public function test_calculates_late_minutes_accurately_with_grace_period(): void
    {
        $date = Carbon::parse('2026-06-18'); // Thursday
        // Shift start is 08:30. Grace period is 10 mins (cutoff 08:40).
        // Check-in at 08:48 -> 18 minutes late from 08:30.
        AttendanceLog::create([
            'tenant_id' => $this->tenant->id,
            'employee_id' => $this->employee->id,
            'punch_datetime' => '2026-06-18 08:48:00',
            'punch_type' => 'in',
        ]);
        AttendanceLog::create([
            'tenant_id' => $this->tenant->id,
            'employee_id' => $this->employee->id,
            'punch_datetime' => '2026-06-18 17:30:00',
            'punch_type' => 'out',
        ]);

        $service = app(AttendanceProcessingService::class);
        $result = $service->processDate($date);

        $this->assertEquals(1, $result['late']);

        $daily = AttendanceDaily::where('employee_id', $this->employee->id)
            ->whereDate('attendance_date', '2026-06-18')
            ->first();

        $this->assertEquals(18, $daily->late_minutes);
    }

    public function test_calculates_weekday_overtime_above_shift_threshold(): void
    {
        $date = Carbon::parse('2026-06-19'); // Friday
        // 08:30 to 20:30 = 12 hours total. Minus 60 mins break = 11.00 hours worked.
        // Standard threshold = 8.00 hours (480 mins). Excess = 3.00 hours OT (1.5x).
        AttendanceLog::create([
            'tenant_id' => $this->tenant->id,
            'employee_id' => $this->employee->id,
            'punch_datetime' => '2026-06-19 08:30:00',
            'punch_type' => 'in',
        ]);
        AttendanceLog::create([
            'tenant_id' => $this->tenant->id,
            'employee_id' => $this->employee->id,
            'punch_datetime' => '2026-06-19 20:30:00',
            'punch_type' => 'out',
        ]);

        $service = app(AttendanceProcessingService::class);
        $service->processDate($date);

        $daily = AttendanceDaily::where('employee_id', $this->employee->id)
            ->whereDate('attendance_date', '2026-06-19')
            ->first();

        $this->assertEquals(11.00, $daily->worked_hours);
        $this->assertEquals(8.00, $daily->regular_hours);
        $this->assertEquals(3.00, $daily->ot_hours);
        $this->assertEquals(0.00, $daily->double_ot_hours);
    }

    public function test_calculates_rest_day_sunday_overtime(): void
    {
        $date = Carbon::parse('2026-06-21'); // Sunday
        // 09:00 to 15:00 = 6 hours worked on Sunday.
        // All Sunday hours are compensated at 1.5x rest day rate.
        AttendanceLog::create([
            'tenant_id' => $this->tenant->id,
            'employee_id' => $this->employee->id,
            'punch_datetime' => '2026-06-21 09:00:00',
            'punch_type' => 'in',
        ]);
        AttendanceLog::create([
            'tenant_id' => $this->tenant->id,
            'employee_id' => $this->employee->id,
            'punch_datetime' => '2026-06-21 16:00:00',
            'punch_type' => 'out',
        ]);

        $service = app(AttendanceProcessingService::class);
        $service->processDate($date);

        $daily = AttendanceDaily::where('employee_id', $this->employee->id)
            ->whereDate('attendance_date', '2026-06-21')
            ->first();

        $this->assertEquals('present', $daily->status);
        $this->assertEquals(6.00, $daily->worked_hours);
        $this->assertEquals(6.00, $daily->ot_hours);
        $this->assertEquals(0.00, $daily->double_ot_hours);
    }

    public function test_calculates_double_overtime_on_statutory_and_company_holidays(): void
    {
        $date = Carbon::parse('2026-06-22'); // Monday (Declared Holiday)

        PublicHoliday::create([
            'tenant_id' => $this->tenant->id,
            'holiday_date' => '2026-06-22',
            'name' => 'Company Annual Jubilee',
            'type' => 'company',
            'description' => 'Special Company Holiday',
        ]);

        // 9 hours total minus 1h break = 8 hours worked on company holiday -> 2.0x Holiday OT
        AttendanceLog::create([
            'tenant_id' => $this->tenant->id,
            'employee_id' => $this->employee->id,
            'punch_datetime' => '2026-06-22 08:30:00',
            'punch_type' => 'in',
        ]);
        AttendanceLog::create([
            'tenant_id' => $this->tenant->id,
            'employee_id' => $this->employee->id,
            'punch_datetime' => '2026-06-22 17:30:00',
            'punch_type' => 'out',
        ]);

        $service = app(AttendanceProcessingService::class);
        $service->processDate($date);

        $daily = AttendanceDaily::where('employee_id', $this->employee->id)
            ->whereDate('attendance_date', '2026-06-22')
            ->first();

        $this->assertEquals('present', $daily->status);
        $this->assertEquals(8.00, $daily->worked_hours);
        $this->assertEquals(8.00, $daily->double_ot_hours);
        $this->assertEquals(0.00, $daily->ot_hours);
    }

    public function test_manual_punch_adjustment_with_audit_reason(): void
    {
        $date = Carbon::parse('2026-06-23');

        $service = app(AttendanceProcessingService::class);
        $service->processDate($date);

        $daily = AttendanceDaily::where('employee_id', $this->employee->id)
            ->whereDate('attendance_date', '2026-06-23')
            ->first();

        $response = $this->actingAs($this->manager)
            ->withHeaders(['X-Tenant-ID' => $this->tenant->id])
            ->put("/attendance/daily/{$daily->id}", [
                'check_in' => '2026-06-23 08:30:00',
                'check_out' => '2026-06-23 17:30:00',
                'status' => 'present',
                'manual_reason' => 'Fingerprint reader optical sensor failed during morning entry. Verified with physical gate book.',
            ]);

        $response->assertRedirect();

        $daily->refresh();
        $this->assertTrue($daily->is_manual);
        $this->assertEquals('Fingerprint reader optical sensor failed during morning entry. Verified with physical gate book.', $daily->manual_reason);
        $this->assertEquals($this->manager->id, $daily->manual_edited_by);
        $this->assertEquals(8.00, $daily->worked_hours);
    }

    public function test_shift_specific_management_rule_configuration(): void
    {
        // Setup a rule with a 60 min OT buffer (OT starts only after 1 hour of excess work)
        AttendanceRule::create([
            'tenant_id' => $this->tenant->id,
            'shift_id' => $this->standardShift->id,
            'rule_name' => 'Factory Shift 1-Hour Buffer Policy',
            'grace_period_minutes' => 15,
            'ot_buffer_minutes' => 60,
            'ot_minimum_minutes' => 15,
            'ot_rate_weekday' => 1.50,
            'ot_rate_rest_day' => 1.50,
            'ot_rate_holiday' => 2.00,
            'half_day_min_hours' => 4.00,
            'half_day_max_hours' => 6.00,
            'early_departure_grace_minutes' => 10,
            'round_ot_interval_minutes' => 15,
            'is_active' => true,
        ]);

        $date = Carbon::parse('2026-06-24'); // Wednesday
        // 08:30 to 19:30 = 11h raw minus 1h break = 10h worked.
        // Threshold = 8h. Excess = 2h (120 mins).
        // Buffer = 60 mins. Effective OT = 120 - 60 = 60 mins = 1.00h OT!
        AttendanceLog::create([
            'tenant_id' => $this->tenant->id,
            'employee_id' => $this->employee->id,
            'punch_datetime' => '2026-06-24 08:30:00',
            'punch_type' => 'in',
        ]);
        AttendanceLog::create([
            'tenant_id' => $this->tenant->id,
            'employee_id' => $this->employee->id,
            'punch_datetime' => '2026-06-24 19:30:00',
            'punch_type' => 'out',
        ]);

        $service = app(AttendanceProcessingService::class);
        $service->processDate($date);

        $daily = AttendanceDaily::where('employee_id', $this->employee->id)
            ->whereDate('attendance_date', '2026-06-24')
            ->first();

        $this->assertEquals(10.00, $daily->worked_hours);
        $this->assertEquals(1.00, $daily->ot_hours); // Buffered by 1 hour!
    }
}
