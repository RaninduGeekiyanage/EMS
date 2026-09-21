# Entity Naming Conventions

## Database Table Mapping

| Prisma Model | DB Table (`@@map`) | Primary Key |
|---|---|---|
| User | `user` | UUID |
| Session | `session` | UUID |
| Account | `account` | UUID |
| Verification | `verification` | UUID |
| Employee | `employee` | Auto-int |
| EmployeeBankDetails | `emp_bank_details` | Auto-int |
| EmpPayrollDetails | `emp_payroll_details` | Auto-int |
| Company | `company` | Auto-int |
| Branch | `branch` | Auto-int |
| Department | `department` | Auto-int |
| Designation | `designation` | Auto-int |
| DepartmentHead | `department_head` | Auto-int |
| Shift | `shift` | Auto-int |
| Roster | `Roster` (PascalCase — **inconsistency**) | Auto-int |
| RosterPattern | `roster_pattern` | Auto-int |
| EmployeeRoster | `employee_roster` | Auto-int |
| EmployeeShiftSchedule | `employee_shift_schedule` | Auto-int |
| EmpSwap | `emp_shift_swap` | Auto-int |
| HolidaySchedule | `holiday_schedule` | Auto-int |
| LeaveType | `leave_type` | Auto-int |
| LeaveApplication | `leave_apllication` (**typo**) | Auto-int |
| EmployeeLeaveBalance | `employee_leave_balance` | Auto-int |
| OCGrade | `oc_grade` | Auto-int |
| WagesBoardJobCategory | `wages_board_job_category` | Auto-int |
| WagesBoardLeaveAccessRules | `wages_board_leave_access_rule` | Auto-int |
| ShopAndOfficeLeaveAccessRule | `shop_and_office_leave_access_rule` | Auto-int |
| OtType | `ot_type` | Auto-int |
| RawFingerprintLog | `raw_Fingerprint_log` (**mixed case**) | Auto-int |
| ProcessedAttendance | `processed_attendance` | Auto-int |

### Naming Issues to Address

| Issue | Current | Recommended |
|---|---|---|
| Inconsistent table name case | `Roster` (PascalCase) | `roster` |
| Typo in table name | `leave_apllication` | `leave_application` |
| Mixed case table name | `raw_Fingerprint_log` | `raw_fingerprint_log` |

---

## Field Naming Conventions

### Standard Patterns

| Pattern | Example | Usage |
|---|---|---|
| `camelCase` | `empNo`, `firstName`, `dateOfBirth` | All Prisma model fields |
| `Id` suffix | `companyId`, `branchId`, `leaveTypeId` | Foreign key fields |
| `Rln` suffix | `branchRln`, `departmentRln`, `designationRln` | Relation names on Employee |
| `Flag` suffix | `rosterFlag`, `processedFlag`, `empStatusFlag` | Boolean/status indicators |
| Timestamps | `createdAt`, `updatedAt`, `synceAt` | Auto-managed dates |

### Relation Naming

| Model | Relation Name | Target | Notes |
|---|---|---|---|
| Employee | `branchRln` | Branch | Explicit name to avoid conflict |
| Employee | `departmentRln` | Department | |
| Employee | `designationRln` | Designation | |
| Employee | `swapsInitiated` | EmpSwap (SwapFrom) | Named relation |
| Employee | `swapsReceived` | EmpSwap (SwapTo) | Named relation |
| Employee | `allocations` | EmployeeRoster | |

---

## Server Action Naming Conventions

| Pattern | Example | Usage |
|---|---|---|
| `get*` | `getAllCompanies`, `getShifts` | Read operations |
| `save*` / `add*` | `saveEmployee`, `addCompany` | Create operations |
| `search*` | `searchCompanies`, `searchBranches` | Search/filter operations |
| `*Action` | `CreateShiftAction`, `LogoutAction` | Next.js Server Actions |
| `change*` | `changeHod` | Update operations |
| `remove*` / `delete*` | `removeEmpFromRoster`, `deleteHolidayById` | Delete operations |

---

## File Organization Conventions

```
lib/server-actions/
├── asign-roster/           # Roster assignment actions
│   └── employeeToRoster.ts
├── emp/                    # Employee-facing actions
│   ├── employee-details.ts
│   └── employee-report-actions.ts
├── ems/                    # Admin EMS actions
│   ├── branch.ts
│   ├── company.ts
│   ├── createShift.ts
│   ├── department.ts
│   ├── designation.ts
│   ├── save-employee.ts
│   ├── rosterAllAction.ts
│   ├── hrm/                # HRM sub-actions
│   ├── roster/             # Roster sub-actions
│   └── ta/                 # Time & Attendance sub-actions
└── logout.ts
```

---

## API Contracts

### Standard Server Action Response

```typescript
interface ActionResponse<T = any> {
  success: boolean;
  message?: string;
  error?: string;
  data?: T | null;
}
```

### Standard List Response

```typescript
interface ListResponse<T> {
  success: boolean;
  data?: T[];
  error?: string;
}
```

### Export Response

```typescript
interface ExportResponse {
  success: boolean;
  message?: string;
  error?: string;
  downloadUrl?: string;
  filename?: string;
  filepath?: string;
}
```

---

## Constant Data Keys (`app/ems/data/constant.json`)

| Key | Purpose | Values |
|---|---|---|
| `gender` | Gender options | Male, Female |
| `maritalStatus` | Marital status options | Single, Married, Divorced, Widowed |
| `employmentCategory` | Employment category | SHOP_AND_OFFICE, WAGES_BOARD |
| `oCGrade` | OC Grade presets | General Worker, Junior/Middle/Senior Managers, etc. |
| `rosterStatus_Constant` | Roster status | Active, Inactive, Expired |
| `holiday_types` | Holiday types | Government, Company, Poya, Commercial |
| `employeement_status` | Employment status | PROBATION, PERMANENT, CONTRACT |
| `accrual_Type` | Leave accrual | FIXED, MONTHLY |
| `leave_types` | Leave categories | ANNUAL, CASUAL, OTHER |
| `otTypeOptions` | OT multipliers | Single, Double, Triple |
| `AttendanceMode` | Attendance tracking | GENERAL, SHIFT |
