# Testing Workflow

- **Unit Tests**: Test calculation services, tax formulas, and overtime rates in isolation.
- **Feature Tests**: Test HTTP endpoints with simulated sessions and CSRF tokens.
- **Multi-Tenancy Tests**: Assert tenant A cannot retrieve tenant B records.
- Command: `php artisan test` or `vendor/bin/pest`.
