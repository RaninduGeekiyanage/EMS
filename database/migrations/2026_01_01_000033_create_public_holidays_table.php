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
        Schema::create('public_holidays', function (Blueprint $table): void {
            $table->ulid('id')->primary();
            $table->foreignUlid('tenant_id')->constrained('tenants')->cascadeOnDelete();
            $table->date('holiday_date');
            $table->string('name', 150);
            $table->string('type', 50)->default('statutory'); // statutory, mercantile, poya
            $table->text('description')->nullable();
            $table->timestamps();

            $table->unique(['tenant_id', 'holiday_date']);
            $table->index('tenant_id');
            $table->index(['tenant_id', 'type']);
            $table->index(['tenant_id', 'holiday_date']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('public_holidays');
    }
};
