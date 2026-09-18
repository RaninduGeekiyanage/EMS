<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Services\RosterService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

final class RosterExportController extends Controller
{
    public function __construct(
        private readonly RosterService $rosterService,
    ) {}

    /**
     * Export the monthly duty roster matrix to a noticeboard-ready CSV file.
     */
    public function export(Request $request): StreamedResponse
    {
        $year = (int) $request->input('year', Carbon::now()->year);
        $month = (int) $request->input('month', Carbon::now()->month);
        $departmentId = $request->input('department_id');

        $data = $this->rosterService->getMonthMatrix($year, $month, $departmentId);

        $filename = sprintf('Duty_Roster_%04d_%02d.csv', $year, $month);

        $headers = [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => "attachment; filename=\"{$filename}\"",
            'Pragma' => 'no-cache',
            'Cache-Control' => 'must-revalidate, post-check=0, pre-check=0',
            'Expires' => '0',
        ];

        return response()->stream(function () use ($data): void {
            $handle = fopen('php://output', 'w');
            if ($handle === false) {
                return;
            }

            // Write UTF-8 BOM for Excel compatibility
            fputs($handle, "\xEF\xBB\xBF");

            // Build CSV Header row
            $headerRow = ['Employee No', 'Full Name', 'Department'];
            foreach ($data['days'] as $day) {
                $headerRow[] = sprintf('%02d %s', $day['day'], $day['day_name']);
            }
            $headerRow[] = 'Work Days';
            $headerRow[] = 'Rest Days';
            $headerRow[] = 'Total Hours';

            fputcsv($handle, $headerRow);

            // Write Employee Matrix Rows
            foreach ($data['matrix'] as $row) {
                $emp = $row['employee'];
                $line = [
                    $emp['emp_no'],
                    $emp['full_name'],
                    $emp['department']['name'] ?? 'General',
                ];

                foreach ($data['days'] as $day) {
                    $cell = $row['cells'][$day['date']] ?? null;

                    if ($cell && $cell['leave'] !== null) {
                        $line[] = $cell['leave']['leave_code'] ?? 'LV';
                    } elseif ($cell && ($cell['schedule_type'] === 'rest_day' || $cell['schedule_type'] === 'off')) {
                        $line[] = 'OFF';
                    } elseif ($cell && $cell['shift'] !== null) {
                        $line[] = $cell['shift']['code'];
                    } elseif ($day['holiday'] !== null) {
                        $line[] = 'PH';
                    } else {
                        $line[] = '-';
                    }
                }

                $line[] = $row['stats']['work_days'];
                $line[] = $row['stats']['rest_days'];
                $line[] = $row['stats']['total_hours'];

                fputcsv($handle, $line);
            }

            // Write Coverage Headcount Summary Footer Rows
            fputcsv($handle, []); // empty separator
            fputcsv($handle, ['--- DAILY COVERAGE HEADCOUNT SUMMARY ---']);

            $workingRow = ['Total Working Staff', '', ''];
            $restRow = ['Total Rest Days (OFF)', '', ''];
            $leaveRow = ['Total Approved Leaves', '', ''];

            foreach ($data['days'] as $day) {
                $dayStats = $data['coverage_summary'][$day['date']] ?? null;
                $workingRow[] = $dayStats['total_working'] ?? 0;
                $restRow[] = $dayStats['total_rest'] ?? 0;
                $leaveRow[] = $dayStats['total_leave'] ?? 0;
            }

            fputcsv($handle, $workingRow);
            fputcsv($handle, $restRow);
            fputcsv($handle, $leaveRow);

            fclose($handle);
        }, 200, $headers);
    }
}
