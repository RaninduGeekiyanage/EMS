<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

final class ApitTaxSlab extends Model
{
    use HasFactory, HasUlids, SoftDeletes;

    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = 'apit_tax_slabs';

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'tenant_id',
        'tax_year',
        'slab_order',
        'lower_limit',
        'upper_limit',
        'rate_percentage',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'slab_order' => 'integer',
            'lower_limit' => 'decimal:2',
            'upper_limit' => 'decimal:2',
            'rate_percentage' => 'decimal:2',
        ];
    }

    /**
     * Calculate monthly APIT tax using progressive annual IRD slabs projected monthly.
     *
     * @return array{total_tax: float, annual_tax: float, annual_income: float, slab_details: array<int, array<string, mixed>>}
     */
    public static function calculateMonthlyTax(float $monthlyTaxableIncome, ?string $tenantId = null, string $taxYear = '2025/2026'): array
    {
        if ($monthlyTaxableIncome <= 0.0) {
            return [
                'total_tax' => 0.00,
                'annual_tax' => 0.00,
                'annual_income' => 0.00,
                'slab_details' => [],
            ];
        }

        $annualIncome = $monthlyTaxableIncome * 12;

        // Fetch tenant slabs if customized, otherwise fallback to global slabs
        $slabs = self::query()
            ->where(function ($query) use ($tenantId): void {
                if ($tenantId !== null) {
                    $query->where('tenant_id', $tenantId)->orWhereNull('tenant_id');
                } else {
                    $query->whereNull('tenant_id');
                }
            })
            ->where('tax_year', $taxYear)
            ->orderBy('slab_order', 'asc')
            ->get();

        // Fallback default slabs if none in DB
        if ($slabs->isEmpty()) {
            $slabs = collect([
                (object) ['slab_order' => 1, 'lower_limit' => 0.00, 'upper_limit' => 1200000.00, 'rate_percentage' => 0.00],
                (object) ['slab_order' => 2, 'lower_limit' => 1200000.00, 'upper_limit' => 1700000.00, 'rate_percentage' => 6.00],
                (object) ['slab_order' => 3, 'lower_limit' => 1700000.00, 'upper_limit' => 2200000.00, 'rate_percentage' => 12.00],
                (object) ['slab_order' => 4, 'lower_limit' => 2200000.00, 'upper_limit' => 2700000.00, 'rate_percentage' => 18.00],
                (object) ['slab_order' => 5, 'lower_limit' => 2700000.00, 'upper_limit' => 3200000.00, 'rate_percentage' => 24.00],
                (object) ['slab_order' => 6, 'lower_limit' => 3200000.00, 'upper_limit' => 3700000.00, 'rate_percentage' => 30.00],
                (object) ['slab_order' => 7, 'lower_limit' => 3700000.00, 'upper_limit' => null, 'rate_percentage' => 36.00],
            ]);
        }

        $totalAnnualTax = 0.00;
        $slabDetails = [];

        foreach ($slabs as $slab) {
            $lower = (float) $slab->lower_limit;
            $upper = $slab->upper_limit !== null ? (float) $slab->upper_limit : null;
            $rate = (float) $slab->rate_percentage;

            if ($annualIncome > $lower) {
                $taxableInSlab = $upper !== null
                    ? min($annualIncome, $upper) - $lower
                    : $annualIncome - $lower;

                $slabTax = $taxableInSlab * ($rate / 100.0);
                $totalAnnualTax += $slabTax;

                $slabDetails[] = [
                    'order' => $slab->slab_order,
                    'lower' => $lower,
                    'upper' => $upper,
                    'rate' => $rate,
                    'taxable_amount' => round($taxableInSlab, 2),
                    'tax_amount' => round($slabTax, 2),
                ];
            }
        }

        $monthlyTax = round($totalAnnualTax / 12.0, 2);

        return [
            'total_tax' => $monthlyTax,
            'annual_tax' => round($totalAnnualTax, 2),
            'annual_income' => round($annualIncome, 2),
            'slab_details' => $slabDetails,
        ];
    }
}
