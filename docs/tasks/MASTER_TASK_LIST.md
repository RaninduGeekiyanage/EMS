# Master Task List — EMS Project

**Overall Status**: 🟢 All Modules Complete (M00 - M03 Core & Statutory Ecosystem)  
**Current Active Module**: **M03 — Payroll & Statutory Compliance (Complete & Verified)**

## Module Progress Matrix
| Module | Total Tasks | Completed | In Progress | Status |
|--------|-------------|-----------|-------------|--------|
| **M00: Core Foundation, Auth & Super Admin** | 22 | 22 | 0 | 🟢 Complete |
| **M00-AC: Enterprise Access Control & IAM** | 8 | 8 | 0 | 🟢 Complete |
| **M01: Organization & Employee Master** | 22 | 22 | 0 | 🟢 Complete |
| **M02: Attendance Management System (AMS)** | 18 | 18 | 0 | 🟢 Complete |
| **M03: Payroll & Compliance** | 24 | 24 | 0 | 🟢 Complete |

---

## M00-AC: Enterprise Access Control & IAM Matrix (Complete)
- [x] **AC-01**: Standardize 44 permissions across 8 functional domains in `RolesAndPermissionsSeeder.php`.
- [x] **AC-02**: Build `PermissionCatalog.php` service for unified metadata, icons, domain grouping, and danger classifications.
- [x] **AC-03**: Create `UpdateUserAccessRequest.php` FormRequest with dual-layer guardrails (anti-privilege escalation, anti-self-lockout, Super Admin protection).
- [x] **AC-04**: Implement `AccessControlController.php` for tenant-scoped access inspection, role assignment, and direct granular grants.
- [x] **AC-05**: Implement `SuperAdminAccessControlController.php` with dynamic tenant switcher, cross-company directory, and platform governance.
- [x] **AC-06**: Build interactive Super Admin Access Control UI (`SuperAdmin/AccessControl.tsx`) with master-detail layout and confirmation modals.
- [x] **AC-07**: Build Tenant-Scoped Access Control UI (`AccessControl/Index.tsx`) with self-editing interlocks, role inherited indicators, and direct grant badges.
- [x] **AC-08**: Register web routing, sidebar navigation links with `ShieldCheck` icon, and technical documentation in `docs/architecture/access-control.md`.

---

## Roadmap & Next Phase Objectives
1. **Statutory Tax & Pension Electronic Returns (C-Returns / R2 & IRD Schedules)**:
   - Central Bank EPF Form C / R2 monthly electronic file export.
   - IRD APIT quarterly schedule generation for tax withholding compliance.
2. **Automated End-to-End Attendance-to-Payroll Integration Pipeline**:
   - Single-click sync pulling monthly biometric totals (worked days, overtime hours, double OT, no-pay deductions) directly into new draft payroll runs.
3. **Hardware Network Push Biometric Synchronization (AMS Phase 2)**:
   - Real-time TCP/ADMS push listener for ZKTeco and IP biometric terminals.
4. **Employee Self-Service (ESS) Portal**:
   - Dedicated restricted employee login view to review individual attendance punches, submit leave requests, and download historical signed payslip PDFs.

