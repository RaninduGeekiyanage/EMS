import React, { useState } from 'react';
import { Head, router, useForm } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import {
    Percent,
    Plus,
    Calendar,
    Search,
    CheckCircle2,
    Clock,
    Trash2,
    DollarSign,
    Users,
    TrendingUp,
    TrendingDown,
    ArrowUpRight,
    ArrowDownRight,
    X,
    Layers,
    ShieldCheck,
    Check,
    FileSpreadsheet,
    AlertCircle,
} from 'lucide-react';

interface PayItemOption {
    id: string;
    code: string;
    name: string;
    item_type: 'earning' | 'deduction';
    is_epf_eligible: boolean;
    is_etf_eligible: boolean;
    is_taxable: boolean;
}

interface PayrollMonthlyAdjustment {
    id: string;
    employee_id: string;
    pay_item_id: string | null;
    period_year: number;
    period_month: number;
    entry_type: 'addition' | 'deduction';
    title: string;
    amount: number;
    is_epf_eligible: boolean;
    is_etf_eligible: boolean;
    is_taxable: boolean;
    status: 'pending' | 'approved' | 'rejected' | 'processed';
    remarks: string | null;
    created_at: string;
    employee?: {
        id: string;
        emp_no: string;
        full_name: string;
        department?: { name: string } | null;
    };
    pay_item?: PayItemOption | null;
    creator?: { id: number; name: string } | null;
    approver?: { id: number; name: string } | null;
}

interface EmployeeOption {
    id: string;
    emp_no: string;
    full_name: string;
    department?: { name: string } | null;
}

interface Props {
    adjustments: PayrollMonthlyAdjustment[];
    employees: EmployeeOption[];
    payItems: PayItemOption[];
    metrics: {
        total_additions: number;
        total_deductions: number;
        pending_count: number;
        affected_employees_count: number;
    };
    selectedYear: number;
    selectedMonth: number;
    availableYears: number[];
}

