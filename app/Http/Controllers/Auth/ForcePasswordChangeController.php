<?php

declare(strict_types=1);

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules\Password;
use Inertia\Inertia;
use Inertia\Response;

final class ForcePasswordChangeController extends Controller
{
    /**
     * Show the mandatory password change view.
     */
    public function create(Request $request): Response|RedirectResponse
    {
        $user = $request->user();

        if ($user === null || ! $user->must_change_password) {
            return redirect()->route('dashboard');
        }

        return Inertia::render('Auth/ForcePasswordChange', [
            'user' => [
                'name' => $user->name,
                'username' => $user->username,
                'email' => $user->email,
            ],
        ]);
    }

    /**
     * Update the user's password and clear the mandatory flag.
     */
    public function update(Request $request): RedirectResponse
    {
        $user = $request->user();

        if ($user === null) {
            return redirect()->route('login');
        }

        $request->validate([
            'password' => ['required', 'string', 'confirmed', Password::min(6)],
        ]);

        $user->forceFill([
            'password' => Hash::make((string) $request->input('password')),
            'must_change_password' => false,
            'last_password_changed_at' => now(),
        ])->save();

        // Redirect based on role
        if ($user->isSuperAdmin()) {
            return redirect('/admin/dashboard')->with('success', 'Password updated successfully.');
        }

        $canManage = $user->hasRole('Company Owner')
            || $user->hasRole('Company Admin')
            || $user->hasRole('HR Manager')
            || $user->hasRole('HR Executive');

        if ($canManage) {
            return redirect('/dashboard')->with('success', 'Password updated successfully.');
        }

        return redirect('/portal/dashboard')->with('success', 'Your password has been changed securely. Welcome to your Self-Service Portal!');
    }
}
