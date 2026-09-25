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
        Schema::table('roster_employee_allocations', function (Blueprint $table): void {
            $table->foreignUlid('roster_pattern_id')
                ->nullable()
                ->after('employee_id')
                ->constrained('roster_patterns')
                ->nullOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('roster_employee_allocations', function (Blueprint $table): void {
            $table->dropForeign(['roster_pattern_id']);
            $table->dropColumn('roster_pattern_id');
        });
    }
};
