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
        Schema::table('wages_board_categories', function (Blueprint $table) {
            $table->unsignedInteger('entitle_start_day')->default(216)->after('minimum_wage');
            $table->unsignedInteger('entitle_end_day')->nullable()->after('entitle_start_day');
            $table->unsignedInteger('devided_days_by')->default(4)->after('entitle_end_day');
            $table->unsignedInteger('max_annual_leave')->default(14)->after('devided_days_by');
            $table->decimal('casual_leave_days', 4, 1)->default(0.0)->after('max_annual_leave');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('wages_board_categories', function (Blueprint $table) {
            $table->dropColumn([
                'entitle_start_day',
                'entitle_end_day',
                'devided_days_by',
                'max_annual_leave',
                'casual_leave_days',
            ]);
        });
    }
};
