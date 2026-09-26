<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Http\Requests\Attendance\UpdateAttendanceSettingsRequest;
use App\Models\Tenant;
use App\Services\AttendanceProcessingService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response as InertiaResponse;

final class AttendanceSettingsController extends Controller
{
    public function __construct(
        private readonly AttendanceProcessingService $attendanceProcessingService
    ) {}

    /**
     * Display the dedicated Attendance Policy & Calculation Settings page.
     */
    public function index(Request $request): InertiaResponse
    {
        $tenantId = session('tenant_id') ?? (app()->bound('current_tenant_id') ? app('current_tenant_id') : null);
        if (! $tenantId && app()->bound('current_tenant')) {
            $tenantId = app('current_tenant')?->id;
        }

        $user = auth()->user();
        $isPrivileged = $user?->is_super_admin
            || $user?->hasRole('Company Owner')
            || $user?->hasRole('Company Admin');

        $canManage = $isPrivileged || ($user?->can('attendance.settings.manage') ?? false);

        $settings = $tenantId
            ? $this->attendanceProcessingService->getTenantAttendanceSettings((string) $tenantId)
            : AttendanceProcessingService::DEFAULT_SETTINGS;

        return Inertia::render('Settings/Attendance', [
            'settings' => $settings,
            'canManage' => $canManage,
        ]);
    }

    /**
     * Update tenant attendance calculation settings.
     */
    public function update(UpdateAttendanceSettingsRequest $request): RedirectResponse
    {
        $tenantId = session('tenant_id') ?? (app()->bound('current_tenant_id') ? app('current_tenant_id') : null);
        if (! $tenantId && app()->bound('current_tenant')) {
            $tenantId = app('current_tenant')?->id;
        }

        if (! $tenantId) {
            return redirect()->back()->with('error', 'Active tenant context required.');
        }

        $this->attendanceProcessingService->saveTenantAttendanceSettings((string) $tenantId, $request->validated());

        return redirect()->back()->with('success', 'Attendance calculation settings updated successfully.');
    }
}
