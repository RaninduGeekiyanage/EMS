# Infrastructure & Deployment

## 1. Production Requirements
- **Server**: Linux (Ubuntu 22.04 / 24.04 LTS), min 2 vCPU, 4GB RAM.
- **Database**: MySQL 8.0+ running on InnoDB engine.
- **In-Memory Store**: Redis 7.x (for cache, session, and queues).

## 2. Process Management
- **Supervisor**: Manages `php artisan horizon` and queue workers.
- **Cron**: Single entry triggering `php artisan schedule:run` every minute.
