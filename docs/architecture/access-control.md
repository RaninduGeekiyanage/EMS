# Access Control & Permissions Architecture

## 1. System Overview
The EMS Access Control subsystem provides enterprise-grade, multi-tenant Role-Based Access Control (RBAC) augmented with fine-grained direct permission grants. The engine is powered by `spatie/laravel-permission` configured with multi-tenancy teams (`teams = true`), ensuring complete isolation between distinct tenant organizations.

---

## 2. Core Security Model

### 2.1 Multi-Tenant Team Resolution
- All role queries, role assignments, and direct permission assignments are scoped by `team_id = tenant.id`.
- Tenant context is initialized via `setPermissionsTeamId($tenant->id)`.
- Global Super Admin accounts (`is_super_admin = true` or `ranindu.rag@gmail.com`) have platform-wide bypass authority across all tenant boundaries.

### 2.2 Hybrid RBAC + Direct Granular Overrides
The system operates on a dual-tier permission model:
1. **Base Organizational Roles**: Provide default permission bundles matching standard corporate responsibilities.
2. **Direct Permission Overrides**: Enable administrators to grant or revoke specific individual capabilities for a user without having to create dozens of one-off custom roles.

Visual indicators in both the Super Admin and Tenant portals distinguish the permission origin:
- 🟢 **Role Inherited**: Granted automatically by the user's primary role.
- 🔵 **Direct Grant**: Specifically granted as a customized individual override.
- ⚪ **Disabled**: Not granted.

---

## 3. Standardized Permission Catalog (44 Capabilities across 8 Domains)

### 3.1 Domain 1: Identity & Access Management (IAM)
- `access-control.view`: View user access control directory, assigned roles, and permission matrix.
- `access-control.manage`: Assign roles and grant or revoke fine-grained direct permissions (*Critical*).
- `user.view`: Browse registered user accounts and account statuses.
- `user.manage`: Create user logins, update profile details, deactivate accounts, and reset passwords (*Critical*).

### 3.2 Domain 2: Platform & Tenant Governance (Global)
- `tenant.view`: View tenant listings, statistics, and module subscription flags.
- `tenant.manage`: Provision tenants, toggle AMS/Payroll modules, activate/deactivate companies (*Critical*).
- `audit.view`: Inspect system audit trails, managerial overrides, and security logs.

### 3.3 Domain 3: Organization Structure (M01)
- `company.view`: View company corporate profile and EPF/ETF registration numbers.
- `company.update`: Update corporate legal and contact information.
- `branch.view`: Browse company physical branches and offices.
- `branch.create`: Register and configure new branches.
- `branch.update`: Modify branch details and geo-locations.
- `branch.delete`: Remove company branches (*Critical*).
- `department.view`: Browse corporate departments and cost centers.
- `department.create`: Add new business units.
- `department.update`: Update department names and structure.
- `department.delete`: Remove unused departments (*Critical*).
- `designation.view`: View corporate job designations and titles.
- `designation.create`: Create new designations.
- `designation.update`: Update designation specifications.
- `designation.delete`: Remove job designations (*Critical*).

### 3.4 Domain 4: Workforce & Employees (M01)
- `employee.view`: View staff directory and employment profiles.
- `employee.create`: Onboard employees and establish corporate employee records.
- `employee.update`: Update employee profile, designation, and employment terms.
- `employee.delete`: Terminate or remove employee records (*Critical*).
- `employee.view-sensitive`: Access protected salary amounts, bank accounts, and NIC documents (*Critical*).

### 3.5 Domain 5: Attendance & Roster Engine (M02 - AMS)
- `shift.view`: View assigned shift schedules and rosters.
- `shift.create`: Define work shift hours, grace periods, and break rules.
- `shift.update`: Modify shift parameters and assign staff to shifts.
- `shift.delete`: Remove shift configurations from the roster.
- `work-calendar.view`: View work calendar, working days, and public holidays.
- `work-calendar.manage`: Configure Sri Lankan statutory holidays and work calendar settings.
- `attendance.import`: Upload CSV/Excel biometric punch files and map biometric employee IDs.
- `attendance.view`: Browse daily attendance records, punch timestamps, and overtime tallies.
- `attendance.correct`: Manually edit attendance timestamps, approve overtime hours (*Critical*).

