<?php

declare(strict_types=1);

namespace App\Contracts;

interface BiometricImportAdapterInterface
{
    /**
     * Parse raw attendance file into standardized punch records.
     *
     * @param  string  $filePath
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
    public function parse(string $filePath, array $config = []): array;

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
    public function validate(array $rawRecords): array;
}
