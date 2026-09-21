<?php

declare(strict_types=1);

namespace Tests\Feature\M04;

use App\Models\Department;
use App\Models\DepartmentHead;
use App\Models\Employee;
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
}
