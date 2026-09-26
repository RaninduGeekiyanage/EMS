<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\BiometricDeviceProfile;
use App\Models\Employee;
use App\Models\RawBiometricPunch;
use App\Models\Tenant;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

final class RawBiometricPunchSeeder extends Seeder
{
    /**
     * Run the database seeds for raw biometric staging punches.
     */
    public function run(): void
    {
        $tenants = Tenant::where('is_active', true)->get();

        if ($tenants->isEmpty()) {
            $this->command?->warn('No active tenants found. Run DatabaseSeeder first.');

            return;
        }

        foreach ($tenants as $tenant) {
            $this->seedForTenant($tenant);
        }
    }

    private function seedForTenant(Tenant $tenant): void
    {
        session(['tenant_id' => $tenant->id]);
        app()->instance('current_tenant', $tenant);
        app()->instance('current_tenant_id', $tenant->id);

        $this->command?->info("Seeding raw biometric punches for tenant: {$tenant->name} ({$tenant->slug})");

        // 1. Ensure a Database Staging Device Profile exists
        BiometricDeviceProfile::firstOrCreate(
            [
                'tenant_id' => $tenant->id,
                'source_type' => 'database_staging',
            ],
            [
                'name' => 'HQ Terminal Staging DB',
                'device_brand' => 'zkteco',
                'model_name' => 'Direct DB Staging Table',
                'file_extension' => 'none',
                'delimiter_type' => 'staging_db',
                'skip_header_lines' => 0,
                'date_mode' => 'combined',
                'date_format' => 'Y-m-d H:i:s',
                'columns_config' => [
                    'raw_user_id_col' => 'raw_user_id',
                    'punch_time_col' => 'punch_time',
                    'punch_type_col' => 'punch_type',
                    'device_sn_col' => 'device_sn',
                ],
                'status_code_mapping' => [
                    '0' => 'in',
                    '1' => 'out',
                    'in' => 'in',
                    'out' => 'out',
                    'auto' => 'auto',
                ],
                'default_device_id' => 'ZK-LOBBY-01',
                'is_active' => true,
                'is_default' => false,
            ]
        );

        // 2. Fetch or update employees with predictable biometric_device_id values
        $employees = Employee::where('tenant_id', $tenant->id)
            ->where('employment_status', 'active')
            ->orderBy('emp_no')
            ->get();

        if ($employees->isEmpty()) {
            $this->command?->warn("No active employees found for tenant {$tenant->slug}. Run AmsDemoSeeder first.");

            return;
        }

        // Assign biometric IDs (1001, 1002, ...) if not already set
        $pinCounter = 1001;
        $mappedBioIds = [];

        foreach ($employees as $employee) {
            if (empty($employee->biometric_device_id)) {
                $assignedBioId = (string) $pinCounter;
                $employee->update(['biometric_device_id' => $assignedBioId]);
                $mappedBioIds[] = $assignedBioId;
            } else {
                $mappedBioIds[] = (string) $employee->biometric_device_id;
            }
            $pinCounter++;
        }

        // 3. Clean up any previous pending test punches to allow repeatable manual testing
        RawBiometricPunch::where('tenant_id', $tenant->id)
            ->where('status', 'pending')
            ->delete();

        // 4. Construct realistic punch log events across yesterday and today
        $now = Carbon::now();
        $yesterday = Carbon::yesterday();
        $today = Carbon::today();

        $devices = ['ZK-LOBBY-01', 'ZK-PLANT-02', 'HIK-MAIN-GATE'];

        $samplePunches = [];

        // Yesterday's punches for first 5 mapped employees (In & Out)
        foreach (array_slice($mappedBioIds, 0, 5) as $idx => $bioId) {
            $device = $devices[$idx % count($devices)];

            $inMinutes = 5 * ($idx % 5);
            $outMinutes = 3 * ($idx % 4);

            $inTime = $yesterday->copy()->setTime(8, $inMinutes, rand(10, 55))->format('Y-m-d H:i:s');
            $outTime = $yesterday->copy()->setTime(17, $outMinutes, rand(10, 55))->format('Y-m-d H:i:s');

            $samplePunches[] = [
                'device_sn' => $device,
                'raw_user_id' => $bioId,
                'punch_time' => $inTime,
                'punch_type' => 'in',
            ];

            $samplePunches[] = [
                'device_sn' => $device,
                'raw_user_id' => $bioId,
                'punch_time' => $outTime,
                'punch_type' => 'out',
            ];
        }

        // Today's morning punches for all available employees
        foreach ($mappedBioIds as $idx => $bioId) {
            $device = $devices[$idx % count($devices)];
            $minute = rand(0, 35);
            $inTime = $today->copy()->setTime(8, $minute, rand(0, 59))->format('Y-m-d H:i:s');

            $samplePunches[] = [
                'device_sn' => $device,
                'raw_user_id' => $bioId,
                'punch_time' => $inTime,
                'punch_type' => 'in',
            ];
        }

        // Unmapped Biometric IDs (so tester can manually test "Unmapped Biometric IDs" alert & map button)
        $unmappedIds = ['9999', '8888'];
        foreach ($unmappedIds as $idx => $unmappedPin) {
            $samplePunches[] = [
                'device_sn' => 'ZK-LOBBY-01',
                'raw_user_id' => $unmappedPin,
                'punch_time' => $today->copy()->setTime(8, 20 + ($idx * 15), 10)->format('Y-m-d H:i:s'),
                'punch_type' => 'in',
            ];
            $samplePunches[] = [
                'device_sn' => 'ZK-LOBBY-01',
                'raw_user_id' => $unmappedPin,
                'punch_time' => $yesterday->copy()->setTime(8, 25 + ($idx * 10), 45)->format('Y-m-d H:i:s'),
                'punch_type' => 'in',
            ];
        }

        // Insert into raw_biometric_punches
        $insertedCount = 0;
        foreach ($samplePunches as $p) {
            RawBiometricPunch::create([
                'id' => (string) Str::ulid(),
                'tenant_id' => $tenant->id,
                'device_sn' => $p['device_sn'],
                'raw_user_id' => $p['raw_user_id'],
                'punch_time' => $p['punch_time'],
                'punch_type' => $p['punch_type'],
                'status' => 'pending',
                'imported_at' => null,
                'attendance_log_id' => null,
                'raw_payload' => json_encode($p),
            ]);
            $insertedCount++;
        }

        $this->command?->info("✓ Successfully seeded {$insertedCount} pending raw biometric punches ({$employees->count()} employees, 2 unmapped PINs: 9999, 8888).");
    }
}
