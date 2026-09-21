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
        Schema::table('employees', function (Blueprint $table): void {
            $table->string('employment_category', 50)->default('shop_and_office')->after('employment_type'); // shop_and_office, wages_board
            $table->string('gender', 20)->nullable()->after('full_name');
            $table->date('date_of_birth')->nullable()->after('gender');
            $table->string('marital_status', 30)->nullable()->after('date_of_birth');
            $table->text('permanent_address')->nullable()->after('phone');
            $table->text('temporary_address')->nullable()->after('permanent_address');
            $table->string('city', 100)->nullable()->after('temporary_address');
            $table->string('landline', 50)->nullable()->after('city');
            $table->string('attendance_mode', 30)->default('shift')->after('employment_status'); // general, shift
            $table->foreignUlid('job_grade_id')->nullable()->after('designation_id')->constrained('job_grades')->nullOnDelete();
            $table->foreignUlid('wages_board_category_id')->nullable()->after('job_grade_id')->constrained('wages_board_categories')->nullOnDelete();

            // Composite indexes for fast filtering on shared MySQL hosting
            $table->index(['tenant_id', 'employment_category']);
            $table->index(['tenant_id', 'attendance_mode']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('employees', function (Blueprint $table): void {
            $table->dropForeign(['job_grade_id']);
            $table->dropForeign(['wages_board_category_id']);
            $table->dropIndex(['tenant_id', 'employment_category']);
            $table->dropIndex(['tenant_id', 'attendance_mode']);
            $table->dropColumn([
                'employment_category',
                'gender',
                'date_of_birth',
                'marital_status',
                'permanent_address',
                'temporary_address',
                'city',
                'landline',
                'attendance_mode',
                'job_grade_id',
                'wages_board_category_id',
            ]);
        });
    }
};
