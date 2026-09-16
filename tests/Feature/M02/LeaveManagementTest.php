<?php

declare(strict_types=1);

namespace Tests\Feature\M02;

use App\Models\AttendanceDaily;
use App\Models\Department;
use App\Models\Employee;
use App\Models\LeaveEntitlement;
use App\Models\LeaveRequest;
use App\Models\LeaveType;
use App\Models\PublicHoliday;
use App\Models\Shift;
use App\Models\Tenant;
use App\Models\User;
use App\Services\AttendanceProcessingService;
use App\Services\LeaveService;
use Carbon\Carbon;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

final class LeaveManagementTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;
    private User $hrManager;
    private Employee $seniorEmployee;
    private Employee $q2Joiner;
    private LeaveService $leaveService;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);

        $this->tenant = Tenant::create([
            'name' => 'Ceylon Heritage Tea Ltd',
            'slug' => 'ceylon-heritage-tea',
            'is_active' => true,
        ]);

        session(['tenant_id' => $this->tenant->id]);
        app()->instance('current_tenant_id', $this->tenant->id);
        app()->instance('current_tenant', $this->tenant);
        if (function_exists('setPermissionsTeamId')) {
            setPermissionsTeamId($this->tenant->id);
        }

        $this->hrManager = User::factory()->create([
            'name' => 'HR Operations Lead',
            'email' => 'hr@ceylonheritage.com',
        ]);
        $this->hrManager->assignRole('HR Manager');

        $department = Department::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Field Estate Division',
        ]);

        // Employee joined in 2024 (prior year => full statutory allocation)
        $this->seniorEmployee = Employee::create([
            'tenant_id' => $this->tenant->id,
            'department_id' => $department->id,
            'emp_no' => 'EMP-001',
            'full_name' => 'Kamal Perera',
            'nic' => '821234567V',
            'date_of_joining' => '2024-01-15',
            'employment_status' => 'active',
        ]);

        // Employee joined mid-year 2026 (May 10 => Q2 joiner under Shop & Office Employees Act)
        $this->q2Joiner = Employee::create([
            'tenant_id' => $this->tenant->id,
            'department_id' => $department->id,
            'emp_no' => 'EMP-002',
            'full_name' => 'Sunil Shantha',
            'nic' => '901234567V',
            'date_of_joining' => '2026-05-10',
            'employment_status' => 'active',
        ]);

        $this->leaveService = app(LeaveService::class);
    }

    public function test_displays_leave_management_portal_and_auto_seeds_statutory_types(): void
    {
        $response = $this->actingAs($this->hrManager)
            ->withHeaders(['X-Tenant-ID' => $this->tenant->id])
            ->get('/leave/requests');

        $response->assertOk();

        // Verify that Sri Lankan statutory types were seeded
        $this->assertDatabaseHas('leave_types', [
            'tenant_id' => $this->tenant->id,
            'code' => 'ANNUAL',
            'days_per_year' => 14.0,
        ]);
        $this->assertDatabaseHas('leave_types', [
            'tenant_id' => $this->tenant->id,
            'code' => 'CASUAL',
            'days_per_year' => 7.0,
        ]);
        $this->assertDatabaseHas('leave_types', [
            'tenant_id' => $this->tenant->id,
            'code' => 'MATERNITY',
            'days_per_year' => 84.0,
        ]);
        $this->assertDatabaseHas('leave_types', [
            'tenant_id' => $this->tenant->id,
            'code' => 'NO_PAY',
            'is_paid' => false,
        ]);
    }

    public function test_statutory_proration_for_mid_year_joiners_under_sri_lankan_act(): void
    {
        $this->leaveService->seedStatutoryTypes($this->tenant->id);
        $annual = LeaveType::where('tenant_id', $this->tenant->id)->where('code', 'ANNUAL')->firstOrFail();
        $casual = LeaveType::where('tenant_id', $this->tenant->id)->where('code', 'CASUAL')->firstOrFail();

        // Senior employee gets full 14 days annual and 7 days casual
        $seniorAnnual = $this->leaveService->calculateProratedEntitlement($this->seniorEmployee, $annual, 2026);
        $seniorCasual = $this->leaveService->calculateProratedEntitlement($this->seniorEmployee, $casual, 2026);
        $this->assertEquals(14.0, $seniorAnnual);
        $this->assertEquals(7.0, $seniorCasual);

        // Q2 Joiner (joined in May) gets 10 days annual under Shop & Office Employees Act
        $q2Annual = $this->leaveService->calculateProratedEntitlement($this->q2Joiner, $annual, 2026);
        $this->assertEquals(10.0, $q2Annual);

        // Casual leave: May joiner has 8 remaining months => 8/2 = 4 days
        $q2Casual = $this->leaveService->calculateProratedEntitlement($this->q2Joiner, $casual, 2026);
        $this->assertEquals(4.0, $q2Casual);
    }

    public function test_can_allocate_annual_entitlements_for_active_employees(): void
    {
        $response = $this->actingAs($this->hrManager)
            ->withHeaders(['X-Tenant-ID' => $this->tenant->id])
            ->post('/leave/entitlements/allocate', [
                'year' => 2026,
            ]);

        $response->assertRedirect();
        $response->assertSessionHas('success');

        $this->assertDatabaseHas('leave_entitlements', [
            'tenant_id' => $this->tenant->id,
            'employee_id' => $this->seniorEmployee->id,
            'year' => 2026,
            'allocated_days' => 14.0,
        ]);

        $this->assertDatabaseHas('leave_entitlements', [
            'tenant_id' => $this->tenant->id,
            'employee_id' => $this->q2Joiner->id,
            'year' => 2026,
            'allocated_days' => 10.0,
        ]);
    }

    public function test_can_submit_leave_request_and_reserve_pending_balance(): void
    {
        $this->leaveService->allocateEntitlements($this->tenant->id, 2026);
        $annual = LeaveType::where('tenant_id', $this->tenant->id)->where('code', 'ANNUAL')->firstOrFail();

        // 2026-06-15 (Monday) to 2026-06-17 (Wednesday) = 3 working days
        $response = $this->actingAs($this->hrManager)
            ->withHeaders(['X-Tenant-ID' => $this->tenant->id])
            ->post('/leave/requests', [
                'employee_id' => $this->seniorEmployee->id,
                'leave_type_id' => $annual->id,
                'start_date' => '2026-06-15',
                'end_date' => '2026-06-17',
                'is_half_day' => false,
                'reason' => 'Annual family pilgrimage to Kataragama',
            ]);

        $response->assertRedirect();
        $response->assertSessionHas('success');

        $this->assertDatabaseHas('leave_requests', [
            'tenant_id' => $this->tenant->id,
            'employee_id' => $this->seniorEmployee->id,
            'days_count' => 3.0,
            'status' => 'pending',
        ]);

        // Verify pending days incremented
        $entitlement = LeaveEntitlement::where('employee_id', $this->seniorEmployee->id)
            ->where('leave_type_id', $annual->id)
            ->where('year', 2026)
            ->firstOrFail();

        $this->assertEquals(3.0, $entitlement->pending_days);
        $this->assertEquals(11.0, $entitlement->remaining_days); // 14 - 3 = 11
    }

    public function test_cannot_submit_leave_request_with_insufficient_balance(): void
    {
        $this->leaveService->allocateEntitlements($this->tenant->id, 2026);
        $casual = LeaveType::where('tenant_id', $this->tenant->id)->where('code', 'CASUAL')->firstOrFail();

        // Senior employee only has 7 days of casual leave. Requesting 10 days should fail.
        $response = $this->actingAs($this->hrManager)
            ->withHeaders(['X-Tenant-ID' => $this->tenant->id])
            ->post('/leave/requests', [
                'employee_id' => $this->seniorEmployee->id,
                'leave_type_id' => $casual->id,
                'start_date' => '2026-07-01',
                'end_date' => '2026-07-14', // 12 working days (excluding Sundays)
                'is_half_day' => false,
                'reason' => 'Exceeding allocation test',
            ]);

        $response->assertSessionHasErrors(['leave_type_id']);
    }

    public function test_cannot_submit_overlapping_leave_requests(): void
    {
        $this->leaveService->allocateEntitlements($this->tenant->id, 2026);
        $annual = LeaveType::where('tenant_id', $this->tenant->id)->where('code', 'ANNUAL')->firstOrFail();

        // 1st request: June 15 to June 17
        $this->leaveService->applyLeave([
            'employee_id' => $this->seniorEmployee->id,
            'leave_type_id' => $annual->id,
            'start_date' => '2026-06-15',
            'end_date' => '2026-06-17',
            'is_half_day' => false,
            'reason' => 'First booking',
        ], $this->tenant->id, $this->hrManager);

        // 2nd request overlapping June 16 to June 18 should fail
        $response = $this->actingAs($this->hrManager)
            ->withHeaders(['X-Tenant-ID' => $this->tenant->id])
            ->post('/leave/requests', [
                'employee_id' => $this->seniorEmployee->id,
                'leave_type_id' => $annual->id,
                'start_date' => '2026-06-16',
                'end_date' => '2026-06-18',
                'is_half_day' => false,
                'reason' => 'Conflicting booking',
            ]);

        $response->assertSessionHasErrors(['start_date']);
    }

    public function test_can_approve_leave_request_and_sync_with_attendance_daily(): void
    {
        $this->leaveService->allocateEntitlements($this->tenant->id, 2026);
        $annual = LeaveType::where('tenant_id', $this->tenant->id)->where('code', 'ANNUAL')->firstOrFail();

        $request = $this->leaveService->applyLeave([
            'employee_id' => $this->seniorEmployee->id,
            'leave_type_id' => $annual->id,
            'start_date' => '2026-08-10', // Monday
            'end_date' => '2026-08-11',   // Tuesday
            'is_half_day' => false,
            'reason' => 'Mid-term break',
        ], $this->tenant->id, $this->hrManager);

        $response = $this->actingAs($this->hrManager)
            ->withHeaders(['X-Tenant-ID' => $this->tenant->id])
            ->post("/leave/requests/{$request->id}/approve");

        $response->assertRedirect();
        $response->assertSessionHas('success');

        // Check request status
        $this->assertDatabaseHas('leave_requests', [
            'id' => $request->id,
            'status' => 'approved',
            'actioned_by' => $this->hrManager->id,
        ]);

        // Check entitlement updated: pending 0, used 2
        $entitlement = LeaveEntitlement::where('employee_id', $this->seniorEmployee->id)
            ->where('leave_type_id', $annual->id)
            ->where('year', 2026)
            ->firstOrFail();

        $this->assertEquals(0.0, $entitlement->pending_days);
        $this->assertEquals(2.0, $entitlement->used_days);
        $this->assertEquals(12.0, $entitlement->remaining_days);

        // Check Attendance Daily ledger synchronized!
        $day1 = AttendanceDaily::where('tenant_id', $this->tenant->id)
            ->where('employee_id', $this->seniorEmployee->id)
            ->whereDate('attendance_date', '2026-08-10')
            ->first();
        $this->assertNotNull($day1);
        $this->assertEquals('leave', $day1->status);
        $this->assertEquals(0.00, (float) $day1->worked_hours);

        $day2 = AttendanceDaily::where('tenant_id', $this->tenant->id)
            ->where('employee_id', $this->seniorEmployee->id)
            ->whereDate('attendance_date', '2026-08-11')
            ->first();
        $this->assertNotNull($day2);
        $this->assertEquals('leave', $day2->status);
        $this->assertEquals(0.00, (float) $day2->worked_hours);
    }

    public function test_can_reject_leave_request_and_restore_pending_balance(): void
    {
        $this->leaveService->allocateEntitlements($this->tenant->id, 2026);
        $casual = LeaveType::where('tenant_id', $this->tenant->id)->where('code', 'CASUAL')->firstOrFail();

        $request = $this->leaveService->applyLeave([
            'employee_id' => $this->seniorEmployee->id,
            'leave_type_id' => $casual->id,
            'start_date' => '2026-09-01',
            'end_date' => '2026-09-01',
            'is_half_day' => false,
            'reason' => 'Personal affair',
        ], $this->tenant->id, $this->hrManager);

        $response = $this->actingAs($this->hrManager)
            ->withHeaders(['X-Tenant-ID' => $this->tenant->id])
            ->post("/leave/requests/{$request->id}/reject", [
                'rejection_reason' => 'Operational peak harvest season - cannot release staff',
            ]);

        $response->assertRedirect();

        $this->assertDatabaseHas('leave_requests', [
            'id' => $request->id,
            'status' => 'rejected',
            'rejection_reason' => 'Operational peak harvest season - cannot release staff',
        ]);

        $entitlement = LeaveEntitlement::where('employee_id', $this->seniorEmployee->id)
            ->where('leave_type_id', $casual->id)
            ->where('year', 2026)
            ->firstOrFail();

        $this->assertEquals(0.0, $entitlement->pending_days);
        $this->assertEquals(0.0, $entitlement->used_days);
        $this->assertEquals(7.0, $entitlement->remaining_days);
    }

    public function test_attendance_processing_marks_approved_leave_and_suppresses_absent(): void
    {
        $this->leaveService->allocateEntitlements($this->tenant->id, 2026);
        $annual = LeaveType::where('tenant_id', $this->tenant->id)->where('code', 'ANNUAL')->firstOrFail();

        // Create approved leave for 2026-10-05 (Monday)
        $request = $this->leaveService->applyLeave([
            'employee_id' => $this->seniorEmployee->id,
            'leave_type_id' => $annual->id,
            'start_date' => '2026-10-05',
            'end_date' => '2026-10-05',
            'is_half_day' => false,
            'reason' => 'Approved vacation',
        ], $this->tenant->id, $this->hrManager);
        $this->leaveService->approveLeave($request, $this->hrManager);

        // Standard shift for employee
        $shift = Shift::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'General Day Shift',
            'code' => 'GEN-DAY',
            'shift_type' => 'regular',
            'start_time' => '08:30:00',
            'end_time' => '17:00:00',
            'break_minutes' => 60,
            'grace_minutes' => 10,
            'ot_threshold_minutes' => 480,
            'is_night_shift' => false,
            'is_active' => true,
        ]);

        // Process attendance for 2026-10-05 where NO punches were recorded
        $processor = app(AttendanceProcessingService::class);
        $result = $processor->processDate(Carbon::parse('2026-10-05'), $this->seniorEmployee->id);

        $this->assertEquals(1, $result['processed']);

        // Check AttendanceDaily record: should be 'leave', NOT 'absent'
        $daily = AttendanceDaily::where('tenant_id', $this->tenant->id)
            ->where('employee_id', $this->seniorEmployee->id)
            ->whereDate('attendance_date', '2026-10-05')
            ->firstOrFail();

        $this->assertEquals('leave', $daily->status);
        $this->assertEquals(0.00, (float) $daily->worked_hours);
        $this->assertEquals('Annual Leave', $daily->calculation_breakdown['leave_type']);
    }
}
