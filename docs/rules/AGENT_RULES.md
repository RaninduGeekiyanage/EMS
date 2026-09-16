# AGENT_RULES.md — Mandatory Rules for AI Agent

> ⚠️ These rules are NON-NEGOTIABLE. Read this file at the start of every session.
> Violating these rules produces insecure, broken, or unmaintainable code.

---

## Rule 1: File Reading Order

**Before doing any work**, read these files in this exact order:

1. `AGENT.md` — project context, active module, current sprint
2. `docs/rules/AGENT_RULES.md` — this file
3. `docs/rules/READ_ORDER.md` — task-specific reading list
4. `docs/tasks/MASTER_TASK_LIST.md` — current progress
5. Active module `TASKS.md` — what to work on next

**Never skip step 3.** The READ_ORDER file tells you exactly which spec files are relevant to your current task.

---

## Rule 2: Task Management

- **Before starting a task:** mark it `[/]` in the module `TASKS.md`
- **After completing + testing:** mark it `[x]`
- **If blocked:** mark it `[!]` and add a note explaining the blocker
- **Always update both:** the module `TASKS.md` AND `docs/tasks/MASTER_TASK_LIST.md`
- **Never mark `[x]` without passing tests**

---

## Rule 3: Database Rules

1. **Every table MUST have `tenant_id`** (foreign key to `tenants.id`) — no exceptions
2. **Primary keys are ULIDs** — never auto-increment integers
3. **Always use Eloquent** — no raw SQL queries
4. **Parameterized queries only** — never string-interpolate user input into queries
5. **Soft delete employees** — never hard-delete employee records
6. **Never hard-delete payroll or attendance records** — ever
7. **Every migration must have a `down()` method**
8. **Always add indexes** on `(tenant_id, employee_id)` and `(tenant_id, date)` pairs
9. Read `docs/rules/database-rules.md` before writing any migration
10. **Target MariaDB 10.11+ & MySQL 8.0+, PHP 8.4+** — All migrations and models must strictly align with MariaDB 10.11.x LTS (`10.11.19-MariaDB-cll-lve` or later), MySQL 8.0+, and PHP 8.4+ (`8.4.24`), bounded string indexes, and explicit PHP nullability types.

---

## Rule 4: Code Standards

1. **Every PHP file starts with:** `<?php declare(strict_types=1);`
2. **Repository pattern:** interface in `app/Repositories/Contracts/`, implementation in `app/Repositories/Eloquent/`
3. **Service layer:** ALL business logic lives in `app/Services/` — nowhere else
4. **Thin controllers:** controllers call services and return Inertia responses — nothing else
5. **No business logic in Models** — Models contain relationships, casts, scopes only
6. **Use PHP Enums** for status fields (EmploymentType, PaymentMode, AttendanceStatus, etc.)
7. Read `docs/rules/coding-standards.md` before writing any PHP class

---

## Rule 5: Security

1. **Every controller action checks permission:** `$this->authorize('permission.name')` or use Policy
2. **Never skip CSRF** — all state-changing requests go through Laravel's CSRF middleware
3. **Encrypt sensitive fields:** NIC numbers, bank account numbers — use Laravel's `encrypted` cast
4. **Files stored outside public/** — never store uploads in `public/`
5. **Signed URLs for downloads** — never expose raw file paths
6. **Tenant isolation is security** — a missing `tenant_id` scope is a security vulnerability
7. Read `docs/rules/security-rules.md` before implementing any auth or file feature

---

## Rule 6: Testing

1. **Every Service method needs a Unit test** in `tests/Unit/`
2. **Every Controller endpoint needs a Feature test** in `tests/Feature/`
3. **Always test tenant isolation** — tenant A must never see tenant B's data
4. **Always test permission enforcement** — unauthorized roles must get HTTP 403
5. **Write tests BEFORE marking a task `[x]`**
6. Run: `php artisan test` — all tests must pass
7. Read `docs/rules/testing-rules.md` for test patterns

---

## Rule 7: Multi-Tenancy

1. **Every Eloquent model that belongs to a tenant** must use the `BelongsToTenant` trait
2. **The `TenantScope` Global Scope** automatically filters all queries by tenant — verify it's applied
3. **Super Admin bypass** — Super Admin queries must explicitly remove tenant scope using `withoutGlobalScope(TenantScope::class)`
4. **Cache keys must be tenant-prefixed** — `"tenant_{$tenantId}_setting_key"`
5. **Queue jobs must include `tenant_id`** in their payload
6. **File storage paths are tenant-namespaced** — `storage/app/tenants/{tenantId}/...`
7. **Test cross-tenant isolation** — this is a mandatory test for every module

---

## Rule 8: Never Hardcode Business Logic

The following values MUST come from the database or `tenant_settings` — never from code constants:

| Value | Storage Location |
|-------|-----------------|
| EPF employee rate (8%) | `tenant_settings.epf_employee_rate` |
| EPF employer rate (12%) | `tenant_settings.epf_employer_rate` |
| ETF rate (3%) | `tenant_settings.etf_employer_rate` |
| OT rate multipliers (1.5x, 2.0x) | `tenant_settings.ot_weekday_rate`, etc. |
| Leave entitlement days | `leave_types.days_per_year` |
| APIT tax bands | `apit_tax_bands` table |
| Late deduction policy | `tenant_settings.late_deduction_policy` |
| Grace period minutes | `tenant_settings.late_grace_period_minutes` |
| Wages Board minimum wages | `wages_board_categories` table |

---

## Rule 9: Module Build Order

```
M01 Master → [All tests pass] → M02 AMS → [All tests pass] → M03 Payroll → [Full system test]
```

- **Do not start M02** until M01 module sign-off checklist (`docs/modules/M01-master/test-plan.md`) is complete
- **Do not start M03** until M02 module sign-off checklist is complete
- When completing a module: update `AGENT.md` active module and update `docs/tasks/MASTER_TASK_LIST.md`

---

## Rule 10: Documentation

When you add a new:
- **Database table** → update the module's `data-models.md`
- **Permission** → update the module's `permissions.md`
- **UI screen** → update the module's `ui-screens.md`
- **Adapter or integration** → update relevant spec file

---

## Before Ending A Session — Checklist

- [ ] All started tasks are marked `[/]` or `[x]`
- [ ] Completed tasks are marked `[x]` (tests passing)
- [ ] `docs/tasks/MASTER_TASK_LIST.md` counts updated
- [ ] All changes committed with proper message format: `[M0X] type: description`
- [ ] Note the next task to resume from
