# M02 Shift Management & Duty Roster Standard Operating Workflows

## 1. Executive Summary & Industry Architecture

In alignment with world-class Workforce Management (WFM) platforms (e.g. **Deputy**, **UKG Pro**, **Workday HCM**), the EMS Attendance Management System (M02) enforces a clean architectural separation between:
1. **Shift Definitions Master Catalog** (`/shifts`) — Atomic working hours, break schedules, and overtime rules.
2. **Permanent Baseline Shift Assignments** (`/shifts` tab) — Ongoing contractual shift assignments for fixed-schedule personnel (individual and bulk).
3. **Roster Patterns & Templates Library** (`/roster/patterns`) — Reusable weekly and cyclical rotation schemes designed on a dedicated visual timeline canvas.
4. **Operational Duty Roster Planner** (`/roster`) — Time-bound monthly calendar grid for scheduling, cell overrides, shift swaps, fatigue compliance, and payroll freeze locking.

```
┌───────────────────────────────────────────────────────────────────────────────────┐
│ 1. Atomic Shift Master Catalog (`shifts` table)                                   │
│    URL: [/shifts]                                                                 │
│    • Standard presets (General Day, Morning, Evening, Night, Saturday Half-Day)   │
│    • Custom shift builder with start/end, breaks, grace period, OT threshold      │
└─────────────────────────┬──────────────────────────────────┬──────────────────────┘
                          │                                  │
                          ▼                                  ▼
┌─────────────────────────────────────────┐  ┌──────────────────────────────────────┐
│ 2. Permanent Baseline Assignments       │  │ 3. Dedicated Roster Patterns Library │
│    URL: [/shifts] (Permanent Tab)       │  │    URL: [/roster/patterns]           │
│    • Contractual shifts for 9–5 staff   │  │    • Visual sequence timeline builder│
│    • Single & Bulk multi-employee assign│  │    • 7-Day Weekly & Cyclical N-Day   │
│    • Effective from/to date boundaries  │  │    • Direct Bulk Roster Assignment   │
└─────────────────────────────────────────┘  └──────────────────┬───────────────────┘
                                                                │
                                                                ▼
┌───────────────────────────────────────────────────────────────────────────────────┐
│ 4. Operational Duty Roster Planner (`roster_entries` table)                       │
│    URL: [/roster]                                                                 │
│    • Interactive monthly grid (Rows = Staff, Columns = Days 1 to 31)              │
│    • High-performance batch generation (Saved Template or Custom On-the-Fly)      │
│    • Symmetrical bulk employee assignment (All Staff, By Dept, Specific Multi)   │
│    • Preserves approved employee leaves automatically                             │
│    • Worker fatigue safety turnaround alert (Shop & Office Act: < 11h warning)    │
│    • Real-time cell overrides & atomic peer-to-peer shift swaps                   │
│    • Auto-freeze on finalized M03 Payroll runs (locks tampering & audit trail)    │
└───────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Core Workflows

### 2.1 Workflow 1: Define Shifts (Standard Presets & Custom Shifts)
**Navigation:** `Attendance` $\rightarrow$ `Shifts & Schedules` (`/shifts`)

1. **Standard Presets (One-Click Auto-Seed):**
   - Click the **"Populate SL Presets"** button in the header.
   - Automatically populates standard Sri Lankan work shifts:
     - `GEN-DAY`: General Office (08:30 – 17:00, 60m break, 15m grace, 480m OT threshold)
     - `MORN-01`: Morning Factory (06:00 – 14:00, 45m break, 10m grace)
     - `EVE-01`: Evening Operational (14:00 – 22:00, 45m break, 10m grace)
     - `NIGHT-01`: Night Security/Factory (22:00 – 06:00, crosses midnight flag, 60m break)
     - `SAT-HALF`: Saturday Half-Day (08:30 – 13:00, 0m break, 270m OT threshold)
2. **Custom Shift Creation:**
   - Click **"+ Create New Shift"**.
   - Fill in:
     - **Shift Name & Code**: e.g., "Special Maintenance", `MAINT-01`.
     - **Shift Type**: Regular, Rotational, Split, or Flexible.
     - **Working Hours**: Start Time and End Time (24h format).
     - **Unpaid Break Minutes**: Automatically deducted from raw punch duration.
     - **Grace Period**: Permissible tardiness minutes before marking Late.
     - **Overtime Threshold**: Minutes of active work required before OT hours begin accruing.
     - **Night Shift Crosses Midnight**: Check if the shift terminates on the subsequent calendar day.

---

### 2.2 Workflow 2: Dedicated Roster Pattern Creation (`/roster/patterns`)
**Navigation:** `Attendance` $\rightarrow$ `Roster Patterns` (`/roster/patterns`)

Instead of cluttering the monthly duty roster matrix with pattern definitions, patterns are created and managed on their own dedicated screen:

1. **Pattern Catalog Overview:**
   - High-level metric cards: Total Roster Patterns, Weekly 7-Day Schemes, Cyclical Rotations, Active Personnel.
   - Visual cards showing pattern type, cycle length, active status, and an interactive **Sequence Timeline** of shift chips.
2. **Creating a Pattern:**
   - Click **"+ Create Roster Pattern"**.
   - **Pattern Mode**:
     - **Weekly 7-Day Schedule**: Assign a specific shift or toggle **Rest Day (OFF)** for Monday through Sunday.
     - **Rolling Cyclical Rotation**: Define an $N$-step sequence (e.g. 4 consecutive days of Morning Shift followed by 2 consecutive Rest Days). Add or remove steps dynamically.
   - Save the pattern. It is immediately available for single or bulk assignments.

---

### 2.3 Workflow 3: Symmetrical Shift & Roster Assignments

The system supports two complementary assignment models depending on operational intent:

#### Model A: Assign Roster Pattern to Employees (Bulk or Individual)
**Executed from:**
- **Roster Patterns Screen (`/roster/patterns`)**:
  1. Click **"Assign to Staff"** on any pattern card.
  2. Select target date range (`Start Date` and `End Date`).
  3. Filter employees by Department or Designation, or use the real-time search box.
  4. Use the **"Select All Visible"** button or individual checkboxes to choose staff members in bulk.
  5. Toggle **"Preserve Approved Leaves"** (defaults to active).
  6. Click **"Assign Roster to X Personnel"**. The backend invokes `RosterService::generateRoster` with a 250-row chunked database `upsert`.
- **Duty Roster Planner (`/roster`)**:
  1. Click **"Generate Roster"**.
  2. Choose **"Apply Saved Template"** and select the pattern from the dropdown.
  3. Under **Target Personnel Scope**, select **"All Personnel"**, **"By Department"**, or **"Specific Staff"** (with search, "Select Visible", and individual check selections).
  4. Click **"Generate Roster"**.

#### Model B: Assign Permanent Baseline Shift to Employees (Bulk or Individual)
**Executed from:** `Attendance` $\rightarrow$ `Shifts & Schedules` (`/shifts`) $\rightarrow$ **"Permanent Baseline Assignments"** tab.

1. Click **"+ Assign Baseline Shift"**.
2. Select the **Shift** to assign (e.g., General Day `GEN-DAY`).
3. Set the **Effective From** date.
4. Select assignment mode:
   - **Single Employee**: Select an individual employee from the searchable dropdown.
   - **Bulk Staff Assignment**: Filter by department, search by name/ID, click **"Select All Visible"**, or check off multiple staff members simultaneously.
5. Click **"Save Baseline Shift Assignment"**.
6. The attendance engine automatically uses this baseline shift indefinitely without requiring monthly duty rosters.

---

### 2.4 Workflow 4: Compliance & Safeguards

1. **Statutory Fatigue Turnaround Alerts:**
   - Under Sri Lankan Shop & Office Employees Act regulations and international labor standards, employees must receive at least **11 consecutive hours of rest** between shifts.
   - When a transition provides less than 11 hours (e.g., Night Shift ending at 06:00 followed by an Afternoon or Morning Shift at 14:00 on the same or next day), the cell displays an amber compliance badge: `⚠️ Rest 8.0h`.
2. **Preservation of Approved Leaves:**
   - When generating duty rosters or assigning patterns in bulk, pre-approved leave requests (`status = 'approved'`) are protected. The generator marks the cell with the employee's approved leave badge (e.g., `ANN`, `CAS`, `MED`) instead of overwriting it with a work shift.
3. **M03 Payroll Freeze Lock:**
   - Once a monthly payroll run is locked by the Finance/Payroll department (`status = 'locked'`), the duty roster for that month is frozen. Roster generation, single-cell edits, and shift swaps are disabled to preserve auditability and prevent financial tampering.

---

## 3. Automated Test Coverage

The entire M02 Shift and Roster workflow is covered by comprehensive automated tests:

| Test Class | Scope | Status |
| :--- | :--- | :--- |
| `Tests\Unit\RosterServiceTest` | 7-Day Weekly, Cyclical 4x2, single cell overrides, shift swaps, publish/draft states | **PASSED** (5/5) |
| `Tests\Feature\M02\RosterPatternManagementTest` | Roster Pattern catalog, weekly builder, bulk pattern assignment, bulk shift assignment | **PASSED** (4/4) |
| `Tests\Feature\M02\RosterEnterpriseHardeningTest` | Leave preservation, <11h fatigue warning, locked payroll freeze, CSV noticeboard export | **PASSED** (4/4) |
| `Tests\Feature\M02\RosterManagementTest` | Planner view rendering, HTTP POST roster generation, single-cell updates, tenant isolation | **PASSED** (4/4) |
| `Tests\Feature\M02\ShiftManagementTest` | Shift creation, updates, baseline shift assignment, tenant isolation | **PASSED** (5/5) |
| `Tests\Feature\M02\AttendanceRosterIntegrationTest` | Attendance engine integration with rostered rest days vs shifts | **PASSED** (2/2) |

Full M02 suite execution: **50 passed, 163 assertions, 0 failures**.
