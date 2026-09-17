<?php

declare(strict_types=1);

namespace App\Services\BankGenerators;

use App\Models\PayrollEmployee;
use App\Models\PayrollRun;
use Illuminate\Support\Collection;

final class CommercialBankGenerator implements BankGeneratorInterface
{
    public function getBankCode(): string
    {
        return 'combank';
    }

    public function getBankName(): string
    {
        return 'Commercial Bank of Ceylon';
    }

    public function getClearingCode(): string
    {
        return '7056';
    }

    public function getFileExtension(): string
    {
        return 'csv';
    }

    public function getMimeType(): string
    {
        return 'text/csv';
    }

    public function generate(PayrollRun $payrollRun, Collection $employees, array $options = []): string
    {
        $rows = [];
        $rows[] = [
            'Beneficiary Name',
            'Beneficiary Bank Code',
            'Beneficiary Branch Code',
            'Beneficiary Account Number',
            'Amount',
            'Currency',
            'Narration',
            'Beneficiary Reference',
            'Beneficiary Email',
        ];

        $period = sprintf('%04d-%02d', $payrollRun->period_year, $payrollRun->period_month);

        foreach ($employees as $employeeRecord) {
            $netPay = (float) $employeeRecord->net_pay;
            if ($netPay <= 0) {
                continue;
            }

            $employee = $employeeRecord->employee;
            $bankInfo = $employee?->bankInfo;
            $accountNo = preg_replace('/\D/', '', (string) ($bankInfo?->account_no ?? ''));

            $rows[] = [
                $employee?->full_name ?? 'Employee',
                $bankInfo?->bank_code ?: '7056',
                $bankInfo?->branch_name ?: '001',
                $accountNo ?: '0000000000',
                number_format($netPay, 2, '.', ''),
                'LKR',
                "SALARY {$period}",
                $employee?->emp_no ?? 'EMP',
                $employee?->email ?? '',
            ];
        }

        return $this->formatCsv($rows);
    }

    /**
     * Helper to assemble CSV string cleanly with proper quotes.
     *
     * @param array<int, array<int, string>> $rows
     */
    private function formatCsv(array $rows): string
    {
        $handle = fopen('php://memory', 'r+');
        foreach ($rows as $row) {
            fputcsv($handle, $row);
        }
        rewind($handle);
        $content = stream_get_contents($handle);
        fclose($handle);

        return $content !== false ? $content : '';
    }
}
