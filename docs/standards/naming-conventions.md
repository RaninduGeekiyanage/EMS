# Naming Conventions

- **Database Tables**: Plural snake_case (`attendance_logs`, `leave_entitlements`).
- **Models**: Singular PascalCase (`AttendanceLog`, `LeaveEntitlement`).
- **Controllers**: PascalCase with Controller suffix (`PayrollRunController`).
- **Services**: PascalCase with Service suffix (`OvertimeCalculationService`).
- **Primary Keys**: ULID string `id`. Foreign keys: `singular_table_id`.
