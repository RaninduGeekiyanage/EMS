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
        Schema::create('roster_entries', function (Blueprint $table): void {
            $table->ulid('id')->primary();
            $table->foreignUlid('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignUlid('employee_id')->constrained('employees')->cascadeOnDelete();
            $table->date('roster_date');
            $table->foreignUlid('shift_id')->nullable()->constrained('shifts')->nullOnDelete();
            $table->string('schedule_type', 20)->default('shift'); // 'shift', 'rest_day', 'off'
            $table->string('status', 20)->default('published'); // 'draft', 'published', 'locked'
            $table->boolean('is_overridden')->default(false);
            $table->string('notes', 255)->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['tenant_id', 'employee_id', 'roster_date'], 'unique_tenant_emp_roster_date');
            $table->index(['tenant_id', 'roster_date']);
            $table->index(['tenant_id', 'employee_id']);
            $table->index(['tenant_id', 'status']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('roster_entries');
    }
};
