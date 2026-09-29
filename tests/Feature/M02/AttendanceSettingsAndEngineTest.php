<?php

declare(strict_types=1);

namespace Tests\Feature\M02;

use App\Models\AttendanceDaily;
use App\Models\AttendanceLog;
use App\Models\AttendanceRule;
use App\Models\Department;
use App\Models\Employee;
use App\Models\Shift;
use App\Models\ShiftAssignment;
use App\Models\Tenant;
use App\Models\User;
use App\Services\AttendanceProcessingService;
use Carbon\Carbon;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

final class AttendanceSettingsAndEngineTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;
    private User $companyAdmin;
    private User $companyOwner;
    private User $standardStaff;
    private Employee $employee;
    private Shift $shift;
    private AttendanceProcessingService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);

        $this->tenant = Tenant::create([
            'name' => 'Apex Apparel Lanka (Pvt) Ltd',
            'slug' => 'apex-apparel-lanka',
            'is_active' => true,
        ]);

        session(['tenant_id' => $this->tenant->id]);
        app()->instance('current_tenant_id', $this->tenant->id);
        app()->instance('current_tenant', $this->tenant);
        if (function_exists('setPermissionsTeamId')) {
            setPermissionsTeamId($this->tenant->id);
        }

        // 1. Privileged Company Admin
        $this->companyAdmin = User::factory()->create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Admin User',
            'email' => 'admin@apexapparel.com',
        ]);
        $this->companyAdmin->assignRole('Company Admin');

        // 2. Company Owner
        $this->companyOwner = User::factory()->create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Owner User',
            'email' => 'owner@apexapparel.com',
        ]);
        $this->companyOwner->assignRole('Company Owner');

        // 3. Standard Staff without permission
        $this->standardStaff = User::factory()->create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Staff User',
            'email' => 'staff@apexapparel.com',
        ]);
        $this->standardStaff->assignRole('Staff');

        $department = Department::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Finishing Line',
        ]);

        $this->employee = Employee::create([
            'tenant_id' => $this->tenant->id,
            'department_id' => $department->id,
            'emp_no' => 'APEX-001',
            'full_name' => 'Kamal Perera',
            'nic' => '891234567V',
            'biometric_device_id' => '1001',
            'employment_status' => 'active',
        ]);

        $this->shift = Shift::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Standard Day Shift',
            'code' => 'DS1',
            'start_time' => '08:00:00',
            'end_time' => '17:00:00',
            'break_minutes' => 60,
            'in_window_before_start' => 60,
            'in_window_after_start' => 120,
            'out_window_before_end' => 60,
            'out_window_after_end' => 120,
            'work_days' => [1, 2, 3, 4, 5],
            'is_active' => true,
        ]);

        ShiftAssignment::create([
            'tenant_id' => $this->tenant->id,
            'employee_id' => $this->employee->id,
            'shift_id' => $this->shift->id,
            'effective_from' => '2026-01-01',
        ]);

        $this->service = app(AttendanceProcessingService::class);
    }

    public function test_company_admin_and_owner_can_access_attendance_settings_page(): void
    {
        $response = $this->actingAs($this->companyAdmin)->get('/settings/attendance');
        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('Settings/Attendance')
            ->has('settings')
            ->where('settings.ignore_terminal_punch_type', true)
            ->where('settings.anti_passback_minutes', 3)
            ->where('canManage', true)
        );

        $responseOwner = $this->actingAs($this->companyOwner)->get('/settings/attendance');
        $responseOwner->assertOk();
    }

    public function test_unauthorized_user_cannot_access_or_manage_attendance_settings(): void
    {
        $response = $this->actingAs($this->standardStaff)->get('/settings/attendance');
        $response->assertForbidden();

        $updateResponse = $this->actingAs($this->standardStaff)->post('/settings/attendance', [
            'ignore_terminal_punch_type' => false,
            'anti_passback_minutes' => 5,
            'auto_detect_shift' => true,
            'allow_early_in_as_ot' => false,
            'overtime_minimum_minutes' => 30,
        ]);
        $updateResponse->assertForbidden();
    }

    public function test_can_update_attendance_settings_and_sync_overtime_minimum_minutes(): void
    {
        $payload = [
            'ignore_terminal_punch_type' => true,
            'anti_passback_minutes' => 5,
            'auto_detect_shift' => true,
            'allow_early_in_as_ot' => true,
            'overtime_minimum_minutes' => 30,
        ];

        $response = $this->actingAs($this->companyAdmin)->post('/settings/attendance', $payload);
        $response->assertRedirect();
        $response->assertSessionHas('success');

        // Verify stored in tenant_settings
        $settings = $this->service->getTenantAttendanceSettings($this->tenant->id);
        $this->assertTrue($settings['ignore_terminal_punch_type']);
        $this->assertSame(5, $settings['anti_passback_minutes']);
        $this->assertTrue($settings['auto_detect_shift']);
        $this->assertTrue($settings['allow_early_in_as_ot']);
        $this->assertSame(30, $settings['overtime_minimum_minutes']);

        // Verify synced to default AttendanceRule
        $defaultRule = AttendanceRule::where('tenant_id', $this->tenant->id)->whereNull('shift_id')->first();
        $this->assertNotNull($defaultRule);
        $this->assertSame(30, $defaultRule->ot_minimum_minutes);
    }

    public function test_anti_passback_debounces_rapid_duplicate_swipes_within_window(): void
    {
        // Set anti-passback to 3 minutes
        $this->service->saveTenantAttendanceSettings($this->tenant->id, [
            'anti_passback_minutes' => 3,
        ]);

        $date = Carbon::parse('2026-03-02'); // Monday

        // Swipe 1: 07:58:00 (In)
        AttendanceLog::create([
            'tenant_id' => $this->tenant->id,
            'employee_id' => $this->employee->id,
            'punch_datetime' => '2026-03-02 07:58:00',
            'punch_type' => 'in',
            'device_id' => 'DEV-01',
            'is_processed' => false,
        ]);

        // Swipe 2: 07:59:10 (Duplicate rapid swipe within 70 seconds) -> Should be debounced
        AttendanceLog::create([
            'tenant_id' => $this->tenant->id,
            'employee_id' => $this->employee->id,
            'punch_datetime' => '2026-03-02 07:59:10',
            'punch_type' => 'in',
            'device_id' => 'DEV-01',
            'is_processed' => false,
        ]);

        // Swipe 3: 17:01:00 (Out)
        AttendanceLog::create([
            'tenant_id' => $this->tenant->id,
            'employee_id' => $this->employee->id,
            'punch_datetime' => '2026-03-02 17:01:00',
            'punch_type' => 'out',
            'device_id' => 'DEV-01',
            'is_processed' => false,
        ]);

        // Swipe 4: 17:02:15 (Duplicate rapid swipe within 75 seconds) -> Should be debounced
        AttendanceLog::create([
            'tenant_id' => $this->tenant->id,
            'employee_id' => $this->employee->id,
            'punch_datetime' => '2026-03-02 17:02:15',
            'punch_type' => 'out',
            'device_id' => 'DEV-01',
            'is_processed' => false,
        ]);

        $result = $this->service->processDate($date);
        $this->assertSame(1, $result['present']);

        $record = AttendanceDaily::where('employee_id', $this->employee->id)->whereDate('attendance_date', '2026-03-02')->first();
        $this->assertNotNull($record);
        $this->assertSame('present', $record->status);
        $this->assertSame('2026-03-02 07:58:00', $record->check_in->toDateTimeString());
        $this->assertSame('2026-03-02 17:01:00', $record->check_out->toDateTimeString());

        // Breakdown should track raw count vs debounced count
        $this->assertSame(4, $record->calculation_breakdown['punches_count']);
        $this->assertSame(2, $record->calculation_breakdown['debounced_punches_count']);
    }

    public function test_direction_agnostic_telemetry_ignores_hardware_keypad_errors(): void
    {
        // When ignore_terminal_punch_type is TRUE (default):
        // Employee arrives at 07:55 but terminal keypad had 'out' button active by accident
        AttendanceLog::create([
            'tenant_id' => $this->tenant->id,
            'employee_id' => $this->employee->id,
            'punch_datetime' => '2026-03-03 07:55:00',
            'punch_type' => 'out', // HUMAN ERROR ON DEVICE KEYPAD
            'device_id' => 'DEV-01',
            'is_processed' => false,
        ]);

        // Employee leaves at 17:05 and terminal keypad had 'in' button active by accident
        AttendanceLog::create([
            'tenant_id' => $this->tenant->id,
            'employee_id' => $this->employee->id,
            'punch_datetime' => '2026-03-03 17:05:00',
            'punch_type' => 'in', // HUMAN ERROR ON DEVICE KEYPAD
            'device_id' => 'DEV-01',
            'is_processed' => false,
        ]);

        $date = Carbon::parse('2026-03-03');
        $result = $this->service->processDate($date);
        $this->assertSame(1, $result['present']);

        $record = AttendanceDaily::where('employee_id', $this->employee->id)->whereDate('attendance_date', '2026-03-03')->first();
        $this->assertNotNull($record);
        $this->assertSame('present', $record->status);
        // Correctly recognized 07:55 as check_in and 17:05 as check_out despite reversed device buttons
        $this->assertSame('2026-03-03 07:55:00', $record->check_in->toDateTimeString());
        $this->assertSame('2026-03-03 17:05:00', $record->check_out->toDateTimeString());
    }

    public function test_elastic_out_window_captures_late_overtime_without_missing_punch(): void
    {
        // Shift out window ends at 17:00 + 120 mins = 19:00 (+ 5 min grace = 19:05).
        // Employee stays late for approved critical release until 20:30 (outside the old rigid window).
        AttendanceLog::create([
            'tenant_id' => $this->tenant->id,
            'employee_id' => $this->employee->id,
            'punch_datetime' => '2026-03-04 08:00:00',
            'punch_type' => 'in',
            'is_processed' => false,
        ]);

        AttendanceLog::create([
            'tenant_id' => $this->tenant->id,
            'employee_id' => $this->employee->id,
            'punch_datetime' => '2026-03-04 20:30:00',
            'punch_type' => 'out',
            'is_processed' => false,
        ]);

        $date = Carbon::parse('2026-03-04');
        $result = $this->service->processDate($date);
        $this->assertSame(1, $result['present']);
        $this->assertSame(0, $result['missing_punch']);

        $record = AttendanceDaily::where('employee_id', $this->employee->id)->whereDate('attendance_date', '2026-03-04')->first();
        $this->assertNotNull($record);
        $this->assertSame('present', $record->status);
        $this->assertSame('2026-03-04 20:30:00', $record->check_out->toDateTimeString());
        // 08:00 to 20:30 is 12.5h - 1h break = 11.5h worked -> regular 8h, OT 3.5h
        $this->assertEquals(11.5, $record->worked_hours);
        $this->assertEquals(3.5, $record->ot_hours);
    }

    public function test_actual_segments_mode_pairs_intermediate_punches_and_deducts_exact_break(): void
    {
        // Configure shift for actual_segments mode & actual_punches break deduction
        $this->shift->update([
            'punch_mode' => 'actual_segments',
            'break_deduction_type' => 'actual_punches',
        ]);
        $this->service->saveTenantAttendanceSettings($this->tenant->id, [
            'anti_passback_minutes' => 1,
        ]);

        // 4 punches:
        // P1 (In): 08:00
        // P2 (Out for Lunch): 12:00 -> Segment 1: 4.0h
        // P3 (Back from Lunch): 12:45 -> Actual Break: 45 min
        // P4 (Final Out): 17:00 -> Segment 2: 4h15m (4.25h)
        // Total work: 4h + 4.25h = 8.25h. Actual break: 45m.
        AttendanceLog::create([
            'tenant_id' => $this->tenant->id,
            'employee_id' => $this->employee->id,
            'punch_datetime' => '2026-03-05 08:00:00',
            'is_processed' => false,
        ]);
        AttendanceLog::create([
            'tenant_id' => $this->tenant->id,
            'employee_id' => $this->employee->id,
            'punch_datetime' => '2026-03-05 12:00:00',
            'is_processed' => false,
        ]);
        AttendanceLog::create([
            'tenant_id' => $this->tenant->id,
            'employee_id' => $this->employee->id,
            'punch_datetime' => '2026-03-05 12:45:00',
            'is_processed' => false,
        ]);
        AttendanceLog::create([
            'tenant_id' => $this->tenant->id,
            'employee_id' => $this->employee->id,
            'punch_datetime' => '2026-03-05 17:00:00',
            'is_processed' => false,
        ]);

        $date = Carbon::parse('2026-03-05');
        $this->service->processDate($date);

        $record = AttendanceDaily::where('employee_id', $this->employee->id)->whereDate('attendance_date', '2026-03-05')->first();
        $this->assertNotNull($record);
        $this->assertSame('present', $record->status);
        $this->assertEquals(8.25, $record->worked_hours);
        $this->assertSame(45, $record->calculation_breakdown['break_minutes_deducted']);
        $this->assertSame('actual_segments', $record->calculation_breakdown['intermediate_punch_mode']);
        $this->assertCount(2, $record->calculation_breakdown['segments_breakdown']['segments']);
    }

    public function test_allow_early_in_as_ot_controls_pre_shift_arrival_hours(): void
    {
        // Case 1: allow_early_in_as_ot = false (Default)
        // Shift is 08:00 - 17:00 (break 60m). Worker arrives at 07:30 (30 mins early) and leaves at 17:00.
        // Effective in is clamped to 08:00 -> worked hours = 8.0h.
        $this->service->saveTenantAttendanceSettings($this->tenant->id, [
            'allow_early_in_as_ot' => false,
        ]);

        AttendanceLog::create([
            'tenant_id' => $this->tenant->id,
            'employee_id' => $this->employee->id,
            'punch_datetime' => '2026-03-06 07:30:00',
            'is_processed' => false,
        ]);
        AttendanceLog::create([
            'tenant_id' => $this->tenant->id,
            'employee_id' => $this->employee->id,
            'punch_datetime' => '2026-03-06 17:00:00',
            'is_processed' => false,
        ]);

        $date = Carbon::parse('2026-03-06');
        $this->service->processDate($date);

        $record = AttendanceDaily::where('employee_id', $this->employee->id)->whereDate('attendance_date', '2026-03-06')->first();
        $this->assertNotNull($record);
        $this->assertEquals(8.50, $record->worked_hours);
        $this->assertEquals(0.00, $record->ot_hours);

        // Case 2: allow_early_in_as_ot = true
        // Recalculate with allow_early_in_as_ot enabled -> 07:30 to 17:00 is 9.5h - 1h break = 8.5h -> OT 0.5h.
        $this->service->saveTenantAttendanceSettings($this->tenant->id, [
            'allow_early_in_as_ot' => true,
        ]);

        $this->service->processDate($date, null, null, true);

        $recordUpdated = AttendanceDaily::where('employee_id', $this->employee->id)->whereDate('attendance_date', '2026-03-06')->first();
        $this->assertNotNull($recordUpdated);
        $this->assertEquals(8.50, $recordUpdated->worked_hours);
        $this->assertEquals(0.50, $recordUpdated->ot_hours);
    }
}
