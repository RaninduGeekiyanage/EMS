# ADR-001: Unified Monolith with Inertia.js and React

## Context
We need a modern, reactive user interface with rapid development cycles and minimal network latency between the frontend presentation and backend business logic.

## Decision
Adopt Laravel 11 with Inertia.js and React 18 in a monolithic project structure instead of maintaining a decoupled REST/GraphQL API.

## Consequences
- **Positive**: Direct server-side data passing without API serialization overhead, faster UI rendering, simpler session-based authentication.
- **Negative**: No decoupled public API out of the box (can be added later via Sanctum API routes if mobile apps are required).
