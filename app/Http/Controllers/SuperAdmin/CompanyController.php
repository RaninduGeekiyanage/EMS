<?php

declare(strict_types=1);

namespace App\Http\Controllers\SuperAdmin;

use App\Http\Controllers\Controller;
use App\Http\Requests\SuperAdmin\ResetAdminPasswordRequest;
use App\Http\Requests\SuperAdmin\StoreCompanyRequest;
use App\Models\Company;
use App\Models\Tenant;
use App\Models\User;
use App\Services\ShiftService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Inertia\Inertia;
use Inertia\Response;

final class CompanyController extends Controller
{
    /**
     * Display the Super Admin platform dashboard with all companies.
     */
    public function index(Request $request): Response
    {
        $search = (string) $request->query('search', '');

        $tenantsQuery = Tenant::query()->with(['users' => function ($query): void {
            $query->select('id', 'tenant_id', 'name', 'email');
        }]);

        if (! empty($search)) {
            $tenantsQuery->where(function ($query) use ($search): void {
                $query->where('name', 'like', "%{$search}%")
                    ->orWhere('slug', 'like', "%{$search}%");
            });
        }

        $tenants = $tenantsQuery->latest()->get()->map(function (Tenant $tenant): array {
            $owner = $tenant->owner() ?? $tenant->users->first();

            return [
                'id' => $tenant->id,
                'name' => $tenant->name,
                'slug' => $tenant->slug,
                'is_active' => (bool) $tenant->is_active,
                'is_ams_enabled' => (bool) $tenant->is_ams_enabled,
                'is_payroll_enabled' => (bool) $tenant->is_payroll_enabled,
                'users_count' => $tenant->users->count(),
                'owner' => $owner !== null ? [
                    'id' => $owner->id,
                    'name' => $owner->name,
                    'email' => $owner->email,
                ] : null,
                'created_at' => $tenant->created_at?->format('Y-m-d H:i'),
            ];
        });

        $metrics = [
            'total_companies' => Tenant::count(),
            'active_companies' => Tenant::where('is_active', true)->count(),
            'total_users' => User::count(),
            'ams_enabled_count' => Tenant::where('is_ams_enabled', true)->count(),
            'payroll_enabled_count' => Tenant::where('is_payroll_enabled', true)->count(),
        ];

        return Inertia::render('SuperAdmin/Dashboard', [
            'tenants' => $tenants,
            'metrics' => $metrics,
            'filters' => [
                'search' => $search,
            ],
        ]);
    }

    /**
     * Provision a new Company (Tenant), initialize Company details and Owner user.
     */
    public function store(StoreCompanyRequest $request, ShiftService $shiftService): RedirectResponse
    {
        $validated = $request->validated();

        DB::transaction(function () use ($validated, $shiftService): void {
            // 1. Create Tenant
            $tenant = Tenant::create([
                'name' => $validated['name'],
                'slug' => $validated['slug'],
                'is_active' => true,
                'is_ams_enabled' => $validated['is_ams_enabled'] ?? true,
                'is_payroll_enabled' => $validated['is_payroll_enabled'] ?? true,
            ]);

            // 2. Create Company Entity
            Company::create([
                'tenant_id' => $tenant->id,
                'name' => $validated['name'],
            ]);

            // 3. Create Company Owner User
            $owner = User::create([
                'name' => $validated['owner_name'],
                'email' => $validated['owner_email'],
                'password' => Hash::make($validated['owner_password']),
                'tenant_id' => $tenant->id,
                'email_verified_at' => now(),
            ]);

            // 4. Assign Company Owner Role
            if (function_exists('setPermissionsTeamId')) {
                setPermissionsTeamId($tenant->id);
            }
            $owner->assignRole('Company Owner');

            // 5. Seed standard templates and public holidays for the new tenant
            session(['tenant_id' => $tenant->id]);
            app()->instance('current_tenant', $tenant);
            app()->instance('current_tenant_id', $tenant->id);

            $shiftService->seedStandardTemplates();
            $shiftService->seedSriLankanHolidays((int) now()->year);
        });

        return back()->with('success', 'Company and initial owner account successfully created.');
    }

    /**
     * Reset the password for the company's owner/top admin.
     */
    public function resetAdminPassword(ResetAdminPasswordRequest $request, Tenant $tenant): RedirectResponse
    {
        $owner = $tenant->owner() ?? $tenant->users()->first();

        if ($owner === null) {
            return back()->with('error', 'No user account found for this company to reset password.');
        }

        $owner->update([
            'password' => Hash::make($request->password),
        ]);

        return back()->with('success', "Password for {$owner->name} ({$owner->email}) has been reset successfully.");
    }

    /**
     * Toggle company active/inactive status.
     */
    public function toggleStatus(Tenant $tenant): RedirectResponse
    {
        $tenant->update([
            'is_active' => ! $tenant->is_active,
        ]);

        $statusLabel = $tenant->is_active ? 'activated' : 'deactivated';

        return back()->with('success', "Company '{$tenant->name}' has been {$statusLabel}.");
    }

    /**
     * Toggle module access (AMS or Payroll) for a company.
     */
    public function toggleModule(Tenant $tenant, string $module): RedirectResponse
    {
        if ($module === 'ams') {
            $tenant->update(['is_ams_enabled' => ! $tenant->is_ams_enabled]);
            $label = $tenant->is_ams_enabled ? 'enabled' : 'disabled';

            return back()->with('success', "Attendance Management System (AMS) {$label} for {$tenant->name}.");
        }

        if ($module === 'payroll') {
            $tenant->update(['is_payroll_enabled' => ! $tenant->is_payroll_enabled]);
            $label = $tenant->is_payroll_enabled ? 'enabled' : 'disabled';

            return back()->with('success', "Payroll & Compliance {$label} for {$tenant->name}.");
        }

        return back()->with('error', 'Invalid module specified.');
    }

    /**
     * Super Admin impersonation of a company.
     */
    public function impersonate(Tenant $tenant): RedirectResponse
    {
        session([
            'impersonated_tenant_id' => $tenant->id,
            'tenant_id' => $tenant->id,
            'tenant_slug' => $tenant->slug,
        ]);

        if (function_exists('setPermissionsTeamId')) {
            setPermissionsTeamId($tenant->id);
        }

        return redirect('/dashboard')->with('success', "Now acting as Company Admin for {$tenant->name}.");
    }

    /**
     * Exit company impersonation and return to Super Admin dashboard.
     */
    public function exitImpersonation(): RedirectResponse
    {
        session()->forget(['impersonated_tenant_id', 'tenant_id', 'tenant_slug']);

        return redirect('/admin/dashboard')->with('success', 'Exited company management session.');
    }
}
