# M00 — Core Module Detailed Tasks

## Phase 1: Database Schema & Migrations
- [x] Database Schema & Multi-Tenant User Associations
  - [x] File: `database/migrations/2026_01_01_000003_add_tenant_id_to_users_table.php`
  - [x] File: `database/migrations/2026_01_01_000004_add_module_flags_to_tenants_table.php`
  - [x] File: `database/migrations/2026_01_01_000005_add_is_super_admin_to_users_table.php`
  - [x] File: `app/Models/User.php` — Model updates with `belongsTo(Tenant::class)` and role helpers
  - [x] File: `app/Models/Tenant.php` — Model updates with module flag casts, `users()`, and `owner()`
  - [x] File: `database/seeders/RolesAndPermissionsSeeder.php` — Update with industry-standard roles
  - [x] File: `database/seeders/DatabaseSeeder.php` — Update seeds with Super Admin and Company Owner

## Phase 2: Authentication & Security Flow
- [x] Session Authentication & Rate Limiting
  - [x] File: `app/Http/Requests/Auth/LoginRequest.php`
  - [x] File: `app/Http/Requests/Auth/PasswordResetLinkRequest.php`
  - [x] File: `app/Http/Requests/Auth/ResetPasswordRequest.php`
  - [x] File: `app/Http/Controllers/Auth/AuthenticatedSessionController.php`
  - [x] File: `app/Http/Controllers/Auth/PasswordResetLinkController.php`
  - [x] File: `app/Http/Controllers/Auth/NewPasswordController.php`
  - [x] File: `app/Http/Middleware/EnsureModuleEnabled.php`
  - [x] File: `app/Http/Middleware/ResolveTenant.php` — Support impersonation session
  - [x] File: `app/Http/Middleware/HandleInertiaRequests.php` — Share auth, tenant, role, and impersonation props

## Phase 3: Super Admin Platform Engine
- [x] Multi-Tenant Provisioning & Control
  - [x] File: `app/Http/Requests/SuperAdmin/StoreCompanyRequest.php`
  - [x] File: `app/Http/Requests/SuperAdmin/ResetAdminPasswordRequest.php`
  - [x] File: `app/Http/Controllers/SuperAdmin/CompanyController.php`

## Phase 4: Tenant Dashboard & Aggregator
- [x] Executive KPI Service & Controller
  - [x] File: `app/Services/DashboardService.php`
  - [x] File: `app/Http/Controllers/DashboardController.php`

## Phase 5: Routing & Web Navigation
- [x] Route Registration
  - [x] File: `routes/web.php` — Register guest auth routes, Super Admin routes, and protect tenant routes with auth + module middleware

## Phase 6: Frontend Layouts & Pages
- [x] Responsive Layout Shell & Views
  - [x] File: `resources/js/Layouts/AuthenticatedLayout.tsx` — Collapsible sidebar, mobile drawer, top bar, impersonation banner
  - [x] File: `resources/js/Pages/Auth/Login.tsx`
  - [x] File: `resources/js/Pages/Auth/ForgotPassword.tsx`
  - [x] File: `resources/js/Pages/Auth/ResetPassword.tsx`
  - [x] File: `resources/js/Pages/SuperAdmin/Dashboard.tsx`
  - [x] File: `resources/js/Pages/Dashboard/Index.tsx`

## Phase 7: Verification & Automated Tests
- [x] Feature Test Suites
  - [x] File: `tests/Feature/Auth/AuthenticationTest.php`
  - [x] File: `tests/Feature/Auth/PasswordResetTest.php`
  - [x] File: `tests/Feature/SuperAdmin/CompanyManagementTest.php`
  - [x] File: `tests/Feature/Tenant/ModuleRestrictionTest.php`
  - [x] File: `tests/Feature/Dashboard/TenantDashboardTest.php`

## Phase 8: User Account & Password Reset Management
- [x] User Management Engine & Role Assignments
  - [x] File: `app/Http/Controllers/UserAccountController.php` — Index, store, update, destroy, and resetPassword
  - [x] File: `app/Http/Requests/Users/StoreUserRequest.php` — Validates name, email, password, and Spatie role assignment
  - [x] File: `app/Http/Requests/Users/UpdateUserRequest.php` — Validates user details and role mutation
  - [x] File: `app/Http/Requests/Users/ResetUserPasswordRequest.php` — Secure administrative password reset validation
  - [x] File: `app/Http/Controllers/SuperAdmin/CompanyController.php` — `resetUserPassword()` handler for super admin
  - [x] File: `resources/js/Pages/Users/Index.tsx` — Full User Accounts & Access Management UI screen
  - [x] File: `tests/Feature/UserAccountManagementTest.php` — 6 automated feature test cases verifying tenant isolation, role management, and password resets

## Phase 9: Unified Collapsible SPA Layout & Navigation Standard
- [x] Global Collapsible Sidebar & Universal Back Navigation
  - [x] File: `resources/js/Layouts/AuthenticatedLayout.tsx` — Collapsible sidebar state persistence in `localStorage` (`ems_sidebar_collapsed`), universal SPA back button, breadcrumbs, and active navigation highlighting
  - [x] Integration across all authenticated pages:
    - [x] `resources/js/Pages/Dashboard/Index.tsx`
    - [x] `resources/js/Pages/Users/Index.tsx`
    - [x] `resources/js/Pages/Company/Profile.tsx`
    - [x] `resources/js/Pages/Departments/Index.tsx`
    - [x] `resources/js/Pages/Employees/Index.tsx`
    - [x] `resources/js/Pages/Employees/Create.tsx`
    - [x] `resources/js/Pages/Employees/Edit.tsx`
    - [x] `resources/js/Pages/Attendance/Daily.tsx`
    - [x] `resources/js/Pages/Attendance/Import.tsx`
    - [x] `resources/js/Pages/Shifts/Index.tsx`
    - [x] `resources/js/Pages/WorkCalendar/Index.tsx`
    - [x] `resources/js/Pages/Leave/Requests.tsx`
    - [x] `resources/js/Pages/SuperAdmin/Dashboard.tsx`
  - [x] Zero hard-reloads: all inter-module links converted from `<a>` to Inertia `<Link>` for true Single Page Application behavior
