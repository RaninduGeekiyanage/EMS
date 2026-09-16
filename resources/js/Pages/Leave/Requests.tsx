import React, { useState, useMemo } from 'react';
import { Head, useForm, router } from '@inertiajs/react';
import {
    Calendar as CalendarIcon,
    Clock,
    UserCheck,
    UserX,
    AlertCircle,
    CheckCircle2,
    XCircle,
    Sliders,
    Search,
    ChevronLeft,
    ChevronRight,
    RefreshCw,
    Sparkles,
    Briefcase,
    Fingerprint,
    Calendar,
    Plus,
    FileText,
    Check,
    X,
    ShieldAlert,
    Info,
    Layers,
    User,
    Award,
    HeartHandshake,
    AlertTriangle,
} from 'lucide-react';

interface Employee {
    id: string;
    emp_no: string;
    full_name: string;
    date_of_joining?: string | null;
    department?: {
        id: string;
        name: string;
    } | null;
}

interface LeaveType {
    id: string;
    name: string;
    code: string;
    days_per_year: number;
    is_paid: boolean;
    carry_forward_allowed: boolean;
    color?: string | null;
    description?: string | null;
}

interface LeaveEntitlement {
    id: string;
    employee_id: string;
    leave_type_id: string;
    year: number;
    allocated_days: number;
    used_days: number;
    pending_days: number;
    carried_forward_days: number;
    remaining_days: number;
    total_entitled_days: number;
    employee?: {
        id: string;
        emp_no: string;
        full_name: string;
    };
    leaveType?: {
        id: string;
        name: string;
        code: string;
        color?: string | null;
    };
}

interface LeaveRequestItem {
    id: string;
    tenant_id: string;
    employee_id: string;
    leave_type_id: string;
    start_date: string;
    end_date: string;
    days_count: number;
    is_half_day: boolean;
    half_day_type?: string | null;
    reason: string;
    status: 'pending' | 'approved' | 'rejected' | 'cancelled';
    actioned_at?: string | null;
    rejection_reason?: string | null;
    created_at: string;
    employee?: Employee;
    leave_type?: LeaveType;
    actioned_by?: {
        id: number;
        name: string;
    } | null;
}

interface PaginatedData<T> {
    data: T[];
    current_page: number;
    last_page: number;
    total: number;
    from: number;
    to: number;
    links: Array<{ url: string | null; label: string; active: boolean }>;
}

interface Props {
    requests: PaginatedData<LeaveRequestItem>;
    leaveTypes: LeaveType[];
    employees: Employee[];
    entitlements: LeaveEntitlement[];
    metrics: {
        pending_count: number;
        approved_count: number;
        rejected_count: number;
        on_leave_today: number;
    };
    filters: {
        year: number;
        status: string;
        employee_id?: string | null;
        leave_type_id?: string | null;
        search?: string | null;
    };
}

