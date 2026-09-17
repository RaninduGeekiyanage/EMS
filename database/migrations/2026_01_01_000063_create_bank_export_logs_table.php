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
        Schema::create('bank_export_logs', function (Blueprint $table): void {
            $table->ulid('id')->primary();
            $table->foreignUlid('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->foreignUlid('payroll_run_id')->constrained('payroll_runs')->cascadeOnDelete();
            $table->string('bank_code', 50);
            $table->string('file_path', 255);
            $table->unsignedInteger('record_count')->default(0);
            $table->decimal('total_amount', 14, 2)->default(0.00);
            $table->foreignId('exported_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();

            $table->index('tenant_id');
            $table->index(['tenant_id', 'payroll_run_id']);
            $table->index(['tenant_id', 'bank_code']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('bank_export_logs');
    }
};
