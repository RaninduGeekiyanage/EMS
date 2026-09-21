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
        Schema::create('roster_groups', function (Blueprint $table): void {
            $table->ulid('id')->primary();
            $table->foreignUlid('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignUlid('roster_id')->constrained('rosters')->cascadeOnDelete();
            $table->foreignUlid('roster_pattern_id')->nullable()->constrained('roster_patterns')->nullOnDelete();
            $table->string('name', 100);
            $table->string('code', 50);
            $table->string('color', 20)->nullable()->default('#3b82f6');
            $table->text('description')->nullable();
            $table->timestamps();

            $table->index(['tenant_id', 'roster_id']);
        });

        Schema::create('roster_group_members', function (Blueprint $table): void {
            $table->ulid('id')->primary();
            $table->foreignUlid('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignUlid('roster_group_id')->constrained('roster_groups')->cascadeOnDelete();
            $table->foreignUlid('employee_id')->constrained('employees')->cascadeOnDelete();
            $table->date('start_date')->nullable();
            $table->date('end_date')->nullable();
            $table->timestamps();

            $table->unique(['tenant_id', 'roster_group_id', 'employee_id'], 'uniq_group_emp_enrollment');
            $table->index(['tenant_id', 'employee_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('roster_group_members');
        Schema::dropIfExists('roster_groups');
    }
};
