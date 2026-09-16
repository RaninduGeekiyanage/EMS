<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\Tenant;
use App\Services\DashboardService;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

final class DashboardController extends Controller
{
    /**
     * Display the Central Executive Tenant Dashboard.
     */
    public function index(Request $request, DashboardService $dashboardService): Response
    {
        /** @var Tenant|null $tenant */
        $tenant = app()->bound('current_tenant') ? app('current_tenant') : null;

        $dashboardData = $dashboardService->getTenantDashboardData($tenant);

        return Inertia::render('Dashboard/Index', [
            'metrics' => $dashboardData,
        ]);
    }
}
