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
     * Standardized Permissions defined in EMS platform (44 total across 8 domains).
     */
    public const PERMISSIONS = [
        // 1. Identity & Access Management (IAM)
        'access-control.view',
        'access-control.manage',
        'user.view',
        'user.manage',

        // 2. Platform & Tenant Governance
        'tenant.view',
        'tenant.manage',
        'audit.view',

        // 3. Organization Structure (M01)
        'company.view',
        'company.update',
        'branch.view',
        'branch.create',
        'branch.update',
        'branch.delete',
        'department.view',
        'department.create',
        'department.update',
        'department.delete',
        'designation.view',
        'designation.create',
        'designation.update',
        'designation.delete',

        // 4. Employee Workforce Master (M01)
        'employee.view',
        'employee.create',
        'employee.update',
        'employee.delete',
        'employee.view-sensitive',

        // 5. Attendance & Roster Engine (M02 - AMS)
        'shift.view',
        'shift.create',
        'shift.update',
        'shift.delete',
        'roster.view',
        'roster.create',
        'roster.update',
        'roster.publish',
        'roster.delete',
        'shift_swap.view',
        'shift_swap.request',
        'shift_swap.approve_department',
        'shift_swap.approve_all',
        'work-calendar.view',
        'work-calendar.manage',
        'attendance.import',
        'attendance.view',
        'attendance.correct',

        // 6. Leave & Absence Management (M02 - AMS)
        'leave.apply',
        'leave.approve',
        'leave.manage-types',

        // 7. Payroll & Statutory Compliance (M03)
        'payroll.view',
        'payroll.run',
        'payroll.approve',
        'payroll.lock',
        'payroll.export',
        'payslip.view',
        'payslip.generate',
        'payslip.download-own',
        'statutory.epf.export',
        'statutory.apit.export',
        'bank.export',
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

        // 3. Company Owner (Tenant Root - Full tenant authority, team_id = null template)
        $companyOwner = Role::firstOrCreate([
            'name' => 'Company Owner',
            'guard_name' => 'web',
            'team_id' => null,
        ]);
        // Owner has everything except platform-level tenant management
        $companyOwner->syncPermissions(array_filter(self::PERMISSIONS, fn ($p) => ! in_array($p, ['tenant.manage'], true)));

        // 4. Company Admin (Operational Administrator)
        $companyAdmin = Role::firstOrCreate([
            'name' => 'Company Admin',
            'guard_name' => 'web',
            'team_id' => null,
        ]);
        $companyAdmin->syncPermissions(array_filter(self::PERMISSIONS, fn ($p) => ! in_array($p, [
            'tenant.manage',
            'tenant.view',
            'branch.delete',
            'department.delete',
            'designation.delete',
        ], true)));

        // 5. HR Manager (Workforce, Attendance, Leave, Payroll)
        $hrManager = Role::firstOrCreate([
            'name' => 'HR Manager',
            'guard_name' => 'web',
            'team_id' => null,
        ]);
        $hrManager->syncPermissions([
            'user.view',
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
            'roster.view',
            'roster.create',
            'roster.update',
            'roster.publish',
            'roster.delete',
            'shift_swap.view',
            'shift_swap.request',
            'shift_swap.approve_department',
            'shift_swap.approve_all',
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
            'payroll.export',
            'payslip.view',
            'payslip.generate',
            'payslip.download-own',
            'statutory.epf.export',
            'statutory.apit.export',
            'bank.export',
        ]);

        // 6. HR Executive (Operations without payroll approve/lock or config deletes)
        $hrExecutive = Role::firstOrCreate([
            'name' => 'HR Executive',
            'guard_name' => 'web',
            'team_id' => null,
        ]);
        $hrExecutive->syncPermissions([
            'user.view',
            'company.view',
            'branch.view',
            'department.view',
            'designation.view',
            'employee.view',
            'employee.create',
            'employee.update',
            'shift.view',
            'roster.view',
            'roster.create',
            'roster.update',
            'work-calendar.view',
            'attendance.import',
            'attendance.view',
            'leave.apply',
            'leave.approve',
            'payroll.view',
            'payslip.view',
            'payslip.download-own',
        ]);

        // 7. Supervisor / Line Manager
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
            'roster.view',
            'work-calendar.view',
            'attendance.view',
            'leave.apply',
            'leave.approve',
            'payslip.download-own',
        ]);

        // 8. Staff (Self-Service)
        $staff = Role::firstOrCreate([
            'name' => 'Staff',
            'guard_name' => 'web',
            'team_id' => null,
        ]);
        $staff->syncPermissions([
            'company.view',
            'employee.view',
            'shift.view',
            'roster.view',
            'work-calendar.view',
            'leave.apply',
            'payslip.download-own',
        ]);

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }
}
