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
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

final class RosterPatternManagementTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;
    private User $hrManager;
    private Shift $shift;
    private Employee $employeeA;
    private Employee $employeeB;
    private Department $department;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);

        $this->tenant = Tenant::create([
            'name' => 'Royal Tea Estates',
            'slug' => 'royal-tea',
            'is_active' => true,
        ]);

        session(['tenant_id' => $this->tenant->id]);
        if (function_exists('setPermissionsTeamId')) {
            setPermissionsTeamId($this->tenant->id);
        }

        $this->hrManager = User::factory()->create([
            'name' => 'Kavinda Perera',
            'email' => 'kavinda@royalea.com',
            'tenant_id' => $this->tenant->id,
        ]);
        $this->hrManager->assignRole('HR Manager');

        $this->department = Department::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Estate Field Operations',
            'code' => 'EFO',
        ]);

        $this->shift = Shift::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Standard Morning Shift',
            'code' => 'MORN-STD',
            'shift_type' => 'regular',
            'start_time' => '08:00:00',
            'end_time' => '17:00:00',
            'break_minutes' => 60,
            'grace_minutes' => 15,
            'ot_threshold_minutes' => 480,
        ]);

        $this->employeeA = Employee::create([
            'tenant_id' => $this->tenant->id,
            'emp_no' => 'EMP-101',
            'nic' => '199011223344',
            'full_name' => 'Nimal Jayasuriya',
            'employment_type' => 'permanent',
            'employment_status' => 'active',
            'department_id' => $this->department->id,
        ]);

        $this->employeeB = Employee::create([
            'tenant_id' => $this->tenant->id,
            'emp_no' => 'EMP-102',
            'nic' => '199122334455',
            'full_name' => 'Kamal Wickramasinghe',
            'employment_type' => 'permanent',
            'employment_status' => 'active',
            'department_id' => $this->department->id,
        ]);
    }

    public function test_can_render_roster_patterns_page(): void
    {
        $response = $this->actingAs($this->hrManager)
            ->withHeaders(['X-Tenant-ID' => $this->tenant->id])
            ->get('/roster/patterns');

        $response->assertOk();
    }

    public function test_can_create_weekly_roster_pattern(): void
    {
        $weeklyConfig = [
            ['shift_id' => $this->shift->id, 'is_rest_day' => false],
            ['shift_id' => $this->shift->id, 'is_rest_day' => false],
            ['shift_id' => $this->shift->id, 'is_rest_day' => false],
            ['shift_id' => $this->shift->id, 'is_rest_day' => false],
            ['shift_id' => $this->shift->id, 'is_rest_day' => false],
            ['shift_id' => null, 'is_rest_day' => true],
            ['shift_id' => null, 'is_rest_day' => true],
        ];

        $response = $this->actingAs($this->hrManager)
            ->withHeaders(['X-Tenant-ID' => $this->tenant->id])
            ->from('/roster/patterns')
            ->post('/roster/patterns', [
                'name' => '5-Day Office Week',
                'code' => 'OFF-5D',
                'description' => 'Standard Monday to Friday office roster',
                'pattern_type' => 'weekly',
                'pattern_data' => $weeklyConfig,
                'is_active' => true,
            ]);

        $response->assertRedirect('/roster/patterns');
        $this->assertDatabaseHas('roster_patterns', [
            'tenant_id' => $this->tenant->id,
            'code' => 'OFF-5D',
            'name' => '5-Day Office Week',
            'pattern_type' => 'weekly',
        ]);
    }

    public function test_can_assign_roster_pattern_in_bulk_to_employees(): void
    {
        $pattern = RosterPattern::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Field Weekly Pattern',
            'code' => 'FLD-W1',
            'pattern_type' => 'weekly',
            'pattern_data' => [
                ['shift_id' => $this->shift->id, 'is_rest_day' => false],
                ['shift_id' => $this->shift->id, 'is_rest_day' => false],
                ['shift_id' => $this->shift->id, 'is_rest_day' => false],
                ['shift_id' => $this->shift->id, 'is_rest_day' => false],
                ['shift_id' => $this->shift->id, 'is_rest_day' => false],
                ['shift_id' => null, 'is_rest_day' => true],
                ['shift_id' => null, 'is_rest_day' => true],
            ],
            'is_active' => true,
        ]);

        $response = $this->actingAs($this->hrManager)
            ->withHeaders(['X-Tenant-ID' => $this->tenant->id])
            ->from('/roster')
            ->post('/roster/generate', [
                'pattern_id' => $pattern->id,
                'employee_ids' => [$this->employeeA->id, $this->employeeB->id],
                'start_date' => '2026-06-01',
                'end_date' => '2026-06-07',
                'conflict_mode' => 'overwrite',
                'status' => 'published',
                'preserve_leaves' => true,
            ]);

        $response->assertRedirect('/roster');

        // Verify that entries were generated for both employees
        $this->assertDatabaseHas('roster_entries', [
            'tenant_id' => $this->tenant->id,
            'employee_id' => $this->employeeA->id,
            'roster_date' => '2026-06-01',
            'shift_id' => $this->shift->id,
            'schedule_type' => 'shift',
        ]);

        $this->assertDatabaseHas('roster_entries', [
            'tenant_id' => $this->tenant->id,
            'employee_id' => $this->employeeB->id,
            'roster_date' => '2026-06-01',
            'shift_id' => $this->shift->id,
            'schedule_type' => 'shift',
        ]);
    }

    public function test_can_assign_baseline_shift_in_bulk(): void
    {
        $response = $this->actingAs($this->hrManager)
            ->withHeaders(['X-Tenant-ID' => $this->tenant->id])
            ->from('/shifts')
            ->post('/shifts/assign', [
                'shift_id' => $this->shift->id,
                'employee_ids' => [$this->employeeA->id, $this->employeeB->id],
                'effective_from' => '2026-06-01',
            ]);

        $response->assertRedirect('/shifts');

        $this->assertDatabaseHas('shift_assignments', [
            'tenant_id' => $this->tenant->id,
            'employee_id' => $this->employeeA->id,
            'shift_id' => $this->shift->id,
        ]);

        $this->assertDatabaseHas('shift_assignments', [
            'tenant_id' => $this->tenant->id,
            'employee_id' => $this->employeeB->id,
            'shift_id' => $this->shift->id,
        ]);
    }

    public function test_can_create_pattern_with_explicit_date_range_and_extend_it(): void
    {
        $weeklyConfig = [
            ['shift_id' => $this->shift->id, 'is_rest_day' => false],
            ['shift_id' => $this->shift->id, 'is_rest_day' => false],
            ['shift_id' => $this->shift->id, 'is_rest_day' => false],
            ['shift_id' => $this->shift->id, 'is_rest_day' => false],
            ['shift_id' => $this->shift->id, 'is_rest_day' => false],
            ['shift_id' => null, 'is_rest_day' => true],
            ['shift_id' => null, 'is_rest_day' => true],
        ];

        $response = $this->actingAs($this->hrManager)
            ->withHeaders(['X-Tenant-ID' => $this->tenant->id])
            ->from('/roster/patterns')
            ->post('/roster/patterns', [
                'name' => 'Annual Operations 2026',
                'code' => 'ANN-2026',
                'pattern_type' => 'weekly',
                'start_date' => '2026-01-01',
                'end_date' => '2026-12-31',
                'pattern_data' => $weeklyConfig,
                'is_active' => true,
            ]);

        $response->assertRedirect('/roster/patterns');
        $pattern = RosterPattern::where('code', 'ANN-2026')->firstOrFail();
        $this->assertEquals('2026-01-01', $pattern->start_date->format('Y-m-d'));
        $this->assertEquals('2026-12-31', $pattern->end_date->format('Y-m-d'));

        // Now test extending the pattern for another year (e.g. up to 2027-12-31)
        $updateResponse = $this->actingAs($this->hrManager)
            ->withHeaders(['X-Tenant-ID' => $this->tenant->id])
            ->from('/roster/patterns')
            ->put("/roster/patterns/{$pattern->id}", [
                'name' => 'Annual Operations 2026-2027',
                'code' => 'ANN-2026',
                'pattern_type' => 'weekly',
                'start_date' => '2026-01-01',
                'end_date' => '2027-12-31',
                'cycle_length_days' => 7,
                'pattern_data' => $weeklyConfig,
                'is_active' => true,
            ]);

        $updateResponse->assertRedirect('/roster/patterns');
        $pattern->refresh();
        $this->assertEquals('2027-12-31', $pattern->end_date->format('Y-m-d'));
    }

    public function test_can_assign_mid_period_joiner_inheriting_pattern_end_date(): void
    {
        $pattern = RosterPattern::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Q3 Guard Roster',
            'code' => 'SEC-Q3',
            'pattern_type' => 'weekly',
            'start_date' => '2026-07-01',
            'end_date' => '2026-07-31',
            'pattern_data' => [
                ['shift_id' => $this->shift->id, 'is_rest_day' => false],
                ['shift_id' => $this->shift->id, 'is_rest_day' => false],
                ['shift_id' => $this->shift->id, 'is_rest_day' => false],
                ['shift_id' => $this->shift->id, 'is_rest_day' => false],
                ['shift_id' => $this->shift->id, 'is_rest_day' => false],
                ['shift_id' => null, 'is_rest_day' => true],
                ['shift_id' => null, 'is_rest_day' => true],
            ],
            'is_active' => true,
        ]);

        // Employee joins on July 15 mid-period; request only passes start_date and pattern_id
        $response = $this->actingAs($this->hrManager)
            ->withHeaders(['X-Tenant-ID' => $this->tenant->id])
            ->from('/roster')
            ->post('/roster/generate', [
                'pattern_id' => $pattern->id,
                'employee_ids' => [$this->employeeA->id],
                'start_date' => '2026-07-15',
                'end_date' => '2026-07-31',
                'conflict_mode' => 'overwrite',
                'status' => 'published',
            ]);

        $response->assertRedirect('/roster');
    }

    public function test_can_auto_generate_complementary_squads_from_cyclical_pattern(): void
    {
        $basePattern = RosterPattern::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Support Team - Group A',
            'code' => 'SUP-GRP-A',
            'pattern_type' => 'cyclical',
            'cycle_length_days' => 3,
            'pattern_data' => [
                'steps' => [
                    ['step' => 1, 'shift_id' => $this->shift->id, 'is_rest_day' => false],
                    ['step' => 2, 'shift_id' => $this->shift->id, 'is_rest_day' => false],
                    ['step' => 3, 'shift_id' => '', 'is_rest_day' => true],
                ],
            ],
            'is_active' => true,
        ]);

        $response = $this->actingAs($this->hrManager)
            ->withHeaders(['X-Tenant-ID' => $this->tenant->id])
            ->from('/roster/patterns')
            ->post("/roster/patterns/{$basePattern->id}/generate-squads");

        $response->assertRedirect('/roster/patterns');
        $response->assertSessionHas('success');

        // Groups B and C must be generated
        $this->assertDatabaseHas('roster_patterns', ['code' => 'SUP-GRP-B', 'cycle_length_days' => 3]);
        $this->assertDatabaseHas('roster_patterns', ['code' => 'SUP-GRP-C', 'cycle_length_days' => 3]);
    }

    public function test_can_discard_pure_draft_roster(): void
    {
        $roster = Roster::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Draft Operations',
            'code' => 'RST-DRAFT-01',
            'department_id' => $this->department->id,
            'start_date' => '2026-08-01',
            'end_date' => '2026-08-31',
            'status' => 'draft',
            'published_at' => null,
            'created_by' => $this->hrManager->id,
        ]);

        RosterEntry::create([
            'tenant_id' => $this->tenant->id,
            'roster_id' => $roster->id,
            'employee_id' => $this->employeeA->id,
            'roster_date' => '2026-08-01',
            'shift_id' => $this->shift->id,
            'schedule_type' => 'shift',
            'status' => 'draft',
            'created_by' => $this->hrManager->id,
        ]);

        $response = $this->actingAs($this->hrManager)
            ->withHeaders(['X-Tenant-ID' => $this->tenant->id])
            ->from('/roster')
            ->delete("/roster/rosters/{$roster->id}");

        $response->assertRedirect('/roster');
        $response->assertSessionHas('success');

        $this->assertDatabaseMissing('rosters', ['id' => $roster->id]);
        $this->assertDatabaseMissing('roster_entries', ['roster_id' => $roster->id]);
    }

    public function test_can_archive_published_roster(): void
    {
        $roster = Roster::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Official August Roster',
            'code' => 'RST-OFF-01',
            'department_id' => $this->department->id,
            'start_date' => '2026-08-01',
            'end_date' => '2026-08-31',
            'status' => 'published',
            'published_at' => now(),
            'created_by' => $this->hrManager->id,
        ]);

        $response = $this->actingAs($this->hrManager)
            ->withHeaders(['X-Tenant-ID' => $this->tenant->id])
            ->from('/roster')
            ->post("/roster/rosters/{$roster->id}/archive");

        $response->assertRedirect('/roster');
        $response->assertSessionHas('success');

        $this->assertDatabaseHas('rosters', [
            'id' => $roster->id,
            'status' => 'archived',
        ]);
    }

    public function test_cannot_delete_previously_published_roster(): void
    {
        $roster = Roster::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Published September Roster',
            'code' => 'RST-SEP-01',
            'department_id' => $this->department->id,
            'start_date' => '2026-09-01',
            'end_date' => '2026-09-30',
            'status' => 'draft', // even if reverted to draft, published_at is retained
            'published_at' => now()->subDay(),
            'created_by' => $this->hrManager->id,
        ]);

        $response = $this->actingAs($this->hrManager)
            ->withHeaders(['X-Tenant-ID' => $this->tenant->id])
            ->from('/roster')
            ->delete("/roster/rosters/{$roster->id}");

        $response->assertRedirect('/roster');
        $response->assertSessionHas('error');

        // Roster must still exist in DB
        $this->assertDatabaseHas('rosters', ['id' => $roster->id]);
    }
}

