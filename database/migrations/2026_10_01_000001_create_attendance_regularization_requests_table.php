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
        Schema::create('attendance_regularization_requests', function (Blueprint $table): void {
            $table->ulid('id')->primary();
            $table->foreignUlid('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignUlid('employee_id')->constrained('employees')->cascadeOnDelete();
            $table->date('attendance_date');
            $table->string('request_type', 30); // missing_punch, unapproved_half_day, on_duty_gate_pass, overtime_claim
            $table->dateTime('requested_check_in')->nullable();
            $table->dateTime('requested_check_out')->nullable();
            $table->text('reason');
            $table->string('attachment_path', 255)->nullable();
            $table->string('status', 20)->default('pending_hod'); // pending_hod, pending_hr, approved, rejected, cancelled
            $table->foreignId('hod_id')->nullable()->constrained('users')->nullOnDelete();
            $table->dateTime('hod_actioned_at')->nullable();
            $table->text('hod_remarks')->nullable();
            $table->foreignId('hr_id')->nullable()->constrained('users')->nullOnDelete();
            $table->dateTime('hr_actioned_at')->nullable();
            $table->boolean('is_bypassed_by_hr')->default(false);
            $table->text('rejection_reason')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index('tenant_id', 'idx_reg_tenant');
            $table->index(['tenant_id', 'status'], 'idx_reg_status');
            $table->index(['tenant_id', 'attendance_date'], 'idx_reg_date');
            $table->index(['tenant_id', 'employee_id', 'attendance_date'], 'idx_reg_emp_date');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('attendance_regularization_requests');
    }
};
