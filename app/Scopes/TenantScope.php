<?php

declare(strict_types=1);

namespace App\Scopes;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Scope;

final class TenantScope implements Scope
{
    /**
     * Apply the scope to a given Eloquent query builder.
     */
    public function apply(Builder $builder, Model $model): void
    {
        $tenantId = null;

        if (session()->has('tenant_id')) {
            $tenantId = session('tenant_id');
        } elseif (app()->has('current_tenant_id')) {
            $tenantId = app('current_tenant_id');
        }

        if ($tenantId !== null) {
            $builder->where($model->getTable().'.tenant_id', '=', $tenantId);
        }
    }
}
