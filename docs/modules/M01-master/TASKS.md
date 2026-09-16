# M01 — Master Module Detailed Tasks

## Phase 1: Project Scaffolding & Dependencies
- [x] Initialize Laravel 11 Project & Core Dependencies
  - [x] File: composer.json — Set PHP 8.3 & strict dependency constraints
  - [x] File: .env.example — Multi-tenant, database, Redis and Sanctum configs
  - [x] Run: `composer require spatie/laravel-permission barryvdh/laravel-dompdf intervention/image-laravel laravel/horizon`
  - [x] Run: `npm install @inertiajs/react react react-dom lucide-react tailwindcss @radix-ui/react-slot clsx tailwind-merge`
  - [x] File: vite.config.ts — Inertia React & Tailwind setup
  - [x] File: tsconfig.json — TypeScript strict compiler options

## Phase 2: Multi-Tenant Architecture & Scoping
- [x] Tenant Database Migrations & Models
  - [x] File: database/migrations/2026_01_01_000001_create_tenants_table.php
  - [x] File: database/migrations/2026_01_01_000002_create_tenant_settings_table.php
  - [x] File: app/Models/Tenant.php — With ULID and configuration relations
  - [x] File: app/Models/TenantSetting.php
  - [x] File: app/Scopes/TenantScope.php — Global scope enforcing tenant_id filtering
  - [x] File: app/Traits/BelongsToTenant.php — Auto-assigning & scoping tenant_id
  - [x] File: app/Http/Middleware/ResolveTenant.php — Identify tenant from session/domain

## Phase 3: Organization & Branch Hierarchy
- [x] Company, Branch & Department Structure
  - [x] File: database/migrations/2026_01_01_000010_create_companies_table.php
  - [x] File: database/migrations/2026_01_01_000011_create_branches_table.php
  - [x] File: database/migrations/2026_01_01_000012_create_departments_table.php
  - [x] File: database/migrations/2026_01_01_000013_create_wages_board_categories_table.php
  - [x] File: database/migrations/2026_01_01_000014_create_designations_table.php
  - [x] File: app/Models/Company.php
  - [x] File: app/Models/Branch.php
  - [x] File: app/Models/Department.php — Recursive hierarchy (parent_id)
  - [x] File: app/Models/Designation.php
  - [x] File: app/Models/WagesBoardCategory.php
  - [x] File: app/Repositories/Contracts/CompanyRepositoryInterface.php
  - [x] File: app/Repositories/Eloquent/CompanyRepository.php
  - [x] File: app/Services/CompanyService.php
  - [x] File: app/Http/Controllers/CompanyController.php
  - [x] File: app/Http/Controllers/BranchController.php
  - [x] File: app/Http/Controllers/DepartmentController.php
  - [x] File: resources/js/Pages/Company/Profile.tsx
  - [x] File: resources/js/Pages/Departments/Index.tsx


## Phase 4: Employee Master & Payment Profiles
- [x] Employee Core Profiles & Records
  - [x] File: database/migrations/2026_01_01_000020_create_employees_table.php
  - [x] File: database/migrations/2026_01_01_000021_create_employee_payment_info_table.php
  - [x] File: database/migrations/2026_01_01_000022_create_employee_bank_info_table.php
  - [x] File: database/migrations/2026_01_01_000023_create_employee_epf_info_table.php
  - [x] File: app/Models/Employee.php — ULID, soft-deletes, encrypted NIC
  - [x] File: app/Models/EmployeePaymentInfo.php — Supports Monthly, Daily, Hourly
  - [x] File: app/Models/EmployeeBankInfo.php — Encrypted bank account details
  - [x] File: app/Models/EmployeeEpfInfo.php — Toggleable EPF membership
  - [x] File: app/Enums/PaymentMode.php — Backed enum: monthly, daily, hourly
  - [x] File: app/Enums/EmploymentType.php
  - [x] File: app/Repositories/Contracts/EmployeeRepositoryInterface.php
  - [x] File: app/Repositories/Eloquent/EmployeeRepository.php
  - [x] File: app/Services/EmployeeService.php
  - [x] File: app/Http/Controllers/EmployeeController.php
  - [x] File: app/Http/Requests/Employee/StoreEmployeeRequest.php
  - [x] File: app/Http/Requests/Employee/UpdateEmployeeRequest.php
  - [x] File: resources/js/Pages/Employees/Index.tsx
  - [x] File: resources/js/Pages/Employees/Create.tsx
  - [x] File: resources/js/Pages/Employees/Edit.tsx
  - [x] File: resources/js/Types/employee.ts


## Phase 5: RBAC & Permissions
- [ ] Spatie Teams Integration
  - [ ] File: database/seeders/RolesAndPermissionsSeeder.php
  - [ ] File: app/Policies/EmployeePolicy.php
  - [ ] File: tests/Feature/M01/TenantIsolationTest.php
  - [ ] File: tests/Feature/M01/EmployeeCrudTest.php
