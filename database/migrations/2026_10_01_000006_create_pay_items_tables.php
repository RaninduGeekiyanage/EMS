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
        Schema::create('pay_items', function (Blueprint $table): void {
            $table->ulid('id')->primary();
            $table->foreignUlid('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->string('code', 50);
            $table->string('name', 150);
            $table->enum('item_type', ['earning', 'deduction'])->default('earning');
            $table->enum('calculation_type', ['fixed', 'percentage_of_basic', 'formula'])->default('fixed');
            $table->decimal('default_amount', 12, 2)->default(0.00);
            $table->decimal('percentage', 5, 2)->nullable();
            $table->boolean('is_epf_eligible')->default(false);
            $table->boolean('is_etf_eligible')->default(false);
            $table->boolean('is_taxable')->default(false);
            $table->boolean('is_active')->default(true);
            $table->boolean('is_system_reserved')->default(false);
            $table->unsignedInteger('display_order')->default(0);
            $table->text('description')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->unique(['tenant_id', 'code'], 'idx_pay_items_code');
            $table->index(['tenant_id', 'item_type', 'is_active'], 'idx_pay_items_tenant_type');
        });

        Schema::create('employee_pay_items', function (Blueprint $table): void {
            $table->ulid('id')->primary();
            $table->foreignUlid('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignUlid('employee_id')->constrained('employees')->cascadeOnDelete();
            $table->foreignUlid('pay_item_id')->constrained('pay_items')->cascadeOnDelete();
            $table->decimal('amount', 12, 2);
            $table->date('effective_from');
            $table->date('effective_to')->nullable();
            $table->boolean('is_active')->default(true);
            $table->string('remarks')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['tenant_id', 'employee_id', 'pay_item_id'], 'idx_emp_pay_items_lookup');
            $table->index(['tenant_id', 'is_active', 'effective_from'], 'idx_emp_pay_items_active');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('employee_pay_items');
        Schema::dropIfExists('pay_items');
    }
};
