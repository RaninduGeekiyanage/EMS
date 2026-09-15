# ADR-002: Monolith vs Dedicated API

## Context
Traditional SPAs with independent REST APIs require double-routing, API version management, token refreshment protocols, and substantial boilerplate.

## Decision
Use Inertia.js as the adapter connecting server controllers directly to React view components.

## Consequences
- Single unified deployment.
- Native CSRF protection.
- State sharing through Inertia page props.
