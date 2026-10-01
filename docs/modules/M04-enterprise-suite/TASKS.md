# M04: Master Implementation Task Checklist

## Phase 1: Attendance Exception, OT Approval & Regularization Engine (M04-A)
- [x] **M04-A01**: Create migration `create_attendance_regularization_requests_table` (supports missing punch, unapproved half day, outstation OD slips with 2-tier approval and HR bypass).
  - *Completed*: Created `2026_10_01_000001_create_attendance_regularization_requests_table.php` with ULID PK, tenant isolation, request types (`missing_punch`, `unapproved_half_day`, `on_duty_gate_pass`, `overtime_claim`), 2-tier lifecycle (`pending_hod`, `pending_hr`, `approved`, `rejected`), soft deletes, and MySQL 64-char identifier safe indexes (`idx_reg_tenant`, `idx_reg_status`, `idx_reg_date`, `idx_reg_emp_date`).
- [x] **M04-A02**: Implement `AttendanceRegularizationRequest` model with scopes, HOD/HR relationships, and status state machine.
  - *Completed*: Implemented `App\Models\AttendanceRegularizationRequest` with `BelongsToTenant`, `HasUlids`, `SoftDeletes`, scopes (`pendingHod`, `pendingHr`, `approved`, `rejected`, `forDateRange`, `forEmployee`), and state machine helpers (`canBeActionedByHod`, `canBeActionedByHr`). Also created `AttendancePeriodLock` model and updated `AttendanceDaily` and `Employee` relations.
- [x] **M04-A03**: Implement `AttendanceRegularizationService` (cut-off validation, anti-overlap, HOD recommendation, HR confirmation/bypass, punch ledger synchronization).
  - *Completed*: Built `App\Services\AttendanceRegularizationService` enforcing:
    1. Cut-off freeze validation (`isPeriodLocked` prevents submissions in locked HR periods).
    2. Anti-overlap validation (prevents duplicate active regularization requests for the same employee and date).
    3. Time order sanity checks (check-out after check-in).
    4. Dynamic approval routing: Auto-routes to HOD if appointed and permitted (`attendance.hod_approve_regularization`), otherwise auto-escalates directly to HR (`pending_hr`).
    5. Punch ledger synchronization upon approval via `adjustDailyRecord`, clearing anomalies and setting `is_paid = true`.
- [x] **M04-A04**: Create `AttendanceRegularizationController` with endpoints for employee submission, HOD review, HR direct bypass, and approval actions.
  - *Completed*: Built `AttendanceRegularizationController` with FormRequests (`StoreRegularizationRequest`, `ActionRegularizationRequest`). Provides endpoints for index listing, submission, HOD action (`/hod-action`), and HR action / bypass (`/hr-action`).
- [x] **M04-A05**: Create migration to add `approved_ot_hours`, `approved_double_ot_hours`, `ot_approval_status`, and `ot_approved_by` to `attendance_daily`.
  - *Completed*: Created `2026_10_01_000002_add_ot_approval_and_paid_flags_to_attendance_daily_table.php` adding `approved_ot_hours`, `approved_double_ot_hours`, `ot_approval_status`, `ot_approved_by`, `ot_approval_remarks`, and explicit `is_paid` boolean flag.
- [x] **M04-A06**: Implement Granular Overtime (OT) Approval Service & endpoints (HOD approves full OT or specific partial hours; HR confirms or directly overrides).
  - *Completed*: Implemented `approveOvertime()` supporting `'approve_all'`, `'partial'`, and `'reject'` modes with mandatory remarks for overrides and dual-tier status (`hod_approved` vs `hr_confirmed`). Exposed via `POST /attendance/daily/{id}/approve-ot`.
- [x] **M04-A07**: Add Attendance Anomaly Resolution endpoints (`AttendanceAnomalyController`) with 1-click Paid Half Day waiver, Retro-Leave conversion, or No-Pay confirmation.
  - *Completed*: Built `AttendanceAnomalyController` and service method `resolveUnapprovedHalfDay()` with three auditable pathways:
    - *Mechanism A*: Punch Regularization via regularization engine (`status = 'present'`, `is_paid = true`).
    - *Mechanism B*: Retroactive Leave Conversion (creates 0.5-day approved LeaveRequest and deducts from `LeaveEntitlement`).
    - *Mechanism C*: Managerial Discretion (Paid Waiver) with audit justification without altering biometric records.
- [x] **M04-A08**: Build UI `resources/js/Pages/Attendance/Anomalies.tsx` (Exception Action Center with OT approval modal and regularization drawers).
  - *Completed*: Created `resources/js/Pages/Attendance/Anomalies.tsx` and `resources/js/Pages/Attendance/Regularizations.tsx`. Features dark-mode UI with KPI metric cards, filter bars, interactive resolution modals, granular OT approval sliders, and regularization drawers.
