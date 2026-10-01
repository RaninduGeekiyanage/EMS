import React, { useState } from 'react';
import { Head, Link, router, useForm } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import {
    SlidersHorizontal,
    Plus,
    Filter,
    Check,
    X,
    Calendar,
    Search,
    ShieldAlert,
    Building2,
    Users,
    FileCheck,
    CheckCircle2,
    AlertCircle,
    Clock,
    ArrowLeft,
    Paperclip,
} from 'lucide-react';

interface Employee {
    id: string;
    emp_no: string;
    full_name: string;
    department?: { id: string; name: string } | null;
    designation?: { id: string; name: string } | null;
}

interface RegularizationRequest {
    id: string;
    tenant_id: string;
    employee_id: string;
    attendance_date: string;
    request_type: string;
    requested_check_in: string | null;
    requested_check_out: string | null;
    reason: string;
    attachment_path: string | null;
    status: 'pending_hod' | 'pending_hr' | 'approved' | 'rejected' | 'cancelled';
    hod_id: number | null;
    hod_actioned_at: string | null;
    hod_remarks: string | null;
    hr_id: number | null;
    hr_actioned_at: string | null;
    is_bypassed_by_hr: boolean;
    rejection_reason: string | null;
    created_at: string;
    employee?: Employee | null;
    hod?: { id: number; name: string } | null;
    hr?: { id: number; name: string } | null;
}

interface Props {
    requests: {
        data: RegularizationRequest[];
        links: any[];
        total: number;
        current_page: number;
        last_page: number;
    };
    stats: {
        pending_hod: number;
        pending_hr: number;
        approved: number;
        rejected: number;
    };
    departments: Array<{ id: string; name: string }>;
    employees: Array<{ id: string; emp_no: string; full_name: string }>;
    filters: {
        status?: string;
        employee_id?: string;
        department_id?: string;
        date_from?: string;
        date_to?: string;
    };
    userPermissions: {
        canHodApprove: boolean;
        canHrConfirm: boolean;
        canHrBypass: boolean;
    };
}

