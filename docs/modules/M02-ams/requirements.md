# M02 Requirements Specification

## 1. Shift, Roster & Calendar Management
- **Configurable Shift Definitions**: Start time, end time, grace period minutes, break duration, night shift flag, color code, and overtime threshold.
- **Enterprise Duty Roster Planner**:
  - Interactive monthly matrix grid with employee rows, day-by-day shift badges, and real-time monthly stats.
  - Multi-mode pattern generation engine: 7-day weekly matrix, rolling N-day cyclical rotation, daily single shift, and month-to-month cloning across multi-month/multi-year horizons.
  - Dynamic rest day allocation (`OFF`), eliminating false absentee flags during attendance processing.
  - Single cell inline edit popover and atomic shift swapping between employees.
  - Draft and published status lifecycle with managerial publish gatekeeping.
- **Calendar Setup**: Statutory, mercantile, and Poya public holidays in Sri Lanka.

## 2. File Import (Phase 1) & Biometric Integration
- Ingest raw attendance punch files without requiring dedicated machine drivers.
- Provide data mapping configuration per tenant (column positions, datetime format).
- Preview and validation interface before finalizing import to `attendance_logs`.

## 3. Processing & Overtime Engine
- Pair check-in and check-out punches automatically.
- Determine late minutes and early departure deductions based on tenant settings.
- Calculate overtime hours in compliance with the Shop & Office Employees Act.

## 4. Leave Processing
- Entitlement tracking per calendar/service year with mid-year joiner proration.
- Leave requests with manager approval workflow.
- Approved leave marks daily attendance as `leave` and suppresses absentee flags.
