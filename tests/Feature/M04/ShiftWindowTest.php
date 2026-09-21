<?php

declare(strict_types=1);

namespace Tests\Feature\M04;

use App\Models\Shift;
use App\Models\Tenant;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

final class ShiftWindowTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;
    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(\Database\Seeders\RolesAndPermissionsSeeder::class);

        $this->tenant = Tenant::create([
            'name' => 'Acme Corporation',
            'slug' => 'acme',
            'is_active' => true,
            'is_ams_enabled' => true,
        ]);

        session(['tenant_id' => $this->tenant->id]);
        if (function_exists('setPermissionsTeamId')) {
            setPermissionsTeamId($this->tenant->id);
        }

        $this->admin = User::factory()->create([
            'tenant_id' => $this->tenant->id,
            'is_super_admin' => false,
        ]);
        $this->admin->assignRole('HR Manager');
    }

    public function test_can_create_shift_with_sliding_punch_windows_and_cutoffs(): void
    {
        $response = $this->actingAs($this->admin)->post('/shifts', [
            'name' => 'Morning Sliding Shift',
            'code' => 'MORN-SLIDE',
            'shift_type' => 'regular',
            'start_time' => '08:00',
            'end_time' => '17:00',
            'break_minutes' => 60,
            'grace_minutes' => 15,
            'ot_threshold_minutes' => 480,
            'is_night_shift' => false,
            'in_window_before_start' => 45,
            'in_window_after_start' => 90,
            'out_window_before_end' => 60,
            'out_window_after_end' => 150,
            'first_half_end_time' => '12:30',
            'second_half_start_time' => '13:30',
            'early_in_as_ot' => true,
            'early_in_as_att_in' => true,
            'color' => '#10B981',
            'is_active' => true,
        ]);

        $response->assertRedirect();

        $shift = Shift::where('code', 'MORN-SLIDE')->first();
        $this->assertNotNull($shift);
        $this->assertSame(45, $shift->in_window_before_start);
        $this->assertSame(90, $shift->in_window_after_start);
        $this->assertSame(60, $shift->out_window_before_end);
        $this->assertSame(150, $shift->out_window_after_end);
        $this->assertTrue($shift->early_in_as_ot);
        $this->assertSame(480, $shift->working_minutes); // 9h gross - 1h break = 8h (480m)

        // Test window resolution helper
        $date = Carbon::parse('2026-09-21');
        [$inStart, $inEnd] = $shift->getInWindow($date);
        $this->assertSame('2026-09-21 07:15:00', $inStart->toDateTimeString());
        $this->assertSame('2026-09-21 09:30:00', $inEnd->toDateTimeString());

        [$outStart, $outEnd] = $shift->getOutWindow($date);
        $this->assertSame('2026-09-21 16:00:00', $outStart->toDateTimeString());
        $this->assertSame('2026-09-21 19:30:00', $outEnd->toDateTimeString());
    }
}
