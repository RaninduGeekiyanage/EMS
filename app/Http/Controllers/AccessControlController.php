<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Http\Requests\AccessControl\UpdateUserAccessRequest;
use App\Models\Department;
use App\Models\Employee;
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
     * Standard HOD authority permission keys.
     *
     * @var array<int, string>
     */
    public const HOD_PERMISSIONS = [
        'attendance.hod_approve_regularization',
        'attendance.hod_approve_ot',
        'shift_swap.approve_department',
        'leave.approve',
        'evaluation.hod_submit',
        'attendance.period_freeze',
    ];

    /**
     * Display the Access Control & Permissions management page for the current tenant.
     */
    public function index(Request $request): Response
    {
        /** @var Tenant $tenant */
        $tenant = app('current_tenant');

        if (function_exists('setPermissionsTeamId')) {
            setPermissionsTeamId($tenant->id);
        }

        /** @var User|null $currentUser */
        $currentUser = Auth::user();

        // Enforce authorization to view access control
        if ($currentUser === null || (! $currentUser->isSuperAdmin() && ! $currentUser->isCompanyOwner() && ! $currentUser->can('access-control.view') && ! $currentUser->can('user.view'))) {
            abort(403, 'Unauthorized access to organization access control.');
        }

        $canManageAccess = $currentUser->isSuperAdmin()
            || $currentUser->isCompanyOwner()
            || $currentUser->can('access-control.manage')
            || $currentUser->can('user.manage');

        $canAssignOwner = $currentUser->isSuperAdmin() || $currentUser->isCompanyOwner();

        $search = (string) $request->query('search', '');
        $selectedUserId = $request->query('user_id') ? (int) $request->query('user_id') : null;

        $usersQuery = User::where('tenant_id', $tenant->id)->latest();

        if (! empty($search)) {
            $usersQuery->where(function ($q) use ($search): void {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%");
            });
        }

        $users = $usersQuery->get()->map(function (User $user) use ($tenant): array {
            $roles = $user->roles()->wherePivot('team_id', $tenant->id)->pluck('name')->toArray();
            if (empty($roles)) {
                $roles = $user->getRoleNames()->toArray();
            }

            $directPerms = $user->getDirectPermissions()->pluck('name')->toArray();
            $viaRolesPerms = $user->getPermissionsViaRoles()->pluck('name')->toArray();
            $allPerms = $user->getAllPermissions()->pluck('name')->toArray();

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
        });

        // Preload standard role permissions map
        $rolePermissionsMap = [];
        $rolesCollection = Role::with('permissions')->get();
        foreach ($rolesCollection as $role) {
            $rolePermissionsMap[$role->name] = $role->permissions->pluck('name')->toArray();
        }

        $metrics = [
            'total_users' => $users->count(),
            'admins_count' => $users->filter(fn ($u) => in_array('Company Owner', $u['roles'], true) || in_array('Company Admin', $u['roles'], true))->count(),
            'custom_overrides_count' => $users->filter(fn ($u) => $u['has_custom_overrides'])->count(),
        ];

        $departments = Department::where('tenant_id', $tenant->id)
            ->with(['departmentHead.employee'])
            ->orderBy('name')
            ->get()
            ->map(function (Department $dept) use ($tenant): array {
                $head = $dept->departmentHead;
                $employee = $head?->employee;
                $user = null;
                $hodPermissions = [];
                $isFullyAuthorized = false;

                if ($employee && $employee->email) {
                    $user = User::where('tenant_id', $tenant->id)
                        ->where('email', $employee->email)
                        ->first();

                    if ($user !== null) {
                        foreach (self::HOD_PERMISSIONS as $perm) {
                            $hodPermissions[$perm] = $user->can($perm);
                        }
                        $isFullyAuthorized = ! in_array(false, $hodPermissions, true);
                    }
                }

                return [
                    'id' => $dept->id,
                    'name' => $dept->name,
                    'code' => $dept->code ?? null,
                    'head' => $head ? [
                        'id' => $head->id,
                        'appointed_at' => $head->appointed_at?->format('Y-m-d'),
                        'employee_id' => $employee?->id,
                        'employee_name' => $employee?->full_name,
                        'employee_emp_no' => $employee?->emp_no,
                        'employee_email' => $employee?->email,
                        'user' => $user ? [
                            'id' => $user->id,
                            'name' => $user->name,
                            'email' => $user->email,
                            'primary_role' => $user->roles()->wherePivot('team_id', $tenant->id)->first()?->name ?? 'Staff',
                            'hod_permissions' => $hodPermissions,
                            'is_fully_authorized' => $isFullyAuthorized,
                        ] : null,
                    ] : null,
                ];
            });

        $employeesForHodSelect = Employee::where('tenant_id', $tenant->id)
            ->where('employment_status', 'active')
            ->orderBy('full_name')
            ->get(['id', 'emp_no', 'full_name', 'email', 'department_id']);

        return Inertia::render('AccessControl/Index', [
            'users' => $users,
            'selectedUserId' => $selectedUserId ?? ($users->first()['id'] ?? null),
            'rolePermissionsMap' => $rolePermissionsMap,
            'groupedPermissions' => PermissionCatalog::getGrouped(),
            'availableRoles' => PermissionCatalog::getAvailableRoles($canAssignOwner),
            'departmentHeads' => $departments,
            'employeesForHodSelect' => $employeesForHodSelect,
            'hodPermissionsList' => self::HOD_PERMISSIONS,
            'metrics' => $metrics,
            'canManageAccess' => $canManageAccess,
            'currentUserId' => Auth::id(),
            'isSuperAdmin' => $currentUser->isSuperAdmin(),
            'filters' => [
                'search' => $search,
            ],
        ]);
    }

    /**
     * Update or toggle HOD authority approval rights for a user.
     */
    public function updateHodAuthority(Request $request, User $user): RedirectResponse
    {
        /** @var Tenant $tenant */
        $tenant = app('current_tenant');

        /** @var User $currentUser */
        $currentUser = Auth::user();

        if ($currentUser === null || (! $currentUser->isSuperAdmin() && ! $currentUser->isCompanyOwner() && ! $currentUser->can('access-control.manage'))) {
            abort(403, 'Unauthorized to manage HOD approval rights.');
        }

        if ($user->tenant_id !== $tenant->id && ! $currentUser->isSuperAdmin()) {
            abort(403, 'Unauthorized access to user from another organization.');
        }

        $validated = $request->validate([
            'action' => ['required', 'string', 'in:grant_all,revoke_all,toggle'],
            'permission' => ['nullable', 'string'],
            'enabled' => ['nullable', 'boolean'],
        ]);

        DB::transaction(function () use ($tenant, $user, $validated): void {
            if (function_exists('setPermissionsTeamId')) {
                setPermissionsTeamId($tenant->id);
            }

            $currentDirect = $user->getDirectPermissions()->pluck('name')->toArray();

            if ($validated['action'] === 'grant_all') {
                $updatedDirect = array_values(array_unique(array_merge($currentDirect, self::HOD_PERMISSIONS)));
                $user->syncPermissions($updatedDirect);
            } elseif ($validated['action'] === 'revoke_all') {
                $updatedDirect = array_values(array_diff($currentDirect, self::HOD_PERMISSIONS));
                $user->syncPermissions($updatedDirect);
            } elseif ($validated['action'] === 'toggle') {
                $targetPerm = (string) $validated['permission'];
                $enable = (bool) ($validated['enabled'] ?? false);

                if ($enable) {
                    if (! in_array($targetPerm, $currentDirect, true)) {
                        $currentDirect[] = $targetPerm;
                    }
                } else {
                    $currentDirect = array_values(array_diff($currentDirect, [$targetPerm]));
                }
                $user->syncPermissions($currentDirect);
            }

            app(PermissionRegistrar::class)->forgetCachedPermissions();
        });

        return back()->with('success', "HOD authority rights for '{$user->name}' updated successfully.");
    }

    /**
     * Update roles and fine-grained direct permissions for a user within current tenant.
     */
    public function update(UpdateUserAccessRequest $request, User $user): RedirectResponse
    {
        /** @var Tenant $tenant */
        $tenant = app('current_tenant');

        /** @var User $currentUser */
        $currentUser = Auth::user();

        // Enforce tenant boundary
        if ($user->tenant_id !== $tenant->id && ! $currentUser->isSuperAdmin()) {
            abort(403, 'Unauthorized access to user from another organization.');
        }

        $validated = $request->validated();
        $targetRole = (string) $validated['role'];
        $directPermissions = (array) ($validated['direct_permissions'] ?? []);

        DB::transaction(function () use ($tenant, $user, $targetRole, $directPermissions): void {
            if (function_exists('setPermissionsTeamId')) {
                setPermissionsTeamId($tenant->id);
            }

            // Sync role for this team
            $user->syncRoles([$targetRole]);

            // Sync direct permissions for this team
            $user->syncPermissions($directPermissions);

            app(PermissionRegistrar::class)->forgetCachedPermissions();
        });

        return back()->with('success', "Access permissions and role for '{$user->name}' updated successfully.");
    }

    /**
     * Reset a user's permissions strictly to their assigned role's default baseline.
     */
    public function resetToRole(Request $request, User $user): RedirectResponse
    {
        /** @var Tenant $tenant */
        $tenant = app('current_tenant');

        /** @var User $currentUser */
        $currentUser = Auth::user();

        if ($user->tenant_id !== $tenant->id && ! $currentUser->isSuperAdmin()) {
            abort(403, 'Unauthorized access to user from another organization.');
        }

        if (! $currentUser->isSuperAdmin() && ! $currentUser->isCompanyOwner() && ! $currentUser->can('access-control.manage')) {
            abort(403, 'Unauthorized to reset user permissions.');
        }

        DB::transaction(function () use ($tenant, $user): void {
            if (function_exists('setPermissionsTeamId')) {
                setPermissionsTeamId($tenant->id);
            }

            // Clear all custom direct permissions
            $user->syncPermissions([]);

            app(PermissionRegistrar::class)->forgetCachedPermissions();
        });

        return back()->with('success', "Direct custom permissions cleared. '{$user->name}' reset to baseline role defaults.");
    }
}
