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
        Schema::table('shift_swap_requests', function (Blueprint $table) {
            $table->date('target_date')->nullable()->after('shift_date');
            $table->string('swap_type', 20)->default('same_day')->after('target_date');
            $table->string('requesting_schedule_type', 20)->default('shift')->after('requesting_shift_id');
            $table->string('target_schedule_type', 20)->default('shift')->after('target_shift_id');
            $table->json('metadata')->nullable()->after('admin_notes');

            $table->index(['tenant_id', 'target_employee_id', 'target_date'], 'idx_swaps_target_emp_target_date');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('shift_swap_requests', function (Blueprint $table) {
            $table->dropIndex('idx_swaps_target_emp_target_date');
            $table->dropColumn([
                'target_date',
                'swap_type',
                'requesting_schedule_type',
                'target_schedule_type',
                'metadata',
            ]);
        });
    }
};
