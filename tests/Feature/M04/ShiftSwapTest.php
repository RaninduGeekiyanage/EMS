<?php

declare(strict_types=1);

namespace Tests\Feature\M04;

use App\Models\Department;
use App\Models\DepartmentHead;
use App\Models\Employee;
use App\Models\LeaveRequest;
use App\Models\LeaveType;
use App\Models\RosterEntry;
use App\Models\Shift;
use App\Models\ShiftSwapRequest;
use App\Models\Tenant;
use App\Models\User;
use App\Services\RosterService;
use App\Services\ShiftSwapService;
use Carbon\Carbon;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

final class ShiftSwapTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;
    private Department $deptA;
    private Department $deptB;
    private Employee $empA1;
    private Employee $empA2;
    private Employee $empB1;
    private Shift $morningShift;
    private Shift $nightShift;
    private User $admin;
    private User $hodUser;
    private Employee $hodEmp;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);

        $this->tenant = Tenant::create([
            'name' => 'Swap Logistics Ltd',
            'slug' => 'swap-logistics-ltd',
            'is_active' => true,
        ]);

        session(['tenant_id' => $this->tenant->id]);
        app()->instance('current_tenant_id', $this->tenant->id);
        app()->instance('current_tenant', $this->tenant);
        setPermissionsTeamId($this->tenant->id);

        $this->admin = User::factory()->create([
            'tenant_id' => $this->tenant->id,
        ]);
        $this->admin->assignRole('Company Admin');

        $this->deptA = Department::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Logistics Department',
            'code' => 'LOG',
            'is_active' => true,
        ]);

        $this->deptB = Department::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Finance Department',
            'code' => 'FIN',
            'is_active' => true,
        ]);

        $this->morningShift = Shift::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Morning Shift',
            'code' => 'MORN',
            'start_time' => '06:00',
            'end_time' => '14:00',
            'is_active' => true,
        ]);

        $this->nightShift = Shift::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Night Shift',
            'code' => 'NIGHT',
            'start_time' => '22:00',
            'end_time' => '06:00',
            'is_night_shift' => true,
            'is_active' => true,
        ]);

        $this->empA1 = Employee::create([
            'tenant_id' => $this->tenant->id,
            'emp_no' => 'LOG-001',
            'full_name' => 'Rohan Perera',
            'nic' => '199011111111',
            'department_id' => $this->deptA->id,
            'employment_status' => 'active',
            'date_of_joining' => '2025-01-01',
        ]);

        $this->empA2 = Employee::create([
            'tenant_id' => $this->tenant->id,
            'emp_no' => 'LOG-002',
            'full_name' => 'Sunil Silva',
            'nic' => '199022222222',
            'department_id' => $this->deptA->id,
            'employment_status' => 'active',
            'date_of_joining' => '2025-01-01',
        ]);

        $this->empB1 = Employee::create([
            'tenant_id' => $this->tenant->id,
            'emp_no' => 'FIN-001',
            'full_name' => 'Anil Fernando',
            'nic' => '199033333333',
            'department_id' => $this->deptB->id,
            'employment_status' => 'active',
            'date_of_joining' => '2025-01-01',
        ]);

        // Create HOD for Dept A
        $this->hodEmp = Employee::create([
            'tenant_id' => $this->tenant->id,
            'emp_no' => 'HOD-001',
            'full_name' => 'Bandara HOD',
            'nic' => '198011111111',
            'department_id' => $this->deptA->id,
            'employment_status' => 'active',
            'date_of_joining' => '2020-01-01',
        ]);

        DepartmentHead::create([
            'tenant_id' => $this->tenant->id,
            'department_id' => $this->deptA->id,
            'employee_id' => $this->hodEmp->id,
        ]);

        $this->hodEmp->email = 'bandara.hod@logistics.com';
        $this->hodEmp->save();

        $this->hodUser = User::factory()->create([
            'tenant_id' => $this->tenant->id,
            'email' => 'bandara.hod@logistics.com',
        ]);
        $this->hodUser->givePermissionTo('shift_swap.view', 'shift_swap.approve_department');
    }

    public function test_can_propose_shift_swap_within_same_department(): void
    {
        $date = Carbon::parse('2026-10-05');

        // Schedule empA1 on Morning, empA2 on Night
        RosterEntry::create([
            'tenant_id' => $this->tenant->id,
            'employee_id' => $this->empA1->id,
            'roster_date' => $date->toDateString(),
            'shift_id' => $this->morningShift->id,
            'schedule_type' => 'shift',
            'status' => 'published',
        ]);

        RosterEntry::create([
            'tenant_id' => $this->tenant->id,
            'employee_id' => $this->empA2->id,
            'roster_date' => $date->toDateString(),
            'shift_id' => $this->nightShift->id,
            'schedule_type' => 'shift',
            'status' => 'published',
        ]);

        /** @var ShiftSwapService $service */
        $service = app(ShiftSwapService::class);
        $swap = $service->requestSwap([
            'requesting_employee_id' => $this->empA1->id,
            'target_employee_id' => $this->empA2->id,
            'shift_date' => $date->toDateString(),
            'reason' => 'Family event in the morning',
        ], $this->tenant->id);

        $this->assertInstanceOf(ShiftSwapRequest::class, $swap);
        $this->assertEquals('pending', $swap->status);
        $this->assertEquals($this->morningShift->id, $swap->requesting_shift_id);
        $this->assertEquals($this->nightShift->id, $swap->target_shift_id);
    }

    public function test_cannot_propose_shift_swap_across_different_departments(): void
    {
        $this->expectException(ValidationException::class);

        /** @var ShiftSwapService $service */
        $service = app(ShiftSwapService::class);
        $service->requestSwap([
            'requesting_employee_id' => $this->empA1->id,
            'target_employee_id' => $this->empB1->id, // Finance dept
            'shift_date' => '2026-10-05',
        ], $this->tenant->id);
    }

    public function test_department_hod_can_approve_swap_and_mutates_roster(): void
    {
        $date = Carbon::parse('2026-10-05');

        RosterEntry::create([
            'tenant_id' => $this->tenant->id,
            'employee_id' => $this->empA1->id,
            'roster_date' => $date->toDateString(),
            'shift_id' => $this->morningShift->id,
            'schedule_type' => 'shift',
            'status' => 'published',
        ]);

        RosterEntry::create([
            'tenant_id' => $this->tenant->id,
            'employee_id' => $this->empA2->id,
            'roster_date' => $date->toDateString(),
            'shift_id' => $this->nightShift->id,
            'schedule_type' => 'shift',
            'status' => 'published',
        ]);

        /** @var ShiftSwapService $service */
        $service = app(ShiftSwapService::class);
        $swap = $service->requestSwap([
            'requesting_employee_id' => $this->empA1->id,
            'target_employee_id' => $this->empA2->id,
            'shift_date' => $date->toDateString(),
            'reason' => 'Need night shift instead',
        ], $this->tenant->id);

        // HOD approves
        $service->approveSwap($swap, $this->hodUser, $this->tenant->id, 'Approved by HOD');

        $swap->refresh();
        $this->assertEquals('approved', $swap->status);

        // Check that A1 now has Night shift, and A2 has Morning shift
        $updatedA1 = RosterEntry::where('employee_id', $this->empA1->id)->whereDate('roster_date', $date)->first();
        $updatedA2 = RosterEntry::where('employee_id', $this->empA2->id)->whereDate('roster_date', $date)->first();

        $this->assertEquals($this->nightShift->id, $updatedA1->shift_id);
        $this->assertEquals($this->morningShift->id, $updatedA2->shift_id);
    }

    public function test_can_propose_and_approve_shift_swap_for_employees_without_department(): void
    {
        $empNoDept1 = Employee::create([
            'tenant_id' => $this->tenant->id,
            'emp_no' => 'NOD-001',
            'full_name' => 'General Employee 1',
            'nic' => '199511111111',
            'department_id' => null,
            'employment_status' => 'active',
            'date_of_joining' => '2025-01-01',
        ]);

        $empNoDept2 = Employee::create([
            'tenant_id' => $this->tenant->id,
            'emp_no' => 'NOD-002',
            'full_name' => 'General Employee 2',
            'nic' => '199522222222',
            'department_id' => null,
            'employment_status' => 'active',
            'date_of_joining' => '2025-01-01',
        ]);

        $date = Carbon::parse('2026-10-10');

        RosterEntry::create([
            'tenant_id' => $this->tenant->id,
            'employee_id' => $empNoDept1->id,
            'roster_date' => $date->toDateString(),
            'shift_id' => $this->morningShift->id,
            'schedule_type' => 'shift',
            'status' => 'published',
        ]);

        RosterEntry::create([
            'tenant_id' => $this->tenant->id,
            'employee_id' => $empNoDept2->id,
            'roster_date' => $date->toDateString(),
            'shift_id' => $this->nightShift->id,
            'schedule_type' => 'shift',
            'status' => 'published',
        ]);

        /** @var ShiftSwapService $service */
        $service = app(ShiftSwapService::class);
        $swap = $service->requestSwap([
            'requesting_employee_id' => $empNoDept1->id,
            'target_employee_id' => $empNoDept2->id,
            'shift_date' => $date->toDateString(),
            'reason' => 'General pool shift swap',
        ], $this->tenant->id);

        $this->assertInstanceOf(ShiftSwapRequest::class, $swap);
        $this->assertNull($swap->department_id);
        $this->assertEquals('pending', $swap->status);

        // Admin approves
        $service->approveSwap($swap, $this->admin, $this->tenant->id, 'Admin approved for unassigned department');
        $swap->refresh();
        $this->assertEquals('approved', $swap->status);
    }

    public function test_can_propose_and_approve_cross_date_shift_swap(): void
    {
        $dateA = Carbon::parse('2026-10-05');
        $dateB = Carbon::parse('2026-10-10');

        // On Date A (5th): Emp A1 has Morning Shift, Emp A2 is Rest Day
        RosterEntry::create([
            'tenant_id' => $this->tenant->id,
            'employee_id' => $this->empA1->id,
            'roster_date' => $dateA->toDateString(),
            'shift_id' => $this->morningShift->id,
            'schedule_type' => 'shift',
            'status' => 'published',
        ]);
        RosterEntry::create([
            'tenant_id' => $this->tenant->id,
            'employee_id' => $this->empA2->id,
            'roster_date' => $dateA->toDateString(),
            'shift_id' => null,
            'schedule_type' => 'rest_day',
            'status' => 'published',
        ]);

        // On Date B (10th): Emp A1 is Rest Day, Emp A2 has Night Shift
        RosterEntry::create([
            'tenant_id' => $this->tenant->id,
            'employee_id' => $this->empA1->id,
            'roster_date' => $dateB->toDateString(),
            'shift_id' => null,
            'schedule_type' => 'rest_day',
            'status' => 'published',
        ]);
        RosterEntry::create([
            'tenant_id' => $this->tenant->id,
            'employee_id' => $this->empA2->id,
            'roster_date' => $dateB->toDateString(),
            'shift_id' => $this->nightShift->id,
            'schedule_type' => 'shift',
            'status' => 'published',
        ]);

        /** @var ShiftSwapService $service */
        $service = app(ShiftSwapService::class);
        $swap = $service->requestSwap([
            'requesting_employee_id' => $this->empA1->id,
            'target_employee_id' => $this->empA2->id,
            'shift_date' => $dateA->toDateString(),
            'target_date' => $dateB->toDateString(),
            'swap_type' => 'cross_day',
            'reason' => 'Cross-date exchange: 5th morning for 10th night',
        ], $this->tenant->id);

        $this->assertEquals('cross_day', $swap->swap_type);
        $this->assertEquals($dateB->toDateString(), $swap->target_date->toDateString());
        $this->assertEquals('pending', $swap->status);

        // HOD approves
        $service->approveSwap($swap, $this->hodUser, $this->tenant->id, 'Cross-date trade approved');
        $swap->refresh();
        $this->assertEquals('approved', $swap->status);

        // Verify Date A: Emp A1 now has Rest Day, Emp A2 now has Morning Shift
        $entryA1DateA = RosterEntry::where('employee_id', $this->empA1->id)->whereDate('roster_date', $dateA)->first();
        $entryA2DateA = RosterEntry::where('employee_id', $this->empA2->id)->whereDate('roster_date', $dateA)->first();
        $this->assertEquals('rest_day', $entryA1DateA->schedule_type);
        $this->assertNull($entryA1DateA->shift_id);
        $this->assertEquals('shift', $entryA2DateA->schedule_type);
        $this->assertEquals($this->morningShift->id, $entryA2DateA->shift_id);

        // Verify Date B: Emp A1 now has Night Shift, Emp A2 now has Rest Day
        $entryA1DateB = RosterEntry::where('employee_id', $this->empA1->id)->whereDate('roster_date', $dateB)->first();
        $entryA2DateB = RosterEntry::where('employee_id', $this->empA2->id)->whereDate('roster_date', $dateB)->first();
        $this->assertEquals('shift', $entryA1DateB->schedule_type);
        $this->assertEquals($this->nightShift->id, $entryA1DateB->shift_id);
        $this->assertEquals('rest_day', $entryA2DateB->schedule_type);
        $this->assertNull($entryA2DateB->shift_id);
    }

    public function test_cannot_swap_into_pre_approved_leave(): void
    {
        $date = Carbon::parse('2026-10-15');

        $leaveType = LeaveType::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Annual Leave',
            'code' => 'ANN',
            'days_per_year' => 14,
            'is_paid' => true,
            'is_active' => true,
        ]);

        LeaveRequest::create([
            'tenant_id' => $this->tenant->id,
            'employee_id' => $this->empA2->id,
            'leave_type_id' => $leaveType->id,
            'start_date' => $date->toDateString(),
            'end_date' => $date->toDateString(),
            'days_count' => 1.0,
            'reason' => 'Annual vacation',
            'status' => 'approved',
        ]);

        RosterEntry::create([
            'tenant_id' => $this->tenant->id,
            'employee_id' => $this->empA1->id,
            'roster_date' => $date->toDateString(),
            'shift_id' => $this->morningShift->id,
            'schedule_type' => 'shift',
            'status' => 'published',
        ]);

        $this->expectException(ValidationException::class);

        /** @var ShiftSwapService $service */
        $service = app(ShiftSwapService::class);
        $service->requestSwap([
            'requesting_employee_id' => $this->empA1->id,
            'target_employee_id' => $this->empA2->id,
            'shift_date' => $date->toDateString(),
            'swap_type' => 'same_day',
        ], $this->tenant->id);
    }

    public function test_cannot_propose_identical_shifts_on_same_date(): void
    {
        $date = Carbon::parse('2026-10-18');

        RosterEntry::create([
            'tenant_id' => $this->tenant->id,
            'employee_id' => $this->empA1->id,
            'roster_date' => $date->toDateString(),
            'shift_id' => $this->morningShift->id,
            'schedule_type' => 'shift',
            'status' => 'published',
        ]);

        RosterEntry::create([
            'tenant_id' => $this->tenant->id,
            'employee_id' => $this->empA2->id,
            'roster_date' => $date->toDateString(),
            'shift_id' => $this->morningShift->id,
            'schedule_type' => 'shift',
            'status' => 'published',
        ]);

        $this->expectException(ValidationException::class);

        /** @var ShiftSwapService $service */
        $service = app(ShiftSwapService::class);
        $service->requestSwap([
            'requesting_employee_id' => $this->empA1->id,
            'target_employee_id' => $this->empA2->id,
            'shift_date' => $date->toDateString(),
            'swap_type' => 'same_day',
        ], $this->tenant->id);
    }

    public function test_manager_direct_auto_approve_executes_immediately(): void
    {
        $date = Carbon::parse('2026-10-20');

        RosterEntry::create([
            'tenant_id' => $this->tenant->id,
            'employee_id' => $this->empA1->id,
            'roster_date' => $date->toDateString(),
            'shift_id' => $this->morningShift->id,
            'schedule_type' => 'shift',
            'status' => 'published',
        ]);

        RosterEntry::create([
            'tenant_id' => $this->tenant->id,
            'employee_id' => $this->empA2->id,
            'roster_date' => $date->toDateString(),
            'shift_id' => $this->nightShift->id,
            'schedule_type' => 'shift',
            'status' => 'published',
        ]);

        /** @var ShiftSwapService $service */
        $service = app(ShiftSwapService::class);
        $swap = $service->requestSwap([
            'requesting_employee_id' => $this->empA1->id,
            'target_employee_id' => $this->empA2->id,
            'shift_date' => $date->toDateString(),
            'swap_type' => 'same_day',
            'auto_approve' => true,
        ], $this->tenant->id, $this->admin);

        $this->assertEquals('approved', $swap->status);
        $this->assertEquals('accepted', $swap->target_status);
        $this->assertEquals($this->admin->id, $swap->approved_by);

        // Verify roster was mutated immediately
        $entryA1 = RosterEntry::where('employee_id', $this->empA1->id)->whereDate('roster_date', $date)->first();
        $this->assertEquals($this->nightShift->id, $entryA1->shift_id);
    }

    public function test_preview_endpoint_returns_accurate_schedule_differences(): void
    {
        $dateA = Carbon::parse('2026-10-25');
        $dateB = Carbon::parse('2026-10-28');

        RosterEntry::create([
            'tenant_id' => $this->tenant->id,
            'employee_id' => $this->empA1->id,
            'roster_date' => $dateA->toDateString(),
            'shift_id' => $this->morningShift->id,
            'schedule_type' => 'shift',
            'status' => 'published',
        ]);

        RosterEntry::create([
            'tenant_id' => $this->tenant->id,
            'employee_id' => $this->empA2->id,
            'roster_date' => $dateA->toDateString(),
            'shift_id' => null,
            'schedule_type' => 'rest_day',
            'status' => 'published',
        ]);

        $response = $this->actingAs($this->admin)->postJson('/roster/shift-swaps/preview', [
            'requesting_employee_id' => $this->empA1->id,
            'target_employee_id' => $this->empA2->id,
            'shift_date' => $dateA->toDateString(),
            'target_date' => $dateB->toDateString(),
            'swap_type' => 'cross_day',
        ]);

        $response->assertOk();
        $data = $response->json();

        $this->assertTrue($data['can_swap']);
        $this->assertEquals('cross_day', $data['swap_type']);
        $this->assertArrayHasKey('date_a', $data);
        $this->assertArrayHasKey('date_b', $data);
        $this->assertEquals($this->morningShift->name, $data['date_a']['requesting']['current']['shift']['name']);
        $this->assertEquals('rest_day', $data['date_a']['target']['current']['schedule_type']);
    }
}

