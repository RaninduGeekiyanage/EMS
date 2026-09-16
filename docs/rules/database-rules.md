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

## 6. Server & Engine Compatibility (MariaDB 10.11+ & MySQL 8.0+, PHP 8.4+)
- **Target Server Runtime**:
  - Database: MariaDB 10.11.x LTS (`10.11.19-MariaDB-cll-lve` or later) & MySQL 8.0+.
  - PHP: PHP 8.4.x (`8.4.24` or later) with `mysqli`, `pdo_mysql`, `curl`, `mbstring`.
  - Web Server: cpsrvd / cPanel LVE / Nginx / Apache with UNIX socket or 127.0.0.1.
- **Migration & Schema Guardrails**:
  - Always support both MariaDB 10.11+ and MySQL 8.0+ syntax and capabilities.
  - Sizing constraints: In `utf8mb4` environments, keep unique/indexed string columns bounded (e.g. `string('slug', 100)`, `string('key', 100)`, `string('code', 50)`) to strictly remain within MariaDB prefix index limits (1000/3072 bytes).
  - Primary & Foreign Keys: Always use `$table->ulid('id')->primary()` and `$table->foreignUlid(...)` which produce `char(26)` universally supported across MariaDB, MySQL, and SQLite.
  - JSON handling: MariaDB 10.11 aliases `json` to `LONGTEXT` with `JSON_VALID()`. Use standard `json` or `text` fields and avoid MySQL-only JSON virtual column expressions.
  - PHP 8.4 compatibility: Avoid deprecated implicit nullable parameter types. Always explicitly declare `?Type $param = null`.

