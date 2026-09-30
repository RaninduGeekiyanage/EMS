<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\AttendanceDaily;
use App\Models\AttendanceLog;
use App\Models\Department;
use App\Models\Employee;
use Barryvdh\DomPDF\Facade\Pdf;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Http\Response as HttpResponse;
use Illuminate\Pagination\LengthAwarePaginator;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

final class AttendanceLogController extends Controller
{
    /**
     * Display the Attendance Logs audit & troubleshooting ledger.
     */
    public function index(Request $request): Response
    {
        $tenantId = session('tenant_id') ?? (app()->bound('current_tenant_id') ? app('current_tenant_id') : null);
        $executed = $request->boolean('executed', false);

        $departments = Department::query()
            ->when($tenantId, fn ($q) => $q->where('tenant_id', $tenantId))
            ->orderBy('name')
            ->get(['id', 'name']);

        // Default empty state when first visiting page
        if (! $executed) {
            return Inertia::render('Attendance/Logs', [
                'records' => null,
                'stats' => null,
                'executed' => false,
                'departments' => $departments,
                'filters' => [
                    'date_from' => $request->query('date_from', ''),
                    'date_to' => $request->query('date_to', ''),
                    'name' => $request->query('name', ''),
                    'emp_no' => $request->query('emp_no', ''),
                    'raw_biometric_id' => $request->query('raw_biometric_id', ''),
                    'department_id' => $request->query('department_id', ''),
                    'status' => $request->query('status', 'all'),
                    'punch_type' => $request->query('punch_type', 'all'),
                    'source' => $request->query('source', 'all'),
                ],
            ]);
        }

        $query = $this->buildFilterQuery($request, $tenantId);

        // Compute summary metrics for filtered set before pagination
        $stats = [
            'total_count' => (clone $query)->count(),
            'processed_count' => (clone $query)->where('is_processed', true)->count(),
            'unprocessed_count' => (clone $query)->where('is_processed', false)->count(),
            'unique_employees' => (clone $query)->distinct('employee_id')->count('employee_id'),
        ];

        // Paginate exactly 30 records per page as requested
        $paginator = $query->orderBy('punch_datetime', 'desc')
            ->paginate(30)
            ->withQueryString();

        // Enrich the current page with Attendance Daily Comparison Resolution
        $enrichedItems = $this->enrichWithComparisonResolution($paginator->items(), $tenantId);

        $records = new LengthAwarePaginator(
            $enrichedItems,
            $paginator->total(),
            $paginator->perPage(),
            $paginator->currentPage(),
            [
                'path' => LengthAwarePaginator::resolveCurrentPath(),
                'query' => $request->query(),
            ]
        );

        return Inertia::render('Attendance/Logs', [
            'records' => $records,
            'stats' => $stats,
            'executed' => true,
            'departments' => $departments,
            'filters' => [
                'date_from' => $request->query('date_from', ''),
                'date_to' => $request->query('date_to', ''),
                'name' => $request->query('name', ''),
                'emp_no' => $request->query('emp_no', ''),
                'raw_biometric_id' => $request->query('raw_biometric_id', ''),
                'department_id' => $request->query('department_id', ''),
                'status' => $request->query('status', 'all'),
                'punch_type' => $request->query('punch_type', 'all'),
                'source' => $request->query('source', 'all'),
            ],
        ]);
    }

    /**
     * Stream filtered attendance logs to an Excel-compatible CSV.
     */
    public function exportExcel(Request $request): StreamedResponse
    {
        $tenantId = session('tenant_id') ?? (app()->bound('current_tenant_id') ? app('current_tenant_id') : null);
        $query = $this->buildFilterQuery($request, $tenantId);

        $filename = 'attendance_logs_' . Carbon::now()->format('Ymd_His') . '.csv';

        $headers = [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => "attachment; filename=\"{$filename}\"",
            'Pragma' => 'no-cache',
            'Cache-Control' => 'must-revalidate, post-check=0, pre-check=0',
            'Expires' => '0',
        ];

        return response()->stream(function () use ($query, $tenantId): void {
            $handle = fopen('php://output', 'w');
            if ($handle === false) {
                return;
            }

            // UTF-8 BOM for Microsoft Excel compatibility
            fwrite($handle, "\xEF\xBB\xBF");

            // CSV Column Headers
            fputcsv($handle, [
                '#',
                'Employee No',
                'Raw Biometric ID',
                'Employee Name',
                'Department',
                'Punch Date',
                'Punch Time',
                'Punch Type',
                'Device / Terminal',
                'Source',
                'Process Status',
                'Processed At',
                'Comparison Resolution',
                'Daily Ledger Status',
            ]);

            $index = 1;
            // Cap export chunk for memory safety
            $query->orderBy('punch_datetime', 'desc')
                ->chunk(200, function ($logs) use (&$index, $handle, $tenantId): void {
                    $enriched = $this->enrichWithComparisonResolution($logs->all(), $tenantId);

                    foreach ($enriched as $log) {
                        $punchDt = Carbon::parse($log->punch_datetime);
                        $employee = $log->employee;
                        $comparison = $log->comparison ?? [];

                        fputcsv($handle, [
                            $index++,
                            $employee?->emp_no ?? '—',
                            $log->raw_biometric_id ?? '—',
                            $employee?->full_name ?? 'Unlinked Employee',
                            $employee?->department?->name ?? '—',
                            $punchDt->toDateString(),
                            $punchDt->format('H:i:s'),
                            strtoupper($log->punch_type ?? 'AUTO'),
                            $log->device_id ?? 'Default',
                            ucfirst((string) $log->source),
                            $log->is_processed ? 'Processed' : 'Unprocessed',
                            $log->processed_at ? Carbon::parse($log->processed_at)->toDateTimeString() : '—',
                            $comparison['label'] ?? '—',
                            $comparison['daily_status'] ?? '—',
                        ]);
                    }
                });

            fclose($handle);
        }, 200, $headers);
    }

