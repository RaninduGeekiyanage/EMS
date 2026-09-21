# User Journeys & Workflows

## 1. Employee Onboarding Journey

```mermaid
flowchart TD
    A["Admin opens Manage Employee"] --> B["Fill employee form"]
    B --> C["Select Company → Branch → Department"]
    C --> D["Select Employment Category"]
    D --> E{"WAGES_BOARD?"}
    E -->|Yes| F["Select Job Category"]
    E -->|No| G["Continue"]
    F --> G
    G --> H["Select OC Grade, Designation"]
    H --> I["Submit Form"]
    I --> J["saveEmployee() Server Action"]
    J --> K["Validate via formSchema"]
    K --> L["Check duplicate empNo"]
    L --> M["Prisma Transaction"]
    M --> N["Create Employee record"]
    N --> O["Fetch all LeaveTypes"]
    O --> P["Calculate entitlements per rule engine"]
    P --> Q["Create EmployeeLeaveBalance records"]
    Q --> R["Success toast + reset form"]
```

---

## 2. Roster Creation & Assignment Journey

### 2a. Create Roster

```mermaid
flowchart TD
    A["Admin opens Create Roster"] --> B["Enter roster name, branch, dates"]
    B --> C["Select recurrence: daily/weekly/monthly"]
    C --> D["Build shift pattern"]
    D --> E["Assign shifts to each day in pattern"]
    E --> F["Submit"]
    F --> G["SaveRoster() Server Action"]
    G --> H["Transaction: Create Roster + RosterPattern entries"]
    H --> I["Success"]
```

### 2b. Assign Employees to Roster

```mermaid
flowchart TD
    A["Admin opens Employee to Roster"] --> B["Select Department"]
    B --> C["Load unassigned employees (rosterFlag = N)"]
    C --> D["Select employees to assign"]
    D --> E["Select Roster"]
    E --> F["Set Effective From date"]
    F --> G["Submit"]
    G --> H["assignEmployeesToRoster()"]
    H --> I["Validate effective dates"]
    I --> J["Transaction: Create EmployeeRoster + Update flags"]
    J --> K["Expand roster pattern into EmployeeShiftSchedule"]
    K --> L["Batch insert shift entries (500/batch)"]
    L --> M["Success with logs"]
```

### 2c. Remove Employee from Roster

```mermaid
flowchart TD
    A["Admin selects assigned employee"] --> B["Set removal date"]
    B --> C["removeEmpFromRoster()"]
    C --> D["Delete future EmployeeShiftSchedule entries"]
    D --> E["Set rosterFlag = N"]
    E --> F["Update EmployeeRoster effectiveTo"]
    F --> G["Employee available for re-assignment"]
```

---

## 3. Attendance Processing Journey

### 3a. Import Biometric Data

```mermaid
flowchart TD
    A["Admin opens Import Attendance"] --> B["Upload CSV from biometric device"]
    B --> C["importAttendanceRawLog()"]
    C --> D["Parse CSV lines"]
    D --> E["Convert DD/MM/YYYY + H:mm AM/PM to ISO"]
    E --> F["Check last imported record date"]
    F --> G["Filter: only insert records after last date"]
    G --> H["Bulk insert to raw_Fingerprint_log"]
    H --> I["Return: inserted count, skipped count"]
```

### 3b. Sync Attendance

```mermaid
flowchart TD
    A["Admin triggers Sync"] --> B["syncAttendance()"]
    B --> C["Fetch unprocessed raw logs"]
    C --> D["Group by employee"]
    D --> E["For each employee:"]
    E --> F["Get unique dates (UTC → Asia/Colombo)"]
    F --> G["Fetch EmployeeShiftSchedule for those dates"]
    G --> H["For each schedule:"]
    H --> I["Compute attendance windows"]
    I --> J["Filter raw logs within windows"]
    J --> K["Find IN punch (first in window)"]
    K --> L["Find OUT punch (last in window, after IN)"]
    L --> M["Detect anomalies"]
    M --> N["Calculate status + worked minutes"]
    N --> O["Upsert ProcessedAttendance"]
    O --> H
    H -->|All done| P["Mark raw logs as processed"]
    P --> Q["Return results summary"]
```

---

## 4. Authentication Flow

### 4a. Sign-In

