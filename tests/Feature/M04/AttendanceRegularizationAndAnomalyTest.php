<?php

declare(strict_types=1);

namespace Tests\Feature\M04;

use App\Models\AttendanceDaily;
use App\Models\AttendancePeriodLock;
use App\Models\AttendanceRegularizationRequest;
use App\Models\Department;
use App\Models\DepartmentHead;
use App\Models\Employee;
use App\Models\LeaveEntitlement;
use App\Models\LeaveType;
use App\Models\Shift;
use App\Models\Tenant;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

final class AttendanceRegularizationAndAnomalyTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;
    private User $admin;
    private User $hrManager;
    private User $hodUser;
    private Department $department;
    private Employee $employee;
    private Employee $hodEmployee;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(\Database\Seeders\RolesAndPermissionsSeeder::class);

        $this->tenant = Tenant::create([
            'name' => 'Tea Exports Ltd',
            'slug' => 'tea-exports',
            'is_active' => true,
            'is_ams_enabled' => true,
            'is_payroll_enabled' => true,
        ]);

        session(['tenant_id' => $this->tenant->id]);
        if (function_exists('setPermissionsTeamId')) {
            setPermissionsTeamId($this->tenant->id);
        }

        $this->admin = User::factory()->create([
            'tenant_id' => $this->tenant->id,
            'email' => 'admin@tea.com',
        ]);
        $this->admin->assignRole('Company Admin');

        $this->hrManager = User::factory()->create([
            'tenant_id' => $this->tenant->id,
            'email' => 'hr@tea.com',
        ]);
        $this->hrManager->assignRole('HR Manager');

        $this->hodUser = User::factory()->create([
            'tenant_id' => $this->tenant->id,
            'email' => 'hod@tea.com',
        ]);
        $this->hodUser->assignRole('Supervisor');

        $this->department = Department::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Operations',
            'code' => 'OPS',
            'is_active' => true,
        ]);

        $this->hodEmployee = Employee::create([
            'tenant_id' => $this->tenant->id,
            'emp_no' => 'EMP-HOD',
            'nic' => '198012345678',
            'full_name' => 'HOD Operations',
            'email' => 'hod@tea.com',
            'department_id' => $this->department->id,
            'employment_status' => 'active',
            'employment_type' => 'permanent',
        ]);

        DepartmentHead::create([
            'tenant_id' => $this->tenant->id,
            'department_id' => $this->department->id,
            'employee_id' => $this->hodEmployee->id,
        ]);

        $this->employee = Employee::create([
            'tenant_id' => $this->tenant->id,
            'emp_no' => 'EMP-001',
            'nic' => '199512345678',
            'full_name' => 'Kamal Silva',
            'email' => 'kamal@tea.com',
            'department_id' => $this->department->id,
            'employment_status' => 'active',
            'employment_type' => 'permanent',
        ]);
    }

    public function test_can_submit_regularization_and_auto_routes_to_hod(): void
    {
        $response = $this->actingAs($this->admin)->post('/attendance/regularizations', [
            'employee_id' => $this->employee->id,
            'attendance_date' => Carbon::yesterday()->toDateString(),
            'request_type' => 'missing_punch',
            'requested_check_in' => Carbon::yesterday()->setTime(8, 30)->toDateTimeString(),
            'requested_check_out' => Carbon::yesterday()->setTime(17, 0)->toDateTimeString(),
            'reason' => 'Fingerprint reader failed to detect finger on exit',
        ]);

        $response->assertRedirect();
        $this->assertDatabaseHas('attendance_regularization_requests', [
            'employee_id' => $this->employee->id,
            'request_type' => 'missing_punch',
            'status' => 'pending_hod',
        ]);
    }

    public function test_anti_overlap_prevents_duplicate_regularization_for_same_date(): void
    {
        $date = Carbon::yesterday()->toDateString();

        AttendanceRegularizationRequest::create([
            'tenant_id' => $this->tenant->id,
            'employee_id' => $this->employee->id,
            'attendance_date' => $date,
            'request_type' => 'missing_punch',
            'reason' => 'First submission',
            'status' => 'pending_hod',
        ]);

        $response = $this->actingAs($this->admin)->post('/attendance/regularizations', [
            'employee_id' => $this->employee->id,
            'attendance_date' => $date,
            'request_type' => 'missing_punch',
            'reason' => 'Duplicate attempt',
        ]);

        $response->assertSessionHasErrors(['attendance_date']);
    }

    public function test_two_tier_approval_flow_hod_recommends_and_hr_confirms(): void
    {
        $date = Carbon::yesterday()->toDateString();
        $req = AttendanceRegularizationRequest::create([
            'tenant_id' => $this->tenant->id,
            'employee_id' => $this->employee->id,
            'attendance_date' => $date,
            'request_type' => 'missing_punch',
            'requested_check_in' => Carbon::yesterday()->setTime(8, 30)->toDateTimeString(),
            'requested_check_out' => Carbon::yesterday()->setTime(17, 0)->toDateTimeString(),
            'reason' => 'Punch missing',
            'status' => 'pending_hod',
        ]);

        // Stage 1: HOD approves -> advances to pending_hr
        $res1 = $this->actingAs($this->hodUser)->post("/attendance/regularizations/{$req->id}/hod-action", [
            'decision' => 'approve',
            'remarks' => 'Verified on-site presence with security log',
        ]);
        $res1->assertRedirect();

        $req->refresh();
        $this->assertEquals('pending_hr', $req->status);
        $this->assertEquals($this->hodUser->id, $req->hod_id);

        // Stage 2: HR approves -> approved and punch ledger synced
        $res2 = $this->actingAs($this->hrManager)->post("/attendance/regularizations/{$req->id}/hr-action", [
            'decision' => 'approve',
            'remarks' => 'HR Confirmed',
        ]);
        $res2->assertRedirect();

        $req->refresh();
        $this->assertEquals('approved', $req->status);
        $this->assertFalse($req->is_bypassed_by_hr);

        // Daily ledger must be updated to present
        $this->assertDatabaseHas('attendance_daily', [
            'employee_id' => $this->employee->id,
            'attendance_date' => $date,
            'status' => 'present',
            'is_paid' => true,
        ]);
    }

    public function test_hr_direct_bypass_capability_from_pending_hod(): void
    {
        $date = Carbon::yesterday()->toDateString();
        $req = AttendanceRegularizationRequest::create([
            'tenant_id' => $this->tenant->id,
            'employee_id' => $this->employee->id,
            'attendance_date' => $date,
            'request_type' => 'on_duty_gate_pass',
            'requested_check_in' => Carbon::yesterday()->setTime(9, 0)->toDateTimeString(),
            'requested_check_out' => Carbon::yesterday()->setTime(18, 0)->toDateTimeString(),
            'reason' => 'Outstation factory audit',
            'status' => 'pending_hod',
        ]);

        // HR directly bypasses HOD
        $response = $this->actingAs($this->hrManager)->post("/attendance/regularizations/{$req->id}/hr-action", [
            'decision' => 'approve',
            'remarks' => 'Direct HR override for urgent audit trip',
        ]);
        $response->assertRedirect();

        $req->refresh();
        $this->assertEquals('approved', $req->status);
        $this->assertTrue($req->is_bypassed_by_hr);
    }

    public function test_granular_overtime_approval(): void
    {
        $date = Carbon::yesterday()->toDateString();
        $daily = AttendanceDaily::create([
            'tenant_id' => $this->tenant->id,
            'employee_id' => $this->employee->id,
            'attendance_date' => $date,
            'ot_hours' => 3.50,
            'double_ot_hours' => 1.00,
            'ot_approval_status' => 'pending',
            'status' => 'present',
        ]);

        // Partial OT approval: approve 2.0h out of 3.5h
        $response = $this->actingAs($this->hrManager)->post("/attendance/daily/{$daily->id}/approve-ot", [
            'mode' => 'partial',
            'approved_ot_hours' => 2.00,
            'approved_double_ot_hours' => 1.00,
            'remarks' => 'Approved 2h normal OT and 1h double OT per project budget',
        ]);

        $response->assertRedirect();

        $daily->refresh();
        $this->assertEquals(2.00, $daily->approved_ot_hours);
        $this->assertEquals(1.00, $daily->approved_double_ot_hours);
        $this->assertEquals('hr_confirmed', $daily->ot_approval_status);
        $this->assertEquals($this->hrManager->id, $daily->ot_approved_by);
    }

    public function test_unapproved_half_day_resolution_via_paid_waiver_mechanism_c(): void
    {
        $date = Carbon::yesterday()->toDateString();
        $daily = AttendanceDaily::create([
            'tenant_id' => $this->tenant->id,
            'employee_id' => $this->employee->id,
            'attendance_date' => $date,
            'status' => 'half_day',
            'is_paid' => false,
            'worked_hours' => 4.50,
            'anomalies' => [
                ['type' => 'UNAPPROVED_HALF_DAY', 'label' => 'Unapproved Half Day'],
            ],
        ]);

        $response = $this->actingAs($this->hrManager)->post("/attendance/daily/{$daily->id}/resolve-anomaly", [
            'mechanism' => 'paid_waiver',
            'justification' => 'Managerial paid waiver granted due to verified power outage on site',
        ]);

        $response->assertRedirect();

        $daily->refresh();
        $this->assertTrue($daily->is_paid);
        $this->assertStringContainsString('Paid Half-Day Waiver', (string) $daily->manual_reason);
    }

    public function test_unapproved_half_day_resolution_via_retro_leave_mechanism_b(): void
    {
        $date = Carbon::yesterday()->toDateString();
        $daily = AttendanceDaily::create([
            'tenant_id' => $this->tenant->id,
            'employee_id' => $this->employee->id,
            'attendance_date' => $date,
            'status' => 'half_day',
            'is_paid' => false,
            'worked_hours' => 4.00,
            'anomalies' => [
                ['type' => 'UNAPPROVED_HALF_DAY', 'label' => 'Unapproved Half Day'],
            ],
        ]);

        $casualLeave = LeaveType::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Casual Leave',
            'code' => 'CASUAL',
            'is_paid' => true,
        ]);

        LeaveEntitlement::create([
            'tenant_id' => $this->tenant->id,
            'employee_id' => $this->employee->id,
            'leave_type_id' => $casualLeave->id,
            'year' => Carbon::parse($date)->year,
            'allocated_days' => 7.0,
            'used_days' => 0.0,
            'pending_days' => 0.0,
            'remaining_days' => 7.0,
        ]);

        $response = $this->actingAs($this->hrManager)->post("/attendance/daily/{$daily->id}/resolve-anomaly", [
            'mechanism' => 'retro_leave',
            'leave_type_id' => $casualLeave->id,
            'justification' => 'Employee requested retro casual leave conversion',
        ]);

        $response->assertRedirect();

        $daily->refresh();
        $this->assertTrue($daily->is_paid);
        $this->assertEquals('half_day', $daily->status);

        // Leave entitlement must have 0.5 days deducted
        $entitlement = LeaveEntitlement::where('employee_id', $this->employee->id)->first();
        $this->assertEquals(0.5, $entitlement->used_days);
    }

    public function test_attendance_period_freeze_and_final_lock_prevents_regularization(): void
    {
        $now = Carbon::now();

        // HR locks current month
        $response = $this->actingAs($this->hrManager)->post('/attendance/timesheet/freeze', [
            'year' => $now->year,
            'month' => $now->month,
            'action' => 'hr_lock',
            'notes' => 'Month-end attendance finalized for payroll',
        ]);
        $response->assertRedirect();

        $this->assertDatabaseHas('attendance_period_locks', [
            'year' => $now->year,
            'month' => $now->month,
            'status' => 'hr_locked',
        ]);

        // Attempting to submit a regularization in locked period fails
        $subResponse = $this->actingAs($this->admin)->post('/attendance/regularizations', [
            'employee_id' => $this->employee->id,
            'attendance_date' => $now->copy()->startOfMonth()->toDateString(),
            'request_type' => 'missing_punch',
            'reason' => 'Late claim attempt',
        ]);

        $subResponse->assertSessionHasErrors(['attendance_date']);
    }
}