### 3.6 Domain 6: Leave & Absence Management (M02 - AMS)
- `leave.apply`: Submit personal leave requests or requests on behalf of staff.
- `leave.approve`: Review, approve, or reject employee leave applications.
- `leave.manage-types`: Configure statutory annual, casual, and medical leave allocation rules.

### 3.7 Domain 7: Payroll & Statutory Compliance (M03)
- `payroll.view`: View draft, pending, approved, and locked payroll runs.
- `payroll.run`: Execute automated salary calculations and batch recomputations (*Critical*).
- `payroll.approve`: Managerial sign-off and approval of audited salary computations (*Critical*).
- `payroll.lock`: Permanently freeze a finalized payroll run against future edits (*Critical*).
- `payroll.export`: Export master payroll salary summaries and deduction variance reports.
- `payslip.view`: Inspect individual payslips for all company employees (*Critical*).
- `payslip.generate`: Bulk render PDF payslips and initiate distribution.
- `payslip.download-own`: Staff self-service download of personal payslips.
- `statutory.epf.export`: Generate Central Bank Form C monthly schedules and ETF electronic returns (*Critical*).
- `statutory.apit.export`: Generate IRD Advance Personal Income Tax schedules (*Critical*).
- `bank.export`: Generate commercial bank SLIPS / CEFT bulk salary transfer files (*Critical*).

---

## 4. Baseline Role Definitions

| Role | Target Hierarchy | Standard Capabilities |
|---|---|---|
| **Super Admin** | Platform Owner | Global bypass, cross-tenant provisioning, full access to all 44 permissions across all tenants. |
| **Company Owner** | Tenant Root Executive | Full authority within tenant organization (all permissions except `tenant.manage`). |
| **Company Admin** | Operational Administrator | Comprehensive administrative access excluding company deletion and platform governance. |
| **HR Manager** | Workforce & Payroll Lead | Full workforce onboarding, AMS shift management, leave approvals, payroll execution & exports. |
| **HR Executive** | Operations Officer | Workforce profile maintenance, biometric ingestion, leave reviews, and payroll review. |
| **Supervisor** | Line Manager | Departmental staff visibility, shift schedule viewing, attendance viewing, and leave approvals. |
| **Staff** | Self-Service Employee | Personal profile viewing, shift viewing, personal leave application, personal payslip download. |

---

## 5. Dual-Layer Protection Guardrails

### 5.1 Backend Guardrails
- **Tenant Scope Isolation**: Strict multi-tenant boundaries via `setPermissionsTeamId($tenant->id)`. A tenant administrator cannot query or modify users in another organization.
- **Anti-Privilege Escalation**:
  - Tenant administrators cannot assign the global `Super Admin` role or grant `tenant.manage`.
  - Non-owner administrators cannot assign the `Company Owner` role without being an existing owner or Super Admin.
- **Anti-Self-Lockout**:
  - Administrators cannot revoke their own `access-control.manage` or `user.manage` permissions.
  - Administrators cannot demote their own administrative role.
- **Super Admin Immutability**:
  - Super Admin accounts cannot be viewed, altered, or demoted from tenant portals.
- **Atomic Operations**:
  - Role synchronization and permission synchronization execute within a database transaction (`DB::transaction`).

### 5.2 Frontend Safeguards
- **Interactive Matrix**: Visual cues for inherited role permissions vs direct grants vs disabled states.
- **Confirmation Diff Modal**: Highlighting exact changes, affected user, and company scope before committing updates.
- **Reset to Role Defaults**: Quick single-click revert clearing all custom overrides back to baseline role.
- **Self-Editing Disabled Controls**: Automatic locking of self-revocation switches with explanatory tooltips.
