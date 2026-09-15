# M01 Test Plan

## 1. Unit Tests
- Tenant resolution and Global Scope test.
- Employee encryption casts on `nic` and `account_no`.
- Repository & Service methods for Employee and Department creation.

## 2. Feature Tests
- CRUD operations for Company, Branches, Departments, Designations.
- Employee creation under Monthly, Daily, and Hourly payment modes.
- Tenant isolation: Verify Tenant B cannot access Tenant A records via HTTP request.
- RBAC validation: Ensure non-privileged users receive 403 Forbidden.
