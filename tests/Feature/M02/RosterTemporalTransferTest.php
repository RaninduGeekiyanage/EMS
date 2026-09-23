<?php

declare(strict_types=1);

namespace Tests\Feature\M02;

use App\Models\Department;
use App\Models\Employee;
use App\Models\Roster;
use App\Models\RosterEntry;
use App\Models\RosterGroup;
use App\Models\RosterGroupMember;
use App\Models\RosterPattern;
use App\Models\Shift;
use App\Models\Tenant;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

final class RosterTemporalTransferTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;
    private User $admin;
    private Department $dept;
    private Shift $morningShift;
    private Shift $nightShift;
    private RosterPattern $patternA;
    private RosterPattern $patternB;
    private Employee $emp;

    protected function setUp(): void
    {
        parent::setUp();

        $this->tenant = Tenant::create([
            'name' => 'Tea Estate Test Tenant',
            'code' => 'TEST-' . uniqid(),
            'slug' => 'test-tenant-' . uniqid(),
            'is_active' => true,
        ]);

        $this->admin = User::factory()->create([
            'tenant_id' => $this->tenant->id,
            'is_super_admin' => true,
        ]);

        $this->dept = Department::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Operations Dept',
            'code' => 'OPS',
        ]);

        $this->morningShift = Shift::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Morning Shift',
            'code' => 'MS',
            'start_time' => '06:00:00',
            'end_time' => '14:00:00',
            'is_night_shift' => false,
            'is_active' => true,
        ]);

        $this->nightShift = Shift::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Night Shift',
            'code' => 'NS',
            'start_time' => '22:00:00',
            'end_time' => '06:00:00',
            'is_night_shift' => true,
            'is_active' => true,
        ]);

        $this->patternA = RosterPattern::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Pattern Alpha',
            'code' => 'PAT-A',
            'pattern_type' => 'daily',
            'cycle_length_days' => 1,
            'pattern_data' => [
                'shift_id' => $this->morningShift->id,
                'rest_days' => ['Sunday'],
            ],
            'is_active' => true,
        ]);

        $this->patternB = RosterPattern::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Pattern Beta',
            'code' => 'PAT-B',
            'pattern_type' => 'daily',
            'cycle_length_days' => 1,
            'pattern_data' => [
                'shift_id' => $this->nightShift->id,
                'rest_days' => ['Sunday'],
            ],
            'is_active' => true,
        ]);

        $this->emp = Employee::create([
            'tenant_id' => $this->tenant->id,
            'department_id' => $this->dept->id,
            'emp_no' => 'EMP-TRANSFER-01',
            'full_name' => 'Sumana Perera',
            'nic' => '199012345678',
            'date_of_birth' => '1990-01-01',
            'gender' => 'male',
            'marital_status' => 'single',
            'designation_id' => null,
            'employment_status' => 'active',
            'hire_date' => '2026-09-01',
        ]);
    }

    public function test_new_roster_defaults_to_draft_and_can_be_discarded(): void
    {
        $this->actingAs($this->admin);

        $response = $this->post('/roster/rosters', [
            'name' => 'September 2026 Operations',
            'code' => 'RST-2026-09-TST',
            'department_id' => $this->dept->id,
            'start_date' => '2026-09-01',
            'end_date' => '2026-09-30',
            'generation_mode' => 'blank',
        ]);

        $response->assertRedirect();

        $roster = Roster::where('code', 'RST-2026-09-TST')->first();
        $this->assertNotNull($roster);
        $this->assertEquals('draft', $roster->status);
        $this->assertNull($roster->published_at);

        // Delete (discard) draft roster
        $delResponse = $this->delete("/roster/rosters/{$roster->id}");
        $delResponse->assertRedirect();
        $this->assertDatabaseMissing('rosters', ['id' => $roster->id]);
    }

    public function test_published_roster_cannot_be_deleted_only_archived(): void
    {
        $this->actingAs($this->admin);

        $roster = Roster::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'September Published Roster',
            'code' => 'RST-2026-PUB',
            'department_id' => $this->dept->id,
            'start_date' => '2026-09-01',
            'end_date' => '2026-09-30',
            'status' => 'draft',
        ]);

        // Publish roster
        $pubResponse = $this->post("/roster/rosters/{$roster->id}/publish", ['publish' => true]);
        $pubResponse->assertRedirect();

        $roster->refresh();
        $this->assertEquals('published', $roster->status);
        $this->assertNotNull($roster->published_at);

        // Attempting to delete published roster should be rejected with error
        $delResponse = $this->delete("/roster/rosters/{$roster->id}");
        $delResponse->assertSessionHas('error');
        $this->assertDatabaseHas('rosters', ['id' => $roster->id]);

        // Reverting to draft still protects against permanent deletion
        $this->post("/roster/rosters/{$roster->id}/publish", ['publish' => false]);
        $roster->refresh();
        $this->assertEquals('draft', $roster->status);
        $this->assertNotNull($roster->published_at);

        $delDraftResponse = $this->delete("/roster/rosters/{$roster->id}");
        $delDraftResponse->assertSessionHas('error');
        $this->assertDatabaseHas('rosters', ['id' => $roster->id]);

        // Archiving works cleanly
        $archResponse = $this->post("/roster/rosters/{$roster->id}/archive");
        $archResponse->assertRedirect();
        $roster->refresh();
        $this->assertEquals('archived', $roster->status);
    }

    public function test_mid_month_employee_transfer_preserves_past_entries_and_generates_future(): void
    {
        $this->actingAs($this->admin);

        $roster = Roster::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Factory Operations September',
            'code' => 'RST-2026-09-FAC',
            'department_id' => $this->dept->id,
            'start_date' => '2026-09-01',
            'end_date' => '2026-09-30',
            'status' => 'published',
            'published_at' => now(),
        ]);

        $squadA = RosterGroup::create([
            'tenant_id' => $this->tenant->id,
            'roster_id' => $roster->id,
            'roster_pattern_id' => $this->patternA->id,
            'name' => 'Squad Alpha (Morning)',
            'code' => 'SQD-A',
            'color' => '#3b82f6',
        ]);

        $squadB = RosterGroup::create([
            'tenant_id' => $this->tenant->id,
            'roster_id' => $roster->id,
            'roster_pattern_id' => $this->patternB->id,
            'name' => 'Squad Beta (Night)',
            'code' => 'SQD-B',
            'color' => '#8b5cf6',
        ]);

        // 1. Initially enroll employee in Squad A for entire month
        $this->post("/roster/squads/{$squadA->id}/enroll", [
            'employee_ids' => [$this->emp->id],
        ]);

        // Verify Sept 01 - 30 entries exist and belong to Squad A with Morning Shift
        $day5Entry = RosterEntry::where('employee_id', $this->emp->id)->whereDate('roster_date', '2026-09-05')->first();
        $this->assertNotNull($day5Entry);
        $this->assertEquals($squadA->id, $day5Entry->roster_group_id);

        $day15OldEntry = RosterEntry::where('employee_id', $this->emp->id)->whereDate('roster_date', '2026-09-15')->first();
        $this->assertNotNull($day15OldEntry);
        $this->assertEquals($squadA->id, $day15OldEntry->roster_group_id);

        // 2. Transfer employee to Squad B starting from Sept 11
        $transferResponse = $this->post("/roster/squads/{$squadB->id}/transfer", [
            'employee_id' => $this->emp->id,
            'effective_date' => '2026-09-11',
        ]);

        $transferResponse->assertRedirect();
        $transferResponse->assertSessionHas('success');

        // 3. Verify Squad A membership was capped at 2026-09-10
        $memberA = RosterGroupMember::where('roster_group_id', $squadA->id)->where('employee_id', $this->emp->id)->first();
        $this->assertNotNull($memberA);
        $this->assertEquals('2026-09-10', $memberA->end_date->toDateString());

        // 4. Verify Squad B membership started at 2026-09-11
        $memberB = RosterGroupMember::where('roster_group_id', $squadB->id)->where('employee_id', $this->emp->id)->first();
        $this->assertNotNull($memberB);
        $this->assertEquals('2026-09-11', $memberB->start_date->toDateString());

        // 5. Verify Past Entries (Days 1 to 10) REMAIN tied to Squad A (not deleted, not altered)
        $day5After = RosterEntry::where('employee_id', $this->emp->id)->whereDate('roster_date', '2026-09-05')->first();
        $this->assertNotNull($day5After);
        $this->assertEquals($squadA->id, $day5After->roster_group_id);

        $day10After = RosterEntry::where('employee_id', $this->emp->id)->whereDate('roster_date', '2026-09-10')->first();
        $this->assertNotNull($day10After);
        $this->assertEquals($squadA->id, $day10After->roster_group_id);

        // 6. Verify Future Entries (Day 11 onwards) are now linked to Squad B
        $day11After = RosterEntry::where('employee_id', $this->emp->id)->whereDate('roster_date', '2026-09-11')->first();
        $this->assertNotNull($day11After);
        $this->assertEquals($squadB->id, $day11After->roster_group_id);

        $day25After = RosterEntry::where('employee_id', $this->emp->id)->whereDate('roster_date', '2026-09-25')->first();
        $this->assertNotNull($day25After);
        $this->assertEquals($squadB->id, $day25After->roster_group_id);
    }

    public function test_new_joiner_only_gets_shifts_from_hire_date(): void
    {
        $this->actingAs($this->admin);

        // New employee joining mid-month on Sept 16
        $newJoiner = Employee::create([
            'tenant_id' => $this->tenant->id,
            'department_id' => $this->dept->id,
            'emp_no' => 'EMP-JOINER-16',
            'full_name' => 'Nimal Siriwardena',
            'nic' => '199512345678',
            'date_of_birth' => '1995-05-15',
            'gender' => 'male',
            'marital_status' => 'single',
            'designation_id' => null,
            'employment_status' => 'active',
            'hire_date' => '2026-09-16',
        ]);

        $roster = Roster::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'September Full Month',
            'code' => 'RST-2026-09-JOIN',
            'department_id' => $this->dept->id,
            'start_date' => '2026-09-01',
            'end_date' => '2026-09-30',
            'status' => 'draft',
        ]);

        $squad = RosterGroup::create([
            'tenant_id' => $this->tenant->id,
            'roster_id' => $roster->id,
            'roster_pattern_id' => $this->patternA->id,
            'name' => 'Morning Squad',
            'code' => 'SQD-M',
            'color' => '#3b82f6',
        ]);

        // Enroll new joiner into squad
        $this->post("/roster/squads/{$squad->id}/enroll", [
            'employee_ids' => [$newJoiner->id],
            'effective_start_date' => '2026-09-16',
        ]);

        // Verify NO entries exist prior to Sept 16
        $preJoinCount = RosterEntry::where('employee_id', $newJoiner->id)
            ->whereBetween('roster_date', ['2026-09-01', '2026-09-15'])
            ->count();
        $this->assertEquals(0, $preJoinCount, 'No shifts should be scheduled prior to hire date');

        // Verify entries exist from Sept 16 to 30 (15 days)
        $postJoinCount = RosterEntry::where('employee_id', $newJoiner->id)
            ->whereBetween('roster_date', ['2026-09-16', '2026-09-30'])
            ->count();
        $this->assertEquals(15, $postJoinCount);
    }
}
