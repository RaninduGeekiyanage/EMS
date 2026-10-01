<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('leave_requests', function (Blueprint $table): void {
            $table->boolean('is_short_leave')->default(false)->after('half_day_type');
            $table->time('short_leave_from')->nullable()->after('is_short_leave');
            $table->time('short_leave_to')->nullable()->after('short_leave_from');
            $table->unsignedInteger('short_leave_duration_minutes')->nullable()->after('short_leave_to');
            $table->foreignUlid('covering_employee_id')->nullable()->after('short_leave_duration_minutes')->constrained('employees')->nullOnDelete();
            $table->string('approval_stage', 25)->default('pending_hr')->after('status');
            $table->foreignId('hod_id')->nullable()->after('approval_stage')->constrained('users')->nullOnDelete();
            $table->dateTime('hod_actioned_at')->nullable()->after('hod_id');
            $table->text('hod_remarks')->nullable()->after('hod_actioned_at');
            $table->boolean('is_bypassed_by_hr')->default(false)->after('hod_remarks');

            $table->index(['tenant_id', 'approval_stage'], 'idx_lr_approval_stage');
            $table->index(['tenant_id', 'is_short_leave'], 'idx_lr_short_leave');
            $table->index(['tenant_id', 'covering_employee_id'], 'idx_lr_covering_emp');
        });

        // Backfill approval_stage to match existing status
        DB::table('leave_requests')->where('status', 'approved')->update(['approval_stage' => 'approved']);
        DB::table('leave_requests')->where('status', 'rejected')->update(['approval_stage' => 'rejected']);
        DB::table('leave_requests')->where('status', 'cancelled')->update(['approval_stage' => 'cancelled']);
        DB::table('leave_requests')->where('status', 'pending')->update(['approval_stage' => 'pending_hr']);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('leave_requests', function (Blueprint $table): void {
            $table->dropForeign(['covering_employee_id']);
            $table->dropForeign(['hod_id']);
            $table->dropIndex('idx_lr_approval_stage');
            $table->dropIndex('idx_lr_short_leave');
            $table->dropIndex('idx_lr_covering_emp');

            $table->dropColumn([
                'is_short_leave',
                'short_leave_from',
                'short_leave_to',
                'short_leave_duration_minutes',
                'covering_employee_id',
                'approval_stage',
                'hod_id',
                'hod_actioned_at',
                'hod_remarks',
                'is_bypassed_by_hr',
            ]);
        });
    }
};
