import React, { useState, useMemo } from 'react';
import { Head, useForm, router, Link } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
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
    Loader2,
    Users,
    Zap,
    ArrowRight,
    ShieldCheck,
} from 'lucide-react';

interface Employee {
    id: string;
    emp_no: string;
    full_name: string;
    date_of_joining?: string | null;
    department_id?: string | null;
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

interface CompensatoryRecord {
    id: string;
    employee_id: string;
    earned_date: string;
    earned_days: number;
    used_days: number;
    remaining_days: number;
    expires_at: string;
    status: 'available' | 'used' | 'expired';
    reason: string;
    employee?: Employee;
    createdBy?: {
        id: number;
        name: string;
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
    is_short_leave: boolean;
    short_leave_from?: string | null;
    short_leave_to?: string | null;
    short_leave_duration_minutes?: number | null;
    covering_employee_id?: string | null;
    reason: string;
    status: 'pending' | 'approved' | 'rejected' | 'cancelled';
    approval_stage: 'pending_hod' | 'pending_hr' | 'approved' | 'rejected' | 'cancelled';
    hod_id?: number | null;
    hod_actioned_at?: string | null;
    hod_remarks?: string | null;
    is_bypassed_by_hr?: boolean;
    actioned_at?: string | null;
    rejection_reason?: string | null;
    created_at: string;
    employee?: Employee;
    covering_employee?: Employee | null;
    leave_type?: LeaveType;
    hod?: {
        id: number;
        name: string;
    } | null;
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
    compensatoryRecords: CompensatoryRecord[];
    metrics: {
        pending_count: number;
        pending_hod_count: number;
        pending_hr_count: number;
        approved_count: number;
        rejected_count: number;
        short_leaves_month: number;
        on_leave_today: number;
        available_c_off_days: number;
    };
    filters: {
        year: number;
        status: string;
        approval_stage?: string;
        type?: string;
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
    compensatoryRecords,
    metrics,
    filters,
}: Props) {
    const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
    const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
    const [isHodActionModalOpen, setIsHodActionModalOpen] = useState(false);
    const [isCreditCofModalOpen, setIsCreditCofModalOpen] = useState(false);
    const [isEntitlementsModalOpen, setIsEntitlementsModalOpen] = useState(false);
    const [isCofLedgerModalOpen, setIsCofLedgerModalOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'requests' | 'c_off_ledger'>('requests');

    const [rejectTargetId, setRejectTargetId] = useState<string | null>(null);
    const [hodActionTarget, setHodActionTarget] = useState<{ id: string; decision: 'approve' | 'reject' } | null>(null);
    const [entitlementFilterEmp, setEntitlementFilterEmp] = useState<string>('');

    // Apply Leave Form
    const applyForm = useForm({
        employee_id: '',
        leave_type_id: leaveTypes[0]?.id || '',
        start_date: new Date().toISOString().split('T')[0],
        end_date: new Date().toISOString().split('T')[0],
        is_half_day: false,
        half_day_type: 'first_half',
        is_short_leave: false,
        short_leave_from: '08:30',
        short_leave_to: '10:00',
        covering_employee_id: '',
        reason: '',
    });

    // Reject Form
    const rejectForm = useForm({
        rejection_reason: '',
    });

    // HOD Action Form
    const hodActionForm = useForm({
        decision: 'approve',
        remarks: '',
    });

    // Entitlement Allocate Form
    const allocateForm = useForm({
        year: filters.year || new Date().getFullYear(),
        employee_id: '',
    });

    // Credit Compensatory Leave Form
    const creditCofForm = useForm({
        employee_id: '',
        earned_date: new Date().toISOString().split('T')[0],
        earned_days: 1.0,
        reason: '',
    });

    // Calculate duration in minutes for short leave in the form
    const shortLeaveDuration = useMemo(() => {
        if (!applyForm.data.is_short_leave || !applyForm.data.short_leave_from || !applyForm.data.short_leave_to) {
            return 0;
        }
        const [fromH, fromM] = applyForm.data.short_leave_from.split(':').map(Number);
        const [toH, toM] = applyForm.data.short_leave_to.split(':').map(Number);
        const fromTotal = fromH * 60 + fromM;
        const toTotal = toH * 60 + toM;
        return Math.max(0, toTotal - fromTotal);
    }, [applyForm.data.is_short_leave, applyForm.data.short_leave_from, applyForm.data.short_leave_to]);

    // Active leave type selected
    const activeLeaveType = useMemo(() => {
        return leaveTypes.find((t) => t.id === applyForm.data.leave_type_id);
    }, [leaveTypes, applyForm.data.leave_type_id]);

    // Active employee entitlement balance
    const activeBalance = useMemo(() => {
        if (!applyForm.data.employee_id || !applyForm.data.leave_type_id) return null;
        if (activeLeaveType?.code === 'COMPENSATORY') {
            const sum = compensatoryRecords
                .filter((c) => c.employee_id === applyForm.data.employee_id && c.status === 'available')
                .reduce((acc, c) => acc + c.remaining_days, 0);
            return sum;
        }
        const match = entitlements.find(
            (e) =>
                e.employee_id === applyForm.data.employee_id &&
                e.leave_type_id === applyForm.data.leave_type_id
        );
        return match ? match.remaining_days : null;
    }, [applyForm.data.employee_id, applyForm.data.leave_type_id, entitlements, activeLeaveType, compensatoryRecords]);

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

    const openHodActionModal = (id: string, decision: 'approve' | 'reject') => {
        setHodActionTarget({ id, decision });
        hodActionForm.setData({
            decision,
            remarks: '',
        });
        setIsHodActionModalOpen(true);
    };

    const handleHodActionSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!hodActionTarget) return;

        hodActionForm.post(`/leave/requests/${hodActionTarget.id}/hod-action`, {
            onSuccess: () => {
                setIsHodActionModalOpen(false);
                setHodActionTarget(null);
                hodActionForm.reset();
            },
        });
    };

