<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\AttendanceDaily;
use App\Models\Branch;
use App\Models\Company;
use App\Models\Department;
use App\Models\Employee;
use App\Models\LeaveRequest;
use App\Models\PublicHoliday;
use App\Models\Tenant;
use Carbon\CarbonImmutable;

final class DashboardService
{
    /**
     * Aggregate executive dashboard data for the active tenant.
     *
     * @return array<string, mixed>
     */
    public function getTenantDashboardData(?Tenant $tenant = null): array
    {
        $today = CarbonImmutable::now()->format('Y-m-d');

        // M01 Master Metrics
        $totalEmployees = Employee::count();
        $activeEmployees = Employee::where('employment_status', 'active')->count();
        $departmentsCount = Department::count();
        $branchesCount = Branch::count();
        $company = Company::first();

        $data = [
            'master' => [
                'total_employees' => $totalEmployees,
                'active_employees' => $activeEmployees,
                'departments_count' => $departmentsCount,
                'branches_count' => $branchesCount,
                'company_name' => $company?->name ?? ($tenant?->name ?? 'EMS Company'),
                'epf_enabled' => (bool) ($tenant?->getSetting('epf_enabled', true) ?? true),
            ],
            'ams' => null,
            'payroll' => null,
        ];

        // M02 AMS Metrics (if enabled)
        if ($tenant === null || $tenant->is_ams_enabled) {
            $dailyRecords = AttendanceDaily::where('attendance_date', $today)->get();

            $presentCount = $dailyRecords->where('status', 'present')->count();
            $lateCount = $dailyRecords->where('late_minutes', '>', 0)->count();
            $absentCount = $dailyRecords->where('status', 'absent')->count();
            $onLeaveCount = $dailyRecords->where('status', 'leave')->count();

            $pendingLeaves = LeaveRequest::with(['employee:id,full_name,emp_no', 'leaveType:id,name'])
                ->where('status', 'pending')
                ->latest()
                ->take(5)
                ->get()
                ->map(fn (LeaveRequest $l) => [
                    'id' => $l->id,
                    'employee_name' => $l->employee?->full_name ?? 'Unknown',
                    'emp_no' => $l->employee?->emp_no ?? '',
                    'leave_type' => $l->leaveType?->name ?? 'General',
                    'start_date' => $l->start_date?->format('Y-m-d'),
                    'end_date' => $l->end_date?->format('Y-m-d'),
                    'total_days' => $l->days_count,
                ]);

            $upcomingHolidays = PublicHoliday::where('holiday_date', '>=', $today)
                ->orderBy('holiday_date')
                ->take(3)
                ->get(['id', 'name', 'holiday_date', 'type'])
                ->map(fn (PublicHoliday $h) => [
                    'id' => $h->id,
                    'name' => $h->name,
                    'holiday_date' => $h->holiday_date?->format('Y-m-d'),
                    'holiday_type' => $h->type,
                ]);

            $data['ams'] = [
                'present_count' => $presentCount,
                'late_count' => $lateCount,
                'absent_count' => $absentCount,
                'on_leave_count' => $onLeaveCount,
                'pending_leaves_count' => LeaveRequest::where('status', 'pending')->count(),
                'recent_pending_leaves' => $pendingLeaves,
                'upcoming_holidays' => $upcomingHolidays,
            ];
        }

        // M03 Payroll Metrics (if enabled)
        if ($tenant === null || $tenant->is_payroll_enabled) {
            $data['payroll'] = [
                'current_period' => CarbonImmutable::now()->format('F Y'),
                'is_ready' => true,
                'statutory_compliant' => true,
            ];
        }

        return $data;
    }
}
