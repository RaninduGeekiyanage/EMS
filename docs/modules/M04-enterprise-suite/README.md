# M04 — Enterprise Attendance Regularization, Advanced Leave Architecture & Dynamic Payroll Engine

## 1. Module Overview
Module **M04** elevates the EMS platform from its foundational baseline (M00–M03) into a fully configurable, multi-tenant enterprise-grade Workforce, Absence, and Payroll ecosystem. It eliminates all hardcoded values, closes operational gaps (such as unapproved half-days, short leaves, shift off-in-lieu), introduces a dynamic Pay Items and Staff Loan ledger, and delivers an intuitive Employee Self-Service (ESS) interface alongside multi-tier managerial sign-offs.

## 2. Core Pillars of M04

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                       M04 ENTERPRISE SUITE                                       │
└────────────────────────────────────────────────┬─────────────────────────────────────────────────┘
                                                 │
         ┌───────────────────────────────────────┼───────────────────────────────────────┐
         ▼                                       ▼                                       ▼
┌─────────────────────────────┐        ┌─────────────────────────────┐        ┌─────────────────────────────┐
│    Pillar 1: Attendance     │        │     Pillar 2: Absence       │        │     Pillar 3: Dynamic       │
│    Action & Regularization  │        │   & Leave Architecture      │        │       Payroll Engine        │
├─────────────────────────────┤        ├─────────────────────────────┤        ├─────────────────────────────┤
│ • Unapproved Half-Day       │        │ • Short Leave / Gate Pass   │        │ • Pay Item Master (Earnings │
│   Resolution Workflows      │        │   (Quota tracking)          │        │   & Deductions)             │
│ • Employee Punch            │        │ • Compensatory Off (C-Off / │        │ • Employee Salary Profiles  │
│   Regularization Requests   │        │   Shift Off-in-Lieu)        │        │ • Staff Loans & Advances    │
│ • Attendance Anomaly Queue  │        │ • Multi-Tier Approval Flow  │        │ • Configurable Multipliers  │
│ • Period Freeze & Sign-Off  │        │   (HOD L1 ──► HR L2)        │        │ • Cut-Off Cycle Settings    │
└─────────────────────────────┘        └─────────────────────────────┘        └─────────────────────────────┘
```

## 3. Module Dependencies
- **M00 Core Foundation**: Multi-tenant isolation, Spatie IAM, TenantTeamResolver.
- **M01 Master Data**: Employee profiles, branches, departments, HODs, wages board categories.
- **M02 AMS**: Shifts, rosters, biometric logs, daily attendance ledger (`AttendanceDaily`).
- **M03 Payroll**: Base payroll run lifecycle (`PayrollRun`, `PayrollEmployee`, payslip generator).

## 4. Documentation Index
1. [Requirements & Statutory Specification](requirements.md)
2. [Data Models & Architecture](architecture.md)
3. [IAM Permissions & Role Catalog](permissions.md)
4. [User Interface & Dedicated Pages](ui-screens.md)
5. [Implementation Task Checklist](TASKS.md)