export default function VariableInputs({
    adjustments,
    employees,
    payItems,
    metrics,
    selectedYear,
    selectedMonth,
    availableYears,
}: Props) {
    const [searchQuery, setSearchQuery] = useState('');
    const [typeFilter, setTypeFilter] = useState<'all' | 'addition' | 'deduction'>('all');
    
    // Modals
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);

    // Form
    const adjustmentForm = useForm({
        employee_id: employees[0]?.id ?? '',
        pay_item_id: '',
        period_year: selectedYear,
        period_month: selectedMonth,
        entry_type: 'addition',
        title: 'Project Completion Bonus',
        amount: 5000,
        is_epf_eligible: false,
        is_etf_eligible: false,
        is_taxable: true,
        remarks: '',
    });

    // Bulk rows
    const [bulkRows, setBulkRows] = useState<Array<{
        employee_id: string;
        entry_type: 'addition' | 'deduction';
        title: string;
        amount: number;
        is_epf_eligible: boolean;
        is_taxable: boolean;
    }>>([
        {
            employee_id: employees[0]?.id ?? '',
            entry_type: 'addition',
            title: 'Attendance Bonus',
            amount: 2500,
            is_epf_eligible: false,
            is_taxable: true,
        },
    ]);

    const formatLKR = (val: number) => {
        return new Intl.NumberFormat('en-LK', {
            style: 'currency',
            currency: 'LKR',
            minimumFractionDigits: 2,
        }).format(val);
    };

    const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December',
    ];

    const handlePeriodChange = (year: number, month: number) => {
        router.get('/payroll/variable-inputs', { year, month }, { preserveState: true });
    };

    const handlePayItemSelect = (payItemId: string) => {
        const item = payItems.find((p) => p.id === payItemId);
        if (item) {
            adjustmentForm.setData({
                ...adjustmentForm.data,
                pay_item_id: payItemId,
                entry_type: item.item_type,
                title: item.name,
                is_epf_eligible: item.is_epf_eligible,
                is_etf_eligible: item.is_etf_eligible,
                is_taxable: item.is_taxable,
            });
        }
    };

    const handleSaveAdjustment = (e: React.FormEvent) => {
        e.preventDefault();
        adjustmentForm.post('/payroll/variable-inputs', {
            onSuccess: () => {
                setIsCreateModalOpen(false);
                adjustmentForm.reset();
            },
        });
    };

    const handleApprove = (adjustment: PayrollMonthlyAdjustment) => {
        router.post(`/payroll/variable-inputs/${adjustment.id}/approve`);
    };

    const handleDelete = (adjustment: PayrollMonthlyAdjustment) => {
        if (confirm(`Delete adjustment '${adjustment.title}' for ${adjustment.employee?.full_name}?`)) {
            router.delete(`/payroll/variable-inputs/${adjustment.id}`);
        }
    };

    const handleAddBulkRow = () => {
        setBulkRows([
            ...bulkRows,
            {
                employee_id: employees[0]?.id ?? '',
                entry_type: 'addition',
                title: 'Special Site Allowance',
                amount: 3000,
                is_epf_eligible: false,
                is_taxable: true,
            },
        ]);
    };

    const handleRemoveBulkRow = (index: number) => {
        if (bulkRows.length > 1) {
            setBulkRows(bulkRows.filter((_, i) => i !== index));
        }
    };

    const handleUpdateBulkRow = (index: number, field: string, value: any) => {
        const updated = [...bulkRows];
        updated[index] = { ...updated[index], [field]: value };
        setBulkRows(updated);
    };

    const handleSaveBulk = (e: React.FormEvent) => {
        e.preventDefault();
        const payload = bulkRows.map((r) => ({
            ...r,
            period_year: selectedYear,
            period_month: selectedMonth,
            is_etf_eligible: r.is_epf_eligible,
        }));

        router.post('/payroll/variable-inputs/bulk', { adjustments: payload }, {
            onSuccess: () => {
                setIsBulkModalOpen(false);
            },
        });
    };

    const netImpact = metrics.total_additions - metrics.total_deductions;

    const filteredAdjustments = adjustments.filter((adj) => {
        const empName = adj.employee?.full_name ?? '';
        const empNo = adj.employee?.emp_no ?? '';
        const title = adj.title ?? '';
        const q = searchQuery.toLowerCase();

        const matchesQuery =
            empName.toLowerCase().includes(q) ||
            empNo.toLowerCase().includes(q) ||
            title.toLowerCase().includes(q);

        const matchesType = typeFilter === 'all' || adj.entry_type === typeFilter;
        return matchesQuery && matchesType;
    });

    return (
        <AuthenticatedLayout>
            <Head title="Monthly Variable Inputs & Adjustments" />

            <div className="space-y-6">
                {/* Header Banner */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 p-6 rounded-2xl shadow-xl border border-indigo-900/40 text-white">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                M04 Enterprise Suite
                            </span>
                            <span className="text-xs text-slate-400">Monthly Compensation Adjustments</span>
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight flex items-center gap-3">
                            <Percent className="w-8 h-8 text-indigo-400" />
                            Monthly Variable Inputs & Adjustments
                        </h1>
                        <p className="text-sm text-slate-300 mt-1 max-w-2xl">
                            Record one-off monthly bonuses, project allowances, uniform deductions, and discretionary payroll adjustments.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5">
                        <button
                            onClick={() => setIsBulkModalOpen(true)}
                            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 border border-indigo-400/30 transition flex items-center gap-1.5 shadow"
                        >
                            <FileSpreadsheet className="w-4 h-4 text-indigo-300" />
                            Bulk Fast Entry
                        </button>

                        <button
                            onClick={() => setIsCreateModalOpen(true)}
                            className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition flex items-center gap-1.5 shadow-lg shadow-indigo-600/25"
                        >
                            <Plus className="w-4 h-4" />
                            New Adjustment
                        </button>
                    </div>
                </div>

                {/* Period Selector & Quick Filters */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
                            <Calendar className="w-4 h-4 text-indigo-500" />
                            Select Payroll Cycle:
                        </div>
                        <select
                            value={selectedMonth}
                            onChange={(e) => handlePeriodChange(selectedYear, parseInt(e.target.value, 10))}
                            className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-900 dark:text-white"
                        >
                            {monthNames.map((m, idx) => (
                                <option key={idx + 1} value={idx + 1}>
                                    {m}
                                </option>
                            ))}
                        </select>
                        <select
                            value={selectedYear}
                            onChange={(e) => handlePeriodChange(parseInt(e.target.value, 10), selectedMonth)}
                            className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-900 dark:text-white"
                        >
                            {availableYears.map((yr) => (
                                <option key={yr} value={yr}>
                                    {yr}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                        Showing adjustments for <span className="font-bold text-slate-900 dark:text-white">{monthNames[selectedMonth - 1]} {selectedYear}</span>
                    </div>
                </div>

                {/* KPI Metrics */}
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Additions</span>
                            <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                                <ArrowUpRight className="w-4 h-4" />
                            </div>
                        </div>
                        <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-2">{formatLKR(metrics.total_additions)}</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Approved bonuses & add-ons</p>
                    </div>

                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Deductions</span>
                            <div className="w-7 h-7 rounded-lg bg-rose-50 dark:bg-rose-950/60 flex items-center justify-center text-rose-600 dark:text-rose-400">
                                <ArrowDownRight className="w-4 h-4" />
                            </div>
                        </div>
                        <p className="text-xl font-bold text-rose-600 dark:text-rose-400 mt-2">{formatLKR(metrics.total_deductions)}</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Fines, damages & advances</p>
                    </div>

                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Net Impact</span>
                            <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                                <DollarSign className="w-4 h-4" />
                            </div>
                        </div>
                        <p className={`text-xl font-bold mt-2 ${netImpact >= 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-rose-600 dark:text-rose-400'}`}>
                            {formatLKR(netImpact)}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Net addition to payroll</p>
                    </div>

                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Pending Approvals</span>
                            <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/60 flex items-center justify-center text-amber-600 dark:text-amber-400">
                                <Clock className="w-4 h-4" />
                            </div>
                        </div>
                        <p className="text-xl font-bold text-amber-600 dark:text-amber-400 mt-2">{metrics.pending_count}</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Require HR confirmation</p>
                    </div>

                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm col-span-2 lg:col-span-1">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Affected Staff</span>
                            <div className="w-7 h-7 rounded-lg bg-purple-50 dark:bg-purple-950/60 flex items-center justify-center text-purple-600 dark:text-purple-400">
                                <Users className="w-4 h-4" />
                            </div>
                        </div>
                        <p className="text-xl font-bold text-purple-600 dark:text-purple-400 mt-2">{metrics.affected_employees_count}</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Employees with variable lines</p>
                    </div>
                </div>

                {/* Adjustments Table Container */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
                    <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="relative flex-1 w-full sm:max-w-xs">
                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search by staff name, emp no, title..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-3 py-1.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                            />
                        </div>

                        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-full sm:w-auto justify-center">
                            <button
                                onClick={() => setTypeFilter('all')}
                                className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                                    typeFilter === 'all'
                                        ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                                        : 'text-slate-600 dark:text-slate-400'
                                }`}
                            >
                                All ({adjustments.length})
                            </button>
                            <button
                                onClick={() => setTypeFilter('addition')}
                                className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                                    typeFilter === 'addition'
                                        ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                                        : 'text-slate-600 dark:text-slate-400'
                                }`}
                            >
                                Additions
                            </button>
                            <button
                                onClick={() => setTypeFilter('deduction')}
                                className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                                    typeFilter === 'deduction'
                                        ? 'bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 shadow-xs'
                                        : 'text-slate-600 dark:text-slate-400'
                                }`}
                            >
                                Deductions
                            </button>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
                            <thead className="bg-slate-50/75 dark:bg-slate-800/50 text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 font-semibold">
                                <tr>
                                    <th className="py-3 px-4">Employee</th>
                                    <th className="py-3 px-3">Title & Classification</th>
                                    <th className="py-3 px-3">Amount</th>
                                    <th className="py-3 px-3">Statutory Flags</th>
                                    <th className="py-3 px-3">Status</th>
                                    <th className="py-3 px-3">Recorded By</th>
                                    <th className="py-3 px-3">Remarks</th>
                                    <th className="py-3 px-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                                {filteredAdjustments.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="py-12 text-center text-slate-400">
                                            No variable inputs found for {monthNames[selectedMonth - 1]} {selectedYear}. Click "+ New Adjustment" to record bonuses or deductions.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredAdjustments.map((adj) => (
                                        <tr key={adj.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                                            <td className="py-3.5 px-4">
                                                <span className="font-mono text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                                                    {adj.employee?.emp_no}
                                                </span>
                                                <p className="text-xs font-bold text-slate-900 dark:text-white mt-0.5">
                                                    {adj.employee?.full_name}
                                                </p>
                                                <p className="text-[11px] text-slate-400">
                                                    {adj.employee?.department?.name ?? 'General'}
                                                </p>
                                            </td>

                                            <td className="py-3.5 px-3">
                                                <p className="text-xs font-bold text-slate-900 dark:text-white">
                                                    {adj.title}
                                                </p>
                                                <div className="flex items-center gap-1.5 mt-0.5">
                                                    {adj.entry_type === 'addition' ? (
                                                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                                            Addition
                                                        </span>
                                                    ) : (
                                                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                                                            Deduction
                                                        </span>
                                                    )}
                                                    {adj.pay_item && (
                                                        <span className="text-[10px] font-mono text-slate-400">
                                                            [{adj.pay_item.code}]
                                                        </span>
                                                    )}
                                                </div>
                                            </td>

                                            <td className="py-3.5 px-3 font-mono font-bold text-slate-900 dark:text-white text-sm">
                                                {formatLKR(Number(adj.amount))}
                                            </td>

                                            <td className="py-3.5 px-3">
                                                <div className="flex flex-wrap gap-1">
                                                    {adj.is_epf_eligible && (
                                                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
                                                            EPF
                                                        </span>
                                                    )}
                                                    {adj.is_taxable ? (
                                                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                                            Taxable
                                                        </span>
                                                    ) : (
                                                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-500">
                                                            Non-Tax
                                                        </span>
                                                    )}
                                                </div>
                                            </td>

                                            <td className="py-3.5 px-3">
                                                {adj.status === 'approved' && (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                                                        <CheckCircle2 className="w-3 h-3" />
                                                        Approved
                                                    </span>
                                                )}
                                                {adj.status === 'processed' && (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300">
                                                        <Check className="w-3 h-3" />
                                                        Processed
                                                    </span>
                                                )}
                                                {adj.status === 'pending' && (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                                                        <Clock className="w-3 h-3" />
                                                        Pending
                                                    </span>
                                                )}
                                            </td>

                                            <td className="py-3.5 px-3 text-[11px] text-slate-400">
                                                {adj.creator?.name ?? 'Admin'}
                                            </td>

                                            <td className="py-3.5 px-3 text-[11px] text-slate-400 max-w-xs truncate">
                                                {adj.remarks ?? '—'}
                                            </td>

                                            <td className="py-3.5 px-4 text-right">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    {adj.status === 'pending' && (
                                                        <button
                                                            onClick={() => handleApprove(adj)}
                                                            className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-sm"
                                                        >
                                                            Approve
                                                        </button>
                                                    )}
                                                    {adj.status !== 'processed' && (
                                                        <button
                                                            onClick={() => handleDelete(adj)}
                                                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-slate-800 transition"
                                                            title="Delete Adjustment"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
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
            </div>

            {/* Modal: New Adjustment */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <Percent className="w-5 h-5 text-indigo-500" />
                                Create Monthly Variable Adjustment
                            </h3>
                            <button
                                onClick={() => setIsCreateModalOpen(false)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSaveAdjustment} className="p-6 space-y-4 text-xs">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2 sm:col-span-1">
                                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                        Employee <span className="text-rose-500">*</span>
                                    </label>
                                    <select
                                        value={adjustmentForm.data.employee_id}
                                        onChange={(e) => adjustmentForm.setData('employee_id', e.target.value)}
                                        className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                                        required
                                    >
                                        {employees.map((emp) => (
                                            <option key={emp.id} value={emp.id}>
                                                {emp.emp_no} - {emp.full_name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="col-span-2 sm:col-span-1">
                                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                        Pre-fill from Pay Item (Optional)
                                    </label>
                                    <select
                                        value={adjustmentForm.data.pay_item_id}
                                        onChange={(e) => handlePayItemSelect(e.target.value)}
                                        className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                                    >
                                        <option value="">Custom Item (No Master Link)</option>
                                        {payItems.map((item) => (
                                            <option key={item.id} value={item.id}>
                                                [{item.code}] {item.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                        Adjustment Type <span className="text-rose-500">*</span>
                                    </label>
                                    <select
                                        value={adjustmentForm.data.entry_type}
                                        onChange={(e) => adjustmentForm.setData('entry_type', e.target.value as any)}
                                        className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                                        required
                                    >
                                        <option value="addition">Addition (Bonus / Allowance)</option>
                                        <option value="deduction">Deduction (Fine / Uniform / Advance)</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                        Amount (LKR) <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={adjustmentForm.data.amount}
                                        onChange={(e) => adjustmentForm.setData('amount', parseFloat(e.target.value) || 0)}
                                        className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono font-bold text-slate-900 dark:text-white"
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                    Adjustment Title / Reason <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={adjustmentForm.data.title}
                                    onChange={(e) => adjustmentForm.setData('title', e.target.value)}
                                    placeholder="e.g. Project Delivery Bonus, Uniform Loss Recovery"
                                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                                    required
                                />
                            </div>

                            {/* Statutory Toggles */}
                            <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                                <span className="font-semibold text-slate-700 dark:text-slate-300 text-xs flex items-center gap-1.5">
                                    <ShieldCheck className="w-4 h-4 text-indigo-500" />
                                    Statutory EPF & Tax Calculation Rules
                                </span>
                                <div className="grid grid-cols-2 gap-3 pt-1">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={adjustmentForm.data.is_epf_eligible}
                                            onChange={(e) => adjustmentForm.setData('is_epf_eligible', e.target.checked)}
                                            className="rounded text-indigo-600 focus:ring-indigo-500"
                                        />
                                        <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300">
                                            Count for EPF/ETF Earnings
                                        </span>
                                    </label>

                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={adjustmentForm.data.is_taxable}
                                            onChange={(e) => adjustmentForm.setData('is_taxable', e.target.checked)}
                                            className="rounded text-indigo-600 focus:ring-indigo-500"
                                        />
                                        <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300">
                                            Taxable Income (APIT)
                                        </span>
                                    </label>
                                </div>
                            </div>

                            <div>
                                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                    Remarks / Audit Justification
                                </label>
                                <textarea
                                    rows={2}
                                    value={adjustmentForm.data.remarks}
                                    onChange={(e) => adjustmentForm.setData('remarks', e.target.value)}
                                    placeholder="Add approval context or documentation reference..."
                                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                                />
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                                <button
                                    type="button"
                                    onClick={() => setIsCreateModalOpen(false)}
                                    className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={adjustmentForm.processing}
                                    className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-lg shadow-indigo-600/30 transition disabled:opacity-50"
                                >
                                    {adjustmentForm.processing ? 'Saving...' : 'Create Adjustment'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal: Bulk Fast Entry */}
            {isBulkModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-4xl w-full shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
                        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <FileSpreadsheet className="w-5 h-5 text-indigo-500" />
                                Bulk Variable Inputs Fast Entry ({monthNames[selectedMonth - 1]} {selectedYear})
                            </h3>
                            <button
                                onClick={() => setIsBulkModalOpen(false)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSaveBulk} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 dark:bg-slate-800 text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                                    <tr>
                                        <th className="py-2.5 px-3">Employee</th>
                                        <th className="py-2.5 px-3">Type</th>
                                        <th className="py-2.5 px-3">Title / Reason</th>
                                        <th className="py-2.5 px-3">Amount (LKR)</th>
                                        <th className="py-2.5 px-3">EPF</th>
                                        <th className="py-2.5 px-3">Taxable</th>
                                        <th className="py-2.5 px-3 text-right"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                                    {bulkRows.map((row, idx) => (
                                        <tr key={idx}>
                                            <td className="py-2 px-2">
                                                <select
                                                    value={row.employee_id}
                                                    onChange={(e) => handleUpdateBulkRow(idx, 'employee_id', e.target.value)}
                                                    className="w-48 px-2 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                                                    required
                                                >
                                                    {employees.map((emp) => (
                                                        <option key={emp.id} value={emp.id}>
                                                            {emp.emp_no} - {emp.full_name}
                                                        </option>
                                                    ))}
                                                </select>
                                            </td>

                                            <td className="py-2 px-2">
                                                <select
                                                    value={row.entry_type}
                                                    onChange={(e) => handleUpdateBulkRow(idx, 'entry_type', e.target.value)}
                                                    className="w-28 px-2 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                                                >
                                                    <option value="addition">Addition</option>
                                                    <option value="deduction">Deduction</option>
                                                </select>
                                            </td>

                                            <td className="py-2 px-2">
                                                <input
                                                    type="text"
                                                    value={row.title}
                                                    onChange={(e) => handleUpdateBulkRow(idx, 'title', e.target.value)}
                                                    placeholder="Title"
                                                    className="w-44 px-2 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                                                    required
                                                />
                                            </td>

                                            <td className="py-2 px-2">
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    value={row.amount}
                                                    onChange={(e) => handleUpdateBulkRow(idx, 'amount', parseFloat(e.target.value) || 0)}
                                                    className="w-28 px-2 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono font-bold text-slate-900 dark:text-white"
                                                    required
                                                />
                                            </td>

                                            <td className="py-2 px-2 text-center">
                                                <input
                                                    type="checkbox"
                                                    checked={row.is_epf_eligible}
                                                    onChange={(e) => handleUpdateBulkRow(idx, 'is_epf_eligible', e.target.checked)}
                                                    className="rounded text-indigo-600 focus:ring-indigo-500"
                                                />
                                            </td>

                                            <td className="py-2 px-2 text-center">
                                                <input
                                                    type="checkbox"
                                                    checked={row.is_taxable}
                                                    onChange={(e) => handleUpdateBulkRow(idx, 'is_taxable', e.target.checked)}
                                                    className="rounded text-indigo-600 focus:ring-indigo-500"
                                                />
                                            </td>

                                            <td className="py-2 px-2 text-right">
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveBulkRow(idx)}
                                                    className="p-1 rounded text-slate-400 hover:text-rose-600"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            <div className="pt-2">
                                <button
                                    type="button"
                                    onClick={handleAddBulkRow}
                                    className="px-3 py-1.5 rounded-xl border border-dashed border-indigo-400 text-indigo-600 dark:text-indigo-400 text-xs font-semibold hover:bg-indigo-50 dark:hover:bg-slate-800 transition flex items-center gap-1.5"
                                >
                                    <Plus className="w-3.5 h-3.5" />
                                    Add Another Employee Line
                                </button>
                            </div>

                            <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                                <span className="text-xs text-slate-500">
                                    Total {bulkRows.length} adjustment records to submit
                                </span>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setIsBulkModalOpen(false)}
                                        className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-semibold"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 transition"
                                    >
                                        Submit Batch Adjustments
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </AuthenticatedLayout>
    );
}
