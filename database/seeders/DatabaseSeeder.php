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

        $user = User::updateOrCreate(
            ['email' => 'ranindu.rag@gmail.com'],
            [
                'name' => 'Ranindu',
                'password' => Hash::make('123123123'),
                'email_verified_at' => now(),
            ]
        );

        $tenant = Tenant::firstOrCreate(
            ['slug' => 'ceylon-tea'],
            [
                'name' => 'Ceylon Tea Co.',
                'is_active' => true,
            ]
        );

        if (function_exists('setPermissionsTeamId')) {
            setPermissionsTeamId($tenant->id);
        }

        if (! $user->hasRole('Super Admin')) {
            $user->assignRole('Super Admin');
        }

        // Populate Shift Presets & Sri Lankan Holidays for Tenant
        session(['tenant_id' => $tenant->id]);
        app()->instance('current_tenant', $tenant);
        app()->instance('current_tenant_id', $tenant->id);

        $shiftService = app(\App\Services\ShiftService::class);
        $shiftService->seedStandardTemplates();
        $shiftService->seedSriLankanHolidays((int) now()->year);
    }
}
