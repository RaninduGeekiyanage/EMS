<?php

declare(strict_types=1);

namespace Tests\Feature\M02;

use App\Models\AttendanceDaily;
use App\Models\AttendanceLog;
use App\Models\AttendanceRule;
use App\Models\Company;
use App\Models\Department;
use App\Models\Employee;
use App\Models\Shift;
use App\Models\ShiftAssignment;
use App\Models\Tenant;
use App\Models\User;
use App\Services\AttendanceProcessingService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

final class ShiftPunchAndBreakPolicyTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;
    private User $companyAdmin;
    private Employee $employee;
    private AttendanceProcessingService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(\Database\Seeders\RolesAndPermissionsSeeder::class);

        $this->tenant = Tenant::create([
            'name' => 'Acme Industrial & Corporate Group',
            'slug' => 'acme-ind',
            'is_active' => true,
        ]);

        session(['tenant_id' => $this->tenant->id]);
        app()->instance('current_tenant_id', $this->tenant->id);
        app()->instance('current_tenant', $this->tenant);
        if (function_exists('setPermissionsTeamId')) {
            setPermissionsTeamId($this->tenant->id);
        }

        $company = Company::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Acme Corp',
            'code' => 'ACME',
        ]);

        $department = Department::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Operations',
        ]);

        $this->companyAdmin = User::factory()->create([
            'tenant_id' => $this->tenant->id,
            'is_super_admin' => false,
        ]);
        $this->companyAdmin->assignRole('Company Admin');

        $this->employee = Employee::create([
            'tenant_id' => $this->tenant->id,
            'company_id' => $company->id,
            'department_id' => $department->id,
            'emp_no' => 'EMP-IND-001',
            'full_name' => 'Kasun Perera',
            'nic' => '891234567V',
            'biometric_device_id' => '1001',
            'employment_status' => 'active',
            'is_active' => true,
        ]);

        AttendanceRule::create([
            'tenant_id' => $this->tenant->id,
            'shift_id' => null,
            'rule_name' => 'Company Standard Attendance Policy',
            'grace_period_minutes' => 15,
            'early_departure_grace_minutes' => 15,
            'ot_minimum_minutes' => 15,
            'half_day_min_hours' => 4.0,
            'half_day_max_hours' => 6.0,
            'full_day_min_hours' => 7.0,
            'standard_day_hours' => 8.0,
            'effective_from' => '2026-01-01',
        ]);

        $this->service = app(AttendanceProcessingService::class);
    }

    public function test_can_create_and_update_shift_with_custom_punch_mode_and_break_policy(): void
    {
        $payload = [
            'name' => 'Factory Line Shift',
            'code' => 'FAC-LINE',
            'shift_type' => 'regular',
            'start_time' => '07:00',
            'end_time' => '16:00',
            'break_minutes' => 45,
            'grace_minutes' => 10,
            'ot_threshold_minutes' => 480,
            'is_night_shift' => false,
            'punch_mode' => 'actual_segments',
            'break_deduction_type' => 'actual_punches',
            'min_work_hours_for_break' => 240,
        ];

        $response = $this->actingAs($this->companyAdmin)->from('/shifts')->post('/shifts', $payload);
        $response->assertRedirect('/shifts');

        $shift = Shift::where('tenant_id', $this->tenant->id)->where('code', 'FAC-LINE')->first();
        $this->assertNotNull($shift);
        $this->assertSame('actual_segments', $shift->punch_mode);
        $this->assertSame('actual_punches', $shift->break_deduction_type);
        $this->assertSame(240, $shift->min_work_hours_for_break);

        // Update shift policy
        $updatePayload = array_merge($payload, [
            'name' => 'Factory Line Shift Updated',
            'break_deduction_type' => 'no_deduction',
        ]);

        $updateResponse = $this->actingAs($this->companyAdmin)->from('/shifts')->put("/shifts/{$shift->id}", $updatePayload);
        $updateResponse->assertRedirect('/shifts');

        $shift->refresh();
        $this->assertSame('no_deduction', $shift->break_deduction_type);
    }

    public function test_corporate_first_last_shift_deducts_scheduled_meal_break_when_threshold_met(): void
    {
        // 08:30 to 17:30 (9h elapsed), 60m break, min qualifying 300m (5h)
        $shift = Shift::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'General Corporate Shift',
            'code' => 'CORP-GEN',
            'shift_type' => 'regular',
            'start_time' => '08:30:00',
            'end_time' => '17:30:00',
            'break_minutes' => 60,
            'grace_minutes' => 15,
            'ot_threshold_minutes' => 480,
            'is_night_shift' => false,
            'punch_mode' => 'first_last',
            'break_deduction_type' => 'auto_deduct',
            'min_work_hours_for_break' => 300,
        ]);

        ShiftAssignment::create([
            'tenant_id' => $this->tenant->id,
            'employee_id' => $this->employee->id,
            'shift_id' => $shift->id,
            'effective_from' => '2026-03-01',
        ]);

        // Punches: 08:30 and 17:30 (Gross: 9.0h)
        AttendanceLog::create([
            'tenant_id' => $this->tenant->id,
            'employee_id' => $this->employee->id,
            'punch_datetime' => '2026-03-05 08:30:00',
            'is_processed' => false,
        ]);
        AttendanceLog::create([
            'tenant_id' => $this->tenant->id,
            'employee_id' => $this->employee->id,
            'punch_datetime' => '2026-03-05 17:30:00',
            'is_processed' => false,
        ]);

        $this->service->processDate(Carbon::parse('2026-03-05'));

        $record = AttendanceDaily::where('employee_id', $this->employee->id)->whereDate('attendance_date', '2026-03-05')->first();
        $this->assertNotNull($record);
        $this->assertSame(8.0, (float) $record->worked_hours);
        $this->assertSame(60, $record->calculation_breakdown['break_minutes_deducted']);
        $this->assertSame('first_last', $record->calculation_breakdown['punch_mode']);
        $this->assertSame('auto_deduct', $record->calculation_breakdown['break_deduction_type']);
    }

    public function test_corporate_shift_does_not_deduct_break_when_work_time_below_qualifying_threshold(): void
    {
        // 08:30 to 12:30 (4h elapsed). Min work time for break is 300m (5h).
        // Employee left half-day/sick; meal break of 60m should NOT be deducted!
        $shift = Shift::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'General Corporate Shift',
            'code' => 'CORP-GEN',
            'shift_type' => 'regular',
            'start_time' => '08:30:00',
            'end_time' => '17:30:00',
            'break_minutes' => 60,
            'grace_minutes' => 15,
            'ot_threshold_minutes' => 480,
            'is_night_shift' => false,
            'punch_mode' => 'first_last',
            'break_deduction_type' => 'auto_deduct',
            'min_work_hours_for_break' => 300,
        ]);

        ShiftAssignment::create([
            'tenant_id' => $this->tenant->id,
            'employee_id' => $this->employee->id,
            'shift_id' => $shift->id,
            'effective_from' => '2026-03-01',
        ]);

        AttendanceLog::create([
            'tenant_id' => $this->tenant->id,
            'employee_id' => $this->employee->id,
            'punch_datetime' => '2026-03-05 08:30:00',
            'is_processed' => false,
        ]);
        AttendanceLog::create([
            'tenant_id' => $this->tenant->id,
            'employee_id' => $this->employee->id,
            'punch_datetime' => '2026-03-05 12:30:00',
            'is_processed' => false,
        ]);

        $this->service->processDate(Carbon::parse('2026-03-05'));

        $record = AttendanceDaily::where('employee_id', $this->employee->id)->whereDate('attendance_date', '2026-03-05')->first();
        $this->assertNotNull($record);
        $this->assertSame(4.0, (float) $record->worked_hours);
        $this->assertSame(0, $record->calculation_breakdown['break_minutes_deducted']);
        $this->assertSame('half_day', $record->status);
    }

    public function test_factory_shift_pairs_actual_segments_and_deducts_exact_canteen_break(): void
    {
        // Shift configured for actual_segments and actual_punches
        $shift = Shift::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Plant Morning Shift',
            'code' => 'PLANT-MORN',
            'shift_type' => 'regular',
            'start_time' => '08:00:00',
            'end_time' => '17:00:00',
            'break_minutes' => 30,
            'grace_minutes' => 10,
            'ot_threshold_minutes' => 480,
            'is_night_shift' => false,
            'punch_mode' => 'actual_segments',
            'break_deduction_type' => 'actual_punches',
            'min_work_hours_for_break' => 240,
        ]);

        ShiftAssignment::create([
            'tenant_id' => $this->tenant->id,
            'employee_id' => $this->employee->id,
            'shift_id' => $shift->id,
            'effective_from' => '2026-03-01',
        ]);

        // Punches:
        // In 1: 08:00, Out 1: 12:00 (4.0h)
        // In 2: 12:40, Out 2: 17:00 (4h 20m = 4.33h)
        // Break duration: 12:00 to 12:40 = 40 mins.
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
            'punch_datetime' => '2026-03-05 12:40:00',
            'is_processed' => false,
        ]);
        AttendanceLog::create([
            'tenant_id' => $this->tenant->id,
            'employee_id' => $this->employee->id,
            'punch_datetime' => '2026-03-05 17:00:00',
            'is_processed' => false,
        ]);

        $this->service->processDate(Carbon::parse('2026-03-05'));

        $record = AttendanceDaily::where('employee_id', $this->employee->id)->whereDate('attendance_date', '2026-03-05')->first();
        $this->assertNotNull($record);
        $this->assertSame(40, $record->calculation_breakdown['break_minutes_deducted']);
        $this->assertSame(8.33, (float) $record->worked_hours);
        $this->assertSame('actual_segments', $record->calculation_breakdown['punch_mode']);
        $this->assertSame('actual_punches', $record->calculation_breakdown['break_deduction_type']);
        $this->assertCount(2, $record->calculation_breakdown['segments_breakdown']['segments']);
    }

    public function test_continuous_duty_shift_with_no_deduction_policy(): void
    {
        // Security 8h shift with fully paid meals / 0m deduction
        $shift = Shift::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Security Patrol Shift',
            'code' => 'SEC-PATROL',
            'shift_type' => 'regular',
            'start_time' => '08:00:00',
            'end_time' => '16:00:00',
            'break_minutes' => 0,
            'grace_minutes' => 10,
            'ot_threshold_minutes' => 480,
            'is_night_shift' => false,
            'punch_mode' => 'first_last',
            'break_deduction_type' => 'no_deduction',
            'min_work_hours_for_break' => 0,
        ]);

        ShiftAssignment::create([
            'tenant_id' => $this->tenant->id,
            'employee_id' => $this->employee->id,
            'shift_id' => $shift->id,
            'effective_from' => '2026-03-01',
        ]);

        AttendanceLog::create([
            'tenant_id' => $this->tenant->id,
            'employee_id' => $this->employee->id,
            'punch_datetime' => '2026-03-05 08:00:00',
            'is_processed' => false,
        ]);
        AttendanceLog::create([
            'tenant_id' => $this->tenant->id,
            'employee_id' => $this->employee->id,
            'punch_datetime' => '2026-03-05 16:00:00',
            'is_processed' => false,
        ]);

        $this->service->processDate(Carbon::parse('2026-03-05'));

        $record = AttendanceDaily::where('employee_id', $this->employee->id)->whereDate('attendance_date', '2026-03-05')->first();
        $this->assertNotNull($record);
        $this->assertSame(8.0, (float) $record->worked_hours);
        $this->assertSame(0, $record->calculation_breakdown['break_minutes_deducted']);
        $this->assertSame('no_deduction', $record->calculation_breakdown['break_deduction_type']);
    }
}
