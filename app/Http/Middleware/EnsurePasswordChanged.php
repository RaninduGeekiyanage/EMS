<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

final class EnsurePasswordChanged
{
    /**
     * Handle an incoming request.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user !== null && (bool) $user->must_change_password) {
            if (! $request->routeIs('password.force-change', 'password.force-change.update', 'logout')) {
                return redirect()->route('password.force-change');
            }
        }

        return $next($request);
    }
}
