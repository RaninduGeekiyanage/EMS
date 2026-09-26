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
            $table->string('source_type', 30)->default('file')->after('name'); // file, database_staging
            $table->index(['tenant_id', 'source_type']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('biometric_device_profiles', function (Blueprint $table): void {
            $table->dropIndex(['tenant_id', 'source_type']);
            $table->dropColumn('source_type');
        });
    }
};
