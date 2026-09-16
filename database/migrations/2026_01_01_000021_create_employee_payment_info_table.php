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
        Schema::create('employee_payment_info', function (Blueprint $table): void {
            $table->ulid('id')->primary();
            $table->foreignUlid('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignUlid('employee_id')->constrained('employees')->cascadeOnDelete();
            $table->string('payment_mode', 50)->default('monthly'); // monthly, daily, hourly
            $table->decimal('basic_salary', 12, 2)->default(0.00);
            $table->decimal('daily_rate', 12, 2)->default(0.00);
            $table->decimal('hourly_rate', 12, 2)->default(0.00);
            $table->date('effective_date')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index('tenant_id');
            $table->index(['tenant_id', 'employee_id']);
            $table->index(['tenant_id', 'payment_mode']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('employee_payment_info');
    }
};
