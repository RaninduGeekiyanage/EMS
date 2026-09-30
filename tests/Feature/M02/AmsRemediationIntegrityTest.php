<?php

declare(strict_types=1);

namespace Tests\Feature\M02;

use App\Models\AttendanceDaily;
use App\Models\AttendanceLog;
use App\Models\AttendanceRule;
use App\Models\Department;
use App\Models\Employee;
use App\Models\LeaveRequest;
use App\Models\LeaveType;
use App\Models\PublicHoliday;
use App\Models\Roster;
use App\Models\RosterEntry;
use App\Models\Shift;
use App\Models\ShiftAssignment;
use App\Models\Tenant;
use App\Models\User;
use App\Services\AttendanceProcessingService;
use App\Services\LeaveService;
use App\Services\OvertimeCalculationService;
use App\Services\PayrollCalculationService;
use Carbon\Carbon;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

final class AmsRemediationIntegrityTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;
    private User $manager;
    private Employee $employee;
    private Shift $nightShift;
    private Shift $dayShift;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);

        $this->tenant = Tenant::create([
            'name' => 'Apex Logistics Ltd',
            'slug' => 'apex-logistics',
            'is_active' => true,
        ]);

        session(['tenant_id' => $this->tenant->id]);
        app()->instance('current_tenant_id', $this->tenant->id);
        app()->instance('current_tenant', $this->tenant);
        if (function_exists('setPermissionsTeamId')) {
            setPermissionsTeamId($this->tenant->id);
        }

        $this->manager = User::factory()->create([
            'name' => 'HR Operations Lead',
            'email' => 'hrlead@apex.com',
        ]);
        $this->manager->assignRole('HR Manager');

        $dept = Department::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Warehouse Logistics',
        ]);

        $this->employee = Employee::create([
            'tenant_id' => $this->tenant->id,
            'department_id' => $dept->id,
            'emp_no' => 'APX-5001',
            'full_name' => 'Kasun Perera',
            'nic' => '901234567V',
            'biometric_device_id' => '5001',
            'employment_status' => 'active',
            'basic_salary' => 75000.00,
            'payment_mode' => 'monthly',
        ]);

        $this->nightShift = Shift::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Warehouse Night Shift',
            'code' => 'NIGHT-01',
            'shift_type' => 'night',
            'start_time' => '22:00:00',
            'end_time' => '06:00:00',
            'break_minutes' => 60,
            'grace_minutes' => 15,
            'ot_threshold_minutes' => 480,
            'is_night_shift' => true,
            'is_active' => true,
        ]);

        $this->dayShift = Shift::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Warehouse Day Shift',
            'code' => 'DAY-01',
            'shift_type' => 'regular',
            'start_time' => '08:00:00',
            'end_time' => '17:00:00',
            'break_minutes' => 60,
            'grace_minutes' => 10,
            'ot_threshold_minutes' => 480,
            'is_night_shift' => false,
            'is_active' => true,
        ]);
    }

    /**
     * Test Issue 1 & 3: Night shift checkout punch on morning of Day D+1 is not claimed
     * by Day D+1 (a rest day) as an incomplete punch or false morning shift.
     */
    public function test_night_shift_checkout_punch_not_misattributed_to_subsequent_rest_day(): void
    {
        $roster = Roster::create([
            'tenant_id' => $this->tenant->id,
            'department_id' => $this->employee->department_id,
            'name' => 'Logistics Roster March 2026',
            'code' => 'LOG-2026-03',
            'start_date' => '2026-03-01',
            'end_date' => '2026-03-31',
            'status' => 'published',
        ]);

        // Day 1: Night Shift (2026-03-02)
        RosterEntry::create([
            'tenant_id' => $this->tenant->id,
            'roster_id' => $roster->id,
            'employee_id' => $this->employee->id,
            'roster_date' => '2026-03-02',
            'shift_id' => $this->nightShift->id,
            'schedule_type' => 'shift',
            'status' => 'published',
        ]);

        // Day 2: Scheduled Rest Day (2026-03-03)
        RosterEntry::create([
            'tenant_id' => $this->tenant->id,
            'roster_id' => $roster->id,
            'employee_id' => $this->employee->id,
            'roster_date' => '2026-03-03',
            'shift_id' => null,
            'schedule_type' => 'rest_day',
            'status' => 'published',
        ]);

        // Employee punches in at 21:55 on March 02, and out at 06:05 on March 03
        AttendanceLog::create([
            'tenant_id' => $this->tenant->id,
            'employee_id' => $this->employee->id,
            'punch_datetime' => '2026-03-02 21:55:00',
            'punch_type' => 'in',
            'source' => 'device',
        ]);
        AttendanceLog::create([
            'tenant_id' => $this->tenant->id,
            'employee_id' => $this->employee->id,
            'punch_datetime' => '2026-03-03 06:05:00',
            'punch_type' => 'out',
            'source' => 'device',
        ]);

        $service = app(AttendanceProcessingService::class);

        // Process Day 1
        $service->processDate(Carbon::parse('2026-03-02'));
        // Process Day 2
        $service->processDate(Carbon::parse('2026-03-03'));

        $day1 = AttendanceDaily::where('employee_id', $this->employee->id)
            ->whereDate('attendance_date', '2026-03-02')
            ->first();
        $this->assertNotNull($day1);
        $this->assertEquals('present', $day1->status);
        $this->assertEquals('2026-03-02 21:55:00', $day1->check_in->toDateTimeString());
        $this->assertEquals('2026-03-03 06:05:00', $day1->check_out->toDateTimeString());

        $day2 = AttendanceDaily::where('employee_id', $this->employee->id)
            ->whereDate('attendance_date', '2026-03-03')
            ->first();
        $this->assertNotNull($day2);
        // Day 2 must be rest_day, NOT missing_punch
        $this->assertEquals('rest_day', $day2->status);
        $this->assertNull($day2->check_in);
        $this->assertNull($day2->check_out);
        $this->assertEquals(0.00, (float) $day2->worked_hours);
    }

    /**
     * Test Issue 2: Rostered weekday rest days (e.g. Wednesday) grant 1.5x rest day overtime
     * when employee is called in to work.
     */
    public function test_rostered_weekday_rest_day_grants_rest_day_overtime(): void
    {
        $roster = Roster::create([
            'tenant_id' => $this->tenant->id,
            'department_id' => $this->employee->department_id,
            'name' => 'Shift Worker Roster',
            'code' => 'SWR-2026',
            'start_date' => '2026-03-01',
            'end_date' => '2026-03-31',
            'status' => 'published',
        ]);

        // 2026-03-04 is a Wednesday (rostered rest day)
        RosterEntry::create([
            'tenant_id' => $this->tenant->id,
            'roster_id' => $roster->id,
            'employee_id' => $this->employee->id,
            'roster_date' => '2026-03-04',
            'shift_id' => null,
            'schedule_type' => 'rest_day',
            'status' => 'published',
        ]);

        // Employee works on their Wednesday rest day (08:00 to 15:00 = 7h - 1h break = 6h worked)
        AttendanceLog::create([
            'tenant_id' => $this->tenant->id,
            'employee_id' => $this->employee->id,
            'punch_datetime' => '2026-03-04 08:00:00',
            'punch_type' => 'in',
            'source' => 'device',
        ]);
        AttendanceLog::create([
            'tenant_id' => $this->tenant->id,
            'employee_id' => $this->employee->id,
            'punch_datetime' => '2026-03-04 15:00:00',
            'punch_type' => 'out',
            'source' => 'device',
        ]);

        $service = app(AttendanceProcessingService::class);
        $service->processDate(Carbon::parse('2026-03-04'));

        $record = AttendanceDaily::where('employee_id', $this->employee->id)
            ->whereDate('attendance_date', '2026-03-04')
            ->first();

        $this->assertNotNull($record);
        $this->assertEquals('present', $record->status);
        $this->assertEquals(6.00, (float) $record->worked_hours);
        $this->assertEquals(6.00, (float) $record->ot_hours);
        $this->assertEquals('rest_day', $record->calculation_breakdown['day_type']);
        $this->assertEquals(1.50, (float) $record->calculation_breakdown['applied_rate']);
    }

    /**
     * Test Issue 5 & 6: Approved half-day leave with punches on the other half
     * retains the scheduled shift definition, marks status half_day with full regular hours credited,
     * and payroll does NOT deduct a no-pay day.
     */
    public function test_approved_half_day_leave_with_punches_retains_shift_and_avoids_no_pay_penalty(): void
    {
        ShiftAssignment::create([
            'tenant_id' => $this->tenant->id,
            'employee_id' => $this->employee->id,
            'shift_id' => $this->dayShift->id,
            'effective_from' => '2026-01-01',
        ]);

        $casualLeave = LeaveType::create([
            'tenant_id' => $this->tenant->id,
            'code' => 'CASUAL',
            'name' => 'Casual Leave',
            'days_per_year' => 7.0,
            'is_paid' => true,
        ]);

        // Approved afternoon half-day leave on Thursday 2026-03-05
        LeaveRequest::create([
            'tenant_id' => $this->tenant->id,
            'employee_id' => $this->employee->id,
            'leave_type_id' => $casualLeave->id,
            'start_date' => '2026-03-05',
            'end_date' => '2026-03-05',
            'days_count' => 0.5,
            'is_half_day' => true,
            'half_day_type' => 'second_half',
            'reason' => 'Doctor appointment',
            'status' => 'approved',
            'actioned_by' => $this->manager->id,
            'actioned_at' => now(),
        ]);

        // Employee works morning half (08:00 to 12:00 = 4 hours)
        AttendanceLog::create([
            'tenant_id' => $this->tenant->id,
            'employee_id' => $this->employee->id,
            'punch_datetime' => '2026-03-05 08:00:00',
            'punch_type' => 'in',
            'source' => 'device',
        ]);
        AttendanceLog::create([
            'tenant_id' => $this->tenant->id,
            'employee_id' => $this->employee->id,
            'punch_datetime' => '2026-03-05 12:00:00',
            'punch_type' => 'out',
            'source' => 'device',
        ]);

        $service = app(AttendanceProcessingService::class);
        $service->processDate(Carbon::parse('2026-03-05'));

        $record = AttendanceDaily::where('employee_id', $this->employee->id)
            ->whereDate('attendance_date', '2026-03-05')
            ->first();

        $this->assertNotNull($record);
        $this->assertEquals('half_day', $record->status);
        $this->assertEquals(4.00, (float) $record->worked_hours);
        $this->assertEquals(8.00, (float) $record->regular_hours); // 4h worked + 4h approved leave credit
        $this->assertTrue($record->calculation_breakdown['is_paid']);

        // Verify Payroll calculation: paid half-day leave gives 1.00 worked days and 0.00 no-pay days
        $payrollService = app(PayrollCalculationService::class);
        $summary = $payrollService->calculateEmployeePayroll(
            $this->employee,
            Carbon::parse('2026-03-01'),
            Carbon::parse('2026-03-31')
        );

        $this->assertEquals(1.00, $summary['worked_days']);
        $this->assertEquals(0.00, $summary['no_pay_days']);
    }

    /**
     * Test Issue 7: Cancelling an approved leave reprocesses the daily attendance ledger
     * rather than destroying the record and leaving orphaned gaps.
     */
    public function test_cancelling_approved_leave_reprocesses_attendance_non_destructively(): void
    {
        $annual = LeaveType::create([
            'tenant_id' => $this->tenant->id,
            'code' => 'ANNUAL',
            'name' => 'Annual Leave',
            'days_per_year' => 14.0,
            'is_paid' => true,
        ]);

        $leaveService = app(LeaveService::class);

        // Apply and approve leave for 2026-04-06
        $request = LeaveRequest::create([
            'tenant_id' => $this->tenant->id,
            'employee_id' => $this->employee->id,
            'leave_type_id' => $annual->id,
            'start_date' => '2026-04-06',
            'end_date' => '2026-04-06',
            'days_count' => 1.0,
            'is_half_day' => false,
            'reason' => 'Family travel',
            'status' => 'approved',
            'actioned_by' => $this->manager->id,
            'actioned_at' => now(),
        ]);

        $leaveService->syncAttendanceLedgerForLeave($request);

        $record = AttendanceDaily::where('employee_id', $this->employee->id)
            ->whereDate('attendance_date', '2026-04-06')
            ->first();
        $this->assertNotNull($record);
        $this->assertEquals('leave', $record->status);

        // Now cancel the leave request
        $leaveService->cancelLeave($request, $this->manager);

        // The record should NOT be deleted; it must be reprocessed to the actual status (e.g. absent or rest day)
        $reprocessedRecord = AttendanceDaily::where('employee_id', $this->employee->id)
            ->whereDate('attendance_date', '2026-04-06')
            ->first();
        $this->assertNotNull($reprocessedRecord);
        $this->assertNotEquals('leave', $reprocessedRecord->status);
    }

    /**
     * Test Management Custom Overtime: Management-configured holiday OT multiplier
     * and shift custom working hours threshold.
     */
    public function test_management_configured_holiday_multiplier_and_custom_shift_threshold(): void
    {
        // 9-hour shift (540 working minutes threshold before OT)
        $customShift = Shift::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Extended 9h Operations',
            'code' => 'EXT-9H',
            'shift_type' => 'regular',
            'start_time' => '08:00:00',
            'end_time' => '18:00:00',
            'break_minutes' => 60,
            'ot_threshold_minutes' => 540, // 9 hours
            'is_night_shift' => false,
            'is_active' => true,
        ]);

        $rule = AttendanceRule::create([
            'tenant_id' => $this->tenant->id,
            'rule_name' => 'Standard Policy',
            'ot_rate_weekday' => 1.50,
            'ot_rate_rest_day' => 1.50,
            'ot_rate_holiday' => 2.00,
            'ot_buffer_minutes' => 0,
            'ot_minimum_minutes' => 15,
            'grace_period_minutes' => 10,
            'half_day_min_hours' => 4.0,
            'half_day_max_hours' => 6.0,
            'early_departure_grace_minutes' => 0,
            'round_ot_interval_minutes' => 0,
        ]);

        $otService = app(OvertimeCalculationService::class);

        // Worked 10 hours on custom 9-hour shift -> 9 regular hours, 1 OT hour
        $res = $otService->calculate($rule, $customShift, Carbon::parse('2026-05-12'), 10.00);
        $this->assertEquals(9.00, $res['regular_hours']);
        $this->assertEquals(1.00, $res['ot_hours']);

        // Holiday with management-configured 2.5x multiplier
        $holiday = PublicHoliday::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Special Golden Poya Holiday',
            'holiday_date' => '2026-05-15',
            'custom_ot_rate' => 2.50,
        ]);

        $holidayRes = $otService->calculate($rule, $customShift, Carbon::parse('2026-05-15'), 8.00, $holiday);
        $this->assertEquals(2.50, $holidayRes['applied_rate']);
        $this->assertEquals(8.00, $holidayRes['double_ot_hours']);
    }
}
