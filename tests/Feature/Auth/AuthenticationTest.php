<?php

declare(strict_types=1);

namespace Tests\Feature\Auth;

use App\Models\Tenant;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

final class AuthenticationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);
    }

    public function test_login_screen_can_be_rendered(): void
    {
        $response = $this->get('/login');

        $response->assertStatus(200);
    }

    public function test_super_admin_can_authenticate_and_redirect_to_admin_dashboard(): void
    {
        $superAdmin = User::create([
            'name' => 'Super Admin',
            'email' => 'superadmin@ems.test',
            'password' => Hash::make('password123'),
            'tenant_id' => null,
            'is_super_admin' => true,
        ]);

        $response = $this->post('/login', [
            'email' => 'superadmin@ems.test',
            'password' => 'password123',
        ]);

        $this->assertAuthenticatedAs($superAdmin);
        $response->assertRedirect('/admin/dashboard');
    }

    public function test_tenant_user_can_authenticate_and_redirect_to_tenant_dashboard(): void
    {
        $tenant = Tenant::create([
            'name' => 'Acme Corp',
            'slug' => 'acme',
            'is_active' => true,
        ]);

        $user = User::create([
            'name' => 'Acme Admin',
            'email' => 'admin@acme.test',
            'password' => Hash::make('password123'),
            'tenant_id' => $tenant->id,
        ]);

        $response = $this->post('/login', [
            'email' => 'admin@acme.test',
            'password' => 'password123',
        ]);

        $this->assertAuthenticatedAs($user);
        $response->assertRedirect('/dashboard');
        $this->assertEquals($tenant->id, session('tenant_id'));
    }

    public function test_inactive_tenant_user_cannot_authenticate(): void
    {
        $tenant = Tenant::create([
            'name' => 'Inactive Corp',
            'slug' => 'inactive',
            'is_active' => false,
        ]);

        User::create([
            'name' => 'Inactive Admin',
            'email' => 'admin@inactive.test',
            'password' => Hash::make('password123'),
            'tenant_id' => $tenant->id,
        ]);

        $response = $this->post('/login', [
            'email' => 'admin@inactive.test',
            'password' => 'password123',
        ]);

        $this->assertGuest();
        $response->assertSessionHasErrors('email');
    }

    public function test_users_cannot_authenticate_with_invalid_password(): void
    {
        User::create([
            'name' => 'User',
            'email' => 'user@test.com',
            'password' => Hash::make('correct-password'),
        ]);

        $response = $this->post('/login', [
            'email' => 'user@test.com',
            'password' => 'wrong-password',
        ]);

        $this->assertGuest();
        $response->assertSessionHasErrors('email');
    }

    public function test_user_can_logout(): void
    {
        $user = User::create([
            'name' => 'User',
            'email' => 'user@test.com',
            'password' => Hash::make('password123'),
        ]);

        $response = $this->actingAs($user)->post('/logout');

        $this->assertGuest();
        $response->assertRedirect('/login');
    }
}
