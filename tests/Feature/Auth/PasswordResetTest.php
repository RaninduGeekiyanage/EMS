<?php

declare(strict_types=1);

namespace Tests\Feature\Auth;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Tests\TestCase;

final class PasswordResetTest extends TestCase
{
    use RefreshDatabase;

    public function test_reset_password_link_screen_can_be_rendered(): void
    {
        $response = $this->get('/forgot-password');

        $response->assertStatus(200);
    }

    public function test_reset_password_link_can_be_requested(): void
    {
        User::create([
            'name' => 'Demo User',
            'email' => 'user@example.com',
            'password' => Hash::make('password123'),
        ]);

        $response = $this->post('/forgot-password', [
            'email' => 'user@example.com',
        ]);

        $response->assertSessionHas('status');
    }

    public function test_reset_password_screen_can_be_rendered(): void
    {
        $user = User::create([
            'name' => 'Demo User',
            'email' => 'user@example.com',
            'password' => Hash::make('password123'),
        ]);

        $token = Password::createToken($user);

        $response = $this->get('/reset-password/'.$token.'?email=user@example.com');

        $response->assertStatus(200);
    }

    public function test_password_can_be_reset_with_valid_token(): void
    {
        $user = User::create([
            'name' => 'Demo User',
            'email' => 'user@example.com',
            'password' => Hash::make('old-password'),
        ]);

        $token = Password::createToken($user);

        $response = $this->post('/reset-password', [
            'token' => $token,
            'email' => 'user@example.com',
            'password' => 'new-password123',
            'password_confirmation' => 'new-password123',
        ]);

        $response->assertRedirect('/login');
        $this->assertTrue(Hash::check('new-password123', (string) $user->fresh()->password));
    }
}
