<?php

declare(strict_types=1);

namespace App\Services\Biometric;

use App\Contracts\BiometricImportAdapterInterface;
use App\Models\BiometricDeviceProfile;
use App\Models\RawBiometricPunch;
use Carbon\Carbon;
use Exception;
use Illuminate\Database\Eloquent\Collection;

final class DatabaseStagingAdapter implements BiometricImportAdapterInterface
{
    /**
     * Parse raw attendance punch records from staging table or memory into standardized punch records.
     *
     * @param  string  $filePath  Optional identifier or empty string for database queries
     * @param  array<string, mixed>  $config
     * @return array<int, array{
     *     staging_id: ?string,
     *     biometric_id: string,
     *     punch_datetime: string,
     *     punch_type: string,
     *     device_id: ?string,
     *     line_number: int,
     *     raw: string
     * }>
     */
    public function parse(string $filePath = '', array $config = []): array
    {
        $profile = $config['profile'] ?? null;
        if ($profile instanceof BiometricDeviceProfile) {
            $config = array_merge($profile->toArray(), $config);
        }

        $statusCodeMapping = (array) ($config['status_code_mapping'] ?? []);
        $columnsConfig = (array) ($config['columns_config'] ?? []);
        $defaultDeviceId = $config['device_id'] ?? $config['default_device_id'] ?? null;

        $rawUserIdCol = (string) ($columnsConfig['raw_user_id_col'] ?? 'raw_user_id');
        $punchTimeCol = (string) ($columnsConfig['punch_time_col'] ?? 'punch_time');
        $punchTypeCol = (string) ($columnsConfig['punch_type_col'] ?? 'punch_type');
        $deviceSnCol = (string) ($columnsConfig['device_sn_col'] ?? 'device_sn');

        // 1. Check if records were explicitly passed in config
        /** @var iterable<mixed> $punches */
        if (isset($config['rows']) && is_iterable($config['rows'])) {
            $punches = $config['rows'];
        } elseif (isset($config['records']) && is_iterable($config['records'])) {
            $punches = $config['records'];
        } else {
            // 2. Query from database staging table
            $query = RawBiometricPunch::query();

            $tenantId = $config['tenant_id'] ?? session('tenant_id') ?? app()->make('current_tenant_id') ?? null;
            if ($tenantId !== null) {
                $query->where('tenant_id', $tenantId);
            }

            $status = $config['status'] ?? 'pending';
            if ($status !== 'all') {
                $query->where('status', $status);
            }

            if (! empty($config['device_sn'])) {
                $query->where('device_sn', (string) $config['device_sn']);
            }

            if (! empty($config['start_date'])) {
                $query->where('punch_time', '>=', Carbon::parse((string) $config['start_date'])->startOfDay());
            }

            if (! empty($config['end_date'])) {
                $query->where('punch_time', '<=', Carbon::parse((string) $config['end_date'])->endOfDay());
            }

            $limit = isset($config['limit']) ? (int) $config['limit'] : 1000;
            $punches = $query->orderBy('punch_time')->limit($limit)->get();
        }

        $records = [];
        $index = 0;

        foreach ($punches as $item) {
            $index++;
            $stagingId = null;
            $rawUserId = '';
            $punchTime = '';
            $rawPunchType = 'auto';
            $deviceSn = $defaultDeviceId;
            $rawPayload = null;

            if ($item instanceof RawBiometricPunch) {
                $stagingId = (string) $item->id;
                $rawPayload = $item->raw_payload;

                // Extract values using configured column names or model properties
                $rawUserId = (string) ($item->{$rawUserIdCol} ?? $item->raw_user_id ?? '');
                $rawPunchTime = $item->{$punchTimeCol} ?? $item->punch_time;
                $punchTime = $rawPunchTime instanceof Carbon ? $rawPunchTime->format('Y-m-d H:i:s') : (string) $rawPunchTime;
                $rawPunchType = (string) ($item->{$punchTypeCol} ?? $item->punch_type ?? 'auto');
                $deviceSn = (string) ($item->{$deviceSnCol} ?? $item->device_sn ?? $defaultDeviceId);
            } elseif (is_array($item)) {
                $stagingId = isset($item['id']) ? (string) $item['id'] : null;
                $rawPayload = $item['raw_payload'] ?? null;
                $rawUserId = (string) ($item[$rawUserIdCol] ?? $item['raw_user_id'] ?? $item['user_id'] ?? '');
                $punchTime = (string) ($item[$punchTimeCol] ?? $item['punch_time'] ?? $item['timestamp'] ?? '');
                $rawPunchType = (string) ($item[$punchTypeCol] ?? $item['punch_type'] ?? $item['type'] ?? 'auto');
                $deviceSn = (string) ($item[$deviceSnCol] ?? $item['device_sn'] ?? $item['device_id'] ?? $defaultDeviceId);
            } elseif (is_object($item)) {
                $stagingId = isset($item->id) ? (string) $item->id : null;
                $rawPayload = $item->raw_payload ?? null;
                $rawUserId = (string) ($item->{$rawUserIdCol} ?? $item->raw_user_id ?? $item->user_id ?? '');
                $punchTime = (string) ($item->{$punchTimeCol} ?? $item->punch_time ?? $item->timestamp ?? '');
                $rawPunchType = (string) ($item->{$punchTypeCol} ?? $item->punch_type ?? $item->type ?? 'auto');
                $deviceSn = (string) ($item->{$deviceSnCol} ?? $item->device_sn ?? $item->device_id ?? $defaultDeviceId);
            }

            // Fallback checks from raw_payload if main fields were empty and payload exists
            if (empty($rawUserId) && is_array($rawPayload) && isset($rawPayload[$rawUserIdCol])) {
                $rawUserId = (string) $rawPayload[$rawUserIdCol];
            }
            if (empty($punchTime) && is_array($rawPayload) && isset($rawPayload[$punchTimeCol])) {
                $punchTime = (string) $rawPayload[$punchTimeCol];
            }

            // Resolve punch type with mapping
            $normalizedPunchType = $this->resolvePunchType($rawPunchType, $statusCodeMapping);

            $records[] = [
                'staging_id' => $stagingId,
                'biometric_id' => trim($rawUserId),
                'punch_datetime' => trim($punchTime),
                'punch_type' => $normalizedPunchType,
                'device_id' => ! empty($deviceSn) ? trim((string) $deviceSn) : null,
                'line_number' => $index,
                'raw' => json_encode([
                    'staging_id' => $stagingId,
                    'user_id' => $rawUserId,
                    'punch_time' => $punchTime,
                    'punch_type' => $rawPunchType,
                    'device_sn' => $deviceSn,
                ]),
            ];
        }

        return $records;
    }

