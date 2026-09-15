# Architecture Tech Stack

- **Backend**: Laravel 11.x, PHP 8.3+, strict types enabled.
- **Frontend**: React 18+, Inertia.js, TypeScript, Tailwind CSS, ShadCN UI.
- **Database**: MySQL 8.0+ with InnoDB and strict foreign keys.
- **Access Control**: Spatie Laravel-Permission with Teams mode (`team_id = tenant_id`).
- **Queues & Caching**: Redis with Laravel Horizon.
- **Document & Media Processing**: DomPDF (`barryvdh/laravel-dompdf`), Intervention Image 3.x.
