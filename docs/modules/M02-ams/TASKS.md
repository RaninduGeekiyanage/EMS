# M02 — AMS Detailed Tasks

## Phase 1: Shifts & Work Calendars
- [x] Shift Models & Management
  - [x] File: database/migrations/2026_01_01_000031_create_shifts_table.php
  - [x] File: database/migrations/2026_01_01_000032_create_shift_assignments_table.php
  - [x] File: database/migrations/2026_01_01_000033_create_public_holidays_table.php
  - [x] File: app/Models/Shift.php
  - [x] File: app/Models/PublicHoliday.php
  - [x] File: app/Services/ShiftService.php
  - [x] File: app/Http/Controllers/ShiftController.php
  - [x] File: resources/js/Pages/Shifts/Index.tsx
  - [x] File: resources/js/Pages/WorkCalendar/Index.tsx

## Phase 2: Biometric Ingestion & Adapters
- [x] Import Engine
  - [x] File: database/migrations/2026_01_01_000040_create_attendance_imports_table.php
  - [x] File: database/migrations/2026_01_01_000041_create_attendance_logs_table.php
  - [x] File: app/Contracts/BiometricImportAdapterInterface.php
  - [x] File: app/Services/Biometric/ZKTecoAdapter.php
  - [x] File: app/Services/Biometric/GenericCsvAdapter.php
  - [x] File: app/Services/Biometric/ExcelAdapter.php
  - [x] File: app/Services/AttendanceImportService.php
  - [x] File: app/Http/Controllers/AttendanceImportController.php
  - [x] File: resources/js/Pages/Attendance/Import.tsx

## Phase 3: Attendance Processing & OT
- [x] Daily Ledger Calculation
  - [x] File: database/migrations/2026_01_01_000042_create_attendance_daily_table.php
  - [x] File: database/migrations/2026_01_01_000043_create_attendance_rules_table.php
  - [x] File: app/Models/AttendanceDaily.php
  - [x] File: app/Models/AttendanceRule.php
  - [x] File: app/Services/AttendanceProcessingService.php
  - [x] File: app/Services/OvertimeCalculationService.php
  - [x] File: app/Http/Controllers/AttendanceDailyController.php
  - [x] File: resources/js/Pages/Attendance/Daily.tsx
  - [x] File: tests/Feature/M02/AttendanceProcessingTest.php

## Phase 4: Leave Management
- [ ] Leave Entitlements & Requests
  - [ ] File: database/migrations/2026_01_01_000050_create_leave_types_table.php
  - [ ] File: database/migrations/2026_01_01_000051_create_leave_entitlements_table.php
  - [ ] File: database/migrations/2026_01_01_000052_create_leave_requests_table.php
  - [ ] File: app/Models/LeaveType.php
  - [ ] File: app/Models/LeaveRequest.php
  - [ ] File: app/Services/LeaveService.php
  - [ ] File: app/Http/Controllers/LeaveRequestController.php
  - [ ] File: resources/js/Pages/Leave/Requests.tsx
