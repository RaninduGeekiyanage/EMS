# M00 UI Screens & Pages Specification

## 1. Authentication Screens
1. **Login Page (`/login`)**:
   - Layout: Centered dark glassmorphic card on deep slate background.
   - Fields: Email Address, Password (with toggle show/hide icon), Remember Me checkbox.
   - Actions: Primary Submit ("Sign In"), "Forgot password?" text link.
   - Behavior: Instant client-side validation, error alerts on bad credentials or inactive account lockout.
2. **Forgot Password Page (`/forgot-password`)**:
   - Fields: Email Address.
   - Actions: "Send Reset Link", "Back to Sign In".
   - Flash: Success alert indicating email dispatch.
3. **Reset Password Page (`/reset-password/{token}`)**:
   - Fields: Email (read-only/pre-filled), New Password, Confirm New Password.
   - Actions: "Reset Password".

---

## 2. Super Admin Platform (`/admin/dashboard`)
1. **Summary KPI Metric Row**:
   - Total Companies (with active/inactive count).
   - Total Platform Users.
   - AMS Module Adoption Rate.
   - Payroll Module Adoption Rate.
2. **Action Bar**:
   - Search companies by name or slug.
   - "New Company" button (opens provisioning modal).
3. **Provisioning Modal**:
   - Step 1: Company details (Name, Slug).
   - Step 2: Company Owner user details (Owner Name, Owner Email, Password).
   - Step 3: Module toggles (Enable AMS checkbox, Enable Payroll checkbox).
4. **Reset Owner Password Modal**:
   - Displays company name and current owner email.
   - Input for New Password and Confirmation.
   - "Update Password" submission.
5. **Companies Data Table**:
   - Columns: Company Name & Slug, Owner Name & Email, Status (Active/Inactive toggle), AMS Badge (ON/OFF toggle), Payroll Badge (ON/OFF toggle), Actions.
   - Action Buttons: "Reset Owner Password", "Work as Admin" (impersonation).

---

## 3. Top Impersonation Banner
- Appears fixed at the top of every tenant screen whenever `is_impersonating === true`.
- Styling: Amber warning gradient border, icon, bold text: `Acting as Company Admin for: Ceylon Tea Co. (ceylon-tea)`.
- Action: "Exit to Super Admin" button (executes `POST /admin/impersonate/exit`).

---

## 4. Tenant Executive Dashboard (`/dashboard`)
1. **Header Row**:
   - Greeting, Active Company Name, Current Date, Quick Status pill.
2. **Cross-Module KPI Cards**:
   - Total Active Headcount (M01).
   - Today's Attendance Overview: Present, Late, Absent, On Leave (M02 - shown if AMS enabled).
   - Pending Leave Requests awaiting action (M02 - shown if AMS enabled).
   - Next Payroll Cutoff countdown & EPF status (M03 - shown if Payroll enabled).
3. **Quick Action Shortcuts**:
   - "Add Employee", "Import Biometric Logs", "Apply Leave", "View Attendance Ledger".
4. **Recent Feeds Grid**:
   - Pending Leave Applications table with quick action links.
   - Recent Biometric imports status log.
   - Upcoming Sri Lankan Public Holidays calendar widget.

---

## 5. Responsive Application Shell (`AuthenticatedLayout`)
1. **Desktop Sidebar**:
   - Brand Logo & Company switcher indicator.
   - Collapsible toggle (expanded mode: icons + labels; collapsed mode: icons with tooltips).
   - Grouped Navigation:
     - Core: Dashboard
     - Organization (M01): Company Profile, Departments, Employees
     - Attendance (M02, if enabled): Daily Ledger, Biometric Ingestion, Shifts, Work Calendar, Leave Requests
     - Payroll (M03, if enabled): Payroll Runs, Payslips
2. **Mobile Drawer**:
   - Hamburger icon in mobile header opens smooth slide-over sidebar with backdrop.
3. **Top Navigation Bar**:
   - Mobile menu toggle button.
   - Current Tenant badge.
   - User Profile Dropdown: Name, Email, Role pill (`Company Owner`, `HR Manager`, `Super Admin`), and Logout button.
