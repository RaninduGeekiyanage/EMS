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
        Schema::table('attendance_daily', function (Blueprint $table): void {
            $table->decimal('approved_ot_hours', 5, 2)->nullable()->after('double_ot_hours');
            $table->decimal('approved_double_ot_hours', 5, 2)->nullable()->after('approved_ot_hours');
            $table->string('ot_approval_status', 20)->default('pending')->after('approved_double_ot_hours'); // pending, hod_approved, hr_confirmed, rejected
            $table->foreignId('ot_approved_by')->nullable()->after('ot_approval_status')->constrained('users')->nullOnDelete();
            $table->text('ot_approval_remarks')->nullable()->after('ot_approved_by');
            $table->boolean('is_paid')->default(true)->after('status');

            $table->index(['tenant_id', 'ot_approval_status'], 'idx_att_daily_ot_status');
            $table->index(['tenant_id', 'is_paid'], 'idx_att_daily_is_paid');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('attendance_daily', function (Blueprint $table): void {
            $table->dropIndex('idx_att_daily_ot_status');
            $table->dropIndex('idx_att_daily_is_paid');
            $table->dropForeign(['ot_approved_by']);
            $table->dropColumn([
                'approved_ot_hours',
                'approved_double_ot_hours',
                'ot_approval_status',
                'ot_approved_by',
                'ot_approval_remarks',
                'is_paid',
            ]);
        });
    }
};
