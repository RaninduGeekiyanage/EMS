<?php

declare(strict_types=1);

namespace Tests\Feature\M02;

use App\Models\AttendanceImport;
use App\Models\AttendanceLog;
use App\Models\Employee;
use App\Models\Tenant;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

final class AttendanceImportTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;
    private User $manager;
    private Employee $employee1;
    private Employee $employee2;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
        $this->seed(RolesAndPermissionsSeeder::class);

        $this->tenant = Tenant::create([
            'name' => 'Lanka Tea Estates Ltd',
            'slug' => 'lanka-tea-estates',
            'is_active' => true,
        ]);

        session(['tenant_id' => $this->tenant->id]);
        if (function_exists('setPermissionsTeamId')) {
            setPermissionsTeamId($this->tenant->id);
        }

        $this->manager = User::factory()->create([
            'name' => 'HR Manager',
            'email' => 'hrmanager@lankatea.com',
        ]);
        $this->manager->assignRole('HR Manager');

        $this->employee1 = Employee::create([
            'tenant_id' => $this->tenant->id,
            'emp_no' => 'EMP-001',
            'full_name' => 'Sunil Perera',
            'nic' => '851234567V',
            'biometric_device_id' => '1001',
            'employment_status' => 'active',
        ]);

        $this->employee2 = Employee::create([
            'tenant_id' => $this->tenant->id,
            'emp_no' => 'EMP-002',
            'full_name' => 'Kamal Silva',
            'nic' => '901234567V',
            'biometric_device_id' => '1002',
            'employment_status' => 'active',
        ]);
    }

    public function test_displays_attendance_import_index(): void
    {
        $response = $this->actingAs($this->manager)
            ->withHeaders(['X-Tenant-ID' => $this->tenant->id])
            ->get('/attendance/import');

        $response->assertOk();
    }

    public function test_previews_zkteco_file_with_mapped_employees(): void
    {
        $datContent = "1001\t2026-03-01 08:30:00\t0\t1\n".
                      "1002\t2026-03-01 08:45:00\t0\t1\n".
                      "9999\t2026-03-01 09:00:00\t0\t1\n"; // 9999 is unmapped

        $file = UploadedFile::fake()->createWithContent('zkteco.dat', $datContent);

        $response = $this->actingAs($this->manager)
            ->withHeaders(['X-Tenant-ID' => $this->tenant->id])
            ->postJson('/attendance/import/preview', [
                'file' => $file,
                'adapter_type' => 'zkteco',
            ]);

        $response->assertOk();
        $response->assertJsonPath('success', true);
        $response->assertJsonPath('data.total_rows', 3);
        $response->assertJsonPath('data.mapped_count', 2);
        $response->assertJsonPath('data.unmapped_count', 1);
        $response->assertJsonPath('data.unique_unmapped.0.biometric_id', '9999');
    }

    public function test_can_commit_attendance_import_and_persist_logs(): void
    {
        $datContent = "1001\t2026-03-01 08:30:00\t0\t1\n".
                      "1001\t2026-03-01 17:05:00\t1\t1\n".
                      "1002\t2026-03-01 08:45:00\t0\t1\n";

        $file = UploadedFile::fake()->createWithContent('zkteco_march.dat', $datContent);

        $response = $this->actingAs($this->manager)
            ->withHeaders(['X-Tenant-ID' => $this->tenant->id])
            ->post('/attendance/import', [
                'file' => $file,
                'adapter_type' => 'zkteco',
                'device_id' => 'TERM-01',
            ]);

        $response->assertRedirect();

        $this->assertDatabaseHas('attendance_imports', [
            'tenant_id' => $this->tenant->id,
            'filename' => 'zkteco_march.dat',
            'adapter_type' => 'zkteco',
            'processed_rows' => 3,
            'status' => 'completed',
        ]);

        $this->assertDatabaseCount('attendance_logs', 3);
        $this->assertDatabaseHas('attendance_logs', [
            'tenant_id' => $this->tenant->id,
            'employee_id' => $this->employee1->id,
            'punch_datetime' => '2026-03-01 08:30:00',
            'punch_type' => 'in',
            'device_id' => 'TERM-01',
        ]);
        $this->assertDatabaseHas('attendance_logs', [
            'tenant_id' => $this->tenant->id,
            'employee_id' => $this->employee1->id,
            'punch_datetime' => '2026-03-01 17:05:00',
            'punch_type' => 'out',
        ]);
    }

    public function test_generic_csv_import_maps_by_emp_no_fallback(): void
    {
        $csvContent = "emp_no,punch_datetime,punch_type\n".
                      "EMP-001,2026-03-05 08:00:00,in\n";

        $file = UploadedFile::fake()->createWithContent('attendance.csv', $csvContent);

        $response = $this->actingAs($this->manager)
            ->withHeaders(['X-Tenant-ID' => $this->tenant->id])
            ->post('/attendance/import', [
                'file' => $file,
                'adapter_type' => 'generic_csv',
            ]);

        $response->assertRedirect();

        $this->assertDatabaseHas('attendance_logs', [
            'tenant_id' => $this->tenant->id,
            'employee_id' => $this->employee1->id,
            'punch_datetime' => '2026-03-05 08:00:00',
            'punch_type' => 'in',
        ]);
    }

    public function test_prevents_duplicate_identical_punches_on_reimport(): void
    {
        $csvContent = "biometric_id,punch_datetime,punch_type\n".
                      "1001,2026-03-01 08:30:00,in\n";

        $file1 = UploadedFile::fake()->createWithContent('batch1.csv', $csvContent);
        $this->actingAs($this->manager)
            ->withHeaders(['X-Tenant-ID' => $this->tenant->id])
            ->post('/attendance/import', [
                'file' => $file1,
                'adapter_type' => 'generic_csv',
            ]);

        $this->assertDatabaseCount('attendance_logs', 1);

        // Re-upload same punches
        $file2 = UploadedFile::fake()->createWithContent('batch2.csv', $csvContent);
        $this->actingAs($this->manager)
            ->withHeaders(['X-Tenant-ID' => $this->tenant->id])
            ->post('/attendance/import', [
                'file' => $file2,
                'adapter_type' => 'generic_csv',
            ]);

        // Total count should still be 1 (duplicate skipped)
        $this->assertDatabaseCount('attendance_logs', 1);
    }

    public function test_can_rollback_import_and_remove_associated_logs(): void
    {
        $datContent = "1001\t2026-03-01 08:30:00\t0\t1\n";
        $file = UploadedFile::fake()->createWithContent('rollback_me.dat', $datContent);

        $this->actingAs($this->manager)
            ->withHeaders(['X-Tenant-ID' => $this->tenant->id])
            ->post('/attendance/import', [
                'file' => $file,
                'adapter_type' => 'zkteco',
            ]);

        $import = AttendanceImport::firstOrFail();
        $this->assertDatabaseCount('attendance_logs', 1);

        $deleteResponse = $this->actingAs($this->manager)
            ->withHeaders(['X-Tenant-ID' => $this->tenant->id])
            ->delete("/attendance/import/{$import->id}");

        $deleteResponse->assertRedirect();
        $this->assertDatabaseMissing('attendance_imports', ['id' => $import->id]);
        $this->assertDatabaseCount('attendance_logs', 0);
    }

    public function test_can_map_biometric_id_to_employee(): void
    {
        $response = $this->actingAs($this->manager)
            ->withHeaders(['X-Tenant-ID' => $this->tenant->id])
            ->postJson('/attendance/import/map-employee', [
                'employee_id' => $this->employee1->id,
                'biometric_id' => 'NEW-BIO-555',
            ]);

        $response->assertOk();
        $response->assertJsonPath('success', true);

        $this->assertDatabaseHas('employees', [
            'id' => $this->employee1->id,
            'biometric_device_id' => 'NEW-BIO-555',
        ]);
    }

    public function test_can_download_sample_template(): void
    {
        $response = $this->actingAs($this->manager)
            ->withHeaders(['X-Tenant-ID' => $this->tenant->id])
            ->get('/attendance/import/template/zkteco');

        $response->assertOk();
        $this->assertStringContainsString('text/plain', (string) $response->headers->get('Content-Type'));
    }
}
