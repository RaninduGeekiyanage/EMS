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
        Schema::create('employee_loans', function (Blueprint $table): void {
            $table->ulid('id')->primary();
            $table->foreignUlid('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignUlid('employee_id')->constrained('employees')->cascadeOnDelete();
            $table->string('loan_reference_no', 50);
            $table->string('loan_title', 150);
            $table->decimal('principal_amount', 12, 2);
            $table->decimal('interest_rate_percentage', 5, 2)->default(0.00);
            $table->decimal('total_payable_amount', 12, 2);
            $table->decimal('monthly_installment', 12, 2);
            $table->unsignedInteger('installment_count');
            $table->date('disbursed_at');
            $table->date('deduction_start_month');
            $table->enum('status', ['pending', 'active', 'paused', 'completed', 'cancelled'])->default('active');
            $table->decimal('total_paid_amount', 12, 2)->default(0.00);
            $table->decimal('remaining_balance', 12, 2)->default(0.00);
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->unique(['tenant_id', 'loan_reference_no'], 'idx_loans_ref');
            $table->index(['tenant_id', 'employee_id', 'status'], 'idx_loans_emp_status');
        });

        Schema::create('employee_loan_installments', function (Blueprint $table): void {
            $table->ulid('id')->primary();
            $table->foreignUlid('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignUlid('employee_loan_id')->constrained('employee_loans')->cascadeOnDelete();
            $table->foreignUlid('payroll_run_id')->nullable()->constrained('payroll_runs')->nullOnDelete();
            $table->unsignedInteger('installment_number');
            $table->unsignedSmallInteger('due_year');
            $table->unsignedTinyInteger('due_month');
            $table->decimal('amount', 12, 2);
            $table->decimal('paid_amount', 12, 2)->default(0.00);
            $table->enum('status', ['scheduled', 'deducted', 'skipped', 'partially_paid'])->default('scheduled');
            $table->timestamp('deducted_at')->nullable();
            $table->string('remarks')->nullable();
            $table->timestamps();

            $table->index(['tenant_id', 'due_year', 'due_month', 'status'], 'idx_loan_inst_lookup');
            $table->index(['employee_loan_id', 'installment_number'], 'idx_loan_inst_loan');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('employee_loan_installments');
        Schema::dropIfExists('employee_loans');
    }
};
