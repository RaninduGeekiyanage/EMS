# M02 — AMS Detailed Tasks

## Phase 1: Shifts & Work Calendars
- [ ] Shift Models & Management
  - [ ] File: database/migrations/2026_01_01_000030_create_shifts_table.php
  - [ ] File: database/migrations/2026_01_01_000031_create_shift_assignments_table.php
  - [ ] File: database/migrations/2026_01_01_000032_create_public_holidays_table.php
  - [ ] File: app/Models/Shift.php
  - [ ] File: app/Models/PublicHoliday.php
  - [ ] File: app/Services/ShiftService.php
  - [ ] File: app/Http/Controllers/ShiftController.php
  - [ ] File: resources/js/Pages/Shifts/Index.tsx
  - [ ] File: resources/js/Pages/WorkCalendar/Index.tsx

## Phase 2: Biometric Ingestion & Adapters
- [ ] Import Engine
  - [ ] File: database/migrations/2026_01_01_000040_create_attendance_imports_table.php
  - [ ] File: database/migrations/2026_01_01_000041_create_attendance_logs_table.php
  - [ ] File: app/Contracts/BiometricImportAdapterInterface.php
  - [ ] File: app/Services/Biometric/ZKTecoAdapter.php
  - [ ] File: app/Services/Biometric/GenericCsvAdapter.php
  - [ ] File: app/Services/Biometric/ExcelAdapter.php
  - [ ] File: app/Services/AttendanceImportService.php
  - [ ] File: app/Http/Controllers/AttendanceImportController.php
  - [ ] File: resources/js/Pages/Attendance/Import.tsx

## Phase 3: Attendance Processing & OT
- [ ] Daily Ledger Calculation
  - [ ] File: database/migrations/2026_01_01_000042_create_attendance_daily_table.php
  - [ ] File: app/Models/AttendanceDaily.php
  - [ ] File: app/Services/AttendanceProcessingService.php
  - [ ] File: app/Services/OvertimeCalculationService.php
  - [ ] File: app/Http/Controllers/AttendanceDailyController.php
  - [ ] File: resources/js/Pages/Attendance/Daily.tsx

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
  - [ ] File: tests/Feature/M02/AttendanceProcessingTest.php
