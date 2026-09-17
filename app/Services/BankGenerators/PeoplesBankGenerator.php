<?php

declare(strict_types=1);

namespace App\Services\BankGenerators;

use App\Models\PayrollEmployee;
use App\Models\PayrollRun;
use Carbon\Carbon;
use Illuminate\Support\Collection;

final class PeoplesBankGenerator implements BankGeneratorInterface
{
    public function getBankCode(): string
    {
        return 'peoples';
    }

    public function getBankName(): string
    {
        return "People's Bank";
    }

    public function getClearingCode(): string
    {
        return '7135';
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
            'Seq No',
            'Beneficiary Name',
            'Bank Code',
            'Branch Code',
            'Account Number',
            'Amount',
            'Payment Purpose',
            'Value Date',
        ];

        $valueDate = Carbon::createFromDate($payrollRun->period_year, $payrollRun->period_month, 1)->endOfMonth()->format('d/m/Y');
        $period = sprintf('%04d-%02d', $payrollRun->period_year, $payrollRun->period_month);
        $seq = 1;

        foreach ($employees as $employeeRecord) {
            $netPay = (float) $employeeRecord->net_pay;
            if ($netPay <= 0) {
                continue;
            }

            $employee = $employeeRecord->employee;
            $bankInfo = $employee?->bankInfo;
            $accountNo = preg_replace('/\D/', '', (string) ($bankInfo?->account_no ?? ''));

            $rows[] = [
                (string) $seq++,
                strtoupper($employee?->full_name ?? 'EMPLOYEE'),
                $bankInfo?->bank_code ?: '7135',
                $bankInfo?->branch_name ?: '001',
                $accountNo ?: '0000000000',
                number_format($netPay, 2, '.', ''),
                "SALARY {$period}",
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
