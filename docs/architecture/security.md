# Security Architecture

- **Auth**: Laravel Sanctum stateful cookie authentication.
- **RBAC**: Spatie Permission scoped by `team_id` (maps directly to `tenant_id`).
- **Data Protection**: AES-256-CBC encryption for sensitive personal and banking details.
- **File Storage**: Non-public disk storage with temporary signed download URLs.
