<?php

declare(strict_types=1);

namespace App\Services\Biometric;

use App\Contracts\BiometricImportAdapterInterface;
use Carbon\Carbon;
use Exception;

final class ZKTecoAdapter implements BiometricImportAdapterInterface
{
    /**
     * Map ZKTeco terminal status codes to standardized punch types.
     *
     * 0 = Check-in
     * 1 = Check-out
     * 2 = Break-out
     * 3 = Break-in
     * 4 = OT-in
     * 5 = OT-out
     */
    private const STATUS_MAP = [
        '0' => 'in',
        '1' => 'out',
        '2' => 'out',
        '3' => 'in',
        '4' => 'in',
        '5' => 'out',
    ];

    /**
     * Parse raw attendance file into standardized punch records.
     *
     * @param  array<string, mixed>  $config
     * @return array<int, array{
     *     biometric_id: string,
     *     punch_datetime: string,
     *     punch_type: string,
     *     device_id: ?string,
     *     line_number: int,
     *     raw: string
     * }>
     */
    public function parse(string $filePath, array $config = []): array
    {
        if (! file_exists($filePath)) {
            throw new Exception("Biometric file not found at: {$filePath}");
        }

        $lines = file($filePath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        if ($lines === false) {
            throw new Exception("Unable to read biometric file at: {$filePath}");
        }

        $records = [];
        $deviceId = $config['device_id'] ?? null;

        foreach ($lines as $index => $line) {
            $lineNumber = $index + 1;
            $trimmed = trim($line);

            if ($trimmed === '' || str_starts_with($trimmed, '#')) {
                continue;
            }

            // Split by tabs or multiple spaces
            $tokens = preg_split('/\t+|\s{2,}|\s(?=\d{2}:)/', $trimmed);
            if (! $tokens || count($tokens) < 2) {
                // Try splitting by any single space or tab
                $tokens = preg_split('/\s+/', $trimmed);
            }

            if (! $tokens || count($tokens) < 2) {
                continue;
            }

            $tokens = array_values(array_filter(array_map('trim', $tokens), static fn ($t) => $t !== ''));

            $biometricId = $tokens[0] ?? '';

            // Extract datetime: might be single token (2026-03-01 08:30:00) or two tokens (2026-03-01 and 08:30:00)
            $datetimeStr = '';
            $statusIndex = 2;

            if (isset($tokens[1])) {
                if (isset($tokens[2]) && preg_match('/^\d{1,2}:\d{2}(:\d{2})?$/', $tokens[2])) {
                    $datetimeStr = $tokens[1].' '.$tokens[2];
                    $statusIndex = 3;
                } else {
                    $datetimeStr = $tokens[1];
                    $statusIndex = 2;
                }
            }

            // Punch type resolution from status code
            $statusCode = $tokens[$statusIndex] ?? null;
            $punchType = 'auto';

            if ($statusCode !== null && isset(self::STATUS_MAP[(string) $statusCode])) {
                $punchType = self::STATUS_MAP[(string) $statusCode];
            } elseif ($statusCode !== null) {
                $lower = strtolower((string) $statusCode);
                if (in_array($lower, ['in', 'checkin', 'check_in', '0'], true)) {
                    $punchType = 'in';
                } elseif (in_array($lower, ['out', 'checkout', 'check_out', '1'], true)) {
                    $punchType = 'out';
                }
            }

            // Device ID may be present in further tokens
            $lineDeviceId = $deviceId;
            if ($lineDeviceId === null && isset($tokens[$statusIndex + 1])) {
                $candidate = $tokens[$statusIndex + 1];
                if (is_numeric($candidate) && strlen($candidate) > 2) {
                    $lineDeviceId = $candidate;
                }
            }

            $records[] = [
                'biometric_id' => $biometricId,
                'punch_datetime' => $datetimeStr,
                'punch_type' => $punchType,
                'device_id' => $lineDeviceId,
                'line_number' => $lineNumber,
                'raw' => $line,
            ];
        }

        return $records;
    }

    /**
     * Validate parsed records and normalize datetime strings.
     *
     * @param  array<int, array<string, mixed>>  $rawRecords
     * @return array{
     *     valid_records: array<int, array<string, mixed>>,
     *     invalid_records: array<int, array<string, mixed>>,
     *     summary: array{total: int, valid: int, invalid: int}
     * }
     */
    public function validate(array $rawRecords): array
    {
        $valid = [];
        $invalid = [];

        foreach ($rawRecords as $record) {
            $biometricId = trim((string) ($record['biometric_id'] ?? ''));
            $datetimeStr = trim((string) ($record['punch_datetime'] ?? ''));

            if ($biometricId === '') {
                $invalid[] = array_merge($record, ['error' => 'Missing Biometric ID']);

                continue;
            }

            try {
                $carbon = Carbon::parse($datetimeStr);
                $normalizedDatetime = $carbon->format('Y-m-d H:i:s');
            } catch (Exception) {
                $invalid[] = array_merge($record, ['error' => "Malformed datetime: '{$datetimeStr}'"]);

                continue;
            }

            $punchType = strtolower((string) ($record['punch_type'] ?? 'auto'));
            if (! in_array($punchType, ['in', 'out', 'auto'], true)) {
                $punchType = 'auto';
            }

            $valid[] = [
                'biometric_id' => $biometricId,
                'punch_datetime' => $normalizedDatetime,
                'punch_type' => $punchType,
                'device_id' => $record['device_id'] ?? null,
                'line_number' => $record['line_number'] ?? 0,
                'raw' => $record['raw'] ?? '',
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
}
