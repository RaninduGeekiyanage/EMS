# M04: Detailed Functional & Statutory Requirements

## 1. Approval Hierarchy, Delegation & Direct HR Bypass Engine

### 1. Two-Tier Workflow Architecture
Every request (Leave, Regularization, Overtime Approval, Shift Change, Performance Evaluation) follows a standardized 2-tier lifecycle:
```
[Employee Request] ──► [Stage 1: HOD Decision / Coverage] ──► [Stage 2: HR Review & Confirm] ──► [Final Applied / Synced]
          │                                                              ▲
          └────────────────────────── HR DIRECT BYPASS ──────────────────┘
```

1. **Stage 1 — HOD Decision & Roster Coverage**:
   - **Leave Requests**: Employee requests leave/off. HOD reviews and, if approving, can select which colleague covers the shift (updating the roster coverage).
   - **Timesheet & Regularizations**: HOD reviews missing punches, late arrival excuses, outstation/on-duty gate passes, and unapproved half-days.
   - **Overtime (OT) Approval**: When attendance generates overtime, HOD can approve **all OT hours** or specify **partial approved hours** (e.g., punch shows 3.5h OT, HOD approves 2.0h).
   - **Employee Performance / KPI Evaluation**: HOD submits structured evaluation forms (ratings, KPI metrics, comments).
   - **Selective HOD Authority**: Approval authority is **not** automatic for all HODs. HR / Company Admin can selectively grant or revoke approval rights per individual HOD via granular Spatie permissions (`leave.hod_approve`, `attendance.hod_approve_ot`, etc.). If an HOD lacks the permission, requests auto-route directly to HR.

2. **Stage 2 — HR Review, Confirmation & Direct Bypass**:
   - HR department users review HOD-approved items and issue the final confirmation (locking the record and syncing with payroll/entitlements).
   - **HR Direct Bypass Capability**: HR has full authority to bypass any HOD step at any time—approving, rejecting, or amending requests directly without waiting for HOD action.
   - **Evaluation Finalization**: HR reviews HOD performance submissions, confirms the scores, and can generate printable PDF evaluation records for executive sign-off.

---

## 2. Attendance Action & Regularization Requirements (M04-A)
1. **Unapproved Half-Day Resolution**:
   - Accumulating $\ge 4.0\text{h}$ and $< 6.0\text{h}$ of punch duration without approved leave triggers `UNAPPROVED_HALF_DAY` (`is_paid = false`).
   - Auditable resolution paths:
     - **Mechanism A (Punch Regularization)**: HOD or HR approves missing check-in/out or outstation duty $\rightarrow$ punch updated, `status = 'present'`, full pay restored.
     - **Mechanism B (Retroactive Leave)**: Converted to Half-Day Casual/Annual leave $\rightarrow$ $0.5$ deducted from leave balance, `status = 'half_day'`, `is_paid = true`.
     - **Mechanism C (Managerial Discretion / Paid Waiver)**: HOD recommends and HR confirms paid half day with audit justification $\rightarrow$ `is_paid = true` without altering biometric punch records.
2. **Granular Overtime (OT) Approval Engine**:
   - Daily attendance calculates raw `ot_hours` and `double_ot_hours`.
   - HOD / HR approval modal supports:
     - `Approve Full OT` (approved hours = raw hours).
     - `Approve Specific Hours` (e.g., raw is 3.5h, approver enters 2.0h with justification).
     - `Reject OT` (approved hours = 0.0h).
   - Downstream payroll calculations strictly pay the **approved OT hours**, protecting the organization from unauthorized overtime liabilities.
3. **Attendance Exception Action Center**:
   - Centralized view displaying all outstanding punch anomalies (missing in/out, unapproved half day, excessive late arrival, unexcused absence).
   - Allows bulk actions and department-level filtering.
4. **Attendance Cut-Off Freeze & Period Sign-Off**:
   - Default period: **Calendar Month (1st–31st)**.
   - Customizable cycle: e.g. **21st of previous month to 20th of current month** (or any custom start/end day) configured in Company Settings.
   - Multi-step sign-off: Department HOD signs off team attendance $\rightarrow$ HR locks the period, freezing all attendance records against edits.

---

## 3. Absence & Leave Architecture Requirements (M04-L)
1. **Configurable Short Leave / Gate Pass Engine**:
   - Configured under Company / Attendance Settings.
   - **Default parameters**: **2 short leaves per month**, maximum **90 minutes each**.
   - Configurable: Company Admin / HR can adjust quota (e.g. 3 per month) and max duration (e.g. 60 or 120 minutes).
   - Time tracking: Employee specifies `from_time` and `to_time` (e.g. 08:30 – 10:00 or 15:30 – 17:00).
   - Lateness offset: If approved, late arrival or early departure within the short leave window is excused ($0$ penalty minutes).
   - Policy interlock: If an employee exceeds the monthly quota, the system prevents submission or prompts conversion into a Half-Day Casual/No-Pay leave.
2. **Compensatory Off (C-Off / Shift Off-in-Lieu)**:
   - For employees working on scheduled Rest Days, Sundays, or Mercantile Holidays who opt for compensatory time off.
   - Ledger tracks earned date, credit days ($0.5$ or $1.0$), and a 90-day expiration window.
3. **Shift Change & Coverage Management**:
   - Employee requests shift change or shift off $\rightarrow$ HOD decides, approves, and selects the replacement employee to cover the shift.
   - Automated rest-day and double-shift conflict validation on the covering employee.

---

## 4. Performance & Evaluation Requirements (M04-E)
1. **HOD Performance & KPI Submission**:
   - HOD submits performance evaluations for departmental staff across defined evaluation periods (Annual, Bi-annual, Probation).
   - Evaluation criteria: Attendance & Punctuality, Job Performance, Teamwork, Leadership, Technical Skill.
2. **HR Confirmation & Export**:
   - HR reviews HOD ratings, can add HR remarks or adjust ratings, and issues final confirmation.
   - Generate high-quality printable PDF evaluation summaries for board / C-level executive review.

---

## 5. Dynamic Payroll Engine Requirements (M04-P)
1. **Pay Items Master (Earnings & Deductions)**:
   - Zero hardcoding of allowances, incentives, or deductions.
   - Dynamic pay items: Basic, Budgetary Relief Allowance (BRA 2005 & 2016), Attendance Incentive, Travelling, Performance Bonus, Staff Loan Deduction, Salary Advance, Welfare, Disciplinary Fine.
   - Statutory liability flags: `is_epf_liable`, `is_etf_liable`, `is_apit_liable`, `is_taxable`.
   - Calculation modes: Fixed Amount, Percentage of Basic, Attendance-linked, Formula-driven.
2. **Staff Loans & Salary Advance Ledger**:
   - Loan management with loan number, principal amount, installment duration, monthly deduction, and balance tracking.
   - Automated deduction injection into monthly payroll calculations until full settlement.
3. **Variable / Ad-Hoc Monthly Adjustment Sheet**:
   - Monthly grid / Excel bulk-importer for one-time bonuses, incentive commissions, or disciplinary deductions for a specific pay period.
4. **Configurable Payroll Parameters**:
   - Dynamic Overtime Multipliers: Normal OT (default 1.5x), Rest Day OT (default 2.0x), Holiday OT (default 2.0x / 3.0x), Night shift premium.
   - Configurable No-Pay Divisors: Shop & Office default 30, Wages Board default 26.
   - Attendance Cut-Off Cycle: Calendar Month (1st–31st) vs Custom Cycle (21st–20th).
