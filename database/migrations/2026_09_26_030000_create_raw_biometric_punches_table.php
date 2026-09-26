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
        Schema::create('raw_biometric_punches', function (Blueprint $table): void {
            $table->ulid('id')->primary();
            $table->foreignUlid('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->string('device_sn', 50)->nullable();
            $table->string('raw_user_id', 100);
            $table->dateTime('punch_time');
            $table->string('punch_type', 20)->default('auto');
            $table->string('status', 20)->default('pending'); // pending, imported, failed, ignored
            $table->dateTime('imported_at')->nullable();
            $table->foreignUlid('attendance_log_id')->nullable()->constrained('attendance_logs')->nullOnDelete();
            $table->text('error_message')->nullable();
            $table->json('raw_payload')->nullable();
            $table->timestamps();

            $table->index(['tenant_id', 'status']);
            $table->index(['tenant_id', 'punch_time']);
            $table->index(['tenant_id', 'raw_user_id', 'punch_time']);
            $table->index(['tenant_id', 'device_sn']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('raw_biometric_punches');
    }
};