    /**
     * Export filtered attendance logs as a styled PDF audit report.
     */
    public function exportPdf(Request $request): HttpResponse
    {
        $tenantId = session('tenant_id') ?? (app()->bound('current_tenant_id') ? app('current_tenant_id') : null);
        $query = $this->buildFilterQuery($request, $tenantId);

        // Cap at 1,000 records for DomPDF rendering safety
        $logs = $query->orderBy('punch_datetime', 'desc')
            ->limit(1000)
            ->get();

        $enrichedLogs = $this->enrichWithComparisonResolution($logs->all(), $tenantId);

        $pdf = Pdf::loadView('pdf.attendance-logs', [
            'logs' => $enrichedLogs,
            'filters' => [
                'date_from' => $request->query('date_from'),
                'date_to' => $request->query('date_to'),
                'name' => $request->query('name'),
                'emp_no' => $request->query('emp_no'),
                'status' => $request->query('status'),
            ],
            'generatedAt' => Carbon::now()->format('Y-m-d H:i:s'),
            'totalCount' => count($enrichedLogs),
        ]);

        $pdf->setPaper('a4', 'landscape');
        $pdf->setOption('isHtml5ParserEnabled', true);

        return $pdf->download('attendance_logs_' . Carbon::now()->format('Ymd_His') . '.pdf');
    }

    /**
     * Construct the filtered Eloquent query for AttendanceLog.
     */
    private function buildFilterQuery(Request $request, ?string $tenantId)
    {
        $query = AttendanceLog::query()
            ->with([
                'employee:id,emp_no,full_name,department_id,biometric_device_id',
                'employee.department:id,name',
                'import:id,filename,adapter_type,created_at',
            ]);

        if ($tenantId !== null) {
            $query->where('tenant_id', $tenantId);
        }

        // Date range filters
        $dateFrom = $request->query('date_from');
        $dateTo = $request->query('date_to');

        if (! empty($dateFrom) && ! empty($dateTo)) {
            $query->whereBetween('punch_datetime', [
                "{$dateFrom} 00:00:00",
                "{$dateTo} 23:59:59",
            ]);
        } elseif (! empty($dateFrom)) {
            $query->where('punch_datetime', '>=', "{$dateFrom} 00:00:00");
        } elseif (! empty($dateTo)) {
            $query->where('punch_datetime', '<=', "{$dateTo} 23:59:59");
        }

        // Filter by exact employee number
        $empNo = trim((string) $request->query('emp_no', ''));
        if (! empty($empNo)) {
            $query->whereHas('employee', function ($q) use ($empNo) {
                $q->where('emp_no', $empNo);
            });
        }

        // Filter by employee name (partial search)
        $name = trim((string) $request->query('name', ''));
        if (! empty($name)) {
            $query->whereHas('employee', function ($q) use ($name) {
                $q->where('full_name', 'like', "%{$name}%");
            });
        }

        // Filter by raw biometric ID (e.g. machine user id like "101")
        $rawBiometricId = trim((string) $request->query('raw_biometric_id', ''));
        if (! empty($rawBiometricId)) {
            $query->where('raw_biometric_id', 'like', "%{$rawBiometricId}%");
        }

        // Filter by department
        $departmentId = $request->query('department_id');
        if (! empty($departmentId)) {
            $query->whereHas('employee', function ($q) use ($departmentId) {
                $q->where('department_id', $departmentId);
            });
        }

        // Filter by processing status
        $status = $request->query('status');
        if (! empty($status) && $status !== 'all') {
            if ($status === 'processed') {
                $query->where('is_processed', true);
            } elseif ($status === 'unprocessed') {
                $query->where('is_processed', false);
            }
        }

        // Filter by punch type (in, out, auto)
        $punchType = $request->query('punch_type');
        if (! empty($punchType) && $punchType !== 'all') {
            $query->where('punch_type', $punchType);
        }

        // Filter by source (import, manual, api, etc.)
        $source = $request->query('source');
        if (! empty($source) && $source !== 'all') {
            $query->where('source', $source);
        }

        return $query;
    }

