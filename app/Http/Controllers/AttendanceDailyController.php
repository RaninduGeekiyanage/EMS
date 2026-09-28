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
use Illuminate\Http\JsonResponse;
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
        $name = $request->query('name');
        $empNo = $request->query('emp_no');

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

        if (! empty($name)) {
            $query->whereHas('employee', function ($q) use ($name) {
                $q->where('full_name', 'like', "%{$name}%");
            });
        }

        if (! empty($empNo)) {
            $query->whereHas('employee', function ($q) use ($empNo) {
                $q->where('emp_no', $empNo);
            });
        }

        if (! empty($search)) {
            $query->whereHas('employee', function ($q) use ($search) {
                $q->where('full_name', 'like', "%{$search}%")
                    ->orWhere('emp_no', 'like', "%{$search}%");
            });
        }

        $records = $query->orderBy('created_at', 'desc')->paginate(30)->withQueryString();

        $stats = $this->processingService->getDailyLedgerStats($date);
        $unprocessedStats = $this->processingService->getUnprocessedSummary($tenantId);
        $isPayrollLocked = $this->processingService->isDateInLockedPayrollPeriod($date, $tenantId);

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
            'unprocessedStats' => $unprocessedStats,
            'isPayrollLocked' => $isPayrollLocked,
            'selectedDate' => $date->toDateString(),
            'departments' => $departments,
            'shifts' => $shifts,
            'rules' => $rules,
            'todayHoliday' => $holiday,
            'filters' => [
                'department_id' => $departmentId,
                'status' => $status,
                'search' => $search,
                'name' => $name,
                'emp_no' => $empNo,
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

            $result = $this->processingService->reprocessDateRange(
                $startDate,
                $endDate,
                $validated['employee_id'] ?? null,
                $validated['department_id'] ?? null,
                (bool) ($validated['overwrite_manual'] ?? false)
            );

            return redirect()->back()->with('success', "Reprocessed {$result['total_processed']} attendance records across date range ({$result['present']} present, {$result['absent']} absent, {$result['late']} late, {$result['missing_punch']} missing punches).");
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
     * Process a single date as part of a safe, sequential batch loop.
     */
    public function processSingleDate(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'date' => ['required', 'date'],
            'department_id' => ['nullable', 'string'],
            'overwrite_manual' => ['nullable', 'boolean'],
        ]);

        $date = Carbon::parse($validated['date']);
        $tenantId = session('tenant_id') ?? app()->make('current_tenant_id') ?? null;

        if ($this->processingService->isDateInLockedPayrollPeriod($date, $tenantId)) {
            return response()->json([
                'success' => false,
                'message' => "Payroll for {$date->toDateString()} is finalized and locked.",
            ], 422);
        }

        $result = $this->processingService->processDate(
            $date,
            null,
            $validated['department_id'] ?? null,
            (bool) ($validated['overwrite_manual'] ?? false)
        );

        return response()->json([
            'success' => true,
            'date' => $date->toDateString(),
            'records_processed' => $result['processed'],
            'processed' => $result['processed'],
            'stats' => [
                'processed' => $result['processed'],
                'present' => $result['present'],
                'absent' => $result['absent'],
                'late' => $result['late'],
                'missing_punch' => $result['missing_punch'],
            ],
            'present' => $result['present'],
            'absent' => $result['absent'],
            'late' => $result['late'],
            'missing_punch' => $result['missing_punch'],
        ]);
    }

    /**
     * Process all pending unprocessed biometric punch logs across all historical dates.
     */
    public function processBacklog(Request $request): RedirectResponse
    {
        $tenantId = session('tenant_id') ?? app()->make('current_tenant_id') ?? null;
        $result = $this->processingService->processUnprocessedBacklog($tenantId);

        if ($result['dates_count'] === 0) {
            return redirect()->back()->with('info', 'No unprocessed raw biometric logs found.');
        }

        $datesList = implode(', ', $result['processed_dates']);

        return redirect()->back()->with(
            'success',
            "Processed backlog across {$result['dates_count']} dates ({$datesList}): {$result['total_processed']} records updated ({$result['present']} present, {$result['absent']} absent, {$result['late']} late, {$result['missing_punch']} single punches)."
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
