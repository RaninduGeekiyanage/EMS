<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\AttendanceDaily;
use App\Models\Department;
use App\Models\Employee;
use Barryvdh\DomPDF\Facade\Pdf;
use Barryvdh\DomPDF\PDF as DomPdfWrapper;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
use Symfony\Component\HttpFoundation\StreamedResponse;

final class CustomReportService
{
    /**
     * Complete field dictionary available in Custom HR Report Builder.
     */
    public const AVAILABLE_COLUMNS = [
        'emp_no' => ['label' => 'Employee Number', 'group' => 'Identification'],
        'full_name' => ['label' => 'Full Name', 'group' => 'Identification'],
        'nic' => ['label' => 'NIC Number', 'group' => 'Identification'],
        'department' => ['label' => 'Department', 'group' => 'Workforce'],
        'designation' => ['label' => 'Designation', 'group' => 'Workforce'],
        'branch' => ['label' => 'Physical Branch', 'group' => 'Workforce'],
        'employment_category' => ['label' => 'Labor Category (Statutory)', 'group' => 'Workforce'],
        'attendance_mode' => ['label' => 'Attendance Mode', 'group' => 'Workforce'],
        'gender' => ['label' => 'Gender', 'group' => 'Demographics'],
        'date_of_birth' => ['label' => 'Date of Birth', 'group' => 'Demographics'],
        'marital_status' => ['label' => 'Marital Status', 'group' => 'Demographics'],
        'phone' => ['label' => 'Mobile Phone', 'group' => 'Demographics'],
        'email' => ['label' => 'Email Address', 'group' => 'Demographics'],
        'city' => ['label' => 'City', 'group' => 'Demographics'],
        'permanent_address' => ['label' => 'Permanent Address', 'group' => 'Demographics'],
        'date_of_joining' => ['label' => 'Date of Joining', 'group' => 'Employment'],
        'employment_type' => ['label' => 'Employment Type', 'group' => 'Employment'],
        'employment_status' => ['label' => 'Employment Status', 'group' => 'Employment'],
        'payment_mode' => ['label' => 'Payment Mode', 'group' => 'Payroll & Banking'],
        'basic_salary' => ['label' => 'Basic Salary', 'group' => 'Payroll & Banking'],
        'epf_no' => ['label' => 'EPF Member Number', 'group' => 'Payroll & Banking'],
        'bank_name' => ['label' => 'Bank Name', 'group' => 'Payroll & Banking'],
        'account_no' => ['label' => 'Account Number', 'group' => 'Payroll & Banking'],
    ];

