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
        Schema::create('payroll_runs', function (Blueprint $table): void {
            $table->ulid('id')->primary();
            $table->foreignUlid('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->unsignedSmallInteger('period_year');
            $table->unsignedTinyInteger('period_month'); // 1 to 12
            $table->string('status', 30)->default('draft'); // draft, processing, approved, locked
            $table->decimal('total_gross', 14, 2)->default(0.00);
            $table->decimal('total_net', 14, 2)->default(0.00);
            $table->decimal('total_epf_employee', 14, 2)->default(0.00); // 8%
            $table->decimal('total_epf_employer', 14, 2)->default(0.00); // 12%
            $table->decimal('total_etf', 14, 2)->default(0.00); // 3%
            $table->decimal('total_apit', 14, 2)->default(0.00);
            $table->decimal('total_deductions', 14, 2)->default(0.00);
            $table->unsignedInteger('employee_count')->default(0);
            $table->foreignId('run_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('approved_at')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->unique(['tenant_id', 'period_year', 'period_month']);
            $table->index('tenant_id');
            $table->index(['tenant_id', 'status']);
            $table->index(['tenant_id', 'period_year', 'period_month']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('payroll_runs');
    }
};
