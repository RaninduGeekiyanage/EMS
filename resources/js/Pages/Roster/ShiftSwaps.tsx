import React, { useState, useEffect, useCallback } from 'react';
import { Head, useForm, router, Link } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import axios from 'axios';
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
    AlertTriangle,
    ArrowRight,
    RefreshCw,
    Zap,
    ShieldAlert,
} from 'lucide-react';

interface EmployeeSummary {
    id: string;
    emp_no: string;
    full_name: string;
    department_id?: string | null;
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
    department_id?: string | null;
    requesting_employee_id: string;
    target_employee_id: string;
    shift_date: string;
    target_date?: string | null;
    swap_type?: 'same_day' | 'cross_day' | null;
    requesting_shift_id?: string | null;
    target_shift_id?: string | null;
    requesting_schedule_type?: string | null;
    target_schedule_type?: string | null;
    reason?: string | null;
    target_status: 'pending' | 'accepted' | 'rejected';
    status: 'pending' | 'approved' | 'rejected' | 'cancelled';
    approved_by?: number | null;
    approved_at?: string | null;
    admin_notes?: string | null;
    created_at: string;
    department?: DepartmentSummary | null;
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

interface SchedulePreviewItem {
    employee_id: string;
    employee_name: string;
    emp_no: string;
    date: string;
    schedule_type: string;
    shift?: ShiftSummary | null;
    leave?: { id: string; type_name: string; type_code: string } | null;
    is_locked?: boolean;
}

interface PreviewResponse {
    can_swap: boolean;
    errors: string[];
    warnings: string[];
    swap_type: 'same_day' | 'cross_day';
    date_a: {
        date: string;
        requesting: {
            current: SchedulePreviewItem;
            proposed: SchedulePreviewItem;
        };
        target: {
            current: SchedulePreviewItem;
            proposed: SchedulePreviewItem;
        };
    };
    date_b?: {
        date: string;
        requesting: {
            current: SchedulePreviewItem;
            proposed: SchedulePreviewItem;
        };
        target: {
            current: SchedulePreviewItem;
            proposed: SchedulePreviewItem;
        };
    } | null;
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

    // Modal state for Approval / Rejection (Rule 5 compliance: No alert/prompt/confirm)
    const [approveModalSwap, setApproveModalSwap] = useState<ShiftSwapRecord | null>(null);
    const [rejectModalSwap, setRejectModalSwap] = useState<ShiftSwapRecord | null>(null);

    // Create Modal Form
    const createForm = useForm({
        swap_type: 'same_day' as 'same_day' | 'cross_day',
        requesting_employee_id: '',
        target_employee_id: '',
        shift_date: new Date().toISOString().split('T')[0],
        target_date: new Date().toISOString().split('T')[0],
        reason: '',
        auto_approve: false,
    });

    // Approval / Rejection Form
    const actionForm = useForm({
        admin_notes: '',
    });

    // Live Schedule Preview State
    const [previewLoading, setPreviewLoading] = useState(false);
    const [previewData, setPreviewData] = useState<PreviewResponse | null>(null);

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

    // Live Schedule Preview Debounced Query
    const fetchPreview = useCallback(() => {
        const { requesting_employee_id, target_employee_id, shift_date, target_date, swap_type } = createForm.data;
        if (!requesting_employee_id || !target_employee_id) {
            setPreviewData(null);
            return;
        }

        setPreviewLoading(true);
        axios
            .post('/roster/shift-swaps/preview', {
                requesting_employee_id,
                target_employee_id,
                shift_date,
                target_date: swap_type === 'cross_day' ? target_date : shift_date,
                swap_type,
            })
            .then((res) => {
                setPreviewData(res.data);
            })
            .catch(() => {
                setPreviewData(null);
            })
            .finally(() => {
                setPreviewLoading(false);
            });
    }, [createForm.data]);

    useEffect(() => {
        if (!isCreateModalOpen) {
            setPreviewData(null);
            return;
        }

        const timer = setTimeout(() => {
            fetchPreview();
        }, 300);

        return () => clearTimeout(timer);
    }, [
        isCreateModalOpen,
        createForm.data.requesting_employee_id,
        createForm.data.target_employee_id,
        createForm.data.shift_date,
        createForm.data.target_date,
        createForm.data.swap_type,
        fetchPreview,
    ]);

    const handleCreateSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        createForm.post('/roster/shift-swaps', {
            preserveScroll: true,
            onSuccess: () => {
                setIsCreateModalOpen(false);
                createForm.reset();
                setPreviewData(null);
            },
        });
    };

