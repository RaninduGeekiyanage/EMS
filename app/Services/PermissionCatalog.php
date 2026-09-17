<?php

declare(strict_types=1);

namespace App\Services;

final class PermissionCatalog
{
    /**
     * Domain definitions with metadata.
     *
     * @var array<string, array{name: string, description: string, icon: string}>
     */
    public const DOMAINS = [
        'iam' => [
            'name' => 'Identity & Access Management (IAM)',
            'description' => 'User directories, role delegation, and fine-grained access control policies',
            'icon' => 'Shield',
        ],
        'governance' => [
            'name' => 'Platform & Tenant Governance',
            'description' => 'Multi-tenant organization provisioning and global audit trails',
            'icon' => 'Globe',
        ],
        'organization' => [
            'name' => 'Organization Structure (M01)',
            'description' => 'Company legal entity, physical branches, departments, and designations',
            'icon' => 'Building2',
        ],
        'workforce' => [
            'name' => 'Workforce & Employees (M01)',
            'description' => 'Employee master records, personal profiles, and sensitive compensation/bank data',
            'icon' => 'Users',
        ],
        'ams' => [
            'name' => 'Attendance & Rosters (M02 - AMS)',
            'description' => 'Shift rosters, calendar holidays, biometric punch import, and daily attendance logs',
            'icon' => 'Clock',
        ],
        'leave' => [
            'name' => 'Leave & Absence Management (M02 - AMS)',
            'description' => 'Leave applications, statutory entitlements, and approval workflows',
            'icon' => 'Palmtree',
        ],
        'payroll' => [
            'name' => 'Payroll & Statutory Compliance (M03)',
            'description' => 'Salary runs, EPF/ETF returns, IRD APIT tax schedules, payslips, and bank exports',
            'icon' => 'DollarSign',
        ],
    ];

