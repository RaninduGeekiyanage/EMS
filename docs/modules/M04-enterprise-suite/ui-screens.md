# M04: Dedicated User Interface Screens & Routes

## 1. New & Enhanced Routes Matrix

```
┌──────────────────────────────────────┬───────────────────────────────┬──────────────────────────────────────────┐
│ Route URI                            │ Controller Action             │ Purpose / Functionality                  │
├──────────────────────────────────────┼───────────────────────────────┼──────────────────────────────────────────┤
│ GET  /attendance/anomalies           │ AttendanceAnomalyController   │ Dedicated Attendance Exception Center    │
│ POST /attendance/anomalies/bulk      │ AttendanceAnomalyController   │ Bulk resolve (Paid Half Day, Deduct, etc)│
│ GET  /attendance/regularizations     │ AttendanceRegularizationCtrl  │ List pending regularization requests     │
│ POST /attendance/regularizations     │ AttendanceRegularizationCtrl  │ Submit punch regularize / OD slip        │
│ POST /attendance/regularizations/app │ AttendanceRegularizationCtrl  │ Approve punch correction                 │
│ POST /attendance/timesheet/freeze    │ AttendanceTimesheetController │ Sign-off and freeze attendance cut-off   │
│                                      │                               │                                          │
│ GET  /leave/compensatory             │ CompensatoryLeaveController   │ C-Off (Off-in-Lieu) balance ledger       │
│ POST /leave/compensatory/credit      │ CompensatoryLeaveController   │ Credit lieu days for working rest/poya   │
│                                      │                               │                                          │
│ GET  /payroll/settings/pay-items     │ PayItemController@index       │ Pay Items Master catalog & formulas      │
│ POST /payroll/settings/pay-items     │ PayItemController@store       │ Create custom earning / deduction        │
│ GET  /payroll/compensation           │ EmployeeCompensationController│ Employee Salary Profiles & Allowances    │
│ POST /payroll/compensation/assign    │ EmployeeCompensationController│ Assign recurring item to employee        │
│ GET  /payroll/loans                  │ EmployeeLoanController@index  │ Staff Loan & Salary Advance Ledger       │
│ POST /payroll/loans                  │ EmployeeLoanController@store  │ Issue new loan / advance installment plan│
│ GET  /payroll/variable-inputs        │ PayrollVariableInputCtrl@index│ Monthly ad-hoc adjustments matrix & CSV  │
│ POST /payroll/variable-inputs        │ PayrollVariableInputCtrl@store│ Save monthly bonuses/commissions/penalties│
│                                      │                               │                                          │
│ GET  /portal/my-attendance           │ EmployeePortalController      │ ESS: Personal attendance calendar & logs │
│ GET  /portal/my-leaves               │ EmployeePortalController      │ ESS: Personal leave balances & requests  │
│ GET  /portal/my-payslips             │ EmployeePortalController      │ ESS: Personal payslip archive & PDF view │
└──────────────────────────────────────┴───────────────────────────────┴──────────────────────────────────────────┘
```

## 2. UI/UX Wireframe Concepts

### 1. Attendance Exception Center (`/attendance/anomalies`)
- **Filter Bar**: Anomaly Type (`All`, `Unapproved Half Day`, `Missing Punch`, `Late Arrival`, `Unexcused Absent`), Department, Date Range.
- **Data Table**: Employee (avatar, ID, name), Shift, In Punch, Out Punch, Duration, Anomaly Badge, Recommended Action.
- **Quick Action Drawer**:
  - `Approve as Paid Half Day`: Reclassifies day as authorized half day (`is_paid = true`).
  - `Convert to Half Day Leave`: Auto-opens leave deduction modal (deducts 0.5 casual/annual).
  - `Confirm as Unpaid No-Pay (0.5)`: Locks as 0.5 no-pay for payroll.

### 2. Pay Item Master (`/payroll/settings/pay-items`)
- **Top Metrics**: Total Active Earnings, Total Active Deductions, EPF-Liable Items Count, Tax-Liable Items Count.
- **Split Tabs**: `[Earnings / Allowances]` | `[Deductions & Recoveries]` | `[Statutory Formula Rules]`.
- **Create Pay Item Modal**:
  - Code (e.g. `TRAV_ALLOW`, `ATTN_INC`), Name, Category, Nature (Recurring / Ad-Hoc).
  - Checkboxes: `[x] Liable for EPF/ETF (12% + 8% + 3%)`, `[x] Liable for APIT Tax`, `[x] Included in Gross Pay`.
  - Calculation Method: Fixed LKR, % of Basic Salary, or Attendance-linked (pro-rated by worked days).

### 3. Staff Loan Manager (`/payroll/loans`)
- Active Loans summary card: Total Disbursed, Total Recovered, Outstanding Balance.
- Loan accounts table with visual progress bar showing repayment percentage.
- "Issue New Loan" drawer with automatic repayment schedule preview.

### 4. Employee Self-Service (ESS) Portal (`/portal/*`)
- Mobile-optimized responsive layout for individual smartphone access.
- Big touch-friendly buttons: "Punch Check", "Apply Leave", "Apply Short Leave", "Regularize Missed Punch", "Download Latest Payslip".
