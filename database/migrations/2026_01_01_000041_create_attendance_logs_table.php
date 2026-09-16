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
        Schema::create('attendance_logs', function (Blueprint $table): void {
            $table->ulid('id')->primary();
            $table->foreignUlid('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignUlid('employee_id')->constrained('employees')->cascadeOnDelete();
            $table->dateTime('punch_datetime');
            $table->string('punch_type', 20)->default('auto'); // in, out, auto
            $table->string('device_id', 50)->nullable();
            $table->string('raw_biometric_id', 50)->nullable();
            $table->foreignUlid('import_id')->nullable()->constrained('attendance_imports')->cascadeOnDelete();
            $table->string('source', 30)->default('import'); // import, manual, api
            $table->timestamps();

            $table->index('tenant_id');
            $table->index(['tenant_id', 'employee_id', 'punch_datetime']);
            $table->index(['tenant_id', 'punch_datetime']);
            $table->index(['tenant_id', 'import_id']);
            $table->unique(['tenant_id', 'employee_id', 'punch_datetime', 'punch_type'], 'attendance_logs_punch_unique');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('attendance_logs');
    }
};
