import React, { useState } from 'react';
import { Head, Link, router, useForm } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import {
    Calendar as CalendarIcon,
    Clock,
    UserCheck,
    UserX,
    AlertTriangle,
    Download,
    ChevronLeft,
    ChevronRight,
    Edit3,
    ArrowLeft,
    Search,
    ShieldAlert,
    CheckCircle2,
    Calendar,
    Briefcase,
    Zap,
    X,
    Check,
    Moon,
    Sun,
    FileSpreadsheet,
    AlertCircle,
    User,
    Building2,
    Sparkles,
} from 'lucide-react';

interface Employee {
    id: string;
    emp_no: string;
    full_name: string;
    department_id?: string | null;
    department?: {
        id: string;
        name: string;
    } | null;
}

interface TimesheetDay {
    index: number;
    date: string;
    day_number: number;
    day_name: string;
    is_weekend: boolean;
    daily_id: string | null;
    roster_label: string;
    is_roster_off: boolean;
    is_scheduled_work: boolean;
    shift?: {
        id: string;
        name: string;
        code: string;
        shift_type?: string;
        color?: string | null;
    } | null;
    shift_times?: string | null;
    holiday?: { name: string; type: string } | null;
    leave?: { type: string } | null;
    check_in?: string | null;
    check_out?: string | null;
    worked_hours: number;
    late_minutes: number;
    early_departure_minutes: number;
    ot_hours: number;
    double_ot_hours: number;
    status: string;
    is_manual: boolean;
    manual_reason?: string | null;
    anomalies?: any[];
    is_missing_punch: boolean;
}

interface TimesheetSummary {
    total_calendar_days: number;
    present_days: number;
    half_days?: number;
    absent_days: number;
    rest_days: number;
    holiday_days: number;
    leave_days: number;
    missing_punches: number;
    late_days: number;
    manual_adjusted_days: number;
    total_worked_hours: number;
    total_ot_hours: number;
    total_double_ot_hours: number;
}

interface Props {
    employees: Employee[];
    selectedEmployee?: Employee | null;
    selectedMonth: string;
    monthLabel: string;
    timesheetDays: TimesheetDay[];
    summary?: TimesheetSummary | null;
    departments: Array<{ id: string; name: string }>;
    shifts: Array<{ id: string; name: string; code: string; color?: string | null }>;
    selectedDepartmentId?: string | null;
}

