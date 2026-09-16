# M00 — Core Foundation Module: Authentication, Super Admin Platform & Tenant Dashboard

## 1. Module Overview
**M00** is the foundational system shell for the Enterprise Management System (EMS). It provides:
1. **Multi-Tenant Authentication & Zero-Friction Login**: Users authenticate using Email and Password only; the platform automatically detects their tenant context, applies team-scoped RBAC, and routes them to their designated workspace.
2. **Super Admin Platform (`/admin/dashboard`)**: A global administration hub allowing Super Admins (`tenant_id = null`) to provision new Companies (Tenants), assign Company Owners, reset Company Owner passwords, toggle module availability per tenant (AMS, Payroll), and enter any company environment via secure **Impersonation** with a prominent exit banner.
3. **Industry-Standard Role Hierarchy**:
   - `Super Admin` (Global Root)
   - `Company Owner` (Tenant Root: configuration, admin accounts, billing/modules)
   - `Company Admin` (Operational Administrator: branches, departments, employees, settings)
   - `HR Manager` (Workforce Operations: shifts, biometric logs, attendance ledger, leave approval, payroll)
   - `Supervisor` (Department-level leave approvals and team shift viewing)
   - `Staff` (Self-Service: personal profile, leave application, payslips)
4. **Responsive App Shell (`AuthenticatedLayout`)**: Persistent collapsible desktop sidebar, responsive off-canvas mobile drawer, top navigation bar with tenant indicator and profile menu, and conditional module visibility.
5. **Central Executive Tenant Dashboard (`/dashboard`)**: Real-time cross-module KPI aggregator displaying headcount metrics (M01), daily attendance stats (M02, if enabled), and payroll cycle status (M03, if enabled).

---

## 2. Architectural Principles
- **Strict Tenant Scoping**: Single-database multi-tenancy. Regular users possess a foreign `tenant_id`. Super Admins possess `tenant_id = null` and dynamically bind tenant context when impersonating.
- **Module Feature Flags**: Direct columns `is_ams_enabled` and `is_payroll_enabled` on `tenants` control both frontend navigation rendering and backend route authorization via `EnsureModuleEnabled` middleware.
- **Security & Rate Limiting**: Session-based stateful authentication via Laravel Sanctum/Web session, 5-attempt rate limit lockout on login, CSRF regeneration on session change, and secure password broker resets.
