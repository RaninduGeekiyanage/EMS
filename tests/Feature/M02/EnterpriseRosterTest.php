<?php

declare(strict_types=1);

namespace Tests\Feature\M02;

use App\Models\Department;
use App\Models\Employee;
use App\Models\Roster;
use App\Models\RosterEntry;
use App\Models\RosterGroup;
use App\Models\RosterPattern;
use App\Models\Shift;
use App\Models\Tenant;
use App\Models\User;
use App\Services\RosterService;
use App\Services\ShiftService;
use Carbon\Carbon;
use DomainException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

final class EnterpriseRosterTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;
    private User $admin;
    private Department $dept;
    private Employee $emp1;
    private Employee $emp2;
    private Shift $morningShift;
    private Shift $nightShift;

    protected function setUp(): void
    {
        parent::setUp();

        $this->tenant = Tenant::create([
            'name' => 'Acme Industrial',
            'slug' => 'acme-ind',
            'is_ams_enabled' => true,
        ]);

        $this->admin = User::factory()->create([
            'tenant_id' => $this->tenant->id,
            'is_super_admin' => true,
        ]);

        session(['tenant_id' => $this->tenant->id]);
        app()->instance('current_tenant', $this->tenant);
        app()->instance('current_tenant_id', $this->tenant->id);

        $this->dept = Department::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Plant Operations',
            'code' => 'PLANT',
        ]);

        $this->emp1 = Employee::create([
            'tenant_id' => $this->tenant->id,
            'department_id' => $this->dept->id,
            'emp_no' => 'EMP-001',
            'nic' => '198810203040',
            'full_name' => 'Alice Operator',
            'employment_type' => 'permanent',
            'employment_status' => 'active',
        ]);

        $this->emp2 = Employee::create([
            'tenant_id' => $this->tenant->id,
            'department_id' => $this->dept->id,
            'emp_no' => 'EMP-002',
            'nic' => '199020304050',
            'full_name' => 'Bob Technician',
            'employment_type' => 'permanent',
            'employment_status' => 'active',
        ]);

        $this->morningShift = Shift::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Morning Shift',
            'code' => 'MORN',
            'start_time' => '06:00:00',
            'end_time' => '14:00:00',
            'color' => '#3b82f6',
        ]);

        $this->nightShift = Shift::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Night Shift',
            'code' => 'NIGHT',
            'start_time' => '22:00:00',
            'end_time' => '06:00:00',
            'is_night_shift' => true,
            'color' => '#ec4899',
        ]);
    }

    public function test_can_create_named_roster_header_and_publish(): void
    {
        $rosterService = app(RosterService::class);

        $roster = $rosterService->createRoster([
            'name' => 'October 2026 - Operations',
            'department_id' => $this->dept->id,
            'start_date' => '2026-10-01',
            'end_date' => '2026-10-31',
            'status' => 'draft',
        ]);

        $this->assertDatabaseHas('rosters', [
            'id' => $roster->id,
            'name' => 'October 2026 - Operations',
            'status' => 'draft',
        ]);

        // Publish roster
        $rosterService->publishNamedRoster($roster, true);

        $this->assertDatabaseHas('rosters', [
            'id' => $roster->id,
            'status' => 'published',
        ]);
    }

    public function test_squad_enrollment_and_exclusivity_prevents_double_booking(): void
    {
        $rosterService = app(RosterService::class);

        // Roster 1: Plant Operations (Oct 1 - Oct 31)
        $roster1 = $rosterService->createRoster([
            'name' => 'October 2026 - Operations',
            'department_id' => $this->dept->id,
            'start_date' => '2026-10-01',
            'end_date' => '2026-10-31',
            'status' => 'published',
        ]);

        $squad1 = $rosterService->createSquad($roster1, [
            'name' => 'Squad A - Morning',
            'code' => 'SQD-A',
        ]);

        // Enroll emp1 into Squad 1
        $enrolled = $rosterService->enrollEmployees($squad1, [$this->emp1->id]);
        $this->assertContains($this->emp1->id, $enrolled);

        // Roster 2: Security (Overlapping Oct 1 - Oct 31)
        $roster2 = $rosterService->createRoster([
            'name' => 'October 2026 - Security',
            'start_date' => '2026-10-01',
            'end_date' => '2026-10-31',
            'status' => 'draft',
        ]);

        $squad2 = $rosterService->createSquad($roster2, [
            'name' => 'Security Squad Alpha',
            'code' => 'SEC-ALPHA',
        ]);

        // Attempting to enroll emp1 into Roster 2 must fail due to exclusivity!
        $this->expectException(DomainException::class);
        $rosterService->enrollEmployees($squad2, [$this->emp1->id]);
    }

    public function test_operational_override_preserves_original_shift_and_logs_audit_reason(): void
    {
        $rosterService = app(RosterService::class);

        $roster = $rosterService->createRoster([
            'name' => 'October 2026 - Operations',
            'start_date' => '2026-10-01',
            'end_date' => '2026-10-31',
            'status' => 'published',
        ]);

        // Create base planned shift for emp1 on 2026-10-15
        $initialEntry = RosterEntry::create([
            'tenant_id' => $this->tenant->id,
            'roster_id' => $roster->id,
            'employee_id' => $this->emp1->id,
            'roster_date' => '2026-10-15',
            'shift_id' => $this->morningShift->id,
            'schedule_type' => 'shift',
            'status' => 'published',
            'is_overridden' => false,
        ]);

        // Supervisor overrides to Night Shift with reason 'Sick Cover'
        $this->actingAs($this->admin);
        $updated = $rosterService->updateEntry(
            $this->emp1->id,
            '2026-10-15',
            $this->nightShift->id,
            'shift',
            'Covering for Bob',
            'published',
            'Sick Cover'
        );

        $this->assertTrue($updated->is_overridden);
        $this->assertEquals($this->morningShift->id, $updated->original_shift_id);
        $this->assertEquals($this->nightShift->id, $updated->shift_id);
        $this->assertEquals('Sick Cover', $updated->override_reason);
    }

    public function test_shift_delete_guard_prevents_deleting_actively_referenced_shifts(): void
    {
        $shiftService = app(ShiftService::class);

        // Schedule emp1 on morningShift
        RosterEntry::create([
            'tenant_id' => $this->tenant->id,
            'employee_id' => $this->emp1->id,
            'roster_date' => '2026-10-20',
            'shift_id' => $this->morningShift->id,
            'schedule_type' => 'shift',
            'status' => 'published',
        ]);

        // Trying to delete morningShift should be blocked
        $this->assertFalse($this->morningShift->canBeDeleted());

        $this->expectException(DomainException::class);
        $shiftService->deleteShift($this->morningShift);
    }
}
