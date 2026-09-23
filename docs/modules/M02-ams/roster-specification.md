# M02 Duty Roster System Specification

## 1. Domain Architecture & Separation of Concerns

In enterprise workforce management, employee work schedules operate across three distinct functional tiers:

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Shift Definitions (`shifts`)                             │
│    - Master time definitions (Start/End times, Breaks, OT)  │
│    - Color tags, Night-shift indicator                     │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Contractual Default Assignments (`shift_assignments`)    │
│    - Permanent fallback shift for standard 9-5 personnel    │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Duty Roster (`roster_entries` & `roster_patterns`)       │
│    - Actual operational schedule per employee per day       │
│    - Multi-month and multi-year planning horizons           │
│    - Dynamic rest days (OFF) vs Working shifts              │
│    - Multi-mode pattern generation engine                   │
│    - Shift swapping & cell-level overrides                  │
│    - Precedence over baseline assignments                   │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Multi-Mode Pattern Generation Engine

When scheduling a roster across any date range (e.g. Next Month, 3 Months, 6 Months, or 1 Year in advance), the system supports four industry-standard pattern generation modes:

### 2.1 7-Day Weekly Matrix Mode
- Maps each day of the week (Monday through Sunday) to an explicit work shift or Rest Day (`is_rest_day = true`).
- Example Commercial Schedule: Mon–Fri (General Day `GEN-DAY`), Sat (Half-Day `SAT-HALF`), Sun (Rest Day `OFF`).
- Repeats automatically every 7 days across the selected date range.

### 2.2 Rolling N-Day Cyclical Mode
- Designed for continuous 24/7 operations (manufacturing, hospitality, healthcare, IT support, security).
- Loops through an ordered sequence of $N$ steps starting from an anchor date, repeating continuously regardless of days of the week.
- Example **4-on-2-off**: 4 days Morning Shift $\rightarrow$ 2 days Off.
- Example **Continuous 3-Shift Cycle (16-day block)**: 4 Morning $\rightarrow$ 4 Evening $\rightarrow$ 4 Night $\rightarrow$ 4 Off.

### 2.3 Daily Single Shift Mode
- Fast mass-assignment of a single designated shift across a target range, with customizable weekly rest days (e.g., exclude Sundays).

### 2.4 Month-to-Month Clone Mode
- Duplicates all shift and rest day assignments from a previous month onto the target month, preserving day-of-month arrangements.

---

## 3. Database Schema

### `roster_entries` Table
- `id` (ULID, Primary Key)
- `tenant_id` (ULID, Foreign Key `tenants.id`, Cascade)
- `employee_id` (ULID, Foreign Key `employees.id`, Cascade)
- `roster_date` (Date: YYYY-MM-DD)
- `shift_id` (ULID, Foreign Key `shifts.id`, Nullable, Null on Delete)
- `schedule_type`: `shift` | `rest_day` | `off`
- `status`: `draft` | `published` | `locked`
- `is_overridden`: `boolean` (Tracks manual adjustments from generated patterns)
- `notes`: `varchar(255)`
- `created_by`: `bigint unsigned` (Foreign Key `users.id`, Null on Delete)
- Unique Index: `['tenant_id', 'employee_id', 'roster_date']`

### `roster_patterns` Table
- `id` (ULID, Primary Key)
- `tenant_id` (ULID, Foreign Key `tenants.id`, Cascade)
- `name`: `varchar(150)`
- `code`: `varchar(50)`
- `pattern_type`: `daily` | `weekly` | `cyclical`
- `cycle_length_days`: `integer`
- `pattern_data`: `json`
- `is_active`: `boolean`

---

## 4. Attendance Engine Integration

Prior to this implementation, the attendance processor hardcoded Sunday as the only non-working day, falsely marking employees absent on weekday rest days.

The updated `AttendanceProcessingService` determines absence and rest days via the following precedence order:
1. **Approved Leave**: Status marked as `leave` or `half_day`.
2. **Public Holiday**: Status marked as `holiday`.
3. **Scheduled Duty Roster Entry**:
   - If `schedule_type == 'rest_day'` and no biometric punch is found $\rightarrow$ Status is **`rest_day`** (eliminates false absentee penalty).
   - If `schedule_type == 'shift'` and no punch is found $\rightarrow$ Status is **`absent`**.
   - If employee punches on a rostered rest day $\rightarrow$ Status is `present` and calculated with Rest Day Overtime.
4. **Fallback (Backward Compatibility)**: If no roster entry exists, fall back to permanent `shift_assignments` and default Sunday rest days.

---

## 5. Role-Based Access Control (RBAC)

## 5. Role-Based Access Control (RBAC) & Lifecycle Governance

### 5.1 Spatie Permissions
Granular Spatie permissions under the `'ams'` domain:
- `roster.view`: Access the Duty Roster matrix view.
- `roster.create`: Execute bulk roster generation across date ranges.
- `roster.update`: Edit individual cells and perform operational overrides.
- `roster.publish`: Publish draft rosters to activate attendance matching.
- `roster.delete`: Discard pure draft rosters.
- `roster.archive`: Archive published rosters once operational cycle concludes.

### 5.2 Roster Lifecycle & Biometric Historical Safeguards
In adherence to statutory audit requirements and biometric payroll processing, rosters adhere to strict lifecycle invariants:
1. **Pure Draft Discard**:
   - A draft roster that has **never been published** (`published_at IS NULL`) may be permanently discarded/deleted (`DELETE /roster/rosters/{roster}`).
   - Deleting a pure draft deletes its squad definitions and unverified entries cleanly without impacting biometric records.
