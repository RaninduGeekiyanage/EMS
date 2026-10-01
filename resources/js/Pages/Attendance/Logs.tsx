import React, { useState, useMemo } from 'react';
import { Head, router, Link } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import {
    Fingerprint,
    Search,
    RotateCcw,
    Download,
    FileSpreadsheet,
    FileText,
    Calendar,
    ChevronLeft,
    ChevronRight,
    ArrowUpRight,
    CheckCircle2,
    Clock,
    AlertTriangle,
    Filter,
    Building2,
    User,
    Hash,
    Sparkles,
    ShieldAlert,
    HelpCircle,
    Info,
    ExternalLink,
} from 'lucide-react';

interface Employee {
    id: string;
    emp_no: string;
    full_name: string;
    calling_name?: string | null;
    biometric_device_id?: string | null;
    department?: {
        id: string;
        name: string;
    } | null;
}

interface ImportBatch {
    id: string;
    filename: string;
    adapter_type?: string;
    created_at: string;
}

interface ComparisonResolution {
    type: 'matched_check_in' | 'matched_check_out' | 'intermediate_debounced' | 'unlinked_discrepancy' | 'processed_no_ledger' | 'pending_evaluation';
    label: string;
    badge_color: 'emerald' | 'blue' | 'slate' | 'amber' | 'indigo' | 'rose';
    shift_name?: string | null;
    daily_status?: string;
    description: string;
    date: string;
    emp_no?: string;
}

interface AttendanceLogItem {
    id: string;
    tenant_id: string;
    employee_id: string;
    punch_datetime: string;
    punch_type: string;
    device_id?: string | null;
    raw_biometric_id?: string | null;
    import_id?: string | null;
    source: string;
    is_processed: boolean;
    processed_at?: string | null;
    created_at: string;
    employee?: Employee | null;
    import?: ImportBatch | null;
    comparison?: ComparisonResolution | null;
}

interface PaginationLink {
    url: string | null;
    label: string;
    active: boolean;
}

