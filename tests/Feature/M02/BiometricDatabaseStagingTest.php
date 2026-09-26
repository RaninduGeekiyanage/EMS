<?php

declare(strict_types=1);

namespace Tests\Feature\M02;

use App\Models\AttendanceImport;
use App\Models\AttendanceLog;
use App\Models\BiometricDeviceProfile;
use App\Models\Employee;
use App\Models\RawBiometricPunch;
use App\Models\Tenant;
use App\Models\User;
use App\Services\Biometric\DatabaseStagingAdapter;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

final class BiometricDatabaseStagingTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;
    private Tenant $otherTenant;
    private User $admin;
    private Employee $employee1;
    private Employee $employee2;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);

        $this->tenant = Tenant::create([
            'name' => 'Colombo Garments PLC',
            'slug' => 'colombo-garments',
            'is_active' => true,
        ]);

        $this->otherTenant = Tenant::create([
            'name' => 'Other Textiles Ltd',
            'slug' => 'other-textiles',
            'is_active' => true,
        ]);

        session(['tenant_id' => $this->tenant->id]);
        if (function_exists('setPermissionsTeamId')) {
            setPermissionsTeamId($this->tenant->id);
        }

        $this->admin = User::factory()->create([
            'name' => 'System Admin',
            'email' => 'admin@colombogarments.com',
        ]);
        $this->admin->assignRole('Company Admin');

        $this->employee1 = Employee::create([
            'tenant_id' => $this->tenant->id,
            'emp_no' => 'CG-101',
            'full_name' => 'Kamal Perera',
            'nic' => '901234567V',
            'biometric_device_id' => '2001',
            'employment_status' => 'active',
        ]);

        $this->employee2 = Employee::create([
            'tenant_id' => $this->tenant->id,
            'emp_no' => 'CG-102',
            'full_name' => 'Sunil Shantha',
            'nic' => '911234567V',
            'biometric_device_id' => '2002',
            'employment_status' => 'active',
        ]);
    }

    public function test_biometric_ping_endpoint_returns_health_status(): void
    {
        $response = $this->getJson('/api/biometric/ping?device_sn=ZK-MAIN-GATE');

        $response->assertOk()
            ->assertJson([
                'success' => true,
                'status' => 'online',
            ])
            ->assertJsonStructure(['server_time']);
    }

    public function test_biometric_ingest_single_punch_persists_raw_record(): void
    {
        $payload = [
            'tenant_id' => $this->tenant->id,
            'device_sn' => 'ZK-GATE-01',
            'raw_user_id' => '2001',
            'punch_time' => '2026-09-26 08:15:30',
            'punch_type' => 'in',
        ];

        $response = $this->postJson('/api/biometric/ingest', $payload);

        $response->assertStatus(201)
            ->assertJson([
                'success' => true,
                'staged_count' => 1,
            ]);

        $this->assertDatabaseHas('raw_biometric_punches', [
            'tenant_id' => $this->tenant->id,
            'device_sn' => 'ZK-GATE-01',
            'raw_user_id' => '2001',
            'punch_time' => '2026-09-26 08:15:30',
            'punch_type' => 'in',
            'status' => 'pending',
        ]);
    }

    public function test_biometric_ingest_batch_array_and_skips_duplicates(): void
    {
        $batch = [
            'tenant_id' => $this->tenant->id,
            'device_sn' => 'ZK-GATE-01',
            'punches' => [
                [
                    'raw_user_id' => '2001',
                    'punch_time' => '2026-09-26 08:00:00',
                    'punch_type' => 'in',
                ],
                [
                    'raw_user_id' => '2002',
                    'punch_time' => '2026-09-26 08:05:00',
                    'punch_type' => 'in',
                ],
            ],
        ];

        $res1 = $this->postJson('/api/biometric/ingest', $batch);
        $res1->assertStatus(201)->assertJson(['staged_count' => 2]);

        $this->assertEquals(2, RawBiometricPunch::where('tenant_id', $this->tenant->id)->count());

        // Re-posting identical records should skip duplicate entries
        $res2 = $this->postJson('/api/biometric/ingest', $batch);
        $res2->assertStatus(201)->assertJson(['staged_count' => 0, 'skipped_count' => 2]);

        $this->assertEquals(2, RawBiometricPunch::where('tenant_id', $this->tenant->id)->count());
    }

    public function test_staging_adapter_resolves_and_validates_raw_punches(): void
    {
        RawBiometricPunch::create([
            'tenant_id' => $this->tenant->id,
            'device_sn' => 'ZK-01',
            'raw_user_id' => '2001',
            'punch_time' => '2026-09-26 08:30:00',
            'punch_type' => 'in',
            'status' => 'pending',
        ]);

        $adapter = new DatabaseStagingAdapter();
        $records = $adapter->parse('', ['tenant_id' => $this->tenant->id]);

        $this->assertCount(1, $records);
        $this->assertEquals('2001', $records[0]['biometric_id']);
        $this->assertEquals('2026-09-26 08:30:00', $records[0]['punch_datetime']);

        $validation = $adapter->validate($records, []);
        $this->assertEquals(1, $validation['summary']['valid']);
        $this->assertEquals(0, $validation['summary']['invalid']);
    }

    public function test_test_db_query_controller_endpoint_returns_sample_records(): void
    {
        RawBiometricPunch::create([
            'tenant_id' => $this->tenant->id,
            'device_sn' => 'ZK-LOBBY',
            'raw_user_id' => '2001',
            'punch_time' => '2026-09-26 08:45:00',
            'punch_type' => 'in',
            'status' => 'pending',
        ]);

        $response = $this->actingAs($this->admin)
            ->withHeaders(['X-Tenant-ID' => $this->tenant->id])
            ->postJson('/biometric-devices/test-db-query', [
                'columns_config' => [
                    'raw_user_id_col' => 'raw_user_id',
                    'punch_time_col' => 'punch_time',
                    'punch_type_col' => 'punch_type',
                    'device_sn_col' => 'device_sn',
                ],
                'limit' => 5,
            ]);

        $response->assertOk()
            ->assertJson([
                'success' => true,
                'data' => [
                    'total_pending' => 1,
                    'total_parsed' => 1,
                    'valid_count' => 1,
                ],
            ]);
    }

    public function test_attendance_import_staging_preview_matches_employees(): void
    {
        // One mapped punch and one unmapped punch
        RawBiometricPunch::create([
            'tenant_id' => $this->tenant->id,
            'device_sn' => 'ZK-MAIN',
            'raw_user_id' => '2001', // Kamal Perera
            'punch_time' => '2026-09-26 08:00:00',
            'punch_type' => 'in',
            'status' => 'pending',
        ]);

        RawBiometricPunch::create([
            'tenant_id' => $this->tenant->id,
            'device_sn' => 'ZK-MAIN',
            'raw_user_id' => '9999', // Unmapped ID
            'punch_time' => '2026-09-26 08:05:00',
            'punch_type' => 'in',
            'status' => 'pending',
        ]);

        $response = $this->actingAs($this->admin)
            ->withHeaders(['X-Tenant-ID' => $this->tenant->id])
            ->postJson('/attendance/import/staging-preview', [
                'status' => 'pending',
            ]);

        $response->assertOk()
            ->assertJson([
                'success' => true,
                'data' => [
                    'total_rows' => 2,
                    'mapped_count' => 1,
                    'unmapped_count' => 1,
                ],
            ]);

        $previewRows = $response->json('data.preview_rows');
        $this->assertCount(2, $previewRows);
        $this->assertEquals('Kamal Perera', $previewRows[0]['matched_employee']['full_name']);
        $this->assertNull($previewRows[1]['matched_employee']);
    }

    public function test_attendance_import_staging_commit_persists_logs_and_marks_status_imported(): void
    {
        $punch1 = RawBiometricPunch::create([
            'tenant_id' => $this->tenant->id,
            'device_sn' => 'ZK-GATE',
            'raw_user_id' => '2001',
            'punch_time' => '2026-09-26 08:30:00',
            'punch_type' => 'in',
            'status' => 'pending',
        ]);

        $punch2 = RawBiometricPunch::create([
            'tenant_id' => $this->tenant->id,
            'device_sn' => 'ZK-GATE',
            'raw_user_id' => '2002',
            'punch_time' => '2026-09-26 17:30:00',
            'punch_type' => 'out',
            'status' => 'pending',
        ]);

        $response = $this->actingAs($this->admin)
            ->withHeaders(['X-Tenant-ID' => $this->tenant->id])
            ->postJson('/attendance/import/staging-commit', [
                'status' => 'pending',
            ]);

        $response->assertOk()
            ->assertJson([
                'success' => true,
            ]);

        // Verify AttendanceImport record was created
        $import = AttendanceImport::where('tenant_id', $this->tenant->id)->latest()->first();
        $this->assertNotNull($import);
        $this->assertEquals('database_staging', $import->adapter_type);
        $this->assertStringContainsString('Staging DB Sync', $import->filename);
        $this->assertEquals(2, $import->processed_rows);
        $this->assertEquals('completed', $import->status);
        $this->assertEquals(2, $import->processed_rows);
        $this->assertEquals('completed', $import->status);

        // Verify AttendanceLog records were created
        $this->assertEquals(2, AttendanceLog::where('import_id', $import->id)->count());

        // Verify staging punches are marked imported with attendance_log_id
        $punch1->refresh();
        $punch2->refresh();
        $this->assertEquals('imported', $punch1->status);
        $this->assertEquals('imported', $punch2->status);
        $this->assertNotNull($punch1->attendance_log_id);
        $this->assertNotNull($punch2->attendance_log_id);
        $this->assertNotNull($punch1->imported_at);
    }

    public function test_deleting_staging_import_resets_raw_punches_to_pending(): void
    {
        $punch = RawBiometricPunch::create([
            'tenant_id' => $this->tenant->id,
            'device_sn' => 'ZK-GATE',
            'raw_user_id' => '2001',
            'punch_time' => '2026-09-26 08:30:00',
            'punch_type' => 'in',
            'status' => 'pending',
        ]);

        $this->actingAs($this->admin)
            ->withHeaders(['X-Tenant-ID' => $this->tenant->id])
            ->postJson('/attendance/import/staging-commit');

        $punch->refresh();
        $this->assertEquals('imported', $punch->status);
        $this->assertNotNull($punch->attendance_log_id);

        $import = AttendanceImport::where('tenant_id', $this->tenant->id)->first();
        $this->assertNotNull($import);

        // Delete import batch
        $delResponse = $this->actingAs($this->admin)
            ->withHeaders(['X-Tenant-ID' => $this->tenant->id])
            ->delete("/attendance/import/{$import->id}");

        $delResponse->assertRedirect();

        // Punch should be rolled back to pending
        $punch->refresh();
        $this->assertEquals('pending', $punch->status);
        $this->assertNull($punch->attendance_log_id);
        $this->assertNull($punch->imported_at);

        // Attendance logs should be removed
        $this->assertEquals(0, AttendanceLog::where('tenant_id', $this->tenant->id)->count());
    }

    public function test_tenant_isolation_on_staging_records(): void
    {
        // Punch for other tenant
        RawBiometricPunch::create([
            'tenant_id' => $this->otherTenant->id,
            'device_sn' => 'ZK-OTHER',
            'raw_user_id' => '9001',
            'punch_time' => '2026-09-26 08:00:00',
            'punch_type' => 'in',
            'status' => 'pending',
        ]);

        // Main tenant preview should see 0 records
        $response = $this->actingAs($this->admin)
            ->withHeaders(['X-Tenant-ID' => $this->tenant->id])
            ->postJson('/attendance/import/staging-preview');

        $response->assertOk()
            ->assertJson([
                'success' => true,
                'data' => [
                    'total_rows' => 0,
                    'mapped_count' => 0,
                ],
            ]);
    }
}
