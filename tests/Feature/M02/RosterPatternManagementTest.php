<?php

declare(strict_types=1);

namespace Tests\Feature\M02;

use App\Models\Department;
use App\Models\Employee;
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
            ->from('/roster/patterns')
            ->post('/roster/patterns/assign', [
                'pattern_id' => $pattern->id,
                'employee_ids' => [$this->employeeA->id, $this->employeeB->id],
                'start_date' => '2026-06-01',
                'end_date' => '2026-06-07',
                'conflict_mode' => 'overwrite',
                'status' => 'published',
                'preserve_leaves' => true,
            ]);

        $response->assertRedirect('/roster/patterns');

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
}
