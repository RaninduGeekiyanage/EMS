# Architectural & Business Decisions

## ADR-001: Next.js App Router with Server Actions

**Status:** Implemented  
**Context:** Need a full-stack framework supporting SSR, RSC, and server-side mutations.  
**Decision:** Use Next.js 15 App Router with React Server Components and Server Actions for data mutations (no separate REST API layer for CRUD).  
**Rationale:**
- Eliminates boilerplate API routes for form submissions
- Colocation of validation schemas (Zod) shared between client and server
- Built-in Turbopack for fast development

---

## ADR-002: better-auth over NextAuth.js

**Status:** Implemented  
**Context:** Require email/password auth with role-based access, password reset via email, and session management.  
**Decision:** Use `better-auth` (v1.2.5) with Prisma adapter.  
**Rationale:**
- First-class Prisma adapter (no schema conflicts)
- Custom user fields (`role`, `empNo`, `activeStatus`) supported natively
- Built-in password reset flow with email sending
- 7-day session with 1-day rolling refresh

---

## ADR-003: Dual Employment Categories (Sri Lankan Labor Law)

**Status:** Implemented  
**Context:** Sri Lankan employment law distinguishes between "Shop and Office" and "Wages Board" employment categories with different leave entitlements.  
**Decision:** Implement two parallel leave-rule engines:
- `ShopAndOfficeLeaveAccessRule` — rules keyed by `(leaveTypeId, employmentStatus)`
- `WagesBoardLeaveAccessRules` — rules keyed by `(leaveTypeId, jobCategoryId)` with job-category-specific entitlement calculations  
**Rationale:** Legal compliance; leave entitlements differ based on employment category, employment status, and job category.

---

## ADR-004: Roster Pattern Expansion Strategy

**Status:** Implemented  
**Context:** Rosters define repeating shift patterns (daily, weekly, monthly). Employees need concrete per-day schedule entries for attendance matching.  
**Decision:** On roster assignment, **eagerly expand** the roster pattern into individual `EmployeeShiftSchedule` rows for every day within the roster's date range.  
**Rationale:**
- Enables direct per-day shift lookups during attendance processing
- Supports overrides (window adjustments, midnight spans) per schedule entry
- Batch insert with `skipDuplicates` for idempotency
- Batch size of 500 rows prevents memory issues

---

## ADR-005: Attendance Window-Based Punch Matching

**Status:** Implemented  
**Context:** Biometric fingerprint logs arrive as raw timestamps. Need to determine IN/OUT for each shift.  
**Decision:** Use configurable attendance windows (`inWindowBeforeStart`, `inWindowAfterStart`, `outWindowBeforeEnd`, `outWindowAfterEnd`) per shift, with per-schedule overrides.  
**Rationale:**
- Handles night shifts (`spansMidnight` flag)
- Accounts for early arrivals and late departures
- Window overrides enable per-employee exceptions without modifying shift master

---

## ADR-006: Employee Leave Balance Auto-Initialization

**Status:** Implemented  
**Context:** When a new employee is created, they need leave balances for all configured leave types.  
**Decision:** On employee creation (inside a Prisma transaction), iterate all leave types and auto-create `EmployeeLeaveBalance` entries with entitlements calculated from the applicable leave access rules.  
**Rationale:**
- Ensures every employee has balance records from day one
- Correctly applies SHOP_AND_OFFICE vs WAGES_BOARD entitlement rules
- Transaction guarantees atomicity (employee + balances)

---

## ADR-007: Roster Flag as Denormalized State

**Status:** Implemented  
**Context:** Need to quickly filter employees by roster assignment status.  
**Decision:** Store `rosterFlag` ("Y"/"N") directly on the Employee model, updated during roster assignment/removal.  
**Rationale:**
- Avoids expensive JOINs for filtering unassigned employees
- Updated atomically in the assignment transaction
- Reset to "N" on removal (with future schedule cleanup)

---

## ADR-008: Raw Fingerprint Log Staging Table

**Status:** Implemented  
**Context:** Biometric data arrives in bulk CSV uploads. Processing is separate from import.  
**Decision:** Two-phase pipeline: (1) Import into `raw_Fingerprint_log` with `processedFlag = false`, (2) `syncAttendance()` processes and marks as `processedFlag = true`.  
**Rationale:**
- Decouples import from processing (can re-process if needed)
- Duplicate prevention via latest-punch-date comparison on import
- Audit trail of all raw biometric data

---

## ADR-009: Role-Based Access via Middleware

**Status:** Implemented  
**Context:** Two user roles: `admin` (EMS panel) and `user` (employee self-service).  
**Decision:** Edge middleware validates session via `better-auth` API call and enforces route-level access based on `session.user.role`.  
**Rationale:**
- Centralized access control at the edge (before page rendering)
- Admin routes (`/ems/*`) blocked for "user" role
- Employee routes (`/emp-*`) restricted from admin panel
- Auth routes redirect authenticated users to their dashboard

---

## ADR-010: PDF/Excel Report Generation on Server

**Status:** Implemented  
**Context:** Employee reports need to be exportable in PDF and Excel formats.  
**Decision:** Use `jsPDF` + `jspdf-autotable` for PDF and `xlsx` for Excel, generating files server-side and saving to `public/exports/` with fallback to temp directory.  
**Rationale:**
- Server-side generation handles large datasets without browser memory limits
- Multiple fallback strategies for file system access
- Auto-cleanup via timestamped filenames
