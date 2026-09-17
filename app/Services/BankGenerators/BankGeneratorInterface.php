<?php

declare(strict_types=1);

namespace App\Services\BankGenerators;

use App\Models\PayrollRun;
use Illuminate\Support\Collection;

interface BankGeneratorInterface
{
    /**
     * Get the bank code key (e.g., 'boc', 'combank', 'sampath', 'hnb', 'peoples', 'nsb').
     */
    public function getBankCode(): string;

    /**
     * Get the human-readable display name of the bank.
     */
    public function getBankName(): string;

    /**
     * Get the Sri Lankan routing/clearing code (e.g. 7010 for BoC).
     */
    public function getClearingCode(): string;

    /**
     * Get the file extension for this export (e.g. 'txt', 'csv').
     */
    public function getFileExtension(): string;

    /**
     * Get the MIME type for download headers.
     */
    public function getMimeType(): string;

    /**
     * Generate formatted bulk payment file content for the given payroll run and employees.
     *
     * @param PayrollRun $payrollRun
     * @param Collection<int, \App\Models\PayrollEmployee> $employees
     * @param array<string, mixed> $options
     * @return string The generated file contents
     */
    public function generate(PayrollRun $payrollRun, Collection $employees, array $options = []): string;
}
