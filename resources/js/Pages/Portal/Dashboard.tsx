import React, { useState } from 'react';
import { Head, Link, useForm, router } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import {
    CalendarCheck,
    Clock,
    Palmtree,
    Receipt,
    Calendar,
    ChevronRight,
    AlertTriangle,
    CheckCircle2,
    XCircle,
    User,
    Building2,
    Briefcase,
    CalendarRange,
    FileText,
    ArrowRight,
    Download,
    Plus,
    X,
    Sparkles,
    ShieldAlert,
    Sun,
    Moon,
} from 'lucide-react';

interface ShiftScheduleEntry {
    id: string;
    date: string;
    day_name: string;
    day_num: string;
    schedule_type: string;
    status: string;
    shift_name: string;
    start_time?: string | null;
    end_time?: string | null;
    is_night?: boolean;
}

interface TimesheetDay {
    date: string;
    day_name: string;
    day_num: string;
    is_past_or_today: boolean;
    scheduled_shift: string;
    scheduled_time?: string | null;
    punch_in?: string | null;
    punch_out?: string | null;
    worked_hours: number;
    late_minutes: number;
    early_departure_minutes: number;
    status: string;
    is_late: boolean;
    is_half_day: boolean;
    has_missing_punch: boolean;
    leave_type_name?: string | null;
    has_regularization: boolean;
    regularization_status?: string | null;
}

interface LeaveBalance {
    id: string;
    leave_type: string;
    allocated_days: number;
    utilized_days: number;
    balance_days: number;
    color: string;
}

interface RecentRequest {
    id: string;
    type: 'leave' | 'regularization';
    title: string;
    dates: string;
    status: string;
    approval_stage: string;
    is_bypassed_by_hr: boolean;
    submitted_at: string;
}

interface LatestPayslip {
    id: string;
    period: string;
    net_pay: number;
    gross_pay: number;
    epf_employee: number;
    worked_days: number;
    download_url: string;
}

interface Props {
    employee?: {
        id: string;
        emp_no: string;
        full_name: string;
        department_name: string;
        designation_name: string;
        branch_name: string;
        date_of_joining?: string | null;
    } | null;
    schedule: {
        last_month: ShiftScheduleEntry[];
        this_month: ShiftScheduleEntry[];
        next_month: ShiftScheduleEntry[];
        keys: {
            last_month: { key: string; label: string };
            this_month: { key: string; label: string };
            next_month: { key: string; label: string };
        };
    };
    timesheet: {
        last_month: TimesheetDay[];
        this_month: TimesheetDay[];
    };
    leave_balances: LeaveBalance[];
    recent_requests: RecentRequest[];
    latest_payslip?: LatestPayslip | null;
    leave_types: Array<{ id: string; name: string; code: string }>;
}

