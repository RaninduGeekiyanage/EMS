# Tech Stack — Frontend Specification

## 1. Core Libraries
- **React**: 18.x with TypeScript.
- **Inertia.js**: `@inertiajs/react` 1.x.
- **Styling**: Tailwind CSS v3.4+, PostCSS, Autoprefixer.
- **UI Components**: ShadCN UI (Radix UI primitives).
- **Icons**: Lucide React (`lucide-react`).

## 2. Resources Directory Structure
```
resources/js/
├── Components/    # Reusable UI widgets and ShadCN controls
├── Layouts/       # Authenticated and Guest shell layouts
├── Pages/         # Inertia view controllers (routed from Laravel)
├── Types/         # TypeScript interface declarations
├── Hooks/         # Custom React hooks (permissions, formatting)
└── utils/         # Helper functions (currency LKR formatting, date utils)
```
