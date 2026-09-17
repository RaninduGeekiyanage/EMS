<?php

declare(strict_types=1);

namespace Tests\Unit\Payroll;

use App\Models\ApitTaxSlab;
use App\Models\Tenant;
use App\Services\Statutory\ApitTaxCalculatorService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

final class ApitCalculationTest extends TestCase
{
    use RefreshDatabase;

    private ApitTaxCalculatorService $calculator;
    private Tenant $tenant;

    protected function setUp(): void
    {
        parent::setUp();

        $this->calculator = new ApitTaxCalculatorService();

        $this->tenant = Tenant::create([
            'name' => 'Colombo Capital PLC',
            'slug' => 'colombo-capital',
            'is_active' => true,
            'is_payroll_enabled' => true,
        ]);

        session(['tenant_id' => $this->tenant->id]);
        app()->instance('current_tenant_id', $this->tenant->id);
    }

    public function test_tax_free_threshold_monthly_and_annual(): void
    {
        // Monthly <= 100,000 (Annual <= 1,200,000) is completely tax exempt
        $resultUnder = $this->calculator->calculateMonthlyTax(75000.00);
        $this->assertEquals(0.00, $resultUnder['total_tax']);
        $this->assertEquals(0.00, $resultUnder['annual_tax']);
        $this->assertEquals(0.00, $resultUnder['effective_tax_rate']);

        // Exactly at relief threshold (100,000/mo = 1,200,000/yr)
        $resultExact = $this->calculator->calculateMonthlyTax(100000.00);
        $this->assertEquals(0.00, $resultExact['total_tax']);
        $this->assertEquals(0.00, $resultExact['annual_tax']);
    }

    public function test_first_taxable_slab_6_percent(): void
    {
        // Monthly 125,000 -> Annual 1,500,000
        // Relief: 1,200,000 @ 0%
        // Slab 2 (6%): 1,500,000 - 1,200,000 = 300,000 @ 6% = 18,000 annual
        // Monthly withholding: 18,000 / 12 = 1,500.00
        $result = $this->calculator->calculateMonthlyTax(125000.00);

        $this->assertEquals(1500.00, $result['total_tax']);
        $this->assertEquals(18000.00, $result['annual_tax']);
        $this->assertEquals(1500000.00, $result['annual_income']);
        $this->assertEquals(125000.00, $result['monthly_income']);
        $this->assertEquals(1.20, $result['effective_tax_rate']);

        // Verify slab details
        $this->assertNotEmpty($result['slab_details']);
        $slab2 = collect($result['slab_details'])->firstWhere('order', 2);
        $this->assertNotNull($slab2);
        $this->assertEquals(6.00, $slab2['rate']);
        $this->assertEquals(300000.00, $slab2['taxable_amount']);
        $this->assertEquals(18000.00, $slab2['tax_amount']);
    }

    public function test_progressive_tax_across_higher_slabs_up_to_36_percent(): void
    {
        // Monthly 350,000 -> Annual 4,200,000
        // Slabs breakdown:
        // Slab 1: 0 - 1.2M @ 0% = 0
        // Slab 2: 1.2M - 1.7M (500k) @ 6% = 30,000
        // Slab 3: 1.7M - 2.2M (500k) @ 12% = 60,000
        // Slab 4: 2.2M - 2.7M (500k) @ 18% = 90,000
        // Slab 5: 2.7M - 3.2M (500k) @ 24% = 120,000
        // Slab 6: 3.2M - 3.7M (500k) @ 30% = 150,000
        // Slab 7: > 3.7M (4.2M - 3.7M = 500k) @ 36% = 180,000
        // Total Annual = 30k + 60k + 90k + 120k + 150k + 180k = 630,000
        // Monthly Withholding = 630,000 / 12 = 52,500.00
        $result = $this->calculator->calculateMonthlyTax(350000.00);

        $this->assertEquals(52500.00, $result['total_tax']);
        $this->assertEquals(630000.00, $result['annual_tax']);
        $this->assertEquals(4200000.00, $result['annual_income']);
        $this->assertEquals(15.00, $result['effective_tax_rate']);
        $this->assertCount(7, $result['slab_details']);
    }

    public function test_exact_boundary_threshold(): void
    {
        // Annual exactly 1,700,000 (Boundary between 6% and 12% slabs)
        $result = $this->calculator->calculateAnnualTax(1700000.00);

        // Slab 2 maxed out: 500,000 @ 6% = 30,000
        // Slab 3 taxable = 0
        $this->assertEquals(3000000.00 / 100.0, $result['annual_tax']); // 30,000.00
        $this->assertEquals(30000.00, $result['annual_tax']);
    }

    public function test_custom_tenant_slabs_from_database(): void
    {
        // Create custom flat-tiered slabs for this tenant
        // First 600,000 @ 0%, next 600,000 @ 10%, excess @ 20%
        ApitTaxSlab::create([
            'tenant_id' => $this->tenant->id,
            'tax_year' => '2025/2026',
            'slab_order' => 1,
            'lower_limit' => 0.00,
            'upper_limit' => 600000.00,
            'rate_percentage' => 0.00,
        ]);
        ApitTaxSlab::create([
            'tenant_id' => $this->tenant->id,
            'tax_year' => '2025/2026',
            'slab_order' => 2,
            'lower_limit' => 600000.00,
            'upper_limit' => 1200000.00,
            'rate_percentage' => 10.00,
        ]);
        ApitTaxSlab::create([
            'tenant_id' => $this->tenant->id,
            'tax_year' => '2025/2026',
            'slab_order' => 3,
            'lower_limit' => 1200000.00,
            'upper_limit' => null,
            'rate_percentage' => 20.00,
        ]);

        // Annual income 1,500,000
        // Slab 1: 0 - 600k @ 0% = 0
        // Slab 2: 600k - 1.2M (600k) @ 10% = 60,000
        // Slab 3: 1.2M - 1.5M (300k) @ 20% = 60,000
        // Total = 120,000 annual => Monthly = 10,000.00
        $result = $this->calculator->calculateMonthlyTax(
            monthlyTaxableIncome: 125000.00,
            tenantId: $this->tenant->id
        );

        $this->assertEquals(10000.00, $result['total_tax']);
        $this->assertEquals(120000.00, $result['annual_tax']);
    }

    public function test_zero_and_negative_taxable_income(): void
    {
        $zeroResult = $this->calculator->calculateMonthlyTax(0.00);
        $this->assertEquals(0.00, $zeroResult['total_tax']);
        $this->assertEquals(0.00, $zeroResult['annual_tax']);
        $this->assertEmpty($zeroResult['slab_details']);

        $negativeResult = $this->calculator->calculateMonthlyTax(-25000.00);
        $this->assertEquals(0.00, $negativeResult['total_tax']);
        $this->assertEquals(0.00, $negativeResult['annual_tax']);
        $this->assertEmpty($negativeResult['slab_details']);
    }
}
