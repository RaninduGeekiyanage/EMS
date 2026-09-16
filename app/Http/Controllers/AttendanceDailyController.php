<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Http\Requests\Attendance\AdjustDailyPunchRequest;
use App\Http\Requests\Attendance\ProcessAttendanceRequest;
use App\Http\Requests\Attendance\SaveAttendanceRuleRequest;
use App\Models\AttendanceDaily;
use App\Models\AttendanceRule;
use App\Models\Department;
use App\Models\Shift;
use App\Services\AttendanceProcessingService;
use App\Services\ShiftService;
use Carbon\Carbon;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

final class AttendanceDailyController extends Controller
{
    public function __construct(
        private readonly AttendanceProcessingService $processingService,
        private readonly ShiftService $shiftService,
    ) {}

    /**
     * Display the Daily Attendance Ledger.
     */
    public function index(Request $request): Response
    {
        $tenantId = session('tenant_id') ?? app()->make('current_tenant_id') ?? null;
        $dateInput = $request->query('date') ?? Carbon::today()->toDateString();
        $date = Carbon::parse((string) $dateInput);

        $departmentId = $request->query('department_id');
        $status = $request->query('status');
        $search = $request->query('search');

        $query = AttendanceDaily::query()
            ->with([
                'employee:id,emp_no,full_name,email,department_id',
                'employee.department:id,name',
                'shift:id,name,code,shift_type,start_time,end_time,color,grace_minutes',
                'editor:id,name',
            ])
            ->whereDate('attendance_date', $date->toDateString());

        if ($tenantId !== null) {
            $query->where('tenant_id', $tenantId);
        }

        if (! empty($departmentId)) {
            $query->whereHas('employee', function ($q) use ($departmentId) {
                $q->where('department_id', $departmentId);
            });
        }

        if (! empty($status) && $status !== 'all') {
            if ($status === 'manual') {
                $query->where('is_manual', true);
            } elseif ($status === 'late') {
                $query->where('late_minutes', '>', 0);
            } else {
                $query->where('status', $status);
            }
        }

        if (! empty($search)) {
            $query->whereHas('employee', function ($q) use ($search) {
                $q->where('full_name', 'like', "%{$search}%")
                    ->orWhere('emp_no', 'like', "%{$search}%");
            });
        }

        $records = $query->orderBy('created_at', 'desc')->get();

        $stats = $this->processingService->getDailyLedgerStats($date);

        $departments = Department::query()
            ->when($tenantId, fn ($q) => $q->where('tenant_id', $tenantId))
            ->orderBy('name')
            ->get(['id', 'name']);

        $shifts = Shift::query()
            ->when($tenantId, fn ($q) => $q->where('tenant_id', $tenantId))
            ->orderBy('name')
            ->get();

        $rules = AttendanceRule::query()
            ->with('shift:id,name,code')
            ->when($tenantId, fn ($q) => $q->where('tenant_id', $tenantId))
            ->get();

        $holiday = $this->shiftService->isHoliday($date);

        return Inertia::render('Attendance/Daily', [
            'records' => $records,
            'stats' => $stats,
            'selectedDate' => $date->toDateString(),
            'departments' => $departments,
            'shifts' => $shifts,
            'rules' => $rules,
            'todayHoliday' => $holiday,
            'filters' => [
                'department_id' => $departmentId,
                'status' => $status,
                'search' => $search,
            ],
        ]);
    }

    /**
     * Trigger batch calculation of daily attendance.
     */
    public function process(ProcessAttendanceRequest $request): RedirectResponse
    {
        $validated = $request->validated();

        if (! empty($validated['start_date']) && ! empty($validated['end_date'])) {
            $startDate = Carbon::parse($validated['start_date']);
            $endDate = Carbon::parse($validated['end_date']);

            $result = $this->processingService->processRange(
                $startDate,
                $endDate,
                $validated['employee_id'] ?? null
            );

            return redirect()->back()->with('success', "Processed {$result['total_processed']} attendance records across date range.");
        }

        $date = Carbon::parse($validated['date'] ?? Carbon::today()->toDateString());

        $result = $this->processingService->processDate(
            $date,
            $validated['employee_id'] ?? null,
            $validated['department_id'] ?? null,
            (bool) ($validated['overwrite_manual'] ?? false)
        );

        return redirect()->back()->with(
            'success',
            "Calculated attendance for {$date->toDateString()}: {$result['processed']} processed ({$result['present']} present, {$result['absent']} absent, {$result['late']} late, {$result['missing_punch']} missing punches)."
        );
    }

    /**
     * Manually adjust an attendance daily record with mandatory audit justification.
     */
    public function update(AdjustDailyPunchRequest $request, AttendanceDaily $attendanceDaily): RedirectResponse
    {
        $user = $request->user();

        $this->processingService->adjustDailyRecord(
            $attendanceDaily,
            $request->validated(),
            $user
        );

        return redirect()->back()->with('success', 'Attendance record manually adjusted with audit record.');
    }

    /**
     * Save or update an attendance management rule.
     */
    public function saveRule(SaveAttendanceRuleRequest $request): RedirectResponse
    {
        $tenantId = session('tenant_id') ?? app()->make('current_tenant_id') ?? null;
        if ($tenantId === null) {
            return redirect()->back()->with('error', 'Tenant context required.');
        }

        $this->processingService->saveAttendanceRule($request->validated(), $tenantId);

        return redirect()->back()->with('success', 'Attendance & OT management rule saved.');
    }
}
