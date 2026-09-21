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
            $table->unsignedSmallInteger('in_window_before_start')->default(60)->after('is_night_shift');
            $table->unsignedSmallInteger('in_window_after_start')->default(120)->after('in_window_before_start');
            $table->unsignedSmallInteger('out_window_before_end')->default(120)->after('in_window_after_start');
            $table->unsignedSmallInteger('out_window_after_end')->default(180)->after('out_window_before_end');
            $table->time('first_half_end_time')->nullable()->after('out_window_after_end');
            $table->time('second_half_start_time')->nullable()->after('first_half_end_time');
            $table->boolean('early_in_as_ot')->default(false)->after('second_half_start_time');
            $table->boolean('early_in_as_att_in')->default(true)->after('early_in_as_ot');
            $table->time('ot_start_time')->nullable()->after('early_in_as_att_in');
            $table->unsignedSmallInteger('working_minutes')->nullable()->after('ot_start_time');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('shifts', function (Blueprint $table): void {
            $table->dropColumn([
                'in_window_before_start',
                'in_window_after_start',
                'out_window_before_end',
                'out_window_after_end',
                'first_half_end_time',
                'second_half_start_time',
                'early_in_as_ot',
                'early_in_as_att_in',
                'ot_start_time',
                'working_minutes',
            ]);
        });
    }
};
