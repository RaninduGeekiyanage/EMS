# Architecture Tech Stack

- **Backend**: Laravel 11.x, PHP 8.4+ (8.4.24+), strict types enabled.
- **Frontend**: React 18+, Inertia.js, TypeScript, Tailwind CSS, ShadCN UI.
- **Database**: MariaDB 10.11+ LTS (`10.11.19-MariaDB-cll-lve` or later) & MySQL 8.0+ with InnoDB and strict foreign keys.
- **Access Control**: Spatie Laravel-Permission with Teams mode (`team_id = tenant_id`).
- **Queues & Caching**: Redis with Laravel Horizon.
- **Document & Media Processing**: DomPDF (`barryvdh/laravel-dompdf`), Intervention Image 3.x.
