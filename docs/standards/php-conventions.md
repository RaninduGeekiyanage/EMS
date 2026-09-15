# PHP Conventions & Guidelines

## 1. Strict Typing
All PHP files must include `declare(strict_types=1);` immediately after opening tags.

## 2. Layered Pattern
- **Repositories**: Encapsulate Eloquent queries. Always inject via interfaces.
- **Services**: Pure business logic, calculation engines, and third-party interactions.
- **Controllers**: Thin controllers, accepting FormRequests, dispatching to services, and returning Inertia responses.
