<?php

declare(strict_types=1);

namespace Tests\Feature\M02;

use App\Models\AttendanceImport;
use App\Models\BiometricDeviceProfile;
use App\Models\Employee;
use App\Models\Tenant;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

final class BiometricDeviceProfileTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;
    private User $admin;
    private User $employeeUser;
    private Employee $employee1;
    private Employee $employee2;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
        $this->seed(RolesAndPermissionsSeeder::class);

        $this->tenant = Tenant::create([
            'name' => 'Lanka Garments PLC',
            'slug' => 'lanka-garments',
            'is_active' => true,
        ]);

        session(['tenant_id' => $this->tenant->id]);
        if (function_exists('setPermissionsTeamId')) {
            setPermissionsTeamId($this->tenant->id);
        }

        $this->admin = User::factory()->create([
            'name' => 'IT Admin',
            'email' => 'admin@lankagarments.com',
        ]);
        $this->admin->assignRole('Company Admin');

        $this->employeeUser = User::factory()->create([
            'name' => 'Regular User',
            'email' => 'regular@lankagarments.com',
        ]);

        $this->employee1 = Employee::create([
            'tenant_id' => $this->tenant->id,
            'emp_no' => 'LG-101',
            'full_name' => 'Nimal Jayawardena',
            'nic' => '821234567V',
            'biometric_device_id' => '1001',
            'employment_status' => 'active',
        ]);

        $this->employee2 = Employee::create([
            'tenant_id' => $this->tenant->id,
            'emp_no' => 'LG-102',
            'full_name' => 'Saman Kumara',
            'nic' => '891234567V',
            'biometric_device_id' => '1002',
            'employment_status' => 'active',
        ]);
    }

    public function test_admin_can_create_and_list_biometric_device_profile(): void
    {
        $payload = [
            'name' => 'Colombo HQ - Hikvision MinMoe',
            'device_brand' => 'hikvision',
            'model_name' => 'DS-K1T341AMF',
            'file_extension' => 'txt',
            'delimiter_type' => 'tab',
            'skip_header_lines' => 1,
            'date_mode' => 'combined',
            'date_format' => 'Y-m-d H:i:s',
            'columns_config' => [
                'biometric_id_col' => 2,
                'datetime_col' => 1,
                'punch_type_col' => 5,
                'device_id_col' => 4,
            ],
            'status_code_mapping' => [
                'Check-In' => 'in',
                'Check-Out' => 'out',
            ],
            'default_device_id' => 'GATE-01',
        ];

        $response = $this->actingAs($this->admin)
            ->withHeaders(['X-Tenant-ID' => $this->tenant->id])
            ->postJson('/biometric-devices', $payload);

        $response->assertCreated();
        $response->assertJsonPath('success', true);
        $response->assertJsonPath('data.name', 'Colombo HQ - Hikvision MinMoe');

        $this->assertDatabaseHas('biometric_device_profiles', [
            'tenant_id' => $this->tenant->id,
            'name' => 'Colombo HQ - Hikvision MinMoe',
            'device_brand' => 'hikvision',
            'delimiter_type' => 'tab',
        ]);

        $listResponse = $this->actingAs($this->admin)
            ->withHeaders(['X-Tenant-ID' => $this->tenant->id])
            ->getJson('/biometric-devices');

        $listResponse->assertOk();
        $listResponse->assertJsonCount(1, 'data');
    }

    public function test_unauthorized_user_cannot_manage_profiles(): void
    {
        $payload = [
            'name' => 'Unauthorized Profile',
            'device_brand' => 'zkteco',
            'file_extension' => 'dat',
            'delimiter_type' => 'tab',
            'date_mode' => 'combined',
            'date_format' => 'Y-m-d H:i:s',
            'columns_config' => ['biometric_id_col' => 0, 'datetime_col' => 1],
        ];

        $response = $this->actingAs($this->employeeUser)
            ->withHeaders(['X-Tenant-ID' => $this->tenant->id])
            ->postJson('/biometric-devices', $payload);

        $response->assertForbidden();
    }

    public function test_can_test_parse_raw_hikvision_snippet(): void
    {
        $rawSnippet = "No.\tTime\tCard No.\tName\tDevice\tEvent\n".
                      "1\t2026-03-01 08:30:00\t1001\tNimal\tGate Turnstile\tCheck-In\n".
                      "2\t2026-03-01 17:05:00\t1001\tNimal\tGate Turnstile\tCheck-Out\n";

        $response = $this->actingAs($this->admin)
            ->withHeaders(['X-Tenant-ID' => $this->tenant->id])
            ->postJson('/biometric-devices/test-parse', [
                'raw_content' => $rawSnippet,
                'delimiter_type' => 'tab',
                'skip_header_lines' => 1,
                'date_mode' => 'combined',
                'date_format' => 'Y-m-d H:i:s',
                'columns_config' => [
                    'biometric_id_col' => 2,
                    'datetime_col' => 1,
                    'punch_type_col' => 5,
                    'device_id_col' => 4,
                ],
                'status_code_mapping' => [
                    'Check-In' => 'in',
                    'Check-Out' => 'out',
                ],
            ]);

        $response->assertOk();
        $response->assertJsonPath('success', true);
        $response->assertJsonPath('data.total_parsed', 2);
        $response->assertJsonPath('data.valid_count', 2);
        $response->assertJsonPath('data.valid_samples.0.biometric_id', '1001');
        $response->assertJsonPath('data.valid_samples.0.punch_type', 'in');
        $response->assertJsonPath('data.valid_samples.1.punch_type', 'out');
    }

    public function test_can_test_parse_realand_space_delimited_separate_datetime(): void
    {
        // Realand format: EnrollID Date Time Status Mode
        $rawSnippet = "1001 2026-03-01 08:30:10 0 1\n".
                      "1002 2026-03-01 08:45:22 0 1\n";

        $response = $this->actingAs($this->admin)
            ->withHeaders(['X-Tenant-ID' => $this->tenant->id])
            ->postJson('/biometric-devices/test-parse', [
                'raw_content' => $rawSnippet,
                'delimiter_type' => 'space',
                'skip_header_lines' => 0,
                'date_mode' => 'separate',
                'date_format' => 'Y-m-d H:i:s',
                'columns_config' => [
                    'biometric_id_col' => 0,
                    'date_col' => 1,
                    'time_col' => 2,
                    'punch_type_col' => 3,
                ],
                'status_code_mapping' => [
                    '0' => 'in',
                    '1' => 'out',
                ],
            ]);

        $response->assertOk();
        $response->assertJsonPath('success', true);
        $response->assertJsonPath('data.valid_count', 2);
        $response->assertJsonPath('data.valid_samples.0.biometric_id', '1001');
        $response->assertJsonPath('data.valid_samples.0.punch_datetime', '2026-03-01 08:30:10');
        $response->assertJsonPath('data.valid_samples.0.punch_type', 'in');
    }

    public function test_can_import_attendance_using_saved_device_profile(): void
    {
        $profile = BiometricDeviceProfile::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Katunayake Factory - Realand ZD2F20',
            'device_brand' => 'realand',
            'file_extension' => 'txt',
            'delimiter_type' => 'space',
            'skip_header_lines' => 0,
            'date_mode' => 'separate',
            'date_format' => 'Y-m-d H:i:s',
            'columns_config' => [
                'biometric_id_col' => 0,
                'date_col' => 1,
                'time_col' => 2,
                'punch_type_col' => 3,
            ],
            'status_code_mapping' => [
                '0' => 'in',
                '1' => 'out',
            ],
            'default_device_id' => 'REALAND-01',
            'is_active' => true,
        ]);

        $fileContent = "1001 2026-03-01 08:30:00 0 1\n".
                       "1001 2026-03-01 17:05:00 1 1\n".
                       "1002 2026-03-01 08:45:00 0 1\n";

        $file = UploadedFile::fake()->createWithContent('realand_punches.txt', $fileContent);

        // 1. Preview
        $previewResponse = $this->actingAs($this->admin)
            ->withHeaders(['X-Tenant-ID' => $this->tenant->id])
            ->postJson('/attendance/import/preview', [
                'file' => $file,
                'adapter_type' => 'configurable',
                'profile_id' => $profile->id,
            ]);

        $previewResponse->assertOk();
        $previewResponse->assertJsonPath('success', true);
        $previewResponse->assertJsonPath('data.mapped_count', 3);

        // 2. Commit
        $importResponse = $this->actingAs($this->admin)
            ->withHeaders(['X-Tenant-ID' => $this->tenant->id])
            ->post('/attendance/import', [
                'file' => $file,
                'adapter_type' => 'configurable',
                'profile_id' => $profile->id,
            ]);

        $importResponse->assertRedirect();

        $this->assertDatabaseHas('attendance_imports', [
            'tenant_id' => $this->tenant->id,
            'profile_id' => $profile->id,
            'processed_rows' => 3,
            'status' => 'completed',
        ]);

        $this->assertDatabaseCount('attendance_logs', 3);
        $this->assertDatabaseHas('attendance_logs', [
            'tenant_id' => $this->tenant->id,
            'employee_id' => $this->employee1->id,
            'punch_datetime' => '2026-03-01 08:30:00',
            'punch_type' => 'in',
            'device_id' => 'REALAND-01',
        ]);
        $this->assertDatabaseHas('attendance_logs', [
            'tenant_id' => $this->tenant->id,
            'employee_id' => $this->employee1->id,
            'punch_datetime' => '2026-03-01 17:05:00',
            'punch_type' => 'out',
        ]);
    }

    public function test_space_delimited_12hour_ampm_parses_accurately_and_ignores_unused_columns(): void
    {
        Employee::create([
            'tenant_id' => $this->tenant->id,
            'emp_no' => 'LG-040',
            'full_name' => 'Wimalaratne Perera',
            'nic' => '751234567V',
            'biometric_device_id' => '40',
            'employment_status' => 'active',
        ]);

        $profile = BiometricDeviceProfile::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Factory Terminal - 12 Hour AM/PM',
            'device_brand' => 'other',
            'file_extension' => 'txt',
            'delimiter_type' => 'space',
            'skip_header_lines' => 0,
            'date_mode' => 'separate',
            'date_format' => 'd/m/Y g:i A',
            'columns_config' => [
                'biometric_id_col' => 0,
                'date_col' => 2,
                'time_col' => 3,
                'am_pm_col' => 4,
                'punch_type_col' => 5,
            ],
            'status_code_mapping' => [
                'C/In' => 'in',
                'C/Out' => 'out',
            ],
            'default_device_id' => 'FACTORY-TERMINAL-01',
            'is_active' => true,
        ]);

        $content = "40     40 28/08/2026 7:05 AM C/In OverTime In    FOT\n".
                   "40     40 28/08/2026 2:59 PM C/Out OverTime Out  FOT\n".
                   "40     40 31/08/2026 7:04 AM C/In OverTime In    FOT\n".
                   "40     40 31/08/2026 3:01 PM C/Out OverTime Out  FOT\n";

        $file = UploadedFile::fake()->createWithContent('terminal_punches.txt', $content);

        $previewResponse = $this->actingAs($this->admin)
            ->withHeaders(['X-Tenant-ID' => $this->tenant->id])
            ->postJson('/attendance/import/preview', [
                'file' => $file,
                'adapter_type' => 'configurable',
                'profile_id' => $profile->id,
            ]);

        $previewResponse->assertOk();
        $previewResponse->assertJsonPath('success', true);
        $previewResponse->assertJsonPath('data.mapped_count', 4);
        $previewResponse->assertJsonPath('data.preview_rows.0.punch_datetime', '2026-08-28 07:05:00');
        $previewResponse->assertJsonPath('data.preview_rows.0.punch_type', 'in');
        $previewResponse->assertJsonPath('data.preview_rows.1.punch_datetime', '2026-08-28 14:59:00');
        $previewResponse->assertJsonPath('data.preview_rows.1.punch_type', 'out');

        $importResponse = $this->actingAs($this->admin)
            ->withHeaders(['X-Tenant-ID' => $this->tenant->id])
            ->post('/attendance/import', [
                'file' => $file,
                'adapter_type' => 'configurable',
                'profile_id' => $profile->id,
            ]);

        $importResponse->assertRedirect();

        $this->assertDatabaseHas('attendance_logs', [
            'tenant_id' => $this->tenant->id,
            'punch_datetime' => '2026-08-28 07:05:00',
            'punch_type' => 'in',
            'device_id' => 'FACTORY-TERMINAL-01',
        ]);

        $this->assertDatabaseHas('attendance_logs', [
            'tenant_id' => $this->tenant->id,
            'punch_datetime' => '2026-08-28 14:59:00',
            'punch_type' => 'out',
            'device_id' => 'FACTORY-TERMINAL-01',
        ]);

        $this->assertDatabaseHas('attendance_logs', [
            'tenant_id' => $this->tenant->id,
            'punch_datetime' => '2026-08-31 15:01:00',
            'punch_type' => 'out',
            'device_id' => 'FACTORY-TERMINAL-01',
        ]);
    }

    public function test_admin_can_access_biometric_settings_page(): void
    {
        $response = $this->actingAs($this->admin)
            ->withHeaders(['X-Tenant-ID' => $this->tenant->id])
            ->get('/settings/biometric');

        $response->assertOk();
    }

    public function test_admin_can_set_custom_biometric_profile_as_tenant_default(): void
    {
        $profile = BiometricDeviceProfile::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Main Gate Scanner',
            'device_brand' => 'zkteco',
            'columns_config' => ['biometric_id_col' => 0, 'datetime_col' => 1],
            'is_active' => true,
        ]);

        $response = $this->actingAs($this->admin)
            ->withHeaders(['X-Tenant-ID' => $this->tenant->id])
            ->postJson('/settings/biometric/default', [
                'adapter_type' => 'configurable',
                'profile_id' => $profile->id,
            ]);

        $response->assertOk();
        $response->assertJsonPath('success', true);

        $this->tenant->refresh();
        $this->assertSame('configurable', $this->tenant->getSetting('active_biometric_adapter'));
        $this->assertSame($profile->id, $this->tenant->getSetting('active_biometric_profile_id'));

        $profile->refresh();
        $this->assertTrue($profile->is_default);
    }

    public function test_admin_can_set_standard_adapter_as_tenant_default(): void
    {
        $response = $this->actingAs($this->admin)
            ->withHeaders(['X-Tenant-ID' => $this->tenant->id])
            ->postJson('/settings/biometric/default', [
                'adapter_type' => 'generic_csv',
            ]);

        $response->assertOk();
        $response->assertJsonPath('success', true);

        $this->tenant->refresh();
        $this->assertSame('generic_csv', $this->tenant->getSetting('active_biometric_adapter'));
        $this->assertNull($this->tenant->getSetting('active_biometric_profile_id'));
    }

    public function test_default_biometric_profile_is_isolated_between_tenants(): void
    {
        $tenant2 = Tenant::create([
            'name' => 'Second Company Ltd',
            'slug' => 'second-company',
            'is_active' => true,
        ]);

        $profile1 = BiometricDeviceProfile::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Company 1 Profile',
            'device_brand' => 'zkteco',
            'columns_config' => ['biometric_id_col' => 0, 'datetime_col' => 1],
            'is_active' => true,
        ]);

        $profile2 = BiometricDeviceProfile::create([
            'tenant_id' => $tenant2->id,
            'name' => 'Company 2 Profile',
            'device_brand' => 'hikvision',
            'columns_config' => ['biometric_id_col' => 0, 'datetime_col' => 1],
            'is_active' => true,
        ]);

        // Set Company 1 default
        $this->actingAs($this->admin)
            ->withHeaders(['X-Tenant-ID' => $this->tenant->id])
            ->postJson('/settings/biometric/default', [
                'adapter_type' => 'configurable',
                'profile_id' => $profile1->id,
            ]);

        $profile1->refresh();
        $profile2->refresh();

        $this->assertTrue($profile1->is_default);
        $this->assertFalse($profile2->is_default);

        $this->assertSame('configurable', $this->tenant->getSetting('active_biometric_adapter'));
        $this->assertNull($tenant2->getSetting('active_biometric_adapter'));
    }

    public function test_unauthorized_user_cannot_set_default_biometric_configuration(): void
    {
        $response = $this->actingAs($this->employeeUser)
            ->withHeaders(['X-Tenant-ID' => $this->tenant->id])
            ->postJson('/settings/biometric/default', [
                'adapter_type' => 'zkteco',
            ]);

        $response->assertForbidden();
    }
}
