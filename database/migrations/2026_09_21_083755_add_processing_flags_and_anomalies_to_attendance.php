<?php

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
        Schema::table('attendance_logs', function (Blueprint $table) {
            $table->boolean('is_processed')->default(false)->after('source');
            $table->timestamp('processed_at')->nullable()->after('is_processed');

            $table->index(['tenant_id', 'is_processed', 'punch_datetime'], 'idx_att_logs_processing');
        });

        Schema::table('attendance_daily', function (Blueprint $table) {
            $table->json('anomalies')->nullable()->after('calculation_breakdown');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('attendance_daily', function (Blueprint $table) {
            $table->dropColumn('anomalies');
        });

        Schema::table('attendance_logs', function (Blueprint $table) {
            $table->dropIndex('idx_att_logs_processing');
            $table->dropColumn(['is_processed', 'processed_at']);
        });
    }
};
