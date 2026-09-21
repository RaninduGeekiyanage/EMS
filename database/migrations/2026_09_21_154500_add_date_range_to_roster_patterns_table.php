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
        Schema::table('roster_patterns', function (Blueprint $table): void {
            $table->date('start_date')->nullable()->after('pattern_type');
            $table->date('end_date')->nullable()->after('start_date');

            $table->index(['tenant_id', 'start_date', 'end_date'], 'idx_roster_patterns_tenant_dates');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('roster_patterns', function (Blueprint $table): void {
            $table->dropIndex('idx_roster_patterns_tenant_dates');
            $table->dropColumn(['start_date', 'end_date']);
        });
    }
};
