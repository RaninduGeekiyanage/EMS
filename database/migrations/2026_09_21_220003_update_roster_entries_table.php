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
        Schema::table('roster_entries', function (Blueprint $table): void {
            $table->foreignUlid('roster_id')->nullable()->after('tenant_id')->constrained('rosters')->cascadeOnDelete();
            $table->foreignUlid('roster_group_id')->nullable()->after('roster_id')->constrained('roster_groups')->nullOnDelete();
            $table->foreignUlid('roster_pattern_id')->nullable()->after('roster_group_id')->constrained('roster_patterns')->nullOnDelete();
            $table->foreignUlid('original_shift_id')->nullable()->after('shift_id')->constrained('shifts')->nullOnDelete();
            $table->string('override_reason', 100)->nullable()->after('is_overridden');
            $table->foreignId('overridden_by')->nullable()->after('override_reason')->constrained('users')->nullOnDelete();

            $table->index(['tenant_id', 'roster_id']);
            $table->index(['tenant_id', 'roster_group_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('roster_entries', function (Blueprint $table): void {
            $table->dropForeign(['roster_id']);
            $table->dropForeign(['roster_group_id']);
            $table->dropForeign(['roster_pattern_id']);
            $table->dropForeign(['original_shift_id']);
            $table->dropForeign(['overridden_by']);

            $table->dropColumn([
                'roster_id',
                'roster_group_id',
                'roster_pattern_id',
                'original_shift_id',
                'override_reason',
                'overridden_by',
            ]);
        });
    }
};
