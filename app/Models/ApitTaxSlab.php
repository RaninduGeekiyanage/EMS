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
     * Delegates to ApitTaxCalculatorService.
     *
     * @return array{total_tax: float, annual_tax: float, annual_income: float, slab_details: array<int, array<string, mixed>>}
     */
    public static function calculateMonthlyTax(float $monthlyTaxableIncome, ?string $tenantId = null, string $taxYear = '2025/2026'): array
    {
        return app(\App\Services\Statutory\ApitTaxCalculatorService::class)->calculateMonthlyTax(
            monthlyTaxableIncome: $monthlyTaxableIncome,
            tenantId: $tenantId,
            taxYear: $taxYear
        );
    }
}
