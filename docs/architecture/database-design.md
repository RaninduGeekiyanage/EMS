# Database Design Principles

- **Primary Keys**: ULID (char 26) generated on insert for high-concurrency sorting without integer auto-increment exposure.
- **Foreign Keys**: Strict relational integrity using InnoDB with explicit `cascade` or `nullOnDelete` constraints.
- **Multi-Tenant Isolation**: Scoped by `tenant_id` on every organizational and operational table; unique composite constraints always lead with `['tenant_id', ...]`.
- **Indexes**: Composite indexes on `(tenant_id, ...)` pairs to ensure fast index-filtered searches and prevent full table scans.
- **Encrypted Columns**: Employee NIC, Bank Account Number.
- **Audit Columns**: `created_at`, `updated_at`, `deleted_at` (soft deletes) with ULID editor tracking.

## Transaction & Concurrency Guarantees
- **Atomic Operations (`DB::transaction`)**: Multi-row, multi-table, or financial period operations must execute within strict atomic database transactions. Partial commits are strictly forbidden.
- **Chunked Bulk Synchronization**: When executing bulk operations (e.g. duty roster generation, biometric log ingestion), operations are batch-chunked into 250–500 rows using native `upsert` or `insertOrIgnore` to prevent memory exhaustion and lock timeouts.
- **Financial Period Immutability**: Historical operational records (rosters, daily attendance, payroll records) are marked `locked` upon period finalization, preventing retrospective modification.

