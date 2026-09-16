<?php

declare(strict_types=1);

namespace Tests\Feature\M02;

use App\Models\Employee;
use App\Models\Shift;
use App\Models\Tenant;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

final class ShiftManagementTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;
    private User $manager;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);

        $this->tenant = Tenant::create([
            'name' => 'Lanka Plantations Ltd',
            'slug' => 'lanka-plantations',
            'is_active' => true,
        ]);

        session(['tenant_id' => $this->tenant->id]);
        if (function_exists('setPermissionsTeamId')) {
            setPermissionsTeamId($this->tenant->id);
        }

        $this->manager = User::factory()->create([
            'name' => 'HR Manager',
            'email' => 'manager@lanka.com',
        ]);
        $this->manager->assignRole('HR Manager');
    }

    public function test_displays_shifts_index(): void
    {
        $response = $this->actingAs($this->manager)
            ->withHeaders(['X-Tenant-ID' => $this->tenant->id])
            ->get('/shifts');

        $response->assertOk();
    }

    public function test_can_create_shift_via_http_post(): void
    {
        $payload = [
            'name' => 'Morning Harvest Shift',
            'code' => 'MORN-HARV',
            'shift_type' => 'rotational',
            'start_time' => '06:00',
            'end_time' => '14:00',
            'break_minutes' => 30,
            'grace_minutes' => 10,
            'ot_threshold_minutes' => 480,
            'is_night_shift' => false,
            'color' => '#10B981',
            'description' => 'Estate tea harvesting shift.',
            'is_active' => true,
        ];

        $response = $this->actingAs($this->manager)
            ->withHeaders(['X-Tenant-ID' => $this->tenant->id])
            ->post('/shifts', $payload);

        $response->assertRedirect();
        $this->assertDatabaseHas('shifts', [
            'tenant_id' => $this->tenant->id,
            'code' => 'MORN-HARV',
            'name' => 'Morning Harvest Shift',
        ]);
    }

    public function test_can_update_shift_via_http_put(): void
    {
        $shift = Shift::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Regular Shift',
            'code' => 'REG-01',
            'shift_type' => 'regular',
            'start_time' => '08:30:00',
            'end_time' => '17:00:00',
            'break_minutes' => 60,
            'grace_minutes' => 10,
            'ot_threshold_minutes' => 480,
        ]);

        $payload = [
            'name' => 'Updated Regular Shift',
            'code' => 'REG-01',
            'shift_type' => 'regular',
            'start_time' => '08:00',
            'end_time' => '16:30',
            'break_minutes' => 45,
            'grace_minutes' => 15,
            'ot_threshold_minutes' => 480,
            'is_night_shift' => false,
            'is_active' => true,
        ];

        $response = $this->actingAs($this->manager)
            ->withHeaders(['X-Tenant-ID' => $this->tenant->id])
            ->put("/shifts/{$shift->id}", $payload);

        $response->assertRedirect();
        $this->assertDatabaseHas('shifts', [
            'id' => $shift->id,
            'name' => 'Updated Regular Shift',
            'break_minutes' => 45,
            'grace_minutes' => 15,
        ]);
    }

    public function test_can_assign_shift_to_employee(): void
    {
        $shift = Shift::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Factory Day',
            'code' => 'FAC-DAY',
            'shift_type' => 'regular',
            'start_time' => '08:00:00',
            'end_time' => '16:30:00',
            'break_minutes' => 60,
            'grace_minutes' => 10,
            'ot_threshold_minutes' => 480,
        ]);

        $employee = Employee::create([
            'tenant_id' => $this->tenant->id,
            'emp_no' => 'EMP-200',
            'nic' => '199212345678',
            'full_name' => 'Anura Kumara',
            'employment_type' => 'permanent',
            'employment_status' => 'active',
        ]);

        $response = $this->actingAs($this->manager)
            ->withHeaders(['X-Tenant-ID' => $this->tenant->id])
            ->post('/shifts/assign', [
                'employee_id' => $employee->id,
                'shift_id' => $shift->id,
                'effective_from' => '2026-04-01',
            ]);

        $response->assertRedirect();
        $this->assertDatabaseHas('shift_assignments', [
            'tenant_id' => $this->tenant->id,
            'employee_id' => $employee->id,
            'shift_id' => $shift->id,
        ]);
    }

    public function test_tenant_isolation_on_shifts(): void
    {
        $otherTenant = Tenant::create([
            'name' => 'Other Holdings',
            'slug' => 'other-holdings',
            'is_active' => true,
        ]);

        Shift::create([
            'tenant_id' => $otherTenant->id,
            'name' => 'Other Shift',
            'code' => 'OTH-01',
            'shift_type' => 'regular',
            'start_time' => '09:00:00',
            'end_time' => '17:00:00',
            'break_minutes' => 60,
            'grace_minutes' => 10,
            'ot_threshold_minutes' => 480,
        ]);

        $response = $this->actingAs($this->manager)
            ->withHeaders(['X-Tenant-ID' => $this->tenant->id])
            ->get('/shifts');

        $response->assertOk();
        $shiftsInProp = $response->viewData('page')['props']['shifts'] ?? [];
        $codes = collect($shiftsInProp)->pluck('code')->all();
        $this->assertNotContains('OTH-01', $codes);
    }
}
