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
        Schema::create('employee_evaluations', function (Blueprint $table): void {
            $table->ulid('id')->primary();
            $table->foreignUlid('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignUlid('employee_id')->constrained('employees')->cascadeOnDelete();
            $table->foreignId('evaluator_id')->constrained('users')->cascadeOnDelete();
            $table->string('evaluation_period', 50); // e.g., 'Annual 2026', 'Q1 2026', 'Probation', etc.
            $table->date('evaluation_date');
            $table->json('ratings_json'); // Structured criteria ratings, weights, scores, and specific remarks
            $table->decimal('overall_score', 5, 2); // Calculated weighted overall score (0.00 - 100.00)
            $table->string('performance_grade', 20)->nullable(); // e.g., 'A+', 'A', 'B', 'C', 'D'
            $table->text('hod_comments')->nullable();
            $table->foreignId('hr_reviewer_id')->nullable()->constrained('users')->nullOnDelete();
            $table->text('hr_comments')->nullable();
            $table->string('status', 20)->default('submitted_to_hr'); // 'draft', 'submitted_to_hr', 'confirmed_by_hr', 'rejected', 'archived'
            $table->boolean('is_bypassed_by_hr')->default(false);
            $table->dateTime('hr_actioned_at')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index('tenant_id', 'idx_eval_tenant');
            $table->index(['tenant_id', 'status'], 'idx_eval_status');
            $table->index(['tenant_id', 'employee_id'], 'idx_eval_emp');
            $table->index(['tenant_id', 'evaluation_period'], 'idx_eval_period');
            $table->index(['tenant_id', 'evaluation_date'], 'idx_eval_date');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('employee_evaluations');
    }
};