    const handleApprove = (id: string, directBypass = false) => {
        router.post(`/leave/requests/${id}/approve`, {
            direct_bypass: directBypass,
        });
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
        if (confirm('Are you sure you want to cancel this leave request?')) {
            router.delete(`/leave/requests/${id}`);
        }
    };

    const handleCreditCofSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        creditCofForm.post('/leave/compensatory/credit', {
            onSuccess: () => {
                setIsCreditCofModalOpen(false);
                creditCofForm.reset();
            },
        });
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

    const getStageBadge = (stage: LeaveRequestItem['approval_stage'], isBypassed?: boolean) => {
        switch (stage) {
            case 'pending_hod':
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        <UserCheck className="w-3.5 h-3.5" />
                        Pending HOD Review
                    </span>
                );
            case 'pending_hr':
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20">
                        <Clock className="w-3.5 h-3.5" />
                        Pending HR Sign-Off
                    </span>
                );
            case 'approved':
                return (
                    <div className="flex flex-col gap-0.5">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Approved
                        </span>
                        {isBypassed && (
                            <span className="text-[10px] font-mono text-purple-400 uppercase tracking-wider pl-1">
                                ⚡ HR Direct Bypass
                            </span>
                        )}
                    </div>
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
        <AuthenticatedLayout title="Leave Management & Requests" backUrl="/dashboard">
            <Head title="Leave Management & Requests — EMS" />

            <div className="max-w-7xl mx-auto space-y-8">
                {/* Header Subnavigation Bar */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-2 border-b border-slate-800/80">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                            <HeartHandshake className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-xl font-bold tracking-tight text-white">
                                    Leave & Absence Architecture
                                </h1>
                                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                    M04 · AMS Phase 2
                                </span>
                            </div>
                            <p className="text-xs text-slate-400">
                                Short Leaves, Shift Coverage, C-Off Expiry (90d) & 2-Tier Approvals
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setIsCreditCofModalOpen(true)}
                            className="text-xs font-medium text-purple-300 hover:text-white px-3 py-1.5 rounded-lg border border-purple-500/30 bg-purple-950/40 hover:bg-purple-900/40 transition flex items-center gap-1.5"
                        >
                            <Award className="w-3.5 h-3.5 text-purple-400" />
                            + Credit C-Off
                        </button>
                        <button
                            type="button"
                            onClick={() => setIsCofLedgerModalOpen(true)}
                            className="text-xs font-medium text-slate-300 hover:text-white px-3 py-1.5 rounded-lg border border-slate-800 hover:border-slate-700 bg-slate-900/60 transition flex items-center gap-1.5"
                        >
                            <Clock className="w-3.5 h-3.5 text-purple-400" />
                            C-Off Ledger
                        </button>
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
                            Apply Leave / Short Leave
                        </button>
                    </div>
                </div>

                {/* Metric Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                    <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800/80 backdrop-blur-sm relative overflow-hidden group">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-slate-400">Awaiting HOD</span>
                            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                <UserCheck className="w-4 h-4" />
                            </div>
                        </div>
                        <div className="mt-2 flex items-baseline gap-2">
                            <span className="text-2xl font-bold font-mono text-amber-400">
                                {metrics.pending_hod_count}
                            </span>
                            <span className="text-xs text-slate-500">requests</span>
                        </div>
                        <p className="mt-1 text-[11px] text-slate-400">
                            Stage 1: HOD recommendation
                        </p>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800/80 backdrop-blur-sm relative overflow-hidden group">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-slate-400">Awaiting HR Sign-Off</span>
                            <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
                                <Clock className="w-4 h-4" />
                            </div>
                        </div>
                        <div className="mt-2 flex items-baseline gap-2">
                            <span className="text-2xl font-bold font-mono text-sky-400">
                                {metrics.pending_hr_count}
                            </span>
                            <span className="text-xs text-slate-500">requests</span>
                        </div>
                        <p className="mt-1 text-[11px] text-slate-400">
                            Stage 2: Final approval
                        </p>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800/80 backdrop-blur-sm relative overflow-hidden group">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-slate-400">Short Leaves (Month)</span>
                            <div className="p-2 rounded-xl bg-violet-500/10 text-violet-400 border border-violet-500/20">
                                <Zap className="w-4 h-4" />
                            </div>
                        </div>
                        <div className="mt-2 flex items-baseline gap-2">
                            <span className="text-2xl font-bold font-mono text-violet-400">
                                {metrics.short_leaves_month}
                            </span>
                            <span className="text-xs text-slate-500">instances</span>
                        </div>
                        <p className="mt-1 text-[11px] text-slate-400">
                            Max 2 per staff / month
                        </p>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800/80 backdrop-blur-sm relative overflow-hidden group">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-slate-400">Available C-Off Pool</span>
                            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                                <Award className="w-4 h-4" />
                            </div>
                        </div>
                        <div className="mt-2 flex items-baseline gap-2">
                            <span className="text-2xl font-bold font-mono text-purple-400">
                                {metrics.available_c_off_days}
                            </span>
                            <span className="text-xs text-slate-500">days</span>
                        </div>
                        <p className="mt-1 text-[11px] text-slate-400">
                            90-day expiry window
                        </p>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800/80 backdrop-blur-sm relative overflow-hidden group">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-slate-400">On Leave Today</span>
                            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                <CalendarIcon className="w-4 h-4" />
                            </div>
                        </div>
                        <div className="mt-2 flex items-baseline gap-2">
                            <span className="text-2xl font-bold font-mono text-emerald-400">
                                {metrics.on_leave_today}
                            </span>
                            <span className="text-xs text-slate-500">staff</span>
                        </div>
                        <p className="mt-1 text-[11px] text-slate-400">
                            Daily ledger active
                        </p>
                    </div>
                </div>

                {/* Filter and Search Bar */}
                <div className="p-4 md:p-6 rounded-3xl bg-slate-900/70 border border-slate-800/80 backdrop-blur-sm flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                        {/* Approval Stage filter */}
                        <div className="bg-slate-950 p-1 rounded-xl border border-slate-800 flex items-center gap-1">
                            {[
                                { key: 'all', label: 'All Stages' },
                                { key: 'pending_hod', label: 'HOD Queue' },
                                { key: 'pending_hr', label: 'HR Queue' },
                                { key: 'approved', label: 'Approved' },
                                { key: 'rejected', label: 'Rejected' },
                            ].map((st) => (
                                <button
                                    key={st.key}
                                    type="button"
                                    onClick={() => handleFilterChange('approval_stage', st.key)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                                        (filters.approval_stage || 'all') === st.key
                                            ? 'bg-emerald-600 text-white shadow-sm'
                                            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                                    }`}
                                >
                                    {st.label}
                                </button>
                            ))}
                        </div>

                        {/* Leave Format Filter */}
                        <select
                            value={filters.type || 'all'}
                            onChange={(e) => handleFilterChange('type', e.target.value)}
                            className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-emerald-500"
                        >
                            <option value="all">All Formats</option>
                            <option value="standard">Standard & Half-Day Leaves</option>
                            <option value="short_leave">Short Leaves (Gate Passes)</option>
                        </select>

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
                                placeholder="Search employee, reason..."
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
                                    <th className="px-6 py-4">Leave Type / Nature</th>
                                    <th className="px-6 py-4">Duration & Timing</th>
                                    <th className="px-6 py-4">Shift Coverage</th>
                                    <th className="px-6 py-4">Approval Stage</th>
                                    <th className="px-6 py-4">Audit Trail</th>
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
                                                Click "+ Apply Leave / Short Leave" or adjust filter criteria above.
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

                                            {/* Leave Type / Nature */}
                                            <td className="px-6 py-4">
                                                {req.is_short_leave ? (
                                                    <div>
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-violet-500/10 text-violet-300 border border-violet-500/20">
                                                            <Zap className="w-3 h-3 text-violet-400" />
                                                            Short Leave (Gate Pass)
                                                        </span>
                                                        <div className="text-[10px] text-slate-400 mt-0.5">
                                                            Zero balance deduction
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div>
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
                                                    </div>
                                                )}
                                            </td>

                                            {/* Duration & Timing */}
                                            <td className="px-6 py-4">
                                                {req.is_short_leave ? (
                                                    <div>
                                                        <div className="font-mono text-slate-200 font-semibold">
                                                            {req.start_date}
                                                        </div>
                                                        <div className="flex items-center gap-1.5 mt-0.5 text-xs text-violet-400 font-mono">
                                                            <Clock className="w-3 h-3" />
                                                            {req.short_leave_from} → {req.short_leave_to} ({req.short_leave_duration_minutes} min)
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div>
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
                                                    </div>
                                                )}
                                            </td>

                                            {/* Shift Coverage */}
                                            <td className="px-6 py-4">
                                                {req.covering_employee ? (
                                                    <div className="flex items-center gap-1.5">
                                                        <Users className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                                                        <div>
                                                            <div className="text-xs text-slate-200 font-medium">
                                                                {req.covering_employee.full_name}
                                                            </div>
                                                            <div className="text-[10px] font-mono text-slate-400">
                                                                {req.covering_employee.emp_no}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <span className="text-[11px] text-slate-500 italic">None assigned</span>
                                                )}
                                            </td>

                                            {/* Approval Stage */}
                                            <td className="px-6 py-4">
                                                {getStageBadge(req.approval_stage, req.is_bypassed_by_hr)}
                                            </td>

                                            {/* Audit Trail */}
                                            <td className="px-6 py-4 max-w-xs">
                                                {req.approval_stage === 'pending_hod' && (
                                                    <span className="text-[11px] text-amber-400 italic">
                                                        Awaiting HOD sign-off
                                                    </span>
                                                )}
                                                {req.hod_actioned_at && (
                                                    <div className="text-[11px] text-slate-400 mb-1">
                                                        <span className="text-slate-300 font-medium">HOD:</span> {req.hod?.name || 'Assigned HOD'}
                                                        {req.hod_remarks && <p className="italic text-slate-500 line-clamp-1">"{req.hod_remarks}"</p>}
                                                    </div>
                                                )}
                                                {req.actioned_by && (
                                                    <div className="text-[11px] text-slate-300 font-medium">
                                                        <span>HR:</span> {req.actioned_by.name}
                                                        {req.rejection_reason && (
                                                            <p className="text-rose-400 italic line-clamp-1">"{req.rejection_reason}"</p>
                                                        )}
                                                    </div>
                                                )}
                                            </td>

                                            {/* Actions */}
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    {/* Stage 1: Pending HOD Action */}
                                                    {req.approval_stage === 'pending_hod' && (
                                                        <>
                                                            <button
                                                                type="button"
                                                                onClick={() => openHodActionModal(req.id, 'approve')}
                                                                className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-medium text-xs shadow-sm transition flex items-center gap-1"
                                                                title="Recommend & Advance to HR"
                                                            >
                                                                <UserCheck className="w-3 h-3" />
                                                                HOD Recommend
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleApprove(req.id, true)}
                                                                className="px-2.5 py-1 rounded-lg bg-purple-600/30 hover:bg-purple-600 text-purple-200 border border-purple-500/30 font-medium text-xs transition flex items-center gap-1"
                                                                title="HR Direct Managerial Bypass"
                                                            >
                                                                <Zap className="w-3 h-3 text-purple-300" />
                                                                HR Bypass
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => openHodActionModal(req.id, 'reject')}
                                                                className="p-1 rounded-lg text-rose-400 hover:bg-rose-950/40 border border-rose-500/20 transition"
                                                                title="HOD Decline"
                                                            >
                                                                <X className="w-3.5 h-3.5" />
                                                            </button>
                                                        </>
                                                    )}

                                                    {/* Stage 2: Pending HR Final Action */}
                                                    {req.approval_stage === 'pending_hr' && (
                                                        <>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleApprove(req.id, false)}
                                                                className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs shadow-sm transition flex items-center gap-1"
                                                                title="HR Final Approve"
                                                            >
                                                                <Check className="w-3.5 h-3.5" />
                                                                HR Sign-Off
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => openRejectModal(req.id)}
                                                                className="px-2.5 py-1 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 font-medium text-xs transition flex items-center gap-1"
                                                                title="Reject Leave"
                                                            >
                                                                <X className="w-3.5 h-3.5" />
                                                                Reject
                                                            </button>
                                                        </>
                                                    )}

                                                    {['pending_hod', 'pending_hr', 'approved'].includes(req.approval_stage) && (
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

            {/* Apply Leave / Short Leave Modal */}
            {isApplyModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-lg w-full shadow-2xl relative max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                    <Plus className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-white">Apply for Leave / Absence</h3>
                                    <p className="text-xs text-slate-400">
                                        Multi-tier statutory approvals & short leave gate pass
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

                        {/* Format Switcher: Standard Leave vs Short Leave */}
                        <div className="my-4 p-1 rounded-xl bg-slate-950 border border-slate-800 grid grid-cols-2 gap-1">
                            <button
                                type="button"
                                onClick={() => applyForm.setData('is_short_leave', false)}
                                className={`py-2 rounded-lg text-xs font-semibold transition ${
                                    !applyForm.data.is_short_leave
                                        ? 'bg-emerald-600 text-white shadow-sm'
                                        : 'text-slate-400 hover:text-slate-200'
                                }`}
                            >
                                Standard / Half-Day
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    applyForm.setData({
                                        ...applyForm.data,
                                        is_short_leave: true,
                                        is_half_day: false,
                                        end_date: applyForm.data.start_date,
                                    });
                                }}
                                className={`py-2 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5 ${
                                    applyForm.data.is_short_leave
                                        ? 'bg-violet-600 text-white shadow-sm'
                                        : 'text-slate-400 hover:text-slate-200'
                                }`}
                            >
                                <Zap className="w-3.5 h-3.5" />
                                Short Leave (Max 2h)
                            </button>
                        </div>

                        <form onSubmit={handleApplySubmit} className="space-y-4">
                            {/* Employee */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1">
                                    Applicant Employee <span className="text-rose-400">*</span>
                                </label>
                                <select
                                    value={applyForm.data.employee_id}
                                    onChange={(e) => applyForm.setData('employee_id', e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                                    required
                                >
                                    <option value="">Select Employee...</option>
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

                            {/* Leave Type (If Standard) */}
                            {!applyForm.data.is_short_leave ? (
                                <div>
                                    <div className="flex items-center justify-between mb-1">
                                        <label className="text-xs font-semibold text-slate-300">
                                            Leave Type <span className="text-rose-400">*</span>
                                        </label>
                                        {activeBalance !== null && (
                                            <span className="text-[11px] font-mono text-emerald-400">
                                                Available Balance: {activeBalance} days
                                            </span>
                                        )}
                                    </div>
                                    <select
                                        value={applyForm.data.leave_type_id}
                                        onChange={(e) => applyForm.setData('leave_type_id', e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                                        required
                                    >
                                        {leaveTypes.map((type) => (
                                            <option key={type.id} value={type.id}>
                                                {type.name} ({type.code}) · {type.is_paid ? 'Paid' : 'Unpaid'}
                                            </option>
                                        ))}
                                    </select>
                                    {applyForm.errors.leave_type_id && (
                                        <p className="text-xs text-rose-400 mt-1">{applyForm.errors.leave_type_id}</p>
                                    )}
                                </div>
                            ) : (
                                <div className="p-3 rounded-xl bg-violet-950/40 border border-violet-500/20 text-xs text-violet-200">
                                    <div className="flex items-center gap-1.5 font-semibold text-violet-300">
                                        <Info className="w-4 h-4" />
                                        Short Leave Policy (Sri Lanka Enterprise Standard)
                                    </div>
                                    <p className="mt-1 text-[11px] text-violet-300/80">
                                        Permitted maximum: 2 short leaves per calendar month (max 120 minutes each). Does not deduct from statutory annual or casual leave quota.
                                    </p>
                                </div>
                            )}

                            {/* Dates */}
                            {!applyForm.data.is_short_leave ? (
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-300 mb-1">
                                            Start Date <span className="text-rose-400">*</span>
                                        </label>
                                        <input
                                            type="date"
                                            value={applyForm.data.start_date}
                                            onChange={(e) => {
                                                applyForm.setData({
                                                    ...applyForm.data,
                                                    start_date: e.target.value,
                                                    end_date: e.target.value >= applyForm.data.end_date ? e.target.value : applyForm.data.end_date,
                                                });
                                            }}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                                            required
                                        />
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
                                    </div>
                                </div>
                            ) : (
                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                                        Absence Date <span className="text-rose-400">*</span>
                                    </label>
                                    <input
                                        type="date"
                                        value={applyForm.data.start_date}
                                        onChange={(e) => {
                                            applyForm.setData({
                                                ...applyForm.data,
                                                start_date: e.target.value,
                                                end_date: e.target.value,
                                            });
                                        }}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-500"
                                        required
                                    />
                                </div>
                            )}

                            {/* Short Leave Times */}
                            {applyForm.data.is_short_leave && (
                                <div className="space-y-3">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-300 mb-1">
                                                From Time (HH:mm) <span className="text-rose-400">*</span>
                                            </label>
                                            <input
                                                type="time"
                                                value={applyForm.data.short_leave_from}
                                                onChange={(e) => applyForm.setData('short_leave_from', e.target.value)}
                                                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-violet-500"
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-300 mb-1">
                                                To Time (HH:mm) <span className="text-rose-400">*</span>
                                            </label>
                                            <input
                                                type="time"
                                                value={applyForm.data.short_leave_to}
                                                onChange={(e) => applyForm.setData('short_leave_to', e.target.value)}
                                                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-violet-500"
                                                required
                                            />
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-950 border border-slate-800">
                                        <span className="text-xs text-slate-400">Calculated Duration:</span>
                                        <span className={`text-xs font-mono font-bold ${shortLeaveDuration > 120 ? 'text-rose-400' : 'text-emerald-400'}`}>
                                            {shortLeaveDuration} minutes ({Math.round((shortLeaveDuration / 60) * 10) / 10} hrs)
                                        </span>
                                    </div>
                                    {shortLeaveDuration > 120 && (
                                        <p className="text-xs text-rose-400">
                                            Duration exceeds maximum allowed 120 minutes (2 hours). Please adjust times or apply for a half-day.
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* Half-Day Option (Only for Standard) */}
                            {!applyForm.data.is_short_leave && (
                                <div className="space-y-3 pt-1">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={applyForm.data.is_half_day}
                                            onChange={(e) => {
                                                const checked = e.target.checked;
                                                applyForm.setData({
                                                    ...applyForm.data,
                                                    is_half_day: checked,
                                                    end_date: checked ? applyForm.data.start_date : applyForm.data.end_date,
                                                });
                                            }}
                                            className="rounded border-slate-800 bg-slate-950 text-emerald-600 focus:ring-0"
                                        />
                                        <span className="text-xs text-slate-300 font-medium">
                                            Request as Half-Day Leave (0.5 day)
                                        </span>
                                    </label>

                                    {applyForm.data.is_half_day && (
                                        <div className="grid grid-cols-2 gap-2 pl-6">
                                            {['first_half', 'second_half'].map((hType) => (
                                                <button
                                                    key={hType}
                                                    type="button"
                                                    onClick={() => applyForm.setData('half_day_type', hType)}
                                                    className={`py-1.5 px-3 rounded-lg text-xs font-medium border transition capitalize ${
                                                        applyForm.data.half_day_type === hType
                                                            ? 'border-indigo-500 bg-indigo-500/10 text-indigo-300'
                                                            : 'border-slate-800 text-slate-400 hover:text-slate-200'
                                                    }`}
                                                >
                                                    {hType.replace('_', ' ')}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Covering Employee Selector */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1">
                                    Designated Covering Colleague <span className="text-slate-500 font-normal">(Shift Handover)</span>
                                </label>
                                <select
                                    value={applyForm.data.covering_employee_id}
                                    onChange={(e) => applyForm.setData('covering_employee_id', e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                                >
                                    <option value="">None / Handover Unnecessary</option>
                                    {employees
                                        .filter((e) => e.id !== applyForm.data.employee_id)
                                        .map((emp) => (
                                            <option key={emp.id} value={emp.id}>
                                                {emp.full_name} ({emp.emp_no}) · {emp.department?.name || 'General'}
                                            </option>
                                        ))}
                                </select>
                                {applyForm.errors.covering_employee_id && (
                                    <p className="text-xs text-rose-400 mt-1">{applyForm.errors.covering_employee_id}</p>
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
                                    placeholder="State the justification for this absence..."
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
                                    disabled={applyForm.processing || (applyForm.data.is_short_leave && shortLeaveDuration > 120)}
                                    className="px-5 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20 transition disabled:opacity-50"
                                >
                                    {applyForm.processing ? 'Submitting...' : 'Submit Application'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* HOD Action Modal */}
            {isHodActionModalOpen && hodActionTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl">
                        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                            <div className="flex items-center gap-2.5">
                                <div className={`p-2 rounded-xl ${hodActionTarget.decision === 'approve' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
                                    {hodActionTarget.decision === 'approve' ? <UserCheck className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-white">
                                        {hodActionTarget.decision === 'approve' ? 'HOD Leave Recommendation' : 'HOD Decline Request'}
                                    </h3>
                                    <p className="text-xs text-slate-400">
                                        {hodActionTarget.decision === 'approve' ? 'Recommend and advance to HR final sign-off' : 'Decline request with audit remarks'}
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsHodActionModalOpen(false)}
                                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <form onSubmit={handleHodActionSubmit} className="mt-5 space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1">
                                    HOD Remarks / Handover Notes {hodActionTarget.decision === 'reject' && <span className="text-rose-400">*</span>}
                                </label>
                                <textarea
                                    rows={3}
                                    value={hodActionForm.data.remarks}
                                    onChange={(e) => hodActionForm.setData('remarks', e.target.value)}
                                    placeholder={hodActionTarget.decision === 'approve' ? 'Optional comments regarding shift coverage or recommendations...' : 'State reasons for declining this request...'}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 resize-none"
                                    required={hodActionTarget.decision === 'reject'}
                                />
                            </div>

                            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                                <button
                                    type="button"
                                    onClick={() => setIsHodActionModalOpen(false)}
                                    className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={hodActionForm.processing}
                                    className={`px-5 py-2 rounded-xl text-xs font-semibold text-white shadow-lg transition disabled:opacity-50 ${
                                        hodActionTarget.decision === 'approve'
                                            ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/20'
                                            : 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/20'
                                    }`}
                                >
                                    {hodActionForm.processing ? 'Processing...' : hodActionTarget.decision === 'approve' ? 'Confirm Recommendation' : 'Confirm Decline'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Credit Compensatory Leave Modal */}
            {isCreditCofModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl">
                        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                                    <Award className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-white">Credit Compensatory Off (C-Off)</h3>
                                    <p className="text-xs text-slate-400">
                                        Grant off-in-lieu for holiday / rest-day duty (90d validity)
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsCreditCofModalOpen(false)}
                                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <form onSubmit={handleCreditCofSubmit} className="mt-5 space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1">
                                    Employee <span className="text-rose-400">*</span>
                                </label>
                                <select
                                    value={creditCofForm.data.employee_id}
                                    onChange={(e) => creditCofForm.setData('employee_id', e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                                    required
                                >
                                    <option value="">Select Employee...</option>
                                    {employees.map((emp) => (
                                        <option key={emp.id} value={emp.id}>
                                            {emp.full_name} ({emp.emp_no}) · {emp.department?.name || 'General'}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                                        Date Worked <span className="text-rose-400">*</span>
                                    </label>
                                    <input
                                        type="date"
                                        value={creditCofForm.data.earned_date}
                                        onChange={(e) => creditCofForm.setData('earned_date', e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                                        Days Credited <span className="text-rose-400">*</span>
                                    </label>
                                    <select
                                        value={creditCofForm.data.earned_days}
                                        onChange={(e) => creditCofForm.setData('earned_days', parseFloat(e.target.value))}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                                    >
                                        <option value={0.5}>0.5 Day (Half Day)</option>
                                        <option value={1.0}>1.0 Day (Full Day)</option>
                                        <option value={1.5}>1.5 Days</option>
                                        <option value={2.0}>2.0 Days</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1">
                                    Duty Justification <span className="text-rose-400">*</span>
                                </label>
                                <textarea
                                    rows={3}
                                    value={creditCofForm.data.reason}
                                    onChange={(e) => creditCofForm.setData('reason', e.target.value)}
                                    placeholder="Explain the holiday or rest day shift worked..."
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500 resize-none"
                                    required
                                />
                            </div>

                            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                                <button
                                    type="button"
                                    onClick={() => setIsCreditCofModalOpen(false)}
                                    className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={creditCofForm.processing}
                                    className="px-5 py-2 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-600/20 transition disabled:opacity-50"
                                >
                                    {creditCofForm.processing ? 'Crediting...' : 'Credit Compensatory Days'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* C-Off Ledger Modal */}
            {isCofLedgerModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-4xl w-full max-h-[85vh] flex flex-col shadow-2xl">
                        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                                    <Clock className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-white">Compensatory Off (C-Off) Ledger</h3>
                                    <p className="text-xs text-slate-400">
                                        Active earned credits with strict 90-day expiry tracking
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsCofLedgerModalOpen(false)}
                                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto mt-4 rounded-2xl border border-slate-800">
                            <table className="w-full text-left text-xs text-slate-300">
                                <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider font-semibold sticky top-0 border-b border-slate-800">
                                    <tr>
                                        <th className="px-4 py-3">Employee</th>
                                        <th className="px-4 py-3">Earned Date</th>
                                        <th className="px-4 py-3">Duty Justification</th>
                                        <th className="px-4 py-3 text-center">Credited</th>
                                        <th className="px-4 py-3 text-center">Remaining</th>
                                        <th className="px-4 py-3">Valid Until (90d)</th>
                                        <th className="px-4 py-3">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/60 font-mono">
                                    {compensatoryRecords.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="px-4 py-10 text-center text-slate-500 font-sans">
                                                No compensatory leave records found. Use "+ Credit C-Off" to grant days.
                                            </td>
                                        </tr>
                                    ) : (
                                        compensatoryRecords.map((c) => (
                                            <tr key={c.id} className="hover:bg-slate-800/40 transition">
                                                <td className="px-4 py-3 font-sans">
                                                    <div className="font-semibold text-white">
                                                        {c.employee?.full_name}
                                                    </div>
                                                    <div className="text-[11px] text-slate-400 font-mono">
                                                        {c.employee?.emp_no}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-slate-200">
                                                    {c.earned_date}
                                                </td>
                                                <td className="px-4 py-3 font-sans max-w-xs truncate text-slate-300" title={c.reason}>
                                                    {c.reason}
                                                </td>
                                                <td className="px-4 py-3 text-center text-purple-400 font-bold">
                                                    {c.earned_days}d
                                                </td>
                                                <td className="px-4 py-3 text-center text-emerald-400 font-bold">
                                                    {c.remaining_days}d
                                                </td>
                                                <td className="px-4 py-3 text-slate-400">
                                                    {c.expires_at}
                                                </td>
                                                <td className="px-4 py-3">
                                                    {c.status === 'available' ? (
                                                        <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold uppercase">
                                                            Available
                                                        </span>
                                                    ) : c.status === 'used' ? (
                                                        <span className="px-2 py-0.5 rounded text-[10px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-semibold uppercase">
                                                            Redeemed
                                                        </span>
                                                    ) : (
                                                        <span className="px-2 py-0.5 rounded text-[10px] bg-rose-500/10 text-rose-400 border border-rose-500/20 font-semibold uppercase">
                                                            Expired (90d)
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        <div className="pt-4 mt-4 border-t border-slate-800 flex justify-end">
                            <button
                                type="button"
                                onClick={() => setIsCofLedgerModalOpen(false)}
                                className="px-5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white transition"
                            >
                                Close Ledger
                            </button>
                        </div>
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
        </AuthenticatedLayout>
    );
}
