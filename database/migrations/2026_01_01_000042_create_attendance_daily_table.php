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
        Schema::create('attendance_daily', function (Blueprint $table): void {
            $table->ulid('id')->primary();
            $table->foreignUlid('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignUlid('employee_id')->constrained('employees')->cascadeOnDelete();
            $table->date('attendance_date');
            $table->foreignUlid('shift_id')->nullable()->constrained('shifts')->nullOnDelete();
            $table->dateTime('check_in')->nullable();
            $table->dateTime('check_out')->nullable();
            $table->decimal('worked_hours', 5, 2)->default(0.00);
            $table->decimal('regular_hours', 5, 2)->default(0.00);
            $table->unsignedSmallInteger('late_minutes')->default(0);
            $table->unsignedSmallInteger('early_departure_minutes')->default(0);
            $table->decimal('ot_hours', 5, 2)->default(0.00); // 1.5x Overtime
            $table->decimal('double_ot_hours', 5, 2)->default(0.00); // 2.0x Holiday Overtime
            $table->string('status', 30)->default('present'); // present, absent, half_day, leave, holiday, rest_day, missing_punch
            $table->boolean('is_manual')->default(false);
            $table->text('manual_reason')->nullable();
            $table->foreignId('manual_edited_by')->nullable()->constrained('users')->nullOnDelete();
            $table->json('calculation_breakdown')->nullable();
            $table->timestamps();

            $table->unique(['tenant_id', 'employee_id', 'attendance_date']);
            $table->index('tenant_id');
            $table->index(['tenant_id', 'attendance_date']);
            $table->index(['tenant_id', 'status']);
            $table->index(['tenant_id', 'employee_id', 'attendance_date']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('attendance_daily');
    }
};
