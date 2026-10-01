<?php

declare(strict_types=1);

namespace Tests\Feature\M04;

use App\Models\AttendanceDaily;
use App\Models\AttendancePeriodLock;
use App\Models\CompensatoryLeaveRecord;
use App\Models\Department;
use App\Models\DepartmentHead;
use App\Models\Employee;
use App\Models\LeaveEntitlement;
use App\Models\LeaveRequest;
use App\Models\LeaveType;
use App\Models\Shift;
use App\Models\ShiftAssignment;
use App\Models\Tenant;
use App\Models\User;
use App\Services\LeaveService;
use Carbon\Carbon;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

final class LeavePhaseTwoTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;
    private User $hrManager;
    private User $hodUser;
    private Employee $hodEmployee;
    private Employee $applicantEmployee;
    private Employee $coveringColleague;
    private Department $department;
    private LeaveType $casualType;
    private LeaveType $compensatoryType;
    private LeaveService $leaveService;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);

        $this->tenant = Tenant::create([
            'name' => 'Apex Operations PLC',
            'slug' => 'apex-operations',
            'is_active' => true,
        ]);

        session(['tenant_id' => $this->tenant->id]);
        app()->instance('current_tenant_id', $this->tenant->id);
        app()->instance('current_tenant', $this->tenant);
        if (function_exists('setPermissionsTeamId')) {
            setPermissionsTeamId($this->tenant->id);
        }

        $this->department = Department::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Logistics & Fleet Division',
        ]);

        // HR Manager
        $this->hrManager = User::factory()->create([
            'name' => 'HR Operations Lead',
            'email' => 'hr.lead@apex.com',
        ]);
        $this->hrManager->assignRole('HR Manager');

        // HOD Employee & User
        $this->hodEmployee = Employee::create([
            'tenant_id' => $this->tenant->id,
            'department_id' => $this->department->id,
            'emp_no' => 'EMP-HOD',
            'full_name' => 'Nimal Jayawardena',
            'email' => 'nimal.hod@apex.com',
            'nic' => '751234567V',
            'date_of_joining' => '2020-01-01',
            'employment_status' => 'active',
        ]);

        $this->hodUser = User::factory()->create([
            'name' => 'Nimal Jayawardena',
            'email' => 'nimal.hod@apex.com',
        ]);
        $this->hodUser->assignRole('Supervisor');

        DepartmentHead::create([
            'tenant_id' => $this->tenant->id,
            'department_id' => $this->department->id,
            'employee_id' => $this->hodEmployee->id,
            'is_active' => true,
        ]);

        // Applicant Employee
        $this->applicantEmployee = Employee::create([
            'tenant_id' => $this->tenant->id,
            'department_id' => $this->department->id,
            'emp_no' => 'EMP-010',
            'full_name' => 'Kasun Silva',
            'nic' => '911234567V',
            'date_of_joining' => '2024-01-01',
            'employment_status' => 'active',
        ]);

        // Covering Colleague
        $this->coveringColleague = Employee::create([
            'tenant_id' => $this->tenant->id,
            'department_id' => $this->department->id,
            'emp_no' => 'EMP-011',
            'full_name' => 'Suresh Fernando',
            'nic' => '921234567V',
            'date_of_joining' => '2024-01-01',
            'employment_status' => 'active',
        ]);

        $this->leaveService = app(LeaveService::class);
        $this->leaveService->seedStatutoryTypes($this->tenant->id);

        $this->casualType = LeaveType::where('tenant_id', $this->tenant->id)->where('code', 'CASUAL')->firstOrFail();
        $this->compensatoryType = LeaveType::where('tenant_id', $this->tenant->id)->where('code', 'COMPENSATORY')->firstOrFail();

        // Entitlement for applicant: 7 days casual
        LeaveEntitlement::create([
            'tenant_id' => $this->tenant->id,
            'employee_id' => $this->applicantEmployee->id,
            'leave_type_id' => $this->casualType->id,
            'year' => 2026,
            'allocated_days' => 7.0,
            'used_days' => 0.0,
            'pending_days' => 0.0,
            'carried_forward_days' => 0.0,
        ]);
    }

    public function test_can_submit_short_leave_with_zero_leave_deduction(): void
    {
        $response = $this->actingAs($this->hrManager)
            ->withHeaders(['X-Tenant-ID' => $this->tenant->id])
            ->post('/leave/requests', [
                'employee_id' => $this->applicantEmployee->id,
                'leave_type_id' => $this->casualType->id,
                'start_date' => '2026-10-15',
                'end_date' => '2026-10-15',
                'is_short_leave' => true,
                'short_leave_from' => '08:30',
                'short_leave_to' => '10:00',
                'reason' => 'Doctor appointment for routine checkup',
            ]);

        $response->assertRedirect();
        $response->assertSessionHas('success');

        $req = LeaveRequest::where('employee_id', $this->applicantEmployee->id)
            ->where('is_short_leave', true)
            ->firstOrFail();

        $this->assertEquals(0.00, $req->days_count);
        $this->assertEquals(90, $req->short_leave_duration_minutes);
        $this->assertEquals(LeaveRequest::STAGE_PENDING_HOD, $req->approval_stage);

        // Entitlement was NOT deducted
        $entitlement = LeaveEntitlement::where('employee_id', $this->applicantEmployee->id)
            ->where('leave_type_id', $this->casualType->id)
            ->firstOrFail();
        $this->assertEquals(0.00, $entitlement->pending_days);
        $this->assertEquals(7.00, $entitlement->remaining_days);
    }

    public function test_short_leave_exceeding_two_hours_is_rejected(): void
    {
        $response = $this->actingAs($this->hrManager)
            ->withHeaders(['X-Tenant-ID' => $this->tenant->id])
            ->post('/leave/requests', [
                'employee_id' => $this->applicantEmployee->id,
                'leave_type_id' => $this->casualType->id,
                'start_date' => '2026-10-15',
                'end_date' => '2026-10-15',
                'is_short_leave' => true,
                'short_leave_from' => '08:00',
                'short_leave_to' => '11:00', // 180 minutes > 120 minutes
                'reason' => 'Extended personal errand',
            ]);

        $response->assertSessionHasErrors(['short_leave_to']);
    }

    public function test_monthly_short_leave_quota_enforces_maximum_two_instances(): void
    {
        // First short leave
        $this->actingAs($this->hrManager)
            ->withHeaders(['X-Tenant-ID' => $this->tenant->id])
            ->post('/leave/requests', [
                'employee_id' => $this->applicantEmployee->id,
                'leave_type_id' => $this->casualType->id,
                'start_date' => '2026-10-05',
                'end_date' => '2026-10-05',
                'is_short_leave' => true,
                'short_leave_from' => '08:30',
                'short_leave_to' => '10:00',
                'reason' => 'First errand',
            ])->assertSessionHas('success');

        // Second short leave
        $this->actingAs($this->hrManager)
            ->withHeaders(['X-Tenant-ID' => $this->tenant->id])
            ->post('/leave/requests', [
                'employee_id' => $this->applicantEmployee->id,
                'leave_type_id' => $this->casualType->id,
                'start_date' => '2026-10-12',
                'end_date' => '2026-10-12',
                'is_short_leave' => true,
                'short_leave_from' => '15:30',
                'short_leave_to' => '17:00',
                'reason' => 'Second errand',
            ])->assertSessionHas('success');

        // Third short leave in October must fail quota
        $response = $this->actingAs($this->hrManager)
            ->withHeaders(['X-Tenant-ID' => $this->tenant->id])
            ->post('/leave/requests', [
                'employee_id' => $this->applicantEmployee->id,
                'leave_type_id' => $this->casualType->id,
                'start_date' => '2026-10-20',
                'end_date' => '2026-10-20',
                'is_short_leave' => true,
                'short_leave_from' => '08:30',
                'short_leave_to' => '10:00',
                'reason' => 'Third errand should be blocked',
            ]);

        $response->assertSessionHasErrors(['is_short_leave']);
    }

    public function test_shift_coverage_validation_prevents_conflicted_covering_staff(): void
    {
        // 1. Covering colleague cannot be self
        $response = $this->actingAs($this->hrManager)
            ->withHeaders(['X-Tenant-ID' => $this->tenant->id])
            ->post('/leave/requests', [
                'employee_id' => $this->applicantEmployee->id,
                'covering_employee_id' => $this->applicantEmployee->id,
                'leave_type_id' => $this->casualType->id,
                'start_date' => '2026-10-15',
                'end_date' => '2026-10-16',
                'reason' => 'Personal work',
            ]);
        $response->assertSessionHasErrors(['covering_employee_id']);

        // 2. Put covering colleague on leave
        LeaveRequest::create([
            'tenant_id' => $this->tenant->id,
            'employee_id' => $this->coveringColleague->id,
            'leave_type_id' => $this->casualType->id,
            'start_date' => '2026-10-15',
            'end_date' => '2026-10-16',
            'days_count' => 2.0,
            'reason' => 'Already away',
            'status' => 'approved',
            'approval_stage' => 'approved',
        ]);

        $response2 = $this->actingAs($this->hrManager)
            ->withHeaders(['X-Tenant-ID' => $this->tenant->id])
            ->post('/leave/requests', [
                'employee_id' => $this->applicantEmployee->id,
                'covering_employee_id' => $this->coveringColleague->id,
                'leave_type_id' => $this->casualType->id,
                'start_date' => '2026-10-15',
                'end_date' => '2026-10-16',
                'reason' => 'Personal work',
            ]);
        $response2->assertSessionHasErrors(['covering_employee_id']);
    }

    public function test_two_tier_approval_lifecycle_and_hr_bypass(): void
    {
        // Apply for regular leave
        $this->actingAs($this->hrManager)
            ->withHeaders(['X-Tenant-ID' => $this->tenant->id])
            ->post('/leave/requests', [
                'employee_id' => $this->applicantEmployee->id,
                'covering_employee_id' => $this->coveringColleague->id,
                'leave_type_id' => $this->casualType->id,
                'start_date' => '2026-10-21',
                'end_date' => '2026-10-22',
                'reason' => 'Family vacation',
            ])->assertSessionHas('success');

        $req = LeaveRequest::where('employee_id', $this->applicantEmployee->id)
            ->where('start_date', '2026-10-21')
            ->firstOrFail();

        $this->assertEquals(LeaveRequest::STAGE_PENDING_HOD, $req->approval_stage);
        $this->assertEquals('pending', $req->status);

        // HOD approves (recommends)
        $this->actingAs($this->hodUser)
            ->withHeaders(['X-Tenant-ID' => $this->tenant->id])
            ->post("/leave/requests/{$req->id}/hod-action", [
                'decision' => 'approve',
                'remarks' => 'Shift covered by Suresh. Recommended.',
            ])->assertSessionHas('success');

        $req->refresh();
        $this->assertEquals(LeaveRequest::STAGE_PENDING_HR, $req->approval_stage);
        $this->assertEquals($this->hodUser->id, $req->hod_id);
        $this->assertEquals('Shift covered by Suresh. Recommended.', $req->hod_remarks);

        // HR approves final
        $this->actingAs($this->hrManager)
            ->withHeaders(['X-Tenant-ID' => $this->tenant->id])
            ->post("/leave/requests/{$req->id}/approve")
            ->assertSessionHas('success');

        $req->refresh();
        $this->assertEquals(LeaveRequest::STAGE_APPROVED, $req->approval_stage);
        $this->assertEquals('approved', $req->status);
        $this->assertFalse($req->is_bypassed_by_hr);
    }

    public function test_hr_can_directly_bypass_pending_hod_stage(): void
    {
        // Apply for leave (enters pending_hod)
        $this->actingAs($this->hrManager)
            ->withHeaders(['X-Tenant-ID' => $this->tenant->id])
            ->post('/leave/requests', [
                'employee_id' => $this->applicantEmployee->id,
                'leave_type_id' => $this->casualType->id,
                'start_date' => '2026-10-28',
                'end_date' => '2026-10-28',
                'reason' => 'Emergency leave',
            ])->assertSessionHas('success');

        $req = LeaveRequest::where('employee_id', $this->applicantEmployee->id)
            ->where('start_date', '2026-10-28')
            ->firstOrFail();

        $this->assertEquals(LeaveRequest::STAGE_PENDING_HOD, $req->approval_stage);

        // HR bypasses HOD and approves directly
        $this->actingAs($this->hrManager)
            ->withHeaders(['X-Tenant-ID' => $this->tenant->id])
            ->post("/leave/requests/{$req->id}/approve", [
                'direct_bypass' => true,
            ])->assertSessionHas('success');

        $req->refresh();
        $this->assertEquals(LeaveRequest::STAGE_APPROVED, $req->approval_stage);
        $this->assertEquals('approved', $req->status);
        $this->assertTrue($req->is_bypassed_by_hr);
    }

    public function test_compensatory_off_crediting_tracking_and_redemption(): void
    {
        // 1. Credit 2.0 days of C-Off for working on a holiday
        $this->actingAs($this->hrManager)
            ->withHeaders(['X-Tenant-ID' => $this->tenant->id])
            ->post('/leave/compensatory/credit', [
                'employee_id' => $this->applicantEmployee->id,
                'earned_date' => '2026-10-01',
                'earned_days' => 2.0,
                'reason' => 'Worked on National Poya Day duty',
            ])->assertSessionHas('success');

        $cRecord = CompensatoryLeaveRecord::where('employee_id', $this->applicantEmployee->id)->firstOrFail();
        $this->assertEquals(2.0, $cRecord->earned_days);
        $this->assertEquals(2.0, $cRecord->remaining_days);
        $this->assertEquals('2026-12-30', $cRecord->expires_at->toDateString()); // 90 days

        // 2. Request 1.0 day of Compensatory Off
        $this->actingAs($this->hrManager)
            ->withHeaders(['X-Tenant-ID' => $this->tenant->id])
            ->post('/leave/requests', [
                'employee_id' => $this->applicantEmployee->id,
                'leave_type_id' => $this->compensatoryType->id,
                'start_date' => '2026-10-14',
                'end_date' => '2026-10-14',
                'reason' => 'Redeeming C-Off day',
            ])->assertSessionHas('success');

        $req = LeaveRequest::where('employee_id', $this->applicantEmployee->id)
            ->where('leave_type_id', $this->compensatoryType->id)
            ->firstOrFail();

        // 3. Approve C-Off
        $this->actingAs($this->hrManager)
            ->withHeaders(['X-Tenant-ID' => $this->tenant->id])
            ->post("/leave/requests/{$req->id}/approve", [
                'direct_bypass' => true,
            ])->assertSessionHas('success');

        $cRecord->refresh();
        $this->assertEquals(1.0, $cRecord->used_days);
        $this->assertEquals(1.0, $cRecord->remaining_days);
        $this->assertEquals(CompensatoryLeaveRecord::STATUS_AVAILABLE, $cRecord->status);
    }

    public function test_attendance_period_lock_prevents_leave_submission(): void
    {
        // Freeze and lock HR period for October
        AttendancePeriodLock::create([
            'tenant_id' => $this->tenant->id,
            'year' => 2026,
            'month' => 10,
            'period_start' => '2026-10-01',
            'period_end' => '2026-10-31',
            'status' => AttendancePeriodLock::STATUS_HR_LOCKED,
            'hr_locked_by' => $this->hrManager->id,
            'hr_locked_at' => now(),
        ]);

        $response = $this->actingAs($this->hrManager)
            ->withHeaders(['X-Tenant-ID' => $this->tenant->id])
            ->post('/leave/requests', [
                'employee_id' => $this->applicantEmployee->id,
                'leave_type_id' => $this->casualType->id,
                'start_date' => '2026-10-15',
                'end_date' => '2026-10-15',
                'reason' => 'Late application after payroll lock',
            ]);

        $response->assertSessionHasErrors(['start_date']);
    }
}