    /**
     * Validate the parsed records, returning valid and invalid records.
     *
     * @param  array<int, array<string, mixed>>  $rawRecords
     * @return array{
     *     valid_records: array<int, array<string, mixed>>,
     *     invalid_records: array<int, array<string, mixed>>,
     *     summary: array{total: int, valid: int, invalid: int}
     * }
     */
    public function validate(array $rawRecords, array $config = []): array
    {
        $valid = [];
        $invalid = [];
        $dateFormat = (string) ($config['date_format'] ?? 'auto');

        foreach ($rawRecords as $record) {
            $biometricId = trim((string) ($record['biometric_id'] ?? ''));
            $datetimeStr = trim((string) ($record['punch_datetime'] ?? ''));

            if ($biometricId === '') {
                $invalid[] = array_merge($record, ['error' => 'Missing Raw User ID']);

                continue;
            }

            if ($datetimeStr === '') {
                $invalid[] = array_merge($record, ['error' => 'Missing Punch Datetime']);

                continue;
            }

            $parsedDate = $this->parseDatetime($datetimeStr, $dateFormat);
            if ($parsedDate === null) {
                $invalid[] = array_merge($record, ['error' => "Malformed punch datetime: '{$datetimeStr}'"]);

                continue;
            }

            $valid[] = [
                'staging_id' => $record['staging_id'] ?? null,
                'biometric_id' => $biometricId,
                'punch_datetime' => $parsedDate,
                'punch_type' => (string) ($record['punch_type'] ?? 'auto'),
                'device_id' => $record['device_id'] ?? null,
                'line_number' => $record['line_number'] ?? 0,
                'raw' => (string) ($record['raw'] ?? ''),
            ];
        }

        return [
            'valid_records' => $valid,
            'invalid_records' => $invalid,
            'summary' => [
                'total' => count($rawRecords),
                'valid' => count($valid),
                'invalid' => count($invalid),
            ],
        ];
    }

    /**
     * Resolve punch type from raw terminal code and status mapping.
     *
     * @param  array<string, string>  $mapping
     */
    private function resolvePunchType(string $rawStatus, array $mapping): string
    {
        $clean = trim($rawStatus);
        $lower = strtolower($clean);

        // 1. Direct match in user mapping
        if (isset($mapping[$clean])) {
            return $this->normalizePunchType($mapping[$clean]);
        }
        if (isset($mapping[$lower])) {
            return $this->normalizePunchType($mapping[$lower]);
        }

        // 2. Standard heuristic fallbacks
        if (in_array($lower, ['0', 'in', 'c/in', 'checkin', 'check_in', 'entry', 'duty_on', '1'], false) && in_array($lower, ['0', 'in', 'c/in', 'checkin', 'check_in', 'entry', 'duty_on'], true)) {
            return 'in';
        }
        if (in_array($lower, ['1', 'out', 'c/out', 'checkout', 'check_out', 'exit', 'duty_off'], true)) {
            return 'out';
        }
        if (in_array($lower, ['2', '5'], true)) {
            return 'out';
        }
        if (in_array($lower, ['3', '4'], true)) {
            return 'in';
        }

        return 'auto';
    }

    /**
     * Normalize punch type string to 'in', 'out', or 'auto'.
     */
    private function normalizePunchType(string $type): string
    {
        $lower = strtolower(trim($type));

        return in_array($lower, ['in', 'out'], true) ? $lower : 'auto';
    }

    /**
     * Parse and normalize date string to Y-m-d H:i:s.
     */
    private function parseDatetime(string $datetimeStr, string $dateFormat = 'auto'): ?string
    {
        $trimmed = trim($datetimeStr);

        // 1. Try explicit format if provided and not 'auto'
        if ($dateFormat !== '' && $dateFormat !== 'auto') {
            try {
                $carbon = Carbon::createFromFormat($dateFormat, $trimmed);
                if ($carbon !== false) {
                    return $carbon->format('Y-m-d H:i:s');
                }
            } catch (\Throwable) {
                // Fall through to auto heuristics
            }
        }

        // 2. Try Carbon parse directly
        try {
            $carbon = Carbon::parse($trimmed);

            return $carbon->format('Y-m-d H:i:s');
        } catch (\Throwable) {
            return null;
        }
    }
}
