# Modules Overview & Build Order

## 1. Modular Architecture
EMS is built in modular layers:
0. **M00 — Core Authentication, Super Admin Platform & Navigation Shell** (Platform Foundation)
1. **M01 — Organization & Employee Master** (Base Domain Foundation)
2. **M02 — Attendance Management System (AMS)** (Requires M01)
3. **M03 — Payroll & Statutory Compliance** (Requires M01 & M02)

## 2. Status & Dependency Rule
```
[ M00 Core Foundation ] ──> [ M01 Master ] ──> [ M02 AMS ] ──> [ M03 Payroll ]
```
- M00 encapsulates Super Admin tenant provisioning, zero-friction authentication, and cross-module executive dashboards.
- Module toggles on M00 control tenant-level access to M02 (AMS) and M03 (Payroll).
- No work may begin on M02 or M03 until prior modules pass all automated unit, feature, and multi-tenant isolation tests.
