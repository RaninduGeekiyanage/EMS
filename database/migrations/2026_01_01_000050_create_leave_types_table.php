<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('leave_types', function (Blueprint $table): void {
            $table->ulid('id')->primary();
            $table->foreignUlid('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->string('name', 100);
            $table->string('code', 50); // ANNUAL, CASUAL, MEDICAL, MATERNITY, NO_PAY, SPECIAL
            $table->decimal('days_per_year', 5, 2)->default(0.00);
            $table->boolean('is_paid')->default(true);
            $table->boolean('carry_forward_allowed')->default(false);
            $table->decimal('max_carry_forward_days', 5, 2)->default(0.00);
            $table->unsignedSmallInteger('max_consecutive_days')->nullable();
            $table->boolean('requires_attachment')->default(false);
            $table->string('color', 20)->nullable();
            $table->text('description')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->softDeletes();

            $table->unique(['tenant_id', 'code']);
            $table->index('tenant_id');
            $table->index(['tenant_id', 'is_active']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('leave_types');
    }
};
