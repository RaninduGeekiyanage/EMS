<?php

declare(strict_types=1);

namespace App\Services\BankGenerators;

use App\Models\PayrollEmployee;
use App\Models\PayrollRun;
use Carbon\Carbon;
use Illuminate\Support\Collection;

final class HnbGenerator implements BankGeneratorInterface
{
    public function getBankCode(): string
    {
        return 'hnb';
    }

    public function getBankName(): string
    {
        return 'Hatton National Bank (HNB)';
    }

    public function getClearingCode(): string
    {
        return '7083';
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
            'Value Date',
            'Beneficiary Bank Code',
            'Beneficiary Branch Code',
            'Beneficiary Account Number',
            'Beneficiary Name',
            'Amount',
            'Remarks',
            'Employee ID',
        ];

        $debitAccount = (string) ($options['originating_account'] ?? '003010098765');
        $valueDate = Carbon::createFromDate($payrollRun->period_year, $payrollRun->period_month, 1)->endOfMonth()->format('Y-m-d');
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
                $valueDate,
                $bankInfo?->bank_code ?: '7083',
                $bankInfo?->branch_name ?: '001',
                $accountNo ?: '0000000000',
                $employee?->full_name ?? 'Employee',
                number_format($netPay, 2, '.', ''),
                "SALARY {$period}",
                $employee?->emp_no ?? 'EMP',
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
