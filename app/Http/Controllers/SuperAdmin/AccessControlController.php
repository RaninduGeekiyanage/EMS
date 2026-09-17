<?php

declare(strict_types=1);

namespace App\Http\Controllers\SuperAdmin;

use App\Http\Controllers\Controller;
use App\Http\Requests\AccessControl\UpdateUserAccessRequest;
use App\Models\Tenant;
use App\Models\User;
use App\Services\PermissionCatalog;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

final class AccessControlController extends Controller
{
    /**
     * Display the Global Super Admin Access Control management portal.
     */
    public function index(Request $request): Response
    {
        /** @var User|null $currentUser */
        $currentUser = Auth::user();

        if ($currentUser === null || ! $currentUser->isSuperAdmin()) {
            abort(403, 'Unauthorized. Super Admin privileges required.');
        }

        $allTenants = Tenant::withCount('users')->orderBy('name')->get();

        $selectedTenantId = (string) $request->query('tenant_id', '');
        $selectedTenant = null;

        if (! empty($selectedTenantId)) {
            $selectedTenant = $allTenants->firstWhere('id', $selectedTenantId);
        }

        if ($selectedTenant === null && $allTenants->isNotEmpty()) {
            $selectedTenant = $allTenants->firstWhere('is_active', true) ?? $allTenants->first();
        }

        $users = [];
        $selectedUserId = $request->query('user_id') ? (int) $request->query('user_id') : null;

        if ($selectedTenant !== null) {
            if (function_exists('setPermissionsTeamId')) {
                setPermissionsTeamId($selectedTenant->id);
            }

            $search = (string) $request->query('search', '');
            $usersQuery = User::where('tenant_id', $selectedTenant->id)->latest();

            if (! empty($search)) {
                $usersQuery->where(function ($q) use ($search): void {
                    $q->where('name', 'like', "%{$search}%")
                        ->orWhere('email', 'like', "%{$search}%");
                });
            }

            $users = $usersQuery->get()->map(function (User $user) use ($selectedTenant): array {
                $roles = $user->roles()->wherePivot('team_id', $selectedTenant->id)->pluck('name')->toArray();
                if (empty($roles)) {
                    $roles = $user->getRoleNames()->toArray();
                }

                $directPerms = $user->getDirectPermissions()->pluck('name')->toArray();
                $viaRolesPerms = $user->getPermissionsViaRoles()->pluck('name')->toArray();

                return [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'is_super_admin' => $user->isSuperAdmin(),
                    'is_company_owner' => in_array('Company Owner', $roles, true),
                    'roles' => $roles,
                    'primary_role' => $roles[0] ?? 'Staff',
                    'direct_permissions' => $directPerms,
                    'inherited_permissions' => $viaRolesPerms,
                    'effective_permissions' => array_values(array_unique(array_merge($viaRolesPerms, $directPerms))),
                    'has_custom_overrides' => ! empty($directPerms),
                    'created_at' => $user->created_at?->format('Y-m-d H:i'),
                ];
            })->values()->all();
        }

        // Standard role permissions map
        $rolePermissionsMap = [];
        $rolesCollection = Role::with('permissions')->get();
        foreach ($rolesCollection as $role) {
            $rolePermissionsMap[$role->name] = $role->permissions->pluck('name')->toArray();
        }

        return Inertia::render('SuperAdmin/AccessControl', [
            'tenants' => $allTenants->map(fn (Tenant $t): array => [
                'id' => $t->id,
                'name' => $t->name,
                'slug' => $t->slug,
                'is_active' => (bool) $t->is_active,
                'is_ams_enabled' => (bool) $t->is_ams_enabled,
                'is_payroll_enabled' => (bool) $t->is_payroll_enabled,
                'users_count' => $t->users_count,
            ]),
            'selectedTenant' => $selectedTenant !== null ? [
                'id' => $selectedTenant->id,
                'name' => $selectedTenant->name,
                'slug' => $selectedTenant->slug,
                'is_active' => (bool) $selectedTenant->is_active,
                'is_ams_enabled' => (bool) $selectedTenant->is_ams_enabled,
                'is_payroll_enabled' => (bool) $selectedTenant->is_payroll_enabled,
            ] : null,
            'users' => $users,
            'selectedUserId' => $selectedUserId ?? ($users[0]['id'] ?? null),
            'rolePermissionsMap' => $rolePermissionsMap,
            'groupedPermissions' => PermissionCatalog::getGrouped(),
            'availableRoles' => PermissionCatalog::getAvailableRoles(true),
            'filters' => [
                'tenant_id' => $selectedTenant?->id,
                'search' => $request->query('search', ''),
            ],
        ]);
    }

    /**
     * Update access control (role & direct permissions) for a user in any tenant.
     */
    public function update(UpdateUserAccessRequest $request, Tenant $tenant, User $user): RedirectResponse
    {
        /** @var User|null $currentUser */
        $currentUser = Auth::user();

        if ($currentUser === null || ! $currentUser->isSuperAdmin()) {
            abort(403, 'Unauthorized. Super Admin privileges required.');
        }

        $validated = $request->validated();
        $targetRole = (string) $validated['role'];
        $directPermissions = (array) ($validated['direct_permissions'] ?? []);

        DB::transaction(function () use ($tenant, $user, $targetRole, $directPermissions): void {
            if (function_exists('setPermissionsTeamId')) {
                setPermissionsTeamId($tenant->id);
            }

            // Sync primary role for this company
            $user->syncRoles([$targetRole]);

            // Sync direct permissions for this company
            $user->syncPermissions($directPermissions);

            app(PermissionRegistrar::class)->forgetCachedPermissions();
        });

        return back()->with('success', "Access permissions for '{$user->name}' in company '{$tenant->name}' updated successfully.");
    }

    /**
     * Reset a user in any company strictly to their assigned role's default baseline.
     */
    public function resetToRole(Request $request, Tenant $tenant, User $user): RedirectResponse
    {
        /** @var User|null $currentUser */
        $currentUser = Auth::user();

        if ($currentUser === null || ! $currentUser->isSuperAdmin()) {
            abort(403, 'Unauthorized. Super Admin privileges required.');
        }

        DB::transaction(function () use ($tenant, $user): void {
            if (function_exists('setPermissionsTeamId')) {
                setPermissionsTeamId($tenant->id);
            }

            $user->syncPermissions([]);

            app(PermissionRegistrar::class)->forgetCachedPermissions();
        });

        return back()->with('success', "Direct custom permissions cleared. '{$user->name}' reset to baseline role defaults in {$tenant->name}.");
    }
}
