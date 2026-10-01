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
        Schema::create('attendance_period_locks', function (Blueprint $table): void {
            $table->ulid('id')->primary();
            $table->foreignUlid('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->unsignedSmallInteger('year');
            $table->unsignedTinyInteger('month');
            $table->date('period_start');
            $table->date('period_end');
            $table->foreignUlid('department_id')->nullable()->constrained('departments')->cascadeOnDelete();
            $table->string('status', 20)->default('open'); // open, hod_signed_off, hr_locked
            $table->foreignId('hod_signed_off_by')->nullable()->constrained('users')->nullOnDelete();
            $table->dateTime('hod_signed_off_at')->nullable();
            $table->foreignId('hr_locked_by')->nullable()->constrained('users')->nullOnDelete();
            $table->dateTime('hr_locked_at')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index('tenant_id');
            $table->index(['tenant_id', 'status']);
            $table->index(['tenant_id', 'year', 'month']);
            $table->index(['tenant_id', 'department_id', 'year', 'month'], 'idx_att_lock_dept_period');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('attendance_period_locks');
    }
};