    /**
     * Complete standard permissions list with metadata.
     *
     * @var array<string, array{domain: string, name: string, description: string, is_critical: bool}>
     */
    public const PERMISSIONS = [
        // IAM
        'access-control.view' => [
            'domain' => 'iam',
            'name' => 'View Access Control',
            'description' => 'View users, assigned roles, and permission allocation matrices',
            'is_critical' => false,
        ],
        'access-control.manage' => [
            'domain' => 'iam',
            'name' => 'Grant & Revoke Access',
            'description' => 'Assign roles and grant or revoke fine-grained direct permissions',
            'is_critical' => true,
        ],
        'user.view' => [
            'domain' => 'iam',
            'name' => 'View User Directory',
            'description' => 'Browse registered user accounts and their account statuses',
            'is_critical' => false,
        ],
        'user.manage' => [
            'domain' => 'iam',
            'name' => 'Manage User Accounts',
            'description' => 'Create user logins, update profile details, deactivate accounts, and reset passwords',
            'is_critical' => true,
        ],

        // Governance
        'tenant.view' => [
            'domain' => 'governance',
            'name' => 'View Companies / Tenants',
            'description' => 'View cross-company tenant directory and subscription flags (Super Admin)',
            'is_critical' => false,
        ],
        'tenant.manage' => [
            'domain' => 'governance',
            'name' => 'Manage Companies / Tenants',
            'description' => 'Create tenants, activate/deactivate companies, and toggle system modules (Super Admin)',
            'is_critical' => true,
        ],
        'audit.view' => [
            'domain' => 'governance',
            'name' => 'View Audit Trails',
            'description' => 'Inspect managerial overrides, security logs, and compliance trails',
            'is_critical' => false,
        ],

        // Organization
        'company.view' => [
            'domain' => 'organization',
            'name' => 'View Company Profile',
            'description' => 'View company registration, BRN, EPF employer numbers, and contact information',
            'is_critical' => false,
        ],
        'company.update' => [
            'domain' => 'organization',
            'name' => 'Update Company Profile',
            'description' => 'Update company corporate details, addresses, and statutory registration numbers',
            'is_critical' => false,
        ],
        'branch.view' => [
            'domain' => 'organization',
            'name' => 'View Branches',
            'description' => 'Browse company branches and office physical locations',
            'is_critical' => false,
        ],
        'branch.create' => [
            'domain' => 'organization',
            'name' => 'Create Branches',
            'description' => 'Register and configure new physical branches and offices',
            'is_critical' => false,
        ],
        'branch.update' => [
            'domain' => 'organization',
            'name' => 'Update Branches',
            'description' => 'Edit branch addresses, phone numbers, and operational configurations',
            'is_critical' => false,
        ],
        'branch.delete' => [
            'domain' => 'organization',
            'name' => 'Delete Branches',
            'description' => 'Remove company branches from the active organization',
            'is_critical' => true,
        ],
        'department.view' => [
            'domain' => 'organization',
            'name' => 'View Departments',
            'description' => 'Browse organizational business units and departments',
            'is_critical' => false,
        ],
        'department.create' => [
            'domain' => 'organization',
            'name' => 'Create Departments',
            'description' => 'Create new departments and operational cost centers',
            'is_critical' => false,
        ],
        'department.update' => [
            'domain' => 'organization',
            'name' => 'Update Departments',
            'description' => 'Update department names and organizational structure',
            'is_critical' => false,
        ],
        'department.delete' => [
            'domain' => 'organization',
            'name' => 'Delete Departments',
            'description' => 'Remove unused departments from company hierarchy',
            'is_critical' => true,
        ],
        'designation.view' => [
            'domain' => 'organization',
            'name' => 'View Designations',
            'description' => 'Browse corporate job titles, rankings, and designations',
            'is_critical' => false,
        ],
        'designation.create' => [
            'domain' => 'organization',
            'name' => 'Create Designations',
            'description' => 'Add new corporate job titles and designations',
            'is_critical' => false,
        ],
        'designation.update' => [
            'domain' => 'organization',
            'name' => 'Update Designations',
            'description' => 'Modify designation titles and requirements',
            'is_critical' => false,
        ],
        'designation.delete' => [
            'domain' => 'organization',
            'name' => 'Delete Designations',
            'description' => 'Remove job designations from the company roster',
            'is_critical' => true,
        ],

        // Workforce
        'employee.view' => [
            'domain' => 'workforce',
            'name' => 'View Employee Directory',
            'description' => 'View active and archived staff listings, designations, and contact info',
            'is_critical' => false,
        ],
        'employee.create' => [
            'domain' => 'workforce',
            'name' => 'Add New Employees',
            'description' => 'Onboard new personnel and establish corporate employee records',
            'is_critical' => false,
        ],
        'employee.update' => [
            'domain' => 'workforce',
            'name' => 'Edit Employee Profiles',
            'description' => 'Update employee personal, job, designation, and employment terms',
            'is_critical' => false,
        ],
        'employee.delete' => [
            'domain' => 'workforce',
            'name' => 'Delete / Offboard Employees',
            'description' => 'Terminate, delete, or archive employee employment records',
            'is_critical' => true,
        ],
        'employee.view-sensitive' => [
            'domain' => 'workforce',
            'name' => 'View Sensitive Data (Salary/NIC/Bank)',
            'description' => 'Access protected salary figures, bank account numbers, and national identity details',
            'is_critical' => true,
        ],

        // AMS
        'shift.view' => [
            'domain' => 'ams',
            'name' => 'View Shifts & Rosters',
            'description' => 'View work schedules, shift plans, and employee shift assignments',
            'is_critical' => false,
        ],
        'shift.create' => [
            'domain' => 'ams',
            'name' => 'Create Shifts',
            'description' => 'Define new work shifts, hours, grace periods, and break rules',
            'is_critical' => false,
        ],
        'shift.update' => [
            'domain' => 'ams',
            'name' => 'Update Shifts & Roster Assignments',
            'description' => 'Modify shift hours and assign personnel to specific shifts',
            'is_critical' => false,
        ],
        'shift.delete' => [
            'domain' => 'ams',
            'name' => 'Delete Shifts',
            'description' => 'Remove shift configurations from the attendance roster',
            'is_critical' => false,
        ],
        'work-calendar.view' => [
            'domain' => 'ams',
            'name' => 'View Work Calendar',
            'description' => 'View working days, weekends, and public holiday calendars',
            'is_critical' => false,
        ],
        'work-calendar.manage' => [
            'domain' => 'ams',
            'name' => 'Manage Calendar & Holidays',
            'description' => 'Seed and configure Sri Lankan statutory holidays and working calendar days',
            'is_critical' => false,
        ],
        'attendance.import' => [
            'domain' => 'ams',
            'name' => 'Import Biometrics',
            'description' => 'Upload CSV/Excel biometric punch files and map biometric employee IDs',
            'is_critical' => false,
        ],
        'attendance.view' => [
            'domain' => 'ams',
            'name' => 'View Attendance Ledger',
            'description' => 'Browse daily punch logs, clock-in times, late flags, and overtime tallies',
            'is_critical' => false,
        ],
        'attendance.correct' => [
            'domain' => 'ams',
            'name' => 'Attendance Corrections & OT Approval',
            'description' => 'Manually edit attendance timestamps, approve overtime hours, and adjust no-pay statuses',
            'is_critical' => true,
        ],

        // Leave
        'leave.apply' => [
            'domain' => 'leave',
            'name' => 'Apply for Leave',
            'description' => 'Submit leave requests for self or on behalf of employees',
            'is_critical' => false,
        ],
        'leave.approve' => [
            'domain' => 'leave',
            'name' => 'Approve / Reject Leave',
            'description' => 'Review, approve, or reject employee leave applications',
            'is_critical' => false,
        ],
        'leave.manage-types' => [
            'domain' => 'leave',
            'name' => 'Configure Leave Types & Policies',
            'description' => 'Configure statutory annual, casual, and medical leave allocations',
            'is_critical' => false,
        ],

        // Payroll
        'payroll.view' => [
            'domain' => 'payroll',
            'name' => 'View Payroll Runs',
            'description' => 'Browse draft, pending, approved, and closed monthly payroll runs',
            'is_critical' => false,
        ],
        'payroll.run' => [
            'domain' => 'payroll',
            'name' => 'Execute / Recalculate Payroll',
            'description' => 'Trigger automated monthly wage calculations and batch recomputations',
            'is_critical' => true,
        ],
        'payroll.approve' => [
            'domain' => 'payroll',
            'name' => 'Approve Payroll Batch',
            'description' => 'Managerial sign-off and approval of audited salary computations',
            'is_critical' => true,
        ],
        'payroll.lock' => [
            'domain' => 'payroll',
            'name' => 'Lock Payroll Batch',
            'description' => 'Permanently freeze a payroll batch to prevent future recomputations or edits',
            'is_critical' => true,
        ],
        'payroll.export' => [
            'domain' => 'payroll',
            'name' => 'Export Payroll Summaries',
            'description' => 'Export master payroll salary sheets and deduction variance files',
            'is_critical' => false,
        ],
        'payslip.view' => [
            'domain' => 'payroll',
            'name' => 'View All Employee Payslips',
            'description' => 'Inspect comprehensive individual payslips for all company employees',
            'is_critical' => true,
        ],
        'payslip.generate' => [
            'domain' => 'payroll',
            'name' => 'Generate / Disburse Payslips',
            'description' => 'Bulk render PDF payslips and enable digital payslip distribution',
            'is_critical' => false,
        ],
        'payslip.download-own' => [
            'domain' => 'payroll',
            'name' => 'Download Own Payslip',
            'description' => 'Staff self-service access to view and download their personal payslips',
            'is_critical' => false,
        ],
        'statutory.epf.export' => [
            'domain' => 'payroll',
            'name' => 'Export EPF / ETF Returns',
            'description' => 'Generate Central Bank Form C monthly schedules and ETF electronic returns',
            'is_critical' => true,
        ],
        'statutory.apit.export' => [
            'domain' => 'payroll',
            'name' => 'Export APIT Tax Schedules',
            'description' => 'Generate Sri Lanka Inland Revenue Department Advance Personal Income Tax returns',
            'is_critical' => true,
        ],
        'bank.export' => [
            'domain' => 'payroll',
            'name' => 'Generate Bank Disbursal Files',
            'description' => 'Export commercial bank SLIPS / CEFT bulk salary disbursement files',
            'is_critical' => true,
        ],
    ];

