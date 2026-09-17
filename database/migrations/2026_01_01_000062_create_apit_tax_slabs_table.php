<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('apit_tax_slabs', function (Blueprint $table): void {
            $table->ulid('id')->primary();
            $table->foreignUlid('tenant_id')->nullable()->constrained('tenants')->cascadeOnDelete();
            $table->string('tax_year', 20)->default('2025/2026');
            $table->unsignedSmallInteger('slab_order')->default(1);
            $table->decimal('lower_limit', 12, 2)->default(0.00);
            $table->decimal('upper_limit', 12, 2)->nullable();
            $table->decimal('rate_percentage', 5, 2)->default(0.00);
            $table->timestamps();
            $table->softDeletes();

            $table->index('tenant_id');
            $table->index(['tenant_id', 'tax_year']);
        });

        // Seed default Sri Lankan Inland Revenue Department (IRD) APIT Tax Slabs
        $now = now();
        $slabs = [
            ['slab_order' => 1, 'lower_limit' => 0.00, 'upper_limit' => 1200000.00, 'rate_percentage' => 0.00],
            ['slab_order' => 2, 'lower_limit' => 1200000.01, 'upper_limit' => 1700000.00, 'rate_percentage' => 6.00],
            ['slab_order' => 3, 'lower_limit' => 1700000.01, 'upper_limit' => 2200000.00, 'rate_percentage' => 12.00],
            ['slab_order' => 4, 'lower_limit' => 2200000.01, 'upper_limit' => 2700000.00, 'rate_percentage' => 18.00],
            ['slab_order' => 5, 'lower_limit' => 2700000.01, 'upper_limit' => 3200000.00, 'rate_percentage' => 24.00],
            ['slab_order' => 6, 'lower_limit' => 3200000.01, 'upper_limit' => 3700000.00, 'rate_percentage' => 30.00],
            ['slab_order' => 7, 'lower_limit' => 3700000.01, 'upper_limit' => null, 'rate_percentage' => 36.00],
        ];

        foreach ($slabs as $slab) {
            DB::table('apit_tax_slabs')->insert([
                'id' => (string) Str::ulid(),
                'tenant_id' => null, // Global default
                'tax_year' => '2025/2026',
                'slab_order' => $slab['slab_order'],
                'lower_limit' => $slab['lower_limit'],
                'upper_limit' => $slab['upper_limit'],
                'rate_percentage' => $slab['rate_percentage'],
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('apit_tax_slabs');
    }
};