export default function Regularizations({
    requests,
    stats,
    departments,
    employees,
    filters,
    userPermissions,
}: Props) {
    const [statusFilter, setStatusFilter] = useState(filters.status || '');
    const [deptFilter, setDeptFilter] = useState(filters.department_id || '');
    const [dateFrom, setDateFrom] = useState(filters.date_from || '');
    const [dateTo, setDateTo] = useState(filters.date_to || '');

    // Modals
    const [createModalOpen, setCreateModalOpen] = useState(false);
    const { data: form, setData: setForm, post, processing, reset, errors } = useForm({
        employee_id: employees[0]?.id || '',
        attendance_date: new Date().toISOString().split('T')[0],
        request_type: 'missing_punch',
        requested_check_in: '',
        requested_check_out: '',
        reason: '',
    });

    const [actionModalOpen, setActionModalOpen] = useState(false);
    const [selectedReq, setSelectedReq] = useState<RegularizationRequest | null>(null);
    const [actionRole, setActionRole] = useState<'hod' | 'hr'>('hr');
    const [actionDecision, setActionDecision] = useState<'approve' | 'reject'>('approve');
    const [actionRemarks, setActionRemarks] = useState('');
    const [isBypass, setIsBypass] = useState(false);

    const applyFilter = (key: string, value: string) => {
        router.get('/attendance/regularizations', {
            ...filters,
            [key]: value || undefined,
        }, {
            preserveState: true,
            preserveScroll: true,
        });
    };

    const handleCreate = (e: React.FormEvent) => {
        e.preventDefault();
        post('/attendance/regularizations', {
            onSuccess: () => {
                setCreateModalOpen(false);
                reset();
            },
        });
    };

    const handleOpenAction = (req: RegularizationRequest, role: 'hod' | 'hr') => {
        setSelectedReq(req);
        setActionRole(role);
        setActionDecision('approve');
        setActionRemarks('');
        setIsBypass(req.status === 'pending_hod' && role === 'hr');
        setActionModalOpen(true);
    };

    const submitAction = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedReq) return;

        const url = actionRole === 'hod'
            ? `/attendance/regularizations/${selectedReq.id}/hod-action`
            : `/attendance/regularizations/${selectedReq.id}/hr-action`;

        router.post(url, {
            decision: actionDecision,
            remarks: actionRemarks,
            is_bypass: isBypass,
        }, {
            onSuccess: () => {
                setActionModalOpen(false);
                setSelectedReq(null);
            },
        });
    };

    return (
        <AuthenticatedLayout title="Attendance Regularization Ledger">
            <Head title="Attendance Regularizations" />

            <div className="py-6 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                            <Link href="/attendance/anomalies" className="hover:underline flex items-center gap-1">
                                <ArrowLeft className="w-3.5 h-3.5" />
                                <span>Exceptions Center</span>
                            </Link>
                            <span>•</span>
                            <span>M04-A</span>
                        </div>
                        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-1">
                            Attendance Regularizations
                        </h1>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            Missing punch claims, unapproved half-day adjustments, and outstation on-duty gate passes.
                        </p>
                    </div>

                    <button
                        onClick={() => { reset(); setCreateModalOpen(true); }}
                        className="inline-flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-500 hover:to-sky-500 text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-md transition"
                    >
                        <Plus className="w-4 h-4" />
                        <span>New Regularization</span>
                    </button>
                </div>

                {/* KPI stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <button
                        onClick={() => { setStatusFilter('pending_hod'); applyFilter('status', 'pending_hod'); }}
                        className={`text-left p-4 rounded-2xl border transition shadow-sm ${
                            statusFilter === 'pending_hod'
                                ? 'border-amber-500 bg-amber-50/40 dark:bg-amber-950/20'
                                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
                        }`}
                    >
                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Stage 1: Pending HOD</span>
                        <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">{stats.pending_hod}</p>
                    </button>

                    <button
                        onClick={() => { setStatusFilter('pending_hr'); applyFilter('status', 'pending_hr'); }}
                        className={`text-left p-4 rounded-2xl border transition shadow-sm ${
                            statusFilter === 'pending_hr'
                                ? 'border-sky-500 bg-sky-50/40 dark:bg-sky-950/20'
                                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
                        }`}
                    >
                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Stage 2: Pending HR</span>
                        <p className="text-2xl font-bold text-sky-600 dark:text-sky-400 mt-1">{stats.pending_hr}</p>
                    </button>

                    <button
                        onClick={() => { setStatusFilter('approved'); applyFilter('status', 'approved'); }}
                        className={`text-left p-4 rounded-2xl border transition shadow-sm ${
                            statusFilter === 'approved'
                                ? 'border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20'
                                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
                        }`}
                    >
                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Approved & Synced</span>
                        <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{stats.approved}</p>
                    </button>

                    <button
                        onClick={() => { setStatusFilter('rejected'); applyFilter('status', 'rejected'); }}
                        className={`text-left p-4 rounded-2xl border transition shadow-sm ${
                            statusFilter === 'rejected'
                                ? 'border-red-500 bg-red-50/40 dark:bg-red-950/20'
                                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
                        }`}
                    >
                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Rejected Requests</span>
                        <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">{stats.rejected}</p>
                    </button>
                </div>

                {/* Filter Toolbar */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-2xl shadow-sm flex flex-wrap items-center gap-3 text-xs">
                    <select
                        value={statusFilter}
                        onChange={(e) => { setStatusFilter(e.target.value); applyFilter('status', e.target.value); }}
                        className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs font-medium"
                    >
                        <option value="">All Statuses</option>
                        <option value="pending_hod">Pending HOD</option>
                        <option value="pending_hr">Pending HR</option>
                        <option value="approved">Approved</option>
                        <option value="rejected">Rejected</option>
                    </select>

                    <select
                        value={deptFilter}
                        onChange={(e) => { setDeptFilter(e.target.value); applyFilter('department_id', e.target.value); }}
                        className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs font-medium"
                    >
                        <option value="">All Departments</option>
                        {departments.map((d) => (
                            <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                    </select>

                    {(statusFilter || deptFilter || dateFrom || dateTo) && (
                        <button
                            onClick={() => {
                                setStatusFilter('');
                                setDeptFilter('');
                                setDateFrom('');
                                setDateTo('');
                                router.get('/attendance/regularizations');
                            }}
                            className="text-indigo-600 hover:text-indigo-500 font-semibold text-xs ml-auto"
                        >
                            Reset Filters
                        </button>
                    )}
                </div>

                {/* Requests Table */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
                    {requests.data.length === 0 ? (
                        <div className="p-12 text-center text-slate-500 text-xs">
                            No attendance regularization requests found for the selected criteria.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
                                    <tr>
                                        <th className="py-3 px-4">Date</th>
                                        <th className="py-3 px-4">Employee</th>
                                        <th className="py-3 px-4">Type</th>
                                        <th className="py-3 px-4">Requested Punch</th>
                                        <th className="py-3 px-4">Reason</th>
                                        <th className="py-3 px-4">Status</th>
                                        <th className="py-3 px-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
                                    {requests.data.map((r) => (
                                        <tr key={r.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition">
                                            <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                                                {r.attendance_date}
                                            </td>
                                            <td className="py-3 px-4">
                                                <div className="font-semibold text-slate-900 dark:text-white">
                                                    {r.employee?.full_name ?? '—'}
                                                </div>
                                                <div className="text-[10px] text-slate-400">
                                                    {r.employee?.emp_no} • {r.employee?.department?.name}
                                                </div>
                                            </td>
                                            <td className="py-3 px-4">
                                                <span className="uppercase text-[10px] font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                                                    {r.request_type.replace('_', ' ')}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4 font-mono text-[11px]">
                                                {r.requested_check_in ? r.requested_check_in.substring(11, 16) : '—'}
                                                {' → '}
                                                {r.requested_check_out ? r.requested_check_out.substring(11, 16) : '—'}
                                            </td>
                                            <td className="py-3 px-4 max-w-xs truncate text-slate-600 dark:text-slate-400">
                                                {r.reason}
                                            </td>
                                            <td className="py-3 px-4">
                                                <div className="flex flex-col gap-0.5">
                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider w-fit ${
                                                        r.status === 'approved'
                                                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                                                            : r.status === 'pending_hr'
                                                            ? 'bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300'
                                                            : r.status === 'pending_hod'
                                                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                                                            : 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300'
                                                    }`}>
                                                        {r.status.replace('_', ' ')}
                                                    </span>
                                                    {r.is_bypassed_by_hr && (
                                                        <span className="text-[9px] text-amber-600 dark:text-amber-400 font-bold">
                                                            HR Bypassed
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="py-3 px-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    {r.status === 'pending_hod' && userPermissions.canHodApprove && (
                                                        <button
                                                            onClick={() => handleOpenAction(r, 'hod')}
                                                            className="px-2.5 py-1 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs transition"
                                                        >
                                                            HOD Review
                                                        </button>
                                                    )}

                                                    {(r.status === 'pending_hr' || (r.status === 'pending_hod' && userPermissions.canHrBypass)) && userPermissions.canHrConfirm && (
                                                        <button
                                                            onClick={() => handleOpenAction(r, 'hr')}
                                                            className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition"
                                                        >
                                                            {r.status === 'pending_hod' ? 'HR Bypass' : 'HR Confirm'}
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* Create Regularization Modal */}
            {createModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                            <div>
                                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                                    New Attendance Regularization
                                </h3>
                                <p className="text-xs text-slate-500">
                                    Submit missing punch or outstation gate pass request.
                                </p>
                            </div>
                            <button onClick={() => setCreateModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleCreate} className="space-y-4 text-xs">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block font-semibold mb-1">Employee:</label>
                                    <select
                                        value={form.employee_id}
                                        onChange={(e) => setForm('employee_id', e.target.value)}
                                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-xs font-medium"
                                    >
                                        {employees.map((e) => (
                                            <option key={e.id} value={e.id}>{e.emp_no} - {e.full_name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block font-semibold mb-1">Attendance Date:</label>
                                    <input
                                        type="date"
                                        required
                                        max={new Date().toISOString().split('T')[0]}
                                        value={form.attendance_date}
                                        onChange={(e) => setForm('attendance_date', e.target.value)}
                                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-xs font-medium"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block font-semibold mb-1">Request Type:</label>
                                <select
                                    value={form.request_type}
                                    onChange={(e) => setForm('request_type', e.target.value)}
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-xs font-medium"
                                >
                                    <option value="missing_punch">Missing Check-In / Out Punch</option>
                                    <option value="unapproved_half_day">Unapproved Half-Day Adjudication</option>
                                    <option value="on_duty_gate_pass">Outstation / On-Duty Gate Pass</option>
                                    <option value="overtime_claim">Overtime Claim</option>
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                                <div>
                                    <label className="block font-semibold mb-1">Requested Check-In:</label>
                                    <input
                                        type="datetime-local"
                                        value={form.requested_check_in}
                                        onChange={(e) => setForm('requested_check_in', e.target.value)}
                                        className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-xs"
                                    />
                                </div>
                                <div>
                                    <label className="block font-semibold mb-1">Requested Check-Out:</label>
                                    <input
                                        type="datetime-local"
                                        value={form.requested_check_out}
                                        onChange={(e) => setForm('requested_check_out', e.target.value)}
                                        className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-xs"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block font-semibold mb-1">
                                    Reason & Justification: <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    required
                                    rows={3}
                                    value={form.reason}
                                    onChange={(e) => setForm('reason', e.target.value)}
                                    placeholder="Enter reason..."
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-xs"
                                />
                                {errors.reason && <p className="text-red-500 text-[11px] mt-1">{errors.reason}</p>}
                            </div>

                            <div className="flex items-center justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setCreateModalOpen(false)}
                                    className="px-4 py-2 rounded-xl text-slate-600 hover:text-slate-800 text-xs font-semibold"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={processing}
                                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md transition disabled:opacity-50"
                                >
                                    {processing ? 'Submitting...' : 'Submit Request'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Action Regularization Modal */}
            {actionModalOpen && selectedReq && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                            <div>
                                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                                    {actionRole === 'hod' ? 'HOD Review' : 'HR Review & Finalize'}
                                </h3>
                                <p className="text-xs text-slate-500">
                                    {selectedReq.employee?.full_name} • {selectedReq.attendance_date}
                                </p>
                            </div>
                            <button onClick={() => setActionModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={submitAction} className="space-y-4 text-xs">
                            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1">
                                <p className="text-slate-400">Request Reason:</p>
                                <p className="font-semibold text-slate-800 dark:text-slate-200">{selectedReq.reason}</p>
                            </div>

                            <div className="space-y-2">
                                <label className="font-semibold text-slate-700 dark:text-slate-300">Decision:</label>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setActionDecision('approve')}
                                        className={`py-2 px-3 rounded-xl font-semibold text-xs border text-center transition flex items-center justify-center gap-2 ${
                                            actionDecision === 'approve'
                                                ? 'border-emerald-600 bg-emerald-600 text-white shadow'
                                                : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                                        }`}
                                    >
                                        <Check className="w-4 h-4" />
                                        <span>Approve</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setActionDecision('reject')}
                                        className={`py-2 px-3 rounded-xl font-semibold text-xs border text-center transition flex items-center justify-center gap-2 ${
                                            actionDecision === 'reject'
                                                ? 'border-red-600 bg-red-600 text-white shadow'
                                                : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                                        }`}
                                    >
                                        <X className="w-4 h-4" />
                                        <span>Reject</span>
                                    </button>
                                </div>
                            </div>

                            {actionRole === 'hr' && selectedReq.status === 'pending_hod' && (
                                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-900 dark:text-amber-200 text-[11px] font-medium flex items-center gap-2">
                                    <ShieldAlert className="w-4 h-4 text-amber-500 flex-shrink-0" />
                                    <span>HR Direct Bypass: Approving now skips HOD review and immediately syncs punch ledger.</span>
                                </div>
                            )}

                            <div>
                                <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                                    Remarks / Notes:
                                </label>
                                <textarea
                                    required={actionDecision === 'reject'}
                                    rows={2}
                                    value={actionRemarks}
                                    onChange={(e) => setActionRemarks(e.target.value)}
                                    placeholder="Enter comments..."
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-xs"
                                />
                            </div>

                            <div className="flex items-center justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setActionModalOpen(false)}
                                    className="px-4 py-2 rounded-xl text-slate-600 hover:text-slate-800 text-xs font-semibold"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md transition"
                                >
                                    Confirm Decision
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </AuthenticatedLayout>
    );
}
