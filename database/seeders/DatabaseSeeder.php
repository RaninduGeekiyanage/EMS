<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\Tenant;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $this->call(RolesAndPermissionsSeeder::class);

        // 1. Seed Global Super Admin (tenant_id = null)
        $superAdmin = User::updateOrCreate(
            ['email' => 'ranindu.rag@gmail.com'],
            [
                'name' => 'Ranindu (Super Admin)',
                'password' => Hash::make('123123123'),
                'tenant_id' => null,
                'is_super_admin' => true,
                'email_verified_at' => now(),
            ]
        );

        // 2. Seed Default Tenant (Ceylon Tea Co.)
        $tenant = Tenant::firstOrCreate(
            ['slug' => 'ceylon-tea'],
            [
                'name' => 'Ceylon Tea Co.',
                'is_active' => true,
                'is_ams_enabled' => true,
                'is_payroll_enabled' => true,
            ]
        );

        // 3. Seed Company Owner for Ceylon Tea Co.
        if (function_exists('setPermissionsTeamId')) {
            setPermissionsTeamId($tenant->id);
        }

        $owner = User::updateOrCreate(
            ['email' => 'owner@ceylon-tea.com'],
            [
                'name' => 'Tea Co. Owner',
                'password' => Hash::make('123123123'),
                'tenant_id' => $tenant->id,
                'email_verified_at' => now(),
            ]
        );

        if (! $owner->hasRole('Company Owner')) {
            $owner->assignRole('Company Owner');
        }

        // 3b. Seed requested Company Admin wasansl@gmail.com
        $wasanAdmin = User::updateOrCreate(
            ['email' => 'wasanasl@gmail.com'],
            [
                'name' => 'Wasan (Company Admin)',
                'password' => Hash::make('123123123'),
                'tenant_id' => $tenant->id,
                'email_verified_at' => now(),
            ]
        );

        if (! $wasanAdmin->hasRole('Company Owner')) {
            $wasanAdmin->assignRole('Company Owner');
        }

        // 4. Populate Shift Presets & Sri Lankan Holidays for Tenant
        session(['tenant_id' => $tenant->id]);
        app()->instance('current_tenant', $tenant);
        app()->instance('current_tenant_id', $tenant->id);

        $shiftService = app(\App\Services\ShiftService::class);
        $shiftService->seedStandardTemplates();
        $shiftService->seedSriLankanHolidays((int) now()->year);

        // 5. Populate Realistic Sri Lankan AMS Shift Groups & Scenarios
        $this->call(AmsDemoSeeder::class);
    }
}
