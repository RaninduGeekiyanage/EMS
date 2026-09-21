<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\Department;
use App\Models\Designation;
use App\Models\Employee;
use App\Models\RosterPattern;
use App\Models\Shift;
use App\Models\Tenant;
use App\Services\RosterService;
use Carbon\Carbon;
use Illuminate\Database\Seeder;

final class AmsDemoSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $tenant = Tenant::first();
        if (! $tenant) {
            return;
        }

        session(['tenant_id' => $tenant->id]);
        app()->instance('current_tenant', $tenant);
        app()->instance('current_tenant_id', $tenant->id);

        // 1. Ensure Standard Shifts exist
        $mornShift = Shift::firstOrCreate(
            ['tenant_id' => $tenant->id, 'code' => 'ROT-MORN'],
            [
                'name' => 'Morning Shift (A)',
                'shift_type' => 'regular',
                'start_time' => '06:00:00',
                'end_time' => '14:00:00',
                'break_minutes' => 45,
                'grace_minutes' => 15,
                'ot_threshold_minutes' => 480,
                'is_night_shift' => false,
                'color' => '#3b82f6',
            ]
        );

        $eveShift = Shift::firstOrCreate(
            ['tenant_id' => $tenant->id, 'code' => 'ROT-EVE'],
            [
                'name' => 'Evening Shift (B)',
                'shift_type' => 'regular',
                'start_time' => '14:00:00',
                'end_time' => '22:00:00',
                'break_minutes' => 45,
                'grace_minutes' => 15,
                'ot_threshold_minutes' => 480,
                'is_night_shift' => false,
                'color' => '#8b5cf6',
            ]
        );

        $nightShift = Shift::firstOrCreate(
            ['tenant_id' => $tenant->id, 'code' => 'ROT-NIGHT'],
            [
                'name' => 'Night Shift (C)',
                'shift_type' => 'regular',
                'start_time' => '22:00:00',
                'end_time' => '06:00:00',
                'break_minutes' => 45,
                'grace_minutes' => 15,
                'ot_threshold_minutes' => 480,
                'is_night_shift' => true,
                'color' => '#ec4899',
            ]
        );

        $genShift = Shift::firstOrCreate(
            ['tenant_id' => $tenant->id, 'code' => 'GEN-DAY'],
            [
                'name' => 'General Day Shift',
                'shift_type' => 'regular',
                'start_time' => '08:30:00',
                'end_time' => '17:00:00',
                'break_minutes' => 60,
                'grace_minutes' => 15,
                'ot_threshold_minutes' => 480,
                'is_night_shift' => false,
                'color' => '#10b981',
            ]
        );

        // 2. Departments
        $secDept = Department::firstOrCreate(
            ['tenant_id' => $tenant->id, 'code' => 'SEC'],
            ['name' => 'Security & Plant Operations', 'is_active' => true]
        );

        $bpoDept = Department::firstOrCreate(
            ['tenant_id' => $tenant->id, 'code' => 'BPO'],
            ['name' => 'Customer Care & BPO Support', 'is_active' => true]
        );

        $corpDept = Department::firstOrCreate(
            ['tenant_id' => $tenant->id, 'code' => 'CORP'],
            ['name' => 'Corporate Administration', 'is_active' => true]
        );

        // 3. Designations
        $desigManager = Designation::firstOrCreate(
            ['tenant_id' => $tenant->id, 'title' => 'Shift Operations Manager'],
            ['grade' => 'MGR-1', 'is_active' => true]
        );

        $desigAgent = Designation::firstOrCreate(
            ['tenant_id' => $tenant->id, 'title' => 'Customer Care Officer'],
            ['grade' => 'EXEC-1', 'is_active' => true]
        );

        $desigFinance = Designation::firstOrCreate(
            ['tenant_id' => $tenant->id, 'title' => 'Corporate Executive'],
            ['grade' => 'EXEC-2', 'is_active' => true]
        );

        // 4. Employees for 24/7 Security Operations (4 Employees: 3 Shifts + 1 OFF)
        $secStaff = [
            ['emp_no' => 'EMP-1001', 'full_name' => 'Saman Kumara', 'nic' => '198810203040'],
            ['emp_no' => 'EMP-1002', 'full_name' => 'Nimal Perera', 'nic' => '199020304050'],
            ['emp_no' => 'EMP-1003', 'full_name' => 'Sunil Shantha', 'nic' => '199230405060'],
            ['emp_no' => 'EMP-1004', 'full_name' => 'Anura Silva', 'nic' => '199440506070'],
        ];
        $secEmployees = [];
        foreach ($secStaff as $st) {
            $secEmployees[] = Employee::updateOrCreate(
                ['tenant_id' => $tenant->id, 'emp_no' => $st['emp_no']],
                [
                    'full_name' => $st['full_name'],
                    'nic' => $st['nic'],
                    'department_id' => $secDept->id,
                    'designation_id' => $desigManager->id,
                    'employment_type' => 'permanent',
                    'employment_status' => 'active',
                    'date_of_joining' => '2024-01-01',
                ]
            );
        }

        // 5. Employees for 2-Shift BPO Support (3 Employees: 2 Shifts + 1 OFF)
        $bpoStaff = [
            ['emp_no' => 'EMP-2001', 'full_name' => 'Dilani Fernando', 'nic' => '199550607080'],
            ['emp_no' => 'EMP-2002', 'full_name' => 'Kavindi Jayasinghe', 'nic' => '199660708090'],
            ['emp_no' => 'EMP-2003', 'full_name' => 'Chathura Bandara', 'nic' => '199770809010'],
        ];
        $bpoEmployees = [];
        foreach ($bpoStaff as $st) {
            $bpoEmployees[] = Employee::updateOrCreate(
                ['tenant_id' => $tenant->id, 'emp_no' => $st['emp_no']],
                [
                    'full_name' => $st['full_name'],
                    'nic' => $st['nic'],
                    'department_id' => $bpoDept->id,
                    'designation_id' => $desigAgent->id,
                    'employment_type' => 'permanent',
                    'employment_status' => 'active',
                    'date_of_joining' => '2024-03-01',
                ]
            );
        }

        // 6. Employees for Corporate General Shift (3 Employees: Mon-Fri Fixed)
        $corpStaff = [
            ['emp_no' => 'EMP-3001', 'full_name' => 'Roshan Wickramasinghe', 'nic' => '198911223344'],
            ['emp_no' => 'EMP-3002', 'full_name' => 'Pavithra De Silva', 'nic' => '199122334455'],
            ['emp_no' => 'EMP-3003', 'full_name' => 'Kasun Madushanka', 'nic' => '199333445566'],
        ];
        $corpEmployees = [];
        foreach ($corpStaff as $st) {
            $corpEmployees[] = Employee::updateOrCreate(
                ['tenant_id' => $tenant->id, 'emp_no' => $st['emp_no']],
                [
                    'full_name' => $st['full_name'],
                    'nic' => $st['nic'],
                    'department_id' => $corpDept->id,
                    'designation_id' => $desigFinance->id,
                    'employment_type' => 'permanent',
                    'employment_status' => 'active',
                    'date_of_joining' => '2023-06-01',
                ]
            );
        }

        // 7. Seed Option 2 Roster Patterns (Shift Group Cards)
        $startDate = Carbon::now()->startOfMonth()->toDateString();
        $endDate = Carbon::now()->addYear()->endOfMonth()->toDateString();

        // 24/7 Security: 4 Shift Groups (A, B, C, D)
        $secGroups = [
            [
                'code' => 'SEC-GRP-A',
                'name' => 'Security - Group A (Morn Start)',
                'steps' => [
                    ['step' => 1, 'shift_id' => $mornShift->id, 'is_rest_day' => false],
                    ['step' => 2, 'shift_id' => $eveShift->id, 'is_rest_day' => false],
                    ['step' => 3, 'shift_id' => $nightShift->id, 'is_rest_day' => false],
                    ['step' => 4, 'shift_id' => '', 'is_rest_day' => true],
                ],
                'emp' => $secEmployees[0],
            ],
            [
                'code' => 'SEC-GRP-B',
                'name' => 'Security - Group B (Eve Start)',
                'steps' => [
                    ['step' => 1, 'shift_id' => $eveShift->id, 'is_rest_day' => false],
                    ['step' => 2, 'shift_id' => $nightShift->id, 'is_rest_day' => false],
                    ['step' => 3, 'shift_id' => '', 'is_rest_day' => true],
                    ['step' => 4, 'shift_id' => $mornShift->id, 'is_rest_day' => false],
                ],
                'emp' => $secEmployees[1],
            ],
            [
                'code' => 'SEC-GRP-C',
                'name' => 'Security - Group C (Night Start)',
                'steps' => [
                    ['step' => 1, 'shift_id' => $nightShift->id, 'is_rest_day' => false],
                    ['step' => 2, 'shift_id' => '', 'is_rest_day' => true],
                    ['step' => 3, 'shift_id' => $mornShift->id, 'is_rest_day' => false],
                    ['step' => 4, 'shift_id' => $eveShift->id, 'is_rest_day' => false],
                ],
                'emp' => $secEmployees[2],
            ],
            [
                'code' => 'SEC-GRP-D',
                'name' => 'Security - Group D (Off Start)',
                'steps' => [
                    ['step' => 1, 'shift_id' => '', 'is_rest_day' => true],
                    ['step' => 2, 'shift_id' => $mornShift->id, 'is_rest_day' => false],
                    ['step' => 3, 'shift_id' => $eveShift->id, 'is_rest_day' => false],
                    ['step' => 4, 'shift_id' => $nightShift->id, 'is_rest_day' => false],
                ],
                'emp' => $secEmployees[3],
            ],
        ];

        $rosterService = app(RosterService::class);
        $currMonthStart = Carbon::now()->startOfMonth()->toDateString();
        $currMonthEnd = Carbon::now()->endOfMonth()->toDateString();

        foreach ($secGroups as $grp) {
            $pattern = RosterPattern::updateOrCreate(
                ['tenant_id' => $tenant->id, 'code' => $grp['code']],
                [
                    'name' => $grp['name'],
                    'pattern_type' => 'cyclical',
                    'start_date' => $startDate,
                    'end_date' => $endDate,
                    'cycle_length_days' => 4,
                    'pattern_data' => ['steps' => $grp['steps']],
                    'is_active' => true,
                ]
            );

            // Generate monthly roster for this group member
            $rosterService->generateRoster([
                'pattern_id' => $pattern->id,
                'start_date' => $currMonthStart,
                'end_date' => $currMonthEnd,
                'employee_ids' => [$grp['emp']->id],
                'conflict_mode' => 'overwrite',
                'status' => 'published',
                'preserve_leaves' => true,
            ]);
        }

        // BPO 2-Shift: 3 Shift Groups (A, B, C)
        $bpoGroups = [
            [
                'code' => 'BPO-GRP-A',
                'name' => 'BPO - Group A (Morn Start)',
                'steps' => [
                    ['step' => 1, 'shift_id' => $mornShift->id, 'is_rest_day' => false],
                    ['step' => 2, 'shift_id' => $eveShift->id, 'is_rest_day' => false],
                    ['step' => 3, 'shift_id' => '', 'is_rest_day' => true],
                ],
                'emp' => $bpoEmployees[0],
            ],
            [
                'code' => 'BPO-GRP-B',
                'name' => 'BPO - Group B (Eve Start)',
                'steps' => [
                    ['step' => 1, 'shift_id' => $eveShift->id, 'is_rest_day' => false],
                    ['step' => 2, 'shift_id' => '', 'is_rest_day' => true],
                    ['step' => 3, 'shift_id' => $mornShift->id, 'is_rest_day' => false],
                ],
                'emp' => $bpoEmployees[1],
            ],
            [
                'code' => 'BPO-GRP-C',
                'name' => 'BPO - Group C (Off Start)',
                'steps' => [
                    ['step' => 1, 'shift_id' => '', 'is_rest_day' => true],
                    ['step' => 2, 'shift_id' => $mornShift->id, 'is_rest_day' => false],
                    ['step' => 3, 'shift_id' => $eveShift->id, 'is_rest_day' => false],
                ],
                'emp' => $bpoEmployees[2],
            ],
        ];

        foreach ($bpoGroups as $grp) {
            $pattern = RosterPattern::updateOrCreate(
                ['tenant_id' => $tenant->id, 'code' => $grp['code']],
                [
                    'name' => $grp['name'],
                    'pattern_type' => 'cyclical',
                    'start_date' => $startDate,
                    'end_date' => $endDate,
                    'cycle_length_days' => 3,
                    'pattern_data' => ['steps' => $grp['steps']],
                    'is_active' => true,
                ]
            );

            // Generate monthly roster for this group member
            $rosterService->generateRoster([
                'pattern_id' => $pattern->id,
                'start_date' => $currMonthStart,
                'end_date' => $currMonthEnd,
                'employee_ids' => [$grp['emp']->id],
                'conflict_mode' => 'overwrite',
                'status' => 'published',
                'preserve_leaves' => true,
            ]);
        }

        // Corporate: 1 Standard General Day Pattern (Mon-Fri)
        $corpPattern = RosterPattern::updateOrCreate(
            ['tenant_id' => $tenant->id, 'code' => 'CORP-GEN'],
            [
                'name' => 'Corporate - General Day (Mon-Fri)',
                'pattern_type' => 'weekly',
                'start_date' => $startDate,
                'end_date' => $endDate,
                'cycle_length_days' => 7,
                'pattern_data' => [
                    ['day' => 0, 'day_name' => 'Mon', 'shift_id' => $genShift->id, 'is_rest_day' => false],
                    ['day' => 1, 'day_name' => 'Tue', 'shift_id' => $genShift->id, 'is_rest_day' => false],
                    ['day' => 2, 'day_name' => 'Wed', 'shift_id' => $genShift->id, 'is_rest_day' => false],
                    ['day' => 3, 'day_name' => 'Thu', 'shift_id' => $genShift->id, 'is_rest_day' => false],
                    ['day' => 4, 'day_name' => 'Fri', 'shift_id' => $genShift->id, 'is_rest_day' => false],
                    ['day' => 5, 'day_name' => 'Sat', 'shift_id' => '', 'is_rest_day' => true],
                    ['day' => 6, 'day_name' => 'Sun', 'shift_id' => '', 'is_rest_day' => true],
                ],
                'is_active' => true,
            ]
        );

        // Generate monthly roster for all 3 corporate employees
        $rosterService->generateRoster([
            'pattern_id' => $corpPattern->id,
            'start_date' => $currMonthStart,
            'end_date' => $currMonthEnd,
            'employee_ids' => array_map(fn ($e) => $e->id, $corpEmployees),
            'conflict_mode' => 'overwrite',
            'status' => 'published',
            'preserve_leaves' => true,
        ]);
    }
}
