# EMS — Employee Management System

> Sri Lanka Attendance & Payroll Management Platform

## Overview
EMS is a modular, multi-tenant SaaS platform for Sri Lankan businesses to manage employee attendance
and payroll in full compliance with local labor laws (Shop & Office Act, Wages Board Ordinance,
EPF/ETF Acts, APIT Income Tax).

## Tech Stack
| Layer | Technology |
|-------|-----------|
| Backend | Laravel 11+ (strict types, Repository + Service pattern) |
| Frontend | React 18 + Inertia.js + TypeScript + Tailwind CSS + ShadCN UI |
| Database | MySQL 8.0+ (InnoDB, strict foreign keys, ULID primary keys) |
| Auth | Laravel Sanctum + Spatie Laravel-Permission (Teams enabled) |
| Queue | Laravel Horizon + Redis |
| PDF | DomPDF (barryvdh/laravel-dompdf) |
| Image | Intervention Image 3.x |

## Modules
| Module | Code | Status | Description |
|--------|------|--------|-------------|
| Organization & Employee Master | M01 | 🔴 Not Started | Company, branches, departments, employees, pay structures |
| Attendance Management System | M02 | 🔴 Not Started | Shifts, text-file import, OT, leave management |
| Payroll | M03 | 🔴 Not Started | Monthly/Daily/Hourly payroll, EPF/ETF, APIT, bank files |

## Build Order (Strict)
```
M01 Master → Full Test → M02 AMS → Full Test → M03 Payroll → Full System Test
```
Each module must pass all tests before the next begins.

## Agent Quick Start
1. Open `AGENT.md` — read project context and active module
2. Read `docs/rules/AGENT_RULES.md` — mandatory rules
3. Read `docs/rules/READ_ORDER.md` — which files to read for your task
4. Check `docs/tasks/MASTER_TASK_LIST.md` — overall progress
5. Open active module `TASKS.md` — pick next task

## Project Structure
```
D:\Projects\EMS\
├── AGENT.md                    ← AI Agent entry point (READ FIRST)
├── README.md                   ← This file
└── docs\
    ├── SRS.md                  ← Master Software Requirements Specification
    ├── README.md               ← Docs navigation index
    ├── architecture\           ← System design documents
    ├── decisions\              ← Architecture Decision Records (ADRs)
    ├── modules\                ← Per-module specs and task lists
    │   ├── M01-master\
    │   ├── M02-ams\
    │   └── M03-payroll\
    ├── rules\                  ← Agent rules + coding standards
    ├── standards\              ← Code conventions
    ├── tasks\                  ← Master task tracking
    ├── tech-stack\             ← Technology deep-dives
    ├── templates\              ← Reusable doc templates
    └── workflows\              ← Development process guides
```

## Current Phase
**Phase 1 — Documentation Complete. Starting Development.**
Active Module: **M01 — Organization & Employee Master**
