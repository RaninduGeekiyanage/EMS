<!DOCTYPE html>
<html>
<head>
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>
    <title>Attendance Biometric Raw Logs & Audit</title>
    <style>
        body {
            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
            font-size: 8px;
            color: #1e293b;
            margin: 0;
            padding: 12px;
        }
        .header {
            border-bottom: 2px solid #4f46e5;
            padding-bottom: 8px;
            margin-bottom: 10px;
        }
        .title {
            font-size: 14px;
            font-weight: bold;
            color: #0f172a;
        }
        .meta {
            font-size: 8px;
            color: #64748b;
            margin-top: 4px;
        }
        .meta span {
            margin-right: 12px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 6px;
        }
        th {
            background-color: #f1f5f9;
            color: #334155;
            font-weight: bold;
            font-size: 7.5px;
            text-transform: uppercase;
            padding: 4px 5px;
            border: 1px solid #cbd5e1;
            text-align: left;
        }
        td {
            padding: 3.5px 5px;
            border: 1px solid #e2e8f0;
            font-size: 7.5px;
            color: #334155;
        }
        tr:nth-child(even) {
            background-color: #f8fafc;
        }
        .badge {
            display: inline-block;
            padding: 1px 4px;
            border-radius: 3px;
            font-size: 7px;
            font-weight: bold;
        }
        .badge-processed {
            background-color: #dcfce7;
            color: #15803d;
        }
        .badge-unprocessed {
            background-color: #fef3c7;
            color: #b45309;
        }
        .badge-in {
            background-color: #e0e7ff;
            color: #4338ca;
        }
        .badge-out {
            background-color: #fce7f3;
            color: #be185d;
        }
        .badge-auto {
            background-color: #f1f5f9;
            color: #475569;
        }
        .footer {
            margin-top: 12px;
            font-size: 7.5px;
            color: #94a3b8;
            text-align: right;
            border-top: 1px solid #e2e8f0;
            padding-top: 5px;
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="title">Enterprise Management System — Biometric Raw Logs & Engine Audit Report</div>
        <div class="meta">
            <span><strong>Generated:</strong> {{ $generatedAt }}</span>
            <span><strong>Total Records:</strong> {{ $totalCount }}</span>
            @if(!empty($filters['date_from']) || !empty($filters['date_to']))
                <span><strong>Date Range:</strong> {{ $filters['date_from'] ?? 'Earliest' }} to {{ $filters['date_to'] ?? 'Latest' }}</span>
            @endif
            @if(!empty($filters['emp_no']))
                <span><strong>Emp No:</strong> {{ $filters['emp_no'] }}</span>
            @endif
            @if(!empty($filters['name']))
                <span><strong>Name Filter:</strong> {{ $filters['name'] }}</span>
            @endif
            @if(!empty($filters['status']) && $filters['status'] !== 'all')
                <span><strong>Status:</strong> {{ ucfirst($filters['status']) }}</span>
            @endif
        </div>
    </div>

    <table>
        <thead>
            <tr>
                <th style="width: 25px;">#</th>
                <th style="width: 60px;">Emp No</th>
                <th style="width: 65px;">Bio ID</th>
                <th>Employee Name</th>
                <th style="width: 90px;">Department</th>
                <th style="width: 65px;">Date</th>
                <th style="width: 55px;">Time</th>
                <th style="width: 45px;">Type</th>
                <th style="width: 75px;">Device / Source</th>
                <th style="width: 65px;">Process State</th>
                <th>Engine Resolution</th>
            </tr>
        </thead>
        <tbody>
            @forelse($logs as $index => $log)
                @php
                    $dt = \Carbon\Carbon::parse($log->punch_datetime);
                    $comp = $log->comparison ?? [];
                @endphp
                <tr>
                    <td>{{ $index + 1 }}</td>
                    <td><strong>{{ $log->employee?->emp_no ?? '—' }}</strong></td>
                    <td>{{ $log->raw_biometric_id ?? '—' }}</td>
                    <td>{{ $log->employee?->full_name ?? 'Unlinked Employee' }}</td>
                    <td>{{ $log->employee?->department?->name ?? '—' }}</td>
                    <td>{{ $dt->toDateString() }}</td>
                    <td>{{ $dt->format('H:i:s') }}</td>
                    <td>
                        <span class="badge badge-{{ strtolower($log->punch_type ?? 'auto') }}">
                            {{ strtoupper($log->punch_type ?? 'AUTO') }}
                        </span>
                    </td>
                    <td>
                        {{ $log->device_id ? $log->device_id . ' (' . ucfirst($log->source) . ')' : ucfirst($log->source) }}
                    </td>
                    <td>
                        @if($log->is_processed)
                            <span class="badge badge-processed">Processed</span>
                        @else
                            <span class="badge badge-unprocessed">Unprocessed</span>
                        @endif
                    </td>
                    <td>
                        <strong>{{ $comp['label'] ?? '—' }}</strong>
                        @if(!empty($comp['description']))
                            <div style="font-size: 6.5px; color: #64748b;">{{ $comp['description'] }}</div>
                        @endif
                    </td>
                </tr>
            @empty
                <tr>
                    <td colspan="11" style="text-align: center; padding: 15px; color: #94a3b8;">
                        No biometric logs found matching the filter criteria.
                    </td>
                </tr>
            @endforelse
        </tbody>
    </table>

    <div class="footer">
        Confidential — Internal Company Document Generated by EMS Time & Attendance Subsystem
    </div>
</body>
</html>
