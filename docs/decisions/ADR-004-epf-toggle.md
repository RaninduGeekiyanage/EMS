# ADR-004: Configurable EPF/ETF Toggle

## Context
Small establishments and certain non-formal operations in Sri Lanka do not register for EPF/ETF or run simplified payrolls without statutory fund deductions.

## Decision
Implement a tenant-level flag (`epf_enabled`) in `tenant_settings`, backed by individual employee-level override options.
