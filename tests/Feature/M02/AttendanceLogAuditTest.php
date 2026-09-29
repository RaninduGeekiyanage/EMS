<?php

declare(strict_types=1);

namespace Tests\Feature\M02;

use App\Models\AttendanceDaily;
use App\Models\AttendanceLog;
use App\Models\Department;
use App\Models\Employee;
use App\Models\Tenant;
use App\Models\User;
use Carbon\Carbon;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

final class AttendanceLogAuditTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;
    private User $manager;
    private Department $deptOperations;
    private Department $deptFinance;
    private Employee $employee1;
    private Employee $employee2;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);

        $this->tenant = Tenant::create([
            'name' => 'Tea Exporters PLC',
            'slug' => 'tea-exporters',
            'is_active' => true,
        ]);

        session(['tenant_id' => $this->tenant->id]);
        if (function_exists('setPermissionsTeamId')) {
            setPermissionsTeamId($this->tenant->id);
        }

        $this->manager = User::factory()->create([
            'name' => 'HR Auditor',
            'email' => 'audit@teaexporters.com',
        ]);
        $this->manager->assignRole('HR Manager');

        $this->deptOperations = Department::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Operations',
        ]);

        $this->deptFinance = Department::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Finance',
        ]);

        $this->employee1 = Employee::create([
            'tenant_id' => $this->tenant->id,
            'emp_no' => 'EMP-001',
            'full_name' => 'Kamal Silva',
            'nic' => '851234567V',
            'biometric_device_id' => 'BIO-101',
            'department_id' => $this->deptOperations->id,
            'employment_status' => 'active',
        ]);

        $this->employee2 = Employee::create([
            'tenant_id' => $this->tenant->id,
            'emp_no' => 'EMP-002',
            'full_name' => 'Nimal Jayawardena',
            'nic' => '901234567V',
            'biometric_device_id' => 'BIO-102',
            'department_id' => $this->deptFinance->id,
            'employment_status' => 'active',
        ]);
    }

    public function test_initial_page_visit_does_not_load_records(): void
    {
        // Populate sample attendance logs
        AttendanceLog::create([
            'tenant_id' => $this->tenant->id,
            'employee_id' => $this->employee1->id,
            'punch_datetime' => '2026-09-29 08:05:00',
            'punch_type' => 'in',
            'raw_biometric_id' => 'BIO-101',
            'source' => 'import',
        ]);

        $response = $this->actingAs($this->manager)
            ->withSession(['tenant_id' => $this->tenant->id])
            ->get(route('attendance.logs.index'));

        $response->assertOk();
        $response->assertInertia(fn (Assert $page) => $page
            ->component('Attendance/Logs')
            ->where('executed', false)
            ->where('records', null)
            ->has('departments', 2)
        );
    }

    public function test_executed_search_returns_filtered_and_paginated_logs(): void
    {
        AttendanceLog::create([
            'tenant_id' => $this->tenant->id,
            'employee_id' => $this->employee1->id,
            'punch_datetime' => '2026-09-29 08:05:00',
            'punch_type' => 'in',
            'raw_biometric_id' => 'BIO-101',
            'source' => 'import',
            'is_processed' => true,
        ]);

        AttendanceLog::create([
            'tenant_id' => $this->tenant->id,
            'employee_id' => $this->employee2->id,
            'punch_datetime' => '2026-09-29 09:15:00',
            'punch_type' => 'in',
            'raw_biometric_id' => 'BIO-102',
            'source' => 'import',
            'is_processed' => false,
        ]);

        // Search with exact emp_no = EMP-001
        $response = $this->actingAs($this->manager)
            ->withSession(['tenant_id' => $this->tenant->id])
            ->get(route('attendance.logs.index', [
                'executed' => 1,
                'emp_no' => 'EMP-001',
            ]));

        $response->assertOk();
        $response->assertInertia(fn (Assert $page) => $page
            ->component('Attendance/Logs')
            ->where('executed', true)
            ->has('records.data', 1)
            ->where('records.data.0.employee.emp_no', 'EMP-001')
            ->where('stats.total_count', 1)
            ->where('stats.processed_count', 1)
        );
    }

    public function test_comparison_resolution_matches_daily_check_in(): void
    {
        $log = AttendanceLog::create([
            'tenant_id' => $this->tenant->id,
            'employee_id' => $this->employee1->id,
            'punch_datetime' => '2026-09-29 08:00:00',
            'punch_type' => 'in',
            'raw_biometric_id' => 'BIO-101',
            'source' => 'import',
            'is_processed' => true,
        ]);

        // Create daily attendance matching check-in
        AttendanceDaily::create([
            'tenant_id' => $this->tenant->id,
            'employee_id' => $this->employee1->id,
            'attendance_date' => '2026-09-29',
            'check_in' => '2026-09-29 08:00:00',
            'check_out' => '2026-09-29 17:00:00',
            'status' => 'present',
        ]);

        $response = $this->actingAs($this->manager)
            ->withSession(['tenant_id' => $this->tenant->id])
            ->get(route('attendance.logs.index', [
                'executed' => 1,
                'date_from' => '2026-09-29',
                'date_to' => '2026-09-29',
            ]));

        $response->assertOk();
        $response->assertInertia(fn (Assert $page) => $page
            ->component('Attendance/Logs')
            ->where('executed', true)
            ->where('records.data.0.comparison.type', 'matched_check_in')
            ->where('records.data.0.comparison.label', 'Matched Check-In')
        );
    }

    public function test_excel_export_returns_streamed_csv(): void
    {
        AttendanceLog::create([
            'tenant_id' => $this->tenant->id,
            'employee_id' => $this->employee1->id,
            'punch_datetime' => '2026-09-29 08:00:00',
            'punch_type' => 'in',
            'raw_biometric_id' => 'BIO-101',
            'source' => 'import',
        ]);

        $response = $this->actingAs($this->manager)
            ->withSession(['tenant_id' => $this->tenant->id])
            ->get(route('attendance.logs.export.excel', [
                'executed' => 1,
                'emp_no' => 'EMP-001',
            ]));

        $response->assertOk();
        $this->assertStringContainsString('text/csv', $response->headers->get('content-type') ?? '');
    }

    public function test_pdf_export_returns_pdf_download(): void
    {
        AttendanceLog::create([
            'tenant_id' => $this->tenant->id,
            'employee_id' => $this->employee1->id,
            'punch_datetime' => '2026-09-29 08:00:00',
            'punch_type' => 'in',
            'raw_biometric_id' => 'BIO-101',
            'source' => 'import',
        ]);

        $response = $this->actingAs($this->manager)
            ->withSession(['tenant_id' => $this->tenant->id])
            ->get(route('attendance.logs.export.pdf', [
                'executed' => 1,
                'emp_no' => 'EMP-001',
            ]));

        $response->assertOk();
        $this->assertStringContainsString('application/pdf', $response->headers->get('content-type') ?? '');
    }
}
