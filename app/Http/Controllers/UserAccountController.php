<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Http\Requests\Users\ResetUserPasswordRequest;
use App\Http\Requests\Users\StoreUserRequest;
use App\Http\Requests\Users\UpdateUserRequest;
use App\Models\Employee;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Inertia\Inertia;
use Inertia\Response;
use Spatie\Permission\Models\Role;

final class UserAccountController extends Controller
{
    /**
     * Display the tenant's user accounts list.
     */
    public function index(Request $request): Response
    {
        /** @var Tenant $tenant */
        $tenant = app('current_tenant');

        if (function_exists('setPermissionsTeamId')) {
            setPermissionsTeamId($tenant->id);
        }

        $search = (string) $request->query('search', '');
        $roleFilter = (string) $request->query('role', '');

        $usersQuery = User::where('tenant_id', $tenant->id)->latest();

        if (! empty($search)) {
            $usersQuery->where(function ($query) use ($search): void {
                $query->where('name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%");
            });
        }

        $users = $usersQuery->get()->map(function (User $user) use ($tenant): array {
            $roles = $user->roles()->wherePivot('team_id', $tenant->id)->pluck('name')->toArray();
            if (empty($roles)) {
                $roles = $user->getRoleNames()->toArray();
            }

            // Check linked employee
            $linkedEmployee = Employee::where('tenant_id', $tenant->id)
                ->where('email', $user->email)
                ->first(['id', 'emp_no', 'full_name', 'designation_id']);

            return [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'is_super_admin' => $user->isSuperAdmin(),
                'is_company_owner' => in_array('Company Owner', $roles, true),
                'roles' => $roles,
                'primary_role' => $roles[0] ?? 'User',
                'linked_employee' => $linkedEmployee !== null ? [
                    'id' => $linkedEmployee->id,
                    'emp_no' => $linkedEmployee->emp_no,
                    'name' => $linkedEmployee->full_name,
                ] : null,
                'created_at' => $user->created_at?->format('Y-m-d H:i'),
            ];
        });

        if (! empty($roleFilter)) {
            $users = $users->filter(function (array $user) use ($roleFilter): bool {
                return in_array($roleFilter, $user['roles'], true);
            })->values();
        }

        /** @var User $currentUser */
        $currentUser = Auth::user();
        $canAssignOwner = $currentUser !== null && ($currentUser->isSuperAdmin() || $currentUser->isCompanyOwner());

        $availableRoles = [
            'Company Admin',
            'HR Manager',
            'HR Executive',
            'Supervisor',
            'Staff',
        ];

        if ($canAssignOwner) {
            array_unshift($availableRoles, 'Company Owner');
        }

        // Metrics for summary cards
        $allTenantUsers = User::where('tenant_id', $tenant->id)->get();
        $adminCount = 0;
        $managerCount = 0;
        $staffCount = 0;

        foreach ($allTenantUsers as $tu) {
            $r = $tu->roles()->wherePivot('team_id', $tenant->id)->pluck('name')->toArray();
            if (empty($r)) {
                $r = $tu->getRoleNames()->toArray();
            }
            if (in_array('Company Owner', $r, true) || in_array('Company Admin', $r, true)) {
                $adminCount++;
            } elseif (in_array('HR Manager', $r, true) || in_array('HR Executive', $r, true) || in_array('Supervisor', $r, true)) {
                $managerCount++;
            } else {
                $staffCount++;
            }
        }

        $metrics = [
            'total_users' => $allTenantUsers->count(),
            'admins_count' => $adminCount,
            'managers_count' => $managerCount,
            'staff_count' => $staffCount,
        ];

        return Inertia::render('Users/Index', [
            'users' => $users,
            'metrics' => $metrics,
            'availableRoles' => $availableRoles,
            'filters' => [
                'search' => $search,
                'role' => $roleFilter,
            ],
            'currentUserId' => Auth::id(),
            'isSuperAdmin' => $currentUser !== null && $currentUser->isSuperAdmin(),
        ]);
    }

    /**
     * Store a new user for the tenant.
     */
    public function store(StoreUserRequest $request): RedirectResponse
    {
        /** @var Tenant $tenant */
        $tenant = app('current_tenant');

        $validated = $request->validated();

        DB::transaction(function () use ($validated, $tenant): void {
            $newUser = User::create([
                'name' => $validated['name'],
                'email' => $validated['email'],
                'password' => Hash::make($validated['password']),
                'tenant_id' => $tenant->id,
                'is_super_admin' => false,
                'email_verified_at' => now(),
            ]);

            if (function_exists('setPermissionsTeamId')) {
                setPermissionsTeamId($tenant->id);
            }

            $newUser->assignRole($validated['role']);
        });

        return back()->with('success', "User '{$validated['name']}' ({$validated['email']}) created successfully.");
    }

    /**
     * Update an existing user's details and role.
     */
    public function update(UpdateUserRequest $request, User $user): RedirectResponse
    {
        /** @var Tenant $tenant */
        $tenant = app('current_tenant');

        /** @var User $currentUser */
        $currentUser = Auth::user();

        // Enforce tenant boundary unless Super Admin
        if ($user->tenant_id !== $tenant->id && ! ($currentUser !== null && $currentUser->isSuperAdmin())) {
            abort(403, 'Unauthorized access to user from another company.');
        }

        $validated = $request->validated();

        DB::transaction(function () use ($validated, $user, $tenant): void {
            $user->update([
                'name' => $validated['name'],
                'email' => $validated['email'],
            ]);

            if (function_exists('setPermissionsTeamId')) {
                setPermissionsTeamId($tenant->id);
            }

            $user->syncRoles([$validated['role']]);
        });

        return back()->with('success', "User account for '{$user->name}' updated successfully.");
    }

    /**
     * Reset password for any user in this tenant.
     */
    public function resetPassword(ResetUserPasswordRequest $request, User $user): RedirectResponse
    {
        /** @var Tenant $tenant */
        $tenant = app('current_tenant');

        /** @var User $currentUser */
        $currentUser = Auth::user();

        // Enforce tenant boundary unless Super Admin
        if ($user->tenant_id !== $tenant->id && ! ($currentUser !== null && $currentUser->isSuperAdmin())) {
            abort(403, 'Unauthorized access to user from another company.');
        }

        // Prevent non-super-admins from modifying a Super Admin account
        if ($user->isSuperAdmin() && ! ($currentUser !== null && $currentUser->isSuperAdmin())) {
            abort(403, 'Only Super Admins can modify Super Admin accounts.');
        }

        $user->update([
            'password' => Hash::make($request->password),
        ]);

        return back()->with('success', "Password for {$user->name} ({$user->email}) has been reset successfully.");
    }

    /**
     * Remove a user account from this tenant.
     */
    public function destroy(User $user): RedirectResponse
    {
        /** @var Tenant $tenant */
        $tenant = app('current_tenant');

        /** @var User $currentUser */
        $currentUser = Auth::user();

        if ($user->tenant_id !== $tenant->id && ! ($currentUser !== null && $currentUser->isSuperAdmin())) {
            abort(403, 'Unauthorized access to user from another company.');
        }

        // Prevent self-deletion
        if ($user->id === Auth::id()) {
            return back()->with('error', 'You cannot delete your own logged-in account.');
        }

        // Prevent non-super-admins from deleting the Company Owner
        if ($user->isCompanyOwner() && ! ($currentUser !== null && $currentUser->isSuperAdmin())) {
            return back()->with('error', 'Company Owner accounts can only be removed or transferred by a Super Admin.');
        }

        $userName = $user->name;
        $userEmail = $user->email;

        $user->delete();

        return back()->with('success', "User account for {$userName} ({$userEmail}) deleted successfully.");
    }
}
