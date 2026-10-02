import React, { useState, useMemo } from 'react';
import { Head, router, usePage } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import {
    Calendar,
    Clock,
    CheckCircle2,
    AlertTriangle,
    XCircle,
    Plus,
    CalendarCheck,
    FileSpreadsheet,
    ChevronLeft,
    ChevronRight,
    Send,
    X,
    Info,
    ShieldAlert,
    Sparkles,
    UserCheck,
    Check,
} from 'lucide-react';

interface ShiftInfo {
    code: string;
    name: string;
    start_time: string;
    end_time: string;
}

interface AttendanceRecord {
    id: string;
    attendance_date: string;
    shift: ShiftInfo | null;
    check_in: string | null;
    check_out: string | null;
    worked_hours: number;
    late_minutes: number;
    early_departure_minutes: number;
    ot_hours: number;
    double_ot_hours: number;
    approved_ot_hours: number;
    approved_double_ot_hours: number;
    ot_approval_status: string | null;
    status: string;
    is_paid: boolean;
    is_manual: boolean;
}

interface RegularizationItem {
    id: string;
    attendance_date: string;
    request_type: string;
    status: string;
    requested_check_in: string | null;
    requested_check_out: string | null;
    reason: string;
    hod_remarks: string | null;
    rejection_reason: string | null;
    created_at: string;
}

interface Props {
    employee: {
        id: string;
        emp_no: string;
        full_name: string;
        email: string;
        department_name?: string;
        designation_name?: string;
    } | null;
    selectedMonth: string;
    records: AttendanceRecord[];
    kpis: {
        total_scheduled: number;
        present_days: number;
        late_days: number;
        total_late_minutes: number;
        half_days: number;
        absent_days: number;
        worked_hours: number;
        approved_ot_hours: number;
        raw_ot_hours: number;
        pending_regularizations: number;
    };
    regularizations: RegularizationItem[];
}

