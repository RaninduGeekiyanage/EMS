<?php

declare(strict_types=1);

namespace App\Services\BankGenerators;

use App\Models\PayrollEmployee;
use App\Models\PayrollRun;
use Carbon\Carbon;
use Illuminate\Support\Collection;

final class NsbGenerator implements BankGeneratorInterface
{
    public function getBankCode(): string
    {
        return 'nsb';
    }

    public function getBankName(): string
    {
        return 'National Savings Bank (NSB)';
    }

    public function getClearingCode(): string
    {
        return '7719';
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
            'Emp No',
            'Beneficiary Name',
            'Bank Code',
            'Branch Code',
            'Account Number',
            'Amount',
            'Value Date',
        ];

        $valueDate = Carbon::createFromDate($payrollRun->period_year, $payrollRun->period_month, 1)->endOfMonth()->format('Ymd');

        foreach ($employees as $employeeRecord) {
            $netPay = (float) $employeeRecord->net_pay;
            if ($netPay <= 0) {
                continue;
            }

            $employee = $employeeRecord->employee;
            $bankInfo = $employee?->bankInfo;
            $accountNo = preg_replace('/\D/', '', (string) ($bankInfo?->account_no ?? ''));

            $rows[] = [
                $employee?->emp_no ?? 'EMP',
                $employee?->full_name ?? 'Employee',
                $bankInfo?->bank_code ?: '7719',
                $bankInfo?->branch_name ?: '001',
                $accountNo ?: '0000000000',
                number_format($netPay, 2, '.', ''),
                $valueDate,
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
