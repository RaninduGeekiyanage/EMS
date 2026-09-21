import React, { useState } from 'react';
import { Head, useForm, router, Link } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import {
    ArrowLeftRight,
    Calendar,
    CheckCircle2,
    XCircle,
    Clock,
    UserCheck,
    AlertCircle,
    Building2,
    Plus,
    X,
    Filter,
    ArrowLeft,
    Check,
} from 'lucide-react';

interface EmployeeSummary {
    id: string;
    emp_no: string;
    full_name: string;
    department_id: string;
}

interface ShiftSummary {
    id: string;
    name: string;
    code: string;
    start_time: string;
    end_time: string;
    color?: string | null;
}

interface DepartmentSummary {
    id: string;
    name: string;
    code: string | null;
}

interface ShiftSwapRecord {
    id: string;
    tenant_id: string;
    department_id: string;
    requesting_employee_id: string;
    target_employee_id: string;
    shift_date: string;
    requesting_shift_id?: string | null;
    target_shift_id?: string | null;
    reason?: string | null;
    target_status: 'pending' | 'accepted' | 'rejected';
    status: 'pending' | 'approved' | 'rejected' | 'cancelled';
    approved_by?: number | null;
    approved_at?: string | null;
    admin_notes?: string | null;
    created_at: string;
    department: DepartmentSummary;
    requesting_employee: EmployeeSummary;
    target_employee: EmployeeSummary;
    requesting_shift?: ShiftSummary | null;
    target_shift?: ShiftSummary | null;
    approver?: { id: number; name: string } | null;
}

interface Props {
    swaps: {
        data: ShiftSwapRecord[];
        links: any[];
        total: number;
    };
    departments: DepartmentSummary[];
    employees: EmployeeSummary[];
    filters: {
        department_id: string;
        status: string;
    };
    canApprove: boolean;
}

