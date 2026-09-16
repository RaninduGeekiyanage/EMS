<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Models\Tenant;
use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that's loaded on the first page visit.
     *
     * @see https://inertiajs.com/server-side-setup#root-template
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determines the current asset version.
     *
     * @see https://inertiajs.com/asset-versioning
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @see https://inertiajs.com/shared-data
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        $user = $request->user();
        $tenant = app()->bound('current_tenant') ? app('current_tenant') : null;
        if ($tenant === null && session()->has('tenant_id')) {
            $tenant = Tenant::find(session('tenant_id'));
        }

        return [
            ...parent::share($request),
            'auth' => [
                'user' => $user !== null ? [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'tenant_id' => $user->tenant_id,
                    'is_super_admin' => $user->isSuperAdmin(),
                    'is_company_owner' => $user->isCompanyOwner(),
                    'roles' => $user->getRoleNames(),
                ] : null,
                'tenant' => $tenant !== null ? [
                    'id' => $tenant->id,
                    'name' => $tenant->name,
                    'slug' => $tenant->slug,
                    'is_active' => (bool) $tenant->is_active,
                    'is_ams_enabled' => (bool) $tenant->is_ams_enabled,
                    'is_payroll_enabled' => (bool) $tenant->is_payroll_enabled,
                ] : null,
                'is_impersonating' => $request->hasSession() && session()->has('impersonated_tenant_id'),
            ],
            'flash' => [
                'status' => session('status'),
                'success' => session('success'),
                'error' => session('error'),
            ],
        ];
    }
}
