<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Http\Requests\Biometric\StoreBiometricDeviceProfileRequest;
use App\Http\Requests\Biometric\TestBiometricParseRequest;
use App\Models\BiometricDeviceProfile;
use App\Models\RawBiometricPunch;
use App\Models\Tenant;
use App\Services\Biometric\ConfigurableTextAdapter;
use App\Services\Biometric\DatabaseStagingAdapter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response as InertiaResponse;

final class BiometricDeviceProfileController extends Controller
{
    public const STANDARD_ADAPTERS = [
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
    ];

    public function __construct(
        private readonly ConfigurableTextAdapter $adapter,
        private readonly DatabaseStagingAdapter $stagingAdapter
    ) {}

    /**
     * Display the dedicated Biometric Configuration page under Settings.
     */
    public function settingsPage(Request $request): InertiaResponse
    {
        $tenantId = session('tenant_id') ?? app()->make('current_tenant_id') ?? null;
        $tenant = app()->bound('current_tenant') ? app('current_tenant') : ($tenantId ? Tenant::find($tenantId) : null);

        $query = BiometricDeviceProfile::query()->with('createdBy:id,name,email');
        if ($tenantId !== null) {
            $query->where('tenant_id', $tenantId);
        }
        $profiles = $query->orderBy('name')->get();

        $activeAdapter = $tenant?->getSetting('active_biometric_adapter') ?? 'zkteco';
        $activeProfileId = $tenant?->getSetting('active_biometric_profile_id');

        if ($activeAdapter === 'configurable' && ! $activeProfileId) {
            $defaultProf = $profiles->firstWhere('is_default', true);
            $activeProfileId = $defaultProf?->id;
        }

        $activeConfig = [
            'adapter_type' => $activeAdapter,
            'profile_id' => $activeProfileId,
        ];

        $pendingStagingCount = RawBiometricPunch::pending()->count();

        return Inertia::render('Settings/Biometric', [
            'profiles' => $profiles,
            'adapters' => self::STANDARD_ADAPTERS,
            'activeConfig' => $activeConfig,
            'pendingStagingCount' => $pendingStagingCount,
            'canManage' => auth()->user()?->can('biometric-device.manage') ?? false,
        ]);
    }


    /**
     * Set the tenant default/active biometric configuration.
     */
    public function setDefault(Request $request): JsonResponse|RedirectResponse
    {
        if (! auth()->user()?->can('biometric-device.manage')) {
            abort(403, 'Unauthorized to configure default biometric device.');
        }

        $validated = $request->validate([
            'adapter_type' => ['required', 'string', 'in:configurable,zkteco,generic_csv,excel'],
            'profile_id' => ['nullable', 'string', 'exists:biometric_device_profiles,id'],
        ]);

        $tenantId = session('tenant_id') ?? app()->make('current_tenant_id') ?? null;
        $tenant = app()->bound('current_tenant') ? app('current_tenant') : ($tenantId ? Tenant::find($tenantId) : null);

        if (! $tenant) {
            if ($request->wantsJson()) {
                return response()->json(['success' => false, 'message' => 'Active tenant is required.'], 400);
            }

            return back()->withErrors(['error' => 'Active tenant is required.']);
        }

        $adapterType = $validated['adapter_type'];
        $profileId = $validated['profile_id'] ?? null;

        if ($adapterType === 'configurable' && empty($profileId)) {
            if ($request->wantsJson()) {
                return response()->json(['success' => false, 'message' => 'Please select a valid biometric device profile.'], 422);
            }

            return back()->withErrors(['profile_id' => 'Please select a valid biometric device profile.']);
        }

        // Reset existing default profile flags for this tenant
        BiometricDeviceProfile::where('tenant_id', $tenant->id)->update(['is_default' => false]);

        if ($adapterType === 'configurable' && $profileId) {
            $profile = BiometricDeviceProfile::where('tenant_id', $tenant->id)->findOrFail($profileId);
            $profile->update(['is_default' => true]);
            $tenant->setSetting('active_biometric_adapter', 'configurable');
            $tenant->setSetting('active_biometric_profile_id', $profile->id);
            $message = "Default biometric device set to '{$profile->name}'.";
        } else {
            $tenant->setSetting('active_biometric_adapter', $adapterType);
            $tenant->setSetting('active_biometric_profile_id', null);
            $label = match ($adapterType) {
                'zkteco' => 'ZKTeco Standard DAT',
                'generic_csv' => 'Generic CSV Log',
                'excel' => 'Excel Spreadsheet',
                default => strtoupper($adapterType),
            };
            $message = "Default biometric ingestion format set to '{$label}'.";
        }

        if ($request->wantsJson()) {
            return response()->json([
                'success' => true,
                'message' => $message,
                'data' => [
                    'adapter_type' => $adapterType,
                    'profile_id' => $profileId,
                ],
            ]);
        }

        return back()->with('success', $message);
    }

