# ADR-003: Multi-Tenancy via Tenant ID and Global Scopes

## Context
We require a cost-effective, maintainable SaaS architecture for small-to-medium enterprises in Sri Lanka without the operational overhead of multi-database migrations.

## Decision
Implement a single-database multi-tenancy model using `tenant_id` columns paired with automatic Global Eloquent Scopes.
