# AGENT.md — EMS Project Agent Guide
> **READ THIS FILE FIRST at the start of every session.**

## What Is This Project?
EMS (Employee Management System) is a multi-tenant SaaS platform for Sri Lankan businesses.
It manages employee attendance and payroll in compliance with Sri Lanka labor law.

**Stack:** Laravel 11 + Inertia.js + React 18 + TypeScript + MariaDB 10.11+ / MySQL 8.0+ + Redis (PHP 8.4+)
**Pattern:** Repository + Service layer, strict types, tenant-scoped Global Scope

---

## 🔴 Current Active Module: M01 — Organization & Employee Master

**Current Phase:** Setup & Foundation
**Status:** 🔴 Not Started

---

## MANDATORY: Read These Files First (Every Session)

Before writing a single line of code, read these files **in order**:

1. **This file** — `AGENT.md` (you are here)
2. **`docs/rules/AGENT_RULES.md`** — Non-negotiable rules. Read every session.
3. **`docs/rules/READ_ORDER.md`** — What else to read depending on your task
4. **`docs/tasks/MASTER_TASK_LIST.md`** — Check overall progress and active module
5. **`docs/modules/M01-master/TASKS.md`** — Active module task list (mark tasks as you go)

---

## Module Status

| Module | Code | Status | Active? |
|--------|------|--------|---------|
| Organization & Employee Master | M01 | 🔴 Not Started | ✅ YES |
| Attendance Management System | M02 | 🔴 Not Started | — |
| Payroll | M03 | 🔴 Not Started | — |

---

## Critical Rules (Non-Negotiable)

- **`tenant_id` on everything** — Every database table gets a `tenant_id` foreign key. No exceptions.
- **Never hardcode business logic** — All rates (EPF %, OT multiplier, leave days, tax bands) live in the database or `tenant_settings`, never in code.
- **Repository + Service pattern** — Zero business logic in Controllers or Models.
- **Mark tasks as you work** — `[/]` when starting, `[x]` when done + tested. Update BOTH the module `TASKS.md` AND `docs/tasks/MASTER_TASK_LIST.md`.
- **Tests before `[x]`** — A task is not done until its tests pass. Run `php artisan test` before marking complete.
- **Module order is strict** — M01 must be fully complete and tested before starting M02. M02 before M03.
- **Strict types in every PHP file** — `<?php declare(strict_types=1);` — always.
- **ULID primary keys** — All tables use ULID (not auto-increment integers) as primary key.

---

## Project Context

| Topic | Detail |
|-------|--------|
| Country | Sri Lanka |
| Labor Law | Shop & Office Act, Wages Board Ordinance, EPF/ETF Acts, APIT Tax |
| Payment Modes | Monthly Salaried, Daily Rate, Hourly Rate — all in Phase 1 |
| EPF/ETF | Optional per tenant (toggle in tenant_settings) |
| APIT Tax | Mandatory Phase 1 — Sri Lanka IRD tax tables |
| Biometric | Adapter pattern — ZKTeco, FingerTec, CSV, XLSX, pipe-delimited |
| Banks | BoC, Commercial Bank, Sampath, HNB, People's Bank, NSB |
| Company | One company per tenant + multiple branches |
| Tenancy | Single DB + tenant_id Global Scope strategy |
| Database & Runtime | MariaDB 10.11+ (target 10.11.19-cll-lve) / MySQL 8.0+, PHP 8.4+ (8.4.24) |

---

## Key File Quick Reference

| File | Purpose |
|------|---------|
| `docs/SRS.md` | Master requirements — read before architectural decisions |
| `docs/rules/AGENT_RULES.md` | All mandatory rules |
| `docs/rules/READ_ORDER.md` | What to read for each task type |
| `docs/tasks/MASTER_TASK_LIST.md` | Overall progress across all modules |
| `docs/modules/M01-master/TASKS.md` | M01 file-level task list |
| `docs/modules/M02-ams/TASKS.md` | M02 file-level task list |
| `docs/modules/M03-payroll/TASKS.md` | M03 file-level task list |
| `docs/rules/database-rules.md` | DB conventions — read before every migration |
| `docs/rules/coding-standards.md` | PHP/Laravel conventions |
| `docs/rules/security-rules.md` | Security checklist |
| `docs/standards/naming-conventions.md` | All naming rules |
| `docs/modules/M01-master/data-models.md` | M01 database schema |
| `docs/modules/M02-ams/data-models.md` | M02 database schema |
| `docs/modules/M03-payroll/data-models.md` | M03 database schema |

---

## How To Start A Session

```
1. Read AGENT.md (this file)
2. Read docs/rules/AGENT_RULES.md
3. Read docs/tasks/MASTER_TASK_LIST.md — find active module
4. Open active module TASKS.md — find first uncompleted [ ] task
5. Mark that task as [/] (in progress)
6. Read files listed in docs/rules/READ_ORDER.md for the task type
7. Implement the feature following docs/rules/coding-standards.md
8. Write tests (unit + feature)
9. Run: php artisan test
10. If tests pass → mark task [x]
11. Update docs/tasks/MASTER_TASK_LIST.md counts
12. Commit: git add . && git commit -m "[M01] feat: <description>"
13. Move to next [ ] task
```

---

## Current Sprint Focus

**Module:** M01 — Master
**Phase:** 1 — Laravel Project Setup
**First Task:** Create Laravel 11 project, install packages, configure Inertia.js

*Update this section when switching phases or modules.*