export default function MyAttendance({
    employee,
    selectedMonth,
    records,
    kpis,
    regularizations,
}: Props) {
    const { flash } = usePage().props as any;

    const [activeTab, setActiveTab] = useState<'timesheet' | 'regularizations'>('timesheet');
    const [regularizeModalOpen, setRegularizeModalOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // Form state for regularization request
    const [formDate, setFormDate] = useState<string>(nowIsoDate());
    const [formType, setFormType] = useState<string>('missing_punch');
    const [formCheckIn, setFormCheckIn] = useState<string>('08:30');
    const [formCheckOut, setFormCheckOut] = useState<string>('17:00');
    const [formReason, setFormReason] = useState<string>('');

    function nowIsoDate(): string {
        const d = new Date();
        return d.toISOString().split('T')[0];
    }

    const handleMonthChange = (direction: 'prev' | 'next') => {
        const [year, month] = selectedMonth.split('-').map(Number);
        let nextYear = year;
        let nextMonth = direction === 'next' ? month + 1 : month - 1;
        if (nextMonth > 12) {
            nextMonth = 1;
            nextYear += 1;
        } else if (nextMonth < 1) {
            nextMonth = 12;
            nextYear -= 1;
        }
        const formatted = `${nextYear}-${String(nextMonth).padStart(2, '0')}`;
        router.get('/portal/attendance', { month: formatted }, { preserveState: true });
    };

    const openRegularizeForDate = (date: string, inTime?: string | null, outTime?: string | null) => {
        setFormDate(date);
        if (inTime) setFormCheckIn(inTime.slice(0, 5));
        if (outTime) setFormCheckOut(outTime.slice(0, 5));
        setRegularizeModalOpen(true);
    };

    const handleRegularizeSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);

        const checkInIso = formCheckIn ? `${formDate} ${formCheckIn}:00` : null;
        const checkOutIso = formCheckOut ? `${formDate} ${formCheckOut}:00` : null;

        router.post(
            '/attendance/regularizations',
            {
                attendance_date: formDate,
                request_type: formType,
                requested_check_in: checkInIso,
                requested_check_out: checkOutIso,
                reason: formReason,
            },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setRegularizeModalOpen(false);
                    setFormReason('');
                    setSubmitting(false);
                    setActiveTab('regularizations');
                },
                onError: () => {
                    setSubmitting(false);
                },
            }
        );
    };

    const getStatusBadge = (status: string, isPaid: boolean) => {
        switch (status) {
            case 'present':
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <CheckCircle2 className="w-3 h-3" />
                        Present
                    </span>
                );
            case 'half_day':
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        <AlertTriangle className="w-3 h-3" />
                        Half Day {isPaid ? '(Paid)' : '(No-Pay)'}
                    </span>
                );
            case 'absent':
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-500/10 text-red-400 border border-red-500/20">
                        <XCircle className="w-3 h-3" />
                        Absent
                    </span>
                );
            case 'rest_day':
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                        Rest Day
                    </span>
                );
            case 'holiday':
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                        Holiday
                    </span>
                );
            default:
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400">
                        {status}
                    </span>
                );
        }
    };

    const getRegStatusBadge = (status: string) => {
        switch (status) {
            case 'pending_hod':
                return (
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        Awaiting HOD Review
                    </span>
                );
            case 'pending_hr':
                return (
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        Awaiting HR Sign-off
                    </span>
                );
            case 'approved':
                return (
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        Approved & Synchronized
                    </span>
                );
            case 'rejected':
                return (
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-red-500/10 text-red-400 border border-red-500/20">
                        Rejected
                    </span>
                );
            default:
                return <span className="px-2 py-0.5 text-xs text-slate-400">{status}</span>;
        }
    };

    return (
        <AuthenticatedLayout title="My Attendance">
            <Head title="My Attendance — ESS Portal" />

            <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
                {/* Notice if no employee profile linked */}
                {!employee && (
                    <div className="bg-amber-950/30 border border-amber-500/40 rounded-2xl p-4 flex items-center gap-3 text-amber-300 shadow-xl">
                        <ShieldAlert className="w-5 h-5 flex-shrink-0 text-amber-400" />
                        <div className="text-xs">
                            <p className="font-bold">No Employee Master Record Linked</p>
                            <p className="text-amber-400/80">
                                Your login account is not currently connected to an active employee record. Please contact HR to link your staff profile.
                            </p>
                        </div>
                    </div>
                )}

                {/* Header Profile & Month Selector */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-indigo-800 text-white font-black text-xl flex items-center justify-center shadow-lg shadow-indigo-600/30">
                            {employee?.full_name ? employee.full_name.charAt(0).toUpperCase() : 'U'}
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                                    Self-Service Portal
                                </span>
                                {employee?.emp_no && (
                                    <span className="text-xs font-mono font-bold text-slate-400">
                                        EMP: {employee.emp_no}
                                    </span>
                                )}
                            </div>
                            <h1 className="text-2xl font-black text-white tracking-tight mt-0.5">
                                {employee?.full_name ?? 'My Attendance & Punches'}
                            </h1>
                            <p className="text-xs text-slate-400 mt-0.5">
                                {employee?.department_name ?? 'Company Staff'} • {employee?.designation_name ?? 'Employee'}
                            </p>
                        </div>
                    </div>

                    {/* Controls: Month Switcher & Action */}
                    <div className="flex items-center gap-2.5 flex-wrap">
                        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-1 flex items-center shadow-sm">
                            <button
                                type="button"
                                onClick={() => handleMonthChange('prev')}
                                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
                                title="Previous Month"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <span className="px-3 text-xs font-bold text-white font-mono">
                                {selectedMonth}
                            </span>
                            <button
                                type="button"
                                onClick={() => handleMonthChange('next')}
                                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
                                title="Next Month"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>

                        <button
                            type="button"
                            onClick={() => setRegularizeModalOpen(true)}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-600/30 transition"
                        >
                            <Plus className="w-4 h-4" />
                            Request Regularization
                        </button>
                    </div>
                </div>

                {/* KPI Overview Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
                    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-lg">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Days Present</span>
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        </div>
                        <p className="text-2xl font-black text-white mt-2">
                            {kpis.present_days}
                            <span className="text-xs font-normal text-slate-500 ml-1">/ {kpis.total_scheduled}</span>
                        </p>
                        <p className="text-[10px] text-slate-400 mt-1">{kpis.worked_hours} total hours logged</p>
                    </div>

                    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-lg">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Approved OT</span>
                            <Sparkles className="w-4 h-4 text-amber-400" />
                        </div>
                        <p className="text-2xl font-black text-amber-300 mt-2">
                            {kpis.approved_ot_hours}
                            <span className="text-xs font-normal text-slate-500 ml-1">hrs</span>
                        </p>
                        <p className="text-[10px] text-slate-400 mt-1">Raw OT: {kpis.raw_ot_hours} hrs</p>
                    </div>

                    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-lg">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Lateness</span>
                            <Clock className="w-4 h-4 text-indigo-400" />
                        </div>
                        <p className="text-2xl font-black text-white mt-2">
                            {kpis.late_days}
                            <span className="text-xs font-normal text-slate-500 ml-1">days</span>
                        </p>
                        <p className="text-[10px] text-slate-400 mt-1">{kpis.total_late_minutes} total mins</p>
                    </div>

                    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-lg">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Half Days</span>
                            <AlertTriangle className="w-4 h-4 text-amber-400" />
                        </div>
                        <p className="text-2xl font-black text-white mt-2">{kpis.half_days}</p>
                        <p className="text-[10px] text-slate-400 mt-1">Absences: {kpis.absent_days}</p>
                    </div>

                    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-lg">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Pending Requests</span>
                            <CalendarCheck className="w-4 h-4 text-cyan-400" />
                        </div>
                        <p className="text-2xl font-black text-cyan-300 mt-2">{kpis.pending_regularizations}</p>
                        <p className="text-[10px] text-slate-400 mt-1">Under HOD/HR review</p>
                    </div>
                </div>

                {/* Sub-Navigation Switcher */}
                <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                    <button
                        type="button"
                        onClick={() => setActiveTab('timesheet')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
                            activeTab === 'timesheet'
                                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                                : 'text-slate-400 hover:text-white bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800'
                        }`}
                    >
                        <Calendar className="w-4 h-4" />
                        Monthly Punch Ledger ({records.length} days)
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('regularizations')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
                            activeTab === 'regularizations'
                                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                                : 'text-slate-400 hover:text-white bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800'
                        }`}
                    >
                        <FileSpreadsheet className="w-4 h-4 text-cyan-400" />
                        My Regularization Claims ({regularizations.length})
                    </button>
                </div>

                {/* TAB 1: Monthly Attendance Ledger Table */}
                {activeTab === 'timesheet' && (
                    <div className="bg-slate-900/90 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs text-slate-300">
                                <thead className="bg-slate-950/70 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800">
                                    <tr>
                                        <th className="py-3 px-4">Date</th>
                                        <th className="py-3 px-4">Shift</th>
                                        <th className="py-3 px-4">Check In</th>
                                        <th className="py-3 px-4">Check Out</th>
                                        <th className="py-3 px-4">Hours</th>
                                        <th className="py-3 px-4">Late / Early</th>
                                        <th className="py-3 px-4">Overtime</th>
                                        <th className="py-3 px-4">Status</th>
                                        <th className="py-3 px-4 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/60">
                                    {records.length > 0 ? (
                                        records.map((r) => {
                                            const isAnomaly =
                                                r.status === 'absent' ||
                                                r.status === 'half_day' ||
                                                (!r.check_out && r.check_in) ||
                                                (r.status === 'present' && !r.check_in);

                                            return (
                                                <tr
                                                    key={r.id}
                                                    className="hover:bg-slate-800/40 transition duration-150"
                                                >
                                                    <td className="py-3 px-4 font-mono font-semibold text-white">
                                                        {r.attendance_date}
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        {r.shift ? (
                                                            <span className="px-2 py-0.5 rounded font-mono text-[10px] font-bold bg-slate-800 text-slate-300">
                                                                {r.shift.code}
                                                            </span>
                                                        ) : (
                                                            <span className="text-slate-500">—</span>
                                                        )}
                                                    </td>
                                                    <td className="py-3 px-4 font-mono">
                                                        {r.check_in ? (
                                                            <span className="text-emerald-400 font-bold">{r.check_in.slice(11, 16)}</span>
                                                        ) : (
                                                            <span className="text-slate-600">--:--</span>
                                                        )}
                                                    </td>
                                                    <td className="py-3 px-4 font-mono">
                                                        {r.check_out ? (
                                                            <span className="text-emerald-400 font-bold">{r.check_out.slice(11, 16)}</span>
                                                        ) : (
                                                            <span className="text-slate-600">--:--</span>
                                                        )}
                                                    </td>
                                                    <td className="py-3 px-4 font-mono font-semibold text-white">
                                                        {r.worked_hours.toFixed(1)}h
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        {r.late_minutes > 0 ? (
                                                            <span className="text-amber-400 font-bold">
                                                                +{r.late_minutes}m
                                                            </span>
                                                        ) : (
                                                            <span className="text-slate-600">0m</span>
                                                        )}
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        {r.approved_ot_hours > 0 ? (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                                                {r.approved_ot_hours.toFixed(1)}h (Approved)
                                                            </span>
                                                        ) : r.ot_hours > 0 ? (
                                                            <span className="text-slate-400 text-[10px] font-mono">
                                                                {r.ot_hours.toFixed(1)}h (Pending)
                                                            </span>
                                                        ) : (
                                                            <span className="text-slate-600">0h</span>
                                                        )}
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        {getStatusBadge(r.status, r.is_paid)}
                                                    </td>
                                                    <td className="py-3 px-4 text-right">
                                                        {isAnomaly && (
                                                            <button
                                                                type="button"
                                                                onClick={() => openRegularizeForDate(r.attendance_date, r.check_in, r.check_out)}
                                                                className="px-2.5 py-1 rounded-xl text-[10px] font-bold text-indigo-400 hover:text-white bg-indigo-600/10 hover:bg-indigo-600 border border-indigo-500/20 transition"
                                                            >
                                                                Regularize
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    ) : (
                                        <tr>
                                            <td colSpan={9} className="py-12 text-center text-slate-500">
                                                No attendance logs recorded for this period.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* TAB 2: My Regularizations History Table */}
                {activeTab === 'regularizations' && (
                    <div className="bg-slate-900/90 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs text-slate-300">
                                <thead className="bg-slate-950/70 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800">
                                    <tr>
                                        <th className="py-3 px-4">Date</th>
                                        <th className="py-3 px-4">Claim Type</th>
                                        <th className="py-3 px-4">Requested Punch</th>
                                        <th className="py-3 px-4">Reason / Notes</th>
                                        <th className="py-3 px-4">Status Stage</th>
                                        <th className="py-3 px-4">Reviewer Remarks</th>
                                        <th className="py-3 px-4">Submitted</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/60">
                                    {regularizations.length > 0 ? (
                                        regularizations.map((reg) => (
                                            <tr key={reg.id} className="hover:bg-slate-800/40 transition">
                                                <td className="py-3 px-4 font-mono font-bold text-white">
                                                    {reg.attendance_date}
                                                </td>
                                                <td className="py-3 px-4">
                                                    <span className="px-2 py-0.5 rounded font-mono text-[10px] font-bold bg-slate-800 text-indigo-300 uppercase">
                                                        {reg.request_type.replace('_', ' ')}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4 font-mono text-emerald-400">
                                                    {reg.requested_check_in ?? '--:--'} → {reg.requested_check_out ?? '--:--'}
                                                </td>
                                                <td className="py-3 px-4 max-w-xs truncate text-slate-300">
                                                    {reg.reason}
                                                </td>
                                                <td className="py-3 px-4">
                                                    {getRegStatusBadge(reg.status)}
                                                </td>
                                                <td className="py-3 px-4 text-slate-400 max-w-xs truncate">
                                                    {reg.hod_remarks || reg.rejection_reason || '—'}
                                                </td>
                                                <td className="py-3 px-4 text-slate-500 text-[10px]">
                                                    {reg.created_at}
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={7} className="py-12 text-center text-slate-500">
                                                You have not submitted any attendance regularization requests.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Regularization Submission Modal */}
                {regularizeModalOpen && (
                    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                        <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
                            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-10 h-10 rounded-2xl bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center font-bold">
                                        <Plus className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-bold text-white">Submit Attendance Regularization</h3>
                                        <p className="text-xs text-slate-400">Request punch adjustments, OD passes, or OT claims</p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setRegularizeModalOpen(false)}
                                    className="p-1 rounded-lg text-slate-400 hover:text-white"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            <form onSubmit={handleRegularizeSubmit} className="space-y-4 text-xs">
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <label className="font-semibold text-slate-300">Target Date</label>
                                        <input
                                            type="date"
                                            value={formDate}
                                            onChange={(e) => setFormDate(e.target.value)}
                                            required
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-indigo-500"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="font-semibold text-slate-300">Adjustment Type</label>
                                        <select
                                            value={formType}
                                            onChange={(e) => setFormType(e.target.value)}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                                        >
                                            <option value="missing_punch">Missing Biometric Punch</option>
                                            <option value="unapproved_half_day">Unapproved Half Day Waiver</option>
                                            <option value="on_duty_gate_pass">On-Duty / Gate Pass Outstation</option>
                                            <option value="overtime_claim">Overtime Hours Claim</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <label className="font-semibold text-slate-300">Actual Check-In Time</label>
                                        <input
                                            type="time"
                                            value={formCheckIn}
                                            onChange={(e) => setFormCheckIn(e.target.value)}
                                            required
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-indigo-500"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="font-semibold text-slate-300">Actual Check-Out Time</label>
                                        <input
                                            type="time"
                                            value={formCheckOut}
                                            onChange={(e) => setFormCheckOut(e.target.value)}
                                            required
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-indigo-500"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <label className="font-semibold text-slate-300">Reason / Justification</label>
                                    <textarea
                                        value={formReason}
                                        onChange={(e) => setFormReason(e.target.value)}
                                        rows={3}
                                        required
                                        placeholder="Please provide complete context (e.g. biometric reader failed, off-site client deployment)..."
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:outline-none focus:border-indigo-500 placeholder-slate-500"
                                    />
                                </div>

                                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 text-[11px] text-slate-400 space-y-1">
                                    <div className="flex items-center gap-1.5 text-indigo-400 font-bold">
                                        <Info className="w-3.5 h-3.5" />
                                        Approval Workflow
                                    </div>
                                    <p>
                                        This request will be routed to your Department Head (HOD) for Stage 1 recommendation, and subsequently confirmed by HR. Upon final approval, your daily attendance record and paid status will automatically be synchronized.
                                    </p>
                                </div>

                                <div className="flex items-center justify-end gap-2 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setRegularizeModalOpen(false)}
                                        className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-slate-800"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={submitting}
                                        className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-600/30 transition flex items-center gap-1.5 disabled:opacity-50"
                                    >
                                        <Send className="w-3.5 h-3.5" />
                                        {submitting ? 'Submitting...' : 'Submit Claim'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </AuthenticatedLayout>
    );
}
