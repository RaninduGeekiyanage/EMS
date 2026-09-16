<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Models\Tenant;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

final class ResolveTenant
{
    /**
     * Handle an incoming request and resolve the active tenant.
     *
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next, ?string $mode = null): Response
    {
        $tenant = $this->resolveTenant($request);

        if ($tenant !== null) {
            if (! $tenant->is_active) {
                abort(403, 'Tenant account is inactive.');
            }

            session(['tenant_id' => $tenant->id, 'tenant_slug' => $tenant->slug]);
            app()->instance('current_tenant', $tenant);
            app()->instance('current_tenant_id', $tenant->id);
        } elseif ($mode !== 'optional') {
            abort(404, 'Tenant could not be resolved.');
        }

        return $next($request);
    }

    /**
     * Attempt to resolve tenant from headers, session, or host.
     */
    private function resolveTenant(Request $request): ?Tenant
    {
        // 1. Check custom headers or query param
        $tenantQuery = $request->query('tenant') ?? $request->query('tenant_id');
        if (! empty($tenantQuery)) {
            $tenant = Tenant::where('slug', $tenantQuery)->orWhere('id', $tenantQuery)->first();
            if ($tenant !== null) {
                return $tenant;
            }
        }

        $tenantHeaderId = $request->header('X-Tenant-ID');
        if (! empty($tenantHeaderId)) {
            return Tenant::find($tenantHeaderId);
        }

        $tenantHeaderSlug = $request->header('X-Tenant-Slug') ?? $request->header('X-Tenant');
        if (! empty($tenantHeaderSlug)) {
            return Tenant::where('slug', $tenantHeaderSlug)->first();
        }

        // 2. Check session
        if ($request->hasSession()) {
            $sessionTenantId = session('tenant_id');
            if (! empty($sessionTenantId)) {
                $tenant = Tenant::find($sessionTenantId);
                if ($tenant !== null) {
                    return $tenant;
                }
            }

            $sessionTenantSlug = session('tenant_slug');
            if (! empty($sessionTenantSlug)) {
                $tenant = Tenant::where('slug', $sessionTenantSlug)->first();
                if ($tenant !== null) {
                    return $tenant;
                }
            }
        }

        // 3. Check subdomain from host
        $host = $request->getHost();
        $parts = explode('.', $host);

        // e.g. "tenant-slug.example.com" or "tenant-slug.localhost"
        if (count($parts) >= 2) {
            $subdomain = strtolower($parts[0]);
            if (! in_array($subdomain, ['www', 'admin', 'api', 'localhost', '127'], true)) {
                $tenant = Tenant::where('slug', $subdomain)->first();
                if ($tenant !== null) {
                    return $tenant;
                }
            }
        }

        return null;
    }
}
