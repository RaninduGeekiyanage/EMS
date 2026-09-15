# Tech Stack — Backend Specification

## 1. Core Framework & Environment
- **PHP**: 8.3+ with strict typing enabled (`declare(strict_types=1);`).
- **Laravel**: 11.x.
- **Web Server**: Nginx / Caddy with PHP-FPM.

## 2. Key Laravel Dependencies
- `spatie/laravel-permission`: Role-based access control with Teams scoping.
- `barryvdh/laravel-dompdf`: PDF payslip and report compilation.
- `intervention/image-laravel`: Employee photo and document thumbnail processing.
- `laravel/horizon`: Monitoring Redis job queues for bulk attendance imports and payroll calculation.
- `laravel/sanctum`: Session and API token authentication.

## 3. Directory Layout Standard
- `app/Contracts/`: Abstract interfaces (Repositories, Adapters).
- `app/Repositories/`: Eloquent data persistence layer.
- `app/Services/`: Domain logic and calculations.
- `app/DTOs/`: Readonly typed data transfer objects.
- `app/Enums/`: Backed enums for statuses and modes.
