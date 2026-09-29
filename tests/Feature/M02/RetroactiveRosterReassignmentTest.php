<?php

declare(strict_types=1);

namespace Tests\Feature\M02;

use App\Models\Department;
use App\Models\Employee;
use App\Models\PayrollRun;
use App\Models\Roster;
use App\Models\RosterEmployeeAllocation;
use App\Models\RosterEntry;
use App\Models\RosterPattern;
use App\Models\Shift;
use App\Models\Tenant;
use App\Models\User;
use App\Services\RosterService;
use Carbon\Carbon;
use DomainException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

final class RetroactiveRosterReassignmentTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;
    private User $admin;
    private Department $dept;
    private Employee $emp;
    private Shift $morningShift;
    private Shift $nightShift;
    private RosterPattern $pattern;
    private RosterService $rosterService;

    protected function setUp(): void
    {
        parent::setUp();

        $this->tenant = Tenant::create([
            'name' => 'Apex Manufacturing',
            'slug' => 'apex-mfg',
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
            'name' => 'Assembly Line A',
            'code' => 'ASSEMBLY',
        ]);

        $this->emp = Employee::create([
            'tenant_id' => $this->tenant->id,
            'department_id' => $this->dept->id,
            'emp_no' => 'EMP-7701',
            'nic' => '199012345678',
            'full_name' => 'Devon Miles',
            'employment_type' => 'permanent',
            'employment_status' => 'active',
        ]);

        $this->morningShift = Shift::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Morning Shift',
            'code' => 'MORN',
            'start_time' => '06:00:00',
            'end_time' => '14:00:00',
            'half_day_hours' => 4.0,
            'full_day_hours' => 8.0,
            'color' => '#10B981',
            'is_active' => true,
        ]);

        $this->nightShift = Shift::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Night Shift',
            'code' => 'NGHT',
            'start_time' => '22:00:00',
            'end_time' => '06:00:00',
            'half_day_hours' => 4.0,
            'full_day_hours' => 8.0,
            'color' => '#6366F1',
            'is_active' => true,
        ]);

        $this->pattern = RosterPattern::create([
            'tenant_id' => $this->tenant->id,
            'name' => 'Morning Continuous',
            'code' => 'MC-01',
            'pattern_type' => 'weekly',
            'cycle_length_days' => 7,
            'pattern_data' => [
                ['day' => 0, 'shift_id' => $this->morningShift->id, 'is_rest_day' => false],
                ['day' => 1, 'shift_id' => $this->morningShift->id, 'is_rest_day' => false],
                ['day' => 2, 'shift_id' => $this->morningShift->id, 'is_rest_day' => false],
                ['day' => 3, 'shift_id' => $this->morningShift->id, 'is_rest_day' => false],
                ['day' => 4, 'shift_id' => $this->morningShift->id, 'is_rest_day' => false],
                ['day' => 5, 'shift_id' => $this->morningShift->id, 'is_rest_day' => false],
                ['day' => 6, 'shift_id' => $this->morningShift->id, 'is_rest_day' => false],
            ],
            'is_active' => true,
        ]);

        $this->rosterService = app(RosterService::class);
    }

    public function test_cannot_allocate_employee_with_overlap_when_reassignment_disabled(): void
    {
        // 1. Create Roster A (July 1 - July 31, 2026) and allocate Devon
        $this->rosterService->createRoster([
            'tenant_id' => $this->tenant->id,
            'name' => 'July Operations Alpha',
            'code' => 'RST-2026-07-A',
            'start_date' => '2026-07-01',
            'end_date' => '2026-07-31',
            'status' => 'published',
            'employee_ids' => [$this->emp->id],
            'pattern_id' => $this->pattern->id,
        ], $this->admin->id);

        // 2. Create Roster B (July 10 - July 20, 2026)
        $rosterB = $this->rosterService->createRoster([
            'tenant_id' => $this->tenant->id,
            'name' => 'July Operations Bravo',
            'code' => 'RST-2026-07-B',
            'start_date' => '2026-07-10',
            'end_date' => '2026-07-20',
            'status' => 'draft',
        ], $this->admin->id);

        // 3. Attempting to allocate Devon to Roster B without reassign_overlapping must throw DomainException
        $this->expectException(DomainException::class);
        $this->expectExceptionMessageMatches('/overlap/i');

        $this->rosterService->allocateEmployee(
            $rosterB->id,
            $this->emp->id,
            '2026-07-10',
            '2026-07-20',
            null,
            null,
            false // reassignOverlapping = false
        );
    }

    public function test_retroactive_reassignment_excises_old_roster_and_prevents_double_booking(): void
    {
        // 1. Create Roster A (July 1 - July 31, 2026) with full entries
        $rosterA = $this->rosterService->createRoster([
            'tenant_id' => $this->tenant->id,
            'name' => 'July Main Roster',
            'code' => 'RST-2026-07-MAIN',
            'start_date' => '2026-07-01',
            'end_date' => '2026-07-31',
            'status' => 'published',
            'employee_ids' => [$this->emp->id],
            'pattern_id' => $this->pattern->id,
        ], $this->admin->id);

        $initialEntriesCount = RosterEntry::where('roster_id', $rosterA->id)
            ->where('employee_id', $this->emp->id)
            ->count();
        $this->assertEquals(31, $initialEntriesCount);

        // 2. Create Roster B (July 10 - July 20, 2026)
        $rosterB = $this->rosterService->createRoster([
            'tenant_id' => $this->tenant->id,
            'name' => 'July Special Shift Bravo',
            'code' => 'RST-2026-07-SPEC',
            'start_date' => '2026-07-10',
            'end_date' => '2026-07-20',
            'status' => 'draft',
        ], $this->admin->id);

        // 3. Retroactively reassign Devon to Roster B for July 10-20 with reason
        $allocatedCount = $this->rosterService->allocateEmployee(
            $rosterB->id,
            $this->emp->id,
            '2026-07-10',
            '2026-07-20',
            $this->pattern->id,
            null,
            true, // reassignOverlapping = true
            'Assigned to wrong roster originally'
        );

        $this->assertEquals(1, $allocatedCount);

        // 4. Verify Roster A's entries between July 10 and July 20 were cleanly excised
        $rosterAConflictingEntries = RosterEntry::where('roster_id', $rosterA->id)
            ->where('employee_id', $this->emp->id)
            ->whereBetween('roster_date', ['2026-07-10', '2026-07-20'])
            ->count();
        $this->assertEquals(0, $rosterAConflictingEntries, 'Conflicting entries in Roster A must be deleted.');

        // 5. Verify Roster B's entries between July 10 and July 20 were created
        $rosterBEntries = RosterEntry::where('roster_id', $rosterB->id)
            ->where('employee_id', $this->emp->id)
            ->count();
        $this->assertEquals(11, $rosterBEntries, 'Roster B must have 11 entries for July 10-20.');

        // 6. Verify strictly ZERO double bookings across July 1 - July 31
        $allocations = RosterEmployeeAllocation::where('employee_id', $this->emp->id)->get();

        $current = Carbon::parse('2026-07-01');
        $end = Carbon::parse('2026-07-31');

        while ($current->lte($end)) {
            $dateStr = $current->toDateString();
            $coveringAllocations = $allocations->filter(function ($alloc) use ($dateStr) {
                $from = Carbon::parse($alloc->effective_from)->toDateString();
                $to = Carbon::parse($alloc->effective_to)->toDateString();

                return $from <= $dateStr && $to >= $dateStr;
            });

            $this->assertEquals(
                1,
                $coveringAllocations->count(),
                "Date {$dateStr} must have exactly 1 active roster allocation (zero double booking)."
            );

            if ($dateStr >= '2026-07-10' && $dateStr <= '2026-07-20') {
                $this->assertEquals($rosterB->id, $coveringAllocations->first()->roster_id);
            } else {
                $this->assertEquals($rosterA->id, $coveringAllocations->first()->roster_id);
            }

            $current->addDay();
        }
    }

    public function test_retroactive_reassignment_strictly_blocked_when_payroll_is_finalized_and_locked(): void
    {
        // 1. Create Roster A in June 2026
        $this->rosterService->createRoster([
            'tenant_id' => $this->tenant->id,
            'name' => 'June Operations Alpha',
            'code' => 'RST-2026-06-A',
            'start_date' => '2026-06-01',
            'end_date' => '2026-06-30',
            'status' => 'published',
            'employee_ids' => [$this->emp->id],
            'pattern_id' => $this->pattern->id,
        ], $this->admin->id);

        // 2. Create Roster B for June before lock
        $rosterB = $this->rosterService->createRoster([
            'tenant_id' => $this->tenant->id,
            'name' => 'June Operations Bravo',
            'code' => 'RST-2026-06-B',
            'start_date' => '2026-06-01',
            'end_date' => '2026-06-30',
            'status' => 'draft',
        ], $this->admin->id);

        // 3. Now Lock Payroll for June 2026 (M03 Finalized Payroll)
        PayrollRun::create([
            'tenant_id' => $this->tenant->id,
            'period_year' => 2026,
            'period_month' => 6,
            'status' => 'locked',
            'total_gross' => 50000.00,
            'total_net' => 45000.00,
            'total_epf_employer' => 6000.00,
            'total_etf' => 1500.00,
            'total_payees' => 1,
            'processed_by' => $this->admin->id,
            'processed_at' => Carbon::now(),
        ]);

        // 4. Attempting reassignment to June with reassign_overlapping = true must be rejected
        $this->expectException(DomainException::class);
        $this->expectExceptionMessage('Cannot modify roster schedules for June 2026 because payroll has been finalized and locked.');

        $this->rosterService->allocateEmployee(
            $rosterB->id,
            $this->emp->id,
            '2026-06-01',
            '2026-06-30',
            null,
            null,
            true, // reassignOverlapping = true
            'Retroactive correction'
        );
    }

    public function test_http_endpoint_allocates_with_reassignment_and_reason(): void
    {
        // 1. Create Roster A
        $this->rosterService->createRoster([
            'tenant_id' => $this->tenant->id,
            'name' => 'August Primary',
            'code' => 'RST-2026-08-PRI',
            'start_date' => '2026-08-01',
            'end_date' => '2026-08-31',
            'status' => 'published',
            'employee_ids' => [$this->emp->id],
            'pattern_id' => $this->pattern->id,
        ], $this->admin->id);

        // 2. Create Roster B
        $rosterB = $this->rosterService->createRoster([
            'tenant_id' => $this->tenant->id,
            'name' => 'August Secondary',
            'code' => 'RST-2026-08-SEC',
            'start_date' => '2026-08-15',
            'end_date' => '2026-08-25',
            'status' => 'draft',
        ], $this->admin->id);

        // 3. Make HTTP request with reassign_overlapping = true
        $response = $this->actingAs($this->admin)
            ->post("/roster/rosters/{$rosterB->id}/allocations", [
                'employee_ids' => [$this->emp->id],
                'effective_from' => '2026-08-15',
                'effective_to' => '2026-08-25',
                'pattern_id' => $this->pattern->id,
                'reassign_overlapping' => true,
                'reassignment_reason' => 'Transferred per HR incident report #402',
            ]);

        $response->assertRedirect();
        $response->assertSessionHas('success');

        // Confirm allocation now belongs to Roster B
        $this->assertDatabaseHas('roster_employee_allocations', [
            'roster_id' => $rosterB->id,
            'employee_id' => $this->emp->id,
            'effective_from' => '2026-08-15',
            'effective_to' => '2026-08-25',
        ]);
    }

    public function test_available_employees_flags_reassignable_and_locked_employees(): void
    {
        // 1. Create Roster A
        $this->rosterService->createRoster([
            'tenant_id' => $this->tenant->id,
            'name' => 'September Operations',
            'code' => 'RST-2026-09-OPS',
            'start_date' => '2026-09-01',
            'end_date' => '2026-09-30',
            'status' => 'published',
            'employee_ids' => [$this->emp->id],
            'pattern_id' => $this->pattern->id,
        ], $this->admin->id);

        // 2. Create Roster B
        $rosterB = $this->rosterService->createRoster([
            'tenant_id' => $this->tenant->id,
            'name' => 'September Special Roster',
            'code' => 'RST-2026-09-SPEC',
            'start_date' => '2026-09-10',
            'end_date' => '2026-09-20',
            'status' => 'draft',
        ], $this->admin->id);

        // 3. Query available employees for Roster B (unlocked payroll) via service
        $data = $this->rosterService->getAvailableEmployees('2026-09-10', '2026-09-20', null, $rosterB->id);

        $empData = collect($data)->firstWhere('id', $this->emp->id);
        $this->assertNotNull($empData);
        $this->assertFalse($empData['is_available']);
        $this->assertTrue($empData['can_reassign']);
        $this->assertFalse($empData['is_period_locked']);
        $this->assertEquals('September Operations', $empData['conflicting_roster_name']);

        // 4. Now lock payroll for September 2026
        PayrollRun::create([
            'tenant_id' => $this->tenant->id,
            'period_year' => 2026,
            'period_month' => 9,
            'status' => 'locked',
            'total_gross' => 50000.00,
            'total_net' => 45000.00,
            'total_epf_employer' => 6000.00,
            'total_etf' => 1500.00,
            'total_payees' => 1,
            'processed_by' => $this->admin->id,
            'processed_at' => Carbon::now(),
        ]);

        $dataLocked = $this->rosterService->getAvailableEmployees('2026-09-10', '2026-09-20', null, $rosterB->id);
        $empDataLocked = collect($dataLocked)->firstWhere('id', $this->emp->id);

        $this->assertNotNull($empDataLocked);
        $this->assertFalse($empDataLocked['is_available']);
        $this->assertFalse($empDataLocked['can_reassign'], 'Cannot reassign when payroll is locked');
        $this->assertTrue($empDataLocked['is_period_locked'], 'Must be flagged as payroll locked');
    }
}
