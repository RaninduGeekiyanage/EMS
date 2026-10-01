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
        Schema::create('compensatory_leave_records', function (Blueprint $table): void {
            $table->ulid('id')->primary();
            $table->foreignUlid('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignUlid('employee_id')->constrained('employees')->cascadeOnDelete();
            $table->date('earned_date');
            $table->decimal('earned_days', 4, 2)->default(1.00);
            $table->decimal('used_days', 4, 2)->default(0.00);
            $table->decimal('remaining_days', 4, 2)->default(1.00);
            $table->date('expires_at');
            $table->string('status', 20)->default('available'); // available, used, expired
            $table->text('reason');
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignUlid('leave_request_id')->nullable()->constrained('leave_requests')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();

            $table->index('tenant_id', 'idx_clr_tenant');
            $table->index(['tenant_id', 'employee_id', 'status'], 'idx_clr_emp_status');
            $table->index(['tenant_id', 'expires_at'], 'idx_clr_expires');
            $table->index(['tenant_id', 'earned_date'], 'idx_clr_earned');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('compensatory_leave_records');
    }
};
