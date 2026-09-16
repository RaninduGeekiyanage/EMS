<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Models\Employee;
use App\Models\PublicHoliday;
use App\Models\Shift;
use App\Models\Tenant;
use App\Services\ShiftService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

final class ShiftServiceTest extends TestCase
{
    use RefreshDatabase;

    private ShiftService $shiftService;
    private Tenant $tenant;

    protected function setUp(): void
    {
        parent::setUp();

        $this->tenant = Tenant::create(['name' => 'Tea Corp', 'slug' => 'tea-corp', 'is_active' => true]);
        session(['tenant_id' => $this->tenant->id]);
        app()->instance('current_tenant_id', $this->tenant->id);

        $this->shiftService = app(ShiftService::class);
    }

    public function test_can_seed_standard_sri_lanka_presets(): void
    {
        $presets = $this->shiftService->seedStandardTemplates();

        $this->assertCount(6, $presets);
        $this->assertDatabaseHas('shifts', ['code' => 'GEN-DAY', 'shift_type' => 'regular']);
        $this->assertDatabaseHas('shifts', ['code' => 'ROT-NIGHT', 'is_night_shift' => true]);
        $this->assertDatabaseHas('shifts', ['code' => 'SAT-HALF', 'shift_type' => 'half_day']);
    }

    public function test_can_assign_and_resolve_effective_shift_for_employee(): void
    {
        $shift = $this->shiftService->createShift([
            'name' => 'Day Shift',
            'code' => 'DAY-01',
            'shift_type' => 'regular',
            'start_time' => '08:00',
            'end_time' => '17:00',
            'break_minutes' => 60,
            'grace_minutes' => 10,
            'ot_threshold_minutes' => 480,
        ]);

        $employee = Employee::create([
            'emp_no' => 'EMP-100',
            'nic' => '199512345678',
            'full_name' => 'Nimal Silva',
            'employment_type' => 'permanent',
            'employment_status' => 'active',
        ]);

        $this->shiftService->assignShift([
            'employee_id' => $employee->id,
            'shift_id' => $shift->id,
            'effective_from' => '2026-03-01',
            'effective_to' => null,
        ]);

        $effectiveShift = $this->shiftService->getEffectiveShiftForEmployee($employee, Carbon::parse('2026-03-15'));
        $this->assertNotNull($effectiveShift);
        $this->assertEquals($shift->id, $effectiveShift->id);

        // Before assignment start date
        $beforeShift = $this->shiftService->getEffectiveShiftForEmployee($employee, Carbon::parse('2026-02-28'));
        $this->assertNull($beforeShift);
    }

    public function test_can_seed_sri_lankan_holidays_and_check_is_holiday(): void
    {
        $holidays = $this->shiftService->seedSriLankanHolidays(2026);
        $this->assertNotEmpty($holidays);

        // May Day test
        $isMayDay = $this->shiftService->isHoliday(Carbon::parse('2026-05-01'));
        $this->assertNotNull($isMayDay);
        $this->assertEquals('May Day (International Workers\' Day)', $isMayDay->name);
        $this->assertEquals('statutory', $isMayDay->type);

        // Non-holiday test
        $nonHoliday = $this->shiftService->isHoliday(Carbon::parse('2026-05-02'));
        $this->assertNull($nonHoliday);
    }
}
