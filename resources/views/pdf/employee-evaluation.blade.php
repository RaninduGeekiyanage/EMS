<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>
    <title>Performance Appraisal - {{ $employee->emp_no }} - {{ $evaluation->evaluation_period }}</title>
    <style>
        @page {
            margin: 25px 30px 25px 30px;
            size: a4 portrait;
        }
        body {
            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
            font-size: 10px;
            color: #1e293b;
            line-height: 1.4;
            margin: 0;
            padding: 0;
        }
        .container {
            border: 1px solid #cbd5e1;
            border-radius: 6px;
            padding: 20px;
            background-color: #ffffff;
        }
        table {
            width: 100%;
            border-collapse: collapse;
        }
        .header-table {
            margin-bottom: 14px;
            border-bottom: 2px solid #3b82f6;
            padding-bottom: 10px;
        }
        .company-title {
            font-size: 17px;
            font-weight: bold;
            color: #0f172a;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin: 0 0 3px 0;
        }
        .company-subtitle {
            font-size: 9px;
            color: #64748b;
            margin: 0;
        }
        .doc-badge {
            display: inline-block;
            background-color: #1e293b;
            color: #ffffff;
            font-size: 12px;
            font-weight: bold;
            padding: 5px 12px;
            border-radius: 4px;
            text-transform: uppercase;
            letter-spacing: 0.8px;
        }
        .period-label {
            font-size: 11px;
            font-weight: bold;
            color: #2563eb;
            margin-top: 4px;
        }

        /* Employee Info Grid */
        .info-card {
            background-color: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 5px;
            padding: 10px;
            margin-bottom: 14px;
        }
        .info-card table td {
            padding: 3px 6px;
            font-size: 9.5px;
        }
        .info-label {
            font-weight: bold;
            color: #475569;
            width: 18%;
        }
        .info-value {
            color: #0f172a;
            width: 32%;
        }

        /* Performance Scorecard Banner */
        .scorecard-banner {
            border: 1px solid #bfdbfe;
            background: #eff6ff;
            border-radius: 6px;
            padding: 12px 16px;
            margin-bottom: 14px;
        }
        .scorecard-table td {
            vertical-align: middle;
        }
        .score-huge {
            font-size: 26px;
            font-weight: 800;
            color: #1d4ed8;
            line-height: 1;
        }
        .score-sub {
            font-size: 9px;
            color: #6b7280;
            margin-top: 2px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .grade-badge {
            display: inline-block;
            padding: 5px 12px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: bold;
            color: #ffffff;
            background-color: #2563eb;
            text-transform: uppercase;
        }
        .grade-A_PLUS, .grade-A {
            background-color: #059669;
        }
        .grade-B {
            background-color: #2563eb;
        }
        .grade-C {
            background-color: #d97706;
        }
        .grade-D {
            background-color: #dc2626;
        }

        /* Criteria Table */
        .criteria-table {
            margin-bottom: 14px;
        }
        .criteria-table th {
            background-color: #f1f5f9;
            color: #334155;
            font-size: 8.5px;
            font-weight: bold;
            text-transform: uppercase;
            padding: 6px 8px;
            border: 1px solid #cbd5e1;
            text-align: left;
        }
        .criteria-table td {
            padding: 6px 8px;
            border: 1px solid #e2e8f0;
            font-size: 9px;
            color: #334155;
            vertical-align: top;
        }
        .criteria-table tr:nth-child(even) {
            background-color: #f8fafc;
        }
        .text-center { text-align: center; }
        .text-right { text-align: right; }
        .font-bold { font-weight: bold; }

        /* Comments Box */
        .comments-section {
            margin-bottom: 14px;
        }
        .comment-box {
            border: 1px solid #e2e8f0;
            border-radius: 4px;
            padding: 8px 10px;
            background-color: #ffffff;
            margin-bottom: 8px;
        }
        .comment-title {
            font-size: 9.5px;
            font-weight: bold;
            color: #334155;
            margin-bottom: 4px;
            border-bottom: 1px solid #f1f5f9;
            padding-bottom: 3px;
        }
        .comment-text {
            font-size: 9px;
            color: #475569;
            white-space: pre-wrap;
        }

        /* Signatures */
        .signature-table {
            margin-top: 20px;
            border-top: 1px dashed #cbd5e1;
            padding-top: 15px;
        }
        .signature-table td {
            width: 33.33%;
            padding: 5px 12px;
            vertical-align: top;
        }
        .sig-line {
            border-top: 1px solid #0f172a;
            margin-top: 35px;
            padding-top: 4px;
            text-align: center;
            font-size: 8.5px;
            font-weight: bold;
            color: #1e293b;
        }
        .sig-meta {
            text-align: center;
            font-size: 7.5px;
            color: #64748b;
        }

        .footer-note {
            margin-top: 15px;
            text-align: center;
            font-size: 7.5px;
            color: #94a3b8;
            border-top: 1px solid #f1f5f9;
            padding-top: 6px;
        }
    </style>
</head>
<body>
<div class="container">
    <!-- Header -->
    <table class="header-table">
        <tr>
            <td style="width: 60%; vertical-align: top;">
                <div class="company-title">{{ $company->name ?? config('app.name', 'Enterprise EMS') }}</div>
                <div class="company-subtitle">Human Resources Department • Confidential Performance & KPI Record</div>
                <div class="company-subtitle">Document ID: {{ $evaluation->id }} • Generated: {{ now()->format('d M Y, h:i A') }}</div>
            </td>
            <td style="width: 40%; text-align: right; vertical-align: top;">
                <div class="doc-badge">Performance Appraisal</div>
                <div class="period-label">{{ $evaluation->evaluation_period }}</div>
                <div style="font-size: 8px; color: #64748b; margin-top: 3px;">
                    Date: {{ \Carbon\Carbon::parse($evaluation->evaluation_date)->format('d F Y') }}
                </div>
            </td>
        </tr>
    </table>

    <!-- Employee Information -->
    <div class="info-card">
        <table>
            <tr>
                <td class="info-label">Employee Name:</td>
                <td class="info-value font-bold">{{ $employee->full_name }}</td>
                <td class="info-label">Employee ID:</td>
                <td class="info-value font-bold">{{ $employee->emp_no }}</td>
            </tr>
            <tr>
                <td class="info-label">Department:</td>
                <td class="info-value">{{ $employee->department->name ?? 'N/A' }}</td>
                <td class="info-label">Designation:</td>
                <td class="info-value">{{ $employee->designation->title ?? 'N/A' }}</td>
            </tr>
            <tr>
                <td class="info-label">Branch / Site:</td>
                <td class="info-value">{{ $employee->branch->name ?? 'Head Office' }}</td>
                <td class="info-label">Date of Joining:</td>
                <td class="info-value">{{ $employee->date_of_joining ? \Carbon\Carbon::parse($employee->date_of_joining)->format('d M Y') : 'N/A' }}</td>
            </tr>
            <tr>
                <td class="info-label">Evaluator (HOD):</td>
                <td class="info-value">{{ $evaluation->evaluator->name ?? 'Department Head' }}</td>
                <td class="info-label">HR Reviewer:</td>
                <td class="info-value">{{ $evaluation->hrReviewer->name ?? 'Pending HR Review' }}</td>
            </tr>
        </table>
    </div>

    <!-- Scorecard Banner -->
    <div class="scorecard-banner">
        <table class="scorecard-table">
            <tr>
                <td style="width: 35%;">
                    <div class="score-sub">Overall Weighted Score</div>
                    <div class="score-huge">{{ number_format($evaluation->overall_score, 2) }} <span style="font-size: 14px; font-weight: normal; color: #64748b;">/ 100</span></div>
                </td>
                <td style="width: 35%; text-align: center;">
                    <div class="score-sub">Performance Grade</div>
                    <div style="margin-top: 3px;">
                        <span class="grade-badge grade-{{ str_replace('+', '_PLUS', $evaluation->performance_grade ?? 'D') }}">
                            Grade {{ $evaluation->performance_grade ?? 'N/A' }}
                        </span>
                    </div>
                    <div style="font-size: 8px; color: #475569; margin-top: 3px; font-weight: 500;">
                        {{ $gradeLabel }}
                    </div>
                </td>
                <td style="width: 30%; text-align: right;">
                    <div class="score-sub">Workflow Status</div>
                    <div style="margin-top: 4px; font-size: 10px; font-weight: bold; color: {{ $evaluation->status === 'confirmed_by_hr' ? '#059669' : ($evaluation->status === 'draft' ? '#64748b' : '#d97706') }}; text-transform: uppercase;">
                        {{ str_replace('_', ' ', $evaluation->status) }}
                    </div>
                    @if($evaluation->is_bypassed_by_hr)
                        <div style="font-size: 7.5px; color: #dc2626; font-weight: bold; margin-top: 2px;">
                            * Confirmed via HR Managerial Bypass
                        </div>
                    @endif
                </td>
            </tr>
        </table>
    </div>

    <!-- Criteria Breakdown Table -->
    <table class="criteria-table">
        <thead>
            <tr>
                <th style="width: 5%;" class="text-center">#</th>
                <th style="width: 30%;">Evaluation Criterion</th>
                <th style="width: 10%;" class="text-center">Weight</th>
                <th style="width: 12%;" class="text-center">Score (100)</th>
                <th style="width: 13%;" class="text-center">Weighted Score</th>
                <th style="width: 30%;">HOD Qualitative Remarks</th>
            </tr>
        </thead>
        <tbody>
            @php $rowIdx = 1; @endphp
            @foreach($criteria as $key => $item)
                <tr>
                    <td class="text-center">{{ $rowIdx++ }}</td>
                    <td>
                        <div class="font-bold">{{ $item['title'] ?? ucfirst(str_replace('_', ' ', $key)) }}</div>
                        <div style="font-size: 7.5px; color: #64748b;">{{ $item['description'] ?? '' }}</div>
                    </td>
                    <td class="text-center font-bold">{{ number_format($item['weight'] ?? 20, 0) }}%</td>
                    <td class="text-center font-bold" style="color: #1e40af;">{{ number_format($item['score'] ?? 0, 1) }}</td>
                    <td class="text-center font-bold" style="color: #047857;">{{ number_format($item['weighted_score'] ?? 0, 2) }}</td>
                    <td>{{ !empty($item['remarks']) ? $item['remarks'] : '-' }}</td>
                </tr>
            @endforeach
        </tbody>
        <tfoot>
            <tr style="background-color: #f1f5f9; font-weight: bold;">
                <td colspan="2" class="text-right">TOTAL SUMMARY:</td>
                <td class="text-center">100%</td>
                <td class="text-center">-</td>
                <td class="text-center" style="color: #1d4ed8; font-size: 10px;">{{ number_format($evaluation->overall_score, 2) }}</td>
                <td>Official Rating: Grade {{ $evaluation->performance_grade }}</td>
            </tr>
        </tfoot>
    </table>

    <!-- Comments Section -->
    <div class="comments-section">
        <div class="comment-box">
            <div class="comment-title">Department Head (Evaluator) Assessment & Observations</div>
            <div class="comment-text">{{ $evaluation->hod_comments ? $evaluation->hod_comments : 'No additional comments provided by evaluator.' }}</div>
        </div>

        @if(!empty($evaluation->hr_comments))
            <div class="comment-box" style="background-color: #f8fafc; border-left: 3px solid #3b82f6;">
                <div class="comment-title" style="color: #1e40af;">Human Resources Department Review & Final Sign-Off Remarks</div>
                <div class="comment-text">{{ $evaluation->hr_comments }}</div>
            </div>
        @endif
    </div>

    <!-- Sign-Off Blocks -->
    <table class="signature-table">
        <tr>
            <td>
                <div class="sig-line">
                    {{ $evaluation->evaluator->name ?? 'Department Head Signature' }}
                </div>
                <div class="sig-meta">Evaluator / Department Head</div>
                <div class="sig-meta">Date: {{ \Carbon\Carbon::parse($evaluation->evaluation_date)->format('d M Y') }}</div>
            </td>
            <td>
                <div class="sig-line">
                    {{ $evaluation->hrReviewer->name ?? 'HR Manager Signature' }}
                </div>
                <div class="sig-meta">Human Resources Confirmation</div>
                <div class="sig-meta">Date: {{ $evaluation->hr_actioned_at ? \Carbon\Carbon::parse($evaluation->hr_actioned_at)->format('d M Y') : 'Pending Final Sign-Off' }}</div>
            </td>
            <td>
                <div class="sig-line">
                    {{ $employee->full_name }}
                </div>
                <div class="sig-meta">Employee Acknowledgment</div>
                <div class="sig-meta">Date: _______________</div>
            </td>
        </tr>
    </table>

    <div class="footer-note">
        This document contains sensitive personal performance appraisal data protected under company employment policies. Unauthorized duplication or disclosure is strictly prohibited.
    </div>
</div>
</body>
</html>
