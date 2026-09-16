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
        Schema::create('attendance_rules', function (Blueprint $table): void {
            $table->ulid('id')->primary();
            $table->foreignUlid('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignUlid('shift_id')->nullable()->constrained('shifts')->nullOnDelete();
            $table->string('rule_name', 100)->default('Default Company Policy');
            $table->unsignedSmallInteger('grace_period_minutes')->default(10);
            $table->unsignedSmallInteger('ot_buffer_minutes')->default(0); // 0 = immediate, 30 = after 30 mins, 60 = after 1 hour
            $table->unsignedSmallInteger('ot_minimum_minutes')->default(15); // minimum minutes to qualify for OT
            $table->decimal('ot_rate_weekday', 4, 2)->default(1.50);
            $table->decimal('ot_rate_rest_day', 4, 2)->default(1.50);
            $table->decimal('ot_rate_holiday', 4, 2)->default(2.00);
            $table->decimal('half_day_min_hours', 4, 2)->default(4.00);
            $table->decimal('half_day_max_hours', 4, 2)->default(6.00);
            $table->unsignedSmallInteger('early_departure_grace_minutes')->default(5);
            $table->unsignedSmallInteger('round_ot_interval_minutes')->default(15);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique(['tenant_id', 'shift_id']);
            $table->index('tenant_id');
            $table->index(['tenant_id', 'is_active']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('attendance_rules');
    }
};
