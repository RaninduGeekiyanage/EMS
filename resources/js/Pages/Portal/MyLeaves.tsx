import React, { useState, useMemo } from 'react';
import { Head, router, usePage } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import {
    Palmtree,
    Calendar,
    Clock,
    Plus,
    CheckCircle2,
    AlertTriangle,
    XCircle,
    UserCheck,
    Send,
    X,
    Info,
    CalendarDays,
    Trash2,
    Sparkles,
    ShieldAlert,
    Check,
} from 'lucide-react';

interface EntitlementItem {
    id: string;
    type_name: string;
    type_code: string;
    allocated_days: number;
    used_days: number;
    remaining_days: number;
}

interface LeaveRequestItem {
    id: string;
    leave_type_name: string;
    leave_type_code: string;
    start_date: string;
    end_date: string;
    days_count: number;
    is_half_day: boolean;
    half_day_type: string | null;
    is_short_leave: boolean;
    short_leave_from: string | null;
    short_leave_to: string | null;
    short_leave_duration_minutes: number | null;
    status: string;
    approval_stage: string;
    reason: string;
    covering_employee_name: string | null;
    hod_remarks: string | null;
    rejection_reason: string | null;
    created_at: string;
}

interface CoveringStaffOption {
    id: string;
    emp_no: string;
    full_name: string;
    department_id: string | null;
}

interface LeaveTypeOption {
    id: string;
    name: string;
    code: string;
    is_paid: boolean;
    requires_document: boolean;
}

interface Props {
    employee: {
        id: string;
        emp_no: string;
        full_name: string;
        department_name?: string;
    } | null;
    selectedYear: number;
    entitlements: EntitlementItem[];
    remainingShortLeaves: number;
    availableCompensatoryDays: number;
    leaveRequests: LeaveRequestItem[];
    coveringStaff: CoveringStaffOption[];
    leaveTypes: LeaveTypeOption[];
}

