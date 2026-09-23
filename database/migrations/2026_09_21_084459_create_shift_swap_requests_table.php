<?php

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
        Schema::create('shift_swap_requests', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->ulid('tenant_id');
            $table->ulid('department_id')->nullable();
            $table->ulid('requesting_employee_id');
            $table->ulid('target_employee_id');
            $table->date('shift_date');
            $table->ulid('requesting_shift_id')->nullable();
            $table->ulid('target_shift_id')->nullable();
            $table->text('reason')->nullable();
            $table->enum('target_status', ['pending', 'accepted', 'rejected'])->default('pending');
            $table->enum('status', ['pending', 'approved', 'rejected', 'cancelled'])->default('pending');
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('approved_at')->nullable();
            $table->text('admin_notes')->nullable();
            $table->timestamps();

            $table->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnDelete();
            $table->foreign('department_id')->references('id')->on('departments')->nullOnDelete();
            $table->foreign('requesting_employee_id')->references('id')->on('employees')->cascadeOnDelete();
            $table->foreign('target_employee_id')->references('id')->on('employees')->cascadeOnDelete();
            $table->foreign('requesting_shift_id')->references('id')->on('shifts')->nullOnDelete();
            $table->foreign('target_shift_id')->references('id')->on('shifts')->nullOnDelete();

            $table->index(['tenant_id', 'department_id', 'status'], 'idx_swaps_tenant_dept_status');
            $table->index(['tenant_id', 'requesting_employee_id', 'shift_date'], 'idx_swaps_req_emp_date');
            $table->index(['tenant_id', 'target_employee_id', 'shift_date'], 'idx_swaps_target_emp_date');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('shift_swap_requests');
    }
};
