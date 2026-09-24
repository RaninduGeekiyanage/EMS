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
        Schema::table('roster_groups', function (Blueprint $table): void {
            $table->foreignUlid('roster_id')->nullable()->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('roster_groups', function (Blueprint $table): void {
            $table->foreignUlid('roster_id')->nullable(false)->change();
        });
    }
};
