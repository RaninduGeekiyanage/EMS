# Feature Implementation Checklists

## Module Status Overview

| Module | Status | Implemented Features |
|---|---|---|
| **Authentication** | ✅ Core Complete | Sign-in, Sign-up, Forgot/Reset Password, Role-based Middleware |
| **Employee Management** | ✅ Core Complete | Create Employee, View Employee, Employee Report |
| **Organization Master** | ✅ Complete | Company, Branch, Department, Designation, HOD, OC Grade, Wages Board Category |
| **Shift Management** | ✅ Complete | Create Shift (regular + off-day), View Shifts |
| **Roster Management** | ✅ Complete | Create Roster, View Roster, All Rosters, Assign to Roster, Remove from Roster |
| **Time & Attendance** | ✅ Core Complete | Import CSV, Sync Attendance, Anomaly Detection |
| **Leave Settings** | ✅ Complete | Leave Types, Wages Board Rules, Shop & Office Rules |
| **OT Settings** | ✅ Complete | OT Type CRUD |
| **Holiday Management** | ✅ Complete | Add/Delete/View Holidays by Year |
| **Reports** | ✅ Complete | Employee Report with PDF/Excel Export |
| **Leave Management** | 🔲 Planned | Apply Leave, Approve Leave, Leave Calendar, Leave Balances |
| **Overtime Management** | 🔲 Planned | OT Requests, OT Approval, OT Summary |
| **Attendance Views** | 🔲 Planned | Daily View, Manual Entry, Missing Punch, Summary |
| **Settings** | 🔲 Planned | General, Team, Billing, Limits |

---

## Planned Feature Checklists

### Leave Management Module

- [ ] Apply Leave page (`/ems/leave/apply`)
  - [ ] Leave type selection (filtered by employee's category)
  - [ ] Date range picker (from/to)
  - [ ] Reason field
  - [ ] Balance check before submission
  - [ ] Server action: create LeaveApplication
- [ ] Approve Leave page (`/ems/leave/approve`)
  - [ ] List pending applications (by department for HOD)
  - [ ] Approve/Reject buttons
  - [ ] Server action: update LeaveApplication status
  - [ ] Decrement EmployeeLeaveBalance on approve
- [ ] Leave Calendar (`/ems/leave/calendar`)
  - [ ] FullCalendar integration
  - [ ] Color-coded leave types
  - [ ] Department/company filter
- [ ] Leave Balances (`/ems/leave/balance`)
  - [ ] Employee leave balance table
  - [ ] Year selector
  - [ ] Carry-forward display

### Overtime Management Module

- [ ] OT Requests page (`/ems/ot/request`)
  - [ ] OT request form with hours/date
  - [ ] OT type selection (Single/Double/Triple)
  - [ ] Server action: create OT request
- [ ] OT Approval page (`/ems/ot/approve`)
  - [ ] List pending OT requests
  - [ ] Approve/Reject workflow
  - [ ] Server action: update OT status
- [ ] OT Summary (`/ems/ot/summary`)
  - [ ] Monthly OT summary report
  - [ ] Employee/department filter
  - [ ] Total hours and cost calculation

### Attendance Views Module

- [ ] Daily Attendance View
  - [ ] Per-employee, per-day attendance detail
  - [ ] IN/OUT times, worked minutes, anomalies
  - [ ] Calendar navigation
- [ ] Manual Attendance Entry
  - [ ] Override IN/OUT times
  - [ ] Reason for correction
  - [ ] Audit trail
- [ ] Missing Punch Handling
  - [ ] List employees with anomalies (needsReview = true)
  - [ ] Auto-suggest corrections
  - [ ] Bulk approve corrections
- [ ] Attendance Summary
  - [ ] Monthly/weekly summary per employee
  - [ ] Total hours, absent days, late count
  - [ ] Export to PDF/Excel

### Employee Profile Enhancements

- [ ] Bank details management
- [ ] Payroll details view
- [ ] Leave balance self-service view
- [ ] Shift schedule calendar view
- [ ] Personal info update request

### System Settings

- [ ] General settings (company info, timezone)
- [ ] User management (admin CRUD)
- [ ] Role management (permissions matrix)
- [ ] Audit log viewer