```mermaid
flowchart TD
    A["User visits /sign-in"] --> B["Enter email + password"]
    B --> C["Client-side Zod validation"]
    C --> D["better-auth signIn.email()"]
    D --> E{"Success?"}
    E -->|Yes| F{"User role?"}
    F -->|admin| G["Redirect → /ems"]
    F -->|user| H["Redirect → /emp-dashboard"]
    E -->|No| I["Show error toast"]
```

### 4b. Password Reset

```mermaid
flowchart TD
    A["User visits /forgot-password"] --> B["Enter email"]
    B --> C["better-auth forgetPassword()"]
    C --> D["Send reset email via nodemailer"]
    D --> E["User clicks link in email"]
    E --> F["Opens /reset-password?token=xxx"]
    F --> G["Enter new password + confirm"]
    G --> H["better-auth resetPassword()"]
    H --> I["Redirect to /sign-in"]
```

---

## 5. Report Generation Journey

```mermaid
flowchart TD
    A["Admin opens Employee Report"] --> B["Set filters: Company, Branch, Dept, Category, Status"]
    B --> C["Select fields to include"]
    C --> D["Click Generate"]
    D --> E["getEmployeeReportData()"]
    E --> F["Build dynamic Prisma WHERE + SELECT"]
    F --> G["Fetch data"]
    G --> H["Display in data table"]
    H --> I{"Export?"}
    I -->|PDF| J["exportReportToPDF()"]
    I -->|Excel| K["exportReportToExcel()"]
    J --> L["Generate PDF → Save → Download URL"]
    K --> M["Generate XLSX → Save → Download URL"]
```

---

## 6. Organization Setup Flow

```mermaid
flowchart TD
    A["Setup Company"] --> B["Setup Branches under Company"]
    B --> C["Setup Departments under Branch"]
    C --> D["Setup Designations (global)"]
    D --> E["Setup OC Grades"]
    E --> F["Setup Wages Board Categories (if applicable)"]
    F --> G["Assign Department Heads"]
    G --> H["Setup Leave Types"]
    H --> I["Configure Leave Access Rules"]
    I --> J["Setup Shifts"]
    J --> K["Create Rosters with Patterns"]
    K --> L["Add Employees"]
    L --> M["Assign Employees to Rosters"]
    M --> N["Setup Holiday Schedule"]
    N --> O["System Ready for Attendance Processing"]
```

---

## 7. HOD Management Flow

```mermaid
flowchart TD
    A["Admin opens Manage HOD"] --> B["Select Company → Branch → Department"]
    B --> C["Load employees in selected department"]
    C --> D["Select employee as HOD"]
    D --> E["saveHod() Server Action"]
    E --> F{"Unique constraint check"}
    F -->|Pass| G["HOD assigned successfully"]
    F -->|Fail| H["Error: HOD already exists for this dept"]

    I["Change HOD"] --> J["Select existing HOD record"]
    J --> K["Select new employee"]
    K --> L["changeHod() Server Action"]
    L --> M{"P2002 check"}
    M -->|Pass| N["HOD changed"]
    M -->|Fail| O["Error: Employee already assigned as HOD"]
```

---

## 8. Data Flow Diagram

```mermaid
flowchart LR
    subgraph "Master Data"
        COM["Company"] --> BRN["Branch"]
        BRN --> DPT["Department"]
        DES["Designation"]
        OCG["OC Grade"]
        WBC["Wages Board Category"]
    end

    subgraph "Employee"
        EMP["Employee"] --> BNK["Bank Details"]
        EMP --> PAY["Payroll Details"]
    end

    subgraph "Roster System"
        SHF["Shift"] --> RSP["Roster Pattern"]
        RST["Roster"] --> RSP
        RST --> ERS["Employee Roster"]
        ERS --> ESS["Employee Shift Schedule"]
    end

    subgraph "Attendance"
        RAW["Raw Fingerprint Log"] --> PRA["Processed Attendance"]
        ESS --> PRA
    end

    subgraph "Leave System"
        LVT["Leave Type"] --> LVR["Leave Rules"]
        LVT --> LVA["Leave Application"]
        LVT --> LVB["Leave Balance"]
        EMP --> LVB
        EMP --> LVA
    end

    EMP --> ERS
    DPT --> EMP
    BRN --> EMP
    OCG --> EMP
    WBC --> EMP
```
