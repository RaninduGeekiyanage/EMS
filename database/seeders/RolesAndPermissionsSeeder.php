<?php

declare(strict_types=1);

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

final class RolesAndPermissionsSeeder extends Seeder
{
    /**
     * Permissions defined in M01 Master Module.
     */
    public const PERMISSIONS = [
        // Company
        'company.view',
        'company.update',

        // Branches
        'branch.view',
        'branch.create',
        'branch.update',
        'branch.delete',

        // Departments
        'department.view',
        'department.create',
        'department.update',
        'department.delete',

        // Designations
        'designation.view',
        'designation.create',
        'designation.update',
        'designation.delete',

        // Employees
        'employee.view',
        'employee.create',
        'employee.update',
        'employee.delete',
        'employee.view-sensitive',
    ];

    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Reset cached roles and permissions
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        // 1. Create all Permissions
        foreach (self::PERMISSIONS as $permissionName) {
            Permission::firstOrCreate([
                'name' => $permissionName,
                'guard_name' => 'web',
            ]);
        }

        // 2. Create Global Roles (team_id = null)
        $superAdmin = Role::firstOrCreate([
            'name' => 'Super Admin',
            'guard_name' => 'web',
            'team_id' => null,
        ]);
        $superAdmin->syncPermissions(Permission::all());

        $hrManager = Role::firstOrCreate([
            'name' => 'HR Manager',
            'guard_name' => 'web',
            'team_id' => null,
        ]);
        $hrManager->syncPermissions(self::PERMISSIONS);

        $hrExecutive = Role::firstOrCreate([
            'name' => 'HR Executive',
            'guard_name' => 'web',
            'team_id' => null,
        ]);
        $hrExecutive->syncPermissions([
            'company.view',
            'branch.view',
            'department.view',
            'designation.view',
            'employee.view',
            'employee.create',
            'employee.update',
        ]);

        $staff = Role::firstOrCreate([
            'name' => 'Staff',
            'guard_name' => 'web',
            'team_id' => null,
        ]);
        $staff->syncPermissions([
            'company.view',
            'employee.view',
        ]);
    }
}
