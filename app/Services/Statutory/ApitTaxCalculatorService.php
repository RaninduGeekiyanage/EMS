<?php

declare(strict_types=1);

namespace App\Services\Statutory;

use App\Models\ApitTaxSlab;
use Illuminate\Support\Collection;

final class ApitTaxCalculatorService
{
    /**
     * Default tax year for IRD compliance.
     */
    public const DEFAULT_TAX_YEAR = '2025/2026';

    /**
     * Calculate monthly APIT withholding based on monthly taxable income.
     * Projects annual income, evaluates progressive IRD tax slabs, and returns monthly deduction.
     *
     * @param float $monthlyTaxableIncome Total monthly taxable earnings
     * @param string|null $tenantId Optional tenant ULID for custom tax slab rules
     * @param string $taxYear Tax year identifier (default '2025/2026')
     * @return array{
     *     total_tax: float,
     *     annual_tax: float,
     *     annual_income: float,
     *     monthly_income: float,
     *     effective_tax_rate: float,
     *     slab_details: array<int, array<string, mixed>>
     * }
     */
    public function calculateMonthlyTax(
        float $monthlyTaxableIncome,
        ?string $tenantId = null,
        string $taxYear = self::DEFAULT_TAX_YEAR
    ): array {
        if ($monthlyTaxableIncome <= 0.0) {
            return [
                'total_tax' => 0.00,
                'annual_tax' => 0.00,
                'annual_income' => 0.00,
                'monthly_income' => 0.00,
                'effective_tax_rate' => 0.00,
                'slab_details' => [],
            ];
        }

        $annualIncome = round($monthlyTaxableIncome * 12.0, 2);
        $annualResult = $this->calculateAnnualTax($annualIncome, $tenantId, $taxYear);

        $monthlyTax = round($annualResult['annual_tax'] / 12.0, 2);

        return [
            'total_tax' => $monthlyTax,
            'annual_tax' => $annualResult['annual_tax'],
            'annual_income' => $annualIncome,
            'monthly_income' => round($monthlyTaxableIncome, 2),
            'effective_tax_rate' => $annualResult['effective_tax_rate'],
            'slab_details' => $annualResult['slab_details'],
        ];
    }

    /**
     * Calculate progressive APIT tax on annual taxable income.
     *
     * @param float $annualTaxableIncome Annual taxable income
     * @param string|null $tenantId Optional tenant ULID
     * @param string $taxYear Tax year identifier
     * @return array{
     *     annual_tax: float,
     *     annual_income: float,
     *     effective_tax_rate: float,
     *     slab_details: array<int, array<string, mixed>>
     * }
     */
    public function calculateAnnualTax(
        float $annualTaxableIncome,
        ?string $tenantId = null,
        string $taxYear = self::DEFAULT_TAX_YEAR
    ): array {
        if ($annualTaxableIncome <= 0.0) {
            return [
                'annual_tax' => 0.00,
                'annual_income' => 0.00,
                'effective_tax_rate' => 0.00,
                'slab_details' => [],
            ];
        }

        $slabs = $this->getSlabs($tenantId, $taxYear);
        $totalAnnualTax = 0.00;
        $slabDetails = [];

        foreach ($slabs as $slab) {
            $rawLower = (float) $slab->lower_limit;
            // Normalize boundary if seeded as 1200000.01 (representing first cent above threshold)
            $lower = round($rawLower - floor($rawLower), 2) === 0.01 ? floor($rawLower) : $rawLower;
            $upper = $slab->upper_limit !== null ? (float) $slab->upper_limit : null;
            $rate = (float) $slab->rate_percentage;

            if ($annualTaxableIncome > $lower) {
                $taxableInSlab = $upper !== null
                    ? min($annualTaxableIncome, $upper) - $lower
                    : $annualTaxableIncome - $lower;

                $slabTax = $taxableInSlab * ($rate / 100.0);
                $totalAnnualTax += $slabTax;

                $slabDetails[] = [
                    'order' => (int) $slab->slab_order,
                    'lower' => $lower,
                    'upper' => $upper,
                    'rate' => $rate,
                    'taxable_amount' => round($taxableInSlab, 2),
                    'tax_amount' => round($slabTax, 2),
                ];
            }
        }

        $effectiveRate = $annualTaxableIncome > 0.0
            ? round(($totalAnnualTax / $annualTaxableIncome) * 100.0, 2)
            : 0.00;

        return [
            'annual_tax' => round($totalAnnualTax, 2),
            'annual_income' => round($annualTaxableIncome, 2),
            'effective_tax_rate' => $effectiveRate,
            'slab_details' => $slabDetails,
        ];
    }

    /**
     * Retrieve tax slabs for tenant and tax year, with default IRD fallback.
     *
     * @return Collection<int, object>
     */
    public function getSlabs(?string $tenantId = null, string $taxYear = self::DEFAULT_TAX_YEAR): Collection
    {
        // Check for tenant-specific slabs first
        if ($tenantId !== null) {
            $tenantSlabs = ApitTaxSlab::query()
                ->where('tenant_id', $tenantId)
                ->where('tax_year', $taxYear)
                ->orderBy('slab_order', 'asc')
                ->get();

            if ($tenantSlabs->isNotEmpty()) {
                return $tenantSlabs;
            }
        }

        // Check global slabs in database
        $globalSlabs = ApitTaxSlab::query()
            ->whereNull('tenant_id')
            ->where('tax_year', $taxYear)
            ->orderBy('slab_order', 'asc')
            ->get();

        if ($globalSlabs->isNotEmpty()) {
            return $globalSlabs;
        }

        // Standard Sri Lanka IRD 2025/2026 progressive slab structure fallback:
        // First 1.2M tax-free, then 500k bands at 6%, 12%, 18%, 24%, 30%, excess at 36%
        return collect([
            (object) ['slab_order' => 1, 'lower_limit' => 0.00, 'upper_limit' => 1200000.00, 'rate_percentage' => 0.00],
            (object) ['slab_order' => 2, 'lower_limit' => 1200000.00, 'upper_limit' => 1700000.00, 'rate_percentage' => 6.00],
            (object) ['slab_order' => 3, 'lower_limit' => 1700000.00, 'upper_limit' => 2200000.00, 'rate_percentage' => 12.00],
            (object) ['slab_order' => 4, 'lower_limit' => 2200000.00, 'upper_limit' => 2700000.00, 'rate_percentage' => 18.00],
            (object) ['slab_order' => 5, 'lower_limit' => 2700000.00, 'upper_limit' => 3200000.00, 'rate_percentage' => 24.00],
            (object) ['slab_order' => 6, 'lower_limit' => 3200000.00, 'upper_limit' => 3700000.00, 'rate_percentage' => 30.00],
            (object) ['slab_order' => 7, 'lower_limit' => 3700000.00, 'upper_limit' => null, 'rate_percentage' => 36.00],
        ]);
    }
}
