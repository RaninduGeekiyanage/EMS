<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\Department;
use App\Services\CustomReportService;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpFoundation\Response as SymfonyResponse;

final class CustomReportController extends Controller
{
    public function __construct(
        private readonly CustomReportService $reportService,
    ) {}

    /**
     * Display the dynamic Custom HR Report Builder UI.
     */
    public function index(Request $request): Response
    {
        $tenantId = session('tenant_id') ?? app()->make('current_tenant_id') ?? null;

        $defaultColumns = ['emp_no', 'full_name', 'department', 'designation', 'employment_category', 'payment_mode', 'basic_salary'];
        $selectedColumns = $request->query('columns')
            ? (array) $request->query('columns')
            : $defaultColumns;

        $filters = [
            'department_id' => $request->query('department_id'),
            'employment_status' => $request->query('employment_status', 'active'),
            'employment_category' => $request->query('employment_category'),
            'gender' => $request->query('gender'),
        ];

        $reportData = $this->reportService->generateReport($tenantId, $selectedColumns, $filters);

        $departments = Department::where('tenant_id', $tenantId)
            ->where('is_active', true)
            ->get(['id', 'name', 'code']);

        return Inertia::render('Reports/CustomBuilder', [
            'availableColumns' => CustomReportService::AVAILABLE_COLUMNS,
            'selectedColumns' => $selectedColumns,
            'filters' => $filters,
            'departments' => $departments,
            'report' => $reportData,
            'previewData' => $reportData,
        ]);
    }

    /**
     * Export custom report as CSV.
     */
    public function exportCsv(Request $request): SymfonyResponse
    {
        $tenantId = session('tenant_id') ?? app()->make('current_tenant_id') ?? null;

        $columns = (array) $request->input('columns', ['emp_no', 'full_name', 'department', 'designation']);
        $filters = (array) $request->input('filters', []);

        return $this->reportService->exportCsv($tenantId, $columns, $filters);
    }

    /**
     * Export custom report as PDF.
     */
    public function exportPdf(Request $request): SymfonyResponse
    {
        $tenantId = session('tenant_id') ?? app()->make('current_tenant_id') ?? null;

        $columns = (array) $request->input('columns', ['emp_no', 'full_name', 'department', 'designation']);
        $filters = (array) $request->input('filters', []);

        $pdf = $this->reportService->exportPdf($tenantId, $columns, $filters);
        $filename = 'HR-Custom-Report-' . date('Ymd-His') . '.pdf';

        return $pdf->download($filename);
    }
}
