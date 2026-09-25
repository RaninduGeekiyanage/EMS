<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Http\Requests\Biometric\StoreBiometricDeviceProfileRequest;
use App\Http\Requests\Biometric\TestBiometricParseRequest;
use App\Models\BiometricDeviceProfile;
use App\Services\Biometric\ConfigurableTextAdapter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

final class BiometricDeviceProfileController extends Controller
{
    public function __construct(
        private readonly ConfigurableTextAdapter $adapter
    ) {}

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
        $validated['created_by'] = auth()->id();

        $profile = BiometricDeviceProfile::create($validated);

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

        $name = $profile->name;
        $profile->delete();

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
}
