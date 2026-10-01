import React, { useState } from 'react';
import { Head, router, useForm, usePage } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import {
    AlertTriangle,
    Clock,
    CheckCircle2,
    XCircle,
    Calendar,
    Lock,
    Unlock,
    Filter,
    ArrowRight,
    Sparkles,
    ShieldAlert,
    Building2,
    Users,
    FileSpreadsheet,
    HelpCircle,
    Sliders,
    Plus,
    Check,
    X,
    FileCheck,
    Send,
    Eye,
    ChevronDown,
    Search,
    AlertCircle,
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
    designation?: {
        id: string;
        name: string;
    } | null;
}

interface Shift {
    id: string;
    name: string;
    code: string;
    start_time: string;
    end_time: string;
}

interface AnomalyItem {
    type: string;
    label: string;
    minutes?: number;
    severity?: string;
    color?: string;
    note?: string;
}

interface AttendanceDailyRecord {
    id: string;
    tenant_id: string;
    employee_id: string;
    attendance_date: string;
    check_in: string | null;
    check_out: string | null;
    worked_hours: number;
    regular_hours: number;
    late_minutes: number;
    early_departure_minutes: number;
    ot_hours: number;
    double_ot_hours: number;
    approved_ot_hours: number | null;
    approved_double_ot_hours: number | null;
    ot_approval_status: string;
    ot_approved_by: number | null;
    ot_approval_remarks: string | null;
    status: string;
    is_paid: boolean;
    is_manual: boolean;
    manual_reason: string | null;
    anomalies: AnomalyItem[] | null;
    employee?: Employee | null;
    shift?: Shift | null;
    ot_approver?: { id: number; name: string } | null;
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

interface PeriodLock {
    id: string;
    year: number;
    month: number;
    period_start: string;
    period_end: string;
    department_id: string | null;
    status: 'open' | 'hod_signed_off' | 'hr_locked';
    hod_signed_off_at: string | null;
    hr_locked_at: string | null;
    notes: string | null;
    department?: { id: string; name: string } | null;
    hod_user?: { id: number; name: string } | null;
    hr_user?: { id: number; name: string } | null;
}

interface Props {
    anomalies: AttendanceDailyRecord[];
    overtimeRecords: AttendanceDailyRecord[];
    regularizations: RegularizationRequest[];
    periodLocks: PeriodLock[];
    companyWideLock: PeriodLock | null;
    summary: {
        total_anomalies: number;
        unapproved_half_days: number;
        missing_punches: number;
        pending_ot_hours: number;
        pending_double_ot_hours: number;
        pending_ot_count: number;
        pending_regularizations: number;
        is_month_locked: boolean;
    };
    departments: Array<{ id: string; name: string }>;
    leaveTypes: Array<{ id: string; name: string; code: string; is_paid: boolean }>;
    employees: Array<{ id: string; emp_no: string; full_name: string; department_id?: string | null }>;
    selectedMonth: string;
    monthLabel: string;
    selectedDepartmentId: string | null;
    selectedEmployeeId?: string | null;
    activeTab: 'anomalies' | 'overtime' | 'regularizations' | 'freeze';
    userPermissions: {
        canHodApproveOt: boolean;
        canHrConfirmOt: boolean;
        canHodApproveRegularization: boolean;
        canHrConfirmRegularization: boolean;
        canPeriodFreeze: boolean;
        canHrBypass: boolean;
    };
}

export default function Anomalies({
    anomalies,
    overtimeRecords,
    regularizations,
    periodLocks,
    companyWideLock,
    summary,
    departments,
    leaveTypes,
    employees,
    selectedMonth,
    monthLabel,
    selectedDepartmentId,
    selectedEmployeeId,
    activeTab = 'anomalies',
    userPermissions,
}: Props) {
    const { flash } = usePage<any>().props;
    const [tab, setTab] = useState<'anomalies' | 'overtime' | 'regularizations' | 'freeze'>(activeTab);
    const [month, setMonth] = useState<string>(selectedMonth);
    const [departmentFilter, setDepartmentFilter] = useState<string>(selectedDepartmentId || '');
    const [employeeFilter, setEmployeeFilter] = useState<string>(selectedEmployeeId || '');
    const [searchQuery, setSearchQuery] = useState<string>('');

    // --- Modals State ---
    // 1. Resolve Half-Day Modal
    const [halfDayModalOpen, setHalfDayModalOpen] = useState(false);
    const [selectedDailyForResolution, setSelectedDailyForResolution] = useState<AttendanceDailyRecord | null>(null);
    const [resolutionMechanism, setResolutionMechanism] = useState<'paid_waiver' | 'retro_leave' | 'no_pay'>('paid_waiver');
    const [resolutionLeaveTypeId, setResolutionLeaveTypeId] = useState<string>(leaveTypes[0]?.id || '');
    const [resolutionJustification, setResolutionJustification] = useState<string>('');

    // 2. Granular OT Modal
    const [otModalOpen, setOtModalOpen] = useState(false);
    const [selectedDailyForOt, setSelectedDailyForOt] = useState<AttendanceDailyRecord | null>(null);
    const [otMode, setOtMode] = useState<'approve_all' | 'partial' | 'reject'>('approve_all');
    const [partialOtHours, setPartialOtHours] = useState<number>(0);
    const [partialDoubleOtHours, setPartialDoubleOtHours] = useState<number>(0);
    const [otRemarks, setOtRemarks] = useState<string>('');

    // 3. New Regularization Modal
    const [regularizationModalOpen, setRegularizationModalOpen] = useState(false);
    const { data: regData, setData: setRegData, post: postReg, processing: regProcessing, reset: resetReg, errors: regErrors } = useForm({
        employee_id: employees[0]?.id || '',
        attendance_date: new Date().toISOString().split('T')[0],
        request_type: 'missing_punch',
        requested_check_in: '',
        requested_check_out: '',
        reason: '',
    });

    // 4. Action Regularization Modal (HOD / HR review)
    const [actionRegModalOpen, setActionRegModalOpen] = useState(false);
    const [selectedRegForAction, setSelectedRegForAction] = useState<RegularizationRequest | null>(null);
    const [actionRole, setActionRole] = useState<'hod' | 'hr'>('hr');
    const [actionDecision, setActionDecision] = useState<'approve' | 'reject'>('approve');
    const [actionRemarks, setActionRemarks] = useState<string>('');
    const [isBypassChecked, setIsBypassChecked] = useState<boolean>(false);

    // 5. Freeze Period Modal
    const [freezeModalOpen, setFreezeModalOpen] = useState(false);
    const [freezeAction, setFreezeAction] = useState<'hod_sign_off' | 'hr_lock' | 'unlock'>('hod_sign_off');
    const [freezeDeptId, setFreezeDeptId] = useState<string>('');
    const [freezeNotes, setFreezeNotes] = useState<string>('');

    // Handle Month, Department or Employee Change
    const applyFilters = (newMonth?: string, newDept?: string, newEmp?: string, newTab?: string) => {
        router.get('/attendance/anomalies', {
            month: newMonth !== undefined ? newMonth : month,
            department_id: newDept !== undefined ? newDept : departmentFilter,
            employee_id: newEmp !== undefined ? newEmp : employeeFilter,
            tab: newTab !== undefined ? newTab : tab,
        }, {
            preserveState: true,
            preserveScroll: true,
        });
    };

    // Open Resolution Modal
    const handleOpenResolveHalfDay = (record: AttendanceDailyRecord) => {
        setSelectedDailyForResolution(record);
        setResolutionMechanism('paid_waiver');
        setResolutionJustification('Managerial paid half-day discretion approved.');
        setHalfDayModalOpen(true);
    };

    const submitHalfDayResolution = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedDailyForResolution) return;