export default function LeaveRequestsIndex({
    requests,
    leaveTypes,
    employees,
    entitlements,
    metrics,
    filters,
}: Props) {
    const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
    const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
    const [isEntitlementsModalOpen, setIsEntitlementsModalOpen] = useState(false);
    const [rejectTargetId, setRejectTargetId] = useState<string | null>(null);
    const [entitlementFilterEmp, setEntitlementFilterEmp] = useState<string>('');

    // Apply Leave Form
    const applyForm = useForm({
        employee_id: '',
        leave_type_id: leaveTypes[0]?.id || '',
        start_date: new Date().toISOString().split('T')[0],
        end_date: new Date().toISOString().split('T')[0],
        is_half_day: false,
        half_day_type: 'first_half',
        reason: '',
    });

    // Reject Form
    const rejectForm = useForm({
        rejection_reason: '',
    });

    // Entitlement Allocate Form
    const allocateForm = useForm({
        year: filters.year || new Date().getFullYear(),
        employee_id: '',
    });

    // Calculate selected employee balance for the chosen leave type in Apply Modal
    const activeBalance = useMemo(() => {
        if (!applyForm.data.employee_id || !applyForm.data.leave_type_id) return null;
        const match = entitlements.find(
            (e) =>
                e.employee_id === applyForm.data.employee_id &&
                e.leave_type_id === applyForm.data.leave_type_id
        );
        return match ? match.remaining_days : null;
    }, [applyForm.data.employee_id, applyForm.data.leave_type_id, entitlements]);

    const handleFilterChange = (key: string, value: any) => {
        router.get(
            '/leave/requests',
            {
                ...filters,
                [key]: value,
            },
            {
                preserveState: true,
                preserveScroll: true,
            }
        );
    };

    const handleApplySubmit = (e: React.FormEvent) => {
        e.preventDefault();
        applyForm.post('/leave/requests', {
            onSuccess: () => {
                setIsApplyModalOpen(false);
                applyForm.reset();
            },
        });
    };

    const handleApprove = (id: string) => {
        router.post(`/leave/requests/${id}/approve`);
    };

    const openRejectModal = (id: string) => {
        setRejectTargetId(id);
        rejectForm.reset();
        setIsRejectModalOpen(true);
    };

    const handleRejectSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!rejectTargetId) return;

        rejectForm.post(`/leave/requests/${rejectTargetId}/reject`, {
            onSuccess: () => {
                setIsRejectModalOpen(false);
                setRejectTargetId(null);
                rejectForm.reset();
            },
        });
    };

    const handleCancel = (id: string) => {
        router.delete(`/leave/requests/${id}`);
    };

    const handleSeedStatutory = () => {
        router.post('/leave/types/seed-statutory');
    };

    const handleAllocateSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        allocateForm.post('/leave/entitlements/allocate', {
            onSuccess: () => {
                // Keep modal open so user can inspect updated balances
            },
        });
    };

    const getStatusBadge = (status: LeaveRequestItem['status']) => {
        switch (status) {
            case 'approved':
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Approved
                    </span>
                );
            case 'pending':
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        <Clock className="w-3.5 h-3.5" />
                        Pending Approval
                    </span>
                );
            case 'rejected':
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                        <XCircle className="w-3.5 h-3.5" />
                        Rejected
                    </span>
                );
            case 'cancelled':
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                        Cancelled
                    </span>
                );
            default:
                return null;
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100">
            <Head title="Leave Management & Requests — EMS" />

            {/* Navigation Header */}
            <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md sticky top-0 z-30">
                <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                            <HeartHandshake className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h1 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                                Leave Management
                                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
                                    M02 · AMS
                                </span>
                            </h1>
                            <p className="text-xs text-slate-400">
                                Statutory Entitlements, Proration & Managerial Approvals
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2.5">
                        <a
                            href="/shifts"
                            className="text-xs font-medium text-slate-300 hover:text-white px-3 py-1.5 rounded-lg border border-slate-800 hover:border-slate-700 bg-slate-900/60 transition flex items-center gap-1.5"
                        >
                            <Briefcase className="w-3.5 h-3.5 text-indigo-400" />
                            Shifts
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
                            href="/attendance/daily"
                            className="text-xs font-medium text-slate-300 hover:text-white px-3 py-1.5 rounded-lg border border-slate-800 hover:border-slate-700 bg-slate-900/60 transition flex items-center gap-1.5"
                        >
                            <Clock className="w-3.5 h-3.5 text-purple-400" />
                            Daily Ledger
                        </a>
                        <button
                            type="button"
                            onClick={() => setIsEntitlementsModalOpen(true)}
                            className="text-xs font-medium text-slate-200 hover:text-white px-3 py-1.5 rounded-lg border border-emerald-500/30 bg-emerald-950/40 hover:bg-emerald-900/40 transition flex items-center gap-1.5"
                        >
                            <Layers className="w-3.5 h-3.5 text-emerald-400" />
                            Entitlement Matrix
                        </button>
                        <button
                            type="button"
                            onClick={() => setIsApplyModalOpen(true)}
                            className="text-xs font-semibold text-white px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 shadow-md shadow-emerald-600/20 transition flex items-center gap-1.5"
                        >
                            <Plus className="w-3.5 h-3.5" />
                            Apply Leave
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-6 pt-8 pb-16 space-y-8">
                {/* Metric Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800/80 backdrop-blur-sm relative overflow-hidden group">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-slate-400">Pending Approvals</span>
                            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                <Clock className="w-4 h-4" />
                            </div>
                        </div>
                        <div className="mt-3 flex items-baseline gap-2">
                            <span className="text-3xl font-bold font-mono text-amber-400">
                                {metrics.pending_count}
                            </span>
                            <span className="text-xs text-slate-500">requests</span>
                        </div>
                        <p className="mt-1 text-[11px] text-slate-400">
                            Awaiting managerial sign-off
                        </p>
                    </div>

                    <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800/80 backdrop-blur-sm relative overflow-hidden group">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-slate-400">Approved Leaves</span>
                            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                <CheckCircle2 className="w-4 h-4" />
                            </div>
                        </div>
                        <div className="mt-3 flex items-baseline gap-2">
                            <span className="text-3xl font-bold font-mono text-emerald-400">
                                {metrics.approved_count}
                            </span>
                            <span className="text-xs text-slate-500">granted</span>
                        </div>
                        <p className="mt-1 text-[11px] text-slate-400">
                            Synchronized with Daily Ledger
                        </p>
                    </div>

                    <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800/80 backdrop-blur-sm relative overflow-hidden group">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-slate-400">On Leave Today</span>
                            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                                <CalendarIcon className="w-4 h-4" />
                            </div>
                        </div>
                        <div className="mt-3 flex items-baseline gap-2">
                            <span className="text-3xl font-bold font-mono text-indigo-400">
                                {metrics.on_leave_today}
                            </span>
                            <span className="text-xs text-slate-500">employees</span>
                        </div>
                        <p className="mt-1 text-[11px] text-slate-400">
                            Active today in Sri Lanka
                        </p>
                    </div>

                    <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800/80 backdrop-blur-sm relative overflow-hidden group">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-slate-400">Rejected Requests</span>
                            <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                <XCircle className="w-4 h-4" />
                            </div>
                        </div>
                        <div className="mt-3 flex items-baseline gap-2">
                            <span className="text-3xl font-bold font-mono text-rose-400">
                                {metrics.rejected_count}
                            </span>
                            <span className="text-xs text-slate-500">declined</span>
                        </div>
                        <p className="mt-1 text-[11px] text-slate-400">
                            With audit justification
                        </p>
                    </div>
                </div>

                {/* Filter and Search Bar */}
                <div className="p-4 md:p-6 rounded-3xl bg-slate-900/70 border border-slate-800/80 backdrop-blur-sm flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                        <div className="bg-slate-950 p-1 rounded-xl border border-slate-800 flex items-center gap-1">
                            {['all', 'pending', 'approved', 'rejected'].map((st) => (
                                <button
                                    key={st}
                                    type="button"
                                    onClick={() => handleFilterChange('status', st)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition ${
                                        filters.status === st
                                            ? 'bg-emerald-600 text-white shadow-sm'
                                            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                                    }`}
                                >
                                    {st === 'all' ? 'All Statuses' : st}
                                </button>
                            ))}
                        </div>

                        <select
                            value={filters.leave_type_id || ''}
                            onChange={(e) => handleFilterChange('leave_type_id', e.target.value)}
                            className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-emerald-500"
                        >
                            <option value="">All Leave Types</option>
                            {leaveTypes.map((t) => (
                                <option key={t.id} value={t.id}>
                                    {t.name} ({t.code})
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <div className="relative flex-1 md:w-64">
                            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                            <input
                                type="text"
                                placeholder="Search employee or reason..."
                                defaultValue={filters.search || ''}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        handleFilterChange('search', (e.target as HTMLInputElement).value);
                                    }
                                }}
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                            />
                        </div>

                        <button
                            type="button"
                            onClick={handleSeedStatutory}
                            className="text-xs font-medium text-slate-300 hover:text-white px-3 py-2 rounded-xl border border-slate-800 hover:border-slate-700 bg-slate-950 transition flex items-center gap-1.5 whitespace-nowrap"
                            title="Seed Sri Lankan Statutory Leave Presets"
                        >
                            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                            Seed Presets
                        </button>
                    </div>
                </div>

                {/* Main Leave Requests Table */}
                <div className="rounded-3xl bg-slate-900/70 border border-slate-800/80 backdrop-blur-sm overflow-hidden shadow-xl">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs text-slate-300">
                            <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                                <tr>
                                    <th className="px-6 py-4">Employee</th>
                                    <th className="px-6 py-4">Leave Type</th>
                                    <th className="px-6 py-4">Duration & Dates</th>
                                    <th className="px-6 py-4">Reason</th>
                                    <th className="px-6 py-4">Status</th>
                                    <th className="px-6 py-4">Decision / Log</th>
                                    <th className="px-6 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/60 font-sans">
                                {requests.data.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-16 text-center text-slate-500">
                                            <HeartHandshake className="w-10 h-10 mx-auto mb-3 opacity-30 text-emerald-400" />
                                            <p className="text-sm font-medium text-slate-400">No leave requests found</p>
                                            <p className="text-xs mt-1">
                                                Click "+ Apply Leave" or adjust filter criteria above.
                                            </p>
                                        </td>
                                    </tr>
                                ) : (
                                    requests.data.map((req) => (
                                        <tr key={req.id} className="hover:bg-slate-800/40 transition">
                                            {/* Employee */}
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-slate-200">
                                                        {req.employee?.full_name?.charAt(0) || 'E'}
                                                    </div>
                                                    <div>
                                                        <div className="font-semibold text-white">
                                                            {req.employee?.full_name || 'N/A'}
                                                        </div>
                                                        <div className="text-[11px] font-mono text-slate-400">
                                                            {req.employee?.emp_no} · {req.employee?.department?.name || 'General'}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Leave Type */}
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <span
                                                        className="w-2.5 h-2.5 rounded-full shrink-0"
                                                        style={{ backgroundColor: req.leave_type?.color || '#10b981' }}
                                                    />
                                                    <span className="font-medium text-white">
                                                        {req.leave_type?.name}
                                                    </span>
                                                </div>
                                                <span className="text-[10px] uppercase font-mono text-slate-400">
                                                    {req.leave_type?.code} · {req.leave_type?.is_paid ? 'Paid' : 'Unpaid (No-Pay)'}
                                                </span>
                                            </td>

                                            {/* Duration & Dates */}
                                            <td className="px-6 py-4">
                                                <div className="font-mono text-slate-200 font-semibold">
                                                    {req.start_date} {req.start_date !== req.end_date && `→ ${req.end_date}`}
                                                </div>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <span className="text-xs font-bold text-emerald-400">
                                                        {req.days_count} {req.days_count === 1 ? 'day' : 'days'}
                                                    </span>
                                                    {req.is_half_day && (
                                                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 font-mono">
                                                            Half-Day ({req.half_day_type === 'first_half' ? '1st Half' : '2nd Half'})
                                                        </span>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Reason */}
                                            <td className="px-6 py-4 max-w-xs">
                                                <p className="text-xs text-slate-300 line-clamp-2" title={req.reason}>
                                                    {req.reason}
                                                </p>
                                            </td>

                                            {/* Status */}
                                            <td className="px-6 py-4">
                                                {getStatusBadge(req.status)}
                                            </td>

                                            {/* Decision Log */}
                                            <td className="px-6 py-4">
                                                {req.actioned_by ? (
                                                    <div>
                                                        <div className="text-xs text-slate-300 font-medium">
                                                            {req.actioned_by.name}
                                                        </div>
                                                        <div className="text-[10px] text-slate-500">
                                                            {req.actioned_at ? new Date(req.actioned_at).toLocaleDateString() : ''}
                                                        </div>
                                                        {req.rejection_reason && (
                                                            <p className="text-[11px] text-rose-400 mt-1 italic line-clamp-1" title={req.rejection_reason}>
                                                                "{req.rejection_reason}"
                                                            </p>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="text-[11px] text-slate-500 italic">Pending</span>
                                                )}
                                            </td>

                                            {/* Actions */}
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    {req.status === 'pending' && (
                                                        <>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleApprove(req.id)}
                                                                className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs shadow-sm transition flex items-center gap-1"
                                                                title="Approve Leave"
                                                            >
                                                                <Check className="w-3.5 h-3.5" />
                                                                Approve
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => openRejectModal(req.id)}
                                                                className="px-2.5 py-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 font-medium text-xs transition flex items-center gap-1"
                                                                title="Reject Leave"
                                                            >
                                                                <X className="w-3.5 h-3.5" />
                                                                Reject
                                                            </button>
                                                        </>
                                                    )}
                                                    {['pending', 'approved'].includes(req.status) && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleCancel(req.id)}
                                                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
                                                            title="Cancel Request"
                                                        >
                                                            <XCircle className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>

            {/* Apply Leave Modal */}
            {isApplyModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-lg w-full shadow-2xl relative">
                        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                    <Plus className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-white">Apply for Leave</h3>
                                    <p className="text-xs text-slate-400">
                                        Sri Lankan Statutory Leave Booking Form
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsApplyModalOpen(false)}
                                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <form onSubmit={handleApplySubmit} className="mt-5 space-y-4">
                            {/* Employee */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1">
                                    Employee <span className="text-rose-400">*</span>
                                </label>
                                <select
                                    value={applyForm.data.employee_id}
                                    onChange={(e) => applyForm.setData('employee_id', e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                                    required
                                >
                                    <option value="">Select Employee</option>
                                    {employees.map((emp) => (
                                        <option key={emp.id} value={emp.id}>
                                            {emp.full_name} ({emp.emp_no}) · {emp.department?.name || 'General'}
                                        </option>
                                    ))}
                                </select>
                                {applyForm.errors.employee_id && (
                                    <p className="text-xs text-rose-400 mt-1">{applyForm.errors.employee_id}</p>
                                )}
                            </div>

                            {/* Leave Type */}
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="text-xs font-semibold text-slate-300">
                                        Leave Type <span className="text-rose-400">*</span>
                                    </label>
                                    {activeBalance !== null && (
                                        <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                                            Balance: {activeBalance} days remaining
                                        </span>
                                    )}
                                </div>
                                <select
                                    value={applyForm.data.leave_type_id}
                                    onChange={(e) => applyForm.setData('leave_type_id', e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                                    required
                                >
                                    {leaveTypes.map((t) => (
                                        <option key={t.id} value={t.id}>
                                            {t.name} ({t.code}) — {t.is_paid ? 'Paid' : 'Unpaid'}
                                        </option>
                                    ))}
                                </select>
                                {applyForm.errors.leave_type_id && (
                                    <p className="text-xs text-rose-400 mt-1">{applyForm.errors.leave_type_id}</p>
                                )}
                            </div>

                            {/* Dates */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                                        Start Date <span className="text-rose-400">*</span>
                                    </label>
                                    <input
                                        type="date"
                                        value={applyForm.data.start_date}
                                        onChange={(e) => applyForm.setData('start_date', e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                                        required
                                    />
                                    {applyForm.errors.start_date && (
                                        <p className="text-xs text-rose-400 mt-1">{applyForm.errors.start_date}</p>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                                        End Date <span className="text-rose-400">*</span>
                                    </label>
                                    <input
                                        type="date"
                                        value={applyForm.data.end_date}
                                        onChange={(e) => applyForm.setData('end_date', e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                                        required
                                    />
                                    {applyForm.errors.end_date && (
                                        <p className="text-xs text-rose-400 mt-1">{applyForm.errors.end_date}</p>
                                    )}
                                </div>
                            </div>

                            {/* Half Day Option */}
                            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-300">
                                    <input
                                        type="checkbox"
                                        checked={applyForm.data.is_half_day}
                                        onChange={(e) => applyForm.setData('is_half_day', e.target.checked)}
                                        className="rounded bg-slate-900 border-slate-700 text-emerald-500 focus:ring-0"
                                    />
                                    Apply as Half-Day Leave (0.5 days)
                                </label>

                                {applyForm.data.is_half_day && (
                                    <div className="flex items-center gap-4 pt-1 pl-5">
                                        <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer">
                                            <input
                                                type="radio"
                                                name="half_day_type"
                                                value="first_half"
                                                checked={applyForm.data.half_day_type === 'first_half'}
                                                onChange={(e) => applyForm.setData('half_day_type', e.target.value)}
                                                className="text-emerald-500 focus:ring-0"
                                            />
                                            First Half (Morning)
                                        </label>
                                        <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer">
                                            <input
                                                type="radio"
                                                name="half_day_type"
                                                value="second_half"
                                                checked={applyForm.data.half_day_type === 'second_half'}
                                                onChange={(e) => applyForm.setData('half_day_type', e.target.value)}
                                                className="text-emerald-500 focus:ring-0"
                                            />
                                            Second Half (Afternoon)
                                        </label>
                                    </div>
                                )}
                            </div>

                            {/* Reason */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1">
                                    Reason / Notes <span className="text-rose-400">*</span>
                                </label>
                                <textarea
                                    rows={3}
                                    value={applyForm.data.reason}
                                    onChange={(e) => applyForm.setData('reason', e.target.value)}
                                    placeholder="State the reason for this leave request..."
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 resize-none"
                                    required
                                />
                                {applyForm.errors.reason && (
                                    <p className="text-xs text-rose-400 mt-1">{applyForm.errors.reason}</p>
                                )}
                            </div>

                            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                                <button
                                    type="button"
                                    onClick={() => setIsApplyModalOpen(false)}
                                    className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={applyForm.processing}
                                    className="px-5 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20 transition disabled:opacity-50"
                                >
                                    {applyForm.processing ? 'Submitting...' : 'Submit Application'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Reject Modal */}
            {isRejectModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl">
                        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                    <XCircle className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-white">Reject Leave Request</h3>
                                    <p className="text-xs text-slate-400">
                                        Mandatory justification for audit trail
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsRejectModalOpen(false)}
                                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <form onSubmit={handleRejectSubmit} className="mt-5 space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1">
                                    Rejection Reason <span className="text-rose-400">*</span>
                                </label>
                                <textarea
                                    rows={3}
                                    value={rejectForm.data.rejection_reason}
                                    onChange={(e) => rejectForm.setData('rejection_reason', e.target.value)}
                                    placeholder="Provide detailed justification for rejecting this request..."
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500 resize-none"
                                    required
                                />
                                {rejectForm.errors.rejection_reason && (
                                    <p className="text-xs text-rose-400 mt-1">{rejectForm.errors.rejection_reason}</p>
                                )}
                            </div>

                            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                                <button
                                    type="button"
                                    onClick={() => setIsRejectModalOpen(false)}
                                    className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition"
                                >
                                    Back
                                </button>
                                <button
                                    type="submit"
                                    disabled={rejectForm.processing}
                                    className="px-5 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/20 transition disabled:opacity-50"
                                >
                                    {rejectForm.processing ? 'Rejecting...' : 'Confirm Rejection'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Entitlement Matrix Modal */}
            {isEntitlementsModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-4xl w-full max-h-[85vh] flex flex-col shadow-2xl">
                        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                    <Layers className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-white">
                                        Annual Entitlement Balance Matrix ({filters.year})
                                    </h3>
                                    <p className="text-xs text-slate-400">
                                        Statutory allocations, mid-year proration & remaining balances
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsEntitlementsModalOpen(false)}
                                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Top Bar for Allocation */}
                        <div className="my-4 p-4 rounded-2xl bg-slate-950 border border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3">
                            <form onSubmit={handleAllocateSubmit} className="flex items-center gap-3 w-full sm:w-auto">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-slate-400 font-medium">Year:</span>
                                    <input
                                        type="number"
                                        value={allocateForm.data.year}
                                        onChange={(e) => allocateForm.setData('year', parseInt(e.target.value, 10))}
                                        className="w-20 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono font-bold focus:outline-none"
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={allocateForm.processing}
                                    className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition disabled:opacity-50 flex items-center gap-1.5"
                                >
                                    <RefreshCw className={`w-3.5 h-3.5 ${allocateForm.processing ? 'animate-spin' : ''}`} />
                                    Allocate Quotas for Year
                                </button>
                            </form>

                            <div className="relative w-full sm:w-64">
                                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                                <input
                                    type="text"
                                    placeholder="Filter by employee name..."
                                    value={entitlementFilterEmp}
                                    onChange={(e) => setEntitlementFilterEmp(e.target.value)}
                                    className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                                />
                            </div>
                        </div>

                        {/* Entitlements Table */}
                        <div className="flex-1 overflow-y-auto rounded-2xl border border-slate-800">
                            <table className="w-full text-left text-xs text-slate-300">
                                <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider font-semibold sticky top-0 border-b border-slate-800">
                                    <tr>
                                        <th className="px-4 py-3">Employee</th>
                                        <th className="px-4 py-3">Leave Type</th>
                                        <th className="px-4 py-3 text-center">Allocated</th>
                                        <th className="px-4 py-3 text-center">Carried Over</th>
                                        <th className="px-4 py-3 text-center">Used</th>
                                        <th className="px-4 py-3 text-center">Pending</th>
                                        <th className="px-4 py-3 text-right">Remaining Balance</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/60 font-mono">
                                    {entitlements
                                        .filter((ent) => {
                                            if (!entitlementFilterEmp) return true;
                                            const name = ent.employee?.full_name?.toLowerCase() || '';
                                            const empNo = ent.employee?.emp_no?.toLowerCase() || '';
                                            return name.includes(entitlementFilterEmp.toLowerCase()) || empNo.includes(entitlementFilterEmp.toLowerCase());
                                        })
                                        .map((ent) => (
                                            <tr key={ent.id} className="hover:bg-slate-800/40 transition">
                                                <td className="px-4 py-3 font-sans">
                                                    <div className="font-semibold text-white">
                                                        {ent.employee?.full_name}
                                                    </div>
                                                    <div className="text-[11px] text-slate-400 font-mono">
                                                        {ent.employee?.emp_no}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 font-sans">
                                                    <div className="flex items-center gap-1.5">
                                                        <span
                                                            className="w-2 h-2 rounded-full shrink-0"
                                                            style={{ backgroundColor: ent.leaveType?.color || '#10b981' }}
                                                        />
                                                        <span className="font-medium text-white">
                                                            {ent.leaveType?.name}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-center font-bold text-slate-200">
                                                    {ent.allocated_days}d
                                                </td>
                                                <td className="px-4 py-3 text-center text-slate-400">
                                                    {ent.carried_forward_days}d
                                                </td>
                                                <td className="px-4 py-3 text-center text-rose-400 font-bold">
                                                    {ent.used_days}d
                                                </td>
                                                <td className="px-4 py-3 text-center text-amber-400">
                                                    {ent.pending_days}d
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <span className="inline-block px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold text-xs">
                                                        {ent.remaining_days} days
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    {entitlements.length === 0 && (
                                        <tr>
                                            <td colSpan={7} className="px-4 py-10 text-center text-slate-500 font-sans">
                                                No entitlements configured for {filters.year}. Click "Allocate Quotas for Year" above.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        <div className="pt-4 mt-4 border-t border-slate-800 flex justify-end">
                            <button
                                type="button"
                                onClick={() => setIsEntitlementsModalOpen(false)}
                                className="px-5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white transition"
                            >
                                Close Matrix
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