export default function MyLeaves({
    employee,
    selectedYear,
    entitlements,
    remainingShortLeaves,
    availableCompensatoryDays,
    leaveRequests,
    coveringStaff,
    leaveTypes,
}: Props) {
    const [applyModalOpen, setApplyModalOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [cancellingId, setCancellingId] = useState<string | null>(null);

    // Form mode: standard vs short_leave
    const [formMode, setFormMode] = useState<'standard' | 'short_leave'>('standard');
    const [formLeaveTypeId, setFormLeaveTypeId] = useState<string>(leaveTypes[0]?.id ?? '');
    const [formStartDate, setFormStartDate] = useState<string>(nowIsoDate());
    const [formEndDate, setFormEndDate] = useState<string>(nowIsoDate());
    const [formIsHalfDay, setFormIsHalfDay] = useState<boolean>(false);
    const [formHalfDayType, setFormHalfDayType] = useState<'first_half' | 'second_half'>('first_half');
    const [formCoveringStaffId, setFormCoveringStaffId] = useState<string>('');
    const [formReason, setFormReason] = useState<string>('');

    // Short leave times
    const [formShortFrom, setFormShortFrom] = useState<string>('14:00');
    const [formShortTo, setFormShortTo] = useState<string>('16:00');

    // Filter state
    const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');

    function nowIsoDate(): string {
        const d = new Date();
        return d.toISOString().split('T')[0];
    }

    // Short leave duration calculation in minutes
    const shortLeaveMinutes = useMemo(() => {
        if (!formShortFrom || !formShortTo) return 0;
        const [h1, m1] = formShortFrom.split(':').map(Number);
        const [h2, m2] = formShortTo.split(':').map(Number);
        const diff = h2 * 60 + m2 - (h1 * 60 + m1);
        return diff > 0 ? diff : 0;
    }, [formShortFrom, formShortTo]);

    const filteredRequests = useMemo(() => {
        if (statusFilter === 'all') return leaveRequests;
        if (statusFilter === 'pending') {
            return leaveRequests.filter((r) => r.status === 'pending' || r.status.includes('pending'));
        }
        return leaveRequests.filter((r) => r.status === statusFilter);
    }, [leaveRequests, statusFilter]);

    const handleApplySubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);

        const payload: Record<string, any> = {
            reason: formReason,
            covering_employee_id: formCoveringStaffId || null,
        };

        if (formMode === 'short_leave') {
            payload.is_short_leave = true;
            payload.start_date = formStartDate;
            payload.end_date = formStartDate;
            payload.short_leave_from = formShortFrom;
            payload.short_leave_to = formShortTo;
            payload.leave_type_id = formLeaveTypeId || (leaveTypes[0]?.id ?? null);
        } else {
            payload.is_short_leave = false;
            payload.leave_type_id = formLeaveTypeId;
            payload.start_date = formStartDate;
            payload.end_date = formIsHalfDay ? formStartDate : formEndDate;
            payload.is_half_day = formIsHalfDay;
            if (formIsHalfDay) {
                payload.half_day_type = formHalfDayType;
            }
        }

        router.post('/leave/requests', payload, {
            preserveScroll: true,
            onSuccess: () => {
                setApplyModalOpen(false);
                setFormReason('');
                setSubmitting(false);
            },
            onError: () => {
                setSubmitting(false);
            },
        });
    };

    const handleCancelRequest = (requestId: string) => {
        if (!confirm('Are you sure you want to cancel this leave application?')) return;
        setCancellingId(requestId);
        router.delete(`/leave/requests/${requestId}`, {
            preserveScroll: true,
            onFinish: () => setCancellingId(null),
        });
    };

    const getStageBadge = (stage: string, status: string) => {
        if (status === 'rejected') {
            return (
                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-red-500/10 text-red-400 border border-red-500/20">
                    Rejected
                </span>
            );
        }
        if (status === 'approved') {
            return (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <CheckCircle2 className="w-3 h-3" />
                    Approved
                </span>
            );
        }
        if (stage === 'pending_hod') {
            return (
                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    Awaiting HOD Review
                </span>
            );
        }
        if (stage === 'pending_hr') {
            return (
                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    Awaiting HR Sign-off
                </span>
            );
        }
        return (
            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400">
                {stage || status}
            </span>
        );
    };

    return (
        <AuthenticatedLayout title="My Leaves">
            <Head title="My Leaves — ESS Portal" />

            <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
                {/* Notice if no employee record linked */}
                {!employee && (
                    <div className="bg-amber-950/30 border border-amber-500/40 rounded-2xl p-4 flex items-center gap-3 text-amber-300 shadow-xl">
                        <ShieldAlert className="w-5 h-5 flex-shrink-0 text-amber-400" />
                        <div className="text-xs">
                            <p className="font-bold">No Employee Master Record Linked</p>
                            <p className="text-amber-400/80">
                                Please contact HR to link your staff record so your leave entitlements can be loaded.
                            </p>
                        </div>
                    </div>
                )}

                {/* Header Profile & Apply Button */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-teal-500 via-teal-600 to-emerald-800 text-white font-black text-xl flex items-center justify-center shadow-lg shadow-teal-600/30">
                            <Palmtree className="w-7 h-7" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-teal-500/10 text-teal-400 border border-teal-500/20">
                                    Time-Off & Absence
                                </span>
                                <span className="text-xs font-mono font-bold text-slate-400">
                                    Year: {selectedYear}
                                </span>
                            </div>
                            <h1 className="text-2xl font-black text-white tracking-tight mt-0.5">
                                My Leave & Time-Off Portal
                            </h1>
                            <p className="text-xs text-slate-400 mt-0.5">
                                {employee?.full_name ?? 'Employee'} • {employee?.department_name ?? 'Team Member'}
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={() => setApplyModalOpen(true)}
                        className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl text-xs font-bold text-white bg-teal-600 hover:bg-teal-500 shadow-lg shadow-teal-600/30 transition self-start md:self-auto"
                    >
                        <Plus className="w-4 h-4" />
                        Apply for Leave / Short Leave
                    </button>
                </div>

                {/* Statutory Entitlements Cards Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
                    {/* Annual / Casual / Medical cards */}
                    {entitlements.map((ent) => (
                        <div key={ent.id} className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-lg">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 truncate">
                                    {ent.type_name}
                                </span>
                                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-bold">
                                    {ent.type_code}
                                </span>
                            </div>
                            <p className="text-2xl font-black text-white mt-2">
                                {ent.remaining_days}
                                <span className="text-xs font-normal text-slate-500 ml-1">left</span>
                            </p>
                            <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1">
                                <span>Used: {ent.used_days}d</span>
                                <span>Allocated: {ent.allocated_days}d</span>
                            </div>
                        </div>
                    ))}

                    {/* Short Leaves Month Card */}
                    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-lg">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Short Leaves</span>
                            <Clock className="w-4 h-4 text-cyan-400" />
                        </div>
                        <p className="text-2xl font-black text-cyan-300 mt-2">
                            {remainingShortLeaves}
                            <span className="text-xs font-normal text-slate-500 ml-1">/ 2 left</span>
                        </p>
                        <p className="text-[10px] text-slate-400 mt-1">Max 2h • This month quota</p>
                    </div>

                    {/* Compensatory Off Card */}
                    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-lg">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">C-Off Pool</span>
                            <Sparkles className="w-4 h-4 text-amber-400" />
                        </div>
                        <p className="text-2xl font-black text-amber-300 mt-2">
                            {availableCompensatoryDays}
                            <span className="text-xs font-normal text-slate-500 ml-1">days</span>
                        </p>
                        <p className="text-[10px] text-slate-400 mt-1">Unexpired earned off</p>
                    </div>
                </div>

                {/* Filter Bar */}
                <div className="flex items-center justify-between gap-4 border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-2">
                        {(['all', 'pending', 'approved', 'rejected'] as const).map((st) => (
                            <button
                                key={st}
                                type="button"
                                onClick={() => setStatusFilter(st)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition capitalize ${
                                    statusFilter === st
                                        ? 'bg-teal-600 text-white shadow-md shadow-teal-600/30'
                                        : 'text-slate-400 hover:text-white bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800'
                                }`}
                            >
                                {st}
                            </button>
                        ))}
                    </div>

                    <span className="text-xs text-slate-500 font-mono">
                        Showing {filteredRequests.length} applications
                    </span>
                </div>

                {/* Leave Requests Ledger */}
                <div className="bg-slate-900/90 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs text-slate-300">
                            <thead className="bg-slate-950/70 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800">
                                <tr>
                                    <th className="py-3 px-4">Leave Type</th>
                                    <th className="py-3 px-4">Date / Duration</th>
                                    <th className="py-3 px-4">Days / Timing</th>
                                    <th className="py-3 px-4">Covering Colleague</th>
                                    <th className="py-3 px-4">Reason</th>
                                    <th className="py-3 px-4">Status</th>
                                    <th className="py-3 px-4">Remarks</th>
                                    <th className="py-3 px-4 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/60">
                                {filteredRequests.length > 0 ? (
                                    filteredRequests.map((req) => (
                                        <tr key={req.id} className="hover:bg-slate-800/40 transition">
                                            <td className="py-3 px-4">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-white">{req.leave_type_name}</span>
                                                    {req.is_short_leave && (
                                                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                                                            Short Leave
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="py-3 px-4 font-mono">
                                                {req.start_date === req.end_date ? (
                                                    <span>{req.start_date}</span>
                                                ) : (
                                                    <span>{req.start_date} → {req.end_date}</span>
                                                )}
                                            </td>
                                            <td className="py-3 px-4">
                                                {req.is_short_leave ? (
                                                    <span className="text-cyan-400 font-mono font-bold">
                                                        {req.short_leave_from} - {req.short_leave_to} ({req.short_leave_duration_minutes}m)
                                                    </span>
                                                ) : req.is_half_day ? (
                                                    <span className="text-amber-400 font-semibold">
                                                        0.5 day ({req.half_day_type === 'first_half' ? 'Morning' : 'Afternoon'})
                                                    </span>
                                                ) : (
                                                    <span className="font-bold text-white font-mono">
                                                        {req.days_count} day(s)
                                                    </span>
                                                )}
                                            </td>
                                            <td className="py-3 px-4">
                                                {req.covering_employee_name ? (
                                                    <span className="text-slate-300 flex items-center gap-1.5">
                                                        <UserCheck className="w-3.5 h-3.5 text-indigo-400" />
                                                        {req.covering_employee_name}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-600">—</span>
                                                )}
                                            </td>
                                            <td className="py-3 px-4 max-w-xs truncate text-slate-300">
                                                {req.reason}
                                            </td>
                                            <td className="py-3 px-4">
                                                {getStageBadge(req.approval_stage, req.status)}
                                            </td>
                                            <td className="py-3 px-4 max-w-xs truncate text-slate-400">
                                                {req.hod_remarks || req.rejection_reason || '—'}
                                            </td>
                                            <td className="py-3 px-4 text-right">
                                                {req.status === 'pending' && (
                                                    <button
                                                        type="button"
                                                        disabled={cancellingId === req.id}
                                                        onClick={() => handleCancelRequest(req.id)}
                                                        className="p-1 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-950/30 transition"
                                                        title="Cancel Leave Application"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={8} className="py-12 text-center text-slate-500">
                                            No leave requests found for this filter.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Apply for Leave Modal */}
                {applyModalOpen && (
                    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                        <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
                            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-10 h-10 rounded-2xl bg-teal-600/10 text-teal-400 border border-teal-500/20 flex items-center justify-center font-bold">
                                        <Palmtree className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-bold text-white">Apply for Leave / Time-Off</h3>
                                        <p className="text-xs text-slate-400">Select standard leave or 2-hour short leave</p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setApplyModalOpen(false)}
                                    className="p-1 rounded-lg text-slate-400 hover:text-white"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            {/* Format Switcher */}
                            <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1 rounded-2xl border border-slate-800">
                                <button
                                    type="button"
                                    onClick={() => setFormMode('standard')}
                                    className={`py-2 rounded-xl text-xs font-bold transition ${
                                        formMode === 'standard'
                                            ? 'bg-teal-600 text-white shadow-md'
                                            : 'text-slate-400 hover:text-white'
                                    }`}
                                >
                                    Standard / Half-Day
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFormMode('short_leave')}
                                    className={`py-2 rounded-xl text-xs font-bold transition ${
                                        formMode === 'short_leave'
                                            ? 'bg-cyan-600 text-white shadow-md'
                                            : 'text-slate-400 hover:text-white'
                                    }`}
                                >
                                    Short Leave (Max 2h)
                                </button>
                            </div>

                            <form onSubmit={handleApplySubmit} className="space-y-4 text-xs">
                                {/* Mode: Short Leave */}
                                {formMode === 'short_leave' && (
                                    <div className="space-y-3 bg-cyan-950/20 border border-cyan-500/30 p-3.5 rounded-2xl">
                                        <div className="flex items-center justify-between text-cyan-300 font-bold">
                                            <span>Short Leave Allowance</span>
                                            <span>{remainingShortLeaves} / 2 remaining this month</span>
                                        </div>

                                        <div className="space-y-1">
                                            <label className="font-semibold text-slate-300">Date of Short Leave</label>
                                            <input
                                                type="date"
                                                value={formStartDate}
                                                onChange={(e) => setFormStartDate(e.target.value)}
                                                required
                                                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-cyan-500"
                                            />
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-1">
                                                <label className="font-semibold text-slate-300">Departure (From)</label>
                                                <input
                                                    type="time"
                                                    value={formShortFrom}
                                                    onChange={(e) => setFormShortFrom(e.target.value)}
                                                    required
                                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-cyan-500"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="font-semibold text-slate-300">Return (To)</label>
                                                <input
                                                    type="time"
                                                    value={formShortTo}
                                                    onChange={(e) => setFormShortTo(e.target.value)}
                                                    required
                                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-cyan-500"
                                                />
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between text-[11px] pt-1">
                                            <span className="text-slate-400">Total Duration:</span>
                                            <span
                                                className={`font-bold font-mono ${
                                                    shortLeaveMinutes > 120 || shortLeaveMinutes === 0
                                                        ? 'text-red-400'
                                                        : 'text-emerald-400'
                                                }`}
                                            >
                                                {shortLeaveMinutes} mins {shortLeaveMinutes > 120 ? '(Exceeds 2h cap!)' : '✓ Permitted'}
                                            </span>
                                        </div>
                                    </div>
                                )}

                                {/* Mode: Standard Leave */}
                                {formMode === 'standard' && (
                                    <div className="space-y-3">
                                        <div className="space-y-1">
                                            <label className="font-semibold text-slate-300">Leave Type</label>
                                            <select
                                                value={formLeaveTypeId}
                                                onChange={(e) => setFormLeaveTypeId(e.target.value)}
                                                required
                                                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-teal-500"
                                            >
                                                {leaveTypes.map((lt) => (
                                                    <option key={lt.id} value={lt.id}>
                                                        {lt.name} ({lt.code})
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="flex items-center gap-3 py-1">
                                            <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                                                <input
                                                    type="checkbox"
                                                    checked={formIsHalfDay}
                                                    onChange={(e) => setFormIsHalfDay(e.target.checked)}
                                                    className="rounded border-slate-700 text-teal-600 focus:ring-teal-500 bg-slate-950"
                                                />
                                                <span className="font-semibold">Half-Day Application</span>
                                            </label>

                                            {formIsHalfDay && (
                                                <div className="flex items-center gap-2">
                                                    <label className="flex items-center gap-1 text-[11px] text-slate-400">
                                                        <input
                                                            type="radio"
                                                            name="half_day_type"
                                                            checked={formHalfDayType === 'first_half'}
                                                            onChange={() => setFormHalfDayType('first_half')}
                                                        />
                                                        Morning
                                                    </label>
                                                    <label className="flex items-center gap-1 text-[11px] text-slate-400">
                                                        <input
                                                            type="radio"
                                                            name="half_day_type"
                                                            checked={formHalfDayType === 'second_half'}
                                                            onChange={() => setFormHalfDayType('second_half')}
                                                        />
                                                        Afternoon
                                                    </label>
                                                </div>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-1">
                                                <label className="font-semibold text-slate-300">Start Date</label>
                                                <input
                                                    type="date"
                                                    value={formStartDate}
                                                    onChange={(e) => {
                                                        setFormStartDate(e.target.value);
                                                        if (formIsHalfDay || e.target.value > formEndDate) {
                                                            setFormEndDate(e.target.value);
                                                        }
                                                    }}
                                                    required
                                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-teal-500"
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="font-semibold text-slate-300">End Date</label>
                                                <input
                                                    type="date"
                                                    value={formIsHalfDay ? formStartDate : formEndDate}
                                                    disabled={formIsHalfDay}
                                                    onChange={(e) => setFormEndDate(e.target.value)}
                                                    required
                                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-teal-500 disabled:opacity-50"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Covering Colleague */}
                                <div className="space-y-1">
                                    <label className="font-semibold text-slate-300">Designated Covering Colleague</label>
                                    <select
                                        value={formCoveringStaffId}
                                        onChange={(e) => setFormCoveringStaffId(e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-teal-500"
                                    >
                                        <option value="">-- Optional / None --</option>
                                        {coveringStaff.map((cs) => (
                                            <option key={cs.id} value={cs.id}>
                                                {cs.full_name} ({cs.emp_no})
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Reason */}
                                <div className="space-y-1">
                                    <label className="font-semibold text-slate-300">Reason / Notes</label>
                                    <textarea
                                        value={formReason}
                                        onChange={(e) => setFormReason(e.target.value)}
                                        rows={3}
                                        required
                                        placeholder="Reason for leave or duty handover notes..."
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:outline-none focus:border-teal-500 placeholder-slate-500"
                                    />
                                </div>

                                <div className="flex items-center justify-end gap-2 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setApplyModalOpen(false)}
                                        className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-slate-800"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={submitting || (formMode === 'short_leave' && (shortLeaveMinutes > 120 || shortLeaveMinutes === 0))}
                                        className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-teal-600 hover:bg-teal-500 shadow-md shadow-teal-600/30 transition flex items-center gap-1.5 disabled:opacity-50"
                                    >
                                        <Send className="w-3.5 h-3.5" />
                                        {submitting ? 'Submitting...' : 'Submit Application'}
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