2. **Published Roster Deletion Guard**:
   - Once a roster is published (`published_at IS NOT NULL`), it can **never be deleted**, even if temporarily reverted to draft mode (`status = 'draft'`).
   - Attempting to delete a previously published roster triggers a `DomainException: "Cannot delete a roster that has been published. Biometric and payroll audit trails depend on published rosters. Please archive the roster instead."`
3. **Archival (`archiveRoster`)**:
   - Concluded or retired rosters are transitioned to `archived` (`POST /roster/rosters/{roster}/archive`), removing them from active scheduling while permanently safeguarding historical attendance and biometric calculations.

### 5.3 Single Active Roster Exclusivity
- An employee can belong to **only one active (non-archived) roster** for any overlapping date range.
- `RosterService::getAvailableEmployees()` and `RosterService::enrollEmployees()` enforce exclusivity across both squad memberships (`roster_group_members`) and direct cell assignments (`roster_entries`).
- Prevents double-booking, scheduling conflicts, and conflicting biometric shift matching.

### 5.4 Shift Swap Governance
- Shift swaps are strictly centralized under `/roster/shift-swaps`.
- Ad-hoc, unapproved shift overrides are replaced with standard industrial trade requests:
  - Mutual agreement between employees.
  - Department HOD review and approval.
  - Shift turnaround fatigue check (<11h rest detection).
  - Atomic roster transposition and audit logging upon approval.

---

## 6. Enterprise Hardening & Statutory Safeguards

### 6.1 Worker Fatigue & Rest Interval Detection
- **Statutory Precedent**: Sri Lankan Shop & Office Employees Act (No. 19 of 1954) and Factories Ordinance mandate sufficient rest turnaround intervals between consecutive working shifts to prevent occupational hazards and worker burnout.
- **Rule**: If the elapsed interval between the end of a shift on day $D$ and the start of the next shift on day $D+1$ is $< 11.0$ hours (or if transitioning directly from a Night Shift into a Morning Shift), the system computes the turnaround deficit.
- **UI Flag**: Rather than hard-blocking operational scheduling, the roster matrix highlights the cell with an amber warning badge (`⚠️ Rest X.Xh`), giving management full operational discretion while maintaining transparency.

### 6.2 Approved Leave Preservation (`preserve_leaves`)
- When generating a roster over a date range, existing approved employee leaves (`LeaveRequest::status == 'approved'`) are protected by default (`preserve_leaves = true`).
- The pattern engine detects pre-approved leaves and retains the cell as a statutory Leave entry (`LV`), preventing automated schedules from overwriting authorized absences.

### 6.3 Departmental Personnel & Squad Matrix Visibility
- The roster matrix groups personnel transparently:
  - Squad members are grouped under their respective Squad Headers (with squad color coding and pattern indicators).
  - All other active department personnel are grouped under **"Department Personnel / Direct Assigned"**.
  - No active employee is hidden from the operational cockpit when squads exist.

### 6.4 Daily Shift Coverage Headcount Summary
- The roster matrix includes a sticky summary footer (`tfoot`) dynamically aggregating daily staffing levels for all days 1 through 31:
  - **Total Working Staff**: Personnel rostered to active working shifts.
  - **Total Rest Days (OFF)**: Personnel rostered to non-working rest days.
  - **Total Approved Leaves**: Personnel on authorized leave.

### 6.5 Noticeboard Matrix Export & Print Layout
- **Streaming CSV Export**: Endpoint `/roster/export` generates a UTF-8 BOM CSV matrix formatted for spreadsheet tools and external auditing, containing employee details, daily shift codes, totals, and daily coverage footers.
- **High-Contrast Print Stylesheet**: Dedicated `@media print` CSS formats the planner matrix into a clean, printable noticeboard sheet with company branding and legend.

---

## 7. Financial Finalization Lock Precedence

- **Integration**: Linked to the M03 Payroll Processing module.
- **Behavior**: When an M03 Payroll Run is finalized and transitioned to `locked` via `PayrollRunController::lock()`, all matching `roster_entries` for that month are updated to `status = 'locked'`.
- **Enforcement**: `RosterService::ensureNotLocked()` actively prevents any subsequent generation, single-cell edits, shift swaps, publishing changes, or deletions for that payroll period, preserving immutable audit integrity for statutory EPF/ETF and tax computations.

---

## 8. Database Transaction Safety & Bulk Performance Architecture

### 8.1 Atomic Transactions (`DB::transaction`)
- All multi-query mutations (`generateRoster`, `updateEntry`, `swapShift`, `publishRoster`, `clearRoster`) are wrapped in `DB::transaction(...)`.
- If an exception occurs (e.g., integrity failure, worker fatigue error, or network disconnect), all temporary queries are rolled back atomically with zero partial data corruption.

### 8.2 Low-Memory Chunked Upserts
- Roster generation across large enterprises (e.g., 500+ employees over 365 days = 182,500 records) utilizes **250-record chunked database `upsert`** operations rather than hydrating thousands of Eloquent models.
- Keeps PHP memory usage below 5 MB and executes multi-month generations in sub-second times on standard shared-hosting infrastructure.

### 8.3 Glassmorphic UI Loading Overlays
- The frontend UI utilizes an unmissable full-screen blurred-glass overlay (`isGlobalProcessing`) with animated spinners during roster generation, swaps, and clears to prevent browser unresponsiveness, accidental navigation, or duplicate form submissions.

