# Tech Stack Specification

## Core Framework

| Layer | Technology | Version | Notes |
|---|---|---|---|
| **Runtime** | Node.js | Latest LTS | Server-side execution |
| **Framework** | Next.js | 15.2.4 | App Router, Turbopack, Server Actions |
| **Language** | TypeScript | ^5.x | Strict mode via `tsconfig.json` |
| **UI Library** | React | ^19.0.0 | Server Components + Client Components |
| **Rendering** | React DOM | ^19.0.0 | Hydration & client-side rendering |

---

## Database & ORM

| Technology | Version | Notes |
|---|---|---|
| **Database** | PostgreSQL | (via `DATABASE_URL` env) |
| **ORM** | Prisma | 6.19.1 (client + CLI) |
| **Adapter** | `@prisma/client` | 6.19.1 |

---

## Authentication

| Technology | Version | Notes |
|---|---|---|
| **Auth Library** | better-auth | 1.2.5 | Email/password, session-based |
| **Password Hashing** | bcrypt | ^5.1.1 | Password encryption |
| **Email Transport** | nodemailer | ^6.10.0 | Password reset emails |

---

## UI Components & Styling

| Technology | Version | Notes |
|---|---|---|
| **CSS Framework** | Tailwind CSS | ^4.x | PostCSS plugin via `@tailwindcss/postcss` |
| **Animation** | tw-animate-css | ^1.2.5 | Tailwind animation utilities |
| **Component Library** | shadcn/ui | Latest | Radix Primitives + Tailwind |
| **Icons** | Lucide React | ^0.486.0 | SVG icon library |
| **Theming** | next-themes | ^0.4.6 | Dark/light mode |
| **CSS Utils** | clsx, tailwind-merge, class-variance-authority | Various | Class name composition |

### Radix UI Primitives

| Primitive | Version |
|---|---|
| `@radix-ui/react-alert-dialog` | ^1.1.14 |
| `@radix-ui/react-avatar` | ^1.1.3 |
| `@radix-ui/react-checkbox` | ^1.3.2 |
| `@radix-ui/react-collapsible` | ^1.1.3 |
| `@radix-ui/react-dialog` | ^1.1.7 |
| `@radix-ui/react-dropdown-menu` | ^2.1.6 |
| `@radix-ui/react-label` | ^2.1.2 |
| `@radix-ui/react-popover` | ^1.1.6 |
| `@radix-ui/react-scroll-area` | ^1.2.4 |
| `@radix-ui/react-select` | ^2.1.7 |
| `@radix-ui/react-separator` | ^1.1.2 |
| `@radix-ui/react-slot` | ^1.2.3 |
| `@radix-ui/react-switch` | ^1.2.5 |
| `@radix-ui/react-tooltip` | ^1.1.8 |

---

## Forms & Validation

| Technology | Version | Notes |
|---|---|---|
| **Form Library** | react-hook-form | ^7.55.0 | Performant form state management |
| **Schema Validation** | Zod | ^3.24.2 | Type-safe validation schemas |
| **RHF Resolver** | @hookform/resolvers | ^5.0.0 | Zod ↔ React Hook Form bridge |

---

## Date & Time

| Technology | Version | Notes |
|---|---|---|
| **Date Utils** | date-fns | ^3.6.0 | Immutable date manipulation |
| **Timezone** | date-fns-tz | ^3.2.0 | Timezone-aware operations |
| **DateTime** | Luxon | ^3.7.1 | Timezone conversion (Asia/Colombo) |
| **Date Picker** | react-day-picker | ^9.8.0 | Calendar date selection |
| **Air Datepicker** | air-datepicker | ^3.6.0 | Alternative date picker |
| **Time Picker** | react-time-picker | ^7.0.0 | Time selection component |
| **Calendar View** | @fullcalendar/react + @fullcalendar/daygrid | ^6.1.17 | Calendar grid display |

---

## Data Export & Reporting

| Technology | Version | Notes |
|---|---|---|
| **PDF Generation** | jsPDF | ^3.0.1 | Server-side PDF creation |
| **PDF Tables** | jspdf-autotable | ^5.0.2 | Auto-formatted tables in PDF |
| **Excel Export** | xlsx (SheetJS) | ^0.18.5 | .xlsx file generation |

---

## Utility Libraries

| Technology | Version | Notes |
|---|---|---|
| **Lodash** | ^4.17.21 | General-purpose utilities |
| **lodash.debounce** | ^4.0.8 | Debounce utility |
| **cmdk** | ^1.1.1 | Command palette (combobox) |
| **classnames** | ^2.5.1 | Conditional class names |
| **Sonner** | ^2.0.3 | Toast notifications |

---

## Development Tools

| Technology | Version | Notes |
|---|---|---|
| **Dev Server** | `next dev --turbopack` | Turbopack for fast HMR |
| **Linting** | ESLint | ^9.x | `eslint-config-next` |
| **Type Checking** | TypeScript | ^5.x | Strict compile-time checks |
| **PostCSS** | postcss | Via `postcss.config.mjs` | Tailwind integration |

---

## Build & Scripts

```json
{
  "dev": "next dev --turbopack",
  "build": "next build",
  "start": "next start",
  "lint": "next lint"
}
```
