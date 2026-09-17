<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\Company;
use App\Models\PayrollEmployee;
use App\Models\PayrollRun;
use Barryvdh\DomPDF\Facade\Pdf;
use Barryvdh\DomPDF\PDF as DomPdfWrapper;
use Illuminate\Support\Collection;

final class PayslipGeneratorService
{
    /**
     * Generate a PDF instance for an individual employee's payslip.
     */
    public function generate(PayrollEmployee $payrollEmployee): DomPdfWrapper
    {
        $data = $this->buildPayslipData($payrollEmployee);

        /** @var DomPdfWrapper $pdf */
        $pdf = Pdf::loadView('pdf.payslip', [
            'payslip' => $data,
        ]);

        $pdf->setPaper('a4', 'portrait');
        $pdf->setOption('isHtml5ParserEnabled', true);
        $pdf->setOption('isRemoteEnabled', true);

        return $pdf;
    }

    /**
     * Generate a multi-page PDF instance for all employees in a payroll run.
     */
    public function generateBulk(PayrollRun $payrollRun, ?string $departmentId = null): DomPdfWrapper
    {
        $query = $payrollRun->payrollEmployees()
            ->with([
                'employee:id,emp_no,nic,full_name,email,department_id,designation_id',
                'employee.department:id,name',
                'employee.designation:id,title',
                'employee.bankInfo',
                'employee.epfInfo',
                'payrollRun',
            ]);

        if (! empty($departmentId)) {
            $query->whereHas('employee', function ($q) use ($departmentId): void {
                $q->where('department_id', $departmentId);
            });
        }

        $records = $query->get();

        $company = Company::query()
            ->where('tenant_id', $payrollRun->tenant_id)
            ->first();

        $payslips = $records->map(function (PayrollEmployee $item) use ($company): array {
            return $this->formatPayslipItem($item, $company);
        })->all();

        /** @var DomPdfWrapper $pdf */
        $pdf = Pdf::loadView('pdf.payslip', [
            'payslips' => $payslips,
        ]);

        $pdf->setPaper('a4', 'portrait');
        $pdf->setOption('isHtml5ParserEnabled', true);
        $pdf->setOption('isRemoteEnabled', true);

        return $pdf;
    }

    /**
     * Prepare structured data for an individual payslip.
     *
     * @return array<string, mixed>
     */
    public function buildPayslipData(PayrollEmployee $payrollEmployee): array
    {
        $payrollEmployee->loadMissing([
            'employee:id,emp_no,nic,full_name,email,department_id,designation_id',
            'employee.department:id,name',
            'employee.designation:id,title',
            'employee.bankInfo',
            'employee.epfInfo',
            'payrollRun',
        ]);

        $company = Company::query()
            ->where('tenant_id', $payrollEmployee->tenant_id)
            ->first();

        return $this->formatPayslipItem($payrollEmployee, $company);
    }

    /**
     * Format a single PayrollEmployee item into presentation structure.
     *
     * @return array<string, mixed>
     */
    private function formatPayslipItem(PayrollEmployee $payrollEmployee, ?Company $company): array
    {
        $employee = $payrollEmployee->employee;
        $run = $payrollEmployee->payrollRun;
        $bankInfo = $employee?->bankInfo;
        $epfInfo = $employee?->epfInfo;

        $rawAccount = (string) ($bankInfo?->account_no ?? '');
        $maskedAccount = $this->maskAccountNumber($rawAccount);

        $totalDeductions = (float) $payrollEmployee->no_pay_deduction
            + (float) $payrollEmployee->epf_employee
            + (float) $payrollEmployee->apit_tax
            + (float) $payrollEmployee->other_deductions;

        return [
            'company' => [
                'name' => $company?->name ?? 'Ceylon Manufacturing PLC',
                'br_number' => $company?->br_number ?? 'PV-987654',
                'epf_number' => $company?->epf_number ?? 'C-104928',
                'address' => $company?->address ?? '100 Galle Road, Colombo 03, Sri Lanka',
                'phone' => $company?->phone ?? '+94 11 234 5678',
                'email' => $company?->email ?? 'hr@ceylonmfg.com',
                'logo_url' => $company?->logo_path ?? null,
            ],
            'run' => [
                'period_label' => $run?->period_label ?? date('F Y'),
                'period_year' => $run?->period_year ?? (int) date('Y'),
                'period_month' => $run?->period_month ?? (int) date('m'),
                'status' => $run?->status ?? 'approved',
            ],
            'employee' => [
                'id' => $payrollEmployee->id,
                'emp_no' => $employee?->emp_no ?? 'N/A',
                'full_name' => $employee?->full_name ?? 'N/A',
                'nic' => $employee?->nic ?? 'N/A',
                'department' => $employee?->department?->name ?? 'General',
                'designation' => $employee?->designation?->title ?? 'Executive',
                'epf_no' => $epfInfo?->epf_no ?? $employee?->emp_no ?? 'N/A',
                'payment_mode' => $payrollEmployee->payment_mode,
                'bank_name' => $bankInfo?->bank_name ?? 'Bank Remittance',
                'branch_name' => $bankInfo?->branch_name ?? 'Head Office',
                'masked_account_no' => $maskedAccount,
                'worked_days' => (float) $payrollEmployee->worked_days,
                'no_pay_days' => (float) $payrollEmployee->no_pay_days,
                'ot_hours' => (float) $payrollEmployee->ot_hours,
                'double_ot_hours' => (float) $payrollEmployee->double_ot_hours,
            ],
            'earnings' => [
                'basic_salary' => (float) $payrollEmployee->basic_salary,
                'ot_pay' => (float) $payrollEmployee->ot_pay,
                'allowances' => (float) $payrollEmployee->allowances,
                'incentives' => 0.00,
                'gross_pay' => (float) $payrollEmployee->gross_pay,
            ],
            'deductions' => [
                'no_pay_deduction' => (float) $payrollEmployee->no_pay_deduction,
                'epf_employee' => (float) $payrollEmployee->epf_employee,
                'apit_tax' => (float) $payrollEmployee->apit_tax,
                'other_deductions' => (float) $payrollEmployee->other_deductions,
                'total_deductions' => $totalDeductions,
            ],
            'net_pay' => (float) $payrollEmployee->net_pay,
            'statutory' => [
                'epf_eligible_earnings' => (float) $payrollEmployee->epf_eligible_earnings,
                'epf_employer' => (float) $payrollEmployee->epf_employer,
                'etf_employer' => (float) $payrollEmployee->etf_employer,
            ],
        ];
    }

    /**
     * Mask bank account numbers, revealing only the trailing digits for confidentiality.
     */
    private function maskAccountNumber(string $accountNumber): string
    {
        $accountNumber = trim($accountNumber);
        if ($accountNumber === '') {
            return 'N/A';
        }

        $length = strlen($accountNumber);
        if ($length <= 4) {
            return str_repeat('*', $length);
        }

        $visiblePart = substr($accountNumber, -4);
        $maskedPart = str_repeat('*', min(8, $length - 4));

        return $maskedPart . ' ' . $visiblePart;
    }
}
