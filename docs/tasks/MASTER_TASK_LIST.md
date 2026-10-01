# Master Task List — EMS Project

**Overall Status**: 🟢 All Modules Complete (M00 - M03 Core & Statutory Ecosystem)  
**Current Active Module**: **M03 — Payroll & Statutory Compliance (Complete & Verified)**

## Module Progress Matrix
| Module | Total Tasks | Completed | In Progress | Status |
|--------|-------------|-----------|-------------|--------|
| **M00: Core Foundation, Auth & Super Admin** | 22 | 22 | 0 | 🟢 Complete |
| **M00-AC: Enterprise Access Control & IAM** | 8 | 8 | 0 | 🟢 Complete |
| **M01: Organization & Employee Master** | 22 | 22 | 0 | 🟢 Complete |
| **M02: Attendance Management System (AMS)** | 18 | 18 | 0 | 🟢 Complete |
| **M03: Payroll & Compliance** | 24 | 24 | 0 | 🟢 Complete |
| **M04: Enterprise Attendance, Leave & Payroll Suite** | 37 | 0 | 0 | 🟡 Under Planning / Review |

---

## M04: Enterprise Attendance, Leave & Dynamic Payroll Suite (Planning / Review Phase)
Track full task specifications in [docs/modules/M04-enterprise-suite/TASKS.md](../modules/M04-enterprise-suite/TASKS.md).

### Phase 1: Attendance Exception, OT Approval & Regularization Engine (M04-A)
- [ ] **M04-A01**: Migration `create_attendance_regularization_requests_table`.
- [ ] **M04-A02**: Model `AttendanceRegularizationRequest` with scopes, HOD/HR relationships, and status state machine.
- [ ] **M04-A03**: Service `AttendanceRegularizationService` (cut-off validation, anti-overlap, HOD review, HR bypass, punch sync).
- [ ] **M04-A04**: Controller `AttendanceRegularizationController` (employee submit, HOD review, HR direct bypass).
- [ ] **M04-A05**: Migration to add `approved_ot_hours`, `approved_double_ot_hours`, `ot_approval_status`, and `ot_approved_by` to `attendance_dailies`.
- [ ] **M04-A06**: Granular Overtime (OT) Approval Service & endpoints (HOD approves full OT or specific partial hours; HR confirms or overrides).
- [ ] **M04-A07**: Attendance Anomaly Resolution endpoints (`AttendanceAnomalyController`) with 1-click Paid Half Day waiver, Retro-Leave conversion, No-Pay confirmation.
- [ ] **M04-A08**: UI `resources/js/Pages/Attendance/Anomalies.tsx` (Exception Action Center & Drawers).
- [ ] **M04-A09**: Monthly Attendance Period Freeze & Sign-Off (`/attendance/timesheet/freeze`) with HOD sign-off and HR final lock.

### Phase 2: Absence, Short Leaves & Shift Coverage Architecture (M04-L)
- [ ] **M04-L01**: Migration adding Short Leave fields (`is_short_leave`, `short_leave_from`, `short_leave_to`, `short_leave_duration_minutes`), `covering_employee_id`, and `approval_stage` (`pending_hod`, `pending_hr`, `approved`) to `leave_requests`.
- [ ] **M04-L02**: `LeaveService.php` Short Leave validation (monthly quota check, max minutes check, lateness penalty waiver, zero leave balance deduction).
- [ ] **M04-L03**: HOD Shift Coverage Selection logic in `LeaveService.php` (auto-validates covering employee's rest day and roster conflicts).
- [ ] **M04-L04**: Migration `create_compensatory_leave_records_table` and `CompensatoryLeaveRecord` model.
- [ ] **M04-L05**: Compensatory Off (C-Off / Shift Off-in-Lieu) crediting, tracking, and 90-day expiry rules in `LeaveService.php`.
- [ ] **M04-L06**: Update `LeaveRequestController.php` and FormRequests for Short Leaves, C-Off, HOD approvals with covering staff, and HR direct bypass.
- [ ] **M04-L07**: Update UI `resources/js/Pages/Leave/Requests.tsx` with Short Leave tabs, remaining monthly quota badge, covering employee selector, and multi-tier approval actions.

### Phase 3: Dynamic Payroll Engine & Master Data (M04-P)
- [ ] **M04-P01**: Migrations `create_pay_items_table` and `create_employee_pay_items_table`.
- [ ] **M04-P02**: Models `PayItem` and `EmployeePayItem` with calculation types and statutory flags.
- [ ] **M04-P03**: Seed Sri Lankan standard pay items (Basic, BRA 2005, BRA 2016, Attendance Incentive, Travelling, Loan Deduction, Salary Advance).
- [ ] **M04-P04**: Migration `create_employee_loans_table` and `create_employee_loan_installments_table` with `EmployeeLoan` model.
- [ ] **M04-P05**: Migration `create_payroll_monthly_adjustments_table` for ad-hoc monthly variable additions/deductions.
- [ ] **M04-P06**: Configurable payroll parameters in `tenant_settings` (OT multipliers: 1.5x, 2.0x, cut-off start/end days, cut-off mode).
- [ ] **M04-P07**: Refactor `PayrollCalculationService.php` to calculate dynamic recurring pay items, active loan installments, variable adjustments, approved OT hours (instead of unapproved raw OT), and dynamic OT multipliers instead of hardcoded 0.00.
- [ ] **M04-P08**: Build UI `resources/js/Pages/Payroll/PayItems.tsx` (Pay Items Master & Formulas).
- [ ] **M04-P09**: Build UI `resources/js/Pages/Payroll/Loans.tsx` (Staff Loans & Advances Ledger).
- [ ] **M04-P10**: Build UI `resources/js/Pages/Payroll/VariableInputs.tsx` (Monthly Ad-hoc Adjustments).

### Phase 4: Employee Performance & KPI Evaluation (M04-E)
- [ ] **M04-E01**: Migration `create_employee_evaluations_table` and model `EmployeeEvaluation`.
- [ ] **M04-E02**: Service `EmployeeEvaluationService` for HOD evaluation submission, structured rating validation, and HR review/confirmation.
- [ ] **M04-E03**: Controller `EmployeeEvaluationController` (HOD drafting/submitting, HR reviewing/bypassing, PDF export).
- [ ] **M04-E04**: UI `resources/js/Pages/Evaluations/Index.tsx` with HOD appraisal modal and HR sign-off dashboard.
- [ ] **M04-E05**: Clean printable PDF evaluation template for management review.

### Phase 5: Employee Self-Service (ESS), IAM & System Hardening (M04-ESS)
- [ ] **M04-ESS01**: Register all M04 permissions in `PermissionCatalog.php` and `RolesAndPermissionsSeeder.php` (HR Group, HOD Group, ESS Group).
- [ ] **M04-ESS02**: Implement HOD Authority Management UI on Access Control page (allow HR/Admin to easily grant or revoke approval rights per HOD).
- [ ] **M04-ESS03**: Build Employee Self-Service (ESS) pages (`Portal/MyAttendance.tsx`, `Portal/MyLeaves.tsx`, `Portal/MyPayslips.tsx`).
- [ ] **M04-ESS04**: Update `AuthenticatedLayout.tsx` with role-based navigation groups (`My Self-Service` for staff, `Team Approvals` for HODs, `Management Modules` for HR/Admins).
- [ ] **M04-ESS05**: Run comprehensive test suite, verify database seeders, check TypeScript compilation (`npm run build`), and verify payroll calculation precision.

