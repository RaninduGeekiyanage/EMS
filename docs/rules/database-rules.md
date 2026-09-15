# Database Rules & Conventions

## 1. Core Principles
- **ULID Primary Keys**: Every table uses string/char(26) ULIDs as primary keys, generated via Laravel `HasUlids`. Never auto-increment integers.
- **Tenant Scoping**: Every table belonging to tenant data MUST contain `tenant_id` (CHAR 26) with foreign key referencing `tenants(id)`.
- **Soft Deletes**: Use `deleted_at` timestamps on master data (employees, departments, designations, companies, branches). Never hard delete.
- **Audit Fields**: Every table must have `created_at` and `updated_at`.

## 2. Foreign Keys & Cascading
- Always declare InnoDB foreign keys.
- Do NOT cascade delete across tenant boundaries or on sensitive audit tables.
- Use `restrictOnDelete()` for core master records (e.g. cannot delete department if employees exist).

## 3. Indexing Strategy
- Composite index on `(tenant_id, id)` is implicitly handled, but always add explicit indexes for:
  - `(tenant_id, employee_id)`
  - `(tenant_id, attendance_date)`
  - `(tenant_id, created_at)`
  - Unique composite index: `unique(['tenant_id', 'emp_no'])`

## 4. Column Naming Conventions
- Table names: snake_case, plural (`payroll_runs`, `attendance_logs`)
- Foreign keys: singular_table_name_id (`tenant_id`, `employee_id`, `department_id`)
- Date fields: `_date` suffix (`attendance_date`, `effective_date`)
- Datetime/Timestamp fields: `_at` suffix (`approved_at`, `locked_at`)
- Boolean flags: `is_` or `has_` prefix (`is_active`, `is_night_shift`, `has_overtime`)
- Monetary/Currency amounts: decimal(12, 2) strictly. Never float or double.

## 5. Sensitive Data & Encryption
- Store NIC and bank account numbers using Laravel model `$casts = ['account_no' => 'encrypted']`.
- Passwords must be hashed using bcrypt (cost factor 12).
