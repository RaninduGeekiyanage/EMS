<?php

declare(strict_types=1);

namespace App\Services\Biometric;

use App\Contracts\BiometricImportAdapterInterface;
use Carbon\Carbon;
use Exception;
use SimpleXMLElement;
use ZipArchive;

final class ExcelAdapter implements BiometricImportAdapterInterface
{
    /**
     * Parse raw Excel XLSX file into standardized punch records.
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
            throw new Exception("Excel file not found at: {$filePath}");
        }

        // Try reading as XLSX OpenXML zip archive
        $rows = $this->readXlsxRows($filePath);

        // Fallback: If not a valid zip archive, try CSV reading
        if (empty($rows)) {
            $csvAdapter = new GenericCsvAdapter;

            return $csvAdapter->parse($filePath, $config);
        }

        $headerRow = array_shift($rows);
        if (! $headerRow) {
            return [];
        }

        $headers = array_map(static fn ($h) => strtolower(trim((string) $h)), $headerRow);
        $columnMap = $this->resolveColumnMap($headers, $config['column_mapping'] ?? []);

        $records = [];
        $lineNumber = 1;

        foreach ($rows as $row) {
            $lineNumber++;

            if (empty(array_filter($row, static fn ($v) => trim((string) $v) !== ''))) {
                continue;
            }

            $biometricId = isset($columnMap['biometric_id']) && isset($row[$columnMap['biometric_id']])
                ? trim((string) $row[$columnMap['biometric_id']])
                : '';

            $datetimeStr = '';
            if (isset($columnMap['datetime']) && isset($row[$columnMap['datetime']])) {
                $datetimeStr = $this->formatExcelValue($row[$columnMap['datetime']]);
            } elseif (isset($columnMap['date']) && isset($row[$columnMap['date']])) {
                $datePart = $this->formatExcelValue($row[$columnMap['date']]);
                $timePart = isset($columnMap['time']) && isset($row[$columnMap['time']])
                    ? $this->formatExcelValue($row[$columnMap['time']])
                    : '00:00:00';
                $datetimeStr = "{$datePart} {$timePart}";
            }

            $punchType = 'auto';
            if (isset($columnMap['punch_type']) && isset($row[$columnMap['punch_type']])) {
                $rawType = strtolower(trim((string) $row[$columnMap['punch_type']]));
                if (in_array($rawType, ['in', 'check_in', 'checkin', '0'], true)) {
                    $punchType = 'in';
                } elseif (in_array($rawType, ['out', 'check_out', 'checkout', '1'], true)) {
                    $punchType = 'out';
                }
            }

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
                'raw' => implode(' | ', $row),
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
     * Read rows from an XLSX OpenXML file directly using ZipArchive and SimpleXML.
     *
     * @return array<int, array<int, string>>
     */
    private function readXlsxRows(string $filePath): array
    {
        $zip = new ZipArchive;
        if ($zip->open($filePath) !== true) {
            return [];
        }

        // 1. Read shared strings if present
        $sharedStrings = [];
        $sharedStringsXml = $zip->getFromName('xl/sharedStrings.xml');
        if ($sharedStringsXml !== false) {
            $xml = simplexml_load_string($sharedStringsXml);
            if ($xml !== false) {
                foreach ($xml->si as $si) {
                    if (isset($si->t)) {
                        $sharedStrings[] = (string) $si->t;
                    } elseif (isset($si->r)) {
                        $text = '';
                        foreach ($si->r as $r) {
                            $text .= (string) $r->t;
                        }
                        $sharedStrings[] = $text;
                    } else {
                        $sharedStrings[] = '';
                    }
                }
            }
        }

        // 2. Read first sheet
        $sheetXml = $zip->getFromName('xl/worksheets/sheet1.xml');
        if ($sheetXml === false) {
            // Try looking for any sheet
            for ($i = 0; $i < $zip->numFiles; $i++) {
                $name = $zip->getNameIndex($i);
                if ($name && str_starts_with($name, 'xl/worksheets/sheet') && str_ends_with($name, '.xml')) {
                    $sheetXml = $zip->getFromIndex($i);
                    break;
                }
            }
        }

        $zip->close();

        if ($sheetXml === false) {
            return [];
        }

        $xml = simplexml_load_string($sheetXml);
        if ($xml === false || ! isset($xml->sheetData)) {
            return [];
        }

        $rows = [];
        foreach ($xml->sheetData->row as $row) {
            $rowData = [];
            $colIndex = 0;

            foreach ($row->c as $cell) {
                // Calculate column index from cell reference (e.g. A1, B1, C2)
                $ref = (string) $cell['r'];
                $colLetters = preg_replace('/\d+/', '', $ref);
                $targetCol = $this->columnLettersToIndex($colLetters);

                // Pad empty columns
                while ($colIndex < $targetCol) {
                    $rowData[$colIndex] = '';
                    $colIndex++;
                }

                $type = (string) $cell['t'];
                $val = (string) $cell->v;

                if ($type === 's') {
                    // Shared string lookup
                    $idx = (int) $val;
                    $val = $sharedStrings[$idx] ?? '';
                } elseif ($type === 'inlineStr' && isset($cell->is->t)) {
                    $val = (string) $cell->is->t;
                }

                $rowData[$colIndex] = $val;
                $colIndex++;
            }

            if (! empty($rowData)) {
                $rows[] = $rowData;
            }
        }

        return $rows;
    }

    /**
     * Convert column letters (A, B, Z, AA, AB) to 0-based column index.
     */
    private function columnLettersToIndex(string $letters): int
    {
        $letters = strtoupper($letters);
        $len = strlen($letters);
        $index = 0;

        for ($i = 0; $i < $len; $i++) {
            $index = $index * 26 + (ord($letters[$i]) - 64);
        }

        return max(0, $index - 1);
    }

    /**
     * Format an Excel cell value: convert numeric Excel serial dates to standard datetime.
     */
    private function formatExcelValue(string|int|float $value): string
    {
        $val = trim((string) $value);

        // If numeric value is an Excel serial date (e.g. 45352.35416)
        if (is_numeric($val) && (float) $val > 25000 && (float) $val < 70000) {
            $serial = (float) $val;
            $base = Carbon::create(1899, 12, 30);
            $days = (int) floor($serial);
            $fraction = $serial - $days;
            $seconds = (int) round($fraction * 86400);

            return $base->addDays($days)->addSeconds($seconds)->format('Y-m-d H:i:s');
        }

        return $val;
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
            'punch_type' => ['punch_type', 'type', 'status', 'direction', 'in_out', 'state'],
            'device_id' => ['device_id', 'device', 'terminal', 'terminal_id', 'machine_id'],
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

        if (! isset($map['biometric_id']) && count($headers) > 0) {
            $map['biometric_id'] = 0;
        }

        if (! isset($map['datetime']) && ! isset($map['date']) && count($headers) > 1) {
            $map['datetime'] = 1;
        }

        return $map;
    }
}
