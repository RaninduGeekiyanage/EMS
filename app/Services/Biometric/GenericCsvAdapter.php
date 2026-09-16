<?php

declare(strict_types=1);

namespace App\Services\Biometric;

use App\Contracts\BiometricImportAdapterInterface;
use Carbon\Carbon;
use Exception;

final class GenericCsvAdapter implements BiometricImportAdapterInterface
{
    /**
     * Parse raw CSV file into standardized punch records.
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
            throw new Exception("CSV file not found at: {$filePath}");
        }

        $handle = fopen($filePath, 'r');
        if ($handle === false) {
            throw new Exception("Unable to open CSV file at: {$filePath}");
        }

        // Auto-detect delimiter from first line
        $firstLine = fgets($handle);
        if ($firstLine === false) {
            fclose($handle);

            return [];
        }

        $delimiter = $config['delimiter'] ?? $this->detectDelimiter($firstLine);
        rewind($handle);

        $headerRow = fgetcsv($handle, 0, $delimiter, '"', '\\');
        if (! $headerRow) {
            fclose($handle);

            return [];
        }

        $headers = array_map(static fn ($h) => strtolower(trim((string) $h)), $headerRow);
        $columnMap = $this->resolveColumnMap($headers, $config['column_mapping'] ?? []);

        $records = [];
        $lineNumber = 1;

        while (($row = fgetcsv($handle, 0, $delimiter, '"', '\\')) !== false) {
            $lineNumber++;

            // Skip empty rows
            if (empty(array_filter($row, static fn ($v) => trim((string) $v) !== ''))) {
                continue;
            }

            $biometricId = isset($columnMap['biometric_id']) && isset($row[$columnMap['biometric_id']])
                ? trim((string) $row[$columnMap['biometric_id']])
                : '';

            // Handle date and time: combined or separate
            $datetimeStr = '';
            if (isset($columnMap['datetime']) && isset($row[$columnMap['datetime']])) {
                $datetimeStr = trim((string) $row[$columnMap['datetime']]);
            } elseif (isset($columnMap['date']) && isset($row[$columnMap['date']])) {
                $datePart = trim((string) $row[$columnMap['date']]);
                $timePart = isset($columnMap['time']) && isset($row[$columnMap['time']])
                    ? trim((string) $row[$columnMap['time']])
                    : '00:00:00';
                $datetimeStr = "{$datePart} {$timePart}";
            }

            // Punch type
            $punchType = 'auto';
            if (isset($columnMap['punch_type']) && isset($row[$columnMap['punch_type']])) {
                $rawType = strtolower(trim((string) $row[$columnMap['punch_type']]));
                if (in_array($rawType, ['in', 'check_in', 'checkin', '1', '0'], true)) {
                    $punchType = in_array($rawType, ['out', 'checkout', '1'], true) && $rawType === '1' ? 'out' : 'in';
                } elseif (in_array($rawType, ['out', 'check_out', 'checkout'], true)) {
                    $punchType = 'out';
                }
            }

            // Device ID
            $deviceId = $config['device_id'] ?? null;
            if ($deviceId === null && isset($columnMap['device_id']) && isset($row[$columnMap['device_id']])) {
                $deviceId = trim((string) $row[$columnMap['device_id']]);
            }

            $records[] = [
                'biometric_id' => $biometricId,
                'punch_datetime' => $datetimeStr,
                'punch_type' => $punchType,
                'device_id' => $deviceId ?: null,
                'line_number' => $lineNumber,
                'raw' => implode($delimiter, $row),
            ];
        }

        fclose($handle);

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
                $invalid[] = array_merge($record, ['error' => 'Missing Biometric or Employee ID']);

                continue;
            }

            try {
                $carbon = Carbon::parse($datetimeStr);
                $normalizedDatetime = $carbon->format('Y-m-d H:i:s');
            } catch (Exception) {
                $invalid[] = array_merge($record, ['error' => "Invalid datetime format: '{$datetimeStr}'"]);

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

    /**
     * Detect CSV delimiter (comma, semicolon, tab).
     */
    private function detectDelimiter(string $firstLine): string
    {
        $delimiters = [',', ';', "\t", '|'];
        $counts = [];

        foreach ($delimiters as $d) {
            $counts[$d] = substr_count($firstLine, $d);
        }

        arsort($counts);

        return (string) array_key_first($counts) ?: ',';
    }

    /**
     * Resolve column indexes based on header strings or custom config.
     *
     * @param  array<int, string>  $headers
     * @param  array<string, string|int>  $customMap
     * @return array<string, int>
     */
    private function resolveColumnMap(array $headers, array $customMap = []): array
    {
        $map = [];

        $aliases = [
            'biometric_id' => ['biometric_id', 'biometric_device_id', 'emp_no', 'employee_no', 'employee_id', 'emp_id', 'user_id', 'badgenumber', 'pin', 'id'],
            'datetime' => ['punch_datetime', 'punch_time', 'datetime', 'timestamp', 'date_time', 'punch_time_stamp'],
            'date' => ['punch_date', 'date', 'work_date', 'attendance_date'],
            'time' => ['punch_time', 'time', 'clock_time'],
            'punch_type' => ['punch_type', 'type', 'status', 'direction', 'in_out', 'state', 'punch_state'],
            'device_id' => ['device_id', 'device', 'terminal', 'terminal_id', 'machine_id', 'serial_number'],
        ];

        foreach ($aliases as $target => $candidates) {
            if (isset($customMap[$target])) {
                $val = $customMap[$target];
                if (is_numeric($val)) {
                    $map[$target] = (int) $val;

                    continue;
                }
                $foundIdx = array_search(strtolower(trim((string) $val)), $headers, true);
                if ($foundIdx !== false) {
                    $map[$target] = (int) $foundIdx;

                    continue;
                }
            }

            foreach ($candidates as $candidate) {
                $idx = array_search($candidate, $headers, true);
                if ($idx !== false) {
                    $map[$target] = (int) $idx;
                    break;
                }
            }
        }

        // Fallback: if biometric_id still not mapped, default to column 0
        if (! isset($map['biometric_id']) && count($headers) > 0) {
            $map['biometric_id'] = 0;
        }

        // Fallback: if datetime not mapped, check column 1
        if (! isset($map['datetime']) && ! isset($map['date']) && count($headers) > 1) {
            $map['datetime'] = 1;
        }

        return $map;
    }
}