    /**
     * List all biometric device profiles for the current tenant.
     */
    public function index(Request $request): JsonResponse
    {
        $tenantId = session('tenant_id') ?? app()->make('current_tenant_id') ?? null;

        $query = BiometricDeviceProfile::query()->with('createdBy:id,name,email');
        if ($tenantId !== null) {
            $query->where('tenant_id', $tenantId);
        }

        $profiles = $query->orderBy('name')->get();

        return response()->json([
            'success' => true,
            'data' => $profiles,
        ]);
    }

    /**
     * Store a new biometric device configuration profile.
     */
    public function store(StoreBiometricDeviceProfileRequest $request): JsonResponse|RedirectResponse
    {
        $tenantId = session('tenant_id') ?? app()->make('current_tenant_id') ?? null;
        if (! $tenantId) {
            return response()->json(['success' => false, 'message' => 'Active tenant required.'], 400);
        }

        $validated = $request->validated();
        $validated['tenant_id'] = $tenantId;
        $validated['source_type'] = $validated['source_type'] ?? 'file';
        $validated['created_by'] = auth()->id();

        // If this is the very first profile for the tenant, make it default automatically
        $existingCount = BiometricDeviceProfile::where('tenant_id', $tenantId)->count();
        if ($existingCount === 0) {
            $validated['is_default'] = true;
        }

        $profile = BiometricDeviceProfile::create($validated);

        if ($validated['is_default'] ?? false) {
            $tenant = app()->bound('current_tenant') ? app('current_tenant') : Tenant::find($tenantId);
            $tenant?->setSetting('active_biometric_adapter', 'configurable');
            $tenant?->setSetting('active_biometric_profile_id', $profile->id);
        }

        if ($request->wantsJson()) {
            return response()->json([
                'success' => true,
                'message' => "Biometric profile '{$profile->name}' created successfully.",
                'data' => $profile,
            ], 201);
        }

        return back()->with('success', "Biometric profile '{$profile->name}' created successfully.");
    }

    /**
     * Update an existing biometric device profile.
     */
    public function update(StoreBiometricDeviceProfileRequest $request, BiometricDeviceProfile $profile): JsonResponse|RedirectResponse
    {
        $profile->update($request->validated());

        if ($request->wantsJson()) {
            return response()->json([
                'success' => true,
                'message' => "Biometric profile '{$profile->name}' updated successfully.",
                'data' => $profile,
            ]);
        }

        return back()->with('success', "Biometric profile '{$profile->name}' updated successfully.");
    }

    /**
     * Delete a biometric device profile.
     */
    public function destroy(BiometricDeviceProfile $profile, Request $request): JsonResponse|RedirectResponse
    {
        if (! auth()->user()?->can('biometric-device.manage')) {
            abort(403, 'Unauthorized to delete biometric device profiles.');
        }

        $tenantId = session('tenant_id') ?? app()->make('current_tenant_id') ?? null;
        $tenant = app()->bound('current_tenant') ? app('current_tenant') : ($tenantId ? Tenant::find($tenantId) : null);

        $name = $profile->name;
        $wasDefault = $profile->is_default || ($tenant?->getSetting('active_biometric_profile_id') === $profile->id);

        $profile->delete();

        if ($wasDefault && $tenant) {
            $nextProfile = BiometricDeviceProfile::where('tenant_id', $tenant->id)->active()->first();
            if ($nextProfile) {
                $nextProfile->update(['is_default' => true]);
                $tenant->setSetting('active_biometric_adapter', 'configurable');
                $tenant->setSetting('active_biometric_profile_id', $nextProfile->id);
            } else {
                $tenant->setSetting('active_biometric_adapter', 'zkteco');
                $tenant->setSetting('active_biometric_profile_id', null);
            }
        }

        if ($request->wantsJson()) {
            return response()->json([
                'success' => true,
                'message' => "Biometric profile '{$name}' deleted.",
            ]);
        }

        return back()->with('success', "Biometric profile '{$name}' deleted.");
    }