    const confirmApprove = () => {
        if (!approveModalSwap) return;
        actionForm.post(`/roster/shift-swaps/${approveModalSwap.id}/approve`, {
            preserveScroll: true,
            onSuccess: () => {
                setApproveModalSwap(null);
                actionForm.reset();
            },
        });
    };

    const confirmReject = () => {
        if (!rejectModalSwap) return;
        actionForm.post(`/roster/shift-swaps/${rejectModalSwap.id}/reject`, {
            preserveScroll: true,
            onSuccess: () => {
                setRejectModalSwap(null);
                actionForm.reset();
            },
        });
    };

    // Filter target employees to only those in the same department
    const requestingEmp = employees.find((e) => e.id === createForm.data.requesting_employee_id);
    const availableTargets = requestingEmp
        ? employees.filter((e) => (e.department_id || null) === (requestingEmp.department_id || null) && e.id !== requestingEmp.id)
        : [];

    return (
        <AuthenticatedLayout title="Shift Swap Requests" backUrl="/roster">
            <Head title="Departmentalized Shift Swaps" />

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
                                Intra-department peer shift exchanges with same-day and cross-date balancing
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
                                    <th className="py-3.5 px-4">Date(s) & Type</th>
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
                                    swaps.data.map((swap) => {
                                        const isCrossDay = swap.swap_type === 'cross_day' && swap.target_date && swap.target_date !== swap.shift_date;

                                        return (
                                            <tr key={swap.id} className="hover:bg-slate-800/30 transition">
                                                <td className="py-3 px-4">
                                                    {isCrossDay ? (
                                                        <div className="space-y-1">
                                                            <div className="font-mono text-slate-200 flex items-center gap-1.5 font-semibold">
                                                                <span>{swap.shift_date}</span>
                                                                <ArrowLeftRight className="w-3 h-3 text-purple-400" />
                                                                <span>{swap.target_date}</span>
                                                            </div>
                                                            <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-500/10 text-purple-300 border border-purple-500/20 font-mono">
                                                                Cross-Date Trade
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <div>
                                                            <div className="font-mono text-slate-200 font-semibold">{swap.shift_date}</div>
                                                            <span className="text-[10px] text-slate-500 font-medium">Same-Day Swap</span>
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="py-3 px-4">
                                                    <span className="font-semibold text-white">{swap.department?.name || 'General Pool'}</span>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <div className="font-medium text-white">{swap.requesting_employee?.full_name}</div>
                                                    <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1.5 mt-0.5">
                                                        <span>{swap.requesting_employee?.emp_no}</span>
                                                        <span>•</span>
                                                        <span
                                                            className="px-1.5 py-0.5 rounded text-[10px] font-semibold"
                                                            style={{
                                                                backgroundColor: swap.requesting_shift?.color ? `${swap.requesting_shift.color}20` : '#334155',
                                                                color: swap.requesting_shift?.color || '#94A3B8',
                                                            }}
                                                        >
                                                            {swap.requesting_shift?.name || (swap.requesting_schedule_type === 'rest_day' ? 'Rest Day' : 'Shift')}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <div className="font-medium text-white">{swap.target_employee?.full_name}</div>
                                                    <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1.5 mt-0.5">
                                                        <span>{swap.target_employee?.emp_no}</span>
                                                        <span>•</span>
                                                        <span
                                                            className="px-1.5 py-0.5 rounded text-[10px] font-semibold"
                                                            style={{
                                                                backgroundColor: swap.target_shift?.color ? `${swap.target_shift.color}20` : '#334155',
                                                                color: swap.target_shift?.color || '#94A3B8',
                                                            }}
                                                        >
                                                            {swap.target_shift?.name || (swap.target_schedule_type === 'rest_day' ? 'Rest Day' : 'Shift')}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="py-3 px-4 max-w-xs text-slate-300">
                                                    <p className="truncate">{swap.reason || '—'}</p>
                                                    {swap.admin_notes && (
                                                        <p className="text-[10px] text-slate-500 italic mt-0.5 truncate">
                                                            Note: {swap.admin_notes}
                                                        </p>
                                                    )}
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
                                                                onClick={() => {
                                                                    actionForm.reset();
                                                                    setApproveModalSwap(swap);
                                                                }}
                                                                className="px-2.5 py-1 rounded-lg bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/30 transition text-xs font-semibold flex items-center gap-1"
                                                                title="Approve Swap"
                                                            >
                                                                <Check className="w-3.5 h-3.5" /> Approve
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    actionForm.reset();
                                                                    setRejectModalSwap(swap);
                                                                }}
                                                                className="px-2.5 py-1 rounded-lg bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 transition text-xs font-semibold flex items-center gap-1"
                                                                title="Reject Swap"
                                                            >
                                                                <X className="w-3.5 h-3.5" /> Reject
                                                            </button>
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Create Proposal Modal */}
                {isCreateModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
                        <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-6 my-8">
                            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                                <div>
                                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                                        <ArrowLeftRight className="w-4 h-4 text-indigo-400" />
                                        Propose Shift Swap
                                    </h3>
                                    <p className="text-xs text-slate-400 mt-0.5">
                                        Exchange shifts between department peers with automatic schedule validation
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsCreateModalOpen(false);
                                        setPreviewData(null);
                                    }}
                                    className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
                                {/* Swap Type Selector Tabs */}
                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 mb-2">
                                        Exchange Scope Mode
                                    </label>
                                    <div className="grid grid-cols-2 gap-2 bg-slate-950 p-1 rounded-2xl border border-slate-800">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                createForm.setData({
                                                    ...createForm.data,
                                                    swap_type: 'same_day',
                                                    target_date: createForm.data.shift_date,
                                                });
                                            }}
                                            className={`py-2 px-3 rounded-xl font-semibold transition flex items-center justify-center gap-2 ${
                                                createForm.data.swap_type === 'same_day'
                                                    ? 'bg-indigo-600 text-white shadow-md'
                                                    : 'text-slate-400 hover:text-white'
                                            }`}
                                        >
                                            <Calendar className="w-3.5 h-3.5" />
                                            Same-Date Shift Swap
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                createForm.setData({
                                                    ...createForm.data,
                                                    swap_type: 'cross_day',
                                                });
                                            }}
                                            className={`py-2 px-3 rounded-xl font-semibold transition flex items-center justify-center gap-2 ${
                                                createForm.data.swap_type === 'cross_day'
                                                    ? 'bg-purple-600 text-white shadow-md'
                                                    : 'text-slate-400 hover:text-white'
                                            }`}
                                        >
                                            <ArrowLeftRight className="w-3.5 h-3.5" />
                                            Different-Date Swap (Cross-Date)
                                        </button>
                                    </div>
                                    <p className="text-[11px] text-slate-400 mt-1.5">
                                        {createForm.data.swap_type === 'same_day'
                                            ? 'Both employees trade their assigned shifts on the exact same date.'
                                            : 'Employee 1 swaps their shift on Date A with Employee 2\'s shift on Date B, keeping total monthly work hours intact.'}
                                    </p>
                                </div>

                                {/* Date Selection */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-300 mb-1">
                                            {createForm.data.swap_type === 'same_day' ? 'Shift Date *' : 'Requesting Peer Date (Date A) *'}
                                        </label>
                                        <input
                                            type="date"
                                            value={createForm.data.shift_date}
                                            onChange={(e) => {
                                                createForm.setData({
                                                    ...createForm.data,
                                                    shift_date: e.target.value,
                                                    target_date: createForm.data.swap_type === 'same_day' ? e.target.value : createForm.data.target_date,
                                                });
                                            }}
                                            required
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500 font-mono"
                                        />
                                    </div>

                                    {createForm.data.swap_type === 'cross_day' && (
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-300 mb-1">
                                                Exchange Peer Date (Date B) *
                                            </label>
                                            <input
                                                type="date"
                                                value={createForm.data.target_date}
                                                onChange={(e) => createForm.setData('target_date', e.target.value)}
                                                required
                                                className="w-full bg-slate-950 border border-purple-500/40 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-purple-500 font-mono"
                                            />
                                        </div>
                                    )}
                                </div>

                                {/* Employees Selection */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                                            Target Peer (Same Department) *
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
                                </div>

                                {/* LIVE SCHEDULE PREVIEW CARD */}
                                {createForm.data.requesting_employee_id && createForm.data.target_employee_id && (
                                    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 space-y-3">
                                        <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                                            <div className="font-semibold text-slate-300 flex items-center gap-2">
                                                <RefreshCw className={`w-3.5 h-3.5 text-indigo-400 ${previewLoading ? 'animate-spin' : ''}`} />
                                                Live Schedule Exchange Preview
                                            </div>
                                            {previewData && (
                                                <span
                                                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                        previewData.can_swap
                                                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                                    }`}
                                                >
                                                    {previewData.can_swap ? 'Feasible Trade' : 'Invalid / Colliding'}
                                                </span>
                                            )}
                                        </div>

                                        {previewLoading && !previewData && (
                                            <p className="text-slate-500 italic py-2">Resolving employee schedules...</p>
                                        )}

                                        {previewData && (
                                            <div className="space-y-3">
                                                {/* Date A Preview */}
                                                <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
                                                    <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400">
                                                        <span>Date: {previewData.date_a.date}</span>
                                                        <span className="font-mono text-indigo-400">Date A</span>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-3">
                                                        {/* Emp A on Date A */}
                                                        <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800/80">
                                                            <div className="text-[10px] text-slate-400">{previewData.date_a.requesting.current.employee_name}</div>
                                                            <div className="font-bold text-white text-xs mt-0.5 flex items-center gap-1">
                                                                <span className="line-through text-slate-500">
                                                                    {previewData.date_a.requesting.current.shift?.name || 'Rest Day'}
                                                                </span>
                                                                <ArrowRight className="w-3 h-3 text-indigo-400" />
                                                                <span className="text-emerald-400">
                                                                    {previewData.date_a.requesting.proposed.shift?.name || 'Rest Day'}
                                                                </span>
                                                            </div>
                                                        </div>

                                                        {/* Emp B on Date A */}
                                                        <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800/80">
                                                            <div className="text-[10px] text-slate-400">{previewData.date_a.target.current.employee_name}</div>
                                                            <div className="font-bold text-white text-xs mt-0.5 flex items-center gap-1">
                                                                <span className="line-through text-slate-500">
                                                                    {previewData.date_a.target.current.shift?.name || 'Rest Day'}
                                                                </span>
                                                                <ArrowRight className="w-3 h-3 text-indigo-400" />
                                                                <span className="text-emerald-400">
                                                                    {previewData.date_a.target.proposed.shift?.name || 'Rest Day'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Date B Preview (if cross-day) */}
                                                {previewData.date_b && (
                                                    <div className="p-2.5 rounded-xl bg-slate-900/60 border border-purple-500/20 space-y-2">
                                                        <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400">
                                                            <span>Date: {previewData.date_b.date}</span>
                                                            <span className="font-mono text-purple-400">Date B</span>
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-3">
                                                            {/* Emp A on Date B */}
                                                            <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800/80">
                                                                <div className="text-[10px] text-slate-400">{previewData.date_b.requesting.current.employee_name}</div>
                                                                <div className="font-bold text-white text-xs mt-0.5 flex items-center gap-1">
                                                                    <span className="line-through text-slate-500">
                                                                        {previewData.date_b.requesting.current.shift?.name || 'Rest Day'}
                                                                    </span>
                                                                    <ArrowRight className="w-3 h-3 text-purple-400" />
                                                                    <span className="text-emerald-400">
                                                                        {previewData.date_b.requesting.proposed.shift?.name || 'Rest Day'}
                                                                    </span>
                                                                </div>
                                                            </div>

                                                            {/* Emp B on Date B */}
                                                            <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800/80">
                                                                <div className="text-[10px] text-slate-400">{previewData.date_b.target.current.employee_name}</div>
                                                                <div className="font-bold text-white text-xs mt-0.5 flex items-center gap-1">
                                                                    <span className="line-through text-slate-500">
                                                                        {previewData.date_b.target.current.shift?.name || 'Rest Day'}
                                                                    </span>
                                                                    <ArrowRight className="w-3 h-3 text-purple-400" />
                                                                    <span className="text-emerald-400">
                                                                        {previewData.date_b.target.proposed.shift?.name || 'Rest Day'}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Fatigue Warnings */}
                                                {previewData.warnings.length > 0 && (
                                                    <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 space-y-1">
                                                        <div className="font-bold flex items-center gap-1.5 text-[11px]">
                                                            <AlertTriangle className="w-3.5 h-3.5" />
                                                            Worker Fatigue Turnaround Advisory:
                                                        </div>
                                                        {previewData.warnings.map((w, idx) => (
                                                            <p key={idx} className="text-[11px] text-amber-200/90 pl-5">
                                                                • {w}
                                                            </p>
                                                        ))}
                                                    </div>
                                                )}

                                                {/* Errors */}
                                                {previewData.errors.length > 0 && (
                                                    <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 space-y-1">
                                                        <div className="font-bold flex items-center gap-1.5 text-[11px]">
                                                            <ShieldAlert className="w-3.5 h-3.5" />
                                                            Trade Blocked:
                                                        </div>
                                                        {previewData.errors.map((e, idx) => (
                                                            <p key={idx} className="text-[11px] text-rose-200/90 pl-5">
                                                                • {e}
                                                            </p>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Reason / Justification */}
                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                                        Reason / Justification
                                    </label>
                                    <textarea
                                        value={createForm.data.reason}
                                        onChange={(e) => createForm.setData('reason', e.target.value)}
                                        placeholder="Explain reason for shift swap..."
                                        rows={2}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                                    />
                                </div>

                                {/* Direct Manager Execution Option */}
                                {canApprove && (
                                    <div className="p-3 rounded-xl bg-indigo-950/30 border border-indigo-500/30 flex items-center gap-3">
                                        <input
                                            type="checkbox"
                                            id="auto_approve_check"
                                            checked={createForm.data.auto_approve}
                                            onChange={(e) => createForm.setData('auto_approve', e.target.checked)}
                                            className="w-4 h-4 rounded border-slate-700 text-indigo-600 focus:ring-indigo-500 bg-slate-900"
                                        />
                                        <label htmlFor="auto_approve_check" className="text-xs text-slate-200 select-none cursor-pointer">
                                            <span className="font-bold text-white flex items-center gap-1.5">
                                                <Zap className="w-3.5 h-3.5 text-amber-400" />
                                                Approve & Apply to Duty Roster Immediately
                                            </span>
                                            <span className="text-[11px] text-slate-400 block">
                                                As manager/HOD, immediately swap and synchronize the active Duty Roster without pending status.
                                            </span>
                                        </label>
                                    </div>
                                )}

                                <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsCreateModalOpen(false);
                                            setPreviewData(null);
                                        }}
                                        className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={createForm.processing || (previewData !== null && !previewData.can_swap)}
                                        className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/20 disabled:opacity-50 flex items-center gap-2"
                                    >
                                        <Check className="w-4 h-4" />
                                        {createForm.processing
                                            ? 'Submitting...'
                                            : createForm.data.auto_approve
                                            ? 'Execute Shift Swap Now'
                                            : 'Submit Swap Request'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* APPROVE CONFIRMATION MODAL (Rule 5 Compliant) */}
                {approveModalSwap && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
                        <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                                    <CheckCircle2 className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-white">Approve Shift Swap</h3>
                                    <p className="text-xs text-slate-400">The Duty Roster schedule will be immediately transposed.</p>
                                </div>
                            </div>

                            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5 text-xs text-slate-300">
                                <div>
                                    <span className="text-slate-500">Date(s): </span>
                                    <span className="font-mono text-white font-semibold">
                                        {approveModalSwap.shift_date}
                                        {approveModalSwap.target_date && approveModalSwap.target_date !== approveModalSwap.shift_date
                                            ? ` ⇄ ${approveModalSwap.target_date}`
                                            : ''}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-slate-500">Requesting: </span>
                                    <span className="text-white font-medium">{approveModalSwap.requesting_employee?.full_name}</span>
                                </div>
                                <div>
                                    <span className="text-slate-500">Exchange Peer: </span>
                                    <span className="text-white font-medium">{approveModalSwap.target_employee?.full_name}</span>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1">
                                    Approval Notes / Instructions (Optional)
                                </label>
                                <input
                                    type="text"
                                    value={actionForm.data.admin_notes}
                                    onChange={(e) => actionForm.setData('admin_notes', e.target.value)}
                                    placeholder="e.g., Approved as relief cover"
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-indigo-500"
                                />
                            </div>

                            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                                <button
                                    type="button"
                                    onClick={() => setApproveModalSwap(null)}
                                    className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={confirmApprove}
                                    disabled={actionForm.processing}
                                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/20 disabled:opacity-50 flex items-center gap-1.5"
                                >
                                    <Check className="w-4 h-4" />
                                    {actionForm.processing ? 'Approving...' : 'Confirm & Apply Swap'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* REJECT CONFIRMATION MODAL (Rule 5 Compliant) */}
                {rejectModalSwap && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
                        <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
                                    <XCircle className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-white">Reject Shift Swap Proposal</h3>
                                    <p className="text-xs text-slate-400">The proposal will be marked as rejected.</p>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1">
                                    Reason for Rejection *
                                </label>
                                <textarea
                                    value={actionForm.data.admin_notes}
                                    onChange={(e) => actionForm.setData('admin_notes', e.target.value)}
                                    required
                                    placeholder="Explain why this proposal is declined (e.g., minimum staffing requirement)..."
                                    rows={3}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-rose-500"
                                />
                            </div>

                            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                                <button
                                    type="button"
                                    onClick={() => setRejectModalSwap(null)}
                                    className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={confirmReject}
                                    disabled={actionForm.processing || !actionForm.data.admin_notes}
                                    className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-lg shadow-rose-600/20 disabled:opacity-50 flex items-center gap-1.5"
                                >
                                    <X className="w-4 h-4" />
                                    {actionForm.processing ? 'Rejecting...' : 'Confirm Rejection'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </AuthenticatedLayout>
    );
}