    /**
     * Enrich attendance logs with AttendanceDaily comparison resolution.
     *
     * @param  array<int, AttendanceLog>  $logs
     * @return array<int, AttendanceLog>
     */
    private function enrichWithComparisonResolution(array $logs, ?string $tenantId): array
    {
        if (empty($logs)) {
            return [];
        }

        // Collect unique employee IDs and dates
        $employeeIds = [];
        $dates = [];

        foreach ($logs as $log) {
            if ($log->employee_id) {
                $employeeIds[] = $log->employee_id;
            }
            $dates[] = Carbon::parse($log->punch_datetime)->toDateString();
        }

        $employeeIds = array_values(array_unique($employeeIds));
        $dates = array_values(array_unique($dates));

        $minDate = min($dates);
        $maxDate = max($dates);

        // Fetch corresponding daily attendance records in one batch query
        $dailyRecords = AttendanceDaily::query()
            ->when($tenantId, fn ($q) => $q->where('tenant_id', $tenantId))
            ->whereIn('employee_id', $employeeIds)
            ->whereDate('attendance_date', '>=', $minDate)
            ->whereDate('attendance_date', '<=', $maxDate)
            ->with('shift:id,name,code,start_time,end_time')
            ->get()
            ->keyBy(fn ($item) => "{$item->employee_id}_" . Carbon::parse($item->attendance_date)->toDateString());

        foreach ($logs as $log) {
            $logDate = Carbon::parse($log->punch_datetime)->toDateString();
            $logTime = Carbon::parse($log->punch_datetime)->format('H:i');
            $key = "{$log->employee_id}_{$logDate}";
            $daily = $dailyRecords->get($key);

            if ($daily !== null) {
                $dailyCheckIn = $daily->check_in ? Carbon::parse($daily->check_in) : null;
                $dailyCheckOut = $daily->check_out ? Carbon::parse($daily->check_out) : null;
                $logDt = Carbon::parse($log->punch_datetime);

                $isCheckIn = $dailyCheckIn && abs($dailyCheckIn->diffInMinutes($logDt)) <= 1;
                $isCheckOut = $dailyCheckOut && abs($dailyCheckOut->diffInMinutes($logDt)) <= 1;

                if ($isCheckIn) {
                    $log->comparison = [
                        'type' => 'matched_check_in',
                        'label' => 'Matched Check-In',
                        'badge_color' => 'emerald',
                        'shift_name' => $daily->shift?->name ?? 'Standard',
                        'daily_status' => $daily->status,
                        'description' => "Assigned as Shift Check-In ({$dailyCheckIn->format('H:i')})",
                        'date' => $logDate,
                        'emp_no' => $log->employee?->emp_no,
                    ];
                } elseif ($isCheckOut) {
                    $log->comparison = [
                        'type' => 'matched_check_out',
                        'label' => 'Matched Check-Out',
                        'badge_color' => 'blue',
                        'shift_name' => $daily->shift?->name ?? 'Standard',
                        'daily_status' => $daily->status,
                        'description' => "Assigned as Shift Check-Out ({$dailyCheckOut->format('H:i')})",
                        'date' => $logDate,
                        'emp_no' => $log->employee?->emp_no,
                    ];
                } elseif ($log->is_processed) {
                    $log->comparison = [
                        'type' => 'intermediate_debounced',
                        'label' => 'Debounced / Mid-Shift',
                        'badge_color' => 'slate',
                        'shift_name' => $daily->shift?->name ?? 'Standard',
                        'daily_status' => $daily->status,
                        'description' => 'Evaluated by engine; suppressed by debounce grace window or recorded as intermediate punch',
                        'date' => $logDate,
                        'emp_no' => $log->employee?->emp_no,
                    ];
                } else {
                    $log->comparison = [
                        'type' => 'unlinked_discrepancy',
                        'label' => 'Discrepancy (Not Linked)',
                        'badge_color' => 'amber',
                        'shift_name' => $daily->shift?->name ?? 'Standard',
                        'daily_status' => $daily->status,
                        'description' => "Daily record exists (Status: {$daily->status}), but this raw biometric punch remains unlinked",
                        'date' => $logDate,
                        'emp_no' => $log->employee?->emp_no,
                    ];
                }
            } else {
                if ($log->is_processed) {
                    $log->comparison = [
                        'type' => 'processed_no_ledger',
                        'label' => 'Processed (No Ledger)',
                        'badge_color' => 'indigo',
                        'shift_name' => null,
                        'daily_status' => 'None',
                        'description' => 'Marked processed without active daily attendance ledger record',
                        'date' => $logDate,
                        'emp_no' => $log->employee?->emp_no,
                    ];
                } else {
                    $log->comparison = [
                        'type' => 'pending_evaluation',
                        'label' => 'Pending Engine Evaluation',
                        'badge_color' => 'rose',
                        'shift_name' => null,
                        'daily_status' => 'Pending',
                        'description' => 'Engine has not evaluated or generated daily ledger for this date yet',
                        'date' => $logDate,
                        'emp_no' => $log->employee?->emp_no,
                    ];
                }
            }
        }

        return $logs;
    }
}
