<?php

declare(strict_types=1);

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

final class AuthenticatedSessionController extends Controller
{
    /**
     * Display the login view.
     */
    public function create(): Response|RedirectResponse
    {
        if (Auth::check()) {
            $user = Auth::user();
            if ($user !== null && ($user->isSuperAdmin() || $user->tenant_id === null)) {
                return redirect()->intended('/admin/dashboard');
            }

            return redirect()->intended('/dashboard');
        }

        return Inertia::render('Auth/Login', [
            'status' => session('status'),
        ]);
    }

    /**
     * Display the employee self-service login view.
     */
    public function createEmployeePortal(): Response|RedirectResponse
    {
        if (Auth::check()) {
            return redirect()->intended('/portal/dashboard');
        }

        return Inertia::render('Auth/EmployeeLogin', [
            'status' => session('status'),
        ]);
    }

    /**
     * Handle an incoming authentication request.
     */
    public function store(LoginRequest $request): RedirectResponse
    {
        $request->authenticate();

        $request->session()->regenerate();

        $user = $request->user();

        if ($user !== null && ($user->isSuperAdmin() || $user->tenant_id === null)) {
            $request->session()->forget(['tenant_id', 'tenant_slug', 'impersonated_tenant_id']);

            return redirect()->intended('/admin/dashboard');
        }

        if ($user !== null) {
            $tenant = $user->tenant;

            if ($tenant === null || ! $tenant->is_active) {
                Auth::guard('web')->logout();
                $request->session()->invalidate();
                $request->session()->regenerateToken();

                throw ValidationException::withMessages([
                    'email' => 'Your company account is inactive or disabled. Please contact system support.',
                ]);
            }

            session([
                'tenant_id' => $tenant->id,
                'tenant_slug' => $tenant->slug,
            ]);

            if (function_exists('setPermissionsTeamId')) {
                setPermissionsTeamId($tenant->id);
            }

            if ((bool) $user->must_change_password) {
                return redirect()->route('password.force-change');
            }

            $isEmployee = $user->employee_id !== null
                || $user->hasRole('Staff')
                || ! empty($user->username);

            $canManage = $user->hasRole('Company Owner')
                || $user->hasRole('Company Admin')
                || $user->hasRole('HR Manager')
                || $user->hasRole('HR Executive');

            if ($isEmployee && ! $canManage) {
                return redirect()->intended('/portal/dashboard');
            }
        }

        return redirect()->intended('/dashboard');
    }

    /**
     * Destroy an authenticated session.
     */
    public function destroy(Request $request): RedirectResponse
    {
        Auth::guard('web')->logout();

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect('/login');
    }
}
