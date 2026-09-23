<?php

declare(strict_types=1);

namespace Tests\Feature\M02;

use App\Models\Department;
use App\Models\Employee;
use App\Models\Roster;
use App\Models\RosterEntry;
use App\Models\RosterGroup;
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
            'code' => 'MORN',
            'start_time' => '06:00:00',
            'end_time' => '14:00:00',
            'color' => '#3b82f6',
        ]);

        $this->nightShift = Shift::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Night Shift',
            'code' => 'NIGHT',
            'start_time' => '22:00:00',
            'end_time' => '06:00:00',
            'is_night_shift' => true,
            'color' => '#ec4899',
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

    public function test_squad_enrollment_and_exclusivity_prevents_double_booking(): void
    {
        $rosterService = app(RosterService::class);

        // Roster 1: Plant Operations (Oct 1 - Oct 31)
        $roster1 = $rosterService->createRoster([
            'name' => 'October 2026 - Operations',
            'department_id' => $this->dept->id,
            'start_date' => '2026-10-01',
            'end_date' => '2026-10-31',
            'status' => 'published',
        ]);

        $squad1 = $rosterService->createSquad($roster1, [
            'name' => 'Squad A - Morning',
            'code' => 'SQD-A',
        ]);

        // Enroll emp1 into Squad 1
        $enrolled = $rosterService->enrollEmployees($squad1, [$this->emp1->id]);
        $this->assertContains($this->emp1->id, $enrolled);

        // Roster 2: Security (Overlapping Oct 1 - Oct 31)
        $roster2 = $rosterService->createRoster([
            'name' => 'October 2026 - Security',
            'start_date' => '2026-10-01',
            'end_date' => '2026-10-31',
            'status' => 'draft',
        ]);

        $squad2 = $rosterService->createSquad($roster2, [
            'name' => 'Security Squad Alpha',
            'code' => 'SEC-ALPHA',
        ]);

        // Attempting to enroll emp1 into Roster 2 must fail due to exclusivity!
        $this->expectException(DomainException::class);
        $rosterService->enrollEmployees($squad2, [$this->emp1->id]);
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
        $initialEntry = RosterEntry::create([
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
                'mon' => ['shift_id' => $this->morningShift->id, 'is_rest_day' => false],
                'tue' => ['shift_id' => $this->morningShift->id, 'is_rest_day' => false],
                'wed' => ['shift_id' => $this->morningShift->id, 'is_rest_day' => false],
                'thu' => ['shift_id' => $this->morningShift->id, 'is_rest_day' => false],
                'fri' => ['shift_id' => $this->morningShift->id, 'is_rest_day' => false],
                'sat' => ['shift_id' => null, 'is_rest_day' => true],
                'sun' => ['shift_id' => null, 'is_rest_day' => true],
            ],
            'is_active' => true,
        ]);

        $response = $this->post(route('roster.rosters.store'), [
            'name' => 'November 2026 Direct Plan',
            'code' => 'RST-2026-11-DIR',
            'department_id' => $this->dept->id,
            'start_date' => '2026-11-01',
            'end_date' => '2026-11-30',
            'generation_mode' => 'direct_pattern',
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

    public function test_can_create_squad_with_direct_enrollment_and_sync(): void
    {
        $this->actingAs($this->admin);

        $roster = Roster::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'December 2026 Ops',
            'code' => 'RST-2026-12-OPS',
            'start_date' => '2026-12-01',
            'end_date' => '2026-12-31',
            'status' => 'draft',
        ]);

        $pattern = RosterPattern::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Morning All Days',
            'code' => 'MORN-ALL',
            'pattern_type' => 'daily',
            'cycle_length_days' => 1,
            'pattern_data' => [
                'shift_id' => $this->morningShift->id,
                'rest_days' => ['sun'],
            ],
            'is_active' => true,
        ]);

        $response = $this->post(route('roster.squads.store', $roster), [
            'name' => 'Alpha Team',
            'code' => 'SQD-ALPHA',
            'color' => '#10b981',
            'roster_pattern_id' => $pattern->id,
            'employee_ids' => [$this->emp1->id],
        ]);

        $response->assertRedirect();

        $squad = RosterGroup::where('roster_id', $roster->id)->first();
        $this->assertNotNull($squad);
        $this->assertEquals('Alpha Team', $squad->name);

        // Verify member is enrolled
        $this->assertDatabaseHas('roster_group_members', [
            'roster_group_id' => $squad->id,
            'employee_id' => $this->emp1->id,
        ]);

        // Verify roster entries were generated
        $entriesCount = RosterEntry::where('roster_group_id', $squad->id)->count();
        $this->assertEquals(31, $entriesCount); // 31 days in December
    }

    public function test_can_create_roster_with_auto_stagger_squads_and_member_enrollments(): void
    {
        $this->actingAs($this->admin);

        // 8-day cyclical pattern: 2 Morn, 2 Night, 4 Off
        $cyclicalPattern = RosterPattern::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Continuous 8-Day Master',
            'code' => 'CONT-8D',
            'pattern_type' => 'cyclical',
            'cycle_length_days' => 8,
            'pattern_data' => [
                'steps' => [
                    ['step' => 1, 'shift_id' => $this->morningShift->id, 'is_rest_day' => false],
                    ['step' => 2, 'shift_id' => $this->morningShift->id, 'is_rest_day' => false],
                    ['step' => 3, 'shift_id' => $this->nightShift->id, 'is_rest_day' => false],
                    ['step' => 4, 'shift_id' => $this->nightShift->id, 'is_rest_day' => false],
                    ['step' => 5, 'shift_id' => null, 'is_rest_day' => true],
                    ['step' => 6, 'shift_id' => null, 'is_rest_day' => true],
                    ['step' => 7, 'shift_id' => null, 'is_rest_day' => true],
                    ['step' => 8, 'shift_id' => null, 'is_rest_day' => true],
                ],
            ],
            'is_active' => true,
        ]);

        $response = $this->post(route('roster.rosters.store'), [
            'name' => 'January 2027 24/7 Operations',
            'code' => 'RST-2027-01-247',
            'department_id' => $this->dept->id,
            'start_date' => '2027-01-01',
            'end_date' => '2027-01-31',
            'status' => 'published',
            'generation_mode' => 'auto_stagger_squads',
            'base_pattern_id' => $cyclicalPattern->id,
            'squad_count' => 4,
            'stagger_days' => 2,
            'squads' => [
                [
                    'name' => 'Squad A',
                    'code' => 'SQD-A',
                    'color' => '#3b82f6',
                    'offset_days' => 0,
                    'employee_ids' => [$this->emp1->id],
                ],
                [
                    'name' => 'Squad B',
                    'code' => 'SQD-B',
                    'color' => '#8b5cf6',
                    'offset_days' => 2,
                    'employee_ids' => [$this->emp2->id],
                ],
            ],
        ]);

        $response->assertRedirect();

        $roster = Roster::where('code', 'RST-2027-01-247')->first();
        $this->assertNotNull($roster);
        $this->assertEquals('draft', $roster->status);
        $this->assertNull($roster->published_at);

        // Verify 2 squads were created with patterns attached
        $squads = RosterGroup::where('roster_id', $roster->id)->get();
        $this->assertCount(2, $squads);

        // Verify members enrolled in squads
        $this->assertDatabaseHas('roster_group_members', [
            'roster_group_id' => $squads->firstWhere('code', 'SQD-A')->id,
            'employee_id' => $this->emp1->id,
        ]);
        $this->assertDatabaseHas('roster_group_members', [
            'roster_group_id' => $squads->firstWhere('code', 'SQD-B')->id,
            'employee_id' => $this->emp2->id,
        ]);

        // Verify calendar entries generated for January (31 days * 2 employees = 62 entries)
        $entriesCount = RosterEntry::where('roster_id', $roster->id)->count();
        $this->assertEquals(62, $entriesCount);
    }

    public function test_can_create_roster_with_multi_pattern_squads(): void
    {
        $this->actingAs($this->admin);

        $pat1 = RosterPattern::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Pattern 1',
            'code' => 'PAT-1',
            'pattern_type' => 'daily',
            'cycle_length_days' => 1,
            'pattern_data' => ['shift_id' => $this->morningShift->id, 'rest_days' => ['sun']],
            'is_active' => true,
        ]);

        $pat2 = RosterPattern::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Pattern 2',
            'code' => 'PAT-2',
            'pattern_type' => 'daily',
            'cycle_length_days' => 1,
            'pattern_data' => ['shift_id' => $this->nightShift->id, 'rest_days' => ['sun']],
            'is_active' => true,
        ]);

        $response = $this->post(route('roster.rosters.store'), [
            'name' => 'February 2027 Mixed',
            'code' => 'RST-2027-02-MIX',
            'start_date' => '2027-02-01',
            'end_date' => '2027-02-28',
            'status' => 'draft',
            'generation_mode' => 'multi_pattern',
            'squads' => [
                [
                    'name' => 'Morning Crew',
                    'code' => 'CRW-M',
                    'color' => '#3b82f6',
                    'pattern_id' => $pat1->id,
                    'employee_ids' => [$this->emp1->id],
                ],
                [
                    'name' => 'Night Crew',
                    'code' => 'CRW-N',
                    'color' => '#ec4899',
                    'pattern_id' => $pat2->id,
                    'employee_ids' => [$this->emp2->id],
                ],
            ],
        ]);

        $response->assertRedirect();

        $roster = Roster::where('code', 'RST-2027-02-MIX')->first();
        $this->assertNotNull($roster);

        $squads = RosterGroup::where('roster_id', $roster->id)->get();
        $this->assertCount(2, $squads);

        // 28 days in Feb * 2 employees = 56 entries
        $entriesCount = RosterEntry::where('roster_id', $roster->id)->count();
        $this->assertEquals(56, $entriesCount);
    }
}

