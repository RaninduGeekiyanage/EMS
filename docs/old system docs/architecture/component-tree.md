# Component Tree

## Application Layout Hierarchy

```
<html>
└── <body>
    └── RootLayout (app/layout.tsx)
        ├── ThemeProvider (next-themes)
        │
        ├── (auth) group — AuthLayout (app/(auth)/layout.tsx)
        │   ├── /sign-in        → SignInPage
        │   ├── /sign-up        → SignUpPage
        │   ├── /forgot-password → ForgotPasswordPage
        │   └── /reset-password  → ResetPasswordPage
        │
        ├── (employee) group — EmployeeLayout (app/(employee)/layout.tsx)
        │   ├── /emp-dashboard   → EmployeeDashboardPage
        │   └── /emp-profile     → EmployeeProfilePage
        │
        └── /ems — EMSLayout (app/ems/layout.tsx)
            ├── SidebarProvider
            │   ├── AppSidebar
            │   │   ├── SidebarHeader → Company branding
            │   │   ├── SidebarContent
            │   │   │   ├── NavMain → Collapsible nav groups
            │   │   │   │   ├── Employees (Manage, View)
            │   │   │   │   ├── HRM Master (Company, Branch, Dept, Designation, HOD, OC Grade, Wages Board)
            │   │   │   │   ├── Manage Roster (Shift, Create, View, All, Assign)
            │   │   │   │   ├── TA Setting (Holidays, Leave Types, Leave Rules, OT Types)
            │   │   │   │   ├── Attendance (Import, Daily View, Manual Entry, Missing Punch, Summary)
            │   │   │   │   ├── Leave Management (Apply, Approve, Calendar, Balances)
            │   │   │   │   ├── Overtime Management (Requests, Approval, Summary)
            │   │   │   │   ├── Settings (General, Team, Billing, Limits)
            │   │   │   │   └── Report (Employee Report)
            │   │   │   ├── NavProjects → Quick-access project links
            │   │   │   └── NavSecondary → Support, Feedback
            │   │   └── SidebarFooter
            │   │       └── NavUser → Avatar, email, dropdown (Sign Out)
            │   └── SidebarInset
            │       ├── Header
            │       │   ├── SidebarTrigger
            │       │   ├── ThemeToggle
            │       │   └── EmsTopNavBar → User dropdown
            │       └── <main> → {children} ← Page content
```

---

## Shared UI Components

| Component | Path | Purpose |
|---|---|---|
| `AppSidebar` | `components/app-sidebar.tsx` | Main admin sidebar with nav groups |
| `NavMain` | `components/nav-main.tsx` | Collapsible navigation sections |
| `NavUser` | `components/nav-user.tsx` | User avatar + dropdown (sign out) |
| `NavProjects` | `components/nav-projects.tsx` | Quick links section |
| `NavSecondary` | `components/nav-secondary.tsx` | Support / Feedback links |
| `EmsTopNavBar` | `components/ems-top_navBar.tsx` | Top bar user controls |
| `LoginNavBar` | `components/LoginNavBar.tsx` | Auth page navigation |
| `ThemeToggle` | `components/theme-toggle.tsx` | Dark/Light mode switch |
| `ThemeProvider` | `components/theme-provider.tsx` | next-themes wrapper |
| `DatePickerField` | `components/DatePickerField.tsx` | Date picker form field |
| `TimeRangePicker` | `components/TimeRangePicker.tsx` | Time range selector |
| `GenericCombo` | `components/genaric-combo.tsx` | Generic combobox (searchable) |
| `SearchableDropdown` | `components/searchable-dropdown.tsx` | Async searchable dropdown |
| `SimpleComboBox` | `components/simple-combo-box.tsx` | Simple static combobox |

### shadcn/ui Primitives (components/ui/)

Alert Dialog, Avatar, Button, Calendar, Card, Checkbox, Collapsible, Command, Dialog, Dropdown Menu, Form, Input, Label, Popover, Scroll Area, Select, Separator, Sheet, Sidebar, Skeleton, Sonner (Toasts), Switch, Table, Tooltip, and more.

---

## Custom Hooks

| Hook | Path | Purpose |
|---|---|---|
| `useDebounce` | `hooks/use-debounse.ts` | Debounces a value by a configurable delay |
| `useMobile` | `hooks/use-mobile.ts` | Detects mobile viewport for responsive behavior |
