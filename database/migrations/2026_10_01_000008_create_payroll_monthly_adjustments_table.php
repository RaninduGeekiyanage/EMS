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
        Schema::create('payroll_monthly_adjustments', function (Blueprint $table): void {
            $table->ulid('id')->primary();
            $table->foreignUlid('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignUlid('employee_id')->constrained('employees')->cascadeOnDelete();
            $table->foreignUlid('pay_item_id')->nullable()->constrained('pay_items')->nullOnDelete();
            $table->unsignedSmallInteger('period_year');
            $table->unsignedTinyInteger('period_month');
            $table->enum('entry_type', ['addition', 'deduction'])->default('addition');
            $table->string('title', 150);
            $table->decimal('amount', 12, 2);
            $table->boolean('is_epf_eligible')->default(false);
            $table->boolean('is_etf_eligible')->default(false);
            $table->boolean('is_taxable')->default(false);
            $table->enum('status', ['pending', 'approved', 'rejected', 'processed'])->default('approved');
            $table->text('remarks')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['tenant_id', 'period_year', 'period_month', 'status'], 'idx_pma_tenant_period');
            $table->index(['tenant_id', 'employee_id', 'period_year', 'period_month'], 'idx_pma_emp_period');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('payroll_monthly_adjustments');
    }
};
