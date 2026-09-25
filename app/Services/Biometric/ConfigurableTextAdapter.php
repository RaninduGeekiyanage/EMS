<?php

declare(strict_types=1);

namespace App\Services\Biometric;

use App\Contracts\BiometricImportAdapterInterface;
use App\Models\BiometricDeviceProfile;
use Carbon\Carbon;
use Exception;

final class ConfigurableTextAdapter implements BiometricImportAdapterInterface
{
    /**
     * Parse raw attendance file into standardized punch records using profile configuration.
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
            throw new Exception("Attendance file not found at: {$filePath}");
        }

        $lines = file($filePath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        if ($lines === false) {
            throw new Exception("Unable to read attendance file at: {$filePath}");
        }

        // Normalize config from profile if provided
        $profile = $config['profile'] ?? null;
        if ($profile instanceof BiometricDeviceProfile) {
            $config = array_merge($profile->toArray(), $config);
        }

        $delimiterType = (string) ($config['delimiter_type'] ?? 'tab');
        $customDelimiter = (string) ($config['custom_delimiter'] ?? '');
        $skipHeaderLines = (int) ($config['skip_header_lines'] ?? 0);
        $dateMode = (string) ($config['date_mode'] ?? 'combined');
        $columnsConfig = (array) ($config['columns_config'] ?? []);
        $statusCodeMapping = (array) ($config['status_code_mapping'] ?? []);
        $defaultDeviceId = $config['device_id'] ?? $config['default_device_id'] ?? null;

        $bioIdCol = isset($columnsConfig['biometric_id_col']) ? (int) $columnsConfig['biometric_id_col'] : 0;
        $datetimeCol = isset($columnsConfig['datetime_col']) ? (int) $columnsConfig['datetime_col'] : 1;
        $dateCol = isset($columnsConfig['date_col']) ? (int) $columnsConfig['date_col'] : 1;
        $timeCol = isset($columnsConfig['time_col']) ? (int) $columnsConfig['time_col'] : 2;
        $amPmCol = isset($columnsConfig['am_pm_col']) && $columnsConfig['am_pm_col'] !== null && $columnsConfig['am_pm_col'] !== '' && $columnsConfig['am_pm_col'] !== 'none'
            ? (int) $columnsConfig['am_pm_col']
            : null;
        $punchTypeCol = isset($columnsConfig['punch_type_col']) && $columnsConfig['punch_type_col'] !== null && $columnsConfig['punch_type_col'] !== '' && $columnsConfig['punch_type_col'] !== 'none'
            ? (int) $columnsConfig['punch_type_col']
            : null;
        $deviceIdCol = isset($columnsConfig['device_id_col']) && $columnsConfig['device_id_col'] !== null && $columnsConfig['device_id_col'] !== '' && $columnsConfig['device_id_col'] !== 'none'
            ? (int) $columnsConfig['device_id_col']
            : null;

        $records = [];

        foreach ($lines as $index => $line) {
            $lineNumber = $index + 1;

            // Skip specified number of header lines
            if ($lineNumber <= $skipHeaderLines) {
                continue;
            }

            // Strip UTF-8 BOM if present on first parsed line
            if ($index === 0 && str_starts_with($line, "\xEF\xBB\xBF")) {
                $line = substr($line, 3);
            }

            $trimmed = trim($line);
            if ($trimmed === '' || str_starts_with($trimmed, '#')) {
                continue;
            }

            $tokens = $this->tokenizeLine($trimmed, $delimiterType, $customDelimiter);
            if (empty($tokens)) {
                continue;
            }

            $biometricId = isset($tokens[$bioIdCol]) ? trim((string) $tokens[$bioIdCol]) : '';

            // Datetime resolution
            $datetimeStr = '';
            if ($dateMode === 'separate') {
                $datePart = isset($tokens[$dateCol]) ? trim((string) $tokens[$dateCol]) : '';
                $timePart = isset($tokens[$timeCol]) ? trim((string) $tokens[$timeCol]) : '00:00:00';
                $amPmPart = '';

                if ($amPmCol !== null && isset($tokens[$amPmCol])) {
                    $amPmPart = trim((string) $tokens[$amPmCol]);
                } elseif (isset($tokens[$timeCol + 1]) && in_array(strtoupper(trim((string) $tokens[$timeCol + 1])), ['AM', 'PM'], true)) {
                    // Smart auto-detect AM/PM in adjacent token
                    $amPmPart = trim((string) $tokens[$timeCol + 1]);
                }

                $datetimeStr = trim("{$datePart} {$timePart} {$amPmPart}");
            } else {
                if (isset($tokens[$datetimeCol])) {
                    $val1 = trim((string) $tokens[$datetimeCol]);
                    // If combined column only had date and next token is a time format, merge them
                    if (isset($tokens[$datetimeCol + 1]) && preg_match('/^\d{1,2}:\d{2}(:\d{2})?(\s*(AM|PM|am|pm))?$/', trim((string) $tokens[$datetimeCol + 1]))) {
                        $datetimeStr = $val1.' '.trim((string) $tokens[$datetimeCol + 1]);
                        if (isset($tokens[$datetimeCol + 2]) && in_array(strtoupper(trim((string) $tokens[$datetimeCol + 2])), ['AM', 'PM'], true)) {
                            $datetimeStr .= ' '.trim((string) $tokens[$datetimeCol + 2]);
                        }
                    } else {
                        $datetimeStr = $val1;
                    }
                }
            }

            // Punch type resolution
            $punchType = 'auto';
            if ($punchTypeCol !== null && isset($tokens[$punchTypeCol])) {
                $rawStatus = trim((string) $tokens[$punchTypeCol]);
                $punchType = $this->resolvePunchType($rawStatus, $statusCodeMapping);
            }

            // Device ID resolution
            $lineDeviceId = $defaultDeviceId;
            if ($deviceIdCol !== null && isset($tokens[$deviceIdCol])) {
                $cand = trim((string) $tokens[$deviceIdCol]);
                if ($cand !== '') {
                    $lineDeviceId = $cand;
                }
            }

            $records[] = [
                'biometric_id' => $biometricId,
                'punch_datetime' => $datetimeStr,
                'punch_type' => $punchType,
                'device_id' => $lineDeviceId !== null ? (string) $lineDeviceId : null,
                'line_number' => $lineNumber,
                'raw' => $line,
            ];
        }

        return $records;
    }

    /**
     * Split a line into tokens based on delimiter configuration.
     *
     * @return array<int, string>
     */
    public function tokenizeLine(string $line, string $delimiterType, string $customDelimiter = ''): array
    {
        return match (strtolower($delimiterType)) {
            'tab' => array_values(array_filter(preg_split('/\t+/', $line) ?: [], static fn ($t) => $t !== '')),
            'space', 'regex_whitespace', 'whitespace' => array_values(array_filter(preg_split('/\s+/', $line) ?: [], static fn ($t) => $t !== '')),
            'comma' => str_getcsv($line, ','),
            'semicolon' => str_getcsv($line, ';'),
            'pipe' => str_getcsv($line, '|'),
            'custom' => $customDelimiter !== '' ? str_getcsv($line, $customDelimiter) : str_getcsv($line, ','),
            default => array_values(array_filter(preg_split('/\t+|\s{2,}/', $line) ?: [], static fn ($t) => $t !== '')),
        };
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
        if (in_array($lower, ['0', 'in', 'c/in', 'checkin', 'check_in', 'entry', 'duty_on'], true)) {
            return 'in';
        }
        if (in_array($lower, ['1', 'out', 'c/out', 'checkout', 'check_out', 'exit', 'duty_off'], true)) {
            return 'out';
        }
        if (in_array($lower, ['2'], true)) { // Break out in ZK
            return 'out';
        }
        if (in_array($lower, ['3'], true)) { // Break in in ZK
            return 'in';
        }
        if (in_array($lower, ['4'], true)) { // OT in in ZK
            return 'in';
        }
        if (in_array($lower, ['5'], true)) { // OT out in ZK
            return 'out';
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
     * Validate parsed records and normalize datetime strings.
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
                $invalid[] = array_merge($record, ['error' => 'Missing Biometric ID']);

                continue;
            }

            if ($datetimeStr === '') {
                $invalid[] = array_merge($record, ['error' => 'Missing Date/Time value']);

                continue;
            }

            $parsedDate = $this->parseDatetime($datetimeStr, $dateFormat);
            if ($parsedDate === null) {
                $invalid[] = array_merge($record, ['error' => "Malformed datetime: '{$datetimeStr}'"]);

                continue;
            }

            $punchType = $this->normalizePunchType((string) ($record['punch_type'] ?? 'auto'));

            $valid[] = [
                'biometric_id' => $biometricId,
                'punch_datetime' => $parsedDate,
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
     * Parse and normalize date string to Y-m-d H:i:s.
     */
    public function parseDatetime(string $datetimeStr, string $dateFormat = 'auto'): ?string
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

        // 2. Try common Sri Lankan & international formats
        $candidateFormats = [
            'Y-m-d H:i:s',
            'Y/m/d H:i:s',
            'd/m/Y H:i:s',
            'd-m-Y H:i:s',
            'Y-m-d H:i',
            'd/m/Y H:i',
            'd-m-Y H:i',
            'm/d/Y H:i:s',
            'd/m/Y h:i:s A',
            'd/m/Y g:i:s A',
            'd/m/Y h:i A',
            'd/m/Y g:i A',
            'd-m-Y h:i:s A',
            'd-m-Y g:i:s A',
            'd-m-Y h:i A',
            'd-m-Y g:i A',
            'Y-m-d h:i:s A',
            'Y-m-d g:i:s A',
            'Y-m-d h:i A',
            'Y-m-d g:i A',
            'Y/m/d h:i:s A',
            'Y/m/d g:i:s A',
            'Y/m/d h:i A',
            'Y/m/d g:i A',
            'm/d/Y h:i:s A',
            'm/d/Y g:i:s A',
            'm/d/Y h:i A',
            'm/d/Y g:i A',
        ];

        foreach ($candidateFormats as $format) {
            try {
                $carbon = Carbon::createFromFormat($format, $trimmed);
                if ($carbon !== false) {
                    return $carbon->format('Y-m-d H:i:s');
                }
            } catch (\Throwable) {
                continue;
            }
        }

        // 3. Fallback to generic Carbon parse
        try {
            $carbon = Carbon::parse($trimmed);

            return $carbon->format('Y-m-d H:i:s');
        } catch (\Throwable) {
            return null;
        }
    }
}
