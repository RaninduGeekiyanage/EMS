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
        Schema::create('payroll_employees', function (Blueprint $table): void {
            $table->ulid('id')->primary();
            $table->foreignUlid('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignUlid('payroll_run_id')->constrained('payroll_runs')->cascadeOnDelete();
            $table->foreignUlid('employee_id')->constrained('employees')->cascadeOnDelete();
            $table->string('payment_mode', 30)->default('monthly'); // monthly, daily, hourly
            $table->string('employment_type', 50)->default('permanent'); // permanent, probation, contract, casual, intern
            $table->string('labor_act', 50)->default('shop_and_office'); // shop_and_office, wages_board
            $table->foreignUlid('wages_board_category_id')->nullable()->constrained('wages_board_categories')->nullOnDelete();
            $table->boolean('is_epf_eligible')->default(true);
            $table->decimal('worked_days', 5, 2)->default(0.00);
            $table->decimal('no_pay_days', 5, 2)->default(0.00);
            $table->decimal('ot_hours', 6, 2)->default(0.00);
            $table->decimal('double_ot_hours', 6, 2)->default(0.00);
            $table->decimal('basic_salary', 12, 2)->default(0.00);
            $table->decimal('hourly_rate', 12, 2)->default(0.00);
            $table->decimal('ot_pay', 12, 2)->default(0.00);
            $table->decimal('allowances', 12, 2)->default(0.00);
            $table->decimal('no_pay_deduction', 12, 2)->default(0.00);
            $table->decimal('gross_pay', 12, 2)->default(0.00);
            $table->decimal('epf_eligible_earnings', 12, 2)->default(0.00);
            $table->decimal('epf_employee', 12, 2)->default(0.00); // 8%
            $table->decimal('epf_employer', 12, 2)->default(0.00); // 12%
            $table->decimal('etf_employer', 12, 2)->default(0.00); // 3%
            $table->decimal('apit_tax', 12, 2)->default(0.00);
            $table->decimal('other_deductions', 12, 2)->default(0.00);
            $table->decimal('net_pay', 12, 2)->default(0.00);
            $table->json('breakdown_json')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->unique(['tenant_id', 'payroll_run_id', 'employee_id']);
            $table->index('tenant_id');
            $table->index(['tenant_id', 'payroll_run_id']);
            $table->index(['tenant_id', 'employee_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('payroll_employees');
    }
};
