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
        Schema::table('users', function (Blueprint $table): void {
            $table->string('email')->nullable()->change();
            $table->string('username', 100)->nullable()->after('name');
            $table->string('phone', 50)->nullable()->after('email');
            $table->foreignUlid('employee_id')->nullable()->after('tenant_id')->constrained('employees')->nullOnDelete();
            $table->boolean('must_change_password')->default(false)->after('password');
            $table->timestamp('last_password_changed_at')->nullable()->after('must_change_password');

            $table->unique(['tenant_id', 'username'], 'uq_users_tenant_username');
            $table->index(['tenant_id', 'phone'], 'idx_users_tenant_phone');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->dropUnique('uq_users_tenant_username');
            $table->dropIndex('idx_users_tenant_phone');
            $table->dropForeign(['employee_id']);
            $table->dropColumn([
                'username',
                'phone',
                'employee_id',
                'must_change_password',
                'last_password_changed_at',
            ]);
            $table->string('email')->nullable(false)->change();
        });
    }
};
