import React, { useState } from 'react';
import { Head, useForm, router } from '@inertiajs/react';
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
    status: 'present' | 'absent' | 'half_day' | 'leave' | 'holiday' | 'rest_day' | 'missing_punch';
    is_manual: boolean;
    manual_reason?: string | null;
    manual_edited_by?: number | null;
    calculation_breakdown?: any;
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

interface Props {
    records: AttendanceDailyRecord[];
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
        manual_adjusted: number;
        total_worked_hours: number;
        total_regular_hours: number;
        total_ot_hours: number;
        total_double_ot_hours: number;
    };
    selectedDate: string;
    departments: Department[];
    shifts: Shift[];
    rules: AttendanceRule[];
    todayHoliday?: PublicHoliday | null;
    filters: {
        department_id?: string | null;
        status?: string | null;
        search?: string | null;
    };
}

export default function Daily({
    records,
    stats,
    selectedDate,
    departments,
    shifts,
    rules,
    todayHoliday,
    filters,
}: Props) {
    const [searchQuery, setSearchQuery] = useState(filters.search || '');
    const [selectedDept, setSelectedDept] = useState(filters.department_id || '');
    const [selectedStatus, setSelectedStatus] = useState(filters.status || 'all');
    const [isProcessing, setIsProcessing] = useState(false);

    // Modals
    const [adjustModalRecord, setAdjustModalRecord] = useState<AttendanceDailyRecord | null>(null);
    const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
    const [viewAuditRecord, setViewAuditRecord] = useState<AttendanceDailyRecord | null>(null);

    // Form: Manual Adjustment
    const adjustForm = useForm({
        check_in: '',
        check_out: '',
        status: 'present',
        manual_reason: '',
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

    // Handle date navigation
    const handleDateChange = (newDateStr: string) => {
        router.get(
            '/attendance/daily',
            {
                date: newDateStr,
                department_id: selectedDept || undefined,
                status: selectedStatus !== 'all' ? selectedStatus : undefined,
                search: searchQuery || undefined,
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
                search: searchQuery || undefined,
            },
            { preserveState: true }
        );
    };

    // Trigger Attendance Calculation Engine
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

    // Open Adjustment Modal
    const openAdjustModal = (rec: AttendanceDailyRecord) => {
        setAdjustModalRecord(rec);
        adjustForm.setData({
            check_in: rec.check_in ? rec.check_in.substring(0, 16) : '',
            check_out: rec.check_out ? rec.check_out.substring(0, 16) : '',
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
        const d = new Date(dateTimeStr);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'present':
                return (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Present
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
        <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-indigo-500 selection:text-white pb-24">
            <Head title={`Daily Attendance Ledger (${selectedDate}) — EMS`} />

            {/* Navigation Header */}
            <header className="border-b border-slate-800/80 bg-slate-950/70 backdrop-blur-md sticky top-0 z-40">
                <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 via-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                            <Clock className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <span className="text-lg font-bold tracking-tight text-white">
                                Daily Attendance Ledger
                            </span>
                            <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                                M02 Phase 3
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <a
                            href="/shifts"
                            className="text-xs font-medium text-slate-300 hover:text-white px-3 py-1.5 rounded-lg border border-slate-800 hover:border-slate-700 bg-slate-900/60 transition flex items-center gap-1.5"
                        >
                            <Briefcase className="w-3.5 h-3.5 text-indigo-400" />
                            Shifts Roster
                        </a>
                        <a
                            href="/work-calendar"
                            className="text-xs font-medium text-slate-300 hover:text-white px-3 py-1.5 rounded-lg border border-slate-800 hover:border-slate-700 bg-slate-900/60 transition flex items-center gap-1.5"
                        >
                            <Calendar className="w-3.5 h-3.5 text-amber-400" />
                            Work Calendar
                        </a>
                        <a
                            href="/attendance/import"
                            className="text-xs font-medium text-slate-300 hover:text-white px-3 py-1.5 rounded-lg border border-slate-800 hover:border-slate-700 bg-slate-900/60 transition flex items-center gap-1.5"
                        >
                            <Fingerprint className="w-3.5 h-3.5 text-cyan-400" />
                            Biometric Ingestion
                        </a>
                        <a
                            href="/leave/requests"
                            className="text-xs font-medium text-slate-300 hover:text-white px-3 py-1.5 rounded-lg border border-slate-800 hover:border-slate-700 bg-slate-900/60 transition flex items-center gap-1.5"
                        >
                            <HeartHandshake className="w-3.5 h-3.5 text-emerald-400" />
                            Leave Portal
                        </a>
                        <button
                            type="button"
                            onClick={() => openRuleModal()}
                            className="text-xs font-medium text-slate-300 hover:text-white px-3 py-1.5 rounded-lg border border-slate-800 hover:border-slate-700 bg-slate-900/60 transition flex items-center gap-1.5"
                        >
                            <Sliders className="w-3.5 h-3.5 text-purple-400" />
                            Management Rules
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-6 pt-8 space-y-8">
                {/* Date Navigator Toolbar */}
                <div className="p-4 md:p-6 rounded-3xl bg-slate-900/70 border border-slate-800/80 backdrop-blur-sm flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5 bg-slate-950 p-1.5 rounded-2xl border border-slate-800">
                            <button
                                type="button"
                                onClick={() => handleShiftDate(-1)}
                                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
                                title="Previous Day"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <input
                                type="date"
                                value={selectedDate}
                                onChange={(e) => handleDateChange(e.target.value)}
                                className="bg-transparent border-none text-white font-mono font-bold text-sm px-2 focus:outline-none"
                            />
                            <button
                                type="button"
                                onClick={() => handleShiftDate(1)}
                                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
                                title="Next Day"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>

                        <button
                            type="button"
                            onClick={() => handleDateChange(new Date().toISOString().split('T')[0])}
                            className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 px-3 py-2 rounded-xl border border-indigo-500/20 bg-indigo-500/10 hover:bg-indigo-500/20 transition"
                        >
                            Today
                        </button>

                        {todayHoliday && (
                            <span className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center gap-1.5">
                                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                                {todayHoliday.name} ({todayHoliday.type.toUpperCase()})
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <button
                            type="button"
                            onClick={handleRunEngine}
                            disabled={isProcessing}
                            className="w-full md:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold shadow-lg shadow-indigo-500/20 transition flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            <Play className={`w-4 h-4 fill-current ${isProcessing ? 'animate-spin' : ''}`} />
                            {isProcessing ? 'Calculating Ledger...' : 'Run Attendance Calculation'}
                        </button>
                    </div>
                </div>

                {/* KPI Metrics Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
                    <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80">
                        <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Scheduled</div>
                        <div className="mt-1 text-2xl font-bold text-white">{stats.total_records}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">Active profiles</div>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80">
                        <div className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                            <UserCheck className="w-3 h-3" /> Present
                        </div>
                        <div className="mt-1 text-2xl font-bold text-emerald-400">{stats.present}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">Full day presence</div>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80">
                        <div className="text-[11px] font-semibold text-rose-400 uppercase tracking-wider flex items-center gap-1">
                            <UserX className="w-3 h-3" /> Absent
                        </div>
                        <div className="mt-1 text-2xl font-bold text-rose-400">{stats.absent}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">No punches logged</div>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80">
                        <div className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" /> Late Punch
                        </div>
                        <div className="mt-1 text-2xl font-bold text-amber-400">{stats.late}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">Beyond grace limit</div>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80">
                        <div className="text-[11px] font-semibold text-orange-400 uppercase tracking-wider flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" /> Single Punch
                        </div>
                        <div className="mt-1 text-2xl font-bold text-orange-400">{stats.missing_punch}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">Needs manager review</div>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80">
                        <div className="text-[11px] font-semibold text-sky-400 uppercase tracking-wider">Worked Hours</div>
                        <div className="mt-1 text-2xl font-bold text-sky-400">{stats.total_worked_hours}h</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">Net total hours</div>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80">
                        <div className="text-[11px] font-semibold text-indigo-400 uppercase tracking-wider flex items-center gap-1">
                            <Zap className="w-3 h-3" /> 1.5x OT
                        </div>
                        <div className="mt-1 text-2xl font-bold text-indigo-400">{stats.total_ot_hours}h</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">Standard/Rest OT</div>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80">
                        <div className="text-[11px] font-semibold text-purple-400 uppercase tracking-wider flex items-center gap-1">
                            <Sparkles className="w-3 h-3" /> 2.0x OT
                        </div>
                        <div className="mt-1 text-2xl font-bold text-purple-400">{stats.total_double_ot_hours}h</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">Poya/Holiday OT</div>
                    </div>
                </div>

                {/* Filter Toolbar */}
                <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-800/80 flex flex-col md:flex-row items-center gap-4">
                    <div className="relative flex-1 w-full">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            placeholder="Filter by employee name or EMP ID..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                        />
                    </div>

                    <select
                        value={selectedDept}
                        onChange={(e) => {
                            setSelectedDept(e.target.value);
                        }}
                        className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-indigo-500 w-full md:w-auto"
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
                        onChange={(e) => {
                            setSelectedStatus(e.target.value);
                        }}
                        className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-indigo-500 w-full md:w-auto"
                    >
                        <option value="all">All Statuses</option>
                        <option value="present">Present Only</option>
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
                        className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white transition w-full md:w-auto"
                    >
                        Filter
                    </button>
                </div>

                {/* Ledger Data Table */}
                <div className="rounded-3xl border border-slate-800/80 bg-slate-900/50 backdrop-blur-md overflow-hidden shadow-2xl">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                            <thead>
                                <tr className="border-b border-slate-800/80 bg-slate-950/60 text-slate-400 font-semibold tracking-wider uppercase text-[11px]">
                                    <th className="py-3.5 px-4">Employee</th>
                                    <th className="py-3.5 px-4">Shift</th>
                                    <th className="py-3.5 px-4">Punch In</th>
                                    <th className="py-3.5 px-4">Punch Out</th>
                                    <th className="py-3.5 px-4 text-center">Worked Hours</th>
                                    <th className="py-3.5 px-4 text-center">Late / Early</th>
                                    <th className="py-3.5 px-4 text-center">Overtime (1.5x / 2.0x)</th>
                                    <th className="py-3.5 px-4 text-center">Status</th>
                                    <th className="py-3.5 px-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/50">
                                {records.length === 0 ? (
                                    <tr>
                                        <td colSpan={9} className="py-12 text-center text-slate-500">
                                            <div className="flex flex-col items-center justify-center gap-2">
                                                <Clock className="w-8 h-8 text-slate-600" />
                                                <p className="text-sm font-medium">No attendance records found for {selectedDate}.</p>
                                                <p className="text-xs text-slate-500">Click &quot;Run Attendance Calculation&quot; to calculate ledger from biometric logs.</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    records.map((rec) => (
                                        <tr
                                            key={rec.id}
                                            className="hover:bg-slate-800/30 transition group"
                                        >
                                            {/* Employee info */}
                                            <td className="py-3 px-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-xs shadow">
                                                        {rec.employee.full_name.substring(0, 2).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <div className="font-semibold text-white flex items-center gap-1.5">
                                                            {rec.employee.full_name}
                                                            {rec.is_manual && (
                                                                <span
                                                                    onClick={() => setViewAuditRecord(rec)}
                                                                    className="cursor-pointer text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30"
                                                                    title="Manually adjusted. Click to view reason."
                                                                >
                                                                    MANUAL
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                                                            <span>{rec.employee.emp_no}</span>
                                                            {rec.employee.department && (
                                                                <>
                                                                    <span>•</span>
                                                                    <span className="text-slate-500">{rec.employee.department.name}</span>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Shift */}
                                            <td className="py-3 px-4">
                                                {rec.shift ? (
                                                    <div className="inline-flex flex-col">
                                                        <span
                                                            className="font-semibold text-xs flex items-center gap-1.5"
                                                            style={{ color: rec.shift.color || '#818CF8' }}
                                                        >
                                                            <span
                                                                className="w-2 h-2 rounded-full"
                                                                style={{ backgroundColor: rec.shift.color || '#818CF8' }}
                                                            />
                                                            {rec.shift.name}
                                                        </span>
                                                        <span className="text-[10px] text-slate-500 font-mono">
                                                            {rec.shift.start_time.substring(0, 5)} - {rec.shift.end_time.substring(0, 5)}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-500 italic text-[11px]">Unassigned</span>
                                                )}
                                            </td>

                                            {/* Punch In */}
                                            <td className="py-3 px-4">
                                                <div className="font-mono text-xs text-slate-200">
                                                    {formatTime(rec.check_in)}
                                                </div>
                                                {rec.late_minutes > 0 && (
                                                    <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 inline-block mt-0.5">
                                                        Late +{rec.late_minutes}m
                                                    </span>
                                                )}
                                            </td>

                                            {/* Punch Out */}
                                            <td className="py-3 px-4">
                                                <div className="font-mono text-xs text-slate-200">
                                                    {formatTime(rec.check_out)}
                                                </div>
                                                {rec.early_departure_minutes > 0 && (
                                                    <span className="text-[10px] font-bold text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/20 inline-block mt-0.5">
                                                        Early -{rec.early_departure_minutes}m
                                                    </span>
                                                )}
                                            </td>

                                            {/* Worked Hours */}
                                            <td className="py-3 px-4 text-center font-mono">
                                                <span className={`text-xs font-bold ${rec.worked_hours > 0 ? 'text-white' : 'text-slate-500'}`}>
                                                    {rec.worked_hours.toFixed(2)}h
                                                </span>
                                            </td>

                                            {/* Late / Early */}
                                            <td className="py-3 px-4 text-center font-mono text-[11px]">
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
                                            <td className="py-3 px-4 text-center">
                                                {rec.ot_hours === 0 && rec.double_ot_hours === 0 ? (
                                                    <span className="text-slate-600 font-mono">—</span>
                                                ) : (
                                                    <div className="flex flex-col items-center gap-0.5">
                                                        {rec.ot_hours > 0 && (
                                                            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-indigo-500/15 text-indigo-300 border border-indigo-500/20 font-mono">
                                                                +{rec.ot_hours.toFixed(2)}h (1.5x)
                                                            </span>
                                                        )}
                                                        {rec.double_ot_hours > 0 && (
                                                            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-purple-500/15 text-purple-300 border border-purple-500/20 font-mono">
                                                                +{rec.double_ot_hours.toFixed(2)}h (2.0x)
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </td>

                                            {/* Status Badge */}
                                            <td className="py-3 px-4 text-center">
                                                <div className="flex justify-center">
                                                    {getStatusBadge(rec.status)}
                                                </div>
                                            </td>

                                            {/* Actions */}
                                            <td className="py-3 px-4 text-right">
                                                <button
                                                    type="button"
                                                    onClick={() => openAdjustModal(rec)}
                                                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white text-xs font-medium transition flex items-center gap-1.5 ml-auto"
                                                    title="Adjust Punch Times or Override Status"
                                                >
                                                    <Edit3 className="w-3.5 h-3.5" />
                                                    Adjust
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>

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
        </div>
    );
}
