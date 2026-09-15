# Master Architecture Overview

```
[ Web Browser / Client (React 18 + Inertia.js + ShadCN UI) ]
                     │  (HTTP / Inertia Protocol)
                     ▼
[ Laravel 11 Application Server (Monolith) ]
   ├── Routing & Middleware (Sanctum, Tenant Scope, Spatie Permission)
   ├── Controllers (Thin, authorization & data marshaling)
   ├── Service Layer (Pure business logic, calculation engines)
   └── Repository Layer (Eloquent abstraction & database querying)
                     │
                     ▼
[ MySQL 8.0+ Database (InnoDB, ULID, Tenant Scoped) ]
[ Redis (Session caching, Horizon job queues) ]
```

## Core Architectural Decisions
- **Monolith with Inertia.js**: Low latency, unified codebase, zero separate REST API boilerplate.
- **Strict Multi-Tenancy**: Single database with `tenant_id` global query scopes.
- **Repository + Service Pattern**: Clean separation of persistence and domain rules.
