<?php

declare(strict_types=1);

namespace App\Services\BankGenerators;

use App\Models\Company;
use App\Models\PayrollEmployee;
use App\Models\PayrollRun;
use Carbon\Carbon;
use Illuminate\Support\Collection;

final class BocGenerator implements BankGeneratorInterface
{
    public function getBankCode(): string
    {
        return 'boc';
    }

    public function getBankName(): string
    {
        return 'Bank of Ceylon';
    }

    public function getClearingCode(): string
    {
        return '7010';
    }

    public function getFileExtension(): string
    {
        return 'txt';
    }

    public function getMimeType(): string
    {
        return 'text/plain';
    }

    public function generate(PayrollRun $payrollRun, Collection $employees, array $options = []): string
    {
        $company = Company::where('tenant_id', $payrollRun->tenant_id)->first();
        $companyName = strtoupper(substr($company?->name ?? 'CEYLON MANUFACTURING', 0, 30));
        $companyAccount = substr((string) ($options['originating_account'] ?? '0000123456789'), 0, 15);
        $valueDate = Carbon::createFromDate($payrollRun->period_year, $payrollRun->period_month, 1)->endOfMonth()->format('Ymd');

        $totalCents = 0;
        $recordCount = 0;
        $detailLines = [];

        foreach ($employees as $employeeRecord) {
            $netPay = (float) $employeeRecord->net_pay;
            if ($netPay <= 0) {
                continue;
            }

            $bankInfo = $employeeRecord->employee?->bankInfo;
            $accountNo = preg_replace('/\D/', '', (string) ($bankInfo?->account_no ?? ''));
            if ($accountNo === '') {
                $accountNo = '0000000000';
            }

            $cents = (int) round($netPay * 100);
            $totalCents += $cents;
            $recordCount++;

            $destBank = str_pad(substr($bankInfo?->bank_code ?? '7010', 0, 4), 4, '0', STR_PAD_LEFT);
            $destBranch = str_pad(substr($bankInfo?->branch_name ?? '001', 0, 3), 3, '0', STR_PAD_LEFT);
            $destAccount = str_pad(substr($accountNo, 0, 15), 15, ' ', STR_PAD_RIGHT);
            $beneficiaryName = str_pad(strtoupper(substr($employeeRecord->employee?->full_name ?? 'STAFF', 0, 30)), 30, ' ', STR_PAD_RIGHT);
            $amountCents = str_pad((string) $cents, 12, '0', STR_PAD_LEFT);
            $empRef = str_pad(substr($employeeRecord->employee?->emp_no ?? 'EMP', 0, 15), 15, ' ', STR_PAD_RIGHT);
            $purpose = str_pad("SALARY {$payrollRun->period_year}" . str_pad((string) $payrollRun->period_month, 2, '0', STR_PAD_LEFT), 15, ' ', STR_PAD_RIGHT);

            // D (1) + Bank (4) + Branch (3) + Account (15) + Name (30) + Amount (12) + EmpRef (15) + Purpose (15)
            $detailLines[] = "D{$destBank}{$destBranch}{$destAccount}{$beneficiaryName}{$amountCents}{$empRef}{$purpose}";
        }

        // Header Record: H (1) + Account (15) + ValueDate (8) + BankCode (4) + TotalCents (12) + Count (6) + CompanyName (30)
        $headerAccount = str_pad($companyAccount, 15, ' ', STR_PAD_RIGHT);
        $headerTotalCents = str_pad((string) $totalCents, 12, '0', STR_PAD_LEFT);
        $headerCount = str_pad((string) $recordCount, 6, '0', STR_PAD_LEFT);
        $headerCompName = str_pad($companyName, 30, ' ', STR_PAD_RIGHT);

        $header = "H{$headerAccount}{$valueDate}7010{$headerTotalCents}{$headerCount}{$headerCompName}";

        // Trailer Record: T (1) + Count (6) + TotalCents (12) + Pad (40)
        $trailerPad = str_repeat(' ', 40);
        $trailer = "T{$headerCount}{$headerTotalCents}{$trailerPad}";

        return implode("\r\n", array_merge([$header], $detailLines, [$trailer])) . "\r\n";
    }
}
