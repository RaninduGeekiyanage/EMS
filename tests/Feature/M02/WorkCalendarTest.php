<?php

declare(strict_types=1);

namespace Tests\Feature\M02;

use App\Models\PublicHoliday;
use App\Models\Tenant;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

final class WorkCalendarTest extends TestCase
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

    public function test_displays_work_calendar(): void
    {
        $response = $this->actingAs($this->manager)
            ->withHeaders(['X-Tenant-ID' => $this->tenant->id])
            ->get('/work-calendar');

        $response->assertOk();
    }

    public function test_can_add_public_holiday(): void
    {
        $payload = [
            'name' => 'Special Mercantile Day',
            'holiday_date' => '2026-07-15',
            'type' => 'mercantile',
            'description' => 'Additional special company holiday.',
        ];

        $response = $this->actingAs($this->manager)
            ->withHeaders(['X-Tenant-ID' => $this->tenant->id])
            ->post('/work-calendar/holidays', $payload);

        $response->assertRedirect();
        $this->assertDatabaseHas('public_holidays', [
            'tenant_id' => $this->tenant->id,
            'holiday_date' => '2026-07-15 00:00:00',
            'name' => 'Special Mercantile Day',
            'type' => 'mercantile',
        ]);
    }

    public function test_can_seed_sri_lankan_holidays_via_http(): void
    {
        $response = $this->actingAs($this->manager)
            ->withHeaders(['X-Tenant-ID' => $this->tenant->id])
            ->post('/work-calendar/seed-holidays', ['year' => 2026]);

        $response->assertRedirect();
        $this->assertDatabaseHas('public_holidays', [
            'tenant_id' => $this->tenant->id,
            'name' => 'National Independence Day',
            'type' => 'statutory',
        ]);
    }

    public function test_tenant_isolation_on_holidays(): void
    {
        $otherTenant = Tenant::create([
            'name' => 'Other Holdings',
            'slug' => 'other-holdings',
            'is_active' => true,
        ]);

        PublicHoliday::create([
            'tenant_id' => $otherTenant->id,
            'holiday_date' => '2026-10-10',
            'name' => 'Other Tenant Unique Holiday',
            'type' => 'statutory',
        ]);

        $response = $this->actingAs($this->manager)
            ->withHeaders(['X-Tenant-ID' => $this->tenant->id])
            ->get('/work-calendar?year=2026');

        $response->assertOk();
        $holidays = $response->viewData('page')['props']['holidays'] ?? [];
        $names = collect($holidays)->pluck('name')->all();
        $this->assertNotContains('Other Tenant Unique Holiday', $names);
    }
}
