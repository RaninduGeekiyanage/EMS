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
        Schema::create('shift_assignments', function (Blueprint $table): void {
            $table->ulid('id')->primary();
            $table->foreignUlid('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignUlid('employee_id')->constrained('employees')->cascadeOnDelete();
            $table->foreignUlid('shift_id')->constrained('shifts')->cascadeOnDelete();
            $table->date('effective_from');
            $table->date('effective_to')->nullable();
            $table->timestamps();

            $table->index('tenant_id');
            $table->index(['tenant_id', 'employee_id']);
            $table->index(['tenant_id', 'shift_id']);
            $table->index(['tenant_id', 'employee_id', 'effective_from']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('shift_assignments');
    }
};
