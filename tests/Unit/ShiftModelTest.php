<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Models\Employee;
use App\Models\Shift;
use App\Models\ShiftAssignment;
use App\Models\Tenant;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

final class ShiftModelTest extends TestCase
{
    use RefreshDatabase;

    public function test_shift_can_be_created_with_ulid(): void
    {
        $tenant = Tenant::create(['name' => 'Tea Corp', 'slug' => 'tea-corp', 'is_active' => true]);
        session(['tenant_id' => $tenant->id]);
        app()->instance('current_tenant_id', $tenant->id);

        $shift = Shift::create([
            'name' => 'General Day Shift',
            'code' => 'GEN-DAY',
            'shift_type' => 'regular',
            'start_time' => '08:30:00',
            'end_time' => '17:00:00',
            'break_minutes' => 60,
            'grace_minutes' => 10,
            'ot_threshold_minutes' => 480,
            'is_night_shift' => false,
            'is_active' => true,
        ]);

        $this->assertNotEmpty($shift->id);
        $this->assertEquals(26, strlen($shift->id)); // ULID length
        $this->assertEquals('GEN-DAY', $shift->code);
        $this->assertEquals(60, $shift->break_minutes);
        $this->assertFalse($shift->is_night_shift);
    }

    public function test_shift_assignment_relationships(): void
    {
        $tenant = Tenant::create(['name' => 'Tea Corp', 'slug' => 'tea-corp', 'is_active' => true]);
        session(['tenant_id' => $tenant->id]);
        app()->instance('current_tenant_id', $tenant->id);

        $shift = Shift::create([
            'name' => 'Morning Shift',
            'code' => 'ROT-MORN',
            'shift_type' => 'rotational',
            'start_time' => '06:00:00',
            'end_time' => '14:00:00',
            'break_minutes' => 30,
            'grace_minutes' => 10,
            'ot_threshold_minutes' => 480,
        ]);

        $employee = Employee::create([
            'emp_no' => 'EMP-001',
            'nic' => '199012345678',
            'full_name' => 'Kasun Chamara',
            'employment_type' => 'permanent',
            'employment_status' => 'active',
        ]);

        $assignment = ShiftAssignment::create([
            'employee_id' => $employee->id,
            'shift_id' => $shift->id,
            'effective_from' => '2026-01-01',
        ]);

        $this->assertCount(1, $shift->assignments);
        $this->assertEquals($employee->id, $shift->assignments->first()->employee_id);
        $this->assertCount(1, $employee->shiftAssignments);
        $this->assertEquals($shift->id, $employee->shiftAssignments->first()->shift_id);
    }
}
