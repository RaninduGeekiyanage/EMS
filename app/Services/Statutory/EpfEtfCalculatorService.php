<?php

declare(strict_types=1);

namespace App\Services\Statutory;

use App\Models\Employee;
use App\Models\Tenant;

final class EpfEtfCalculatorService
{
    /**
     * Default statutory contribution percentages in Sri Lanka.
     */
    public const DEFAULT_EPF_EMPLOYEE_RATE = 8.00;
    public const DEFAULT_EPF_EMPLOYER_RATE = 12.00;
    public const DEFAULT_ETF_EMPLOYER_RATE = 3.00;

    /**
     * Calculate EPF and ETF contributions based on earnings and statutory parameters.
     *
     * @param float $epfEligibleEarnings Base earnings subject to EPF (Basic + COLA / earned basic)
     * @param float $grossPay Total gross compensation subject to ETF
     * @param bool $isCompanyEpfEnabled Whether EPF is enabled at tenant level
     * @param bool $isEmployeeEpfMember Whether the employee is an active EPF fund member
     * @param Tenant|null $tenant Optional tenant instance to read dynamic rates
     * @param float|null $employeeRateOverride Optional explicit employee EPF rate override (%)
     * @param float|null $employerEpfRateOverride Optional explicit employer EPF rate override (%)
     * @param float|null $etfRateOverride Optional explicit employer ETF rate override (%)
     * @return array{
     *     is_company_epf_enabled: bool,
     *     is_employee_epf_member: bool,
     *     is_epf_eligible: bool,
     *     epf_eligible_earnings: float,
     *     epf_employee_rate: float,
     *     epf_employee: float,
     *     epf_employer_rate: float,
     *     epf_employer: float,
     *     total_epf: float,
     *     etf_employer_rate: float,
     *     etf_employer: float,
     *     total_statutory: float
     * }
     */
    public function calculate(
        float $epfEligibleEarnings,
        float $grossPay,
        bool $isCompanyEpfEnabled = true,
        bool $isEmployeeEpfMember = true,
        ?Tenant $tenant = null,
        ?float $employeeRateOverride = null,
        ?float $employerEpfRateOverride = null,
        ?float $etfRateOverride = null
    ): array {
        // Resolve tenant level toggle if tenant provided and not explicitly passed
        if ($tenant !== null && func_num_args() < 3) {
            $isCompanyEpfEnabled = (bool) $tenant->getSetting('epf_enabled', true);
        }

        // Determine effective rates
        $employeeRate = $employeeRateOverride
            ?? ($tenant ? (float) $tenant->getSetting('epf_employee_rate', self::DEFAULT_EPF_EMPLOYEE_RATE) : self::DEFAULT_EPF_EMPLOYEE_RATE);

        $employerEpfRate = $employerEpfRateOverride
            ?? ($tenant ? (float) $tenant->getSetting('epf_employer_rate', self::DEFAULT_EPF_EMPLOYER_RATE) : self::DEFAULT_EPF_EMPLOYER_RATE);

        $etfRate = $etfRateOverride
            ?? ($tenant ? (float) $tenant->getSetting('etf_employer_rate', self::DEFAULT_ETF_EMPLOYER_RATE) : self::DEFAULT_ETF_EMPLOYER_RATE);

        $isEligible = $isCompanyEpfEnabled && $isEmployeeEpfMember;

        $epfEligibleEarnings = max(0.00, round($epfEligibleEarnings, 2));
        $grossPay = max(0.00, round($grossPay, 2));

        if (! $isEligible || $epfEligibleEarnings <= 0.00) {
            $etfAmount = 0.00;
            // If EPF is disabled or not eligible, ETF is also waived in standard payroll setups
            if ($isEligible && $grossPay > 0.00 && $epfEligibleEarnings <= 0.00) {
                $etfAmount = round($grossPay * ($etfRate / 100.0), 2);
            }

            return [
                'is_company_epf_enabled' => $isCompanyEpfEnabled,
                'is_employee_epf_member' => $isEmployeeEpfMember,
                'is_epf_eligible' => $isEligible,
                'epf_eligible_earnings' => $epfEligibleEarnings,
                'epf_employee_rate' => $employeeRate,
                'epf_employee' => 0.00,
                'epf_employer_rate' => $employerEpfRate,
                'epf_employer' => 0.00,
                'total_epf' => 0.00,
                'etf_employer_rate' => $etfRate,
                'etf_employer' => $etfAmount,
                'total_statutory' => $etfAmount,
            ];
        }

        $epfEmployee = round($epfEligibleEarnings * ($employeeRate / 100.0), 2);
        $epfEmployer = round($epfEligibleEarnings * ($employerEpfRate / 100.0), 2);
        $totalEpf = round($epfEmployee + $epfEmployer, 2);

        $etfEmployer = round($grossPay * ($etfRate / 100.0), 2);
        $totalStatutory = round($totalEpf + $etfEmployer, 2);

        return [
            'is_company_epf_enabled' => $isCompanyEpfEnabled,
            'is_employee_epf_member' => $isEmployeeEpfMember,
            'is_epf_eligible' => true,
            'epf_eligible_earnings' => $epfEligibleEarnings,
            'epf_employee_rate' => $employeeRate,
            'epf_employee' => $epfEmployee,
            'epf_employer_rate' => $employerEpfRate,
            'epf_employer' => $epfEmployer,
            'total_epf' => $totalEpf,
            'etf_employer_rate' => $etfRate,
            'etf_employer' => $etfEmployer,
            'total_statutory' => $totalStatutory,
        ];
    }

    /**
     * Convenience method to compute statutory contributions for an Employee model.
     *
     * @return array<string, mixed>
     */
    public function calculateForEmployee(
        Employee $employee,
        float $epfEligibleEarnings,
        float $grossPay,
        ?Tenant $tenant = null
    ): array {
        $tenant = $tenant ?? $employee->tenant;
        $isCompanyEpfEnabled = $tenant ? (bool) $tenant->getSetting('epf_enabled', true) : true;
        $isEmployeeEpfMember = (bool) ($employee->epfInfo?->is_epf_member ?? true);

        return $this->calculate(
            epfEligibleEarnings: $epfEligibleEarnings,
            grossPay: $grossPay,
            isCompanyEpfEnabled: $isCompanyEpfEnabled,
            isEmployeeEpfMember: $isEmployeeEpfMember,
            tenant: $tenant
        );
    }
}
