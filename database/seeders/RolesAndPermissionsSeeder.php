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
     * Permissions defined in EMS platform.
     */
    public const PERMISSIONS = [
        // Platform & User Management
        'tenant.manage',
        'user.manage',

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

        // M02 Shifts & Work Calendars
        'shift.view',
        'shift.create',
        'shift.update',
        'shift.delete',
        'work-calendar.view',
        'work-calendar.manage',

        // M02 Biometric & Attendance Ingestion
        'attendance.import',
        'attendance.view',
        'attendance.correct',

        // M02 Leave Management
        'leave.apply',
        'leave.approve',
        'leave.manage-types',

        // M03 Payroll
        'payroll.view',
        'payroll.run',
        'payroll.approve',
        'payroll.export',
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

        // 2. Super Admin (Global Platform Owner, team_id = null)
        $superAdmin = Role::firstOrCreate([
            'name' => 'Super Admin',
            'guard_name' => 'web',
            'team_id' => null,
        ]);
        $superAdmin->syncPermissions(Permission::all());

        // 3. Company Owner (Tenant Root - Full tenant authority)
        $companyOwner = Role::firstOrCreate([
            'name' => 'Company Owner',
            'guard_name' => 'web',
            'team_id' => null,
        ]);
        $companyOwner->syncPermissions(self::PERMISSIONS);

        // 4. Company Admin (Operational Administrator)
        $companyAdmin = Role::firstOrCreate([
            'name' => 'Company Admin',
            'guard_name' => 'web',
            'team_id' => null,
        ]);
        $companyAdmin->syncPermissions(array_filter(self::PERMISSIONS, fn ($p) => $p !== 'tenant.manage'));

        // 5. HR Manager (Workforce, Attendance, Payroll)
        $hrManager = Role::firstOrCreate([
            'name' => 'HR Manager',
            'guard_name' => 'web',
            'team_id' => null,
        ]);
        $hrManager->syncPermissions([
            'company.view',
            'branch.view',
            'department.view',
            'designation.view',
            'employee.view',
            'employee.create',
            'employee.update',
            'employee.delete',
            'employee.view-sensitive',
            'shift.view',
            'shift.create',
            'shift.update',
            'work-calendar.view',
            'work-calendar.manage',
            'attendance.import',
            'attendance.view',
            'attendance.correct',
            'leave.apply',
            'leave.approve',
            'leave.manage-types',
            'payroll.view',
            'payroll.run',
            'payroll.approve',
            'payroll.export',
        ]);

        // 6. Supervisor / Line Manager
        $supervisor = Role::firstOrCreate([
            'name' => 'Supervisor',
            'guard_name' => 'web',
            'team_id' => null,
        ]);
        $supervisor->syncPermissions([
            'company.view',
            'department.view',
            'employee.view',
            'shift.view',
            'work-calendar.view',
            'attendance.view',
            'leave.apply',
            'leave.approve',
        ]);

        // 7. Staff (Self-Service)
        $staff = Role::firstOrCreate([
            'name' => 'Staff',
            'guard_name' => 'web',
            'team_id' => null,
        ]);
        $staff->syncPermissions([
            'company.view',
            'employee.view',
            'shift.view',
            'work-calendar.view',
            'leave.apply',
        ]);
    }
}