export default function Dashboard({
    employee,
    schedule,
    timesheet,
    leave_balances = [],
    recent_requests = [],
    latest_payslip,
    leave_types = [],
}: Props) {
    const [scheduleTab, setScheduleTab] = useState<'this_month' | 'last_month' | 'next_month'>('this_month');
    const [timesheetTab, setTimesheetTab] = useState<'this_month' | 'last_month'>('this_month');

    // Modals
    const [showLeaveModal, setShowLeaveModal] = useState(false);
    const [showRegularizationModal, setShowRegularizationModal] = useState(false);
    const [selectedDateForAction, setSelectedDateForAction] = useState<string>('');

    // Leave Form
    const leaveForm = useForm({
        leave_type_id: leave_types[0]?.id || '',
        start_date: '',
        end_date: '',
        is_half_day: false,
        half_day_type: 'first_half',
        is_short_leave: false,
        short_leave_from: '15:00',
        short_leave_to: '17:00',
        reason: '',
    });

    // Regularization Form
    const regForm = useForm({
        attendance_date: '',
        request_type: 'missing_punch',
        in_time: '08:30',
        out_time: '17:00',
        reason: '',
    });

    const openLeaveModal = (date?: string) => {
        const d = date || new Date().toISOString().split('T')[0];
        leaveForm.clearErrors();
        leaveForm.setData({
            leave_type_id: leave_types[0]?.id || '',
            start_date: d,
            end_date: d,
            is_half_day: false,
            half_day_type: 'first_half',
            is_short_leave: false,
            short_leave_from: '15:00',
            short_leave_to: '17:00',
            reason: '',
        });
        setShowLeaveModal(true);
    };

    const openRegularizationModal = (date?: string) => {
        const d = date || new Date().toISOString().split('T')[0];
        regForm.clearErrors();
        regForm.setData({
            attendance_date: d,
            request_type: 'missing_punch',
            in_time: '08:30',
            out_time: '17:00',
            reason: '',
        });
        setShowRegularizationModal(true);
    };

    const handleLeaveSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        leaveForm.post('/leave/requests', {
            preserveScroll: true,
            onSuccess: () => setShowLeaveModal(false),
        });
    };

    const handleRegSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const dateStr = regForm.data.attendance_date;
        router.post('/attendance/regularizations', {
            attendance_date: dateStr,
            request_type: regForm.data.request_type,
            requested_check_in: `${dateStr} ${regForm.data.in_time}:00`,
            requested_check_out: `${dateStr} ${regForm.data.out_time}:00`,
            reason: regForm.data.reason || 'Biometric punch regularization claim for ' + dateStr,
        }, {
            preserveScroll: true,
            onSuccess: () => setShowRegularizationModal(false),
        });
    };

    const activeSchedule = schedule[scheduleTab] || [];
    const activeTimesheet = timesheet[timesheetTab] || [];

    const getStatusBadge = (status: string) => {
        switch (status.toLowerCase()) {
            case 'approved':
                return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Approved</span>;
            case 'pending_hod':
                return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">Pending HOD</span>;
            case 'pending_hr':
                return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20">Pending HR</span>;
            case 'rejected':
                return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">Rejected</span>;
            default:
                return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-500/10 text-slate-400 border border-slate-500/20">{status}</span>;
        }
    };

    return (
        <AuthenticatedLayout header="Employee Self-Service (ESS)">
            <Head title="My Portal Dashboard — EMS" />

            <div className="space-y-6 max-w-7xl mx-auto pb-12">
                {/* 1. Hero Identity Banner */}
                <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950/80 to-slate-900 p-6 md:p-8 border border-indigo-500/20 shadow-2xl">
                    <div className="absolute top-0 right-0 -mt-10 -mr-10 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
                    <div className="absolute bottom-0 left-1/3 -mb-10 w-48 h-48 bg-teal-500/10 rounded-full blur-2xl pointer-events-none" />

                    <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div className="flex items-center gap-5">
                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-teal-400 flex items-center justify-center text-white text-2xl font-bold shadow-lg shadow-indigo-600/30 flex-shrink-0 border border-indigo-400/30">
                                {employee?.full_name ? employee.full_name.charAt(0) : 'E'}
                            </div>
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">
                                        {employee?.full_name || 'Staff Member'}
                                    </h1>
                                    <span className="px-2 py-0.5 rounded-md bg-teal-500/10 border border-teal-500/20 text-teal-400 text-xs font-mono font-bold">
                                        EMP{employee?.emp_no || '1001'}
                                    </span>
                                </div>
                                <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-slate-300">
                                    <span className="flex items-center gap-1.5">
                                        <Briefcase className="w-3.5 h-3.5 text-indigo-400" />
                                        {employee?.designation_name || 'Staff'}
                                    </span>
                                    <span className="flex items-center gap-1.5">
                                        <Building2 className="w-3.5 h-3.5 text-indigo-400" />
                                        {employee?.department_name || 'Department'}
                                    </span>
                                    <span className="text-slate-400">
                                        Branch: {employee?.branch_name || 'HQ'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Quick Action Buttons */}
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => openLeaveModal()}
                                className="px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-semibold text-xs shadow-lg shadow-teal-600/20 flex items-center gap-2 transition duration-150"
                            >
                                <Plus className="w-4 h-4" />
                                <span>Apply Leave</span>
                            </button>
                            <button
                                onClick={() => openRegularizationModal()}
                                className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-lg shadow-indigo-600/20 flex items-center gap-2 transition duration-150"
                            >
                                <CalendarRange className="w-4 h-4" />
                                <span>Claim Punch</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* 2. Top Metric Cards: Leave Balances & Latest Payslip */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {/* Leave Balances Cards */}
                    {leave_balances.slice(0, 3).map((balance) => (
                        <div
                            key={balance.id}
                            className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800/90 shadow-xl flex flex-col justify-between"
                        >
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-xs font-semibold text-slate-400">
                                    {balance.leave_type}
                                </span>
                                <div
                                    className="w-3 h-3 rounded-full"
                                    style={{ backgroundColor: balance.color || '#6366f1' }}
                                />
                            </div>
                            <div className="flex items-baseline justify-between mb-2">
                                <span className="text-2xl font-bold text-white">
                                    {balance.balance_days}
                                    <span className="text-xs font-normal text-slate-400 ml-1">days left</span>
                                </span>
                                <span className="text-xs text-slate-400">
                                    {balance.utilized_days} / {balance.allocated_days} used
                                </span>
                            </div>
                            {/* Progress bar */}
                            <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                                <div
                                    className="h-full rounded-full transition-all duration-300"
                                    style={{
                                        width: `${Math.min(100, (balance.utilized_days / (balance.allocated_days || 1)) * 100)}%`,
                                        backgroundColor: balance.color || '#6366f1',
                                    }}
                                />
                            </div>
                        </div>
                    ))}

                    {/* Latest Payslip Summary Card */}
                    <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-950/60 to-slate-900 border border-indigo-500/20 shadow-xl flex flex-col justify-between">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-semibold text-indigo-300 flex items-center gap-1.5">
                                <Receipt className="w-4 h-4 text-emerald-400" />
                                Latest Net Salary
                            </span>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300">
                                {latest_payslip?.period || 'Current'}
                            </span>
                        </div>
                        {latest_payslip ? (
                            <>
                                <div className="text-2xl font-bold text-emerald-400 tracking-tight my-1">
                                    Rs. {latest_payslip.net_pay.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                                </div>
                                <div className="flex items-center justify-between pt-1">
                                    <span className="text-[11px] text-slate-400">
                                        EPF: Rs. {latest_payslip.epf_employee.toLocaleString()}
                                    </span>
                                    <a
                                        href={latest_payslip.download_url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition"
                                    >
                                        <Download className="w-3.5 h-3.5" />
                                        <span>PDF Receipt</span>
                                    </a>
                                </div>
                            </>
                        ) : (
                            <div className="text-xs text-slate-500 py-2">
                                No finalized payroll slip available for this period.
                            </div>
                        )}
                    </div>
                </div>

                {/* 3. Section: 3-Month Duty Schedule (Single Source of Truth) */}
                <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                        <div>
                            <div className="flex items-center gap-2">
                                <Calendar className="w-5 h-5 text-indigo-400" />
                                <h2 className="text-base font-bold text-white tracking-tight">
                                    3-Month Duty Schedule & Roster
                                </h2>
                            </div>
                            <p className="text-xs text-slate-400 mt-0.5">
                                Synchronized directly with company operational roster amendments in real time.
                            </p>
                        </div>

                        {/* Month Selector Tabs */}
                        <div className="inline-flex p-1 rounded-xl bg-slate-950 border border-slate-800 text-xs">
                            <button
                                onClick={() => setScheduleTab('last_month')}
                                className={`px-3 py-1.5 rounded-lg font-medium transition ${
                                    scheduleTab === 'last_month'
                                        ? 'bg-indigo-600 text-white shadow'
                                        : 'text-slate-400 hover:text-slate-200'
                                }`}
                            >
                                {schedule.keys?.last_month?.label || 'Last Month'}
                            </button>
                            <button
                                onClick={() => setScheduleTab('this_month')}
                                className={`px-3 py-1.5 rounded-lg font-medium transition ${
                                    scheduleTab === 'this_month'
                                        ? 'bg-indigo-600 text-white shadow'
                                        : 'text-slate-400 hover:text-slate-200'
                                }`}
                            >
                                {schedule.keys?.this_month?.label || 'This Month'} (Active)
                            </button>
                            <button
                                onClick={() => setScheduleTab('next_month')}
                                className={`px-3 py-1.5 rounded-lg font-medium transition ${
                                    scheduleTab === 'next_month'
                                        ? 'bg-indigo-600 text-white shadow'
                                        : 'text-slate-400 hover:text-slate-200'
                                }`}
                            >
                                {schedule.keys?.next_month?.label || 'Next Month'}
                            </button>
                        </div>
                    </div>

                    {/* Schedule Day Cards Matrix */}
                    {activeSchedule.length > 0 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2.5 pt-2">
                            {activeSchedule.map((entry) => {
                                const isRestDay = entry.schedule_type === 'rest_day' || entry.shift_name.toLowerCase().includes('rest') || entry.shift_name.toLowerCase().includes('off');
                                return (
                                    <div
                                        key={entry.id}
                                        className={`p-3 rounded-2xl border text-xs flex flex-col justify-between transition ${
                                            isRestDay
                                                ? 'bg-slate-950/40 border-slate-800/60 text-slate-500'
                                                : 'bg-slate-950/80 border-slate-800/90 text-slate-200 hover:border-indigo-500/40 hover:bg-slate-900/90'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="font-bold text-slate-100">{entry.day_num}</span>
                                            <span className="text-[10px] text-slate-400 uppercase font-mono">{entry.day_name}</span>
                                        </div>
                                        <div className="space-y-1">
                                            <p className={`font-semibold line-clamp-1 ${isRestDay ? 'text-slate-500 italic' : 'text-indigo-400'}`}>
                                                {entry.shift_name}
                                            </p>
                                            {entry.start_time && entry.end_time ? (
                                                <p className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
                                                    {entry.is_night ? <Moon className="w-2.5 h-2.5 text-amber-400" /> : <Sun className="w-2.5 h-2.5 text-sky-400" />}
                                                    <span>{entry.start_time} - {entry.end_time}</span>
                                                </p>
                                            ) : (
                                                <p className="text-[10px] font-mono text-slate-600">Rest / No Shift</p>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="py-8 text-center text-xs text-slate-500 bg-slate-950/40 rounded-2xl border border-slate-800/60">
                            No scheduled roster entries published for this month yet.
                        </div>
                    )}
                </div>

                {/* 4. Section: Interactive Monthly Timesheet (Scheduled vs Actual Punches) */}
                <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                        <div>
                            <div className="flex items-center gap-2">
                                <CalendarCheck className="w-5 h-5 text-teal-400" />
                                <h2 className="text-base font-bold text-white tracking-tight">
                                    Monthly Timesheet & Discrepancy Ledger
                                </h2>
                            </div>
                            <p className="text-xs text-slate-400 mt-0.5">
                                Compare your scheduled roster shift against actual biometric punches and submit claims.
                            </p>
                        </div>

                        {/* Month Selector Tabs */}
                        <div className="inline-flex p-1 rounded-xl bg-slate-950 border border-slate-800 text-xs">
                            <button
                                onClick={() => setTimesheetTab('this_month')}
                                className={`px-3 py-1.5 rounded-lg font-medium transition ${
                                    timesheetTab === 'this_month'
                                        ? 'bg-teal-600 text-white shadow'
                                        : 'text-slate-400 hover:text-slate-200'
                                }`}
                            >
                                This Month
                            </button>
                            <button
                                onClick={() => setTimesheetTab('last_month')}
                                className={`px-3 py-1.5 rounded-lg font-medium transition ${
                                    timesheetTab === 'last_month'
                                        ? 'bg-teal-600 text-white shadow'
                                        : 'text-slate-400 hover:text-slate-200'
                                }`}
                            >
                                Last Month
                            </button>
                        </div>
                    </div>

                    {/* Timesheet Table */}
                    <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/60">
                        <table className="w-full text-left text-xs text-slate-300">
                            <thead className="bg-slate-900/90 text-slate-400 text-[11px] uppercase tracking-wider font-semibold border-b border-slate-800">
                                <tr>
                                    <th className="px-4 py-3">Date</th>
                                    <th className="px-4 py-3">Scheduled Shift</th>
                                    <th className="px-4 py-3">Punch In</th>
                                    <th className="px-4 py-3">Punch Out</th>
                                    <th className="px-4 py-3">Worked</th>
                                    <th className="px-4 py-3">Status</th>
                                    <th className="px-4 py-3 text-right">Self-Service Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/80">
                                {activeTimesheet.map((day) => {
                                    const isRestDay = day.status === 'rest_day';
                                    const isLateOrMissing = (day.is_late || day.has_missing_punch) && day.is_past_or_today && !isRestDay;
                                    const isAbsent = day.status === 'absent' && day.is_past_or_today;

                                    return (
                                        <tr
                                            key={day.date}
                                            className={`hover:bg-slate-900/60 transition ${
                                                isLateOrMissing ? 'bg-amber-950/10' : isAbsent ? 'bg-rose-950/10' : ''
                                            }`}
                                        >
                                            <td className="px-4 py-3 whitespace-nowrap font-medium text-slate-200">
                                                <span>{day.date}</span>
                                                <span className="text-[10px] text-slate-500 font-mono ml-1.5 uppercase">({day.day_name})</span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="font-semibold text-slate-200">{day.scheduled_shift}</div>
                                                {day.scheduled_time && (
                                                    <div className="text-[10px] font-mono text-slate-500">{day.scheduled_time}</div>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 font-mono">
                                                {day.punch_in ? (
                                                    <span className={day.is_late ? 'text-amber-400 font-bold' : 'text-slate-200'}>
                                                        {day.punch_in}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-600">--:--</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 font-mono">
                                                {day.punch_out ? (
                                                    <span className="text-slate-200">{day.punch_out}</span>
                                                ) : (
                                                    <span className="text-slate-600">--:--</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 font-mono text-slate-200">
                                                {day.worked_hours > 0 ? `${day.worked_hours.toFixed(1)}h` : '--'}
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                {isRestDay ? (
                                                    <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-400">
                                                        Rest Day
                                                    </span>
                                                ) : day.leave_type_name ? (
                                                    <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-teal-500/10 text-teal-400 border border-teal-500/20">
                                                        {day.leave_type_name}
                                                    </span>
                                                ) : day.is_late ? (
                                                    <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                                        Late ({day.late_minutes}m)
                                                    </span>
                                                ) : isAbsent ? (
                                                    <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                                        Absent
                                                    </span>
                                                ) : day.is_past_or_today ? (
                                                    <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                                        Present
                                                    </span>
                                                ) : (
                                                    <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-500">
                                                        Scheduled
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-right whitespace-nowrap">
                                                {day.has_regularization ? (
                                                    <span className="inline-flex items-center gap-1 text-[11px] text-teal-400 font-medium">
                                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                                        Claim Submitted ({day.regularization_status || 'Pending'})
                                                    </span>
                                                ) : isLateOrMissing ? (
                                                    <button
                                                        onClick={() => openRegularizationModal(day.date)}
                                                        className="px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-[11px] font-medium transition"
                                                    >
                                                        Claim Regularization
                                                    </button>
                                                ) : isAbsent ? (
                                                    <button
                                                        onClick={() => openLeaveModal(day.date)}
                                                        className="px-2.5 py-1 rounded-lg bg-teal-500/10 hover:bg-teal-500/20 border border-teal-500/30 text-teal-300 text-[11px] font-medium transition"
                                                    >
                                                        Apply Leave
                                                    </button>
                                                ) : (
                                                    <span className="text-slate-600 text-[11px]">—</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* 5. Section: Recent Requests Tracker */}
                <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                        <div className="flex items-center gap-2">
                            <Clock className="w-5 h-5 text-indigo-400" />
                            <h2 className="text-base font-bold text-white tracking-tight">
                                My Recent Requests & Approvals
                            </h2>
                        </div>
                        <div className="flex items-center gap-4 text-xs">
                            <Link href="/portal/leaves" className="text-teal-400 hover:text-teal-300 font-medium transition">
                                All Leaves &rarr;
                            </Link>
                            <Link href="/portal/attendance" className="text-indigo-400 hover:text-indigo-300 font-medium transition">
                                All Claims &rarr;
                            </Link>
                        </div>
                    </div>

                    {recent_requests.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {recent_requests.map((req) => (
                                <div
                                    key={req.id}
                                    className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 flex flex-col justify-between text-xs space-y-3"
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="font-semibold text-slate-200 line-clamp-1">
                                            {req.title}
                                        </span>
                                        {getStatusBadge(req.status)}
                                    </div>
                                    <div className="text-[11px] text-slate-400">
                                        <p>Date: <span className="font-mono text-slate-300">{req.dates}</span></p>
                                        <p className="mt-0.5">Submitted: {req.submitted_at}</p>
                                    </div>
                                    {req.is_bypassed_by_hr && (
                                        <div className="text-[10px] text-amber-400 font-mono bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                                            ⚡ Actioned directly by HR
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="py-6 text-center text-xs text-slate-500">
                            No recent leave or attendance regularization requests filed.
                        </div>
                    )}
                </div>
            </div>

            {/* Quick Leave Modal */}
            {showLeaveModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
                    <div className="w-full max-w-lg p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                            <h3 className="text-base font-bold text-white flex items-center gap-2">
                                <Palmtree className="w-5 h-5 text-teal-400" />
                                Apply for Leave
                            </h3>
                            <button onClick={() => setShowLeaveModal(false)} className="text-slate-400 hover:text-white">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleLeaveSubmit} className="space-y-4 text-xs">
                            {Object.keys(leaveForm.errors).length > 0 && (
                                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
                                    {Object.values(leaveForm.errors)[0]}
                                </div>
                            )}
                            <div>
                                <label className="block text-slate-300 font-medium mb-1">Leave Type</label>
                                <select
                                    value={leaveForm.data.leave_type_id}
                                    onChange={(e) => leaveForm.setData('leave_type_id', e.target.value)}
                                    className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-slate-100"
                                >
                                    {leave_types.map((t) => (
                                        <option key={t.id} value={t.id}>{t.name}</option>
                                    ))}
                                </select>
                                {leaveForm.errors.leave_type_id && (
                                    <p className="text-rose-400 text-[11px] mt-1">{leaveForm.errors.leave_type_id}</p>
                                )}
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-slate-300 font-medium mb-1">Start Date</label>
                                    <input
                                        type="date"
                                        value={leaveForm.data.start_date}
                                        onChange={(e) => leaveForm.setData('start_date', e.target.value)}
                                        className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-slate-100"
                                    />
                                    {leaveForm.errors.start_date && (
                                        <p className="text-rose-400 text-[11px] mt-1">{leaveForm.errors.start_date}</p>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-slate-300 font-medium mb-1">End Date</label>
                                    <input
                                        type="date"
                                        value={leaveForm.data.end_date}
                                        onChange={(e) => leaveForm.setData('end_date', e.target.value)}
                                        className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-slate-100"
                                    />
                                    {leaveForm.errors.end_date && (
                                        <p className="text-rose-400 text-[11px] mt-1">{leaveForm.errors.end_date}</p>
                                    )}
                                </div>
                            </div>
                            <div>
                                <label className="block text-slate-300 font-medium mb-1">Reason</label>
                                <textarea
                                    rows={3}
                                    value={leaveForm.data.reason}
                                    onChange={(e) => leaveForm.setData('reason', e.target.value)}
                                    placeholder="Brief explanation for leave request..."
                                    className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-slate-100"
                                />
                                {leaveForm.errors.reason && (
                                    <p className="text-rose-400 text-[11px] mt-1">{leaveForm.errors.reason}</p>
                                )}
                            </div>
                            <div className="flex justify-end gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowLeaveModal(false)}
                                    className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={leaveForm.processing}
                                    className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-semibold shadow-lg shadow-teal-600/20"
                                >
                                    {leaveForm.processing ? 'Submitting...' : 'Submit Application'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Quick Regularization Modal */}
            {showRegularizationModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
                    <div className="w-full max-w-lg p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                            <h3 className="text-base font-bold text-white flex items-center gap-2">
                                <CalendarRange className="w-5 h-5 text-indigo-400" />
                                Claim Punch Regularization
                            </h3>
                            <button onClick={() => setShowRegularizationModal(false)} className="text-slate-400 hover:text-white">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleRegSubmit} className="space-y-4 text-xs">
                            {Object.keys(regForm.errors).length > 0 && (
                                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
                                    {Object.values(regForm.errors)[0]}
                                </div>
                            )}
                            <div>
                                <label className="block text-slate-300 font-medium mb-1">Attendance Date</label>
                                <input
                                    type="date"
                                    value={regForm.data.attendance_date}
                                    onChange={(e) => regForm.setData('attendance_date', e.target.value)}
                                    className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-slate-100"
                                />
                                {regForm.errors.attendance_date && (
                                    <p className="text-rose-400 text-[11px] mt-1">{regForm.errors.attendance_date}</p>
                                )}
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-slate-300 font-medium mb-1">Claimed In Time</label>
                                    <input
                                        type="time"
                                        value={regForm.data.in_time}
                                        onChange={(e) => regForm.setData('in_time', e.target.value)}
                                        className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-slate-100"
                                    />
                                </div>
                                <div>
                                    <label className="block text-slate-300 font-medium mb-1">Claimed Out Time</label>
                                    <input
                                        type="time"
                                        value={regForm.data.out_time}
                                        onChange={(e) => regForm.setData('out_time', e.target.value)}
                                        className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-slate-100"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-slate-300 font-medium mb-1">Request Category</label>
                                <select
                                    value={regForm.data.request_type}
                                    onChange={(e) => regForm.setData('request_type', e.target.value)}
                                    className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-slate-100"
                                >
                                    <option value="missing_punch">Missing Biometric Punch</option>
                                    <option value="unapproved_half_day">Unapproved Half-Day Dispute</option>
                                    <option value="on_duty_gate_pass">Official On-Duty Gate Pass</option>
                                    <option value="overtime_claim">Overtime Hours Claim</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-slate-300 font-medium mb-1">Reason / Explanation</label>
                                <textarea
                                    rows={3}
                                    value={regForm.data.reason}
                                    onChange={(e) => regForm.setData('reason', e.target.value)}
                                    placeholder="Provide detailed explanation for this claim..."
                                    className="w-full rounded-xl bg-slate-950 border border-slate-800 px-3 py-2 text-slate-100"
                                />
                                {regForm.errors.reason && (
                                    <p className="text-rose-400 text-[11px] mt-1">{regForm.errors.reason}</p>
                                )}
                            </div>
                            <div className="flex justify-end gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowRegularizationModal(false)}
                                    className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={regForm.processing}
                                    className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-lg shadow-indigo-600/20"
                                >
                                    {regForm.processing ? 'Submitting...' : 'Submit Claim'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </AuthenticatedLayout>
    );
}
