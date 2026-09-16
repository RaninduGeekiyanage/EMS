<?php

declare(strict_types=1);

namespace Tests\Feature\Dashboard;

use App\Models\Tenant;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

final class TenantDashboardTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);
    }

    public function test_guest_is_redirected_from_dashboard_to_login(): void
    {
        $response = $this->get('/dashboard');

        $response->assertRedirect('/login');
    }

    public function test_authenticated_tenant_user_can_access_dashboard(): void
    {
        $tenant = Tenant::create([
            'name' => 'Lanka Exports',
            'slug' => 'lanka-exports',
            'is_active' => true,
            'is_ams_enabled' => true,
            'is_payroll_enabled' => true,
        ]);

        $user = User::create([
            'name' => 'Lanka Admin',
            'email' => 'admin@lankaexports.test',
            'password' => Hash::make('password123'),
            'tenant_id' => $tenant->id,
        ]);

        $response = $this->actingAs($user)
            ->withSession(['tenant_id' => $tenant->id])
            ->get('/dashboard');

        $response->assertStatus(200);
    }
}
