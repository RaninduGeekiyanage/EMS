import React, { useState } from 'react';
import axios from 'axios';
import { Head, useForm, router, Link } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import {
    Calendar as CalendarIcon,
    Clock,
    UserCheck,
    UserX,
    AlertTriangle,
    Sliders,
    Play,
    Edit3,
    Search,
    ChevronLeft,
    ChevronRight,
    RefreshCw,
    Sparkles,
    ShieldAlert,
    CheckCircle2,
    Calendar,
    Briefcase,
    Zap,
    X,
    Fingerprint,
    Info,
    HelpCircle,
    Check,
    Moon,
    Landmark,
    Sun,
    HeartHandshake,
    Loader2,
    Lock,
} from 'lucide-react';

interface Employee {
    id: string;
    emp_no: string;
    full_name: string;
    calling_name?: string;
    department?: {
        id: string;
        name: string;
    } | null;
}

interface Shift {
    id: string;
    name: string;
    code: string;
    shift_type: string;
    start_time: string;
    end_time: string;
    color?: string | null;
    grace_minutes: number;
}

export interface AttendanceAnomaly {
    type: string;
    label: string;
    minutes?: number;
    color: string;
    severity: 'high' | 'medium' | 'low';
}

interface AttendanceDailyRecord {
    id: string;
    tenant_id: string;
    employee_id: string;
    attendance_date: string;
    shift_id?: string | null;
    check_in?: string | null;
    check_out?: string | null;
    worked_hours: number;
    regular_hours: number;
    late_minutes: number;
    early_departure_minutes: number;
    ot_hours: number;
    double_ot_hours: number;
    status: 'present' | 'absent' | 'half_day' | 'leave' | 'holiday' | 'rest_day' | 'missing_punch' | 'in_progress' | 'scheduled';
    is_manual: boolean;
    manual_reason?: string | null;
    manual_edited_by?: number | null;
    calculation_breakdown?: any;
    anomalies?: AttendanceAnomaly[] | null;
    employee: Employee;
    shift?: Shift | null;
    editor?: { id: number; name: string } | null;
}

interface AttendanceRule {
    id: string;
    shift_id?: string | null;
    rule_name: string;
    grace_period_minutes: number;
    ot_buffer_minutes: number;
    ot_minimum_minutes: number;
    ot_rate_weekday: number;
    ot_rate_rest_day: number;
    ot_rate_holiday: number;
    half_day_min_hours: number;
    half_day_max_hours: number;
    early_departure_grace_minutes: number;
    round_ot_interval_minutes: number;
    is_active: boolean;
    shift?: { id: string; name: string; code: string } | null;
}

interface Department {
    id: string;
    name: string;
}

interface PublicHoliday {
    id: string;
    name: string;
    type: string;
    holiday_date: string;
}

