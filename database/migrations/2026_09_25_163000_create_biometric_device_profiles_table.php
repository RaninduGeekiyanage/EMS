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
        Schema::create('biometric_device_profiles', function (Blueprint $table): void {
            $table->ulid('id')->primary();
            $table->foreignUlid('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->string('name', 100);
            $table->string('device_brand', 50)->default('other');
            $table->string('model_name', 100)->nullable();
            $table->string('file_extension', 20)->default('txt');
            $table->string('delimiter_type', 20)->default('tab');
            $table->string('custom_delimiter', 10)->nullable();
            $table->unsignedInteger('skip_header_lines')->default(0);
            $table->string('date_mode', 20)->default('combined'); // combined, separate
            $table->string('date_format', 50)->default('Y-m-d H:i:s');
            $table->string('time_format', 50)->nullable()->default('H:i:s');
            $table->json('columns_config');
            $table->json('status_code_mapping')->nullable();
            $table->string('default_device_id', 50)->nullable();
            $table->boolean('is_active')->default(true);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['tenant_id', 'is_active']);
            $table->index(['tenant_id', 'device_brand']);
        });

        Schema::table('attendance_imports', function (Blueprint $table): void {
            $table->foreignUlid('profile_id')->nullable()->after('adapter_type')->constrained('biometric_device_profiles')->nullOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('attendance_imports', function (Blueprint $table): void {
            $table->dropForeign(['profile_id']);
            $table->dropColumn('profile_id');
        });

        Schema::dropIfExists('biometric_device_profiles');
    }
};
