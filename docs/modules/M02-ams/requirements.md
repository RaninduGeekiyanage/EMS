# M02 Requirements Specification

## 1. Shift & Calendar Management
- Configurable shift definitions: start time, end time, grace period minutes, break duration.
- Shift allocation to employees or departments with roster scheduling.
- Calendar setup for statutory, mercantile, and Poya public holidays in Sri Lanka.

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
