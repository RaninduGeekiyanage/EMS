# READ_ORDER.md — What to Read Before Each Task Type

> After reading `AGENT_RULES.md`, consult this file to know exactly which spec files are relevant to your current task before you start implementing.

---

## Always Read (Every Single Session)

Regardless of task type, always read:

1. `AGENT.md`
2. `docs/rules/AGENT_RULES.md`
3. `docs/tasks/MASTER_TASK_LIST.md`
4. Active module `TASKS.md` (e.g., `docs/modules/M01-master/TASKS.md`)

---

## Task-Specific Reading Lists

### Creating a New Database Migration
1. `docs/rules/database-rules.md` — ULID PKs, tenant_id, indexes, soft-deletes
2. Active module `data-models.md` — exact table schema to implement
3. `docs/standards/naming-conventions.md` — table/column naming

### Creating a New Model
1. `docs/rules/coding-standards.md` — model conventions, casts, no business logic
2. Active module `data-models.md` — relationships, fillable fields
3. `docs/standards/naming-conventions.md`

### Creating a Repository (Interface + Implementation)
1. `docs/rules/coding-standards.md` — Repository pattern example
2. `docs/standards/php-conventions.md` — interface/class conventions
3. Active module `requirements.md` — what queries are needed

### Creating a Service Class
1. `docs/rules/coding-standards.md` — Service layer rules
2. Active module `requirements.md` — business rules to implement
3. `docs/rules/security-rules.md` — if service touches auth/files/sensitive data

### Creating a Controller
1. `docs/rules/coding-standards.md` — thin controller rules
2. Active module `permissions.md` — which permissions to check
3. Active module `ui-screens.md` — what data each page needs
4. `docs/standards/naming-conventions.md` — route/method naming

### Creating a Form Request (Validation)
1. Active module `requirements.md` — validation rules per field
2. `docs/rules/security-rules.md` — file upload validation rules

### Creating a Policy
1. Active module `permissions.md` — which roles can do what
2. `docs/rules/security-rules.md`

### Creating an Inertia/React Page Component
1. `docs/standards/typescript-conventions.md` — component structure
2. Active module `ui-screens.md` — screen layout, fields, actions
3. `docs/standards/naming-conventions.md` — file/component naming

### Creating a TypeScript Type/Interface
1. Active module `data-models.md` — source of truth for field names/types
2. `docs/standards/typescript-conventions.md`

### Writing Tests
1. `docs/rules/testing-rules.md` — test patterns, isolation, coverage
2. Active module `test-plan.md` — specific test cases to implement

### Working on Payroll Calculations
1. `docs/modules/M03-payroll/calculation-engine.md` — formulas for all 3 modes
2. `docs/modules/M03-payroll/epf-etf-spec.md` — EPF/ETF calculation
3. `docs/modules/M03-payroll/apit-tax-spec.md` — APIT tax bands and logic
4. `docs/rules/coding-standards.md`

### Working on Attendance Import
1. `docs/modules/M02-ams/file-import-spec.md` — import process flow
2. `docs/modules/M02-ams/biometric-adapters.md` — adapter interface and implementations
3. `docs/modules/M02-ams/shift-logic.md` — post-import processing rules

### Working on Attendance Processing / OT
1. `docs/modules/M02-ams/shift-logic.md` — all calculation rules
2. `docs/modules/M02-ams/data-models.md` — attendance_daily schema

### Working on Leave Management
1. `docs/modules/M02-ams/leave-management.md` — SL leave rules, workflow
2. `docs/modules/M02-ams/data-models.md` — leave table schemas

### Adding a New Permission
1. Active module `permissions.md` — existing permissions and role matrix
2. `docs/rules/security-rules.md`
3. `docs/rules/coding-standards.md` — permission seeder pattern

### Working on Bank File Generation
1. `docs/modules/M03-payroll/bank-file-formats.md` — exact format per bank
2. `docs/modules/M03-payroll/data-models.md`

### Working on Payslip PDF
1. `docs/modules/M03-payroll/payslip-spec.md` — layout requirements
2. `docs/tech-stack/packages.md` — DomPDF configuration

### Starting a New Module
1. `docs/modules/README.md` — module index and dependencies
2. New module `README.md` — scope and key entities
3. New module `TASKS.md` — full task list
4. New module `requirements.md` — functional requirements
5. New module `data-models.md` — database schema
6. `docs/rules/database-rules.md`
7. `docs/rules/coding-standards.md`

### Architectural Questions / Design Decisions
1. `docs/SRS.md` — master requirements
2. `docs/architecture/overview.md`
3. `docs/architecture/multi-tenant.md`
4. Relevant ADR in `docs/decisions/`

### Security-Related Tasks
1. `docs/rules/security-rules.md`
2. `docs/architecture/security.md`

### Performance Optimization
1. `docs/rules/database-rules.md` — indexing strategy
2. `docs/architecture/tech-stack.md` — caching patterns

---

## Module-Specific Quick Reference

| Working on... | Primary spec files |
|---------------|--------------------|
| Tenant/Company setup | `docs/modules/M01-master/requirements.md`, `data-models.md` |
| Employee master | `docs/modules/M01-master/requirements.md`, `data-models.md` |
| Pay structure | `docs/modules/M01-master/requirements.md`, `data-models.md` |
| Shifts & calendars | `docs/modules/M02-ams/shift-logic.md`, `data-models.md` |
| Attendance import | `docs/modules/M02-ams/file-import-spec.md`, `biometric-adapters.md` |
| Leave management | `docs/modules/M02-ams/leave-management.md`, `data-models.md` |
| Payroll run | `docs/modules/M03-payroll/calculation-engine.md`, `data-models.md` |
| EPF/ETF | `docs/modules/M03-payroll/epf-etf-spec.md` |
| APIT tax | `docs/modules/M03-payroll/apit-tax-spec.md` |
| Bank files | `docs/modules/M03-payroll/bank-file-formats.md` |
| Payslips | `docs/modules/M03-payroll/payslip-spec.md` |
