# Security Rules & Checklist

## 1. Authentication & Authorization
- Use Laravel Sanctum session authentication for web Inertia routes.
- Spatie Permissions with Teams enabled (`team_id` mapped to `tenant_id`).
- Check authorization in every single controller method via `$this->authorize('permission.name')` or dedicated Policies.

## 2. Tenant Isolation
- Global Eloquent Scope (`TenantScope`) must be attached to all tenant models via `BelongsToTenant` trait.
- Prevent URL ID parameter tampering: Always resolve resources under authenticated user's `tenant_id`.
- For background jobs/queues, always pass and re-bind `tenant_id` in execution context.

## 3. File Upload Safety
- Store uploads outside `public/` directory (e.g., `storage/app/tenants/{tenant_id}/`).
- Validate MIME type, file extension whitelist, and file size (max 10MB).
- Serve private files using temporary signed routes or authenticated download controller.

## 4. Input Sanitization & Output Escaping
- Never disable Inertia/React automatic escaping.
- Parameterized SQL queries only via Eloquent or Query Builder bindings.
- CSRF middleware active on all POST/PUT/PATCH/DELETE endpoints.
