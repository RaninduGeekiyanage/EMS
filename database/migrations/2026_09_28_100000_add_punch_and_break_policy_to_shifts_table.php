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
        Schema::table('shifts', function (Blueprint $table): void {
            $table->string('punch_mode', 30)->default('first_last')->after('working_minutes');
            $table->string('break_deduction_type', 30)->default('auto_deduct')->after('punch_mode');
            $table->unsignedSmallInteger('min_work_hours_for_break')->default(300)->after('break_deduction_type'); // minutes (default 5.0 hours)
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('shifts', function (Blueprint $table): void {
            $table->dropColumn([
                'punch_mode',
                'break_deduction_type',
                'min_work_hours_for_break',
            ]);
        });
    }
};
