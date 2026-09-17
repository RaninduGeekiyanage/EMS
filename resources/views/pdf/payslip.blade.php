<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>
    <title>Employee Payslip</title>
    <style>
        @page {
            margin: 25px 30px 25px 30px;
            size: a4 portrait;
        }
        body {
            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
            font-size: 11px;
            color: #1e293b;
            line-height: 1.4;
            margin: 0;
            padding: 0;
        }
        .page-break {
            page-break-after: always;
        }
        .payslip-container {
            border: 1px solid #cbd5e1;
            border-radius: 6px;
            padding: 20px;
            margin-bottom: 20px;
            background-color: #ffffff;
        }
        table {
            width: 100%;
            border-collapse: collapse;
        }
        .header-table {
            margin-bottom: 15px;
            border-bottom: 2px solid #0f172a;
            padding-bottom: 10px;
        }
        .header-logo {
            max-height: 55px;
            max-width: 180px;
        }
        .company-title {
            font-size: 18px;
            font-weight: bold;
            color: #0f172a;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin: 0 0 4px 0;
        }
        .company-subtitle {
            font-size: 9px;
            color: #475569;
            margin: 1px 0;
        }
        .payslip-heading {
            text-align: right;
            vertical-align: top;
        }
        .payslip-badge {
            display: inline-block;
            background-color: #0f172a;
            color: #ffffff;
            font-size: 13px;
            font-weight: bold;
            padding: 6px 14px;
            border-radius: 4px;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        .period-label {
            font-size: 12px;
            font-weight: bold;
            color: #2563eb;
            margin-top: 5px;
        }

        /* Employee Info Grid */
        .info-table {
            margin-bottom: 15px;
            background-color: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 4px;
        }
        .info-table td {
            padding: 5px 10px;
            font-size: 10px;
        }
        .info-label {
            color: #64748b;
            font-weight: 600;
            width: 18%;
        }
        .info-value {
            color: #0f172a;
            font-weight: bold;
            width: 32%;
        }

        /* Financial Breakdown */
        .breakdown-table {
            margin-bottom: 15px;
            border: 1px solid #cbd5e1;
        }
        .breakdown-table th {
            background-color: #0f172a;
            color: #ffffff;
            padding: 7px 10px;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .breakdown-table td {
            padding: 6px 10px;
            border-bottom: 1px solid #f1f5f9;
        }
        .column-divider {
            border-right: 1px solid #cbd5e1;
        }
        .subtotal-row td {
            background-color: #f1f5f9;
            font-weight: bold;
            border-top: 1px solid #cbd5e1;
            border-bottom: 1px solid #cbd5e1;
        }
        .amount-col {
            text-align: right;
            font-family: 'Courier New', Courier, monospace;
            font-size: 11px;
        }

        /* Net Pay Banner */
        .net-pay-banner {
            background-color: #eff6ff;
            border: 2px solid #2563eb;
            border-radius: 6px;
            padding: 10px 16px;
            margin-bottom: 15px;
        }
        .net-pay-title {
            font-size: 12px;
            font-weight: bold;
            color: #1e3a8a;
            text-transform: uppercase;
        }
        .net-pay-amount {
            font-size: 20px;
            font-weight: bold;
            color: #1d4ed8;
            font-family: 'Courier New', Courier, monospace;
            text-align: right;
        }

        /* Transparency Box */
        .transparency-box {
            background-color: #f8fafc;
            border: 1px dashed #94a3b8;
            border-radius: 4px;
            padding: 8px 12px;
            margin-bottom: 20px;
        }
        .transparency-title {
            font-size: 9px;
            font-weight: bold;
            color: #475569;
            text-transform: uppercase;
            margin-bottom: 4px;
        }
        .statutory-item {
            font-size: 10px;
            color: #334155;
        }

        /* Signatures */
        .signature-table {
            margin-top: 25px;
            padding-top: 10px;
        }
        .signature-line {
            border-top: 1px solid #94a3b8;
            padding-top: 4px;
            text-align: center;
            font-size: 9px;
            color: #475569;
            width: 28%;
        }

        .footer-note {
            margin-top: 15px;
            text-align: center;
            font-size: 8px;
            color: #94a3b8;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
    </style>
</head>
<body>

@php
    $items = isset($payslips) ? $payslips : [$payslip];
    $totalCount = count($items);
@endphp

@foreach($items as $index => $data)
<div class="payslip-container">
    <!-- Header -->
    <table class="header-table">
        <tr>
            <td style="width: 60%; vertical-align: top;">
                @if(!empty($data['company']['logo_url']))
                    <img src="{{ $data['company']['logo_url'] }}" alt="Logo" class="header-logo"><br>
                @endif
                <div class="company-title">{{ $data['company']['name'] ?? 'CEYLON MANUFACTURING PLC' }}</div>
                @if(!empty($data['company']['br_number']))
                    <div class="company-subtitle">Company Reg No: {{ $data['company']['br_number'] }} &nbsp;|&nbsp; EPF Reg No: {{ $data['company']['epf_number'] ?? 'N/A' }}</div>
                @endif
                @if(!empty($data['company']['address']))
                    <div class="company-subtitle">{{ $data['company']['address'] }}</div>
                @endif
                @if(!empty($data['company']['phone']) || !empty($data['company']['email']))
                    <div class="company-subtitle">Tel: {{ $data['company']['phone'] ?? 'N/A' }} &nbsp;|&nbsp; Email: {{ $data['company']['email'] ?? 'N/A' }}</div>
                @endif
            </td>
            <td class="payslip-heading" style="width: 40%;">
                <div class="payslip-badge">PAYSLIP</div>
                <div class="period-label">PAY PERIOD: {{ strtoupper($data['run']['period_label'] ?? '') }}</div>
                <div style="font-size: 9px; color: #64748b; margin-top: 4px;">
                    Date Generated: {{ date('d M Y') }}<br>
                    Status: <strong style="color: #10b981;">{{ strtoupper($data['run']['status'] ?? 'APPROVED') }}</strong>
                </div>
            </td>
        </tr>
    </table>

    <!-- Employee Details Block -->
    <table class="info-table">
        <tr>
            <td class="info-label">Employee No:</td>
            <td class="info-value">{{ $data['employee']['emp_no'] ?? 'N/A' }}</td>
            <td class="info-label">NIC Number:</td>
            <td class="info-value">{{ $data['employee']['nic'] ?? 'N/A' }}</td>
        </tr>
        <tr>
            <td class="info-label">Employee Name:</td>
            <td class="info-value">{{ $data['employee']['full_name'] ?? 'N/A' }}</td>
            <td class="info-label">EPF Number:</td>
            <td class="info-value">{{ $data['employee']['epf_no'] ?? 'N/A' }}</td>
        </tr>
        <tr>
            <td class="info-label">Department:</td>
            <td class="info-value">{{ $data['employee']['department'] ?? 'Operations' }}</td>
            <td class="info-label">Designation:</td>
            <td class="info-value">{{ $data['employee']['designation'] ?? 'Staff' }}</td>
        </tr>
        <tr>
            <td class="info-label">Payment Mode:</td>
            <td class="info-value">{{ strtoupper($data['employee']['payment_mode'] ?? 'MONTHLY') }}</td>
            <td class="info-label">Bank Account:</td>
            <td class="info-value">
                {{ $data['employee']['bank_name'] ?? 'Bank Remittance' }} - {{ $data['employee']['masked_account_no'] ?? 'Direct Transfer' }}
            </td>
        </tr>
        <tr>
            <td class="info-label">Worked Days:</td>
            <td class="info-value">{{ number_format((float)($data['employee']['worked_days'] ?? 0), 1) }}</td>
            <td class="info-label">No-Pay Days:</td>
            <td class="info-value">{{ number_format((float)($data['employee']['no_pay_days'] ?? 0), 1) }}</td>
        </tr>
        @if((float)($data['employee']['ot_hours'] ?? 0) > 0 || (float)($data['employee']['double_ot_hours'] ?? 0) > 0)
        <tr>
            <td class="info-label">Standard OT:</td>
            <td class="info-value">{{ number_format((float)($data['employee']['ot_hours'] ?? 0), 2) }} Hours</td>
            <td class="info-label">Double OT:</td>
            <td class="info-value">{{ number_format((float)($data['employee']['double_ot_hours'] ?? 0), 2) }} Hours</td>
        </tr>
        @endif
    </table>

    <!-- Two-column Earnings vs Deductions Table -->
    <table class="breakdown-table">
        <thead>
            <tr>
                <th style="width: 35%; text-align: left;" class="column-divider">Earnings</th>
                <th style="width: 15%; text-align: right;" class="column-divider amount-col">Amount (LKR)</th>
                <th style="width: 35%; text-align: left;">Deductions</th>
                <th style="width: 15%; text-align: right;" class="amount-col">Amount (LKR)</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td class="column-divider">Basic Salary</td>
                <td class="column-divider amount-col">{{ number_format((float)($data['earnings']['basic_salary'] ?? 0), 2) }}</td>
                <td>No-Pay Deduction</td>
                <td class="amount-col">{{ number_format((float)($data['deductions']['no_pay_deduction'] ?? 0), 2) }}</td>
            </tr>
            <tr>
                <td class="column-divider">Overtime (OT) Pay</td>
                <td class="column-divider amount-col">{{ number_format((float)($data['earnings']['ot_pay'] ?? 0), 2) }}</td>
                <td>EPF Employee (8%)</td>
                <td class="amount-col">{{ number_format((float)($data['deductions']['epf_employee'] ?? 0), 2) }}</td>
            </tr>
            <tr>
                <td class="column-divider">Fixed & Budgetary Allowances</td>
                <td class="column-divider amount-col">{{ number_format((float)($data['earnings']['allowances'] ?? 0), 2) }}</td>
                <td>APIT (Income Tax)</td>
                <td class="amount-col">{{ number_format((float)($data['deductions']['apit_tax'] ?? 0), 2) }}</td>
            </tr>
            <tr>
                <td class="column-divider">Other Incentives / Additions</td>
                <td class="column-divider amount-col">{{ number_format((float)($data['earnings']['incentives'] ?? 0), 2) }}</td>
                <td>Other Deductions / Advances</td>
                <td class="amount-col">{{ number_format((float)($data['deductions']['other_deductions'] ?? 0), 2) }}</td>
            </tr>
            <!-- Subtotals -->
            <tr class="subtotal-row">
                <td class="column-divider">TOTAL GROSS EARNINGS</td>
                <td class="column-divider amount-col" style="color: #0f172a;">{{ number_format((float)($data['earnings']['gross_pay'] ?? 0), 2) }}</td>
                <td>TOTAL DEDUCTIONS</td>
                <td class="amount-col" style="color: #dc2626;">{{ number_format((float)($data['deductions']['total_deductions'] ?? 0), 2) }}</td>
            </tr>
        </tbody>
    </table>

    <!-- Net Pay Callout Banner -->
    <table class="net-pay-banner">
        <tr>
            <td style="width: 50%; vertical-align: middle;">
                <div class="net-pay-title">Net Pay Remittance</div>
                <div style="font-size: 9px; color: #475569;">Transferred directly to registered bank account</div>
            </td>
            <td style="width: 50%; text-align: right; vertical-align: middle;">
                <div class="net-pay-amount">LKR {{ number_format((float)($data['net_pay'] ?? 0), 2) }}</div>
            </td>
        </tr>
    </table>

    <!-- Employer Statutory Contributions Transparency Block -->
    <div class="transparency-box">
        <div class="transparency-title">Employer Statutory Contributions (Not deducted from salary)</div>
        <table style="width: 100%;">
            <tr>
                <td class="statutory-item" style="width: 33%;">
                    Employer EPF (12%): <strong>LKR {{ number_format((float)($data['statutory']['epf_employer'] ?? 0), 2) }}</strong>
                </td>
                <td class="statutory-item" style="width: 33%;">
                    Employer ETF (3%): <strong>LKR {{ number_format((float)($data['statutory']['etf_employer'] ?? 0), 2) }}</strong>
                </td>
                <td class="statutory-item" style="width: 34%; text-align: right;">
                    Total Employer Cost: <strong>LKR {{ number_format((float)(($data['statutory']['epf_employer'] ?? 0) + ($data['statutory']['etf_employer'] ?? 0)), 2) }}</strong>
                </td>
            </tr>
        </table>
    </div>

    <!-- Signatures -->
    <table class="signature-table">
        <tr>
            <td class="signature-line">
                Prepared By (HR Payroll)
            </td>
            <td style="width: 8%;"></td>
            <td class="signature-line">
                Approved By (Management)
            </td>
            <td style="width: 8%;"></td>
            <td class="signature-line">
                Employee Acknowledgement
            </td>
        </tr>
    </table>

    <div class="footer-note">
        This is a system-generated document and does not require a physical seal. Confidential payroll record.
    </div>
</div>

@if($index < $totalCount - 1)
    <div class="page-break"></div>
@endif

@endforeach

</body>
</html>
