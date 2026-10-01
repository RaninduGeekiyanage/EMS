# Modules Overview & Build Order

## 1. Modular Architecture
EMS is built in modular layers:
0. **M00 — Core Authentication, Super Admin Platform & Navigation Shell** (Platform Foundation)
1. **M01 — Organization & Employee Master** (Base Domain Foundation)
2. **M02 — Attendance Management System (AMS)** (Requires M01)
3. **M03 — Payroll & Statutory Compliance** (Requires M01 & M02)
4. **M04 — Enterprise Attendance Regularization, Advanced Leave Architecture & Dynamic Payroll Engine** (Requires M01, M02 & M03)

## 2. Status & Dependency Rule
```
[ M00 Core Foundation ] ──> [ M01 Master ] ──> [ M02 AMS ] ──> [ M03 Payroll ] ──> [ M04 Enterprise Suite ]
```
- M00 encapsulates Super Admin tenant provisioning, zero-friction authentication, and cross-module executive dashboards.
- Module toggles on M00 control tenant-level access to M02 (AMS), M03 (Payroll), and M04 (Enterprise Suite).
- M04 eliminates hardcoding, closes operational gaps (unapproved half-days, short leaves, shift off-in-lieu), and delivers dynamic pay items, staff loans, and employee self-service.
