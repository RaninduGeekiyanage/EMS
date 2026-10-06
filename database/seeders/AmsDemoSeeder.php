<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\AttendanceDaily;
use App\Models\Department;
use App\Models\Designation;
use App\Models\Employee;
use App\Models\LeaveEntitlement;
use App\Models\LeaveType;
use App\Models\RosterEntry;
use App\Models\Shift;
use App\Models\Tenant;
use App\Models\User;
use Carbon\Carbon;
use Carbon\CarbonPeriod;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

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

        if (function_exists('setPermissionsTeamId')) {
            setPermissionsTeamId($tenant->id);
        }

        // 1. Departments
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

        // 2. Designations
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

        // 3. Employees for 24/7 Security Operations (Sri Lankan Numeric emp_no)
        $secStaff = [
            ['emp_no' => '1001', 'full_name' => 'Saman Kumara', 'nic' => '198810203040', 'phone' => '0771234567', 'email' => 'saman.k@ceylon-tea.com', 'is_manager' => true, 'must_change' => false],
            ['emp_no' => '1002', 'full_name' => 'Nimal Perera', 'nic' => '199020304050', 'phone' => '0772345678', 'email' => null, 'is_manager' => false, 'must_change' => true],
            ['emp_no' => '1003', 'full_name' => 'Sunil Shantha', 'nic' => '199230405060', 'phone' => '0773456789', 'email' => null, 'is_manager' => false, 'must_change' => false],
            ['emp_no' => '1004', 'full_name' => 'Anura Silva', 'nic' => '199440506070', 'phone' => '0774567890', 'email' => null, 'is_manager' => false, 'must_change' => false],
        ];

        $employeesMap = [];

        foreach ($secStaff as $st) {
            $emp = Employee::updateOrCreate(
                ['tenant_id' => $tenant->id, 'emp_no' => $st['emp_no']],
                [
                    'full_name' => $st['full_name'],
                    'nic' => $st['nic'],
                    'phone' => $st['phone'],
                    'email' => $st['email'],
                    'department_id' => $secDept->id,
                    'designation_id' => $st['is_manager'] ? $desigManager->id : $desigAgent->id,
                    'employment_type' => 'permanent',
                    'employment_status' => 'active',
                    'date_of_joining' => '2024-01-01',
                ]
            );

            $employeesMap[$st['emp_no']] = $emp;

            // Provision linked User account for Employee Self-Service (ESS)
            $username = 'EMP' . $st['emp_no'];
            $user = User::updateOrCreate(
                ['tenant_id' => $tenant->id, 'username' => $username],
                [
                    'name' => $st['full_name'],
                    'email' => $st['email'],
                    'phone' => $st['phone'],
                    'password' => Hash::make('123456'),
                    'employee_id' => $emp->id,
                    'must_change_password' => $st['must_change'],
                    'email_verified_at' => now(),
                ]
            );

            if ($st['is_manager']) {
                if (! $user->hasRole('Supervisor')) {
                    $user->assignRole('Supervisor');
                }
                // Assign as Department Head for SEC
                \App\Models\DepartmentHead::updateOrCreate(
                    ['tenant_id' => $tenant->id, 'department_id' => $secDept->id],
                    ['employee_id' => $emp->id, 'branch_id' => $secDept->branch_id, 'company_id' => $secDept->company_id]
                );
            } else {
                if (! $user->hasRole('Staff')) {
                    $user->assignRole('Staff');
                }
            }
        }

        // 4. Employees for Customer Care & Corporate
        $otherStaff = [
            ['emp_no' => '2001', 'full_name' => 'Dilani Fernando', 'nic' => '199550607080', 'dept' => $bpoDept, 'desig' => $desigAgent, 'email' => null],
            ['emp_no' => '3001', 'full_name' => 'Roshan Wickramasinghe', 'nic' => '198911223344', 'dept' => $corpDept, 'desig' => $desigFinance, 'email' => 'roshan.w@ceylon-tea.com'],
        ];

        foreach ($otherStaff as $st) {
            $emp = Employee::updateOrCreate(
                ['tenant_id' => $tenant->id, 'emp_no' => $st['emp_no']],
                [
                    'full_name' => $st['full_name'],
                    'nic' => $st['nic'],
                    'email' => $st['email'],
                    'department_id' => $st['dept']->id,
                    'designation_id' => $st['desig']->id,
                    'employment_type' => 'permanent',
                    'employment_status' => 'active',
                    'date_of_joining' => '2024-03-01',
                ]
            );

            $employeesMap[$st['emp_no']] = $emp;

            $username = 'EMP' . $st['emp_no'];
            $user = User::updateOrCreate(
                ['tenant_id' => $tenant->id, 'username' => $username],
                [
                    'name' => $st['full_name'],
                    'email' => $st['email'],
                    'password' => Hash::make('123456'),
                    'employee_id' => $emp->id,
                    'must_change_password' => false,
                    'email_verified_at' => now(),
                ]
            );

            if (! $user->hasRole('Staff')) {
                $user->assignRole('Staff');
            }
        }

        // 5. Seed Statutory Leave Entitlements
        $statutoryTypes = [
            ['name' => 'Annual Leave', 'code' => 'ANNUAL', 'days' => 14.0, 'color' => '#3b82f6'],
            ['name' => 'Casual Leave', 'code' => 'CASUAL', 'days' => 7.0, 'color' => '#10b981'],
            ['name' => 'Medical Leave', 'code' => 'MEDICAL', 'days' => 7.0, 'color' => '#f59e0b'],
        ];

        $leaveTypeModels = [];
        foreach ($statutoryTypes as $st) {
            $lt = LeaveType::firstOrCreate(
                ['tenant_id' => $tenant->id, 'code' => $st['code']],
                [
                    'name' => $st['name'],
                    'days_per_year' => $st['days'],
                    'color' => $st['color'],
                    'is_paid' => true,
                    'is_active' => true,
                ]
            );
            $leaveTypeModels[$st['code']] = $lt;
        }

        foreach ([$employeesMap['1001'], $employeesMap['1002'], $employeesMap['2001']] as $targetEmp) {
            if ($targetEmp) {
                foreach ($leaveTypeModels as $code => $lt) {
                    LeaveEntitlement::updateOrCreate(
                        [
                            'tenant_id' => $tenant->id,
                            'employee_id' => $targetEmp->id,
                            'leave_type_id' => $lt->id,
                            'year' => (int) now()->year,
                        ],
                        [
                            'allocated_days' => $lt->days_per_year,
                            'used_days' => $code === 'CASUAL' ? 2.0 : 1.0,
                            'pending_days' => 0.0,
                        ]
                    );
                }
            }
        }

        // 6. Seed Single Source of Truth 3-Month Duty Roster for 1002 (Nimal Perera) & 1001 (Saman Kumara)
        $standardShift = Shift::where('tenant_id', $tenant->id)->first();
        if (! $standardShift) {
            $standardShift = Shift::create([
                'tenant_id' => $tenant->id,
                'name' => 'General Day Shift',
                'start_time' => '08:30:00',
                'end_time' => '17:00:00',
                'is_night_shift' => false,
                'is_active' => true,
            ]);
        }

        $threeMonthsRange = CarbonPeriod::create(
            now()->subMonth()->startOfMonth(),
            now()->addMonth()->endOfMonth()
        );

        foreach ([$employeesMap['1001'], $employeesMap['1002']] as $rosterEmp) {
            if (! $rosterEmp) {
                continue;
            }

            foreach ($threeMonthsRange as $date) {
                $isWeekend = $date->isSaturday() || $date->isSunday();
                RosterEntry::updateOrCreate(
                    [
                        'tenant_id' => $tenant->id,
                        'employee_id' => $rosterEmp->id,
                        'roster_date' => $date->toDateString(),
                    ],
                    [
                        'shift_id' => $isWeekend ? null : $standardShift->id,
                        'schedule_type' => $isWeekend ? 'rest_day' : 'shift',
                        'status' => 'published',
                    ]
                );
            }
        }

        // 7. Seed Realistic Attendance Records for 1002 (Nimal Perera)
        $nimalEmp = $employeesMap['1002'];
        if ($nimalEmp) {
            $attendanceDates = CarbonPeriod::create(
                now()->subMonth()->startOfMonth(),
                now()
            );

            foreach ($attendanceDates as $date) {
                if ($date->isSaturday() || $date->isSunday()) {
                    continue;
                }

                $dayNum = (int) $date->day;
                $isLate = ($dayNum % 5 === 0);
                $isMissingPunch = ($dayNum % 11 === 0);
                $isAbsent = ($dayNum === 17);

                $punchIn = $isAbsent ? null : ($isLate ? $date->copy()->setTime(9, 15) : $date->copy()->setTime(8, 24));
                $punchOut = ($isAbsent || $isMissingPunch) ? null : $date->copy()->setTime(17, 5);

                $status = 'present';
                if ($isAbsent) {
                    $status = 'absent';
                } elseif ($isLate) {
                    $status = 'late';
                }

                AttendanceDaily::updateOrCreate(
                    [
                        'tenant_id' => $tenant->id,
                        'employee_id' => $nimalEmp->id,
                        'attendance_date' => $date->toDateString(),
                    ],
                    [
                        'shift_id' => $standardShift->id,
                        'check_in' => $punchIn?->toDateTimeString(),
                        'check_out' => $punchOut?->toDateTimeString(),
                        'worked_hours' => $isAbsent ? 0.0 : ($isMissingPunch ? 4.0 : 8.5),
                        'regular_hours' => $isAbsent ? 0.0 : ($isMissingPunch ? 4.0 : 8.0),
                        'late_minutes' => $isLate ? 45 : 0,
                        'early_departure_minutes' => 0,
                        'status' => $status,
                    ]
                );
            }
        }
    }
}
