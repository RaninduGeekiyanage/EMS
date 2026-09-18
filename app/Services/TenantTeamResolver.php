<?php

declare(strict_types=1);

namespace App\Services;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Auth;
use Spatie\Permission\Contracts\PermissionsTeamResolver;

final class TenantTeamResolver implements PermissionsTeamResolver
{
    protected int|string|null $teamId = null;

    /**
     * Set the active team ID for permission/role queries.
     *
     * @param int|string|Model|null $id
     */
    public function setPermissionsTeamId($id): void
    {
        if ($id instanceof Model) {
            $id = $id->getKey();
        }

        $this->teamId = $id;
    }

    /**
     * Resolve the active team ID dynamically.
     * If an explicit team ID was set, return it.
     * Otherwise, safely fall back to bound tenant instance, active session, or authenticated user's tenant.
     */
    public function getPermissionsTeamId(): int|string|null
    {
        if ($this->teamId !== null) {
            return $this->teamId;
        }

        // 1. Check bound current_tenant_id or current_tenant instance in container
        if (app()->bound('current_tenant_id')) {
            $boundId = app('current_tenant_id');
            if (! empty($boundId)) {
                return (string) $boundId;
            }
        }

        if (app()->bound('current_tenant')) {
            $boundTenant = app('current_tenant');
            if ($boundTenant !== null && ! empty($boundTenant->id)) {
                return (string) $boundTenant->id;
            }
        }

        // 2. Check active session context (if available)
        if (function_exists('session') && session()->isStarted()) {
            if (session()->has('impersonated_tenant_id')) {
                $impersonatedId = session('impersonated_tenant_id');
                if (! empty($impersonatedId)) {
                    return (string) $impersonatedId;
                }
            }

            if (session()->has('tenant_id')) {
                $sessionTenantId = session('tenant_id');
                if (! empty($sessionTenantId)) {
                    return (string) $sessionTenantId;
                }
            }
        }

        // 3. Fall back to authenticated user's bound tenant
        $currentUser = Auth::user();
        if ($currentUser !== null && ! empty($currentUser->tenant_id)) {
            return (string) $currentUser->tenant_id;
        }

        return null;
    }
}
