<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Http\Requests\Attendance\AttendanceImportRequest;
use App\Models\AttendanceImport;
use App\Models\Employee;
use App\Services\AttendanceImportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Inertia\Inertia;
use Inertia\Response as InertiaResponse;
use Symfony\Component\HttpFoundation\StreamedResponse;

final class AttendanceImportController extends Controller
{
    public function __construct(
        private readonly AttendanceImportService $importService
    ) {}

    /**
     * Display the Biometric Ingestion & Attendance Import portal.
     */
    public function index(Request $request): InertiaResponse
    {
        $tenantId = session('tenant_id') ?? app()->make('current_tenant_id') ?? null;

        $imports = $this->importService->listImports(10);
        $stats = $this->importService->getDashboardStats();

        // Get employees list for mapping assistance
        $employeesQuery = Employee::query()
            ->with('department:id,name')
            ->select(['id', 'tenant_id', 'emp_no', 'full_name', 'department_id', 'biometric_device_id'])
            ->orderBy('full_name');

        if ($tenantId !== null) {
            $employeesQuery->where('tenant_id', $tenantId);
        }

        $employees = $employeesQuery->get();

        $profilesQuery = \App\Models\BiometricDeviceProfile::query()->active()->orderBy('name');
        if ($tenantId !== null) {
            $profilesQuery->where('tenant_id', $tenantId);
        }
        $profiles = $profilesQuery->get();

        $tenant = app()->bound('current_tenant') ? app('current_tenant') : ($tenantId ? \App\Models\Tenant::find($tenantId) : null);
        $activeAdapter = $tenant?->getSetting('active_biometric_adapter') ?? 'zkteco';
        $activeProfileId = $tenant?->getSetting('active_biometric_profile_id');

        if ($activeAdapter === 'configurable' && ! $activeProfileId) {
            $activeProfileId = $profiles->firstWhere('is_default', true)?->id;
        }

        $activeProfile = $activeProfileId ? $profiles->firstWhere('id', $activeProfileId) : null;

        $activeConfig = [
            'adapter_type' => $activeAdapter,
            'profile_id' => $activeProfileId,
            'profile' => $activeProfile,
        ];

        return Inertia::render('Attendance/Import', [
            'imports' => $imports,
            'stats' => $stats,
            'employees' => $employees,
            'profiles' => $profiles,
            'activeConfig' => $activeConfig,
            'canManageProfiles' => auth()->user()?->can('biometric-device.manage') ?? false,
            'adapters' => [
                [
                    'key' => 'zkteco',
                    'name' => 'ZKTeco Standard DAT',
                    'description' => 'Space/tab delimited raw terminal punch logs (.dat, .txt)',
                    'extension' => '.dat, .txt',
                    'badge' => 'Biometric Device',
                ],
                [
                    'key' => 'generic_csv',
                    'name' => 'Generic CSV Log',
                    'description' => 'Comma/semicolon delimited punch log with column detection (.csv)',
                    'extension' => '.csv',
                    'badge' => 'Standard Format',
                ],
                [
                    'key' => 'excel',
                    'name' => 'Excel Spreadsheet',
                    'description' => 'OpenXML workbook sheet with automated date parsing (.xlsx, .xls)',
                    'extension' => '.xlsx, .xls',
                    'badge' => 'Spreadsheet',
                ],
            ],
        ]);
    }

    /**
     * Preview an uploaded attendance file before saving.
     */
    public function preview(AttendanceImportRequest $request): JsonResponse
    {
        $file = $request->file('file');
        $adapterType = (string) $request->input('adapter_type');
        $config = $request->input('config', []);
        if ($request->filled('profile_id')) {
            $config['profile_id'] = $request->input('profile_id');
        }
        if ($request->filled('device_id')) {
            $config['device_id'] = $request->input('device_id');
        }

        try {
            $preview = $this->importService->previewImport($file, $adapterType, $config);

            return response()->json([
                'success' => true,
                'data' => $preview,
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 422);
        }
    }

    /**
     * Commit and persist the attendance file import.
     */
    public function store(AttendanceImportRequest $request): RedirectResponse
    {
        $file = $request->file('file');
        $adapterType = (string) $request->input('adapter_type');
        $config = $request->input('config', []);
        if ($request->filled('profile_id')) {
            $config['profile_id'] = $request->input('profile_id');
        }
        if ($request->filled('device_id')) {
            $config['device_id'] = $request->input('device_id');
        }

        $userId = auth()->check() ? (int) auth()->id() : null;

        try {
            $import = $this->importService->commitImport($file, $adapterType, $userId, $config);

            $message = "Attendance file '{$import->filename}' imported successfully! Processed {$import->processed_rows} punches.";
            if ($import->failed_rows > 0) {
                $message .= " ({$import->failed_rows} punches skipped or unmapped).";
            }

            return back()->with('success', $message);
        } catch (\Throwable $e) {
            return back()->withErrors(['error' => 'Import failed: '.$e->getMessage()]);
        }
    }

    /**
     * Preview biometric punches from the direct database staging table.
     */
    public function previewStaging(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'profile_id' => ['nullable', 'string', 'exists:biometric_device_profiles,id'],
            'start_date' => ['nullable', 'date'],
            'end_date' => ['nullable', 'date'],
            'device_sn' => ['nullable', 'string', 'max:50'],
            'status' => ['nullable', 'string', 'in:pending,all,failed,imported'],
        ]);

