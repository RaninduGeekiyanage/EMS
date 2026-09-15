# Modules Overview & Build Order

## 1. Modular Architecture
EMS is built in 3 strictly sequential modules:
1. **M01 — Organization & Employee Master** (Base foundation)
2. **M02 — Attendance Management System (AMS)** (Requires M01)
3. **M03 — Payroll & Statutory Compliance** (Requires M01 & M02)

## 2. Status & Dependency Rule
```
[ M01 Master ] ──(Passed & Signed Off)──> [ M02 AMS ] ──(Passed & Signed Off)──> [ M03 Payroll ]
```
No work may begin on M02 or M03 until prior modules pass all automated unit, feature, and multi-tenant isolation tests.
