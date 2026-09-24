<?php

declare(strict_types=1);

namespace Tests\Feature\M02;

use App\Models\Department;
use App\Models\Employee;
use App\Models\Roster;
use App\Models\RosterEntry;
use App\Models\RosterPattern;
use App\Models\Shift;
use App\Models\Tenant;
use App\Models\User;
use App\Services\RosterService;
use App\Services\ShiftService;
use Carbon\Carbon;
use DomainException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

final class EnterpriseRosterTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;
    private User $admin;
    private Department $dept;
    private Employee $emp1;
    private Employee $emp2;
    private Shift $morningShift;
    private Shift $nightShift;

    protected function setUp(): void
    {
        parent::setUp();

        $this->tenant = Tenant::create([
            'name' => 'Acme Industrial',
            'slug' => 'acme-ind',
            'is_ams_enabled' => true,
        ]);

        $this->admin = User::factory()->create([
            'tenant_id' => $this->tenant->id,
            'is_super_admin' => true,
        ]);

        session(['tenant_id' => $this->tenant->id]);
        app()->instance('current_tenant', $this->tenant);
        app()->instance('current_tenant_id', $this->tenant->id);

        $this->dept = Department::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Plant Operations',
            'code' => 'PLANT',
        ]);

        $this->emp1 = Employee::create([
            'tenant_id' => $this->tenant->id,
            'department_id' => $this->dept->id,
            'emp_no' => 'EMP-001',
            'nic' => '198810203040',
            'full_name' => 'Alice Operator',
            'employment_type' => 'permanent',
            'employment_status' => 'active',
        ]);

        $this->emp2 = Employee::create([
            'tenant_id' => $this->tenant->id,
            'department_id' => $this->dept->id,
            'emp_no' => 'EMP-002',
            'nic' => '199020304050',
            'full_name' => 'Bob Technician',
            'employment_type' => 'permanent',
            'employment_status' => 'active',
        ]);

        $this->morningShift = Shift::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Morning Shift',
            'code' => 'MS',
            'start_time' => '06:00:00',
            'end_time' => '14:00:00',
            'break_minutes' => 45,
            'is_active' => true,
        ]);

        $this->nightShift = Shift::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Night Shift',
            'code' => 'NS',
            'start_time' => '22:00:00',
            'end_time' => '06:00:00',
            'break_minutes' => 45,
            'is_night_shift' => true,
            'is_active' => true,
        ]);
    }

    public function test_can_create_named_roster_header_and_publish(): void
    {
        $rosterService = app(RosterService::class);

        $roster = $rosterService->createRoster([
            'name' => 'October 2026 - Operations',
            'department_id' => $this->dept->id,
            'start_date' => '2026-10-01',
            'end_date' => '2026-10-31',
            'status' => 'draft',
        ]);

        $this->assertDatabaseHas('rosters', [
            'id' => $roster->id,
            'name' => 'October 2026 - Operations',
            'status' => 'draft',
        ]);

        // Publish roster
        $rosterService->publishNamedRoster($roster, true);

        $this->assertDatabaseHas('rosters', [
            'id' => $roster->id,
            'status' => 'published',
        ]);
    }

    public function test_operational_override_preserves_original_shift_and_logs_audit_reason(): void
    {
        $rosterService = app(RosterService::class);

        $roster = $rosterService->createRoster([
            'name' => 'October 2026 - Operations',
            'start_date' => '2026-10-01',
            'end_date' => '2026-10-31',
            'status' => 'published',
        ]);

        // Create base planned shift for emp1 on 2026-10-15
        RosterEntry::create([
            'tenant_id' => $this->tenant->id,
            'roster_id' => $roster->id,
            'employee_id' => $this->emp1->id,
            'roster_date' => '2026-10-15',
            'shift_id' => $this->morningShift->id,
            'schedule_type' => 'shift',
            'status' => 'published',
            'is_overridden' => false,
        ]);

        // Supervisor overrides to Night Shift with reason 'Sick Cover'
        $this->actingAs($this->admin);
        $updated = $rosterService->updateEntry(
            $this->emp1->id,
            '2026-10-15',
            $this->nightShift->id,
            'shift',
            'Covering for Bob',
            'published',
            'Sick Cover'
        );

        $this->assertTrue($updated->is_overridden);
        $this->assertEquals($this->morningShift->id, $updated->original_shift_id);
        $this->assertEquals($this->nightShift->id, $updated->shift_id);
        $this->assertEquals('Sick Cover', $updated->override_reason);
    }

    public function test_shift_delete_guard_prevents_deleting_actively_referenced_shifts(): void
    {
        $shiftService = app(ShiftService::class);

        // Schedule emp1 on morningShift
        RosterEntry::create([
            'tenant_id' => $this->tenant->id,
            'employee_id' => $this->emp1->id,
            'roster_date' => '2026-10-20',
            'shift_id' => $this->morningShift->id,
            'schedule_type' => 'shift',
            'status' => 'published',
        ]);

        // Trying to delete morningShift should be blocked
        $this->assertFalse($this->morningShift->canBeDeleted());

        $this->expectException(DomainException::class);
        $shiftService->deleteShift($this->morningShift);
    }

    public function test_can_create_named_roster_with_immediate_direct_pattern_and_employees(): void
    {
        $this->actingAs($this->admin);

        // Create weekly pattern
        $pattern = RosterPattern::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'General Mon-Fri',
            'code' => 'GEN-5D',
            'pattern_type' => 'weekly',
            'cycle_length_days' => 7,
            'pattern_data' => [
                ['day' => 0, 'shift_id' => $this->morningShift->id, 'is_rest_day' => false],
                ['day' => 1, 'shift_id' => $this->morningShift->id, 'is_rest_day' => false],
                ['day' => 2, 'shift_id' => $this->morningShift->id, 'is_rest_day' => false],
                ['day' => 3, 'shift_id' => $this->morningShift->id, 'is_rest_day' => false],
                ['day' => 4, 'shift_id' => $this->morningShift->id, 'is_rest_day' => false],
                ['day' => 5, 'shift_id' => null, 'is_rest_day' => true],
                ['day' => 6, 'shift_id' => null, 'is_rest_day' => true],
            ],
            'is_active' => true,
        ]);

        $response = $this->post(route('roster.rosters.store'), [
            'name' => 'November 2026 Direct Plan',
            'code' => 'RST-2026-11-DIR',
            'department_id' => $this->dept->id,
            'start_date' => '2026-11-01',
            'end_date' => '2026-11-30',
            'pattern_id' => $pattern->id,
            'employee_ids' => [$this->emp1->id, $this->emp2->id],
        ]);

        $response->assertRedirect();

        $roster = Roster::where('code', 'RST-2026-11-DIR')->first();
        $this->assertNotNull($roster);

        // Verify that entries were generated for both employees and tagged with roster_id
        $entriesCount = RosterEntry::where('roster_id', $roster->id)->count();
        $this->assertEquals(60, $entriesCount); // 30 days * 2 employees
    }

    public function test_roster_creation_prevents_overlapping_active_roster_assignments_for_same_employee(): void
    {
        $this->actingAs($this->admin);

        $pat = RosterPattern::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'General Pattern 2',
            'code' => 'PAT-GEN2',
            'pattern_type' => 'daily',
            'cycle_length_days' => 1,
            'pattern_data' => ['shift_id' => $this->morningShift->id, 'rest_days' => [7]],
            'is_active' => true,
        ]);

        // 1. Create first roster for April 01 - 30 with emp1
        $r1 = $this->post(route('roster.rosters.store'), [
            'name' => 'April 2027 Primary Roster',
            'code' => 'RST-2027-04-PRI',
            'start_date' => '2027-04-01',
            'end_date' => '2027-04-30',
            'status' => 'draft',
            'pattern_id' => $pat->id,
            'employee_ids' => [$this->emp1->id],
        ]);
        $r1->assertRedirect();

        // 2. Try creating a second overlapping roster (April 15 - May 15) with emp1
        $r2 = $this->from('/roster')->post(route('roster.rosters.store'), [
            'name' => 'April-May 2027 Overlapping Roster',
            'code' => 'RST-2027-04-OVER',
            'start_date' => '2027-04-15',
            'end_date' => '2027-05-15',
            'status' => 'draft',
            'pattern_id' => $pat->id,
            'employee_ids' => [$this->emp1->id],
        ]);

        $r2->assertSessionHas('error');
        $this->assertDatabaseMissing('rosters', ['code' => 'RST-2027-04-OVER']);
    }

    public function test_cannot_delete_published_roster(): void
    {
        $rosterService = app(RosterService::class);

        $roster = $rosterService->createRoster([
            'name' => 'May 2027 Operations',
            'start_date' => '2027-05-01',
            'end_date' => '2027-05-31',
            'status' => 'draft',
        ]);

        $rosterService->publishNamedRoster($roster, true);

        $this->expectException(DomainException::class);
        $rosterService->deleteRoster($roster);
    }

    public function test_unselected_roster_returns_empty_matrix(): void
    {
        $this->actingAs($this->admin);

        $response = $this->get('/roster');
        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('Roster/Index')
            ->where('active_roster', null)
            ->where('matrix', [])
        );
    }

    public function test_allocate_and_deallocate_employee_with_effective_dates(): void
    {
        $this->actingAs($this->admin);
        $rosterService = app(RosterService::class);

        $roster = $rosterService->createRoster([
            'name' => 'June 2027 Roster A',
            'start_date' => '2027-06-01',
            'end_date' => '2027-06-30',
            'status' => 'draft',
        ]);

        // Allocate emp1 to roster
        $res = $this->post(route('roster.allocations.store', $roster->id), [
            'employee_ids' => [$this->emp1->id],
            'effective_from' => '2027-06-01',
            'effective_to' => '2027-06-30',
        ]);
        $res->assertRedirect();
        $this->assertDatabaseHas('roster_employee_allocations', [
            'roster_id' => $roster->id,
            'employee_id' => $this->emp1->id,
        ]);

        // Deallocate emp1 starting from June 16
        $res2 = $this->delete(route('roster.allocations.destroy', $roster->id), [
            'employee_id' => $this->emp1->id,
            'effective_removal_date' => '2027-06-16',
        ]);
        $res2->assertRedirect();
        $this->assertDatabaseHas('roster_employee_allocations', [
            'roster_id' => $roster->id,
            'employee_id' => $this->emp1->id,
            'effective_to' => '2027-06-15',
        ]);
    }

    public function test_transfer_employee_between_rosters(): void
    {
        $this->actingAs($this->admin);
        $rosterService = app(RosterService::class);

        $rosterA = $rosterService->createRoster([
            'name' => 'July 2027 Roster A',
            'start_date' => '2027-07-01',
            'end_date' => '2027-07-31',
            'status' => 'draft',
        ]);

        $rosterB = $rosterService->createRoster([
            'name' => 'July 2027 Roster B',
            'start_date' => '2027-07-01',
            'end_date' => '2027-07-31',
            'status' => 'draft',
        ]);

        // Allocate to Roster A
        $rosterService->allocateEmployee($rosterA->id, [$this->emp1->id], '2027-07-01', '2027-07-31');

        // Transfer to Roster B effective July 16
        $res = $this->post(route('roster.transfer', $rosterA->id), [
            'employee_id' => $this->emp1->id,
            'target_roster_id' => $rosterB->id,
            'transfer_date' => '2027-07-16',
        ]);
        $res->assertRedirect();

        // Check allocation A ended on July 15
        $this->assertDatabaseHas('roster_employee_allocations', [
            'roster_id' => $rosterA->id,
            'employee_id' => $this->emp1->id,
            'effective_to' => '2027-07-15',
        ]);

        // Check allocation B starts on July 16
        $this->assertDatabaseHas('roster_employee_allocations', [
            'roster_id' => $rosterB->id,
            'employee_id' => $this->emp1->id,
            'effective_from' => '2027-07-16',
            'effective_to' => '2027-07-31',
        ]);
    }
}