        try {
            $preview = $this->importService->previewStaging($validated);

            return response()->json([
                'success' => true,
                'data' => $preview,
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'success' => false,
                'message' => 'Staging preview failed: '.$e->getMessage(),
            ], 422);
        }
    }

    /**
     * Commit and persist biometric punches from the staging table into attendance_logs.
     */
    public function commitStaging(Request $request): JsonResponse|RedirectResponse
    {
        $validated = $request->validate([
            'profile_id' => ['nullable', 'string', 'exists:biometric_device_profiles,id'],
            'start_date' => ['nullable', 'date'],
            'end_date' => ['nullable', 'date'],
            'device_sn' => ['nullable', 'string', 'max:50'],
            'status' => ['nullable', 'string', 'in:pending,all,failed,imported'],
        ]);

        $userId = auth()->check() ? (int) auth()->id() : null;

        try {
            $import = $this->importService->commitStaging($validated, $userId);

            $duplicateCount = (int) ($import->errors['duplicate_skipped_count'] ?? 0);
            if ($import->processed_rows > 0) {
                $message = "Staging punches synchronized successfully! Ingested {$import->processed_rows} new logs.";
                if ($duplicateCount > 0) {
                    $message .= " ({$duplicateCount} existing logs linked).";
                }
            } elseif ($duplicateCount > 0) {
                $message = "All {$duplicateCount} mapped punches already exist in attendance logs. Staging buffer updated.";
            } else {
                $message = "Staging synchronization completed (0 logs inserted).";
            }

            if ($import->failed_rows > 0) {
                $message .= " ({$import->failed_rows} unmapped or skipped punches).";
            }

            if ($request->wantsJson()) {
                return response()->json([
                    'success' => true,
                    'message' => $message,
                    'data' => $import,
                ]);
            }

            return back()->with('success', $message);
        } catch (\Throwable $e) {
            if ($request->wantsJson()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Staging sync failed: '.$e->getMessage(),
                ], 422);
            }

            return back()->withErrors(['error' => 'Staging sync failed: '.$e->getMessage()]);
        }
    }

    /**
     * Roll back and delete an attendance import batch and its logs.
     */
    public function destroy(AttendanceImport $import): RedirectResponse
    {
        try {
            $filename = $import->filename;
            $this->importService->deleteImport($import);

            return back()->with('success', "Import batch '{$filename}' and its associated attendance logs have been removed.");
        } catch (\Throwable $e) {
            return back()->withErrors(['error' => 'Failed to delete import: '.$e->getMessage()]);
        }
    }

    /**
     * Download a sample attendance template file.
     */
    public function downloadTemplate(string $type): StreamedResponse|Response
    {
        $template = $this->importService->getSampleTemplate($type);

        return response()->streamDownload(
            static function () use ($template): void {
                echo $template['content'];
            },
            $template['filename'],
            ['Content-Type' => $template['mime']]
        );
    }

    /**
     * Quickly map a biometric device ID to an employee profile.
     */
    public function mapEmployee(Request $request): JsonResponse|RedirectResponse
    {
        $validated = $request->validate([
            'employee_id' => ['required', 'string', 'exists:employees,id'],
            'biometric_id' => ['required', 'string', 'max:50'],
        ]);

        $employee = $this->importService->mapBiometricIdToEmployee(
            $validated['employee_id'],
            $validated['biometric_id']
        );

        if ($request->wantsJson()) {
            return response()->json([
                'success' => true,
                'message' => "Biometric ID '{$validated['biometric_id']}' assigned to {$employee->full_name}.",
                'employee' => $employee,
            ]);
        }

        return back()->with('success', "Biometric ID '{$validated['biometric_id']}' mapped to {$employee->full_name}.");
    }
}