- [x] **M04-A09**: Implement Monthly Attendance Period Freeze & Sign-Off (`/attendance/timesheet/freeze`) with HOD team sign-off and HR final period lock.
  - *Completed*: Created migration `2026_10_01_000003_create_attendance_period_locks_table.php` and service method `freezePeriod()`. Supports HOD department-level sign-off, HR company-wide final lock (freezing timesheets against edits), and authorized administrative unlock. Verified in test suite and UI.
- [x] **M04-A10**: Single Source of Truth & Reconciliation Engine Harmonization (`/attendance/timesheet` <-> `/attendance/anomalies`).
  - *Completed*: 
    1. Centralized timesheet building (`buildTimesheetDays`), schedule reconciliation (`reconcileMonthlySchedules`), and anomaly classification (`isMissingPunch`, `isUnapprovedHalfDay`, `hasActionableAnomaly`, `isRecordActionableAnomaly`) into `AttendanceProcessingService`.
    2. Fixed catastrophic false-positive filter bug in `AttendanceAnomalyController` where empty punches on absent/rest days were falsely treated as 310 missing punches.
    3. Capped anomaly search to `min(monthEnd, today)` so future scheduled dates are never flagged as anomalies.
    4. Synchronized manual adjustments (`adjustDailyRecord`) to clear punch anomalies and set `is_paid = true`.
    5. Added Overtime approval status badges and approved hours rendering directly to `Timesheet.tsx` and exported CSVs.
    6. Added employee filter dropdown to `Anomalies.tsx`. Verified 1-to-1 data parity across both pages using MCP Chrome.

## Phase 2: Absence, Short Leaves & Shift Coverage Architecture (M04-L)
- [x] **M04-L01**: Create migration adding Short Leave fields (`is_short_leave`, `short_leave_from`, `short_leave_to`, `short_leave_duration_minutes`), `covering_employee_id`, and `approval_stage` (`pending_hod`, `pending_hr`, `approved`) to `leave_requests`.
  - *Completed*: Created `2026_10_01_000004_add_short_leave_and_coverage_to_leave_requests_table.php` adding short leave time tracking, duration, `covering_employee_id`, multi-tier approval tracking (`approval_stage`, `hod_id`, `hod_actioned_at`, `hod_remarks`, `is_bypassed_by_hr`), and MySQL 64-char identifier safe indexes (`idx_lr_approval_stage`, `idx_lr_short_leave`, `idx_lr_covering_emp`).
- [x] **M04-L02**: Update `LeaveService.php` to handle Short Leave validation (monthly quota check, max minutes check, lateness penalty waiver, zero leave balance deduction).
  - *Completed*: Enforced Sri Lankan enterprise standards:
    1. Single-day window enforcement with start/end time validity (`short_leave_to` > `short_leave_from`).
    2. Strict maximum duration cap of 120 minutes (2 hours).
    3. Monthly quota enforcement: max 2 short leaves per calendar month per employee (`getRemainingMonthlyShortLeaves`).
    4. Zero deduction from statutory annual, casual, or medical balances (`days_count = 0.00`).
    5. Daily Attendance Ledger synchronization (`syncAttendanceLedgerForLeave`) waiving lateness penalty and early departure minutes without converting day status into absent or leave.
