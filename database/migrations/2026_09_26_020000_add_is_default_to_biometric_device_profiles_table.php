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
        Schema::table('biometric_device_profiles', function (Blueprint $table): void {
            $table->boolean('is_default')->default(false)->after('is_active');
            $table->index(['tenant_id', 'is_default']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('biometric_device_profiles', function (Blueprint $table): void {
            $table->dropIndex(['tenant_id', 'is_default']);
            $table->dropColumn('is_default');
        });
    }
};