interface PaginatedData<T> {
    data: T[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number | null;
    to: number | null;
    links: Array<{ url: string | null; label: string; active: boolean }>;
}

interface Props {
    records: PaginatedData<AttendanceDailyRecord> | AttendanceDailyRecord[];
    stats: {
        date: string;
        total_records: number;
        present: number;
        absent: number;
        late: number;
        missing_punch: number;
        half_day: number;
        holiday: number;
        rest_day: number;
        in_progress?: number;
        scheduled?: number;
        manual_adjusted: number;
        total_worked_hours: number;
        total_regular_hours: number;
        total_ot_hours: number;
        total_double_ot_hours: number;
    };
    unprocessedStats?: {
        unprocessed_count: number;
        unprocessed_dates_count: number;
        dates: Array<{ date: string; count: number }>;
        oldest_date?: string | null;
        newest_date?: string | null;
    } | null;
    isPayrollLocked?: boolean;
    selectedDate: string;
    departments: Department[];
    shifts: Shift[];
    rules: AttendanceRule[];
    todayHoliday?: PublicHoliday | null;
    filters: {
        department_id?: string | null;
        status?: string | null;
        search?: string | null;
        name?: string | null;
        emp_no?: string | null;
    };
}

export default function Daily({
    records,
    stats,
    unprocessedStats,
    isPayrollLocked = false,
    selectedDate,
    departments,
    shifts,
    rules,
    todayHoliday,
    filters,
}: Props) {
    const recordList = Array.isArray(records) ? records : (records?.data || []);
    const isPaginated = !Array.isArray(records) && records?.total !== undefined;

    const [nameQuery, setNameQuery] = useState(filters.name || filters.search || '');
    const [empNoQuery, setEmpNoQuery] = useState(filters.emp_no || '');
    const [selectedDept, setSelectedDept] = useState(filters.department_id || '');
    const [selectedStatus, setSelectedStatus] = useState(filters.status || 'all');
    const [isProcessing, setIsProcessing] = useState(false);
    const [isProcessingBacklog, setIsProcessingBacklog] = useState(false);

    // Batch Range Sequential Processing State
    const [isBatchRunning, setIsBatchRunning] = useState(false);
    const [batchProgress, setBatchProgress] = useState<{
        current: number;
        total: number;
        currentDate: string;
        percent: number;
        status: 'idle' | 'running' | 'completed' | 'error';
        errorMsg?: string;
        processedRecordsCount: number;
    }>({
        current: 0,
        total: 0,
        currentDate: '',
        percent: 0,
        status: 'idle',
        processedRecordsCount: 0,
    });

    // Modals
    const [adjustModalRecord, setAdjustModalRecord] = useState<AttendanceDailyRecord | null>(null);
    const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
    const [viewAuditRecord, setViewAuditRecord] = useState<AttendanceDailyRecord | null>(null);
    const [isReprocessModalOpen, setIsReprocessModalOpen] = useState(false);

    // Form: Manual Adjustment
    const adjustForm = useForm({
        check_in: '',
        check_out: '',
        status: 'present',
        manual_reason: '',
    });

    // Form: Reprocess Date Range
    const reprocessForm = useForm({
        start_date: selectedDate,
        end_date: selectedDate,
        department_id: '',
        overwrite_manual: false,
    });

    // Form: Management Rule Setup
    const ruleForm = useForm({
        shift_id: '',
        rule_name: 'Standard Working Policy',
        grace_period_minutes: 10,
        ot_buffer_minutes: 0,
        ot_minimum_minutes: 15,
        ot_rate_weekday: 1.5,
        ot_rate_rest_day: 1.5,
        ot_rate_holiday: 2.0,
        half_day_min_hours: 4.0,
        half_day_max_hours: 6.0,
        early_departure_grace_minutes: 5,
        round_ot_interval_minutes: 15,
        is_active: true,
    });

    // Quick range presets
    const setRangePreset = (type: 'this_month' | 'last_month' | 'last_30_days') => {
        const today = new Date();
        let start = new Date();
        let end = new Date();

        if (type === 'this_month') {
            start = new Date(today.getFullYear(), today.getMonth(), 1);
            end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        } else if (type === 'last_month') {
            start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
            end = new Date(today.getFullYear(), today.getMonth(), 0);
        } else if (type === 'last_30_days') {
            start = new Date(today);
            start.setDate(today.getDate() - 29);
            end = new Date(today);
        }

        const toLocalYmd = (d: Date) => {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${day}`;
        };

        reprocessForm.setData({
            ...reprocessForm.data,
            start_date: toLocalYmd(start),
            end_date: toLocalYmd(end),
        });
    };

    // Calculate days between start and end date (inclusive)
    const getRangeDaysCount = () => {
        if (!reprocessForm.data.start_date || !reprocessForm.data.end_date) return 0;
        const s = new Date(reprocessForm.data.start_date);
        const e = new Date(reprocessForm.data.end_date);
        if (isNaN(s.getTime()) || isNaN(e.getTime()) || e < s) return 0;
        return Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    };

    // Handle date navigation
    const handleDateChange = (newDateStr: string) => {
        router.get(
            '/attendance/daily',
            {
                date: newDateStr,
                department_id: selectedDept || undefined,
                status: selectedStatus !== 'all' ? selectedStatus : undefined,
                name: nameQuery || undefined,
                emp_no: empNoQuery || undefined,
            },
            { preserveState: true }
        );
    };

    const handleShiftDate = (daysDelta: number) => {
        const curr = new Date(selectedDate);
        curr.setDate(curr.getDate() + daysDelta);
        const nextStr = curr.toISOString().split('T')[0];
        handleDateChange(nextStr);
    };

    // Filter submit
    const applyFilters = () => {
        router.get(
            '/attendance/daily',
            {
                date: selectedDate,
                department_id: selectedDept || undefined,
                status: selectedStatus !== 'all' ? selectedStatus : undefined,
                name: nameQuery || undefined,
                emp_no: empNoQuery || undefined,
            },
            { preserveState: true }
        );
    };

    const resetFilters = () => {
        setNameQuery('');
        setEmpNoQuery('');
        setSelectedDept('');
        setSelectedStatus('all');
        router.get(
            '/attendance/daily',
            { date: selectedDate },
            { preserveState: true }
        );
    };

    // Trigger Attendance Calculation Engine (Single Date)
    const handleRunEngine = () => {
        setIsProcessing(true);
        router.post(
            '/attendance/daily/process',
            { date: selectedDate },
            {
                preserveScroll: true,
                onFinish: () => setIsProcessing(false),
            }
        );
    };

    // Trigger Backlog Processing Engine (All Unprocessed Biometric Logs)
    const handleProcessBacklog = () => {
        setIsProcessingBacklog(true);
        router.post(
            '/attendance/daily/process-backlog',
            {},
            {
                preserveScroll: true,
                onFinish: () => setIsProcessingBacklog(false),
            }
        );
    };

    // Sequential Step-by-Step Batch Range Processing (Max 31 Days Safe)
    const handleStartBatchProcess = async (e: React.FormEvent) => {
        e.preventDefault();

        const count = getRangeDaysCount();
        if (count <= 0) {
            alert('Please select a valid date range.');
            return;
        }
        if (count > 31) {
            alert(`Maximum allowed date range is 31 days to ensure system stability. Selected range is ${count} days.`);
            return;
        }

        const start = new Date(reprocessForm.data.start_date);
        const end = new Date(reprocessForm.data.end_date);
        const dateList: string[] = [];
        const cur = new Date(start);
        while (cur <= end) {
            const y = cur.getFullYear();
            const m = String(cur.getMonth() + 1).padStart(2, '0');
            const d = String(cur.getDate()).padStart(2, '0');
            dateList.push(`${y}-${m}-${d}`);
            cur.setDate(cur.getDate() + 1);
        }

        setIsReprocessModalOpen(false);
        setIsBatchRunning(true);
        setBatchProgress({
            current: 0,
            total: dateList.length,
            currentDate: dateList[0],
            percent: 0,
            status: 'running',
            processedRecordsCount: 0,
        });

        let totalRecordsProcessed = 0;

        for (let i = 0; i < dateList.length; i++) {
            const dateStr = dateList[i];
            const currentPercent = Math.round((i / dateList.length) * 100);
            setBatchProgress(prev => ({
                ...prev,
                current: i + 1,
                currentDate: dateStr,
                percent: currentPercent,
            }));

            try {
                const response = await axios.post('/attendance/daily/process-date', {
                    date: dateStr,
                    department_id: reprocessForm.data.department_id || undefined,
                    overwrite_manual: reprocessForm.data.overwrite_manual,
                });

                const resData = response.data;
                totalRecordsProcessed += (resData.records_processed || 0);

                setBatchProgress(prev => ({
                    ...prev,
                    processedRecordsCount: totalRecordsProcessed,
                    percent: Math.round(((i + 1) / dateList.length) * 100),
                }));
            } catch (err: any) {
                setBatchProgress(prev => ({
                    ...prev,
                    status: 'error',
                    errorMsg: err.message || 'Processing failed.',
                }));
                return;
            }
        }

        setBatchProgress(prev => ({
            ...prev,
            status: 'completed',
            percent: 100,
        }));

        setTimeout(() => {
            setIsBatchRunning(false);
            router.reload();
        }, 1200);
    };

    const toLocalDatetimeInput = (dateTimeStr?: string | null): string => {
        if (!dateTimeStr) return '';
        if (dateTimeStr.endsWith('Z')) {
            const d = new Date(dateTimeStr);
            if (isNaN(d.getTime())) return '';
            const formatter = new Intl.DateTimeFormat('en-CA', {
                timeZone: 'Asia/Colombo',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
            });
            const parts = formatter.formatToParts(d);
            const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
            return `${map.year}-${map.month}-${map.day}T${map.hour}:${map.minute}`;
        }
        return dateTimeStr.replace(' ', 'T').substring(0, 16);
    };

    // Open Adjustment Modal
    const openAdjustModal = (rec: AttendanceDailyRecord) => {
        setAdjustModalRecord(rec);
        adjustForm.setData({
            check_in: toLocalDatetimeInput(rec.check_in),
            check_out: toLocalDatetimeInput(rec.check_out),
            status: rec.status,
            manual_reason: rec.manual_reason || '',
        });
    };

    const handleAdjustSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!adjustModalRecord) return;

        adjustForm.put(`/attendance/daily/${adjustModalRecord.id}`, {
            preserveScroll: true,
            onSuccess: () => {
                setAdjustModalRecord(null);
                adjustForm.reset();
            },
        });
    };

    // Open Rule Modal
    const openRuleModal = (ruleToEdit?: AttendanceRule) => {
        if (ruleToEdit) {
            ruleForm.setData({
                shift_id: ruleToEdit.shift_id || '',
                rule_name: ruleToEdit.rule_name,
                grace_period_minutes: ruleToEdit.grace_period_minutes,
                ot_buffer_minutes: ruleToEdit.ot_buffer_minutes,
                ot_minimum_minutes: ruleToEdit.ot_minimum_minutes,
                ot_rate_weekday: ruleToEdit.ot_rate_weekday,
                ot_rate_rest_day: ruleToEdit.ot_rate_rest_day,
                ot_rate_holiday: ruleToEdit.ot_rate_holiday,
                half_day_min_hours: ruleToEdit.half_day_min_hours,
                half_day_max_hours: ruleToEdit.half_day_max_hours,
                early_departure_grace_minutes: ruleToEdit.early_departure_grace_minutes,
                round_ot_interval_minutes: ruleToEdit.round_ot_interval_minutes,
                is_active: ruleToEdit.is_active,
            });
        } else {
            ruleForm.reset();
        }
        setIsRuleModalOpen(true);
    };

    const handleRuleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        ruleForm.post('/attendance/rules', {
            preserveScroll: true,
            onSuccess: () => {
                setIsRuleModalOpen(false);
                ruleForm.reset();
            },
        });
    };

    const formatTime = (dateTimeStr?: string | null) => {
        if (!dateTimeStr) return '—';
        if (dateTimeStr.endsWith('Z')) {
            const d = new Date(dateTimeStr);
            return isNaN(d.getTime()) ? dateTimeStr : d.toLocaleTimeString('en-US', {
                timeZone: 'Asia/Colombo',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true,
            });
        }
        const match = dateTimeStr.match(/(?:\d{4}-\d{2}-\d{2}[T ])?(\d{2}):(\d{2})/);
        if (match) {
            const hour = parseInt(match[1], 10);
            const minute = match[2];
            const ampm = hour >= 12 ? 'PM' : 'AM';
            const formattedHour = (hour % 12 || 12).toString().padStart(2, '0');
            return `${formattedHour}:${minute} ${ampm}`;
        }
        const d = new Date(dateTimeStr);
        return isNaN(d.getTime()) ? dateTimeStr : d.toLocaleTimeString('en-US', {
            timeZone: 'Asia/Colombo',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
        });
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'present':
                return (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Present
                    </span>
                );
            case 'in_progress':
                return (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/30 flex items-center gap-1 animate-pulse">
                        <Loader2 className="w-3 h-3 animate-spin text-blue-400" /> On Duty (In Progress)
                    </span>
                );
            case 'scheduled':
                return (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-500/15 text-slate-300 border border-slate-500/30 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" /> Scheduled
                    </span>
                );
            case 'absent':
                return (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center gap-1">
                        <UserX className="w-3 h-3" /> Absent
                    </span>
                );
            case 'missing_punch':
                return (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center gap-1 animate-pulse">
                        <AlertTriangle className="w-3 h-3 text-amber-400" /> Missing Punch
                    </span>
                );
            case 'half_day':
                return (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Half Day
                    </span>
                );
            case 'holiday':
                return (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center gap-1">
                        <Moon className="w-3 h-3" /> Holiday
                    </span>
                );
            case 'rest_day':
                return (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center gap-1">
                        <Sun className="w-3 h-3" /> Rest Day
                    </span>
                );
            default:
                return (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-500/10 text-slate-400 border border-slate-500/20">
                        {status}
                    </span>
                );
        }
    };

    return (
        <AuthenticatedLayout title="Daily Attendance Ledger" backUrl="/dashboard" fullHeight>
            <div className="w-full flex-1 flex flex-col min-h-0 space-y-2 xl:overflow-hidden">
                {/* Header Subnavigation Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1.5 border-b border-slate-800/80 shrink-0">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-600 via-indigo-600 to-purple-600 flex items-center justify-center shadow-md shadow-indigo-500/20 shrink-0">
                            <Clock className="w-4 h-4 text-white" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-base font-bold tracking-tight text-white leading-tight">
                                    Daily Attendance Ledger
                                </h1>
                                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                                    M02 Phase 3
                                </span>
                            </div>
                            <p className="text-[11px] text-slate-400 leading-tight">
                                Real-time punch pairing, overtime threshold calculations, and exception approvals
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                        <Link
                            href="/attendance/timesheet"
                            className="text-xs font-semibold text-cyan-400 hover:text-white px-2.5 py-1 rounded-lg border border-cyan-500/30 hover:border-cyan-500/60 bg-cyan-500/10 hover:bg-cyan-500/20 transition flex items-center gap-1.5 shadow-sm"
                            title="Open Monthly Employee Timesheet & Roster Reconciliation Matrix"
                        >
                            <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                            Monthly Timesheets
                        </Link>
                        <Link
                            href="/shifts"
                            className="text-xs font-medium text-slate-300 hover:text-white px-2.5 py-1 rounded-lg border border-slate-800 hover:border-slate-700 bg-slate-900/60 transition flex items-center gap-1.5"
                        >
                            <Briefcase className="w-3.5 h-3.5 text-indigo-400" />
                            Shifts Roster
                        </Link>
                        <Link
                            href="/work-calendar"
                            className="text-xs font-medium text-slate-300 hover:text-white px-2.5 py-1 rounded-lg border border-slate-800 hover:border-slate-700 bg-slate-900/60 transition flex items-center gap-1.5"
                        >
                            <Calendar className="w-3.5 h-3.5 text-amber-400" />
                            Work Calendar
                        </Link>
                        <Link
                            href="/attendance/import"
                            className="text-xs font-medium text-slate-300 hover:text-white px-2.5 py-1 rounded-lg border border-slate-800 hover:border-slate-700 bg-slate-900/60 transition flex items-center gap-1.5"
                        >
                            <Fingerprint className="w-3.5 h-3.5 text-cyan-400" />
                            Biometric Ingestion
                        </Link>
                        <Link
                            href="/leave/requests"
                            className="text-xs font-medium text-slate-300 hover:text-white px-2.5 py-1 rounded-lg border border-slate-800 hover:border-slate-700 bg-slate-900/60 transition flex items-center gap-1.5"
                        >
                            <HeartHandshake className="w-3.5 h-3.5 text-emerald-400" />
                            Leave Portal
                        </Link>
                        <button
                            type="button"
                            onClick={() => openRuleModal()}
                            className="text-xs font-medium text-slate-300 hover:text-white px-2.5 py-1 rounded-lg border border-slate-800 hover:border-slate-700 bg-slate-900/60 transition flex items-center gap-1.5"
                        >
                            <Sliders className="w-3.5 h-3.5 text-purple-400" />
                            Management Rules
                        </button>
                    </div>
                </div>

                {/* Date Navigator Toolbar */}
                <div className="px-3 py-1.5 md:py-2 rounded-xl bg-slate-900/70 border border-slate-800/80 backdrop-blur-sm flex flex-col sm:flex-row items-center justify-between gap-2 shrink-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                            <button
                                type="button"
                                onClick={() => handleShiftDate(-1)}
                                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                                title="Previous Day"
                            >
                                <ChevronLeft className="w-3.5 h-3.5" />
                            </button>
                            <input
                                type="date"
                                value={selectedDate}
                                onChange={(e) => handleDateChange(e.target.value)}
                                className="bg-transparent border-none text-white font-mono font-bold text-xs px-1.5 focus:outline-none"
                            />
                            <button
                                type="button"
                                onClick={() => handleShiftDate(1)}
                                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                                title="Next Day"
                            >
                                <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                        </div>

                        <button
                            type="button"
                            onClick={() => handleDateChange(new Date().toISOString().split('T')[0])}
                            className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 px-2.5 py-1 rounded-lg border border-indigo-500/20 bg-indigo-500/10 hover:bg-indigo-500/20 transition"
                        >
                            Today
                        </button>

                        {todayHoliday && (
                            <span className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center gap-1">
                                <Sparkles className="w-3 h-3 text-purple-400" />
                                {todayHoliday.name} ({todayHoliday.type.toUpperCase()})
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <button
                            type="button"
                            onClick={() => {
                                reprocessForm.setData({
                                    start_date: selectedDate,
                                    end_date: selectedDate,
                                    department_id: selectedDept,
                                    overwrite_manual: false,
                                });
                                setIsReprocessModalOpen(true);
                            }}
                            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 flex items-center justify-center gap-1.5 transition"
                            title="Batch calculate or reprocess attendance across month or custom date range (up to 31 days max)"
                        >
                            <RefreshCw className="w-3 h-3 text-cyan-400" />
                            Process Range / Month
                        </button>
                        <button
                            type="button"
                            onClick={handleRunEngine}
                            disabled={isProcessing || isPayrollLocked}
                            className={`w-full sm:w-auto px-3.5 py-1.5 rounded-lg text-white text-xs font-bold shadow-md transition flex items-center justify-center gap-1.5 disabled:opacity-50 ${
                                isPayrollLocked
                                    ? 'bg-slate-800 text-slate-400 border border-slate-700 cursor-not-allowed'
                                    : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 shadow-indigo-500/20'
                            }`}
                            title={
                                isPayrollLocked
                                    ? 'Payroll for this month is approved/locked. Ledger cannot be altered.'
                                    : `Calculates attendance for ${selectedDate}. Manual adjustments are strictly preserved.`
                            }
                        >
                            {isPayrollLocked ? (
                                <>
                                    <Lock className="w-3.5 h-3.5 text-amber-400" />
                                    Period Locked
                                </>
                            ) : (
                                <>
                                    <Play className={`w-3.5 h-3.5 fill-current ${isProcessing ? 'animate-spin' : ''}`} />
                                    {isProcessing ? 'Calculating...' : `Calculate Daily (${selectedDate})`}
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Payroll Locked Security Alert */}
                {isPayrollLocked && (
                    <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-2.5 text-xs text-amber-300 shrink-0">
                        <div className="flex items-center gap-2">
                            <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            <span>
                                <strong>Payroll Period Finalized:</strong> Attendance records for this month are locked under an approved payroll run. Recalculation and modifications are locked to preserve salary compliance.
                            </span>
                        </div>
                    </div>
                )}

                {/* Pending Unprocessed Biometric Punches Notification Banner */}
                {unprocessedStats && unprocessedStats.unprocessed_count > 0 && (
                    <div className="p-2.5 rounded-xl bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-indigo-500/15 border border-amber-500/30 flex flex-col sm:flex-row items-center justify-between gap-2 shadow-sm shrink-0">
                        <div className="flex items-center gap-2.5 min-w-0">
                            <div className="p-1 rounded-lg bg-amber-500/20 border border-amber-500/30 text-amber-400 shrink-0">
                                <Fingerprint className="w-4 h-4 animate-pulse" />
                            </div>
                            <div className="min-w-0">
                                <div className="text-xs font-bold text-amber-300 flex items-center gap-2 truncate">
                                    <span>Pending Biometric Punches Detected</span>
                                    <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500/20 text-amber-400 border border-amber-500/30 font-mono">
                                        {unprocessedStats.unprocessed_count} logs
                                    </span>
                                </div>
                                <div className="text-[10px] text-slate-400 truncate">
                                    There are {unprocessedStats.unprocessed_count} raw punches awaiting ledger calculation across {unprocessedStats.unprocessed_dates_count} historical date(s)
                                    {unprocessedStats.oldest_date && (
                                        <span className="text-slate-300 font-mono ml-1">({unprocessedStats.oldest_date} to {unprocessedStats.newest_date})</span>
                                    )}.
                                </div>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={handleProcessBacklog}
                            disabled={isProcessingBacklog}
                            className="w-full sm:w-auto px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow transition flex items-center justify-center gap-1.5 shrink-0 disabled:opacity-50"
                        >
                            <Zap className={`w-3.5 h-3.5 fill-current ${isProcessingBacklog ? 'animate-spin' : ''}`} />
                            {isProcessingBacklog ? 'Processing...' : 'Process All Backlog'}
                        </button>
                    </div>
                )}

                {/* KPI Metrics Cards (Compact Single/Double Line Responsive) */}
                <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-2 shrink-0">
                    <div className="px-2 py-1.5 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700/80 transition flex flex-col justify-center min-w-0">
                        <div className="flex items-baseline justify-between gap-1">
                            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-tight truncate">
                                Scheduled
                            </span>
                            <span className="text-sm sm:text-base font-bold text-white shrink-0 font-mono">
                                {stats.total_records}
                            </span>
                        </div>
                        <div className="text-[9px] text-slate-500 truncate leading-none mt-0.5">Active profiles</div>
                    </div>

                    <div className="px-2 py-1.5 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700/80 transition flex flex-col justify-center min-w-0">
                        <div className="flex items-baseline justify-between gap-1">
                            <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-tight truncate flex items-center gap-1">
                                <UserCheck className="w-3 h-3 shrink-0" /> Present
                            </span>
                            <span className="text-sm sm:text-base font-bold text-emerald-400 shrink-0 font-mono">
                                {stats.present}
                            </span>
                        </div>
                        <div className="text-[9px] text-slate-500 truncate leading-none mt-0.5">Full day presence</div>
                    </div>

                    {stats.in_progress !== undefined && stats.in_progress > 0 ? (
                        <div className="px-2 py-1.5 rounded-xl bg-blue-950/40 border border-blue-800/80 animate-pulse flex flex-col justify-center min-w-0">
                            <div className="flex items-baseline justify-between gap-1">
                                <span className="text-[10px] font-semibold text-blue-400 uppercase tracking-tight truncate flex items-center gap-1">
                                    <Loader2 className="w-3 h-3 animate-spin text-blue-400 shrink-0" /> On Duty
                                </span>
                                <span className="text-sm sm:text-base font-bold text-blue-400 shrink-0 font-mono">
                                    {stats.in_progress}
                                </span>
                            </div>
                            <div className="text-[9px] text-slate-500 truncate leading-none mt-0.5">Shift in progress</div>
                        </div>
                    ) : (
                        <div className="px-2 py-1.5 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700/80 transition flex flex-col justify-center min-w-0">
                            <div className="flex items-baseline justify-between gap-1">
                                <span className="text-[10px] font-semibold text-rose-400 uppercase tracking-tight truncate flex items-center gap-1">
                                    <UserX className="w-3 h-3 shrink-0" /> Absent
                                </span>
                                <span className="text-sm sm:text-base font-bold text-rose-400 shrink-0 font-mono">
                                    {stats.absent}
                                </span>
                            </div>
                            <div className="text-[9px] text-slate-500 truncate leading-none mt-0.5">No punches logged</div>
                        </div>
                    )}

                    <div className="px-2 py-1.5 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700/80 transition flex flex-col justify-center min-w-0">
                        <div className="flex items-baseline justify-between gap-1">
                            <span className="text-[10px] font-semibold text-amber-400 uppercase tracking-tight truncate flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3 shrink-0" /> Late Punch
                            </span>
                            <span className="text-sm sm:text-base font-bold text-amber-400 shrink-0 font-mono">
                                {stats.late}
                            </span>
                        </div>
                        <div className="text-[9px] text-slate-500 truncate leading-none mt-0.5">Beyond grace limit</div>
                    </div>

                    <div className="px-2 py-1.5 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700/80 transition flex flex-col justify-center min-w-0">
                        <div className="flex items-baseline justify-between gap-1">
                            <span className="text-[10px] font-semibold text-orange-400 uppercase tracking-tight truncate flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3 shrink-0" /> Single Punch
                            </span>
                            <span className="text-sm sm:text-base font-bold text-orange-400 shrink-0 font-mono">
                                {stats.missing_punch}
                            </span>
                        </div>
                        <div className="text-[9px] text-slate-500 truncate leading-tight mt-0.5">Needs review</div>
                    </div>

                    <div className="px-2 py-1.5 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700/80 transition flex flex-col justify-center min-w-0">
                        <div className="flex items-baseline justify-between gap-1">
                            <span className="text-[10px] font-semibold text-sky-400 uppercase tracking-tight truncate">
                                Worked Hours
                            </span>
                            <span className="text-sm sm:text-base font-bold text-sky-400 shrink-0 font-mono">
                                {stats.total_worked_hours}h
                            </span>
                        </div>
                        <div className="text-[9px] text-slate-500 truncate leading-none mt-0.5">Net total hours</div>
                    </div>

                    <div className="px-2 py-1.5 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700/80 transition flex flex-col justify-center min-w-0">
                        <div className="flex items-baseline justify-between gap-1">
                            <span className="text-[10px] font-semibold text-indigo-400 uppercase tracking-tight truncate flex items-center gap-1">
                                <Zap className="w-3 h-3 shrink-0" /> 1.5x OT
                            </span>
                            <span className="text-sm sm:text-base font-bold text-indigo-400 shrink-0 font-mono">
                                {stats.total_ot_hours}h
                            </span>
                        </div>
                        <div className="text-[9px] text-slate-500 truncate leading-none mt-0.5">Standard/Rest OT</div>
                    </div>

                    <div className="px-2 py-1.5 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700/80 transition flex flex-col justify-center min-w-0">
                        <div className="flex items-baseline justify-between gap-1">
                            <span className="text-[10px] font-semibold text-purple-400 uppercase tracking-tight truncate flex items-center gap-1">
                                <Sparkles className="w-3 h-3 shrink-0" /> 2.0x OT
                            </span>
                            <span className="text-sm sm:text-base font-bold text-purple-400 shrink-0 font-mono">
                                {stats.total_double_ot_hours}h
                            </span>
                        </div>
                        <div className="text-[9px] text-slate-500 truncate leading-none mt-0.5">Poya/Holiday OT</div>
                    </div>
                </div>

                {/* Filter Toolbar */}
                <div className="px-3 py-1.5 rounded-xl bg-slate-900/40 border border-slate-800/80 flex flex-wrap items-center gap-2 shrink-0">
                    <div className="relative flex-1 min-w-[160px]">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            placeholder="Filter by employee name..."
                            value={nameQuery}
                            onChange={(e) => setNameQuery(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                        />
                    </div>

                    <div className="w-36 min-w-[110px]">
                        <input
                            type="text"
                            placeholder="Emp ID (Exact)..."
                            value={empNoQuery}
                            onChange={(e) => setEmpNoQuery(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                        />
                    </div>

                    <select
                        value={selectedDept}
                        onChange={(e) => setSelectedDept(e.target.value)}
                        className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
                    >
                        <option value="">All Departments</option>
                        {departments.map((d) => (
                            <option key={d.id} value={d.id}>
                                {d.name}
                            </option>
                        ))}
                    </select>

                    <select
                        value={selectedStatus}
                        onChange={(e) => setSelectedStatus(e.target.value)}
                        className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
                    >
                        <option value="all">All Statuses</option>
                        <option value="present">Present Only</option>
                        <option value="in_progress">On Duty (In Progress)</option>
                        <option value="scheduled">Scheduled (Future)</option>
                        <option value="absent">Absent Only</option>
                        <option value="late">Late Punch Only</option>
                        <option value="missing_punch">Single / Missing Punch</option>
                        <option value="half_day">Half Day</option>
                        <option value="holiday">Holiday</option>
                        <option value="rest_day">Rest Day</option>
                        <option value="manual">Manually Adjusted Only</option>
                    </select>

                    <button
                        type="button"
                        onClick={applyFilters}
                        className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition shadow-sm"
                    >
                        Filter
                    </button>

                    {(nameQuery || empNoQuery || selectedDept || selectedStatus !== 'all') && (
                        <button
                            type="button"
                            onClick={resetFilters}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 transition"
                        >
                            Reset
                        </button>
                    )}
                </div>

                {/* Ledger Data Table (Scrollable single-screen view container) */}
                <div className="flex-1 min-h-0 rounded-2xl border border-slate-800/80 bg-slate-900/50 backdrop-blur-md overflow-hidden shadow-2xl flex flex-col">
                    <div className="flex-1 min-h-0 overflow-auto">
                        <table className="w-full text-left border-collapse text-xs">
                            <thead className="sticky top-0 z-10 bg-slate-950 border-b border-slate-800/80 shadow-sm">
                                <tr className="text-slate-400 font-semibold tracking-wider uppercase text-[11px]">
                                    <th className="py-2.5 px-3 text-center w-12">#</th>
                                    <th className="py-2.5 px-3">Employee</th>
                                    <th className="py-2.5 px-3">Shift</th>
                                    <th className="py-2.5 px-3">Punch In</th>
                                    <th className="py-2.5 px-3">Punch Out</th>
                                    <th className="py-2.5 px-3 text-center">Worked Hours</th>
                                    <th className="py-2.5 px-3 text-center">Late / Early</th>
                                    <th className="py-2.5 px-3 text-center">Overtime (1.5x / 2.0x)</th>
                                    <th className="py-2.5 px-3 text-center">Status</th>
                                    <th className="py-2.5 px-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/50">
                                {recordList.length === 0 ? (
                                    <tr>
                                        <td colSpan={10} className="py-12 text-center text-slate-500">
                                            <div className="flex flex-col items-center justify-center gap-2">
                                                <Clock className="w-8 h-8 text-slate-600" />
                                                <p className="text-sm font-medium">No attendance records found for {selectedDate}.</p>
                                                <p className="text-xs text-slate-500">Click &quot;Calculate Daily&quot; to compute ledger from biometric logs.</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    recordList.map((rec, idx) => (
                                        <tr
                                            key={rec.id}
                                            className="hover:bg-slate-800/30 transition group"
                                        >
                                            {/* # Row Index */}
                                            <td className="py-2 px-3 text-center font-mono text-xs text-slate-500">
                                                {isPaginated ? (records.from ?? 1) + idx : idx + 1}
                                            </td>
                                            {/* Employee info */}
                                            <td className="py-2 px-3">
                                                <div className="flex items-center gap-2.5">
                                                    <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-[11px] shadow shrink-0">
                                                        {rec.employee.full_name.substring(0, 2).toUpperCase()}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="font-semibold text-white flex items-center gap-1.5 truncate">
                                                            <span className="truncate">{rec.employee.full_name}</span>
                                                            {rec.is_manual && (
                                                                <span
                                                                    onClick={() => setViewAuditRecord(rec)}
                                                                    className="cursor-pointer text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 shrink-0"
                                                                    title="Manually adjusted. Click to view reason."
                                                                >
                                                                    MANUAL
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="text-[10px] text-slate-400 flex items-center gap-1.5">
                                                            <span>{rec.employee.emp_no}</span>
                                                            {rec.employee.department && (
                                                                <>
                                                                    <span>•</span>
                                                                    <span className="text-slate-500 truncate">{rec.employee.department.name}</span>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Shift */}
                                            <td className="py-2 px-3">
                                                {rec.shift ? (
                                                   <div className="inline-flex flex-col">
                                                        <span
                                                            className="font-semibold text-xs flex items-center gap-1"
                                                            style={{ color: rec.shift.color || '#818CF8' }}
                                                        >
                                                            <span
                                                                className="w-1.5 h-1.5 rounded-full shrink-0"
                                                                style={{ backgroundColor: rec.shift.color || '#818CF8' }}
                                                            />
                                                            <span className="truncate">{rec.shift.name}</span>
                                                        </span>
                                                        <span className="text-[10px] text-slate-500 font-mono">
                                                            {rec.shift.start_time.substring(0, 5)} - {rec.shift.end_time.substring(0, 5)}
                                                        </span>
                                                    </div>
                                                ) : rec.status === 'rest_day' ? (
                                                    <span className="text-indigo-400 font-semibold text-xs flex items-center gap-1.5">
                                                        <Sun className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                                                        Rest Day (OFF)
                                                    </span>
                                                ) : rec.status === 'holiday' ? (
                                                    <span className="text-purple-400 font-semibold text-xs flex items-center gap-1.5">
                                                        <Moon className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                                                        Public Holiday
                                                    </span>
                                                ) : rec.status === 'leave' ? (
                                                    <span className="text-amber-400 font-semibold text-xs flex items-center gap-1.5">
                                                        <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                                        Approved Leave
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-500 italic text-[11px]">Unassigned Shift</span>
                                                )}
                                            </td>

                                            {/* Punch In */}
                                            <td className="py-2 px-3">
                                                <div className="font-mono text-xs text-slate-200">
                                                    {formatTime(rec.check_in)}
                                                </div>
                                                {rec.late_minutes > 0 && (
                                                    <span className="text-[9px] font-bold text-amber-400 bg-amber-500/10 px-1 py-0.2 rounded border border-amber-500/20 inline-block">
                                                        Late +{rec.late_minutes}m
                                                    </span>
                                                )}
                                            </td>

                                            {/* Punch Out */}
                                            <td className="py-2 px-3">
                                                <div className="font-mono text-xs text-slate-200">
                                                    {formatTime(rec.check_out)}
                                                </div>
                                                {rec.early_departure_minutes > 0 && (
                                                    <span className="text-[9px] font-bold text-rose-400 bg-rose-500/10 px-1 py-0.2 rounded border border-rose-500/20 inline-block">
                                                        Early -{rec.early_departure_minutes}m
                                                    </span>
                                                )}
                                            </td>

                                            {/* Worked Hours */}
                                            <td className="py-2 px-3 text-center font-mono">
                                                <span className={`text-xs font-bold ${rec.worked_hours > 0 ? 'text-white' : 'text-slate-500'}`}>
                                                    {rec.worked_hours.toFixed(2)}h
                                                </span>
                                            </td>

                                            {/* Late / Early */}
                                            <td className="py-2 px-3 text-center font-mono text-[11px]">
                                                {rec.late_minutes === 0 && rec.early_departure_minutes === 0 ? (
                                                    <span className="text-slate-600">—</span>
                                                ) : (
                                                    <div className="flex flex-col items-center">
                                                        {rec.late_minutes > 0 && (
                                                            <span className="text-amber-400 font-semibold">L: {rec.late_minutes}m</span>
                                                        )}
                                                        {rec.early_departure_minutes > 0 && (
                                                            <span className="text-rose-400 font-semibold">E: {rec.early_departure_minutes}m</span>
                                                        )}
                                                    </div>
                                                )}
                                            </td>

                                            {/* Overtime (1.5x / 2.0x) */}
                                            <td className="py-2 px-3 text-center">
                                                {rec.ot_hours === 0 && rec.double_ot_hours === 0 ? (
                                                    <span className="text-slate-600 font-mono">—</span>
                                                ) : (
                                                    <div className="flex flex-col items-center gap-0.5">
                                                        {rec.ot_hours > 0 && (
                                                            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-indigo-500/15 text-indigo-300 border border-indigo-500/20 font-mono">
                                                                +{rec.ot_hours.toFixed(2)}h (1.5x)
                                                            </span>
                                                        )}
                                                        {rec.double_ot_hours > 0 && (
                                                            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-purple-500/15 text-purple-300 border border-purple-500/20 font-mono">
                                                                +{rec.double_ot_hours.toFixed(2)}h (2.0x)
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </td>

                                            {/* Status Badge & Anomalies */}
                                            <td className="py-2 px-3 text-center">
                                                <div className="flex flex-col items-center gap-1">
                                                    {getStatusBadge(rec.status)}
                                                    {rec.anomalies && rec.anomalies.length > 0 && (
                                                        <div className="flex flex-wrap items-center justify-center gap-1 mt-0.5 max-w-[140px]">
                                                            {rec.anomalies.map((anomaly, idx) => (
                                                                <span
                                                                    key={idx}
                                                                    className="px-1 py-0.2 rounded text-[9px] font-bold border tracking-tight"
                                                                    style={{
                                                                        backgroundColor: `${anomaly.color}18`,
                                                                        color: anomaly.color,
                                                                        borderColor: `${anomaly.color}40`,
                                                                    }}
                                                                    title={`${anomaly.label} ${anomaly.minutes ? `(${anomaly.minutes}m)` : ''}`}
                                                                >
                                                                    {anomaly.label} {anomaly.minutes ? `+${anomaly.minutes}m` : ''}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Actions */}
                                            <td className="py-2 px-3 text-right">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    <Link
                                                        href={`/attendance/timesheet?employee_id=${rec.employee_id}&month=${selectedDate.substring(0, 7)}`}
                                                        className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-400 hover:text-cyan-300 text-xs font-medium border border-slate-700 transition flex items-center gap-1"
                                                        title="View Full Month Timesheet & Roster Reconciliation"
                                                    >
                                                        <Calendar className="w-3 h-3" />
                                                        Timesheet
                                                    </Link>
                                                    <button
                                                        type="button"
                                                        onClick={() => openAdjustModal(rec)}
                                                        className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white text-xs font-medium transition flex items-center gap-1"
                                                        title="Adjust Punch Times or Override Status"
                                                    >
                                                        <Edit3 className="w-3 h-3" />
                                                        Adjust
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination Bar */}
                    {isPaginated && records.total > 0 && (
                        <div className="px-3.5 py-1.5 border-t border-slate-800/80 bg-slate-950/70 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400 shrink-0">
                            <div>
                                Showing <span className="font-semibold text-white">{records.from ?? 0}</span> to{' '}
                                <span className="font-semibold text-white">{records.to ?? 0}</span> of{' '}
                                <span className="font-semibold text-white">{records.total}</span> records{' '}
                                <span className="text-[11px] text-slate-500">(30 per page)</span>
                            </div>
                            {records.last_page > 1 && (
                                <div className="flex items-center gap-1">
                                    {records.links.map((link, idx) => (
                                        <Link
                                            key={idx}
                                            href={link.url || '#'}
                                            preserveScroll
                                            preserveState
                                            className={`px-2 py-0.5 rounded-lg border text-xs transition ${
                                                link.active
                                                    ? 'bg-indigo-600 border-indigo-500 text-white font-semibold shadow-sm'
                                                    : 'border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                                            } ${!link.url ? 'opacity-40 pointer-events-none' : ''}`}
                                            dangerouslySetInnerHTML={{ __html: link.label }}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

            {/* Manual Adjustment Modal */}
            {adjustModalRecord && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-6">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                            <div>
                                <h3 className="text-base font-bold text-white flex items-center gap-2">
                                    <Edit3 className="w-4 h-4 text-indigo-400" />
                                    Manual Attendance Adjustment
                                </h3>
                                <p className="text-xs text-slate-400 mt-0.5">
                                    {adjustModalRecord.employee.full_name} ({adjustModalRecord.employee.emp_no}) — {selectedDate}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setAdjustModalRecord(null)}
                                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleAdjustSubmit} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                                        Punch In (Date & Time)
                                    </label>
                                    <input
                                        type="datetime-local"
                                        value={adjustForm.data.check_in}
                                        onChange={(e) => adjustForm.setData('check_in', e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                                        Punch Out (Date & Time)
                                    </label>
                                    <input
                                        type="datetime-local"
                                        value={adjustForm.data.check_out}
                                        onChange={(e) => adjustForm.setData('check_out', e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1">
                                    Attendance Status Override *
                                </label>
                                <select
                                    value={adjustForm.data.status}
                                    onChange={(e) => adjustForm.setData('status', e.target.value as any)}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                                >
                                    <option value="present">Present (Normal Full Day)</option>
                                    <option value="half_day">Half Day</option>
                                    <option value="absent">Absent</option>
                                    <option value="holiday">Holiday</option>
                                    <option value="rest_day">Rest Day</option>
                                    <option value="leave">Leave</option>
                                    <option value="missing_punch">Missing Punch</option>
                                </select>
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="block text-xs font-semibold text-slate-300">
                                        Audit Justification Reason *
                                    </label>
                                    <span className="text-[10px] text-amber-400 flex items-center gap-1">
                                        <ShieldAlert className="w-3 h-3" /> Mandatory for compliance audit
                                    </span>
                                </div>
                                <textarea
                                    required
                                    rows={3}
                                    placeholder="Explain why this manual punch adjustment is being made (e.g. biometric reader failure, authorized outdoor assignment, missed punch verification by manager)..."
                                    value={adjustForm.data.manual_reason}
                                    onChange={(e) => adjustForm.setData('manual_reason', e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-indigo-500"
                                />
                                {adjustForm.errors.manual_reason && (
                                    <p className="text-rose-400 text-xs mt-1">{adjustForm.errors.manual_reason}</p>
                                )}
                            </div>

                            <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setAdjustModalRecord(null)}
                                    className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={adjustForm.processing}
                                    className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/20 disabled:opacity-50 flex items-center gap-2"
                                >
                                    <Check className="w-4 h-4" />
                                    {adjustForm.processing ? 'Saving...' : 'Save Adjustment & Recalculate'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Management Rules Setup Modal */}
            {isRuleModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                            <div>
                                <h3 className="text-base font-bold text-white flex items-center gap-2">
                                    <Sliders className="w-4 h-4 text-purple-400" />
                                    Management Attendance & Overtime Rules
                                </h3>
                                <p className="text-xs text-slate-400 mt-0.5">
                                    Configure shift-specific thresholds, overtime buffers, and holiday rates
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsRuleModalOpen(false)}
                                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleRuleSubmit} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                                        Target Shift Scope
                                    </label>
                                    <select
                                        value={ruleForm.data.shift_id}
                                        onChange={(e) => ruleForm.setData('shift_id', e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                                    >
                                        <option value="">Tenant Default (All Shifts)</option>
                                        {shifts.map((s) => (
                                            <option key={s.id} value={s.id}>
                                                {s.name} ({s.code})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                                        Policy Name *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={ruleForm.data.rule_name}
                                        onChange={(e) => ruleForm.setData('rule_name', e.target.value)}
                                        placeholder="e.g. Standard Operations Rule"
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                                    />
                                </div>
                            </div>

                            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-4">
                                <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider">
                                    Overtime & Buffer Settings
                                </h4>
                                <div className="grid grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                                            OT Start Buffer (Minutes)
                                        </label>
                                        <input
                                            type="number"
                                            value={ruleForm.data.ot_buffer_minutes}
                                            onChange={(e) => ruleForm.setData('ot_buffer_minutes', parseInt(e.target.value) || 0)}
                                            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                                        />
                                        <p className="text-[10px] text-slate-500 mt-1">e.g. 0 = Immediate, 60 = After 1 hr</p>
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                                            Min OT to Qualify (Mins)
                                        </label>
                                        <input
                                            type="number"
                                            value={ruleForm.data.ot_minimum_minutes}
                                            onChange={(e) => ruleForm.setData('ot_minimum_minutes', parseInt(e.target.value) || 0)}
                                            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                                        />
                                        <p className="text-[10px] text-slate-500 mt-1">Default 15 minutes</p>
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                                            OT Rounding Interval
                                        </label>
                                        <select
                                            value={ruleForm.data.round_ot_interval_minutes}
                                            onChange={(e) => ruleForm.setData('round_ot_interval_minutes', parseInt(e.target.value))}
                                            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                                        >
                                            <option value={0}>Exact (No Rounding)</option>
                                            <option value={15}>Nearest 15 Minutes</option>
                                            <option value={30}>Nearest 30 Minutes</option>
                                            <option value={60}>Nearest 1 Hour</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                                            Weekday OT Multiplier
                                        </label>
                                        <input
                                            type="number"
                                            step="0.1"
                                            value={ruleForm.data.ot_rate_weekday}
                                            onChange={(e) => ruleForm.setData('ot_rate_weekday', parseFloat(e.target.value) || 1.5)}
                                            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                                        />
                                        <p className="text-[10px] text-slate-500 mt-1">Statutory 1.50x</p>
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                                            Sunday / Rest Day Rate
                                        </label>
                                        <input
                                            type="number"
                                            step="0.1"
                                            value={ruleForm.data.ot_rate_rest_day}
                                            onChange={(e) => ruleForm.setData('ot_rate_rest_day', parseFloat(e.target.value) || 1.5)}
                                            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                                        />
                                        <p className="text-[10px] text-slate-500 mt-1">Statutory 1.50x</p>
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                                            Statutory / Holiday Rate
                                        </label>
                                        <input
                                            type="number"
                                            step="0.1"
                                            value={ruleForm.data.ot_rate_holiday}
                                            onChange={(e) => ruleForm.setData('ot_rate_holiday', parseFloat(e.target.value) || 2.0)}
                                            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                                        />
                                        <p className="text-[10px] text-slate-500 mt-1">Statutory 2.00x</p>
                                    </div>
                                </div>
                            </div>

                            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-4">
                                <h4 className="text-xs font-bold text-sky-400 uppercase tracking-wider">
                                    Grace Periods & Half-Day Limits
                                </h4>
                                <div className="grid grid-cols-4 gap-4">
                                    <div>
                                        <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                                            Arrival Grace (Mins)
                                        </label>
                                        <input
                                            type="number"
                                            value={ruleForm.data.grace_period_minutes}
                                            onChange={(e) => ruleForm.setData('grace_period_minutes', parseInt(e.target.value) || 10)}
                                            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                                            Early Depart Grace
                                        </label>
                                        <input
                                            type="number"
                                            value={ruleForm.data.early_departure_grace_minutes}
                                            onChange={(e) => ruleForm.setData('early_departure_grace_minutes', parseInt(e.target.value) || 5)}
                                            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                                            Half Day Min (Hours)
                                        </label>
                                        <input
                                            type="number"
                                            step="0.5"
                                            value={ruleForm.data.half_day_min_hours}
                                            onChange={(e) => ruleForm.setData('half_day_min_hours', parseFloat(e.target.value) || 4.0)}
                                            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                                            Half Day Max (Hours)
                                        </label>
                                        <input
                                            type="number"
                                            step="0.5"
                                            value={ruleForm.data.half_day_max_hours}
                                            onChange={(e) => ruleForm.setData('half_day_max_hours', parseFloat(e.target.value) || 6.0)}
                                            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsRuleModalOpen(false)}
                                    className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={ruleForm.processing}
                                    className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-lg shadow-purple-600/20 disabled:opacity-50 flex items-center gap-2"
                                >
                                    <Check className="w-4 h-4" />
                                    {ruleForm.processing ? 'Saving Policy...' : 'Save Management Rule'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Audit View Modal */}
            {viewAuditRecord && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                            <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                <ShieldAlert className="w-4 h-4 text-amber-400" />
                                Manual Punch Audit Trail
                            </h3>
                            <button
                                type="button"
                                onClick={() => setViewAuditRecord(null)}
                                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="space-y-3 text-xs">
                            <div>
                                <span className="text-slate-400">Employee:</span>{' '}
                                <span className="text-white font-semibold">{viewAuditRecord.employee.full_name} ({viewAuditRecord.employee.emp_no})</span>
                            </div>
                            <div>
                                <span className="text-slate-400">Date:</span>{' '}
                                <span className="text-white font-semibold">{viewAuditRecord.attendance_date ? viewAuditRecord.attendance_date.substring(0, 10) : ''}</span>
                            </div>
                            <div>
                                <span className="text-slate-400">Adjusted By:</span>{' '}
                                <span className="text-indigo-400 font-semibold">{viewAuditRecord.editor?.name || 'System Admin'}</span>
                            </div>
                            <div>
                                <span className="text-slate-400">Justification Reason:</span>
                                <p className="mt-1 p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 font-mono">
                                    {viewAuditRecord.manual_reason || 'No specific notes recorded.'}
                                </p>
                            </div>

                            {viewAuditRecord.calculation_breakdown?.machine_reconciliation && (
                                <div className="p-3 rounded-xl bg-cyan-950/40 border border-cyan-800/60 text-cyan-300 space-y-1">
                                    <div className="font-semibold flex items-center gap-1.5 text-cyan-400">
                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                        Biometric Punch Reconciliation
                                    </div>
                                    <p className="text-[11px] text-cyan-200/80">
                                        {viewAuditRecord.calculation_breakdown.machine_reconciliation.note}
                                    </p>
                                    <div className="text-[10px] text-cyan-400/60 font-mono">
                                        {viewAuditRecord.calculation_breakdown.machine_reconciliation.matched_punches_count} raw biometric punch log(s) matched and linked.
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="pt-3 border-t border-slate-800 text-right">
                            <button
                                type="button"
                                onClick={() => setViewAuditRecord(null)}
                                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Process Month / Date Range Modal (Max 31 Days Safe Batch Processing) */}
            {isReprocessModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                            <div>
                                <h3 className="text-base font-bold text-white flex items-center gap-2">
                                    <RefreshCw className="w-4 h-4 text-cyan-400" />
                                    Process Attendance (Month / Date Range)
                                </h3>
                                <p className="text-xs text-slate-400 mt-0.5">
                                    Calculate ledger day-by-day across a selected month or date range (max 31 days).
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsReprocessModalOpen(false)}
                                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Quick Presets */}
                        <div className="space-y-1.5">
                            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                                Quick Range Presets
                            </span>
                            <div className="grid grid-cols-3 gap-2">
                                <button
                                    type="button"
                                    onClick={() => setRangePreset('this_month')}
                                    className="px-2.5 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-cyan-500/40 text-xs font-medium text-slate-200 hover:text-white transition text-center"
                                >
                                    This Month
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setRangePreset('last_month')}
                                    className="px-2.5 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-cyan-500/40 text-xs font-medium text-slate-200 hover:text-white transition text-center"
                                >
                                    Last Month
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setRangePreset('last_30_days')}
                                    className="px-2.5 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-cyan-500/40 text-xs font-medium text-slate-200 hover:text-white transition text-center"
                                >
                                    Last 30 Days
                                </button>
                            </div>
                        </div>

                        <form onSubmit={handleStartBatchProcess} className="space-y-4 text-xs">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                                        Start Date *
                                    </label>
                                    <input
                                        type="date"
                                        value={reprocessForm.data.start_date}
                                        onChange={(e) => reprocessForm.setData('start_date', e.target.value)}
                                        required
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-500 font-mono"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                                        End Date *
                                    </label>
                                    <input
                                        type="date"
                                        value={reprocessForm.data.end_date}
                                        onChange={(e) => reprocessForm.setData('end_date', e.target.value)}
                                        required
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-500 font-mono"
                                    />
                                </div>
                            </div>

                            {/* Range Duration & 31-day Safety Banner */}
                            {(() => {
                                const daysCount = getRangeDaysCount();
                                if (daysCount > 31) {
                                    return (
                                        <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 flex items-start gap-2">
                                            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                                            <div>
                                                <strong className="block font-semibold">Exceeds 31-Day Safety Limit ({daysCount} days selected)</strong>
                                                <span className="text-[11px] text-rose-300/80 block mt-0.5">
                                                    To prevent server timeouts and resource exhaustion, processing is limited to a maximum of 31 days per batch. Please adjust the range.
                                                </span>
                                            </div>
                                        </div>
                                    );
                                }
                                if (daysCount > 0) {
                                    return (
                                        <div className="p-2 rounded-xl bg-cyan-950/40 border border-cyan-800/50 text-cyan-300 flex items-center justify-between font-mono text-[11px]">
                                            <span className="flex items-center gap-1.5">
                                                <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
                                                Selected Batch Duration:
                                            </span>
                                            <span className="font-bold text-white bg-cyan-500/20 px-2 py-0.5 rounded-lg border border-cyan-500/30">
                                                {daysCount} {daysCount === 1 ? 'day' : 'days'} (Max 31 Allowed)
                                            </span>
                                        </div>
                                    );
                                }
                                return null;
                            })()}

                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1">
                                    Department Scope
                                </label>
                                <select
                                    value={reprocessForm.data.department_id}
                                    onChange={(e) => reprocessForm.setData('department_id', e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                                >
                                    <option value="">All Departments (Entire Company)</option>
                                    {departments.map((d) => (
                                        <option key={d.id} value={d.id}>
                                            {d.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 flex items-start gap-3">
                                <input
                                    type="checkbox"
                                    id="overwrite_manual"
                                    checked={reprocessForm.data.overwrite_manual}
                                    onChange={(e) => reprocessForm.setData('overwrite_manual', e.target.checked)}
                                    className="mt-0.5 rounded border-slate-700 bg-slate-900 text-cyan-600 focus:ring-cyan-500"
                                />
                                <label htmlFor="overwrite_manual" className="cursor-pointer text-slate-300 leading-snug">
                                    <span className="font-semibold text-white block">Overwrite Manual Adjustments</span>
                                    <span className="text-[11px] text-slate-400 block mt-1">
                                        {reprocessForm.data.overwrite_manual ? (
                                            <span className="text-amber-400 font-semibold block">
                                                ⚠️ Caution: Manual adjustments, reasons, and supervisor edits in this range will be cleared and replaced with raw biometric device data.
                                            </span>
                                        ) : (
                                            <span className="text-emerald-400 font-semibold block">
                                                🛡️ Safe Mode (Active): Records adjusted manually by HR will be preserved 100%. Only unedited records and new machine punches will be calculated.
                                            </span>
                                        )}
                                    </span>
                                </label>
                            </div>

                            <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsReprocessModalOpen(false)}
                                    className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={getRangeDaysCount() <= 0 || getRangeDaysCount() > 31}
                                    className="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shadow-lg shadow-cyan-600/20 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    <RefreshCw className="w-4 h-4" />
                                    Start Step-by-Step Batch
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Global Sequential Batch Processing Overlay (Action-Blocking) */}
            {isBatchRunning && (
                <div className="fixed inset-0 z-[100] bg-slate-950/85 backdrop-blur-md flex flex-col items-center justify-center text-white p-6 select-none pointer-events-auto">
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-md w-full shadow-2xl text-center space-y-5">
                        <div className="flex items-center justify-center">
                            <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-inner">
                                {batchProgress.status === 'completed' ? (
                                    <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                                ) : batchProgress.status === 'error' ? (
                                    <AlertTriangle className="w-8 h-8 text-rose-400" />
                                ) : (
                                    <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
                                )}
                            </div>
                        </div>

                        <div>
                            <h3 className="text-base font-bold text-white">
                                {batchProgress.status === 'completed'
                                    ? 'Batch Calculation Completed!'
                                    : batchProgress.status === 'error'
                                    ? 'Batch Processing Interrupted'
                                    : 'Processing Month / Date Range'}
                            </h3>
                            <p className="text-xs text-slate-400 mt-1">
                                {batchProgress.status === 'completed'
                                    ? `Successfully calculated ${batchProgress.processedRecordsCount} attendance records.`
                                    : batchProgress.status === 'error'
                                    ? batchProgress.errorMsg
                                    : 'Please do not close, refresh, or leave the browser while the engine runs.'}
                            </p>
                        </div>

                        {/* Progress Bar */}
                        <div className="space-y-1.5 text-left">
                            <div className="flex justify-between text-xs font-mono">
                                <span className="text-slate-400">
                                    Day {batchProgress.current} of {batchProgress.total} ({batchProgress.currentDate})
                                </span>
                                <span className="font-bold text-indigo-400">{batchProgress.percent}%</span>
                            </div>
                            <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                                <div
                                    className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-300"
                                    style={{ width: `${batchProgress.percent}%` }}
                                />
                            </div>
                        </div>

                        <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-[11px] text-slate-400 flex items-center justify-center gap-2 font-mono">
                            <Zap className="w-3.5 h-3.5 text-amber-400" />
                            <span>{batchProgress.processedRecordsCount} ledger records generated</span>
                        </div>

                        {batchProgress.status === 'error' && (
                            <button
                                type="button"
                                onClick={() => setIsBatchRunning(false)}
                                className="w-full px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition"
                            >
                                Dismiss Error
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Global Single-Day Processing Overlay */}
            {isProcessing && (
                <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex flex-col items-center justify-center text-white p-4 select-none pointer-events-auto">
                    <Loader2 className="w-12 h-12 animate-spin text-indigo-400 mb-3" />
                    <p className="text-lg font-semibold">Calculating Attendance Ledger...</p>
                    <p className="text-xs text-slate-400 mt-1">Processing punches, shift rules, and roster assignments inside database transaction...</p>
                </div>
            )}
            </div>
        </AuthenticatedLayout>
    );
}
