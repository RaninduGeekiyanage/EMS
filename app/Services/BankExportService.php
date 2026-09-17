<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\BankExportLog;
use App\Models\PayrollRun;
use App\Models\User;
use App\Services\BankGenerators\BankGeneratorInterface;
use App\Services\BankGenerators\BocGenerator;
use App\Services\BankGenerators\CommercialBankGenerator;
use App\Services\BankGenerators\HnbGenerator;
use App\Services\BankGenerators\NsbGenerator;
use App\Services\BankGenerators\PeoplesBankGenerator;
use App\Services\BankGenerators\SampathBankGenerator;
use Illuminate\Support\Facades\Storage;
use InvalidArgumentException;

final class BankExportService
{
    /**
     * Map of supported bank codes to their generator instances.
     *
     * @var array<string, BankGeneratorInterface>
     */
    private array $generators;

    public function __construct()
    {
        $this->generators = [
            'boc' => new BocGenerator(),
            'combank' => new CommercialBankGenerator(),
            'sampath' => new SampathBankGenerator(),
            'hnb' => new HnbGenerator(),
            'peoples' => new PeoplesBankGenerator(),
            'nsb' => new NsbGenerator(),
        ];
    }

    /**
     * Retrieve the generator for a specified bank code.
     */
    public function getGenerator(string $bankCode): BankGeneratorInterface
    {
        $code = strtolower(trim($bankCode));
        if (! isset($this->generators[$code])) {
            throw new InvalidArgumentException("Unsupported bank code: [{$bankCode}]. Supported: " . implode(', ', array_keys($this->generators)));
        }

        return $this->generators[$code];
    }

    /**
     * List all available bank export providers.
     *
     * @return array<int, array<string, string>>
     */
    public function getAvailableBanks(): array
    {
        $list = [];
        foreach ($this->generators as $key => $generator) {
            $list[] = [
                'code' => $generator->getBankCode(),
                'name' => $generator->getBankName(),
                'clearing_code' => $generator->getClearingCode(),
                'extension' => $generator->getFileExtension(),
                'mime' => $generator->getMimeType(),
            ];
        }

        return $list;
    }

    /**
     * Generate bulk bank transfer file and log the operation.
     *
     * @param array<string, mixed> $options
     * @return array{
     *     filename: string,
     *     content: string,
     *     mime: string,
     *     log: BankExportLog,
     *     record_count: int,
     *     total_amount: float
     * }
     */
    public function export(
        PayrollRun $payrollRun,
        string $bankCode,
        ?User $exportedByUser = null,
        array $options = []
    ): array {
        $generator = $this->getGenerator($bankCode);

        // Load all active payroll records with bank info
        $payrollRun->loadMissing([
            'payrollEmployees.employee.bankInfo',
            'payrollEmployees.employee.department',
            'tenant',
        ]);

        $employees = $payrollRun->payrollEmployees->filter(function ($item): bool {
            return (float) $item->net_pay > 0;
        });

        // Optional filtering: only export employees whose designated bank matches this bank
        if (! empty($options['filter_by_bank'])) {
            $clearingCode = $generator->getClearingCode();
            $employees = $employees->filter(function ($item) use ($clearingCode): bool {
                return $item->employee?->bankInfo?->bank_code === $clearingCode;
            });
        }

        $content = $generator->generate($payrollRun, $employees, $options);

        $recordCount = $employees->count();
        $totalAmount = (float) $employees->sum('net_pay');

        $monthPadded = str_pad((string) $payrollRun->period_month, 2, '0', STR_PAD_LEFT);
        $filename = sprintf(
            'PAYROLL-%d-%s-%s.%s',
            $payrollRun->period_year,
            $monthPadded,
            strtoupper($generator->getBankCode()),
            $generator->getFileExtension()
        );

        $storagePath = "exports/payroll/{$payrollRun->id}/{$filename}";
        Storage::disk('local')->put($storagePath, $content);

        /** @var BankExportLog $log */
        $log = BankExportLog::create([
            'tenant_id' => $payrollRun->tenant_id,
            'payroll_run_id' => $payrollRun->id,
            'bank_code' => $generator->getBankCode(),
            'file_path' => $storagePath,
            'record_count' => $recordCount,
            'total_amount' => $totalAmount,
            'exported_by' => $exportedByUser?->id,
        ]);

        return [
            'filename' => $filename,
            'content' => $content,
            'mime' => $generator->getMimeType(),
            'log' => $log,
            'record_count' => $recordCount,
            'total_amount' => $totalAmount,
        ];
    }
}
