# Coding Standards — PHP / Laravel

> Read this file before writing any PHP class.

## 1. Strict Types (Mandatory)

Every PHP file must start with:
```php
<?php

declare(strict_types=1);
```
No exceptions. Laravel Pint enforces this automatically.

## 2. Repository Pattern

All database queries go through a Repository. Never query Eloquent directly from a Controller or Service.

### Interface (app/Repositories/Contracts/)
```php
<?php

declare(strict_types=1);

namespace App\Repositories\Contracts;

use App\Models\Employee;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Collection;

interface EmployeeRepositoryInterface
{
    public function findById(string $id): ?Employee;
    public function findByTenant(string $tenantId): Collection;
    public function paginate(int $perPage = 20): LengthAwarePaginator;
    public function create(array $data): Employee;
    public function update(string $id, array $data): Employee;
    public function delete(string $id): bool;
}
```

### Implementation (app/Repositories/Eloquent/)
```php
<?php

declare(strict_types=1);

namespace App\Repositories\Eloquent;

use App\Models\Employee;
use App\Repositories\Contracts\EmployeeRepositoryInterface;

final class EmployeeRepository implements EmployeeRepositoryInterface
{
    public function findById(string $id): ?Employee
    {
        return Employee::find($id);
    }
    // ...
}
```

### Binding (AppServiceProvider)
```php
$this->app->bind(EmployeeRepositoryInterface::class, EmployeeRepository::class);
```

## 3. Service Layer Pattern

All business logic lives in Services. Services use Repositories, never Models directly.

```php
<?php

declare(strict_types=1);

namespace App\Services;

use App\Repositories\Contracts\EmployeeRepositoryInterface;
use App\DTOs\Employee\CreateEmployeeDTO;

final class EmployeeService
{
    public function __construct(
        private readonly EmployeeRepositoryInterface $employeeRepository,
    ) {}

    public function create(CreateEmployeeDTO $dto): Employee
    {
        // Business logic here
        return $this->employeeRepository->create($dto->toArray());
    }
}
```

## 4. Controllers — Thin Only

```php
<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Services\EmployeeService;
use App\Http\Requests\Employee\StoreEmployeeRequest;
use Inertia\Inertia;
use Inertia\Response;

final class EmployeeController extends Controller
{
    public function __construct(
        private readonly EmployeeService $employeeService,
    ) {}

    public function index(): Response
    {
        $this->authorize('view.employees');
        $employees = $this->employeeService->paginate();
        return Inertia::render('Employees/Index', compact('employees'));
    }

    public function store(StoreEmployeeRequest $request): RedirectResponse
    {
        $this->authorize('create.employee');
        $this->employeeService->create(CreateEmployeeDTO::fromRequest($request));
        return redirect()->route('employees.index')->with('success', 'Employee created.');
    }
}
```

**Controllers MUST NOT:**
- Contain if/else business logic
- Query the database directly
- Perform calculations
- Have more than ~30 lines per method

## 5. Models

```php
<?php

declare(strict_types=1);

namespace App\Models;

use App\Enums\EmploymentType;
use App\Enums\EmploymentStatus;
use App\Scopes\TenantScope;
use App\Traits\BelongsToTenant;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

final class Employee extends Model
{
    use HasUlids, SoftDeletes, BelongsToTenant;

    protected $fillable = [
        'tenant_id', 'emp_no', 'nic', 'full_name',
        'employment_type', 'employment_status',
        // ...
    ];

    protected $casts = [
        'employment_type'   => EmploymentType::class,
        'employment_status' => EmploymentStatus::class,
        'date_joining'      => 'date',
        'permanent_address' => 'array',
    ];

    // Relationships only — no business logic
    public function department(): BelongsTo { ... }
    public function paymentInfo(): HasOne { ... }
}
```

## 6. PHP Enums

```php
<?php

declare(strict_types=1);

namespace App\Enums;

enum PaymentMode: string
{
    case Monthly = 'monthly';
    case Daily   = 'daily';
    case Hourly  = 'hourly';

    public function label(): string
    {
        return match($this) {
            self::Monthly => 'Monthly Salaried',
            self::Daily   => 'Daily Rate',
            self::Hourly  => 'Hourly Rate',
        };
    }
}
```

## 7. DTOs (Data Transfer Objects)

```php
<?php

declare(strict_types=1);

namespace App\DTOs\Employee;

use App\Enums\PaymentMode;
use App\Http\Requests\Employee\StoreEmployeeRequest;

final readonly class CreateEmployeeDTO
{
    public function __construct(
        public string      $fullName,
        public string      $nic,
        public PaymentMode $paymentMode,
        public ?float      $basicSalary,
        public ?float      $dailyRate,
        public ?float      $hourlyRate,
    ) {}

    public static function fromRequest(StoreEmployeeRequest $request): self
    {
        return new self(
            fullName:    $request->validated('full_name'),
            nic:         $request->validated('nic'),
            paymentMode: PaymentMode::from($request->validated('payment_mode')),
            basicSalary: $request->validated('basic_salary'),
            dailyRate:   $request->validated('daily_rate'),
            hourlyRate:  $request->validated('hourly_rate'),
        );
    }
}
```

## 8. Exception Handling

Custom exceptions in `app/Exceptions/`:
```php
final class TenantIsolationException extends RuntimeException {}
final class PayrollPeriodLockedException extends RuntimeException {}
final class InsufficientLeaveBalanceException extends RuntimeException {}
```

Handle in `bootstrap/app.php` using `withExceptions()`.

## 9. Inertia Response Standards

```php
// Return page with props
return Inertia::render('Employees/Index', [
    'employees'   => EmployeeResource::collection($employees),
    'departments' => DepartmentResource::collection($departments),
    'filters'     => $request->only(['search', 'department', 'status']),
]);

// Redirect with flash
return redirect()->route('employees.index')
    ->with('success', 'Employee created successfully.');
```

## 10. Method Naming

| Type | Convention | Example |
|------|-----------|---------|
| CRUD | `index, show, create, store, edit, update, destroy` | Controller actions |
| Service | verb + noun | `calculatePayroll()`, `generatePayslip()` |
| Repository | `findById`, `findByTenant`, `paginate`, `create`, `update`, `delete` | — |
| Boolean | `is` or `has` prefix | `isEpfMember()`, `hasOvertimeHours()` |
| Events | past tense | `PayrollRunCompleted`, `AttendanceImported` |
