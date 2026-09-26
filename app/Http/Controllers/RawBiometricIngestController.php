<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\RawBiometricPunch;
use App\Models\Tenant;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class RawBiometricIngestController extends Controller
{
    /**
     * Handle incoming biometric punches from network daemons, hardware devices, or external sync services.
     */
    public function ingest(Request $request): JsonResponse
    {
        // 1. Resolve tenant
        $tenantId = $request->header('X-Tenant-ID')
            ?? $request->input('tenant_id')
            ?? session('tenant_id')
            ?? (app()->bound('current_tenant_id') ? app('current_tenant_id') : null);

        if (! $tenantId) {
            $tenant = Tenant::first();
            $tenantId = $tenant?->id;
        }

        if (! $tenantId) {
            return response()->json([
                'success' => false,
                'message' => 'Tenant identification required. Provide X-Tenant-ID header or tenant_id field.',
            ], 400);
        }

        // 2. Optional token authentication check if BIOMETRIC_API_SECRET is set or configured in tenant settings
        $expectedToken = config('services.biometric.api_key') ?? env('BIOMETRIC_API_KEY');
        if (! empty($expectedToken)) {
            $providedToken = $request->bearerToken() ?? $request->header('X-API-Key') ?? $request->input('api_key');
            if ($providedToken !== $expectedToken) {
                return response()->json([
                    'success' => false,
                    'message' => 'Unauthorized: Invalid biometric ingestion API key.',
                ], 401);
            }
        }

        // 3. Extract punches from payload
        $deviceSn = $request->input('device_sn') ?? $request->input('device_id') ?? $request->input('serial_number');

        $rawItems = [];
        if ($request->has('punches') && is_array($request->input('punches'))) {
            $rawItems = $request->input('punches');
        } elseif ($request->has('data') && is_array($request->input('data'))) {
            $rawItems = $request->input('data');
        } elseif ($request->has('user_id') || $request->has('raw_user_id') || $request->has('biometric_id')) {
            $rawItems = [$request->all()];
        }

        if (empty($rawItems)) {
            return response()->json([
                'success' => false,
                'message' => 'No valid punch records provided in request payload.',
            ], 422);
        }

        $now = Carbon::now();
        $punchesToInsert = [];
        $skippedCount = 0;
        $seenInPayload = [];

        foreach ($rawItems as $item) {
            if (! is_array($item)) {
                $skippedCount++;

                continue;
            }

            $userId = trim((string) ($item['user_id'] ?? $item['raw_user_id'] ?? $item['biometric_id'] ?? ''));
            $timestamp = trim((string) ($item['timestamp'] ?? $item['punch_time'] ?? $item['datetime'] ?? ''));
            $punchType = trim((string) ($item['punch_type'] ?? $item['type'] ?? $item['status'] ?? 'auto'));
            $itemDeviceSn = $item['device_sn'] ?? $item['device_id'] ?? $deviceSn;
            $formattedDeviceSn = ! empty($itemDeviceSn) ? substr(trim((string) $itemDeviceSn), 0, 50) : null;

            if ($userId === '' || $timestamp === '') {
                $skippedCount++;

                continue;
            }

            try {
                $parsedTime = Carbon::parse($timestamp)->format('Y-m-d H:i:s');
            } catch (\Throwable) {
                $skippedCount++;

                continue;
            }

            $trimmedUserId = substr($userId, 0, 100);
            $dedupKey = ($formattedDeviceSn ?? '').'_'.$trimmedUserId.'_'.$parsedTime;

            if (isset($seenInPayload[$dedupKey])) {
                $skippedCount++;

                continue;
            }
            $seenInPayload[$dedupKey] = true;

            $existing = DB::table('raw_biometric_punches')
                ->where('tenant_id', $tenantId)
                ->where('raw_user_id', $trimmedUserId)
                ->where('punch_time', $parsedTime)
                ->when($formattedDeviceSn !== null, fn ($q) => $q->where('device_sn', $formattedDeviceSn))
                ->exists();

            if ($existing) {
                $skippedCount++;

                continue;
            }

            $punchesToInsert[] = [
                'id' => (string) Str::ulid(),
                'tenant_id' => $tenantId,
                'device_sn' => $formattedDeviceSn,
                'raw_user_id' => $trimmedUserId,
                'punch_time' => $parsedTime,
                'punch_type' => substr($punchType, 0, 20),
                'status' => 'pending',
                'imported_at' => null,
                'attendance_log_id' => null,
                'error_message' => null,
                'raw_payload' => json_encode($item),
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }

        $insertedCount = 0;
        if (! empty($punchesToInsert)) {
            foreach (array_chunk($punchesToInsert, 500) as $chunk) {
                DB::table('raw_biometric_punches')->insert($chunk);
                $insertedCount += count($chunk);
            }
        }

        return response()->json([
            'success' => true,
            'message' => "Successfully staged {$insertedCount} raw biometric punch(es).",
            'staged_count' => $insertedCount,
            'skipped_count' => $skippedCount,
        ], 201);
    }

    /**
     * Health check / ping endpoint for remote biometric ingestion agents.
     */
    public function ping(): JsonResponse
    {
        return response()->json([
            'success' => true,
            'status' => 'online',
            'server_time' => Carbon::now()->toIso8601String(),
        ]);
    }
}