- [x] **M04-L03**: Implement HOD Shift Coverage Selection logic in `LeaveService.php` (auto-validates covering employee's rest day and roster conflicts).
  - *Completed*: Implemented `validateShiftCoverage` enforcing:
    1. Anti-self designation check (`covering_employee_id !== employee_id`).
    2. Active employee tenant verification.
    3. Anti-overlap leave check: verifies covering colleague does not have approved or pending leave on the requested date range.
    4. Schedule conflict check: resolves covering colleague's daily schedule via `ShiftService` to ensure colleague is not scheduled for a rest day on duty coverage dates.
- [x] **M04-L04**: Create migration `create_compensatory_leave_records_table` and `CompensatoryLeaveRecord` model.
  - *Completed*: Created `2026_10_01_000005_create_compensatory_leave_records_table.php` and `App\Models\CompensatoryLeaveRecord` with ULID PK, tenant scoping, fractional days support (`earned_days`, `used_days`, `remaining_days`), 90-day expiry tracking, and relations to `Employee`, `User`, and `LeaveRequest`.
- [x] **M04-L05**: Implement Compensatory Off (C-Off / Shift Off-in-Lieu) crediting, tracking, and 90-day expiry rules in `LeaveService.php`.
  - *Completed*: Added `COMPENSATORY` leave preset and methods:
    1. `creditCompensatoryLeave`: grants C-Off days with automated 90-day expiry (`earned_date + 90 days`).
    2. `getAvailableCompensatoryDays`: computes active, unexpired C-Off days.
    3. `expireOverdueCompensatoryRecords`: auto-expires records where `expires_at < today`.
    4. Balance verification in `applyLeave` and FIFO deduction from oldest unexpired records in `approveLeave`.
    5. Full credit restoration on request cancellation or rejection.
- [x] **M04-L06**: Update `LeaveRequestController.php` and FormRequests to support Short Leaves, C-Off, HOD approvals with covering staff, and HR direct bypass.
  - *Completed*:
    1. Updated `ApplyLeaveRequest` with short leave time regex, covering colleague rules, and custom error messages.
    2. Created `HodActionLeaveRequest` and `CreditCompensatoryLeaveRequest`.
    3. Added controller endpoints `hodAction`, `creditCompensatory`, and enhanced `approve` with direct HR managerial bypass (`direct_bypass = true`).
    4. Added cut-off freeze protection (`isPeriodLocked` prevents submissions in locked HR periods).
- [x] **M04-L07**: Update UI `resources/js/Pages/Leave/Requests.tsx` with Short Leave tabs, remaining monthly quota badge, covering employee selector, and multi-tier approval actions.
  - *Completed*:
    1. Dark-mode UI with 5 KPI summary cards (Awaiting HOD, Awaiting HR, Short Leaves Month, Available C-Off Pool, On Leave Today).
    2. Segmented format switcher: "Standard / Half-Day" vs "Short Leave (Max 2h)" with live time duration calculator and policy hints.
    3. Designated covering colleague selector with active department annotations.
    4. Multi-tier approval actions: HOD Recommend & Decline modal, HR Direct Managerial Bypass button, and HR Final Sign-Off.
    5. Dedicated Compensatory Off Ledger modal and "+ Credit C-Off" modal.
    6. Verified 100% in test suite (`17 passed, 88 assertions`) and validated end-to-end via MCP Chrome browser.

## Phase 3: Dynamic Payroll Engine & Master Data (M04-P)
- [x] **M04-P01**: Create migrations `create_pay_items_table` and `create_employee_pay_items_table`.
  - *Completed*: Created `2026_10_01_000006_create_pay_items_tables.php` with ULID PKs, tenant isolation, pay item classification (`allowance`, `deduction`), category (`statutory`, `fixed_allowance`, `variable_allowance`, `reimbursement`, `loan_repayment`, `salary_advance`, `penalty`, `other`), calculation types (`fixed`, `percentage_of_basic`, `formula`), statutory eligibility flags (`is_epf_eligible`, `is_etf_eligible`, `is_apit_eligible`, `is_active`, `is_system_default`), and employee assignment matrix table `employee_pay_items` with date-based validity range (`effective_from`, `effective_to`).
- [x] **M04-P02**: Implement `PayItem` and `EmployeePayItem` models with calculation types and statutory flags.
  - *Completed*: Created `App\Models\PayItem` and `App\Models\EmployeePayItem` with `BelongsToTenant`, `HasUlids`, and scoped query builders (`active`, `earnings`, `deductions`, `epfEligible`, `activeForPeriod`). Added relationships to `Employee` and `Tenant`.
- [x] **M04-P03**: Seed Sri Lankan standard pay items (Basic, BRA 2005, BRA 2016, Attendance Incentive, Travelling, Loan Deduction, Salary Advance).
  - *Completed*: Built `PayItemService::seedStandardSriLankanPayItems()` covering the 9 statutory & standard enterprise pay items compliant with the Sri Lankan Shop and Office Employees Act, Budgetary Relief Allowance Acts (BRA 2005 No. 36 & BRA 2016 No. 4 with mandatory EPF eligibility), Fixed Allowances, Salary Advances, Staff Loan Repayments, and Welfare Fund Deductions.
- [x] **M04-P04**: Create migration `create_employee_loans_table` and `create_employee_loan_installments_table` with `EmployeeLoan` and `EmployeeLoanInstallment` models.
  - *Completed*: Created `2026_10_01_000007_create_employee_loans_tables.php` with loan schedule engine (`principal_amount`, `interest_rate`, `installment_count`, `monthly_installment`, `remaining_balance`, `disbursement_date`, `status`), and `employee_loan_installments` tracking installment sequences, scheduled deduction periods, paid status, and skip/deferral logic. Implemented `EmployeeLoan` and `EmployeeLoanInstallment` models and `StaffLoanService`.
- [x] **M04-P05**: Create migration `create_payroll_monthly_adjustments_table` for ad-hoc monthly variable additions/deductions.
  - *Completed*: Created `2026_10_01_000008_create_payroll_monthly_adjustments_table.php` with monthly period tracking (`payroll_year`, `payroll_month`), adjustment classification (`addition`, `deduction`), amount, statutory taxation toggles (`taxable`, `epf_applicable`), approval workflow (`status = 'approved' | 'pending' | 'rejected'`), and created `PayrollMonthlyAdjustment` model with `PayrollAdjustmentService`.
- [x] **M04-P06**: Add configurable payroll parameters to `tenant_settings` (OT multipliers: 1.5x, 2.0x, cut-off start/end days, cut-off mode).
  - *Completed*: Updated `tenant_settings` with `payroll_ot_rate_single` (default: 1.50), `payroll_ot_rate_double` (default: 2.00), and `payroll_require_approved_ot` (default: true). Exposed via `PayrollRunController::updateSettings` and frontend configuration dialog.
- [x] **M04-P07**: Refactor `PayrollCalculationService.php` to dynamically calculate recurring employee pay items, active loan installments, variable adjustments, approved OT hours (instead of unapproved raw OT), and dynamic OT multipliers instead of hardcoded 0.00.
  - *Completed*: Single Source of Truth harmonization:
    1. Overtime Calculation: Reads `approved_ot_hours` and `approved_double_ot_hours` from `attendance_daily` when `payroll_require_approved_ot` is enabled; applies dynamic multipliers (`payroll_ot_rate_single` and `payroll_ot_rate_double`) over hourly rate (`(basic_salary + statutory_bra) / 200`).
    2. Dynamic Recurring Pay Items: Fetches `employee_pay_items` active for the payroll period; includes statutory items (e.g. BRA) into the EPF earnings baseline.
    3. Staff Loan Installments: Automatically identifies pending installments scheduled for the payroll period, deducts from net salary, and updates installment status to paid upon finalization.
    4. Variable Monthly Adjustments: Aggregates approved ad-hoc additions and deductions for the target month/year.
- [x] **M04-P08**: Build UI `resources/js/Pages/Payroll/PayItems.tsx` (Pay Items Master & Formulas).
  - *Completed*: Built modern dark-mode catalog UI featuring 4 KPI metric cards, filter bars, "1-Click Sync Statutory (Sri Lanka)" button, "+ New Pay Item" modal, and employee assignment ledger matrix.
- [x] **M04-P09**: Build UI `resources/js/Pages/Payroll/Loans.tsx` (Staff Loans & Advances Ledger).
  - *Completed*: Built comprehensive Staff Loans & Advances ledger with 4 KPI summary cards (Total Disbursed, Outstanding Balance, Active Portfolios, Fully Recovered), interactive loan disbursement modal with live monthly installment auto-calculator, status badges, progress bars, installment schedule drawer, and 1-click skip/defer modal.
- [x] **M04-P10**: Build UI `resources/js/Pages/Payroll/VariableInputs.tsx` (Monthly Ad-hoc Adjustments).
  - *Completed*: Built dynamic Monthly Adjustments page with month/year selector, KPI metric cards (Total Additions, Total Deductions, Net Payroll Impact, Records Count), "+ New Adjustment" modal with EPF/taxable toggles, and bulk staff adjustment matrix. All tested and verified with zero console errors.

## Phase 4: Employee Performance & KPI Evaluation (M04-E)
- [ ] **M04-E01**: Create migration `create_employee_evaluations_table` and model `EmployeeEvaluation`.
- [ ] **M04-E02**: Implement `EmployeeEvaluationService` for HOD evaluation submission, structured rating validation, and HR review/confirmation.
- [ ] **M04-E03**: Create `EmployeeEvaluationController` with endpoints for HOD drafting/submitting, HR reviewing/bypassing, and PDF export.
- [ ] **M04-E04**: Build UI `resources/js/Pages/Evaluations/Index.tsx` with HOD appraisal modal and HR sign-off dashboard.
- [ ] **M04-E05**: Build clean printable PDF evaluation template for management review.

## Phase 5: Employee Self-Service (ESS), IAM & System Hardening (M04-ESS)
- [ ] **M04-ESS01**: Register all M04 permissions in `PermissionCatalog.php` and `RolesAndPermissionsSeeder.php` (HR Group, HOD Group, ESS Group).
- [ ] **M04-ESS02**: Implement HOD Authority Management UI on Access Control page (allow HR/Admin to easily grant or revoke approval rights per HOD).
- [ ] **M04-ESS03**: Build Employee Self-Service (ESS) pages:
  - `resources/js/Pages/Portal/MyAttendance.tsx`
  - `resources/js/Pages/Portal/MyLeaves.tsx`
  - `resources/js/Pages/Portal/MyPayslips.tsx`
- [ ] **M04-ESS04**: Update `AuthenticatedLayout.tsx` with role-based navigation groups (`My Self-Service` for staff, `Team Approvals` for HODs, `Management Modules` for HR/Admins).
- [ ] **M04-ESS05**: Run comprehensive test suite, verify database seeders, check TypeScript compilation (`npm run build`), and verify payroll calculation precision.
