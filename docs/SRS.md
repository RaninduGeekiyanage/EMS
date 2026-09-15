# EMS Master Software Requirements Specification (SRS)
## Version 1.0 — Confirmed Specifications

### 1. Project Overview & Objectives
EMS is a unified, multi-tenant Employee Management System encompassing Attendance Management (AMS) and Payroll processing designed specifically to comply with Sri Lankan Labor Laws (Shop & Office Employees Act, Wages Board Ordinance, EPF/ETF Acts, and APIT Tax).

### 2. Confirmed Technical Decisions
- **Payment Modes**: Monthly, Daily, and Hourly wage options are in **Phase 1**.
- **Attendance Data Capture**: Abstracted biometric adapter pattern (ZKTeco DAT, generic CSV, Excel XLSX, Tab/Pipe TXT in Phase 1; DB/Network in Phase 2).
- **Tenant & Company Scope**: 1 Company per Tenant, supporting multiple Branches and Departments.
- **EPF / ETF**: Toggleable at tenant level (`epf_enabled: true/false`), with individual employee override.
- **Statutory APIT Tax**: Included in **Phase 1** with configurable tax slabs.
- **Bank Salary Files**: BoC, Commercial Bank, Sampath Bank, HNB, People's Bank, and NSB formats supported.

### 3. Modular Phased Roadmap
```
Module 1: Organization & Employee Master (Core) -> Complete & Sign-off
   ↓
Module 2: Attendance Management System (AMS)     -> Complete & Sign-off
   ↓
Module 3: Payroll & Statutory Compliance         -> Complete & Sign-off
```
