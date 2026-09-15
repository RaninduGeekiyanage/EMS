# Testing Rules & Guidelines

## 1. Test Framework & Philosophy
- Use **Pest PHP** for clean, readable syntax.
- Target minimum 80% coverage on core Services and Calculation engines.
- Test DB: SQLite in-memory or dedicated test MySQL database with `RefreshDatabase`.

## 2. Multi-Tenant Isolation Tests
- Every module must include automated tests asserting that Tenant A cannot view, edit, or delete records of Tenant B.
- Unauthorized roles must receive HTTP 403 Forbidden.

## 3. Calculation Accuracy Tests
- Test edge cases for overtime: weekday OT (1.5x), holiday OT (2.0x), night shift differentials.
- Precision checks: Assert currency amounts down to 2 decimal places (LKR 0.01).
- Test EPF/ETF calculations under both enabled and disabled tenant toggles.
