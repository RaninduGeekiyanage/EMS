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
        Schema::create('leave_entitlements', function (Blueprint $table): void {
            $table->ulid('id')->primary();
            $table->foreignUlid('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignUlid('employee_id')->constrained('employees')->cascadeOnDelete();
            $table->foreignUlid('leave_type_id')->constrained('leave_types')->cascadeOnDelete();
            $table->unsignedSmallInteger('year');
            $table->decimal('allocated_days', 5, 2)->default(0.00);
            $table->decimal('used_days', 5, 2)->default(0.00);
            $table->decimal('pending_days', 5, 2)->default(0.00);
            $table->decimal('carried_forward_days', 5, 2)->default(0.00);
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->unique(['tenant_id', 'employee_id', 'leave_type_id', 'year'], 'leave_entitlements_emp_year_unique');
            $table->index('tenant_id');
            $table->index(['tenant_id', 'employee_id', 'year']);
            $table->index(['tenant_id', 'leave_type_id', 'year']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('leave_entitlements');
    }
};