    /**
     * Test parse a sample snippet or file against a live configuration before saving.
     */
    public function testParse(TestBiometricParseRequest $request): JsonResponse
    {
        $rawContent = (string) $request->input('raw_content', '');
        $sampleFile = $request->file('sample_file');

        if ($sampleFile !== null) {
            $content = file_get_contents($sampleFile->getRealPath());
            $rawContent = $content !== false ? $content : '';
        }

        if (trim($rawContent) === '') {
            return response()->json([
                'success' => false,
                'message' => 'Please provide sample text or a sample file to test.',
            ], 422);
        }

        // Write sample to a temporary file
        $tempFile = tempnam(sys_get_temp_dir(), 'bio_test_');
        if ($tempFile === false) {
            return response()->json(['success' => false, 'message' => 'Unable to create temp file for testing.'], 500);
        }

        file_put_contents($tempFile, $rawContent);

        try {
            $config = $request->validated();
            $rawRecords = $this->adapter->parse($tempFile, $config);
            $validation = $this->adapter->validate($rawRecords, $config);

            // Also produce raw tokenized rows for column mapping visualization
            $lines = file($tempFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [];
            $skipHeaderLines = (int) ($config['skip_header_lines'] ?? 0);
            $tokenizedRows = [];

            foreach ($lines as $idx => $line) {
                $lineNum = $idx + 1;
                $tokens = $this->adapter->tokenizeLine(trim($line), $config['delimiter_type'], $config['custom_delimiter'] ?? '');
                $tokenizedRows[] = [
                    'line_number' => $lineNum,
                    'is_header' => $lineNum <= $skipHeaderLines,
                    'tokens' => $tokens,
                    'token_count' => count($tokens),
                ];

                if (count($tokenizedRows) >= 15) {
                    break;
                }
            }

            return response()->json([
                'success' => true,
                'data' => [
                    'tokenized_sample' => $tokenizedRows,
                    'total_parsed' => count($rawRecords),
                    'valid_count' => $validation['summary']['valid'],
                    'invalid_count' => $validation['summary']['invalid'],
                    'valid_samples' => array_slice($validation['valid_records'], 0, 10),
                    'invalid_samples' => array_slice($validation['invalid_records'], 0, 10),
                ],
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'success' => false,
                'message' => 'Parsing test failed: '.$e->getMessage(),
            ], 422);
        } finally {
            if (file_exists($tempFile)) {
                @unlink($tempFile);
            }
        }
    }

    /**
     * Test query biometric punches from database staging table with column mapping before saving profile.
     */
    public function testDbQuery(Request $request): JsonResponse
    {
        $tenantId = session('tenant_id') ?? app()->make('current_tenant_id') ?? null;

        $config = $request->all();
        if ($tenantId !== null) {
            $config['tenant_id'] = $tenantId;
        }

        try {
            $rawRecords = $this->stagingAdapter->parse('', $config);
            $validation = $this->stagingAdapter->validate($rawRecords, $config);

            $pendingQuery = RawBiometricPunch::query();
            if ($tenantId !== null) {
                $pendingQuery->where('tenant_id', $tenantId);
            }
            $totalPending = $pendingQuery->where('status', 'pending')->count();

            return response()->json([
                'success' => true,
                'data' => [
                    'total_pending' => $totalPending,
                    'total_parsed' => count($rawRecords),
                    'valid_count' => $validation['summary']['valid'],
                    'invalid_count' => $validation['summary']['invalid'],
                    'valid_samples' => array_slice($validation['valid_records'], 0, 10),
                    'invalid_samples' => array_slice($validation['invalid_records'], 0, 10),
                ],
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'success' => false,
                'message' => 'Staging DB query test failed: '.$e->getMessage(),
            ], 422);
        }
    }
}

