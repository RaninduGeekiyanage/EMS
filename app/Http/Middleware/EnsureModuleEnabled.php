<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Models\Tenant;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

final class EnsureModuleEnabled
{
    /**
     * Handle an incoming request.
     *
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next, string $module): Response
    {
        /** @var Tenant|null $tenant */
        $tenant = app()->bound('current_tenant') ? app('current_tenant') : null;

        if ($tenant === null && session()->has('tenant_id')) {
            $tenant = Tenant::find(session('tenant_id'));
        }

        if ($tenant !== null) {
            if ($module === 'ams' && ! $tenant->is_ams_enabled) {
                if ($request->wantsJson()) {
                    return response()->json([
                        'message' => 'Attendance Management System (AMS) is disabled for your company.',
                    ], 403);
                }

                abort(403, 'Attendance Management System (AMS) is not enabled for your company.');
            }

            if ($module === 'payroll' && ! $tenant->is_payroll_enabled) {
                if ($request->wantsJson()) {
                    return response()->json([
                        'message' => 'Payroll & Compliance module is disabled for your company.',
                    ], 403);
                }

                abort(403, 'Payroll & Compliance module is not enabled for your company.');
            }
        }

        return $next($request);
    }
}