    /**
     * Get grouped permissions structured by domain with domain metadata.
     *
     * @return array<string, array{domain_key: string, name: string, description: string, icon: string, permissions: array<int, array{key: string, name: string, description: string, is_critical: bool}>}>
     */
    public static function getGrouped(): array
    {
        $grouped = [];

        foreach (self::DOMAINS as $domainKey => $domainMeta) {
            $domainPermissions = [];

            foreach (self::PERMISSIONS as $permKey => $permMeta) {
                if ($permMeta['domain'] === $domainKey) {
                    $domainPermissions[] = [
                        'key' => $permKey,
                        'name' => $permMeta['name'],
                        'description' => $permMeta['description'],
                        'is_critical' => $permMeta['is_critical'],
                    ];
                }
            }

            $grouped[$domainKey] = [
                'domain_key' => $domainKey,
                'name' => $domainMeta['name'],
                'description' => $domainMeta['description'],
                'icon' => $domainMeta['icon'],
                'permissions' => $domainPermissions,
            ];
        }

        return $grouped;
    }

    /**
     * Get the available roles in standard hierarchy order.
     *
     * @return array<int, string>
     */
    public static function getAvailableRoles(bool $includeOwner = true): array
    {
        $roles = [
            'Company Admin',
            'HR Manager',
            'HR Executive',
            'Supervisor',
            'Staff',
        ];

        if ($includeOwner) {
            array_unshift($roles, 'Company Owner');
        }

        return $roles;
    }
}