interface PaginatedLogs {
    data: AttendanceLogItem[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number | null;
    to: number | null;
    links: PaginationLink[];
}

interface Department {
    id: string;
    name: string;
}

interface StatsSummary {
    total_count: number;
    processed_count: number;
    unprocessed_count: number;
    unique_employees: number;
}

interface FilterProps {
    date_from: string;
    date_to: string;
    name: string;
    emp_no: string;
    raw_biometric_id: string;
    department_id: string;
    status: string;
    punch_type: string;
    source: string;
}

interface Props {
    records: PaginatedLogs | null;
    stats: StatsSummary | null;
    executed: boolean;
    departments: Department[];
    filters: FilterProps;
}

export default function AttendanceLogsIndex({ records, stats, executed, departments, filters }: Props) {
    const [dateFrom, setDateFrom] = useState(filters.date_from || '');
    const [dateTo, setDateTo] = useState(filters.date_to || '');
    const [nameQuery, setNameQuery] = useState(filters.name || '');
    const [empNoQuery, setEmpNoQuery] = useState(filters.emp_no || '');
    const [rawBioIdQuery, setRawBioIdQuery] = useState(filters.raw_biometric_id || '');
    const [deptId, setDeptId] = useState(filters.department_id || '');
    const [statusFilter, setStatusFilter] = useState(filters.status || 'all');
    const [punchTypeFilter, setPunchTypeFilter] = useState(filters.punch_type || 'all');
    const [sourceFilter, setSourceFilter] = useState(filters.source || 'all');
    const [isLoading, setIsLoading] = useState(false);
    const [sortAsc, setSortAsc] = useState<boolean>(true); // Default to Date & Time Ascending

    // Helper to format date string YYYY-MM-DD
    const formatDate = (date: Date): string => {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    };

    // Client-side sort ascending by default for Date & Time
    const sortedLogs = useMemo(() => {
        if (!records?.data) return [];
        return [...records.data].sort((a, b) => {
            const timeA = new Date(a.punch_datetime).getTime();
            const timeB = new Date(b.punch_datetime).getTime();
            return sortAsc ? timeA - timeB : timeB - timeA;
        });
    }, [records?.data, sortAsc]);

    // Execute Search with specific or current filters
    const executeSearch = (overrideParams: Partial<FilterProps> = {}) => {
        setIsLoading(true);
        const params: Record<string, any> = {
            executed: 1,
            date_from: overrideParams.date_from !== undefined ? overrideParams.date_from : (dateFrom || undefined),
            date_to: overrideParams.date_to !== undefined ? overrideParams.date_to : (dateTo || undefined),
            name: overrideParams.name !== undefined ? overrideParams.name : (nameQuery || undefined),
            emp_no: overrideParams.emp_no !== undefined ? overrideParams.emp_no : (empNoQuery || undefined),
            raw_biometric_id: overrideParams.raw_biometric_id !== undefined ? overrideParams.raw_biometric_id : (rawBioIdQuery || undefined),
            department_id: overrideParams.department_id !== undefined ? overrideParams.department_id : (deptId || undefined),
            status: overrideParams.status !== undefined ? overrideParams.status : (statusFilter !== 'all' ? statusFilter : undefined),
            punch_type: overrideParams.punch_type !== undefined ? overrideParams.punch_type : (punchTypeFilter !== 'all' ? punchTypeFilter : undefined),
            source: overrideParams.source !== undefined ? overrideParams.source : (sourceFilter !== 'all' ? sourceFilter : undefined),
        };

        router.get('/attendance/logs', params, {
            preserveState: true,
            preserveScroll: true,
            onFinish: () => setIsLoading(false),
        });
    };

    // Quick Date Range Handlers
    const handleQuickRange = (type: 'this_month' | 'last_month' | 'today') => {
        const now = new Date();
        let from = '';
        let to = '';

        if (type === 'this_month') {
            const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
            const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            from = formatDate(firstDay);
            to = formatDate(lastDay);
        } else if (type === 'last_month') {
            const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
            from = formatDate(firstDay);
            to = formatDate(lastDay);
        } else if (type === 'today') {
            const todayStr = formatDate(now);
            from = todayStr;
            to = todayStr;
        }

        setDateFrom(from);
        setDateTo(to);
        executeSearch({ date_from: from, date_to: to });
    };

    const handleReset = () => {
        setDateFrom('');
        setDateTo('');
        setNameQuery('');
        setEmpNoQuery('');
        setRawBioIdQuery('');
        setDeptId('');
        setStatusFilter('all');
        setPunchTypeFilter('all');
        setSourceFilter('all');

        router.get('/attendance/logs', {}, {
            preserveState: false,
        });
    };

    // Construct export URL with current query parameters
    const getExportUrl = (format: 'excel' | 'pdf') => {
        const params = new URLSearchParams();
        params.append('executed', '1');
        if (dateFrom) params.append('date_from', dateFrom);
        if (dateTo) params.append('date_to', dateTo);
        if (nameQuery) params.append('name', nameQuery);
        if (empNoQuery) params.append('emp_no', empNoQuery);
        if (rawBioIdQuery) params.append('raw_biometric_id', rawBioIdQuery);
        if (deptId) params.append('department_id', deptId);
        if (statusFilter !== 'all') params.append('status', statusFilter);
        if (punchTypeFilter !== 'all') params.append('punch_type', punchTypeFilter);
        if (sourceFilter !== 'all') params.append('source', sourceFilter);

        return `/attendance/logs/export/${format}?${params.toString()}`;
    };

    const renderComparisonBadge = (comp?: ComparisonResolution | null) => {
        if (!comp) {
            return (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 leading-tight">
                    Not Evaluated
                </span>
            );
        }

        const colorMap: Record<string, { bg: string; text: string; dot: string }> = {
            emerald: {
                bg: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60',
                text: 'text-emerald-700 dark:text-emerald-300',
                dot: 'bg-emerald-500',
            },
            blue: {
                bg: 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800/60',
                text: 'text-blue-700 dark:text-blue-300',
                dot: 'bg-blue-500',
            },
            slate: {
                bg: 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700',
                text: 'text-slate-700 dark:text-slate-300',
                dot: 'bg-slate-400',
            },
            amber: {
                bg: 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/60',
                text: 'text-amber-800 dark:text-amber-300',
                dot: 'bg-amber-500',
            },
            indigo: {
                bg: 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800/60',
                text: 'text-indigo-700 dark:text-indigo-300',
                dot: 'bg-indigo-500',
            },
            rose: {
                bg: 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/60',
                text: 'text-rose-700 dark:text-rose-300',
                dot: 'bg-rose-500',
            },
        };

        const style = colorMap[comp.badge_color] || colorMap.slate;

        // Suppress verbose debounce / intermediate punch remarks as requested
        const isDebounceRemark =
            comp.type === 'intermediate_debounced' ||
            (comp.description && (
                comp.description.toLowerCase().includes('debounce') ||
                comp.description.toLowerCase().includes('intermediate punch') ||
                comp.description.toLowerCase().includes('suppressed by debounce')
            ));

        const cleanDescription = isDebounceRemark ? null : comp.description;

        return (
            <div className="flex flex-col leading-tight max-w-[280px]">
                {/* Line 1: Badge + Ledger Link */}
                <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-semibold ${style.bg} ${style.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                        <span>{comp.label}</span>
                    </span>
                    {comp.emp_no && (
                        <Link
                            href={`/attendance/daily?date=${comp.date}&emp_no=${encodeURIComponent(comp.emp_no)}`}
                            target="_blank"
                            className="inline-flex items-center gap-0.5 text-[10px] font-medium text-indigo-600 dark:text-indigo-400 hover:underline hover:text-indigo-700 dark:hover:text-indigo-300"
                            title="View Daily Ledger entry"
                        >
                            <span>Ledger</span>
                            <ArrowUpRight className="w-2.5 h-2.5" />
                        </Link>
                    )}
                </div>

                {/* Line 2: Optional concise description (strictly 1 line truncate, never wraps) */}
                {cleanDescription && (
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5" title={cleanDescription}>
                        {cleanDescription}
                    </div>
                )}
            </div>
        );
    };

    return (
        <AuthenticatedLayout fullHeight>
            <Head title="Attendance Logs - Raw Biometric & Audit" />

            <div className="w-full flex-1 flex flex-col min-h-0 space-y-2.5 xl:overflow-hidden">
                {/* Header & Title Section */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 shrink-0 pb-1">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/70 rounded-lg text-indigo-600 dark:text-indigo-400 shrink-0">
                            <Fingerprint className="w-4 h-4" />
                        </div>
                        <div>
                            <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2 leading-tight">
                                Attendance Logs
                                <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                                    Raw Telemetry Audit
                                </span>
                            </h1>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                                Inspect raw biometric punches, troubleshoot missing/delayed syncs, and audit engine resolution.
                            </p>
                        </div>
                    </div>

                    {/* Export Actions (Enabled when data has been queried) */}
                    <div className="flex items-center gap-2 shrink-0">
                        {executed && records && records.total > 0 && (
                            <>
                                <a
                                    href={getExportUrl('excel')}
                                    download
                                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/60 shadow-xs transition-colors"
                                    title="Export filtered records to Microsoft Excel / CSV"
                                >
                                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                    <span>Export Excel</span>
                                </a>
                                <a
                                    href={getExportUrl('pdf')}
                                    download
                                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/60 shadow-xs transition-colors"
                                    title="Download styled PDF audit report"
                                >
                                    <FileText className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                                    <span>Export PDF</span>
                                </a>
                            </>
                        )}
                        <Link
                            href="/attendance/daily"
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-indigo-600 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/50 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors"
                        >
                            <span>Daily Ledger</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                        </Link>
                    </div>
                </div>

                {/* KPI Metrics Summary (Visible after search execution) - Compact Low Line-Height Layout */}
                {executed && stats && (
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 shrink-0">
                        {/* Total Raw Logs */}
                        <div className="bg-white dark:bg-slate-900 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between gap-2.5">
                            <div className="min-w-0">
                                <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block leading-tight truncate">
                                    Total Raw Logs
                                </span>
                                <div className="text-lg font-bold text-slate-900 dark:text-white leading-tight font-mono">
                                    {stats.total_count.toLocaleString()}
                                </div>
                                <span className="text-[10px] text-slate-400 dark:text-slate-500 block leading-tight truncate">
                                    In selected query filters
                                </span>
                            </div>
                            <div className="p-1.5 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 rounded-md shrink-0">
                                <Fingerprint className="w-3.5 h-3.5" />
                            </div>
                        </div>

                        {/* Processed */}
                        <div className="bg-white dark:bg-slate-900 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between gap-2.5">
                            <div className="min-w-0">
                                <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block leading-tight truncate">
                                    Processed
                                </span>
                                <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400 leading-tight font-mono">
                                    {stats.processed_count.toLocaleString()}
                                </div>
                                <span className="text-[10px] text-slate-400 dark:text-slate-500 block leading-tight truncate">
                                    Reconciled by daily engine
                                </span>
                            </div>
                            <div className="p-1.5 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 rounded-md shrink-0">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                            </div>
                        </div>

                        {/* Unprocessed */}
                        <div className="bg-white dark:bg-slate-900 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between gap-2.5">
                            <div className="min-w-0">
                                <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider block leading-tight truncate">
                                    Unprocessed
                                </span>
                                <div className="text-lg font-bold text-amber-600 dark:text-amber-400 leading-tight font-mono">
                                    {stats.unprocessed_count.toLocaleString()}
                                </div>
                                <span className="text-[10px] text-slate-400 dark:text-slate-500 block leading-tight truncate">
                                    Pending engine calculation
                                </span>
                            </div>
                            <div className="p-1.5 bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 rounded-md shrink-0">
                                <AlertTriangle className="w-3.5 h-3.5" />
                            </div>
                        </div>

                        {/* Unique Employees */}
                        <div className="bg-white dark:bg-slate-900 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-between gap-2.5">
                            <div className="min-w-0">
                                <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block leading-tight truncate">
                                    Unique Employees
                                </span>
                                <div className="text-lg font-bold text-slate-900 dark:text-white leading-tight font-mono">
                                    {stats.unique_employees.toLocaleString()}
                                </div>
                                <span className="text-[10px] text-slate-400 dark:text-slate-500 block leading-tight truncate">
                                    Impacted staff members
                                </span>
                            </div>
                            <div className="p-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-md shrink-0">
                                <User className="w-3.5 h-3.5" />
                            </div>
                        </div>
                    </div>
                )}

                {/* Filter & Search Control Panel */}
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs p-3 space-y-2.5 shrink-0">
                    {/* Top Row: Quick Presets */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800/80">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                            <Filter className="w-3.5 h-3.5 text-indigo-500" />
                            <span>Filter Biometric Logs:</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-slate-400 uppercase font-semibold mr-0.5">Quick Presets:</span>
                            <button
                                type="button"
                                onClick={() => handleQuickRange('today')}
                                className="px-2 py-0.5 text-xs font-medium rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-950/50 dark:hover:text-indigo-400 transition-colors"
                            >
                                Today
                            </button>
                            <button
                                type="button"
                                onClick={() => handleQuickRange('this_month')}
                                className="px-2 py-0.5 text-xs font-medium rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-950/50 dark:hover:text-indigo-400 transition-colors"
                            >
                                This Month
                            </button>
                            <button
                                type="button"
                                onClick={() => handleQuickRange('last_month')}
                                className="px-2 py-0.5 text-xs font-medium rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-950/50 dark:hover:text-indigo-400 transition-colors"
                            >
                                Last Month
                            </button>
                        </div>
                    </div>

                    {/* Filter Inputs Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5">
                        {/* Date From */}
                        <div>
                            <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-0.5">
                                Date From
                            </label>
                            <input
                                type="date"
                                value={dateFrom}
                                onChange={(e) => setDateFrom(e.target.value)}
                                className="w-full text-xs rounded-lg border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs focus:border-indigo-500 focus:ring-indigo-500 px-2 py-1"
                            />
                        </div>

                        {/* Date To */}
                        <div>
                            <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-0.5">
                                Date To
                            </label>
                            <input
                                type="date"
                                value={dateTo}
                                onChange={(e) => setDateTo(e.target.value)}
                                className="w-full text-xs rounded-lg border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs focus:border-indigo-500 focus:ring-indigo-500 px-2 py-1"
                            />
                        </div>

                        {/* Exact Emp No */}
                        <div>
                            <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-0.5">
                                Exact Emp No
                            </label>
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="e.g. EMP-001"
                                    value={empNoQuery}
                                    onChange={(e) => setEmpNoQuery(e.target.value)}
                                    className="w-full text-xs rounded-lg border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs focus:border-indigo-500 focus:ring-indigo-500 pl-6 pr-2 py-1 font-mono"
                                />
                                <Hash className="w-3 h-3 text-slate-400 absolute left-2 top-2 pointer-events-none" />
                            </div>
                        </div>

                        {/* Employee Name */}
                        <div>
                            <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-0.5">
                                Employee Name
                            </label>
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="Search name..."
                                    value={nameQuery}
                                    onChange={(e) => setNameQuery(e.target.value)}
                                    className="w-full text-xs rounded-lg border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs focus:border-indigo-500 focus:ring-indigo-500 pl-6 pr-2 py-1"
                                />
                                <User className="w-3 h-3 text-slate-400 absolute left-2 top-2 pointer-events-none" />
                            </div>
                        </div>

                        {/* Department */}
                        <div>
                            <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-0.5">
                                Department
                            </label>
                            <select
                                value={deptId}
                                onChange={(e) => setDeptId(e.target.value)}
                                className="w-full text-xs rounded-lg border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs focus:border-indigo-500 focus:ring-indigo-500 px-2 py-1"
                            >
                                <option value="">All Departments</option>
                                {departments.map((dept) => (
                                    <option key={dept.id} value={dept.id}>
                                        {dept.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Process Status Filter */}
                        <div>
                            <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-0.5">
                                Process Status
                            </label>
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="w-full text-xs rounded-lg border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs focus:border-indigo-500 focus:ring-indigo-500 px-2 py-1"
                            >
                                <option value="all">All Statuses</option>
                                <option value="processed">Processed Only</option>
                                <option value="unprocessed">Unprocessed Only</option>
                            </select>
                        </div>
                    </div>

                    {/* Secondary Filters & Search Actions */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-1.5 border-t border-slate-100 dark:border-slate-800/80">
                        <div className="flex flex-wrap items-center gap-3">
                            {/* Raw Biometric ID Filter */}
                            <div className="flex items-center gap-1.5">
                                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium whitespace-nowrap">Bio ID:</span>
                                <input
                                    type="text"
                                    placeholder="Machine ID..."
                                    value={rawBioIdQuery}
                                    onChange={(e) => setRawBioIdQuery(e.target.value)}
                                    className="text-xs rounded-lg border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs focus:border-indigo-500 focus:ring-indigo-500 px-2 py-0.5 w-24 font-mono"
                                />
                            </div>

                            {/* Punch Type Filter */}
                            <div className="flex items-center gap-1.5">
                                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium whitespace-nowrap">Type:</span>
                                <select
                                    value={punchTypeFilter}
                                    onChange={(e) => setPunchTypeFilter(e.target.value)}
                                    className="text-xs rounded-lg border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs focus:border-indigo-500 focus:ring-indigo-500 px-2 py-0.5"
                                >
                                    <option value="all">All Types</option>
                                    <option value="in">Check-In</option>
                                    <option value="out">Check-Out</option>
                                    <option value="auto">Auto</option>
                                </select>
                            </div>
                        </div>

                        {/* Search & Reset Buttons */}
                        <div className="flex items-center gap-2 self-end sm:self-auto">
                            <button
                                type="button"
                                onClick={handleReset}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                            >
                                <RotateCcw className="w-3 h-3" />
                                <span>Reset</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => executeSearch()}
                                disabled={isLoading}
                                className="inline-flex items-center gap-1 px-3.5 py-1 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-60 rounded-lg shadow-xs transition-colors"
                            >
                                <Search className="w-3 h-3" />
                                <span>{isLoading ? 'Searching...' : 'Search & Filter'}</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* State A: Initial Visit (Not Yet Executed / No Data Loaded) */}
                {!executed && (
                    <div className="flex-1 flex items-center justify-center min-h-[300px] bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 sm:p-10 text-center shadow-xs">
                        <div className="max-w-md mx-auto space-y-3">
                            <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/60 rounded-xl mx-auto flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-inner">
                                <Fingerprint className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                                    Ready to Query Biometric Logs
                                </h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                                    To protect server performance and ensure instant page load, biometric telemetry is loaded on demand. Click a quick preset button above or set your date range and filters, then click <strong>Search & Filter</strong>.
                                </p>
                            </div>
                            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                                <button
                                    type="button"
                                    onClick={() => handleQuickRange('today')}
                                    className="px-3 py-1.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 rounded-lg transition-colors border border-indigo-200 dark:border-indigo-800/50"
                                >
                                    Query Today’s Logs
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleQuickRange('this_month')}
                                    className="px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
                                >
                                    Query This Month
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* State B: Executed Search - Table View (Fixed container with internal data table scroll) */}
                {executed && records && (
                    <div className="flex-1 min-h-[300px] max-h-[calc(100vh-290px)] xl:max-h-none rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden flex flex-col">
                        {/* Table Header Bar */}
                        <div className="px-3.5 py-2 bg-slate-50/70 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 shrink-0">
                            <div className="font-medium text-xs">
                                Showing <span className="font-bold text-slate-900 dark:text-white">{records.from || 0}</span> to <span className="font-bold text-slate-900 dark:text-white">{records.to || 0}</span> of <span className="font-bold text-slate-900 dark:text-white">{records.total}</span> raw biometric records
                            </div>
                            <div className="flex items-center gap-3 text-[11px]">
                                <span className="text-slate-500 dark:text-slate-400">
                                    Sorted: <button type="button" onClick={() => setSortAsc(!sortAsc)} className="font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">{sortAsc ? 'Date & Time (Ascending ↑)' : 'Date & Time (Descending ↓)'}</button>
                                </span>
                                <span className="hidden sm:inline text-slate-400">•</span>
                                <span className="text-slate-400">30 records/page</span>
                            </div>
                        </div>

                        {/* Table Container with Internal Scroll */}
                        <div className="flex-1 min-h-0 overflow-auto">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead className="sticky top-0 z-10 bg-slate-100/95 dark:bg-slate-800/95 backdrop-blur-sm border-b border-slate-200 dark:border-slate-700 shadow-xs">
                                    <tr className="text-slate-600 dark:text-slate-400 uppercase tracking-wider text-[10px] font-bold">
                                        <th scope="col" className="px-3 py-2 w-10 text-center">#</th>
                                        <th scope="col" className="px-3 py-2 min-w-[110px]">Emp No (Bio ID)</th>
                                        <th scope="col" className="px-3 py-2 min-w-[160px]">Employee</th>
                                        <th
                                            scope="col"
                                            onClick={() => setSortAsc(!sortAsc)}
                                            className="px-3 py-2 min-w-[120px] cursor-pointer select-none hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                                            title={`Click to sort ${sortAsc ? 'descending' : 'ascending'}`}
                                        >
                                            <div className="flex items-center gap-1">
                                                <span>Date & Time</span>
                                                <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                                                    {sortAsc ? '↑' : '↓'}
                                                </span>
                                            </div>
                                        </th>
                                        <th scope="col" className="px-3 py-2 min-w-[70px]">Type</th>
                                        <th scope="col" className="px-3 py-2 min-w-[130px]">Source / Device</th>
                                        <th scope="col" className="px-3 py-2 min-w-[110px]">Process Status</th>
                                        <th scope="col" className="px-3 py-2 min-w-[220px]">Comparison Detail & Resolution</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-slate-700 dark:text-slate-300">
                                    {sortedLogs.length === 0 ? (
                                        <tr>
                                            <td colSpan={8} className="py-12 text-center text-slate-400 dark:text-slate-500">
                                                <div className="max-w-xs mx-auto space-y-2">
                                                    <Fingerprint className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
                                                    <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                                                        No biometric records match your query
                                                    </p>
                                                    <p className="text-[11px] text-slate-400">
                                                        Try adjusting the date range or clearing exact employee filter.
                                                    </p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        sortedLogs.map((log, index) => {
                                            const punchDate = new Date(log.punch_datetime);
                                            const dateStr = log.punch_datetime ? log.punch_datetime.split(' ')[0] || log.punch_datetime.split('T')[0] : '';
                                            const timeStr = punchDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                                            const rowIndex = (records.current_page - 1) * records.per_page + index + 1;

                                            return (
                                                <tr
                                                    key={log.id}
                                                    className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                                                >
                                                    {/* Serial # */}
                                                    <td className="px-3 py-1.5 text-center text-slate-400 font-mono text-[11px] leading-tight">
                                                        {rowIndex}
                                                    </td>

                                                    {/* Emp No & Raw Biometric ID (max 2 lines) */}
                                                    <td className="px-3 py-1.5 whitespace-nowrap">
                                                        <div className="flex flex-col leading-tight">
                                                            <span className="font-mono font-semibold text-slate-900 dark:text-white text-xs">
                                                                {log.employee?.emp_no || '—'}
                                                            </span>
                                                            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                                                                Bio: {log.raw_biometric_id || 'N/A'}
                                                            </span>
                                                        </div>
                                                    </td>

                                                    {/* Employee Name & Department (max 2 lines) */}
                                                    <td className="px-3 py-1.5">
                                                        <div className="flex flex-col leading-tight max-w-[180px]">
                                                            <span className="font-medium text-slate-900 dark:text-white truncate text-xs" title={log.employee?.full_name || 'Unlinked Employee'}>
                                                                {log.employee?.full_name || 'Unlinked Employee'}
                                                            </span>
                                                            {log.employee?.department ? (
                                                                <span className="inline-flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400 truncate" title={log.employee.department.name}>
                                                                    <Building2 className="w-2.5 h-2.5 shrink-0" />
                                                                    <span className="truncate">{log.employee.department.name}</span>
                                                                </span>
                                                            ) : (
                                                                <span className="text-[10px] text-slate-400 italic">No dept</span>
                                                            )}
                                                        </div>
                                                    </td>

                                                    {/* Date & Time (max 2 lines) */}
                                                    <td className="px-3 py-1.5 whitespace-nowrap">
                                                        <div className="flex flex-col leading-tight">
                                                            <span className="font-medium text-slate-800 dark:text-slate-200 text-xs">
                                                                {dateStr}
                                                            </span>
                                                            <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400">
                                                                {timeStr}
                                                            </span>
                                                        </div>
                                                    </td>

                                                    {/* Punch Type (1 line badge) */}
                                                    <td className="px-3 py-1.5 whitespace-nowrap">
                                                        <span
                                                            className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                                                log.punch_type === 'in'
                                                                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60'
                                                                    : log.punch_type === 'out'
                                                                    ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60'
                                                                    : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                                                            }`}
                                                        >
                                                            {log.punch_type || 'AUTO'}
                                                        </span>
                                                    </td>

                                                    {/* Source & Device ID (max 2 lines) */}
                                                    <td className="px-3 py-1.5">
                                                        <div className="flex flex-col leading-tight max-w-[140px]">
                                                            <div className="font-medium text-slate-800 dark:text-slate-200 truncate text-xs" title={log.device_id || 'Terminal'}>
                                                                {log.device_id || 'Terminal'}
                                                            </div>
                                                            <div className="text-[10px] text-slate-400 capitalize truncate" title={log.import?.filename ? `${log.source || 'import'} • ${log.import.filename}` : (log.source || 'import')}>
                                                                {log.source || 'import'}
                                                                {log.import?.filename && ` • ${log.import.filename}`}
                                                            </div>
                                                        </div>
                                                    </td>

                                                    {/* Process Status (max 2 lines) */}
                                                    <td className="px-3 py-1.5 whitespace-nowrap">
                                                        {log.is_processed ? (
                                                            <div className="flex flex-col leading-tight">
                                                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                                                                    <CheckCircle2 className="w-3 h-3" />
                                                                    <span>Processed</span>
                                                                </span>
                                                                {log.processed_at ? (
                                                                    <span className="text-[10px] text-slate-400 font-mono" title={log.processed_at}>
                                                                        {new Date(log.processed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-[10px] text-slate-400">Engine OK</span>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <div className="flex flex-col leading-tight">
                                                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                                                                    <AlertTriangle className="w-3 h-3" />
                                                                    <span>Unprocessed</span>
                                                                </span>
                                                                <span className="text-[10px] text-slate-400">Pending</span>
                                                            </div>
                                                        )}
                                                    </td>

                                                    {/* Comparison Detail & Resolution (max 2 lines, debounce remark suppressed) */}
                                                    <td className="px-3 py-1.5">
                                                        {renderComparisonBadge(log.comparison)}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination Footer */}
                        {records.last_page > 1 && (
                            <div className="px-3.5 py-2 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4 shrink-0">
                                <div className="text-xs text-slate-500 dark:text-slate-400">
                                    Page <span className="font-semibold text-slate-800 dark:text-slate-200">{records.current_page}</span> of <span className="font-semibold text-slate-800 dark:text-slate-200">{records.last_page}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    {records.links.map((link, idx) => {
                                        if (link.label.includes('Previous')) {
                                            return (
                                                <button
                                                    key={idx}
                                                    type="button"
                                                    disabled={!link.url}
                                                    onClick={() => link.url && router.get(link.url, {}, { preserveState: true, preserveScroll: true })}
                                                    className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"
                                                >
                                                    <ChevronLeft className="w-3 h-3" />
                                                    <span>Prev</span>
                                                </button>
                                            );
                                        }
                                        if (link.label.includes('Next')) {
                                            return (
                                                <button
                                                    key={idx}
                                                    type="button"
                                                    disabled={!link.url}
                                                    onClick={() => link.url && router.get(link.url, {}, { preserveState: true, preserveScroll: true })}
                                                    className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed"
                                                >
                                                    <span>Next</span>
                                                    <ChevronRight className="w-3 h-3" />
                                                </button>
                                            );
                                        }

                                        return (
                                            <button
                                                key={idx}
                                                type="button"
                                                disabled={!link.url || link.active}
                                                onClick={() => link.url && router.get(link.url, {}, { preserveState: true, preserveScroll: true })}
                                                className={`min-w-[26px] h-6 px-1 text-xs font-medium rounded border transition-colors ${
                                                    link.active
                                                        ? 'bg-indigo-600 text-white border-indigo-600'
                                                        : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                                                } disabled:opacity-50`}
                                                dangerouslySetInnerHTML={{ __html: link.label }}
                                            />
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </AuthenticatedLayout>
    );
}

