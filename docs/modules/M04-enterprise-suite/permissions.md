# M04: IAM Permissions & Access Control Catalog

## 1. Permission Architecture & Delegation Model
All HR actions are organized under dedicated Permission Groups.
- **Super Admin**: Can configure system settings, tenant flags, and assign HR Manager / Company Admin permissions.
- **HR Manager / Company Admin**: Can assign or revoke individual permissions to users in the HR department or to specific Department Heads (HODs).
- **HOD Delegation**: Being an HOD does **not** automatically grant approval authority. An HOD must have the explicit permission granted (e.g. `leave.hod_approve`). If revoked, requests bypass the HOD and route directly to HR.
- **HR Direct Bypass**: Users with HR bypass permissions can execute, approve, or override any request at any stage without waiting for HOD review.

---

## 2. Granular Permissions List

### Domain: HR Operations & Direct Bypass (`hr_ops`)
| Permission Slug | Display Name | Description | Danger Level |
| :--- | :--- | :--- | :--- |
| `hr.bypass_all` | HR Master Direct Bypass | Bypass any HOD approval stage and approve/reject directly | Critical |
| `leave.hr_confirm` | HR Confirm Leave | Final approval, leave balance deduction, and attendance sync | High |
| `attendance.hr_confirm_regularization` | HR Confirm Punch Regularization | Final approval and punch ledger sync for regularizations | High |
| `attendance.hr_confirm_ot` | HR Confirm Overtime Hours | Final sign-off on employee overtime hours for payroll | Critical (Financial) |
| `roster.hr_confirm_shift_change` | HR Confirm Shift Changes | Final approval of HOD shift swaps and coverage assignments | Moderate |
| `evaluation.hr_review` | HR Review & Finalize Evaluations | Review HOD performance ratings and confirm final appraisal | Moderate |
| `evaluation.print_export` | Print & Export Evaluation Records | Generate official printable PDF evaluation records | Normal |
| `hr.manage_hod_authorities` | Grant / Revoke HOD Authorities | Delegate or remove approval permissions for Department Heads | High |

### Domain: Department Head (HOD) Approvals (`hod_ops`)
*(Individually grantable / revocable per HOD)*
| Permission Slug | Display Name | Description | Danger Level |
| :--- | :--- | :--- | :--- |
| `leave.hod_approve` | HOD Approve Team Leaves | Review and approve leave requests for departmental staff | Moderate |
| `roster.hod_shift_cover` | HOD Shift Change & Cover Assignment | Approve shift changes and designate replacement coverage | Moderate |
| `attendance.hod_approve_regularization` | HOD Approve Regularizations | Review team missing punches, late excuses, and outstation slips | Moderate |
| `attendance.hod_approve_ot` | HOD Approve Overtime Hours | Approve full OT or specify partial approved hours for team | High |
| `evaluation.hod_submit` | HOD Submit Performance Evaluations | Fill out and submit team KPI and performance evaluation forms | Normal |

### Domain: Employee Self-Service (`ess`)
*(Assigned to standard staff)*
| Permission Slug | Display Name | Description | Danger Level |
| :--- | :--- | :--- | :--- |
| `ess.portal_access` | Access Employee Portal | Access personal attendance, leave, and payslip dashboard | Normal |
| `leave.apply_own` | Apply for Own Leave / Short Leave | Submit leave or short leave request | Normal |
| `roster.request_shift_change` | Request Shift Change | Submit request for shift change / off | Normal |
| `attendance.regularize_own` | Submit Own Attendance Regularization| Request punch adjustment or outstation gate pass | Normal |
| `payslip.download_own` | Download Own Payslips | View and download personal encrypted payslip PDFs | Normal |

### Domain: Dynamic Payroll & Pay Items (`payroll`)
| Permission Slug | Display Name | Description | Danger Level |
| :--- | :--- | :--- | :--- |
| `payroll.pay_items.manage` | Manage Pay Items Master | Create, configure, and edit earnings, deductions, and formulas | Critical |
| `payroll.employee_compensation.manage`| Manage Employee Salary Profiles | Assign recurring allowances, deductions, and basic salaries | Critical |
| `payroll.loans.manage` | Manage Staff Loans & Advances | Disburse staff loans, configure installments, and track balance | Critical |
| `payroll.variable_inputs.manage` | Manage Monthly Variable Adjustments | Upload or input monthly ad-hoc earnings/deductions | Critical |
| `payroll.settings.manage` | Manage Payroll Policies & Cut-Off | Configure OT multipliers, cut-off cycle, and no-pay divisors | High |
