<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\Department;
use App\Models\Designation;
use App\Models\Employee;
use App\Models\Tenant;
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

        // 3. Employees for 24/7 Security Operations
        $secStaff = [
            ['emp_no' => 'EMP-1001', 'full_name' => 'Saman Kumara', 'nic' => '198810203040'],
            ['emp_no' => 'EMP-1002', 'full_name' => 'Nimal Perera', 'nic' => '199020304050'],
            ['emp_no' => 'EMP-1003', 'full_name' => 'Sunil Shantha', 'nic' => '199230405060'],
            ['emp_no' => 'EMP-1004', 'full_name' => 'Anura Silva', 'nic' => '199440506070'],
        ];
        foreach ($secStaff as $st) {
            Employee::updateOrCreate(
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

        // 4. Employees for 2-Shift BPO Support
        $bpoStaff = [
            ['emp_no' => 'EMP-2001', 'full_name' => 'Dilani Fernando', 'nic' => '199550607080'],
            ['emp_no' => 'EMP-2002', 'full_name' => 'Kavindi Jayasinghe', 'nic' => '199660708090'],
            ['emp_no' => 'EMP-2003', 'full_name' => 'Chathura Bandara', 'nic' => '199770809010'],
        ];
        foreach ($bpoStaff as $st) {
            Employee::updateOrCreate(
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

        // 5. Employees for Corporate General Shift
        $corpStaff = [
            ['emp_no' => 'EMP-3001', 'full_name' => 'Roshan Wickramasinghe', 'nic' => '198911223344'],
            ['emp_no' => 'EMP-3002', 'full_name' => 'Pavithra De Silva', 'nic' => '199122334455'],
            ['emp_no' => 'EMP-3003', 'full_name' => 'Kasun Madushanka', 'nic' => '199333445566'],
        ];
        foreach ($corpStaff as $st) {
            Employee::updateOrCreate(
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
    }
}
