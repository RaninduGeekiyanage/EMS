<?php

declare(strict_types=1);

namespace Database\Seeders;

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
        User::updateOrCreate(
            ['email' => 'ranindu.rag@gmail.com'],
            [
                'name' => 'Ranindu',
                'password' => Hash::make('123123123'),
                'email_verified_at' => now(),
            ]
        );
    }
}
