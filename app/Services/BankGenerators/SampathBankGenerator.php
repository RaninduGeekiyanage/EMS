<?php

declare(strict_types=1);

namespace App\Services\BankGenerators;

use App\Models\PayrollEmployee;
use App\Models\PayrollRun;
use Illuminate\Support\Collection;

final class SampathBankGenerator implements BankGeneratorInterface
{
    public function getBankCode(): string
    {
        return 'sampath';
    }

    public function getBankName(): string
    {
        return 'Sampath Bank';
    }

    public function getClearingCode(): string
    {
        return '7278';
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
            'Debit Account',
            'Beneficiary Account',
            'Bank Code',
            'Branch Code',
            'Amount',
            'Currency',
            'Beneficiary Name',
            'Payment Reference',
            'Particulars',
        ];

        $debitAccount = (string) ($options['originating_account'] ?? '014210001234');
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
                $debitAccount,
                $accountNo ?: '0000000000',
                $bankInfo?->bank_code ?: '7278',
                $bankInfo?->branch_name ?: '001',
                number_format($netPay, 2, '.', ''),
                'LKR',
                $employee?->full_name ?? 'Employee',
                $employee?->emp_no ?? 'EMP',
                "SALARY {$period}",
            ];
        }

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
