# Database Design Principles

- **Primary Keys**: ULID (char 26) generated on insert.
- **Foreign Keys**: Strict relational integrity using InnoDB.
- **Indexes**: Composite indexes on `(tenant_id, ...)` pairs to ensure fast index-filtered searches.
- **Encrypted Columns**: Employee NIC, Bank Account Number.
- **Audit Columns**: `created_at`, `updated_at`, `deleted_at` (soft deletes).
