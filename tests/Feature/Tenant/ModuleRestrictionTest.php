<?php

declare(strict_types=1);

namespace Tests\Feature\Tenant;

use App\Models\Tenant;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

final class ModuleRestrictionTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);
    }

    public function test_access_to_ams_is_blocked_when_ams_is_disabled_for_tenant(): void
    {
        $tenant = Tenant::create([
            'name' => 'No AMS Ltd',
            'slug' => 'no-ams',
            'is_active' => true,
            'is_ams_enabled' => false,
        ]);

        $user = User::create([
            'name' => 'User',
            'email' => 'user@noams.test',
            'password' => Hash::make('password123'),
            'tenant_id' => $tenant->id,
        ]);

        $response = $this->actingAs($user)
            ->withSession(['tenant_id' => $tenant->id])
            ->get('/shifts');

        $response->assertStatus(403);
    }

    public function test_access_to_ams_is_allowed_when_ams_is_enabled_for_tenant(): void
    {
        $tenant = Tenant::create([
            'name' => 'With AMS Ltd',
            'slug' => 'with-ams',
            'is_active' => true,
            'is_ams_enabled' => true,
        ]);

        $user = User::create([
            'name' => 'User',
            'email' => 'user@withams.test',
            'password' => Hash::make('password123'),
            'tenant_id' => $tenant->id,
        ]);

        $response = $this->actingAs($user)
            ->withSession(['tenant_id' => $tenant->id])
            ->get('/shifts');

        $response->assertStatus(200);
    }
}
