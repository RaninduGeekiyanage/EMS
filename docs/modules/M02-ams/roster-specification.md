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

Dedicated granular Spatie permissions under the `'ams'` domain:
- `roster.view`: Access the Duty Roster matrix view.
- `roster.create`: Execute bulk roster generation across date ranges.
- `roster.update`: Edit individual cells and perform atomic shift swaps.
- `roster.publish`: Publish draft rosters to activate attendance matching.
- `roster.delete`: Clear roster schedules.
