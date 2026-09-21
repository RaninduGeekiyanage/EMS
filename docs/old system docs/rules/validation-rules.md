# Validation Rules & Business Constraints

## 1. Entity-Level Validation Rules

### Employee

| Rule | Implementation | Schema/Action |
|---|---|---|
| Employee number must be unique | `findUnique({ empNo })` check before create | `saveEmployee` |
| Email must be unique | Prisma `@unique` constraint | Schema-level |
| NIC: 9-16 characters | `z.string().min(9).max(16)` | `formSchema` |
| Mobile: 10-13 digits | `z.string().min(10).max(13)` | `formSchema` |
| Landline: 10-11 digits | `z.string().min(10).max(11)` | `formSchema` |
| Address: 5-300 chars | `z.string().min(5).max(300)` | `formSchema` |
| Job Category required for WAGES_BOARD | Zod `.refine()` conditional | `formSchema` |
| Date of birth must be valid date | `Date.parse()` refine | `formSchema` |

### Shift

| Rule | Implementation |
|---|---|
| Shift name must be unique | `findUnique({ shiftName })` check |
| Non-off shifts require all time fields | `superRefine` conditional validation |
| Time fields must be `HH:MM` format | Regex `/^([0-1]\d\|2[0-3]):([0-5]\d)$/` |
| Session must be valid to create shift | `auth.api.getSession()` check |

### Roster

| Rule | Implementation |
|---|---|
| Roster name required | `z.string().min(1)` |
| Branch required | `z.string().min(1)` |
| Date range must be valid | `fromDate` and `toDate` required |
| Pattern saved in transaction with roster | `$transaction` atomic |

### Roster Assignment

| Rule | Implementation |
|---|---|
| Effective date must be valid | `Date.parse()` check |
| First assignment: effective ≥ roster start | Date comparison validation |
| Re-assignment: effective > previous effectiveTo | Latest assignment lookup + comparison |
| Duplicate prevention | `createMany({ skipDuplicates: true })` |

### Leave Type

| Rule | Implementation |
|---|---|
| Only one ANNUAL type | `findFirst()` check before create |
| Only one CASUAL type | `findFirst()` check before create |
| Name must be unique | Prisma `@unique` + P2002 handler |

### HOD

| Rule | Implementation |
|---|---|
| One HOD per department per company per branch | `@@unique([companyId, branchId, departmentId])` |
| Employee can only be HOD once | `empNo @unique` on DepartmentHead |
| P2002 duplicate handled gracefully | Error code check in action |

### Company/Branch/Department/Designation

| Rule | Implementation |
|---|---|
| Name uniqueness (case-insensitive) | `findFirst({ contains, mode: "insensitive" })` |
| Required fields must not be empty | `z.string().min(1)` |

---

## 2. Leave Access Rule Constraints

### Wages Board Rules

| Constraint | Implementation |
|---|---|
| Unique per `(leaveTypeId, jobCategoryId)` | `@@unique` composite constraint |
| carryForward → carryForwardValidUntill > 0 | Zod `.refine()` conditional |
| Employment status must be valid enum | `z.nativeEnum(EmploymentStatus)` |

### Shop & Office Rules

| Constraint | Implementation |
|---|---|
| Same validation as Wages Board (minus jobCategoryId) | Parallel schema |
| carryForward → carryForwardValidUntill > 0 | Zod `.refine()` conditional |

---

## 3. Attendance Processing Rules

| Rule | Description |
|---|---|
| IN detected: first punch within `[inStart, inEnd]` | Window-based matching |
| OUT detected: last punch within `[outStart, outEnd]` after IN | Ordered by time, last match |
| MISSING_IN anomaly | No punch in IN window → RED severity |
| MISSING_OUT anomaly | IN found but no OUT → RED severity |
| Status: PRESENT | Both IN and OUT detected |
| Status: HALF_DAY | Only IN or only OUT |
| Status: ABSENT | Neither IN nor OUT |
| Midnight span handling | endDt += 24h if `spansMidnight` or `endDt < startDt` |
| 5-minute safety buffer | Logs within ±5min of window boundaries included |
| Duplicate prevention | `@@unique([empNo, shiftScheduleId])` |

---

## 4. Authentication Rules

| Rule | Implementation |
|---|---|
| Password: 6-50 characters | Zod schema |
| Email: valid format | `z.string().email()` |
| Name: 2-50 characters | Zod schema |
| Password reset: passwords must match | `.refine()` comparison |
| Session: 7-day expiry | `better-auth` config |
| Session: 1-day rolling refresh | `better-auth` config |
| Unauthenticated → redirect to sign-in | Middleware |
| "user" role restricted to employee routes | Middleware path check |

---

## 5. Report Constraints

| Rule | Implementation |
|---|---|
| At least 1 field must be selected | `z.array().min(1)` |
| Filter values: "all" or valid ID | `z.union([literal("all"), string(), number()])` |
| Employment category required | `z.string().min(1)` |
| Employment status required | `z.string().min(1)` |
| No data → export blocked | `data.length === 0` check |
