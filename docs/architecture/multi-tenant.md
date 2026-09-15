# Multi-Tenancy Design

## 1. Strategy
Single database where every tenant-owned table contains `tenant_id` (char 26 ULID).

## 2. Global Scope Enforcement
```php
class TenantScope implements Scope {
    public function apply(Builder $builder, Model $model): void {
        if (session()->has('tenant_id')) {
            $builder->where($model->getTable() . '.tenant_id', session('tenant_id'));
        }
    }
}
```

## 3. Super Admin Bypass
Super Admin queries explicitly use `withoutGlobalScope(TenantScope::class)` for administrative functions.