export default function ShiftSwaps({
    swaps,
    departments,
    employees,
    filters,
    canApprove,
}: Props) {
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [selectedDepartmentFilter, setSelectedDepartmentFilter] = useState(filters.department_id);
    const [selectedStatusFilter, setSelectedStatusFilter] = useState(filters.status);

    // Create Modal Form
    const createForm = useForm({
        requesting_employee_id: '',
        target_employee_id: '',
        shift_date: new Date().toISOString().split('T')[0],
        reason: '',
    });

    // Approval / Rejection Form
    const actionForm = useForm({
        admin_notes: '',
    });

    const handleFilterChange = (dept: string, stat: string) => {
        router.get(
            '/roster/shift-swaps',
            {
                department_id: dept || undefined,
                status: stat !== 'all' ? stat : undefined,
            },
            { preserveState: true }
        );
    };

    const handleCreateSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        createForm.post('/roster/shift-swaps', {
            preserveScroll: true,
            onSuccess: () => {
                setIsCreateModalOpen(false);
                createForm.reset();
            },
        });
    };

    const handleApprove = (swapId: string) => {
        if (confirm('Approve this shift swap? The roster schedule will be automatically swapped.')) {
            actionForm.post(`/roster/shift-swaps/${swapId}/approve`, {
                preserveScroll: true,
            });
        }
    };

    const handleReject = (swapId: string) => {
        const notes = prompt('Reason for rejecting this shift swap proposal:');
        if (notes !== null) {
            actionForm.setData('admin_notes', notes);
            actionForm.post(`/roster/shift-swaps/${swapId}/reject`, {
                preserveScroll: true,
            });
        }
    };

    // Filter target employees to only those in the same department
    const requestingEmp = employees.find((e) => e.id === createForm.data.requesting_employee_id);
    const availableTargets = requestingEmp
        ? employees.filter((e) => e.department_id === requestingEmp.department_id && e.id !== requestingEmp.id)
        : [];

    return (
        <AuthenticatedLayout title="Shift Swap Requests" backUrl="/roster">
            <div className="space-y-6 max-w-7xl mx-auto">
                {/* Header subnav */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800/80">
                    <div className="flex items-center gap-3">
                        <Link
                            href="/roster"
                            className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition"
                            title="Back to Duty Roster"
                        >
                            <ArrowLeft className="w-4 h-4" />
                        </Link>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                                    <ArrowLeftRight className="w-5 h-5 text-indigo-400" />
                                    Departmentalized Shift Swaps
                                </h1>
                                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-mono">
                                    {swaps.total} Requests
                                </span>
                            </div>
                            <p className="text-xs text-slate-400">
                                Intra-department peer shift exchanges with HOD and Company Admin approval workflow
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={() => setIsCreateModalOpen(true)}
                            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-indigo-600/30 transition"
                        >
                            <Plus className="w-4 h-4" />
                            Propose Shift Swap
                        </button>
                    </div>
                </div>

                {/* Filters */}
                <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        <Filter className="w-4 h-4 text-slate-400" />
                        <select
                            value={selectedDepartmentFilter}
                            onChange={(e) => {
                                setSelectedDepartmentFilter(e.target.value);
                                handleFilterChange(e.target.value, selectedStatusFilter);
                            }}
                            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
                        >
                            <option value="">All Departments</option>
                            {departments.map((d) => (
                                <option key={d.id} value={d.id}>
                                    {d.name} {d.code ? `(${d.code})` : ''}
                                </option>
                            ))}
                        </select>

                        <select
                            value={selectedStatusFilter}
                            onChange={(e) => {
                                setSelectedStatusFilter(e.target.value);
                                handleFilterChange(selectedDepartmentFilter, e.target.value);
                            }}
                            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
                        >
                            <option value="all">All Statuses</option>
                            <option value="pending">Pending Approval</option>
                            <option value="approved">Approved</option>
                            <option value="rejected">Rejected</option>
                        </select>
                    </div>
                </div>

                {/* Requests Table */}
                <div className="rounded-3xl border border-slate-800/80 bg-slate-900/50 backdrop-blur-md overflow-hidden shadow-2xl">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                            <thead>
                                <tr className="border-b border-slate-800/80 bg-slate-950/60 text-slate-400 font-semibold tracking-wider uppercase text-[11px]">
                                    <th className="py-3.5 px-4">Date</th>
                                    <th className="py-3.5 px-4">Department</th>
                                    <th className="py-3.5 px-4">Requesting Peer</th>
                                    <th className="py-3.5 px-4">Exchange Peer</th>
                                    <th className="py-3.5 px-4">Reason / Notes</th>
                                    <th className="py-3.5 px-4 text-center">Status</th>
                                    <th className="py-3.5 px-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/50">
                                {swaps.data.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="py-12 text-center text-slate-500">
                                            <div className="flex flex-col items-center justify-center gap-2">
                                                <ArrowLeftRight className="w-8 h-8 text-slate-600" />
                                                <p className="text-sm font-medium">No shift swap proposals recorded.</p>
                                                <p className="text-xs text-slate-500">Click &quot;Propose Shift Swap&quot; to initiate a departmental exchange.</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    swaps.data.map((swap) => (
                                        <tr key={swap.id} className="hover:bg-slate-800/30 transition">
                                            <td className="py-3 px-4 font-mono text-slate-200">
                                                {swap.shift_date}
                                            </td>
                                            <td className="py-3 px-4">
                                                <span className="font-semibold text-white">{swap.department?.name}</span>
                                            </td>
                                            <td className="py-3 px-4">
                                                <div className="font-medium text-white">{swap.requesting_employee?.full_name}</div>
                                                <div className="text-[11px] text-slate-400 font-mono">
                                                    {swap.requesting_employee?.emp_no} • {swap.requesting_shift?.name || 'Rest Day'}
                                                </div>
                                            </td>
                                            <td className="py-3 px-4">
                                                <div className="font-medium text-white">{swap.target_employee?.full_name}</div>
                                                <div className="text-[11px] text-slate-400 font-mono">
                                                    {swap.target_employee?.emp_no} • {swap.target_shift?.name || 'Rest Day'}
                                                </div>
                                            </td>
                                            <td className="py-3 px-4 max-w-xs text-slate-300 truncate">
                                                {swap.reason || '—'}
                                            </td>
                                            <td className="py-3 px-4 text-center">
                                                {swap.status === 'approved' && (
                                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                                        Approved
                                                    </span>
                                                )}
                                                {swap.status === 'rejected' && (
                                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                                        Rejected
                                                    </span>
                                                )}
                                                {swap.status === 'pending' && (
                                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                                        Awaiting Approval
                                                    </span>
                                                )}
                                            </td>
                                            <td className="py-3 px-4 text-right">
                                                {swap.status === 'pending' && canApprove && (
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleApprove(swap.id)}
                                                            className="px-2.5 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/30 transition text-xs font-semibold flex items-center gap-1"
                                                            title="Approve Swap"
                                                        >
                                                            <Check className="w-3.5 h-3.5" /> Approve
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleReject(swap.id)}
                                                            className="px-2.5 py-1 rounded-lg bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 transition text-xs font-semibold flex items-center gap-1"
                                                            title="Reject Swap"
                                                        >
                                                            <X className="w-3.5 h-3.5" /> Reject
                                                        </button>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Create Proposal Modal */}
                {isCreateModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
                        <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-6">
                            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                                <div>
                                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                                        <ArrowLeftRight className="w-4 h-4 text-indigo-400" />
                                        Propose Shift Swap
                                    </h3>
                                    <p className="text-xs text-slate-400 mt-0.5">
                                        Swap scheduled duty shift between two peers in the same department
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setIsCreateModalOpen(false)}
                                    className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                                        Shift Date *
                                    </label>
                                    <input
                                        type="date"
                                        value={createForm.data.shift_date}
                                        onChange={(e) => createForm.setData('shift_date', e.target.value)}
                                        required
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500 font-mono"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                                        Requesting Employee *
                                    </label>
                                    <select
                                        value={createForm.data.requesting_employee_id}
                                        onChange={(e) => {
                                            createForm.setData({
                                                ...createForm.data,
                                                requesting_employee_id: e.target.value,
                                                target_employee_id: '',
                                            });
                                        }}
                                        required
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                                    >
                                        <option value="">Select Employee...</option>
                                        {employees.map((e) => (
                                            <option key={e.id} value={e.id}>
                                                {e.full_name} ({e.emp_no})
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                                        Target Employee (Same Department) *
                                    </label>
                                    <select
                                        value={createForm.data.target_employee_id}
                                        onChange={(e) => createForm.setData('target_employee_id', e.target.value)}
                                        required
                                        disabled={!createForm.data.requesting_employee_id}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                                    >
                                        <option value="">
                                            {!createForm.data.requesting_employee_id ? 'Select requesting employee first...' : 'Select Target Peer...'}
                                        </option>
                                        {availableTargets.map((e) => (
                                            <option key={e.id} value={e.id}>
                                                {e.full_name} ({e.emp_no})
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                                        Reason / Justification
                                    </label>
                                    <textarea
                                        value={createForm.data.reason}
                                        onChange={(e) => createForm.setData('reason', e.target.value)}
                                        placeholder="Explain reason for shift swap..."
                                        rows={3}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                                    />
                                </div>

                                <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setIsCreateModalOpen(false)}
                                        className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={createForm.processing}
                                        className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/20 disabled:opacity-50 flex items-center gap-2"
                                    >
                                        <Check className="w-4 h-4" />
                                        {createForm.processing ? 'Submitting...' : 'Submit Swap Request'}
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
