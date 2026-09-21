# HR-EMS Documentation Index

> **Auto-generated** from full codebase analysis of the HR-EMS (Human Resource – Employee Management System) project.

---

## Documentation Structure

```
docs/
├── architecture/                          # High-level architecture, DB ERD, and component tree
│   ├── system-overview.md                 # System architecture, patterns, data flow
│   ├── database-erd.md                    # Full ERD diagram, entity summary, enums
│   └── component-tree.md                  # React component hierarchy, shared UI inventory
│
├── decisions/                             # Implemented business & architectural decisions
│   └── architectural-decisions.md         # 10 ADRs covering auth, roster, attendance, etc.
│
├── modules/                               # Per-module breakdowns
│   ├── auth.md                            # Authentication, authorization, middleware
│   ├── employee.md                        # Employee lifecycle, bank/payroll, reports
│   ├── organization-master.md             # Company, Branch, Department, Designation, HOD, OCGrade
│   ├── roster-shift.md                    # Shifts, rosters, pattern expansion, assignment
│   ├── time-attendance.md                 # Biometric import, sync engine, anomaly detection
│   ├── leave-ot.md                        # Leave types, access rules, OT types, balances
│   └── reports.md                         # Dynamic employee reports, PDF/Excel export
│
├── rules/                                 # Validation rules, state machines, business constraints
│   ├── validation-rules.md                # All Zod schemas, DB constraints, business rules
│   └── state-machines.md                  # Leave status, roster assignment, attendance, swap
│
├── standards/                             # Entity naming conventions and API contracts
│   └── naming-conventions.md              # DB mapping, field naming, action patterns, constants
│
├── tasks/                                 # Feature implementation checklists
│   └── feature-checklists.md              # Module status + planned feature TODOs
│
├── tech-stack/                            # Target stack specifications
│   └── tech-stack.md                      # All dependencies, versions, dev tools
│
├── templates/                             # Standard module/controller/page templates
│   └── module-templates.md                # Server action, Zod schema, page, Prisma model templates
│
└── workflows/                             # User journeys, approvals, and data flows
    └── user-journeys.md                   # 8 workflow diagrams with Mermaid
```

---

## Quick Reference

| Question | Document |
|---|---|
| What tech stack does this project use? | [tech-stack.md](tech-stack/tech-stack.md) |
| How is the database structured? | [database-erd.md](architecture/database-erd.md) |
| How does authentication work? | [auth.md](modules/auth.md) |
| How are employees created? | [employee.md](modules/employee.md) |
| How does roster assignment work? | [roster-shift.md](modules/roster-shift.md) |
| How does attendance processing work? | [time-attendance.md](modules/time-attendance.md) |
| What leave rules exist? | [leave-ot.md](modules/leave-ot.md) |
| What validation rules are enforced? | [validation-rules.md](rules/validation-rules.md) |
| What features are planned vs implemented? | [feature-checklists.md](tasks/feature-checklists.md) |
| How do I create a new module? | [module-templates.md](templates/module-templates.md) |
| What naming conventions should I follow? | [naming-conventions.md](standards/naming-conventions.md) |
| Why were certain design decisions made? | [architectural-decisions.md](decisions/architectural-decisions.md) |

---

## Source Files Analyzed

| Category | Files Analyzed |
|---|---|
| **Prisma Schema** | `prisma/schema.prisma` (569 lines, 30 models, 7 enums) |
| **Server Actions** | 28 action files across `lib/server-actions/` |
| **Validation Schemas** | `lib/formSchema.ts` (374 lines, 25+ schemas), `lib/auth-schema.ts` (64 lines) |
| **Auth Configuration** | `lib/auth.ts`, `middleware.ts` |
| **UI Components** | 14 shared components + shadcn/ui primitives |
| **Route Pages** | 30+ pages across 6 route groups |
| **Constants** | `app/ems/data/constant.json` |
| **Package Config** | `package.json` (58 dependencies) |

---

**Total Documentation:** 18 documents · ~96 KB
