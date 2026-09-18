<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Models\Department;
use App\Models\Employee;
use App\Models\RosterEntry;
use App\Models\Shift;
use App\Models\Tenant;
use App\Services\RosterService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

final class RosterServiceTest extends TestCase
{
    use RefreshDatabase;

    private RosterService $rosterService;
    private Tenant $tenant;
    private Shift $dayShift;
    private Shift $nightShift;
    private Employee $employeeA;
    private Employee $employeeB;

    protected function setUp(): void
    {
        parent::setUp();

        $this->tenant = Tenant::create(['name' => 'Highland Tea Ltd', 'slug' => 'highland-tea', 'is_active' => true]);
        session(['tenant_id' => $this->tenant->id]);
        app()->instance('current_tenant_id', $this->tenant->id);

        $this->dayShift = Shift::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Day Shift',
            'code' => 'DAY-01',
            'shift_type' => 'regular',
            'start_time' => '08:30:00',
            'end_time' => '17:00:00',
            'break_minutes' => 60,
            'grace_minutes' => 10,
            'ot_threshold_minutes' => 480,
            'is_night_shift' => false,
        ]);

        $this->nightShift = Shift::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Night Shift',
            'code' => 'NIGHT-01',
            'shift_type' => 'night',
            'start_time' => '22:00:00',
            'end_time' => '06:00:00',
            'break_minutes' => 30,
            'grace_minutes' => 10,
            'ot_threshold_minutes' => 480,
            'is_night_shift' => true,
        ]);

        $this->employeeA = Employee::create([
            'tenant_id' => $this->tenant->id,
            'emp_no' => 'EMP-001',
            'nic' => '199012345678',
            'full_name' => 'Kasun Perera',
            'employment_type' => 'permanent',
            'employment_status' => 'active',
        ]);

        $this->employeeB = Employee::create([
            'tenant_id' => $this->tenant->id,
            'emp_no' => 'EMP-002',
            'nic' => '199212345679',
            'full_name' => 'Chamara Silva',
            'employment_type' => 'permanent',
            'employment_status' => 'active',
        ]);

        $this->rosterService = app(RosterService::class);
    }

    public function test_can_generate_weekly_pattern_roster_across_month(): void
    {
        // Weekly config: Mon-Fri Day Shift, Sat-Sun Rest Days
        $weeklyConfig = [
            0 => ['shift_id' => $this->dayShift->id, 'is_rest_day' => false], // Mon
            1 => ['shift_id' => $this->dayShift->id, 'is_rest_day' => false], // Tue
            2 => ['shift_id' => $this->dayShift->id, 'is_rest_day' => false], // Wed
            3 => ['shift_id' => $this->dayShift->id, 'is_rest_day' => false], // Thu
            4 => ['shift_id' => $this->dayShift->id, 'is_rest_day' => false], // Fri
            5 => ['shift_id' => null, 'is_rest_day' => true],                  // Sat
            6 => ['shift_id' => null, 'is_rest_day' => true],                  // Sun
        ];

        $result = $this->rosterService->generateRoster([
            'employee_ids' => [$this->employeeA->id],
            'start_date' => '2026-05-01',
            'end_date' => '2026-05-31',
            'pattern_mode' => 'weekly',
            'weekly_config' => $weeklyConfig,
            'status' => 'published',
        ]);

        $this->assertEquals(31, $result['total']);
        $this->assertEquals(31, $result['created']);

        // Check a Monday (e.g., 2026-05-04 is a Monday)
        $mondayEntry = RosterEntry::where('employee_id', $this->employeeA->id)
            ->whereDate('roster_date', '2026-05-04')
            ->first();

        $this->assertNotNull($mondayEntry);
        $this->assertEquals('shift', $mondayEntry->schedule_type);
        $this->assertEquals($this->dayShift->id, $mondayEntry->shift_id);

        // Check a Sunday (e.g., 2026-05-03 is a Sunday)
        $sundayEntry = RosterEntry::where('employee_id', $this->employeeA->id)
            ->whereDate('roster_date', '2026-05-03')
            ->first();

        $this->assertNotNull($sundayEntry);
        $this->assertEquals('rest_day', $sundayEntry->schedule_type);
        $this->assertNull($sundayEntry->shift_id);
    }

    public function test_can_generate_cyclical_rolling_rotation(): void
    {
        // 4-on-2-off cycle: 4 days Night Shift, 2 days Rest Day (6-day cycle)
        $steps = [
            ['shift_id' => $this->nightShift->id, 'is_rest_day' => false, 'notes' => 'Night 1'],
            ['shift_id' => $this->nightShift->id, 'is_rest_day' => false, 'notes' => 'Night 2'],
            ['shift_id' => $this->nightShift->id, 'is_rest_day' => false, 'notes' => 'Night 3'],
            ['shift_id' => $this->nightShift->id, 'is_rest_day' => false, 'notes' => 'Night 4'],
            ['shift_id' => null, 'is_rest_day' => true, 'notes' => 'Off 1'],
            ['shift_id' => null, 'is_rest_day' => true, 'notes' => 'Off 2'],
        ];

        $result = $this->rosterService->generateRoster([
            'employee_ids' => [$this->employeeB->id],
            'start_date' => '2026-06-01',
            'end_date' => '2026-06-30',
            'pattern_mode' => 'cyclical',
            'cyclical_config' => [
                'anchor_date' => '2026-06-01',
                'steps' => $steps,
            ],
            'status' => 'published',
        ]);

        $this->assertEquals(30, $result['total']);

        // Days 1..4 (2026-06-01..04) should be Night Shift
        for ($d = 1; $d <= 4; $d++) {
            $date = sprintf('2026-06-%02d', $d);
            $entry = RosterEntry::where('employee_id', $this->employeeB->id)
                ->whereDate('roster_date', $date)
                ->first();
            $this->assertEquals('shift', $entry?->schedule_type);
            $this->assertEquals($this->nightShift->id, $entry?->shift_id);
        }

        // Days 5..6 (2026-06-05..06) should be Rest Days
        for ($d = 5; $d <= 6; $d++) {
            $date = sprintf('2026-06-%02d', $d);
            $entry = RosterEntry::where('employee_id', $this->employeeB->id)
                ->whereDate('roster_date', $date)
                ->first();
            $this->assertEquals('rest_day', $entry?->schedule_type);
        }

        // Day 7 (2026-06-07) starts cycle again -> Night Shift
        $entryDay7 = RosterEntry::where('employee_id', $this->employeeB->id)
            ->whereDate('roster_date', '2026-06-07')
            ->first();
        $this->assertEquals('shift', $entryDay7?->schedule_type);
        $this->assertEquals($this->nightShift->id, $entryDay7?->shift_id);
    }

    public function test_can_update_single_cell_and_mark_overridden(): void
    {
        $date = '2026-05-10';

        $entry = $this->rosterService->updateEntry(
            $this->employeeA->id,
            $date,
            $this->nightShift->id,
            'shift',
            'Emergency night shift swap'
        );

        $this->assertTrue($entry->is_overridden);
        $this->assertEquals($this->nightShift->id, $entry->shift_id);
        $this->assertEquals('Emergency night shift swap', $entry->notes);
    }

    public function test_can_atomically_swap_shifts_between_two_employees(): void
    {
        $date = '2026-05-15';

        // Employee A on Day Shift
        $this->rosterService->updateEntry($this->employeeA->id, $date, $this->dayShift->id, 'shift');

        // Employee B on Night Shift
        $this->rosterService->updateEntry($this->employeeB->id, $date, $this->nightShift->id, 'shift');

        // Execute Swap
        $swapResult = $this->rosterService->swapShift($this->employeeA->id, $this->employeeB->id, $date);

        // Employee A should now have Night Shift
        $this->assertEquals($this->nightShift->id, $swapResult['employee_a']->shift_id);

        // Employee B should now have Day Shift
        $this->assertEquals($this->dayShift->id, $swapResult['employee_b']->shift_id);
    }

    public function test_can_publish_and_revert_roster_status(): void
    {
        $this->rosterService->generateRoster([
            'employee_ids' => [$this->employeeA->id],
            'start_date' => '2026-07-01',
            'end_date' => '2026-07-31',
            'pattern_mode' => 'daily',
            'daily_config' => ['shift_id' => $this->dayShift->id, 'rest_days' => ['Sunday']],
            'status' => 'draft',
        ]);

        $draftCount = RosterEntry::where('employee_id', $this->employeeA->id)->where('status', 'draft')->count();
        $this->assertEquals(31, $draftCount);

        // Publish
        $this->rosterService->publishRoster(2026, 7, null, true);
        $publishedCount = RosterEntry::where('employee_id', $this->employeeA->id)->where('status', 'published')->count();
        $this->assertEquals(31, $publishedCount);

        // Revert to draft
        $this->rosterService->publishRoster(2026, 7, null, false);
        $revertedDraftCount = RosterEntry::where('employee_id', $this->employeeA->id)->where('status', 'draft')->count();
        $this->assertEquals(31, $revertedDraftCount);
    }
}