export default function Timesheet({
    employees,
    selectedEmployee,
    selectedMonth,
    monthLabel,
    timesheetDays,
    summary,
    departments,
    shifts,
    selectedDepartmentId,
}: Props) {
    const [deptFilter, setDeptFilter] = useState(selectedDepartmentId || '');
    const [nameSearch, setNameSearch] = useState('');
    const [empNoSearch, setEmpNoSearch] = useState('');
    const [adjustModalDay, setAdjustModalDay] = useState<TimesheetDay | null>(null);
    const [auditModalDay, setAuditModalDay] = useState<TimesheetDay | null>(null);

    // Form: Manual Adjustment (Atomic single source of truth)
    const adjustForm = useForm({
        attendance_daily_id: '',
        employee_id: '',
        date: '',
        check_in: '',
        check_out: '',
        status: 'present',
        manual_reason: '',
    });

    // Handle Month change
    const handleMonthChange = (newMonth: string) => {
        router.get(
            '/attendance/timesheet',
            {
                employee_id: selectedEmployee?.id,
                month: newMonth,
                department_id: deptFilter || undefined,
            },
            { preserveState: true }
        );
    };

    const handleShiftMonth = (delta: number) => {
        const [yStr, mStr] = selectedMonth.split('-');
        const date = new Date(parseInt(yStr, 10), parseInt(mStr, 10) - 1 + delta, 1);
        const nextY = date.getFullYear();
        const nextM = String(date.getMonth() + 1).padStart(2, '0');
        handleMonthChange(`${nextY}-${nextM}`);
    };

    // Handle Employee change
    const handleSelectEmployee = (empId: string) => {
        router.get(
            '/attendance/timesheet',
            {
                employee_id: empId,
                month: selectedMonth,
                department_id: deptFilter || undefined,
            },
            { preserveState: true }
        );
    };

    // Filtered employees shortlisted by department and name search
    const filteredEmployees = employees.filter((emp) => {
        if (deptFilter && emp.department_id !== deptFilter && emp.department?.id !== deptFilter) {
            return false;
        }
        if (nameSearch.trim()) {
            const q = nameSearch.toLowerCase().trim();
            if (!emp.full_name.toLowerCase().includes(q) && !emp.emp_no.toLowerCase().includes(q)) {
                return false;
            }
        }
        return true;
    });

    // Exact Emp ID search handler
    const handleExactEmpSearch = (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!empNoSearch.trim()) return;

        const trimmed = empNoSearch.trim().toLowerCase();
        const found = employees.find((emp) => emp.emp_no.toLowerCase() === trimmed);
        if (found) {
            router.get(
                '/attendance/timesheet',
                {
                    employee_id: found.id,
                    month: selectedMonth,
                    department_id: deptFilter || undefined,
                },
                { preserveState: true }
            );
        } else {
            alert(`No employee found with exact ID "${empNoSearch.trim()}".`);
        }
    };

    // Department shortlist handler
    const handleDepartmentChange = (deptId: string) => {
        setDeptFilter(deptId);
        const eligible = employees.filter(emp => !deptId || emp.department_id === deptId || emp.department?.id === deptId);
        if (eligible.length > 0 && selectedEmployee && !eligible.some(e => e.id === selectedEmployee.id)) {
            router.get(
                '/attendance/timesheet',
                {
                    employee_id: eligible[0].id,
                    month: selectedMonth,
                    department_id: deptId || undefined,
                },
                { preserveState: true }
            );
        }
    };

    const handleResetFilters = () => {
        setDeptFilter('');
        setNameSearch('');
        setEmpNoSearch('');
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

    // Open Adjust modal (Atomic consistency with Daily Ledger)
    const openAdjustModal = (day: TimesheetDay) => {
        setAdjustModalDay(day);
        adjustForm.setData({
            attendance_daily_id: day.daily_id || '',
            employee_id: selectedEmployee?.id || '',
            date: day.date,
            check_in: toLocalDatetimeInput(day.check_in),
            check_out: toLocalDatetimeInput(day.check_out),
            status: (day.status === 'unprocessed' || day.status === 'missing_punch') ? 'present' : day.status,
            manual_reason: day.manual_reason || '',
        });
    };

    const handleAdjustSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!adjustModalDay || !selectedEmployee) return;

        adjustForm.post('/attendance/daily/adjust', {
            preserveScroll: true,
            onSuccess: () => {
                setAdjustModalDay(null);
                adjustForm.reset();
                router.reload();
            },
        });
    };

    const getStatusBadge = (day: TimesheetDay) => {
        if (day.is_missing_punch) {
            return (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-500/20 text-orange-400 border border-orange-500/30 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 text-orange-400 shrink-0" />
                    Missing Punch
                </span>
            );
        }
        switch (day.status) {
            case 'present':
                return (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Present
                    </span>
                );
            case 'absent':
                return (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center gap-1">
                        <UserX className="w-3 h-3" /> Absent
                    </span>
                );
            case 'rest_day':
                return (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center gap-1">
                        <Sun className="w-3 h-3" /> Rest Day
                    </span>
                );
            case 'holiday':
                return (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center gap-1">
                        <Moon className="w-3 h-3" /> Holiday
                    </span>
                );
            case 'leave':
                return (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center gap-1">
                        Leave ({day.leave?.type || 'Approved'})
                    </span>
                );
            case 'half_day': {
                const isUnapproved = day.anomalies?.some((a: any) => a.type === 'UNAPPROVED_HALF_DAY');
                if (isUnapproved) {
                    return (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30 flex items-center gap-1 shadow-sm" title="Unapproved Half Day: employee worked half-day duration without approved leave">
                            <Clock className="w-3 h-3 text-rose-400" /> Half Day (Unapproved)
                        </span>
                    );
                }
                return (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Half Day
                    </span>
                );
            }
            default:
                return (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                        {day.status}
                    </span>
                );
        }
    };

    return (
        <AuthenticatedLayout title="Employee Monthly Timesheet" backUrl="/attendance/daily" fullHeight>
            <div className="w-full flex-1 flex flex-col min-h-0 space-y-2 xl:overflow-hidden">
                {/* Header Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1.5 border-b border-slate-800/80 shrink-0">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-600 via-indigo-600 to-purple-600 flex items-center justify-center shadow-md shadow-indigo-500/20 shrink-0">
                            <Calendar className="w-4 h-4 text-white" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-base font-bold tracking-tight text-white leading-tight">
                                    Employee Monthly Timesheet & Audit Matrix
                                </h1>
                                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                                    {monthLabel}
                                </span>
                            </div>
                            <p className="text-[11px] text-slate-400 leading-tight">
                                Chronological 30-day duty roster reconciliation, biometric pairing, and missing punch audit
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                        <Link
                            href="/attendance/daily"
                            className="text-xs font-medium text-slate-300 hover:text-white px-2.5 py-1 rounded-lg border border-slate-800 hover:border-slate-700 bg-slate-900/60 transition flex items-center gap-1.5"
                        >
                            <ArrowLeft className="w-3.5 h-3.5 text-indigo-400" />
                            Daily Ledger
                        </Link>

                        {selectedEmployee && (
                            <>
                                <a
                                    href={`/attendance/timesheet/export?employee_id=${selectedEmployee.id}&month=${selectedMonth}`}
                                    className="text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 px-3 py-1 rounded-lg border border-slate-700 transition flex items-center gap-1.5 shadow-sm"
                                    title="Export complete 30-day timesheet with worked hours and OT breakdown"
                                >
                                    <Download className="w-3.5 h-3.5 text-cyan-400" />
                                    Export Full Timesheet (CSV)
                                </a>

                                <a
                                    href={`/attendance/timesheet/export?employee_id=${selectedEmployee.id}&month=${selectedMonth}&only_missing=1`}
                                    className="text-xs font-semibold text-orange-300 bg-orange-500/10 hover:bg-orange-500/20 px-3 py-1 rounded-lg border border-orange-500/30 transition flex items-center gap-1.5"
                                    title="Export only missing punches and manual adjustments for compliance audit"
                                >
                                    <AlertTriangle className="w-3.5 h-3.5 text-orange-400" />
                                    Export Missing Punches Only
                                </a>
                            </>
                        )}
                    </div>
                </div>

                {/* Control Panel: Employee Shortlist Toolbar & Month Navigator */}
                <div className="px-3 py-1.5 md:py-2 rounded-xl bg-slate-900/70 border border-slate-800/80 backdrop-blur-sm flex flex-col xl:flex-row items-center justify-between gap-2.5 shrink-0">
                    {/* Left: Department Filter, Name Search, Emp ID Exact Search & Shortlisted Dropdown */}
                    <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto flex-1">
                        {/* Department Shortlist */}
                        <div className="w-48 min-w-[140px]">
                            <select
                                value={deptFilter}
                                onChange={(e) => handleDepartmentChange(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
                                title="Shortlist employees by department"
                            >
                                <option value="">All Departments ({employees.length})</option>
                                {departments.map((d) => {
                                    const count = employees.filter((e) => e.department_id === d.id || e.department?.id === d.id).length;
                                    return (
                                        <option key={d.id} value={d.id}>
                                            {d.name} ({count})
                                        </option>
                                    );
                                })}
                            </select>
                        </div>

                        {/* Name Search */}
                        <div className="relative w-40 min-w-[120px]">
                            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                            <input
                                type="text"
                                placeholder="Search name..."
                                value={nameSearch}
                                onChange={(e) => setNameSearch(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-7 pr-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                            />
                        </div>

                        {/* Exact Emp ID Lookup */}
                        <div className="flex items-center gap-1 w-36 min-w-[110px]">
                            <input
                                type="text"
                                placeholder="Emp ID (Exact)..."
                                value={empNoSearch}
                                onChange={(e) => setEmpNoSearch(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleExactEmpSearch()}
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                                title="Type exact employee ID and press Enter"
                            />
                            <button
                                type="button"
                                onClick={() => handleExactEmpSearch()}
                                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg border border-slate-700 transition shrink-0"
                                title="Search Exact Emp ID"
                            >
                                <Search className="w-3 h-3" />
                            </button>
                        </div>

                        {/* Shortlisted Employee Picker */}
                        <div className="relative flex-1 min-w-[200px] max-w-sm">
                            <select
                                value={selectedEmployee?.id || ''}
                                onChange={(e) => handleSelectEmployee(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500 font-medium"
                            >
                                <option value="" disabled>
                                    {filteredEmployees.length === 0
                                        ? 'No matching employees'
                                        : `Select Employee (${filteredEmployees.length} shortlisted)...`}
                                </option>
                                {filteredEmployees.map((emp) => (
                                    <option key={emp.id} value={emp.id}>
                                        {emp.emp_no} — {emp.full_name} ({emp.department?.name || 'No Dept'})
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Reset Filters */}
                        {(deptFilter || nameSearch || empNoSearch) && (
                            <button
                                type="button"
                                onClick={handleResetFilters}
                                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white text-xs rounded-lg transition"
                                title="Reset employee shortlist filters"
                            >
                                Reset
                            </button>
                        )}
                    </div>

                    {/* Month Navigator Toolbar */}
                    <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                            <button
                                type="button"
                                onClick={() => handleShiftMonth(-1)}
                                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                                title="Previous Month"
                            >
                                <ChevronLeft className="w-3.5 h-3.5" />
                            </button>
                            <input
                                type="month"
                                value={selectedMonth}
                                onChange={(e) => handleMonthChange(e.target.value)}
                                className="bg-transparent border-none text-white font-mono font-bold text-xs px-2 focus:outline-none"
                            />
                            <button
                                type="button"
                                onClick={() => handleShiftMonth(1)}
                                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                                title="Next Month"
                            >
                                <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                        </div>

                        <button
                            type="button"
                            onClick={() => {
                                const now = new Date();
                                const curM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
                                handleMonthChange(curM);
                            }}
                            className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 px-2.5 py-1.5 rounded-lg border border-indigo-500/20 bg-indigo-500/10 hover:bg-indigo-500/20 transition"
                        >
                            This Month
                        </button>
                    </div>
                </div>

                {/* Selected Employee Summary Card & KPI Metrics */}
                {selectedEmployee && summary && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-2 shrink-0">
                        <div className="px-2 py-1.5 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700/80 transition flex flex-col justify-center min-w-0">
                            <div className="flex items-baseline justify-between gap-1">
                                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-tight truncate">
                                    Calendar Days
                                </span>
                                <span className="text-sm sm:text-base font-bold text-white shrink-0 font-mono">
                                    {summary.total_calendar_days}
                                </span>
                            </div>
                            <div className="text-[9px] text-slate-500 truncate leading-none mt-0.5">{monthLabel}</div>
                        </div>

                        <div className="px-2 py-1.5 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700/80 transition flex flex-col justify-center min-w-0">
                            <div className="flex items-baseline justify-between gap-1">
                                <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-tight truncate flex items-center gap-1">
                                    <UserCheck className="w-3 h-3 shrink-0" /> Present
                                </span>
                                <span className="text-sm sm:text-base font-bold text-emerald-400 shrink-0 font-mono">
                                    {summary.present_days}
                                </span>
                            </div>
                            <div className="text-[9px] text-slate-500 truncate leading-none mt-0.5">Full day presence</div>
                        </div>

                        <div className="px-2 py-1.5 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700/80 transition flex flex-col justify-center min-w-0">
                            <div className="flex items-baseline justify-between gap-1">
                                <span className="text-[10px] font-semibold text-rose-400 uppercase tracking-tight truncate flex items-center gap-1">
                                    <UserX className="w-3 h-3 shrink-0" /> Absent
                                </span>
                                <span className="text-sm sm:text-base font-bold text-rose-400 shrink-0 font-mono">
                                    {summary.absent_days}
                                </span>
                            </div>
                            <div className="text-[9px] text-slate-500 truncate leading-none mt-0.5">Unexcused absence</div>
                        </div>

                        <div className="px-2 py-1.5 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700/80 transition flex flex-col justify-center min-w-0">
                            <div className="flex items-baseline justify-between gap-1">
                                <span className="text-[10px] font-semibold text-indigo-400 uppercase tracking-tight truncate flex items-center gap-1">
                                    <Sun className="w-3 h-3 shrink-0" /> Rest Days
                                </span>
                                <span className="text-sm sm:text-base font-bold text-indigo-400 shrink-0 font-mono">
                                    {summary.rest_days}
                                </span>
                            </div>
                            <div className="text-[9px] text-slate-500 truncate leading-none mt-0.5">Off days per roster</div>
                        </div>

                        <div className="px-2 py-1.5 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700/80 transition flex flex-col justify-center min-w-0">
                            <div className="flex items-baseline justify-between gap-1">
                                <span className="text-[10px] font-semibold text-orange-400 uppercase tracking-tight truncate flex items-center gap-1">
                                    <AlertTriangle className="w-3 h-3 shrink-0" /> Missing
                                </span>
                                <span className={`text-sm sm:text-base font-bold shrink-0 font-mono ${summary.missing_punches > 0 ? 'text-orange-400 font-extrabold' : 'text-slate-400'}`}>
                                    {summary.missing_punches}
                                </span>
                            </div>
                            <div className="text-[9px] text-slate-500 truncate leading-tight mt-0.5">Needs manager review</div>
                        </div>

                        <div className="px-2 py-1.5 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700/80 transition flex flex-col justify-center min-w-0">
                            <div className="flex items-baseline justify-between gap-1">
                                <span className="text-[10px] font-semibold text-sky-400 uppercase tracking-tight truncate">
                                    Worked Hours
                                </span>
                                <span className="text-sm sm:text-base font-bold text-sky-400 shrink-0 font-mono">
                                    {summary.total_worked_hours}h
                                </span>
                            </div>
                            <div className="text-[9px] text-slate-500 truncate leading-none mt-0.5">Net month hours</div>
                        </div>

                        <div className="px-2 py-1.5 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700/80 transition flex flex-col justify-center min-w-0">
                            <div className="flex items-baseline justify-between gap-1">
                                <span className="text-[10px] font-semibold text-indigo-400 uppercase tracking-tight truncate flex items-center gap-1">
                                    <Zap className="w-3 h-3 shrink-0" /> 1.5x OT
                                </span>
                                <span className="text-sm sm:text-base font-bold text-indigo-400 shrink-0 font-mono">
                                    {summary.total_ot_hours}h
                                </span>
                            </div>
                            <div className="text-[9px] text-slate-500 truncate leading-none mt-0.5">Standard / Rest OT</div>
                        </div>

                        <div className="px-2 py-1.5 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700/80 transition flex flex-col justify-center min-w-0">
                            <div className="flex items-baseline justify-between gap-1">
                                <span className="text-[10px] font-semibold text-purple-400 uppercase tracking-tight truncate flex items-center gap-1">
                                    <Sparkles className="w-3 h-3 shrink-0" /> 2.0x OT
                                </span>
                                <span className="text-sm sm:text-base font-bold text-purple-400 shrink-0 font-mono">
                                    {summary.total_double_ot_hours}h
                                </span>
                            </div>
                            <div className="text-[9px] text-slate-500 truncate leading-none mt-0.5">Poya / Holiday OT</div>
                        </div>
                    </div>
                )}

                {/* Timesheet & Roster Ledger Matrix (Single-screen responsive scroll) */}
                <div className="flex-1 min-h-0 rounded-2xl border border-slate-800/80 bg-slate-900/50 backdrop-blur-md overflow-hidden shadow-2xl flex flex-col">
                    <div className="flex-1 min-h-0 overflow-auto">
                        <table className="w-full text-left border-collapse text-xs">
                            <thead className="sticky top-0 z-10 bg-slate-950 border-b border-slate-800/80 shadow-sm">
                                <tr className="text-slate-400 font-semibold tracking-wider uppercase text-[11px]">
                                    <th className="py-2.5 px-3 text-center w-12 shrink-0">#</th>
                                    <th className="py-2.5 px-3 w-44 min-w-[170px] whitespace-nowrap">Date</th>
                                    <th className="py-2.5 px-3">Duty Roster Schedule</th>
                                    <th className="py-2.5 px-3">Punch In</th>
                                    <th className="py-2.5 px-3">Punch Out</th>
                                    <th className="py-2.5 px-3 text-center whitespace-nowrap">Worked Hours</th>
                                    <th className="py-2.5 px-3 text-center whitespace-nowrap">Overtime (1.5x / 2.0x)</th>
                                    <th className="py-2.5 px-3 text-center whitespace-nowrap">Status & Flags</th>
                                    <th className="py-2.5 px-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/50">
                                {timesheetDays.length === 0 ? (
                                    <tr>
                                        <td colSpan={9} className="py-12 text-center text-slate-500">
                                            <div className="flex flex-col items-center justify-center gap-2">
                                                <Clock className="w-8 h-8 text-slate-600" />
                                                <p className="text-sm font-medium">Please select an employee to view monthly timesheet.</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    timesheetDays.map((day) => {
                                        const isMissing = day.is_missing_punch;
                                        return (
                                            <tr
                                                key={day.date}
                                                className={`transition group ${
                                                    isMissing
                                                        ? 'bg-orange-500/5 hover:bg-orange-500/10'
                                                        : day.is_weekend
                                                        ? 'bg-slate-950/40 hover:bg-slate-800/30'
                                                        : 'hover:bg-slate-800/30'
                                                }`}
                                            >
                                                {/* # Row Number */}
                                                <td className="py-2 px-3 text-center font-mono text-xs text-slate-500">
                                                    {day.day_number}
                                                </td>

                                                {/* Date & Day of Week */}
                                                <td className="py-2 px-3 whitespace-nowrap">
                                                    <div className="flex items-center gap-2">
                                                        <div
                                                            className={`font-mono font-bold text-xs whitespace-nowrap ${
                                                                day.is_weekend ? 'text-indigo-400' : 'text-white'
                                                            }`}
                                                        >
                                                            {day.date}
                                                        </div>
                                                        <span
                                                            className={`text-[10px] font-semibold px-1.5 py-0.5 rounded whitespace-nowrap ${
                                                                day.is_weekend
                                                                    ? 'bg-indigo-500/20 text-indigo-300'
                                                                    : 'bg-slate-800 text-slate-400'
                                                            }`}
                                                        >
                                                            {day.day_name}
                                                        </span>
                                                    </div>
                                                </td>

                                                {/* Duty Roster Schedule */}
                                                <td className="py-2 px-3">
                                                    {day.holiday ? (
                                                        <span className="text-purple-400 font-semibold text-xs flex items-center gap-1.5">
                                                            <Moon className="w-3.5 h-3.5 text-purple-400" />
                                                            {day.holiday.name} ({day.holiday.type.toUpperCase()})
                                                        </span>
                                                    ) : day.leave ? (
                                                        <span className="text-amber-400 font-semibold text-xs flex items-center gap-1.5">
                                                            <Clock className="w-3.5 h-3.5 text-amber-400" />
                                                            {day.leave.type}
                                                        </span>
                                                    ) : day.is_roster_off ? (
                                                        <span className="text-indigo-400 font-semibold text-xs flex items-center gap-1.5">
                                                            <Sun className="w-3.5 h-3.5 text-indigo-400" />
                                                            Rest Day (Off)
                                                        </span>
                                                    ) : day.shift ? (
                                                        <div className="flex flex-col">
                                                            <span
                                                                className="font-semibold text-xs flex items-center gap-1"
                                                                style={{ color: day.shift.color || '#818CF8' }}
                                                            >
                                                                <span
                                                                    className="w-1.5 h-1.5 rounded-full shrink-0"
                                                                    style={{ backgroundColor: day.shift.color || '#818CF8' }}
                                                                />
                                                                <span>{day.shift.name} ({day.shift.code})</span>
                                                            </span>
                                                            {day.shift_times && (
                                                                <span className="text-[10px] text-slate-500 font-mono">
                                                                    {day.shift_times}
                                                                </span>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="text-slate-500 italic text-[11px]">Unassigned Shift</span>
                                                    )}
                                                </td>

                                                {/* Punch In */}
                                                <td className="py-2 px-3">
                                                    <div className="font-mono text-xs text-slate-200">
                                                        {formatTime(day.check_in)}
                                                    </div>
                                                    {day.late_minutes > 0 && (
                                                        <span className="text-[9px] font-bold text-amber-400 bg-amber-500/10 px-1 py-0.2 rounded border border-amber-500/20 inline-block">
                                                            Late +{day.late_minutes}m
                                                        </span>
                                                    )}
                                                </td>

                                                {/* Punch Out */}
                                                <td className="py-2 px-3">
                                                    <div className="font-mono text-xs text-slate-200">
                                                        {formatTime(day.check_out)}
                                                    </div>
                                                    {day.early_departure_minutes > 0 && (
                                                        <span className="text-[9px] font-bold text-rose-400 bg-rose-500/10 px-1 py-0.2 rounded border border-rose-500/20 inline-block">
                                                            Early -{day.early_departure_minutes}m
                                                        </span>
                                                    )}
                                                </td>

                                                {/* Worked Hours */}
                                                <td className="py-2 px-3 text-center font-mono">
                                                    <span className={`text-xs font-bold ${day.worked_hours > 0 ? 'text-white' : 'text-slate-500'}`}>
                                                        {day.worked_hours.toFixed(2)}h
                                                    </span>
                                                </td>

                                                {/* Overtime (1.5x / 2.0x) */}
                                                <td className="py-2 px-3 text-center">
                                                    {day.ot_hours === 0 && day.double_ot_hours === 0 ? (
                                                        <span className="text-slate-600 font-mono">—</span>
                                                    ) : (
                                                        <div className="flex flex-col items-center gap-0.5">
                                                            {day.ot_hours > 0 && (
                                                                <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-indigo-500/15 text-indigo-300 border border-indigo-500/20 font-mono">
                                                                    +{day.ot_hours.toFixed(2)}h (1.5x)
                                                                </span>
                                                            )}
                                                            {day.double_ot_hours > 0 && (
                                                                <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-purple-500/15 text-purple-300 border border-purple-500/20 font-mono">
                                                                    +{day.double_ot_hours.toFixed(2)}h (2.0x)
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                </td>

                                                {/* Status & Flags */}
                                                <td className="py-2 px-3 text-center">
                                                    <div className="flex flex-col items-center gap-1">
                                                        {getStatusBadge(day)}
                                                        {day.is_manual && (
                                                            <span
                                                                onClick={() => setAuditModalDay(day)}
                                                                className="cursor-pointer text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30"
                                                                title="Manually adjusted. Click to view notes."
                                                            >
                                                                MANUAL
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>

                                                {/* Actions */}
                                                <td className="py-2 px-3 text-right">
                                                    <button
                                                        type="button"
                                                        onClick={() => openAdjustModal(day)}
                                                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-indigo-600 text-slate-300 hover:text-white text-xs font-medium transition flex items-center gap-1 ml-auto"
                                                        title="Adjust In/Out or Status for this date"
                                                    >
                                                        <Edit3 className="w-3.5 h-3.5" />
                                                        Adjust
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Manual Adjustment Modal */}
                {adjustModalDay && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
                        <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5">
                            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                                <div>
                                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                                        <Edit3 className="w-4 h-4 text-indigo-400" />
                                        Manual Attendance Adjustment
                                    </h3>
                                    <p className="text-xs text-slate-400 mt-0.5">
                                        {selectedEmployee?.full_name} ({selectedEmployee?.emp_no}) — {adjustModalDay.date}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setAdjustModalDay(null)}
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
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                                        />
                                        {adjustForm.errors.check_in && (
                                            <p className="text-[11px] text-rose-400 mt-1">{adjustForm.errors.check_in}</p>
                                        )}
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-300 mb-1">
                                            Punch Out (Date & Time)
                                        </label>
                                        <input
                                            type="datetime-local"
                                            value={adjustForm.data.check_out}
                                            onChange={(e) => adjustForm.setData('check_out', e.target.value)}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                                        />
                                        {adjustForm.errors.check_out && (
                                            <p className="text-[11px] text-rose-400 mt-1">{adjustForm.errors.check_out}</p>
                                        )}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                                        Attendance Status Override *
                                    </label>
                                    <select
                                        value={adjustForm.data.status}
                                        onChange={(e) => adjustForm.setData('status', e.target.value)}
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
                                    {adjustForm.errors.status && (
                                        <p className="text-[11px] text-rose-400 mt-1">{adjustForm.errors.status}</p>
                                    )}
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
                                        placeholder="Explain reason for manual adjustment (e.g. employee punch missed due to scanner issue, outdoor assignment)..."
                                        value={adjustForm.data.manual_reason}
                                        onChange={(e) => adjustForm.setData('manual_reason', e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-indigo-500"
                                    />
                                    {adjustForm.errors.manual_reason && (
                                        <p className="text-[11px] text-rose-400 mt-1">{adjustForm.errors.manual_reason}</p>
                                    )}
                                </div>

                                <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setAdjustModalDay(null)}
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
                                        {adjustForm.processing ? 'Saving...' : 'Save & Recalculate'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Audit Modal for Notes */}
                {auditModalDay && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
                        <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
                            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                                <h3 className="text-base font-bold text-white flex items-center gap-2">
                                    <ShieldAlert className="w-4 h-4 text-amber-400" />
                                    Manual Adjustment Audit Log
                                </h3>
                                <button
                                    type="button"
                                    onClick={() => setAuditModalDay(null)}
                                    className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="space-y-2 text-xs">
                                <div>
                                    <span className="text-slate-400">Date:</span>{' '}
                                    <span className="text-white font-mono font-semibold">{auditModalDay.date}</span>
                                </div>
                                <div>
                                    <span className="text-slate-400">Justification:</span>
                                    <p className="mt-1 p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 font-mono">
                                        {auditModalDay.manual_reason || 'No justification recorded.'}
                                    </p>
                                </div>
                            </div>
                            <div className="pt-3 border-t border-slate-800 text-right">
                                <button
                                    type="button"
                                    onClick={() => setAuditModalDay(null)}
                                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </AuthenticatedLayout>
    );
}