    /**
     * Build report dataset based on filters and requested columns with projected eager loads.
     *
     * @param  array<string, mixed>  $filters
     * @param  array<int, string>  $columns
     * @return array{headers: array<string, string>, rows: array<int, array<string, mixed>>, total: int}
     */
    public function generateReport(string $tenantId, array $columns, array $filters = [], int $limit = 500): array
    {
        $query = Employee::query()
            ->where('tenant_id', $tenantId)
            ->with([
                'department:id,name',
                'designation:id,title',
                'branch:id,name',
                'paymentInfo:id,employee_id,payment_mode,basic_salary',
                'bankInfo:id,employee_id,bank_name,account_no',
                'epfInfo:id,employee_id,epf_no',
            ]);

        // Apply filters
        if (! empty($filters['department_id'])) {
            $query->where('department_id', $filters['department_id']);
        }
        if (! empty($filters['employment_status']) && $filters['employment_status'] !== 'all') {
            $query->where('employment_status', $filters['employment_status']);
        }
        if (! empty($filters['employment_category']) && $filters['employment_category'] !== 'all') {
            $query->where('employment_category', $filters['employment_category']);
        }
        if (! empty($filters['gender']) && $filters['gender'] !== 'all') {
            $query->where('gender', $filters['gender']);
        }

        $totalCount = $query->count();
        $employees = $query->orderBy('emp_no')->limit($limit)->get();

        $headers = [];
        foreach ($columns as $col) {
            if (isset(self::AVAILABLE_COLUMNS[$col])) {
                $headers[$col] = self::AVAILABLE_COLUMNS[$col]['label'];
            }
        }

        $rows = [];
        foreach ($employees as $emp) {
            $row = [];
            foreach ($columns as $col) {
                $row[$col] = match ($col) {
                    'emp_no' => $emp->emp_no,
                    'full_name' => $emp->full_name,
                    'nic' => $emp->nic,
                    'department' => $emp->department?->name ?? '—',
                    'designation' => $emp->designation?->title ?? '—',
                    'branch' => $emp->branch?->name ?? '—',
                    'employment_category' => $emp->employment_category === 'wages_board' ? 'Wages Board' : 'Shop & Office',
                    'attendance_mode' => ucfirst((string) ($emp->attendance_mode ?? 'both')),
                    'gender' => ucfirst((string) ($emp->gender ?? '—')),
                    'date_of_birth' => $emp->date_of_birth?->toDateString() ?? '—',
                    'marital_status' => ucfirst((string) ($emp->marital_status ?? '—')),
                    'phone' => $emp->phone ?? '—',
                    'email' => $emp->email ?? '—',
                    'city' => $emp->city ?? '—',
                    'permanent_address' => $emp->permanent_address ?? '—',
                    'date_of_joining' => $emp->date_of_joining?->toDateString() ?? '—',
                    'employment_type' => $this->formatValue($emp->employment_type),
                    'employment_status' => $this->formatValue($emp->employment_status),
                    'payment_mode' => $this->formatValue($emp->paymentInfo?->payment_mode),
                    'basic_salary' => $emp->paymentInfo ? number_format((float) $emp->paymentInfo->basic_salary, 2) : '—',
                    'epf_no' => $emp->epfInfo?->epf_no ?? '—',
                    'bank_name' => $emp->bankInfo?->bank_name ?? '—',
                    'account_no' => $emp->bankInfo?->account_no ?? '—',
                    default => '—',
                };
            }
            $rows[] = $row;
        }

        return [
            'headers' => $headers,
            'rows' => $rows,
            'total' => $totalCount,
        ];
    }

    /**
     * Stream CSV export with metadata header block.
     */
    public function exportCsv(string $tenantId, array $columns, array $filters = []): StreamedResponse
    {
        $reportData = $this->generateReport($tenantId, $columns, $filters, 2000);
        $filename = 'HR-Custom-Report-' . date('Ymd-His') . '.csv';

        $callback = function () use ($reportData) {
            $handle = fopen('php://output', 'w');
            if ($handle === false) {
                return;
            }

            // Write metadata block
            fputcsv($handle, ['# Enterprise Management System - Custom HR Report']);
            fputcsv($handle, ['# Generated At', Carbon::now()->toIso8601String()]);
            fputcsv($handle, ['# Total Records Matching', $reportData['total']]);
            fputcsv($handle, []); // Blank line

            // Header row
            fputcsv($handle, array_values($reportData['headers']));

            // Data rows
            foreach ($reportData['rows'] as $row) {
                fputcsv($handle, array_values($row));
            }

            fclose($handle);
        };

        return response()->stream($callback, 200, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => "attachment; filename=\"{$filename}\"",
            'Pragma' => 'no-cache',
            'Expires' => '0',
        ]);
    }

    /**
     * Render PDF report (auto-landscape if columns > 6).
     */
    public function exportPdf(string $tenantId, array $columns, array $filters = []): DomPdfWrapper
    {
        $reportData = $this->generateReport($tenantId, $columns, $filters, 500);
        $isLandscape = count($columns) > 6;

        /** @var DomPdfWrapper $pdf */
        $pdf = Pdf::loadView('pdf.custom-report', [
            'report' => $reportData,
            'generatedAt' => Carbon::now()->format('Y-m-d H:i:s'),
        ]);

        $pdf->setPaper('a4', $isLandscape ? 'landscape' : 'portrait');
        $pdf->setOption('isHtml5ParserEnabled', true);

        return $pdf;
    }

    /**
     * Format a mixed value or BackedEnum safely into a readable string.
     */
    private function formatValue(mixed $value): string
    {
        if ($value === null) {
            return '—';
        }
        if ($value instanceof \BackedEnum) {
            return ucfirst(str_replace('_', ' ', (string) $value->value));
        }
        if ($value instanceof \UnitEnum) {
            return ucfirst(str_replace('_', ' ', $value->name));
        }
        if (is_bool($value)) {
            return $value ? 'Yes' : 'No';
        }

        $str = (string) $value;
        return $str !== '' ? ucfirst(str_replace('_', ' ', $str)) : '—';
    }
}
