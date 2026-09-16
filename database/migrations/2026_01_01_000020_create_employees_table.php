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
        Schema::create('employees', function (Blueprint $table): void {
            $table->ulid('id')->primary();
            $table->foreignUlid('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->string('emp_no', 50);
            $table->text('nic'); // Encrypted
            $table->string('full_name', 255);
            $table->string('email', 255)->nullable();
            $table->string('phone', 50)->nullable();
            $table->foreignUlid('department_id')->nullable()->constrained('departments')->nullOnDelete();
            $table->foreignUlid('designation_id')->nullable()->constrained('designations')->nullOnDelete();
            $table->foreignUlid('branch_id')->nullable()->constrained('branches')->nullOnDelete();
            $table->string('employment_type', 50)->default('permanent');
            $table->string('employment_status', 50)->default('active');
            $table->date('date_of_joining')->nullable();
            $table->string('biometric_device_id', 50)->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->unique(['tenant_id', 'emp_no']);
            $table->index('tenant_id');
            $table->index(['tenant_id', 'department_id']);
            $table->index(['tenant_id', 'branch_id']);
            $table->index(['tenant_id', 'biometric_device_id']);
            $table->index(['tenant_id', 'employment_status']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('employees');
    }
};
