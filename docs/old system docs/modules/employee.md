# Module: Employee Management

## Overview

Core HRM module for employee lifecycle management — registration, profile management, bank details, payroll details, and reporting.

---

## Models

### Employee
| Field | Type | Constraints | Notes |
|---|---|---|---|
| `id` | Int | PK, auto-increment | Internal ID |
| `empNo` | Int | Unique | Employee number (business key) |
| `email` | String | Unique | Employee email |
| `firstName` | String | Required | |
| `lastName` | String | Required | |
| `fullName` | String | Required | Computed full name |
| `gender` | String | Required | `"male"` / `"female"` |
| `dateOfBirth` | DateTime? | Optional | |
| `dateOfAppointment` | DateTime? | Optional | Hiring date |
| `dateOfResignation` | DateTime? | Optional | Exit date |
| `nic` | String | Required | National Identity Card |
| `maritalStatus` | String | Required | `single / married / divorced / widowed` |
| `mobileNo` | String | Required | |
| `landNo` | String | Required | Landline |
| `permanentAddress` | String | Required | |
| `tempAddress` | String? | Optional | |
| `city` | String | Required | |
| `activeStatus` | Boolean | Default: `true` | Active/inactive employee |
| `empStatusFlag` | Boolean | Default: `true` | Employment status flag |
| `rosterFlag` | String | Default: `"N"` | `"Y"` if assigned to roster |
| `attendanceMode` | AttendanceMode | Default: `GENERAL` | `GENERAL` or `SHIFT` |
| `employmentStatus` | EmploymentStatus | Enum | `PROBATION / PERMANENT / CONTRACT` |
| `employmentCategory` | EmploymentCategory | Enum | `SHOP_AND_OFFICE / WAGES_BOARD` |
| `company` | Int | FK → Company.id | Company assignment |
| `branch` | Int | FK → Branch.id | Branch assignment |
| `department` | Int | FK → Department.id | Department assignment |
| `designation` | Int? | FK → Designation.id | Optional designation |
| `ocGradeId` | Int | FK → OCGrade.id | Organizational grade |
| `jobCategoryId` | Int? | FK → WagesBoardJobCategory.id | Only for WAGES_BOARD |
| `userId` | String? | FK → User.id (1:1) | Linked user account |

### EmployeeBankDetails
| Field | Type | Constraints | Notes |
|---|---|---|---|
| `empNo` | Int | Unique, FK → Employee | |
| `bankName` | String | Required | |
| `branchName` | String | Required | Bank branch |
| `accountNo` | String | Required | |
| `accountType` | String | Required | |
| `ifscCode` | String? | Optional | |

### EmpPayrollDetails
| Field | Type | Constraints | Notes |
|---|---|---|---|
| `empNo` | Int | Unique, FK → Employee | Cascade delete |
| `basicSalary` | Float | Required | |
| `grossEarnings` | Float | Required | |
| `totalDeductions` | Float | Required | |
| `netSalary` | Float | Required | |
| `month` | String | Required | Period |
| `workingDays` | Int | Required | |
| `mealDays` | Int | Required | |
| `overtimeHours` | Float | Required | |
| `noPayHours` | Float | Required | |
| `paymentStatus` | String | Required | |
| `verifiedBy` | Int | Required | Verifier empNo |
| `approvedBy` | Int | Required | Approver empNo |
| `paidOn` | DateTime? | Optional | |

---

## Server Actions

### `saveEmployee` (`lib/server-actions/ems/save-employee.ts`)

**Purpose:** Create a new employee record with auto-initialized leave balances.

**Flow:**
1. Validate input with `formSchema.safeParse()`
2. Check for duplicate `empNo`
3. Execute Prisma transaction:
   - Create `Employee` record
   - Fetch all `LeaveType` records
   - For each leave type:
     - If `OTHER` + `SHOP_AND_OFFICE` → lookup `ShopAndOfficeLeaveAccessRule`
     - If `OTHER` + `WAGES_BOARD` → lookup `WagesBoardLeaveAccessRules`
     - Create `EmployeeLeaveBalance` with calculated entitlement
4. Return `{ success, message, data: { empNo, email } }`

### `getEmployeesByName` (`lib/server-actions/emp/employee-details.ts`)
Search employees by full name (case-insensitive, top 10).

### `SearchEmployeeByEmpNo`
Find single employee by exact employee number.

### `getEmployeeByCompany`
List employees for a given company with branch and department relations.

### `getJobCategory`
Fetch all wages board job categories.

### `getOcGrades`
Fetch all OC grade records.

---

## Validation Schema (`lib/formSchema.ts`)

### `formSchema` (Employee Creation)

| Field | Validation | Notes |
|---|---|---|
| `empNo` | `string().min(1)` | Cast to number on save |
| `email` | `string().min(1)` | |
| `firstName` | `string().min(2).max(150)` | |
| `lastName` | `string().min(2).max(150)` | |
| `fullName` | `string().min(2).max(300)` | |
| `dateOfBirth` | `string()` + date parse check | |
| `nic` | `string().min(9).max(16)` | NIC format |
| `gender` | `string().min(1)` | |
| `maritalStatus` | `string().min(1)` | |
| `permanentAddress` | `string().min(5).max(300)` | |
| `tempAddress` | `string().min(1)` | |
| `city` | `string().min(1)` | |
| `landlineNo` | `string().min(10).max(11)` | |
| `mobileNo` | `string().min(10).max(13)` | |
| `company` | `coerce.number().min(1)` | |
| `branch` | `coerce.number().min(1)` | |
| `designation` | `coerce.number().min(1)` | |
| `departmentId` | `coerce.number().min(1)` | |
| `dateOfAppointment` | `string().min(1)` | |
| `dateOfResignation` | `string().optional()` | |
| `ocGradeId` | `coerce.number().min(1)` | |
| `employmentStatus` | `string().min(1)` | |
| `employmentCategory` | `string().min(1)` | |
| `jobCategoryId` | `coerce.number().optional()` | Required if `WAGES_BOARD` |

**Refinement:** If `employmentCategory === WAGES_BOARD`, then `jobCategoryId` must be provided.

---

## Routes

| Route | Page | Description |
|---|---|---|
| `/ems/manage-employee` | Manage Employee page | Employee creation form |
| `/ems/view-employee` | View Employee page | Employee listing/search |
| `/emp-dashboard` | Employee Dashboard | Self-service landing (role: user) |
| `/emp-profile` | Employee Profile | Self-service profile view |

---

## Report Actions (`lib/server-actions/emp/employee-report-actions.ts`)

### `generateEmployeeReport`
Validates filters via `employeeReportSchema`, builds Prisma `WHERE` clause, returns record count.

### `getEmployeeReportData`
Fetches employee data with dynamic field selection based on user-chosen fields. Includes relation joins for branch, department, designation, jobCategory.

### `exportReportToPDF`
Generates PDF using `jsPDF` + `autoTable`. Features:
- Auto orientation (landscape for >6 fields)
- Dynamic column widths by field type
- Saved to `public/exports/` or temp dir

### `exportReportToExcel`
Generates `.xlsx` with two sheets:
1. **Employee Data** — filtered records
2. **Report Information** — applied filters and metadata

### `employeeReportSchema`

| Field | Validation |
|---|---|
| `company` | `"all"` or numeric ID |
| `branch` | `"all"` or numeric ID |
| `department` | `"all"` or numeric ID |
| `employmentCategory` | String (required) |
| `employmentStatus` | String (required) |
| `selectedFields` | Array of strings, min 1 |
| `activeStatus` | Boolean (optional) |