        router.post(`/attendance/daily/${selectedDailyForResolution.id}/resolve-anomaly`, {
            mechanism: resolutionMechanism,
            leave_type_id: resolutionMechanism === 'retro_leave' ? resolutionLeaveTypeId : null,
            justification: resolutionJustification,
        }, {
            onSuccess: () => {
                setHalfDayModalOpen(false);
                setSelectedDailyForResolution(null);
            },
        });
    };

    // Open OT Modal
    const handleOpenOtModal = (record: AttendanceDailyRecord) => {
        setSelectedDailyForOt(record);
        setOtMode('approve_all');
        setPartialOtHours(record.ot_hours || 0);
        setPartialDoubleOtHours(record.double_ot_hours || 0);
        setOtRemarks('');
        setOtModalOpen(true);
    };

    const submitOtApproval = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedDailyForOt) return;

        router.post(`/attendance/daily/${selectedDailyForOt.id}/approve-ot`, {
            mode: otMode,
            approved_ot_hours: otMode === 'partial' ? partialOtHours : null,
            approved_double_ot_hours: otMode === 'partial' ? partialDoubleOtHours : null,
            remarks: otRemarks,
        }, {
            onSuccess: () => {
                setOtModalOpen(false);
                setSelectedDailyForOt(null);
            },
        });
    };

    // Open Regularization Review Modal
    const handleOpenActionReg = (req: RegularizationRequest, role: 'hod' | 'hr') => {
        setSelectedRegForAction(req);
        setActionRole(role);
        setActionDecision('approve');
        setActionRemarks('');
        setIsBypassChecked(req.status === 'pending_hod' && role === 'hr');
        setActionRegModalOpen(true);
    };

    const submitActionReg = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedRegForAction) return;

        const endpoint = actionRole === 'hod'
            ? `/attendance/regularizations/${selectedRegForAction.id}/hod-action`
            : `/attendance/regularizations/${selectedRegForAction.id}/hr-action`;

        router.post(endpoint, {
            decision: actionDecision,
            remarks: actionRemarks,
            is_bypass: isBypassChecked,
        }, {
            onSuccess: () => {
                setActionRegModalOpen(false);
                setSelectedRegForAction(null);
            },
        });
    };

    // Submit New Regularization
    const handleCreateRegularization = (e: React.FormEvent) => {
        e.preventDefault();
        postReg('/attendance/regularizations', {
            onSuccess: () => {
                setRegularizationModalOpen(false);
                resetReg();
            },
        });
    };

    // Submit Period Freeze
    const submitPeriodFreeze = (e: React.FormEvent) => {
        e.preventDefault();
        const [y, m] = month.split('-');
        router.post('/attendance/timesheet/freeze', {
            year: parseInt(y, 10),
            month: parseInt(m, 10),
            department_id: freezeDeptId || null,
            action: freezeAction,
            notes: freezeNotes,
        }, {
            onSuccess: () => {
                setFreezeModalOpen(false);
                setFreezeNotes('');
            },
        });
    };

    return (
        <AuthenticatedLayout title="Attendance Exception Center & Overtime Approvals">
            <Head title="Attendance Exceptions & Overtime Approvals" />

            <div className="py-6 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-6">

                {/* Banner / Lock Alert if Period is Frozen */}
                {summary.is_month_locked && (
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-center justify-between text-amber-900 dark:text-amber-200">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                                <Lock className="w-5 h-5 text-amber-500" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-sm">Attendance Period Locked by HR</h3>
                                <p className="text-xs text-amber-700/80 dark:text-amber-300/70">
                                    The attendance records for {monthLabel} are finalized and locked. Punch regularizations and manual edits are restricted.
                                </p>
                            </div>
                        </div>
                        {userPermissions.canPeriodFreeze && (
                            <button
                                onClick={() => {
                                    setFreezeAction('unlock');
                                    setFreezeDeptId('');
                                    setFreezeModalOpen(true);
                                }}
                                className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-900 dark:text-amber-100 font-medium text-xs transition"
                            >
                                Unlock Period
                            </button>
                        )}
                    </div>
                )}

                {/* Header with Title and Global Actions */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                            <span>M04 Enterprise Suite</span>
                            <span>•</span>
                            <span>Exception Action Center</span>
                        </div>
                        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
                            Attendance Anomalies & OT Approvals
                        </h1>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                            Resolve missing punches, adjudicate unapproved half-days, grant overtime approvals, and lock period timesheets.
                        </p>
                    </div>

                    {/* Filter & Action Controls */}
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 shadow-sm">
                            <Calendar className="w-4 h-4 text-slate-400 mr-2" />
                            <input
                                type="month"
                                value={month}
                                onChange={(e) => {
                                    setMonth(e.target.value);
                                    applyFilters(e.target.value, departmentFilter);
                                }}
                                className="bg-transparent border-0 p-0 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:ring-0 cursor-pointer"
                            />
                        </div>

                        <select
                            value={departmentFilter}
                            onChange={(e) => {
                                setDepartmentFilter(e.target.value);
                                applyFilters(month, e.target.value, employeeFilter);
                            }}
                            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                        >
                            <option value="">All Departments</option>
                            {departments.map((d) => (
                                <option key={d.id} value={d.id}>{d.name}</option>
                            ))}
                        </select>

                        <select
                            value={employeeFilter}
                            onChange={(e) => {
                                setEmployeeFilter(e.target.value);
                                applyFilters(month, departmentFilter, e.target.value);
                            }}
                            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 max-w-[200px]"
                        >
                            <option value="">All Employees</option>
                            {employees.map((emp) => (
                                <option key={emp.id} value={emp.id}>{emp.emp_no} - {emp.full_name}</option>
                            ))}
                        </select>

                        <button
                            onClick={() => {
                                resetReg();
                                setRegularizationModalOpen(true);
                            }}
                            className="inline-flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-500 hover:to-sky-500 text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-md transition"
                        >
                            <Plus className="w-4 h-4" />
                            <span>Request Regularization</span>
                        </button>

                        {userPermissions.canPeriodFreeze && (
                            <button
                                onClick={() => {
                                    setFreezeAction('hr_lock');
                                    setFreezeDeptId('');
                                    setFreezeModalOpen(true);
                                }}
                                className="inline-flex items-center gap-2 bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white text-xs font-semibold px-3 py-2 rounded-xl shadow-sm transition border border-slate-700"
                            >
                                <Lock className="w-3.5 h-3.5 text-amber-400" />
                                <span>Period Freeze</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* KPI Metrics Summary Strip */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 p-4 rounded-2xl shadow-sm relative overflow-hidden">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Punch Anomalies</span>
                            <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center text-red-500">
                                <AlertTriangle className="w-4 h-4" />
                            </div>
                        </div>
                        <div className="mt-2 flex items-baseline gap-2">
                            <span className="text-2xl font-bold text-slate-900 dark:text-white">
                                {summary.total_anomalies}
                            </span>
                            <span className="text-[11px] text-slate-500">
                                ({summary.unapproved_half_days} half-day, {summary.missing_punches} missing)
                            </span>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 p-4 rounded-2xl shadow-sm relative overflow-hidden">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Pending OT Queue</span>
                            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500">
                                <Clock className="w-4 h-4" />
                            </div>
                        </div>
                        <div className="mt-2 flex items-baseline gap-2">
                            <span className="text-2xl font-bold text-slate-900 dark:text-white">
                                {summary.pending_ot_count}
                            </span>
                            <span className="text-[11px] text-slate-500">
                                ({summary.pending_ot_hours}h 1.5x / {summary.pending_double_ot_hours}h 2.0x)
                            </span>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 p-4 rounded-2xl shadow-sm relative overflow-hidden">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Pending Regularizations</span>
                            <div className="w-8 h-8 rounded-lg bg-sky-500/10 flex items-center justify-center text-sky-500">
                                <FileCheck className="w-4 h-4" />
                            </div>
                        </div>
                        <div className="mt-2 flex items-baseline gap-2">
                            <span className="text-2xl font-bold text-slate-900 dark:text-white">
                                {summary.pending_regularizations}
                            </span>
                            <span className="text-[11px] text-sky-600 dark:text-sky-400 font-semibold">
                                Awaiting HOD / HR
                            </span>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 p-4 rounded-2xl shadow-sm relative overflow-hidden">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Timesheet Freeze Status</span>
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${summary.is_month_locked ? 'bg-amber-500/10 text-amber-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                                {summary.is_month_locked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                            </div>
                        </div>
                        <div className="mt-2">
                            <span className={`text-sm font-bold uppercase tracking-wider ${summary.is_month_locked ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                {summary.is_month_locked ? 'Locked (Frozen)' : 'Open / Editable'}
                            </span>
                            <p className="text-[10px] text-slate-400 mt-0.5">{monthLabel}</p>
                        </div>
                    </div>
                </div>

                {/* Navigation Tabs */}
                <div className="flex items-center border-b border-slate-200 dark:border-slate-800 gap-2">
                    <button
                        onClick={() => { setTab('anomalies'); applyFilters(month, departmentFilter, employeeFilter, 'anomalies'); }}
                        className={`px-4 py-2.5 text-xs font-semibold rounded-t-xl transition flex items-center gap-2 border-b-2 ${
                            tab === 'anomalies'
                                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-900'
                                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
                        }`}
                    >
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>Punch Anomalies ({summary.total_anomalies})</span>
                    </button>

                    <button
                        onClick={() => { setTab('overtime'); applyFilters(month, departmentFilter, employeeFilter, 'overtime'); }}
                        className={`px-4 py-2.5 text-xs font-semibold rounded-t-xl transition flex items-center gap-2 border-b-2 ${
                            tab === 'overtime'
                                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-900'
                                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
                        }`}
                    >
                        <Clock className="w-3.5 h-3.5" />
                        <span>Overtime Approvals ({summary.pending_ot_count})</span>
                    </button>

                    <button
                        onClick={() => { setTab('regularizations'); applyFilters(month, departmentFilter, employeeFilter, 'regularizations'); }}
                        className={`px-4 py-2.5 text-xs font-semibold rounded-t-xl transition flex items-center gap-2 border-b-2 ${
                            tab === 'regularizations'
                                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-900'
                                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
                        }`}
                    >
                        <FileCheck className="w-3.5 h-3.5" />
                        <span>Regularization Requests ({regularizations.length})</span>
                    </button>

                    <button
                        onClick={() => { setTab('freeze'); applyFilters(month, departmentFilter, employeeFilter, 'freeze'); }}
                        className={`px-4 py-2.5 text-xs font-semibold rounded-t-xl transition flex items-center gap-2 border-b-2 ${
                            tab === 'freeze'
                                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-900'
                                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
                        }`}
                    >
                        <Lock className="w-3.5 h-3.5" />
                        <span>Period Lock & Sign-Off</span>
                    </button>
                </div>

                {/* TAB 1: PUNCH ANOMALIES */}
                {tab === 'anomalies' && (
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
                        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                            <div>
                                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                                    Outstanding Punch Anomalies & Half-Days
                                </h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    Adjudicate unapproved half-days through Paid Waiver (C), Retro-Leave (B), or Punch Regularization (A).
                                </p>
                            </div>
                            <div className="text-xs text-slate-500">
                                Showing {anomalies.length} anomaly records
                            </div>
                        </div>

                        {anomalies.length === 0 ? (
                            <div className="p-12 text-center">
                                <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-500 mx-auto flex items-center justify-center mb-3">
                                    <CheckCircle2 className="w-6 h-6" />
                                </div>
                                <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Zero Unresolved Anomalies</h4>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                    All employee punch times and half-day records for {monthLabel} are reconciled and compliant.
                                </p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
                                        <tr>
                                            <th className="py-3 px-4">Date</th>
                                            <th className="py-3 px-4">Employee</th>
                                            <th className="py-3 px-4">Department</th>
                                            <th className="py-3 px-4">Punch In</th>
                                            <th className="py-3 px-4">Punch Out</th>
                                            <th className="py-3 px-4 text-center">Worked Hours</th>
                                            <th className="py-3 px-4">Anomaly Details</th>
                                            <th className="py-3 px-4 text-right">Adjudication Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
                                        {anomalies.map((item) => {
                                            const isUnapprovedHalfDay = (item.status === 'half_day' && !item.is_paid);
                                            const isMissingIn = !item.check_in && !!item.check_out;
                                            const isMissingOut = !!item.check_in && !item.check_out;
                                            const isMissingBoth = !item.check_in && !item.check_out && item.status === 'missing_punch';
                                            const isMissing = isMissingIn || isMissingOut || isMissingBoth || item.status === 'missing_punch';

                                            return (
                                                <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition">
                                                    <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                                                        {item.attendance_date}
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        <div className="font-semibold text-slate-900 dark:text-white">
                                                            {item.employee?.full_name ?? '—'}
                                                        </div>
                                                        <div className="text-[10px] text-slate-400">
                                                            {item.employee?.emp_no}
                                                        </div>
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        <span className="text-slate-600 dark:text-slate-400">
                                                            {item.employee?.department?.name ?? '—'}
                                                        </span>
                                                    </td>
                                                    <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-400">
                                                        {item.check_in ? item.check_in.substring(11, 16) : <span className="text-red-500 font-bold">MISSING</span>}
                                                    </td>
                                                    <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-400">
                                                        {item.check_out ? item.check_out.substring(11, 16) : <span className="text-red-500 font-bold">MISSING</span>}
                                                    </td>
                                                    <td className="py-3 px-4 text-center font-semibold">
                                                        {Number(item.worked_hours).toFixed(2)}h
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        <div className="flex flex-wrap gap-1">
                                                            {isUnapprovedHalfDay && (
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800">
                                                                    <AlertTriangle className="w-3 h-3" />
                                                                    Unapproved Half-Day (Unpaid)
                                                                </span>
                                                            )}
                                                            {isMissing && (
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                                                    Missing Punch
                                                                </span>
                                                            )}
                                                            {item.late_minutes > 0 && (
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                                                    Late: {item.late_minutes}m
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="py-3 px-4 text-right">
                                                        <div className="flex items-center justify-end gap-2">
                                                            {isUnapprovedHalfDay ? (
                                                                <button
                                                                    onClick={() => handleOpenResolveHalfDay(item)}
                                                                    className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition shadow-sm"
                                                                >
                                                                    Adjudicate Half-Day
                                                                </button>
                                                            ) : (
                                                                <button
                                                                    onClick={() => {
                                                                        setRegData({
                                                                            employee_id: item.employee_id,
                                                                            attendance_date: item.attendance_date,
                                                                            request_type: 'missing_punch',
                                                                            requested_check_in: item.check_in || '',
                                                                            requested_check_out: item.check_out || '',
                                                                            reason: 'Biometric punch missing, submitted for regularization',
                                                                        });
                                                                        setRegularizationModalOpen(true);
                                                                    }}
                                                                    className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs transition"
                                                                >
                                                                    Regularize
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {/* TAB 2: OVERTIME APPROVALS QUEUE */}
                {tab === 'overtime' && (
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
                        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                            <div>
                                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                                    Granular Overtime Approval Console
                                </h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    Review raw biometric OT hours and grant full or partial approval before payroll processing.
                                </p>
                            </div>
                            <div className="text-xs text-slate-500">
                                {overtimeRecords.length} OT records recorded
                            </div>
                        </div>

                        {overtimeRecords.length === 0 ? (
                            <div className="p-12 text-center text-slate-500 text-xs">
                                No overtime hours recorded for this period.
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
                                        <tr>
                                            <th className="py-3 px-4">Date</th>
                                            <th className="py-3 px-4">Employee</th>
                                            <th className="py-3 px-4">Shift</th>
                                            <th className="py-3 px-4 text-center">Raw 1.5x OT</th>
                                            <th className="py-3 px-4 text-center">Raw 2.0x OT</th>
                                            <th className="py-3 px-4 text-center">Approved 1.5x</th>
                                            <th className="py-3 px-4 text-center">Approved 2.0x</th>
                                            <th className="py-3 px-4">Status</th>
                                            <th className="py-3 px-4 text-right">Approval Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
                                        {overtimeRecords.map((item) => (
                                            <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition">
                                                <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                                                    {item.attendance_date}
                                                </td>
                                                <td className="py-3 px-4">
                                                    <div className="font-semibold text-slate-900 dark:text-white">
                                                        {item.employee?.full_name ?? '—'}
                                                    </div>
                                                    <div className="text-[10px] text-slate-400">
                                                        {item.employee?.emp_no} • {item.employee?.department?.name}
                                                    </div>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <span className="font-mono text-slate-500">
                                                        {item.shift?.code ?? 'GEN'}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4 text-center font-semibold text-indigo-600 dark:text-indigo-400">
                                                    {Number(item.ot_hours).toFixed(2)}h
                                                </td>
                                                <td className="py-3 px-4 text-center font-semibold text-amber-600 dark:text-amber-400">
                                                    {Number(item.double_ot_hours).toFixed(2)}h
                                                </td>
                                                <td className="py-3 px-4 text-center font-bold">
                                                    {item.approved_ot_hours !== null ? `${Number(item.approved_ot_hours).toFixed(2)}h` : '—'}
                                                </td>
                                                <td className="py-3 px-4 text-center font-bold">
                                                    {item.approved_double_ot_hours !== null ? `${Number(item.approved_double_ot_hours).toFixed(2)}h` : '—'}
                                                </td>
                                                <td className="py-3 px-4">
                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                                                        item.ot_approval_status === 'hr_confirmed'
                                                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                                                            : item.ot_approval_status === 'hod_approved'
                                                            ? 'bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300'
                                                            : item.ot_approval_status === 'rejected'
                                                            ? 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300'
                                                            : 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                                                    }`}>
                                                        {item.ot_approval_status}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4 text-right">
                                                    <button
                                                        onClick={() => handleOpenOtModal(item)}
                                                        className="px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-semibold text-xs transition"
                                                    >
                                                        Review / Approve
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {/* TAB 3: REGULARIZATION REQUESTS LEDGER */}
                {tab === 'regularizations' && (
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
                        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                            <div>
                                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                                    Attendance Regularization Ledger (2-Tier & HR Bypass)
                                </h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    Stage 1: HOD review & recommendation • Stage 2: HR confirmation or direct bypass.
                                </p>
                            </div>
                            <button
                                onClick={() => {
                                    resetReg();
                                    setRegularizationModalOpen(true);
                                }}
                                className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs px-3 py-1.5 rounded-lg transition"
                            >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Submit Request</span>
                            </button>
                        </div>

                        {regularizations.length === 0 ? (
                            <div className="p-12 text-center text-slate-500 text-xs">
                                No regularization requests recorded for this period.
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
                                        {regularizations.map((r) => (
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
                                                        {r.status === 'pending_hod' && userPermissions.canHodApproveRegularization && (
                                                            <button
                                                                onClick={() => handleOpenActionReg(r, 'hod')}
                                                                className="px-2.5 py-1 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs transition"
                                                            >
                                                                HOD Review
                                                            </button>
                                                        )}

                                                        {(r.status === 'pending_hr' || (r.status === 'pending_hod' && userPermissions.canHrBypass)) && userPermissions.canHrConfirmRegularization && (
                                                            <button
                                                                onClick={() => handleOpenActionReg(r, 'hr')}
                                                                className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition"
                                                            >
                                                                {r.status === 'pending_hod' ? 'HR Bypass & Confirm' : 'HR Confirm'}
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
                )}

                {/* TAB 4: PERIOD FREEZE & LOCK */}
                {tab === 'freeze' && (
                    <div className="space-y-6">
                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
                            <h3 className="text-base font-bold text-slate-900 dark:text-white">
                                Monthly Attendance Timesheet Freeze & Sign-Off ({monthLabel})
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-3xl">
                                Compliance & Auditing Control: Before payroll execution, Department Heads sign off on their team attendance, and HR locks the month. Once locked by HR, records cannot be edited without executive authorization.
                            </p>

                            <div className="mt-6 flex flex-wrap gap-4 items-center">
                                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex-1 min-w-[280px]">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-semibold text-slate-500">Company-Wide Lock</span>
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                            companyWideLock?.status === 'hr_locked'
                                                ? 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300'
                                                : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                                        }`}>
                                            {companyWideLock?.status === 'hr_locked' ? 'Locked (Frozen)' : 'Open / Unlocked'}
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-2">
                                        {companyWideLock?.hr_user ? `Locked by ${companyWideLock.hr_user.name}` : 'Not locked yet.'}
                                    </p>
                                </div>

                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => {
                                            setFreezeAction('hod_sign_off');
                                            setFreezeModalOpen(true);
                                        }}
                                        className="px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs shadow-sm transition"
                                    >
                                        HOD Sign-Off
                                    </button>

                                    {userPermissions.canPeriodFreeze && (
                                        <button
                                            onClick={() => {
                                                setFreezeAction(companyWideLock?.status === 'hr_locked' ? 'unlock' : 'hr_lock');
                                                setFreezeDeptId('');
                                                setFreezeModalOpen(true);
                                            }}
                                            className={`px-4 py-2.5 rounded-xl font-semibold text-xs shadow-sm transition ${
                                                companyWideLock?.status === 'hr_locked'
                                                    ? 'bg-amber-600 hover:bg-amber-500 text-white'
                                                    : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                                            }`}
                                        >
                                            {companyWideLock?.status === 'hr_locked' ? 'Unlock Period' : 'HR Final Lock'}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Department Sign-off Breakdown */}
                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                            <div className="p-4 border-b border-slate-200 dark:border-slate-800">
                                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-600 dark:text-slate-400">
                                    Department Sign-Off Matrix
                                </h4>
                            </div>
                            <div className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs">
                                {departments.map((d) => {
                                    const lock = periodLocks.find((p) => p.department_id === d.id);
                                    const isSignedOff = lock?.status === 'hod_signed_off' || lock?.status === 'hr_locked';

                                    return (
                                        <div key={d.id} className="p-4 flex items-center justify-between hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400 font-bold">
                                                    <Building2 className="w-4 h-4" />
                                                </div>
                                                <div>
                                                    <p className="font-semibold text-slate-800 dark:text-slate-200">{d.name}</p>
                                                    <p className="text-[10px] text-slate-400">
                                                        {lock?.hod_user ? `Signed off by ${lock.hod_user.name} on ${lock.hod_signed_off_at?.substring(0, 10)}` : 'Pending HOD review'}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-3">
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                                                    isSignedOff
                                                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                                                        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                                                }`}>
                                                    {isSignedOff ? 'Signed Off' : 'Pending'}
                                                </span>

                                                {!isSignedOff && (
                                                    <button
                                                        onClick={() => {
                                                            setFreezeAction('hod_sign_off');
                                                            setFreezeDeptId(d.id);
                                                            setFreezeModalOpen(true);
                                                        }}
                                                        className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[11px] font-medium"
                                                    >
                                                        Sign Off
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}

            </div>

            {/* --- MODAL 1: RESOLVE HALF-DAY ANOMALY --- */}
            {halfDayModalOpen && selectedDailyForResolution && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                            <div>
                                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                                    Adjudicate Unapproved Half-Day
                                </h3>
                                <p className="text-xs text-slate-500">
                                    {selectedDailyForResolution.employee?.full_name} • {selectedDailyForResolution.attendance_date}
                                </p>
                            </div>
                            <button onClick={() => setHalfDayModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={submitHalfDayResolution} className="space-y-4 text-xs">
                            <div className="space-y-2">
                                <label className="font-semibold text-slate-700 dark:text-slate-300">
                                    Select Resolution Mechanism:
                                </label>

                                <div className="space-y-2">
                                    <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition ${
                                        resolutionMechanism === 'paid_waiver'
                                            ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30'
                                            : 'border-slate-200 dark:border-slate-800'
                                    }`}>
                                        <input
                                            type="radio"
                                            name="mechanism"
                                            value="paid_waiver"
                                            checked={resolutionMechanism === 'paid_waiver'}
                                            onChange={() => setResolutionMechanism('paid_waiver')}
                                            className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                                        />
                                        <div>
                                            <p className="font-semibold text-slate-800 dark:text-slate-200">
                                                Mechanism C: Managerial Discretion (Paid Waiver)
                                            </p>
                                            <p className="text-[11px] text-slate-500">
                                                Grants paid status without altering biometric punch records. Requires auditable reason.
                                            </p>
                                        </div>
                                    </label>

                                    <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition ${
                                        resolutionMechanism === 'retro_leave'
                                            ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30'
                                            : 'border-slate-200 dark:border-slate-800'
                                    }`}>
                                        <input
                                            type="radio"
                                            name="mechanism"
                                            value="retro_leave"
                                            checked={resolutionMechanism === 'retro_leave'}
                                            onChange={() => setResolutionMechanism('retro_leave')}
                                            className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                                        />
                                        <div>
                                            <p className="font-semibold text-slate-800 dark:text-slate-200">
                                                Mechanism B: Retroactive Leave Conversion
                                            </p>
                                            <p className="text-[11px] text-slate-500">
                                                Converts into 0.5 Day Leave, deducting 0.5 from entitlement balance.
                                            </p>
                                        </div>
                                    </label>

                                    <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition ${
                                        resolutionMechanism === 'no_pay'
                                            ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30'
                                            : 'border-slate-200 dark:border-slate-800'
                                    }`}>
                                        <input
                                            type="radio"
                                            name="mechanism"
                                            value="no_pay"
                                            checked={resolutionMechanism === 'no_pay'}
                                            onChange={() => setResolutionMechanism('no_pay')}
                                            className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                                        />
                                        <div>
                                            <p className="font-semibold text-slate-800 dark:text-slate-200">
                                                Confirm as Unpaid / No-Pay Half Day
                                            </p>
                                            <p className="text-[11px] text-slate-500">
                                                Confirms this half-day as unauthorized for payroll salary deduction.
                                            </p>
                                        </div>
                                    </label>
                                </div>
                            </div>

                            {resolutionMechanism === 'retro_leave' && (
                                <div>
                                    <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                                        Select Leave Type:
                                    </label>
                                    <select
                                        value={resolutionLeaveTypeId}
                                        onChange={(e) => setResolutionLeaveTypeId(e.target.value)}
                                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-xs font-medium"
                                    >
                                        {leaveTypes.map((t) => (
                                            <option key={t.id} value={t.id}>{t.name} ({t.code})</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <div>
                                <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                                    Audit Justification / Remarks: <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    required
                                    rows={3}
                                    value={resolutionJustification}
                                    onChange={(e) => setResolutionJustification(e.target.value)}
                                    placeholder="Enter reason for adjudication..."
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-xs"
                                />
                            </div>

                            <div className="flex items-center justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setHalfDayModalOpen(false)}
                                    className="px-4 py-2 rounded-xl text-slate-600 hover:text-slate-800 text-xs font-semibold"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md transition"
                                >
                                    Confirm Adjudication
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* --- MODAL 2: GRANULAR OVERTIME APPROVAL --- */}
            {otModalOpen && selectedDailyForOt && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                            <div>
                                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                                    Granular Overtime Approval
                                </h3>
                                <p className="text-xs text-slate-500">
                                    {selectedDailyForOt.employee?.full_name} • {selectedDailyForOt.attendance_date}
                                </p>
                            </div>
                            <button onClick={() => setOtModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={submitOtApproval} className="space-y-4 text-xs">
                            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 flex justify-around text-center">
                                <div>
                                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Raw 1.5x OT</span>
                                    <p className="text-base font-bold text-indigo-600 dark:text-indigo-400">
                                        {Number(selectedDailyForOt.ot_hours).toFixed(2)}h
                                    </p>
                                </div>
                                <div className="border-r border-slate-200 dark:border-slate-700" />
                                <div>
                                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Raw 2.0x OT</span>
                                    <p className="text-base font-bold text-amber-600 dark:text-amber-400">
                                        {Number(selectedDailyForOt.double_ot_hours).toFixed(2)}h
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="font-semibold text-slate-700 dark:text-slate-300">Approval Mode:</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {(['approve_all', 'partial', 'reject'] as const).map((m) => (
                                        <button
                                            key={m}
                                            type="button"
                                            onClick={() => setOtMode(m)}
                                            className={`py-2 px-3 rounded-xl font-semibold text-xs border text-center transition ${
                                                otMode === m
                                                    ? 'border-indigo-600 bg-indigo-600 text-white shadow'
                                                    : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                                            }`}
                                        >
                                            {m === 'approve_all' ? 'Full Hours' : m === 'partial' ? 'Partial' : 'Reject'}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {otMode === 'partial' && (
                                <div className="grid grid-cols-2 gap-3 p-3 bg-indigo-50/50 dark:bg-indigo-950/30 rounded-xl border border-indigo-200 dark:border-indigo-900/60">
                                    <div>
                                        <label className="block font-semibold mb-1">Approved 1.5x Hours:</label>
                                        <input
                                            type="number"
                                            step="0.25"
                                            min="0"
                                            max="24"
                                            value={partialOtHours}
                                            onChange={(e) => setPartialOtHours(parseFloat(e.target.value) || 0)}
                                            className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-xs"
                                        />
                                    </div>
                                    <div>
                                        <label className="block font-semibold mb-1">Approved 2.0x Hours:</label>
                                        <input
                                            type="number"
                                            step="0.25"
                                            min="0"
                                            max="24"
                                            value={partialDoubleOtHours}
                                            onChange={(e) => setPartialDoubleOtHours(parseFloat(e.target.value) || 0)}
                                            className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-xs"
                                        />
                                    </div>
                                </div>
                            )}

                            <div>
                                <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                                    Approval Remarks / Justification:
                                </label>
                                <textarea
                                    rows={2}
                                    value={otRemarks}
                                    onChange={(e) => setOtRemarks(e.target.value)}
                                    placeholder="Optional approver notes..."
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-xs"
                                />
                            </div>

                            <div className="flex items-center justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setOtModalOpen(false)}
                                    className="px-4 py-2 rounded-xl text-slate-600 hover:text-slate-800 text-xs font-semibold"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md transition"
                                >
                                    Save Overtime Decision
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* --- MODAL 3: NEW REGULARIZATION REQUEST --- */}
            {regularizationModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                            <div>
                                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                                    Submit Attendance Regularization
                                </h3>
                                <p className="text-xs text-slate-500">
                                    Adjust biometric punch, excuse unapproved half day, or log outstation on-duty gate pass.
                                </p>
                            </div>
                            <button onClick={() => setRegularizationModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleCreateRegularization} className="space-y-4 text-xs">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                                        Employee:
                                    </label>
                                    <select
                                        value={regData.employee_id}
                                        onChange={(e) => setRegData('employee_id', e.target.value)}
                                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-xs font-medium"
                                    >
                                        {employees.map((e) => (
                                            <option key={e.id} value={e.id}>{e.emp_no} - {e.full_name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                                        Attendance Date:
                                    </label>
                                    <input
                                        type="date"
                                        required
                                        max={new Date().toISOString().split('T')[0]}
                                        value={regData.attendance_date}
                                        onChange={(e) => setRegData('attendance_date', e.target.value)}
                                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-xs font-medium"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                                    Request Type:
                                </label>
                                <select
                                    value={regData.request_type}
                                    onChange={(e) => setRegData('request_type', e.target.value)}
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-xs font-medium"
                                >
                                    <option value="missing_punch">Missing Check-In / Out Punch</option>
                                    <option value="unapproved_half_day">Unapproved Half-Day Adjudication</option>
                                    <option value="on_duty_gate_pass">Outstation / On-Duty Gate Pass</option>
                                    <option value="overtime_claim">Overtime Dispute / Claim</option>
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                                <div>
                                    <label className="block font-semibold mb-1">Requested Check-In:</label>
                                    <input
                                        type="datetime-local"
                                        value={regData.requested_check_in}
                                        onChange={(e) => setRegData('requested_check_in', e.target.value)}
                                        className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-xs"
                                    />
                                </div>
                                <div>
                                    <label className="block font-semibold mb-1">Requested Check-Out:</label>
                                    <input
                                        type="datetime-local"
                                        value={regData.requested_check_out}
                                        onChange={(e) => setRegData('requested_check_out', e.target.value)}
                                        className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 text-xs"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                                    Reason & Justification: <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    required
                                    rows={3}
                                    value={regData.reason}
                                    onChange={(e) => setRegData('reason', e.target.value)}
                                    placeholder="State why the punch was missed or outstation duty details..."
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-xs"
                                />
                                {regErrors.reason && <p className="text-red-500 text-[11px] mt-1">{regErrors.reason}</p>}
                            </div>

                            <div className="flex items-center justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setRegularizationModalOpen(false)}
                                    className="px-4 py-2 rounded-xl text-slate-600 hover:text-slate-800 text-xs font-semibold"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={regProcessing}
                                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md transition disabled:opacity-50"
                                >
                                    {regProcessing ? 'Submitting...' : 'Submit Regularization'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* --- MODAL 4: HOD / HR REVIEW & ACTION REGULARIZATION --- */}
            {actionRegModalOpen && selectedRegForAction && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                            <div>
                                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                                    {actionRole === 'hod' ? 'HOD Review & Recommendation' : 'HR Review & Final Confirmation'}
                                </h3>
                                <p className="text-xs text-slate-500">
                                    {selectedRegForAction.employee?.full_name} • {selectedRegForAction.attendance_date}
                                </p>
                            </div>
                            <button onClick={() => setActionRegModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={submitActionReg} className="space-y-4 text-xs">
                            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1.5">
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Request Type:</span>
                                    <span className="font-semibold uppercase text-slate-800 dark:text-slate-200">
                                        {selectedRegForAction.request_type.replace('_', ' ')}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Reason:</span>
                                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                                        {selectedRegForAction.reason}
                                    </span>
                                </div>
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

                            {actionRole === 'hr' && selectedRegForAction.status === 'pending_hod' && (
                                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-900 dark:text-amber-200 flex items-center gap-2">
                                    <ShieldAlert className="w-4 h-4 text-amber-500 flex-shrink-0" />
                                    <span className="text-[11px] font-medium">
                                        HR Direct Bypass Active: Approving now will bypass the HOD stage and immediately synchronize the punch ledger.
                                    </span>
                                </div>
                            )}

                            <div>
                                <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                                    {actionDecision === 'reject' ? 'Rejection Reason (Required):' : 'Remarks (Optional):'}
                                </label>
                                <textarea
                                    required={actionDecision === 'reject'}
                                    rows={2}
                                    value={actionRemarks}
                                    onChange={(e) => setActionRemarks(e.target.value)}
                                    placeholder="Enter decision comments..."
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-xs"
                                />
                            </div>

                            <div className="flex items-center justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setActionRegModalOpen(false)}
                                    className="px-4 py-2 rounded-xl text-slate-600 hover:text-slate-800 text-xs font-semibold"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md transition"
                                >
                                    Submit Decision
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* --- MODAL 5: PERIOD FREEZE & LOCK --- */}
            {freezeModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                            <div>
                                <h3 className="font-bold text-base text-slate-900 dark:text-white">
                                    {freezeAction === 'unlock' ? 'Unlock Attendance Period' : freezeAction === 'hr_lock' ? 'HR Final Period Lock' : 'HOD Team Sign-Off'}
                                </h3>
                                <p className="text-xs text-slate-500">{monthLabel}</p>
                            </div>
                            <button onClick={() => setFreezeModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={submitPeriodFreeze} className="space-y-4 text-xs">
                            {freezeAction === 'hod_sign_off' && (
                                <div>
                                    <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                                        Select Department to Sign Off:
                                    </label>
                                    <select
                                        value={freezeDeptId}
                                        onChange={(e) => setFreezeDeptId(e.target.value)}
                                        className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-xs font-medium"
                                    >
                                        <option value="">All Assigned Departments</option>
                                        {departments.map((d) => (
                                            <option key={d.id} value={d.id}>{d.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <div>
                                <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                                    Sign-off / Lock Notes:
                                </label>
                                <textarea
                                    rows={3}
                                    value={freezeNotes}
                                    onChange={(e) => setFreezeNotes(e.target.value)}
                                    placeholder="Enter sign-off comments or authorization justification..."
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-xs"
                                />
                            </div>

                            <div className="flex items-center justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setFreezeModalOpen(false)}
                                    className="px-4 py-2 rounded-xl text-slate-600 hover:text-slate-800 text-xs font-semibold"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className={`px-4 py-2 rounded-xl text-white text-xs font-semibold shadow-md transition ${
                                        freezeAction === 'unlock'
                                            ? 'bg-amber-600 hover:bg-amber-500'
                                            : freezeAction === 'hr_lock'
                                            ? 'bg-indigo-600 hover:bg-indigo-500'
                                            : 'bg-sky-600 hover:bg-sky-500'
                                    }`}
                                >
                                    {freezeAction === 'unlock' ? 'Unlock Attendance Records' : freezeAction === 'hr_lock' ? 'Execute Final HR Lock' : 'Confirm HOD Sign-Off'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

        </AuthenticatedLayout>
    );
}
