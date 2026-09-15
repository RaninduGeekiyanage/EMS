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
- [ ] Tenant Database Migrations & Models
  - [ ] File: database/migrations/2026_01_01_000001_create_tenants_table.php
  - [ ] File: database/migrations/2026_01_01_000002_create_tenant_settings_table.php
  - [ ] File: app/Models/Tenant.php — With ULID and configuration relations
  - [ ] File: app/Models/TenantSetting.php
  - [ ] File: app/Scopes/TenantScope.php — Global scope enforcing tenant_id filtering
  - [ ] File: app/Traits/BelongsToTenant.php — Auto-assigning & scoping tenant_id
  - [ ] File: app/Http/Middleware/ResolveTenant.php — Identify tenant from session/domain

## Phase 3: Organization & Branch Hierarchy
- [ ] Company, Branch & Department Structure
  - [ ] File: database/migrations/2026_01_01_000010_create_companies_table.php
  - [ ] File: database/migrations/2026_01_01_000011_create_branches_table.php
  - [ ] File: database/migrations/2026_01_01_000012_create_departments_table.php
  - [ ] File: database/migrations/2026_01_01_000013_create_designations_table.php
  - [ ] File: database/migrations/2026_01_01_000014_create_wages_board_categories_table.php
  - [ ] File: app/Models/Company.php
  - [ ] File: app/Models/Branch.php
  - [ ] File: app/Models/Department.php — Recursive hierarchy (parent_id)
  - [ ] File: app/Models/Designation.php
  - [ ] File: app/Models/WagesBoardCategory.php
  - [ ] File: app/Repositories/Contracts/CompanyRepositoryInterface.php
  - [ ] File: app/Repositories/Eloquent/CompanyRepository.php
  - [ ] File: app/Services/CompanyService.php
  - [ ] File: app/Http/Controllers/CompanyController.php
  - [ ] File: app/Http/Controllers/BranchController.php
  - [ ] File: app/Http/Controllers/DepartmentController.php
  - [ ] File: resources/js/Pages/Company/Profile.tsx
  - [ ] File: resources/js/Pages/Departments/Index.tsx

## Phase 4: Employee Master & Payment Profiles
- [ ] Employee Core Profiles & Records
  - [ ] File: database/migrations/2026_01_01_000020_create_employees_table.php
  - [ ] File: database/migrations/2026_01_01_000021_create_employee_payment_info_table.php
  - [ ] File: database/migrations/2026_01_01_000022_create_employee_bank_info_table.php
  - [ ] File: database/migrations/2026_01_01_000023_create_employee_epf_info_table.php
  - [ ] File: app/Models/Employee.php — ULID, soft-deletes, encrypted NIC
  - [ ] File: app/Models/EmployeePaymentInfo.php — Supports Monthly, Daily, Hourly
  - [ ] File: app/Models/EmployeeBankInfo.php — Encrypted bank account details
  - [ ] File: app/Models/EmployeeEpfInfo.php — Toggleable EPF membership
  - [ ] File: app/Enums/PaymentMode.php — Backed enum: monthly, daily, hourly
  - [ ] File: app/Enums/EmploymentType.php
  - [ ] File: app/Repositories/Contracts/EmployeeRepositoryInterface.php
  - [ ] File: app/Repositories/Eloquent/EmployeeRepository.php
  - [ ] File: app/Services/EmployeeService.php
  - [ ] File: app/Http/Controllers/EmployeeController.php
  - [ ] File: app/Http/Requests/Employee/StoreEmployeeRequest.php
  - [ ] File: app/Http/Requests/Employee/UpdateEmployeeRequest.php
  - [ ] File: resources/js/Pages/Employees/Index.tsx
  - [ ] File: resources/js/Pages/Employees/Create.tsx
  - [ ] File: resources/js/Pages/Employees/Edit.tsx
  - [ ] File: resources/js/Types/employee.ts

## Phase 5: RBAC & Permissions
- [ ] Spatie Teams Integration
  - [ ] File: database/seeders/RolesAndPermissionsSeeder.php
  - [ ] File: app/Policies/EmployeePolicy.php
  - [ ] File: tests/Feature/M01/TenantIsolationTest.php
  - [ ] File: tests/Feature/M01/EmployeeCrudTest.php
