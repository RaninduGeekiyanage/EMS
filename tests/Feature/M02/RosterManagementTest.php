<?php

declare(strict_types=1);

namespace Tests\Feature\M02;

use App\Models\Employee;
use App\Models\RosterEntry;
use App\Models\Shift;
use App\Models\Tenant;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

final class RosterManagementTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;
    private User $hrManager;
    private Shift $shift;
    private Employee $employee;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);

        $this->tenant = Tenant::create([
            'name' => 'Ceylon Commercial Plantations',
            'slug' => 'ceylon-commercial',
            'is_active' => true,
        ]);

        session(['tenant_id' => $this->tenant->id]);
        if (function_exists('setPermissionsTeamId')) {
            setPermissionsTeamId($this->tenant->id);
        }

        $this->hrManager = User::factory()->create([
            'name' => 'Dilshan Silva',
            'email' => 'dilshan@ceylon.com',
            'tenant_id' => $this->tenant->id,
        ]);
        $this->hrManager->assignRole('HR Manager');

        $this->shift = Shift::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Morning Harvest',
            'code' => 'MORN-01',
            'shift_type' => 'regular',
            'start_time' => '07:00:00',
            'end_time' => '15:30:00',
            'break_minutes' => 60,
            'grace_minutes' => 10,
            'ot_threshold_minutes' => 480,
        ]);

        $this->employee = Employee::create([
            'tenant_id' => $this->tenant->id,
            'emp_no' => 'EMP-501',
            'nic' => '199312345678',
            'full_name' => 'Sunil Perera',
            'employment_type' => 'permanent',
            'employment_status' => 'active',
        ]);
    }

    public function test_displays_roster_planner_view(): void
    {
        $response = $this->actingAs($this->hrManager)
            ->withHeaders(['X-Tenant-ID' => $this->tenant->id])
            ->get('/roster?year=2026&month=5');

        $response->assertOk();
    }

    public function test_can_generate_roster_via_http_post(): void
    {
        $payload = [
            'start_date' => '2026-05-01',
            'end_date' => '2026-05-31',
            'pattern_mode' => 'daily',
            'employee_ids' => [$this->employee->id],
            'conflict_mode' => 'overwrite',
            'status' => 'published',
            'daily_config' => [
                'shift_id' => $this->shift->id,
                'rest_days' => ['Sunday'],
            ],
        ];

        $response = $this->actingAs($this->hrManager)
            ->withHeaders(['X-Tenant-ID' => $this->tenant->id])
            ->post('/roster/generate', $payload);

        $response->assertRedirect();
        $this->assertDatabaseHas('roster_entries', [
            'tenant_id' => $this->tenant->id,
            'employee_id' => $this->employee->id,
            'roster_date' => '2026-05-01',
        ]);
    }

    public function test_can_update_single_cell_entry(): void
    {
        $payload = [
            'employee_id' => $this->employee->id,
            'date' => '2026-05-12',
            'shift_id' => $this->shift->id,
            'schedule_type' => 'shift',
            'notes' => 'Direct supervisor assignment',
            'status' => 'published',
        ];

        $response = $this->actingAs($this->hrManager)
            ->withHeaders(['X-Tenant-ID' => $this->tenant->id])
            ->post('/roster/entry', $payload);

        $response->assertRedirect();
        $this->assertDatabaseHas('roster_entries', [
            'tenant_id' => $this->tenant->id,
            'employee_id' => $this->employee->id,
            'roster_date' => '2026-05-12',
            'shift_id' => $this->shift->id,
            'is_overridden' => true,
        ]);
    }

    public function test_tenant_isolation_on_roster_entries(): void
    {
        $otherTenant = Tenant::create([
            'name' => 'Foreign Corp',
            'slug' => 'foreign-corp',
            'is_active' => true,
        ]);

        $otherEmp = Employee::create([
            'tenant_id' => $otherTenant->id,
            'emp_no' => 'FOR-999',
            'nic' => '198812345678',
            'full_name' => 'John Foreigner',
            'employment_type' => 'permanent',
            'employment_status' => 'active',
        ]);

        RosterEntry::create([
            'tenant_id' => $otherTenant->id,
            'employee_id' => $otherEmp->id,
            'roster_date' => '2026-05-01',
            'schedule_type' => 'rest_day',
            'status' => 'published',
        ]);

        $response = $this->actingAs($this->hrManager)
            ->withHeaders(['X-Tenant-ID' => $this->tenant->id])
            ->get('/roster?year=2026&month=5');

        $response->assertOk();
        $matrix = $response->viewData('page')['props']['matrix'] ?? [];
        $employeeNos = collect($matrix)->pluck('employee.emp_no')->all();
        $this->assertNotContains('FOR-999', $employeeNos);
    }
}
