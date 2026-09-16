# M00 — Technical Specification

## 1. Data Model & Migrations

### 1.1 `users` Table Updates
- `tenant_id`: `CHAR(26)` ULID nullable foreign key referencing `tenants(id)->nullOnDelete()`. Indexed.
- `tenant_id = null` indicates a Global Super Admin user.
- `tenant_id != null` indicates a tenant-bound user (Company Owner, Admin, HR Manager, Supervisor, Staff).

### 1.2 `tenants` Table Updates
- `is_ams_enabled`: `BOOLEAN` default `TRUE`.
- `is_payroll_enabled`: `BOOLEAN` default `TRUE`.
- Note: M01 Master Module is always enabled by default as the foundational dependency.

---

## 2. Authentication Specification

### 2.1 Login Flow (`POST /login`)
1. **Input**: `email` (required, email), `password` (required, string), `remember` (boolean, optional).
2. **Rate Limiting**: 5 attempts per minute max based on key `Str::transliterate(Str::lower($email) . '|' . $ip)`.
3. **Authentication**: `Auth::attempt($credentials, $remember)`.
4. **Session Resolution**:
   - If user has `Super Admin` role (`tenant_id === null`):
     - Clears any previous tenant session context.
     - Redirects to `/admin/dashboard`.
   - If user has a `tenant_id`:
     - Loads tenant model.
     - If `tenant->is_active === false`, immediately logs out and aborts with `403 Account Inactive`.
     - Sets session `tenant_id = $tenant->id` and `tenant_slug = $tenant->slug`.
     - Executes `setPermissionsTeamId($tenant->id)`.
     - Regenerates session ID.
     - Redirects to `/dashboard`.

### 2.2 Password Reset Flow
- `POST /forgot-password`: Dispatches standard Laravel password reset link using `Password::broker('users')`.
- `POST /reset-password`: Validates token, updates password with `Hash::make()`, invalidates token, and redirects to `/login` with success flash.

### 2.3 Logout Flow (`POST /logout`)
- Calls `Auth::guard('web')->logout()`.
- Invalidates session, regenerates CSRF token, and redirects to `/login`.

---

## 3. Super Admin Platform Specification

### 3.1 Company Provisioning (`POST /admin/companies`)
- **Fields**:
  - `name`: String, required.
  - `slug`: String, required, unique on `tenants`.
  - `owner_name`: String, required.
  - `owner_email`: Email, required, unique on `users`.
  - `owner_password`: String, min 8 chars.
  - `is_ams_enabled`: Boolean, default true.
  - `is_payroll_enabled`: Boolean, default true.
- **Workflow**:
  - DB Transaction:
    1. Creates `Tenant` record with module flags.
    2. Creates associated `Company` record.
    3. Creates `User` with `tenant_id = $tenant->id`.
    4. Sets `setPermissionsTeamId($tenant->id)` and assigns `Company Owner` role to the newly created user.

### 3.2 Reset Company Owner Password (`POST /admin/companies/{tenant}/reset-admin-password`)
- Allows Super Admin to directly update the top admin/owner's password for a company.
- Updates the owner's `password` hash and records an audit log.

### 3.3 Module Toggling (`POST /admin/companies/{tenant}/toggle-module/{module}`)
- Toggles `is_ams_enabled` or `is_payroll_enabled`.

### 3.4 Impersonation Engine
- `POST /admin/companies/{tenant}/impersonate`:
  - Verifies user has `Super Admin` role.
  - Sets session `impersonated_tenant_id = $tenant->id`.
  - Sets session `tenant_id = $tenant->id`.
  - Activates `setPermissionsTeamId($tenant->id)`.
  - Redirects to `/dashboard`.
- `POST /admin/impersonate/exit`:
  - Clears session `impersonated_tenant_id` and session `tenant_id`.
  - Redirects back to `/admin/dashboard`.

---

## 4. Module Guard Middleware (`EnsureModuleEnabled`)
- Middleware registered as alias `module:{name}`.
- If tenant has `is_ams_enabled === false` and a request is made to an AMS route (e.g. `/shifts`, `/attendance/*`, `/leave/*`), aborts with `403 Module Disabled for this Company`.
- Same logic applies to `module:payroll` for payroll routes.
