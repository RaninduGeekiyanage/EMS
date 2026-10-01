import React, { useState } from 'react';
import { Head, router, useForm } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import {
    CreditCard,
    Plus,
    Search,
    Calendar,
    DollarSign,
    TrendingDown,
    Clock,
    CheckCircle2,
    PauseCircle,
    PlayCircle,
    XCircle,
    AlertCircle,
    ChevronRight,
    User,
    Building2,
    X,
    FileText,
    Percent,
    SkipForward,
    ShieldAlert,
} from 'lucide-react';

interface EmployeeLoanInstallment {
    id: string;
    employee_loan_id: string;
    installment_number: number;
    due_year: number;
    due_month: number;
    amount: number;
    paid_amount: number;
    status: 'scheduled' | 'deducted' | 'skipped' | 'partially_paid';
    deducted_at: string | null;
    remarks: string | null;
}

interface EmployeeLoan {
    id: string;
    employee_id: string;
    loan_reference_no: string;
    loan_title: string;
    principal_amount: number;
    interest_rate_percentage: number;
    total_payable_amount: number;
    monthly_installment: number;
    installment_count: number;
    disbursed_at: string;
    deduction_start_month: string;
    status: 'pending' | 'active' | 'paused' | 'completed' | 'cancelled';
    total_paid_amount: number;
    remaining_balance: number;
    notes: string | null;
    created_at: string;
    employee?: {
        id: string;
        emp_no: string;
        full_name: string;
        department?: { name: string } | null;
    };
    approver?: {
        id: number;
        name: string;
    } | null;
    installments?: EmployeeLoanInstallment[];
}

interface EmployeeOption {
    id: string;
    emp_no: string;
    full_name: string;
    department?: { name: string } | null;
}

interface Props {
    loans: EmployeeLoan[];
    employees: EmployeeOption[];
    metrics: {
        total_loans: number;
        active_loans: number;
        total_principal: number;
        total_repaid: number;
        outstanding_balance: number;
        due_this_month: number;
    };
    currentPeriod: {
        year: number;
        month: number;
        label: string;
    };
}

export default function Loans({
    loans,
    employees,
    metrics,
    currentPeriod,
}: Props) {
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'paused' | 'completed'>('all');
    
    // Modals
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [selectedLoanForSchedule, setSelectedLoanForSchedule] = useState<EmployeeLoan | null>(null);
    const [skippingInstallment, setSkippingInstallment] = useState<EmployeeLoanInstallment | null>(null);
    const [skipRemarks, setSkipRemarks] = useState('');

    const loanForm = useForm({
        employee_id: employees[0]?.id ?? '',
        loan_title: 'Staff Distress Advance',
        loan_reference_no: '',
        principal_amount: 50000,
        interest_rate_percentage: 0,
        installment_count: 10,
        monthly_installment: 5000,
        disbursed_at: new Date().toISOString().slice(0, 10),
        deduction_start_month: new Date().toISOString().slice(0, 7) + '-01',
        notes: '',
    });

    const formatLKR = (val: number) => {
        return new Intl.NumberFormat('en-LK', {
            style: 'currency',
            currency: 'LKR',
            minimumFractionDigits: 2,
        }).format(val);
    };

    // Recalculate live preview
    const handlePrincipalChange = (val: number) => {
        const count = loanForm.data.installment_count || 1;
        const interest = loanForm.data.interest_rate_percentage || 0;
        const total = val + val * (interest / 100);
        loanForm.setData({
            ...loanForm.data,
            principal_amount: val,
            monthly_installment: Math.round((total / count) * 100) / 100,
        });
    };

    const handleCountChange = (val: number) => {
        const count = Math.max(1, val);
        const principal = loanForm.data.principal_amount || 0;
        const interest = loanForm.data.interest_rate_percentage || 0;
        const total = principal + principal * (interest / 100);
        loanForm.setData({
            ...loanForm.data,
            installment_count: count,
            monthly_installment: Math.round((total / count) * 100) / 100,
        });
    };

    const handleInterestChange = (val: number) => {
        const count = loanForm.data.installment_count || 1;
        const principal = loanForm.data.principal_amount || 0;
        const total = principal + principal * (val / 100);
        loanForm.setData({
            ...loanForm.data,
            interest_rate_percentage: val,
            monthly_installment: Math.round((total / count) * 100) / 100,
        });
    };

    const handleCreateLoan = (e: React.FormEvent) => {
        e.preventDefault();
        loanForm.post('/payroll/loans', {
            onSuccess: () => {
                setIsCreateModalOpen(false);
                loanForm.reset();
            },
        });
    };

    const handlePauseLoan = (loan: EmployeeLoan) => {
        if (confirm(`Pause payroll deductions for loan '${loan.loan_reference_no}'?`)) {
            router.post(`/payroll/loans/${loan.id}/pause`);
        }
    };

    const handleResumeLoan = (loan: EmployeeLoan) => {
        if (confirm(`Resume payroll deductions for loan '${loan.loan_reference_no}'?`)) {
            router.post(`/payroll/loans/${loan.id}/resume`);
        }
    };

    const handleCancelLoan = (loan: EmployeeLoan) => {
        if (confirm(`Cancel loan '${loan.loan_reference_no}' and void all remaining scheduled installments?`)) {
            router.post(`/payroll/loans/${loan.id}/cancel`);
        }
    };

    const handleConfirmSkipInstallment = () => {
        if (!skippingInstallment) return;
        router.post(
            `/payroll/loans/installments/${skippingInstallment.id}/skip`,
            { remarks: skipRemarks },
            {
                onSuccess: () => {
                    setSkippingInstallment(null);
                    setSkipRemarks('');
                    setSelectedLoanForSchedule(null);
                },
            }
        );
    };

    const filteredLoans = loans.filter((loan) => {
        const empName = loan.employee?.full_name ?? '';
        const empNo = loan.employee?.emp_no ?? '';
        const refNo = loan.loan_reference_no ?? '';
        const title = loan.loan_title ?? '';
        const q = searchQuery.toLowerCase();

        const matchesQuery =
            empName.toLowerCase().includes(q) ||
            empNo.toLowerCase().includes(q) ||
            refNo.toLowerCase().includes(q) ||
            title.toLowerCase().includes(q);

        const matchesStatus = statusFilter === 'all' || loan.status === statusFilter;
        return matchesQuery && matchesStatus;
    });

    return (
        <AuthenticatedLayout>
            <Head title="Staff Loans & Salary Advances Ledger" />

            <div className="space-y-6">
                {/* Header Banner */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 p-6 rounded-2xl shadow-xl border border-indigo-900/40 text-white">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                M04 Enterprise Suite
                            </span>
                            <span className="text-xs text-slate-400">Staff Advances & Amortization</span>
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight flex items-center gap-3">
                            <CreditCard className="w-8 h-8 text-indigo-400" />
                            Staff Loans & Advances Ledger
                        </h1>
                        <p className="text-sm text-slate-300 mt-1 max-w-2xl">
                            Issue staff festival advances, personal loans, track monthly payroll deductions, and manage deferrals.
                        </p>
                    </div>

                    <div>
                        <button
                            onClick={() => setIsCreateModalOpen(true)}
                            className="px-4 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition flex items-center gap-2 shadow-lg shadow-indigo-600/25"
                        >
                            <Plus className="w-4 h-4" />
                            New Loan / Advance
                        </button>
                    </div>
                </div>

                {/* KPI Metrics */}
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Disbursed</span>
                            <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                                <DollarSign className="w-4 h-4" />
                            </div>
                        </div>
                        <p className="text-xl font-bold text-slate-900 dark:text-white mt-2">{formatLKR(metrics.total_principal)}</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{metrics.total_loans} total loans issued</p>
                    </div>

                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Recovered</span>
                            <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                                <CheckCircle2 className="w-4 h-4" />
                            </div>
                        </div>
                        <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-2">{formatLKR(metrics.total_repaid)}</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Deducted via payroll</p>
                    </div>

                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Outstanding Balance</span>
                            <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/60 flex items-center justify-center text-amber-600 dark:text-amber-400">
                                <TrendingDown className="w-4 h-4" />
                            </div>
                        </div>
                        <p className="text-xl font-bold text-amber-600 dark:text-amber-400 mt-2">{formatLKR(metrics.outstanding_balance)}</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Remaining capital to collect</p>
                    </div>

                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Due This Month</span>
                            <div className="w-7 h-7 rounded-lg bg-sky-50 dark:bg-sky-950/60 flex items-center justify-center text-sky-600 dark:text-sky-400">
                                <Calendar className="w-4 h-4" />
                            </div>
                        </div>
                        <p className="text-xl font-bold text-sky-600 dark:text-sky-400 mt-2">{formatLKR(metrics.due_this_month)}</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{currentPeriod.label} installments</p>
                    </div>

                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm col-span-2 lg:col-span-1">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Active Portfolio</span>
                            <div className="w-7 h-7 rounded-lg bg-purple-50 dark:bg-purple-950/60 flex items-center justify-center text-purple-600 dark:text-purple-400">
                                <Clock className="w-4 h-4" />
                            </div>
                        </div>
                        <p className="text-xl font-bold text-purple-600 dark:text-purple-400 mt-2">{metrics.active_loans}</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Currently deducting loans</p>
                    </div>
                </div>

                {/* Filter and Table Container */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
                    <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="relative flex-1 w-full sm:max-w-xs">
                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search by employee, ref no, or loan..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-3 py-1.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                            />
                        </div>

                        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-full sm:w-auto justify-center">
                            <button
                                onClick={() => setStatusFilter('all')}
                                className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                                    statusFilter === 'all'
                                        ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                                        : 'text-slate-600 dark:text-slate-400'
                                }`}
                            >
                                All ({loans.length})
                            </button>
                            <button
                                onClick={() => setStatusFilter('active')}
                                className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                                    statusFilter === 'active'
                                        ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                                        : 'text-slate-600 dark:text-slate-400'
                                }`}
                            >
                                Active
                            </button>
                            <button
                                onClick={() => setStatusFilter('paused')}
                                className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                                    statusFilter === 'paused'
                                        ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-xs'
                                        : 'text-slate-600 dark:text-slate-400'
                                }`}
                            >
                                Paused
                            </button>
                            <button
                                onClick={() => setStatusFilter('completed')}
                                className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                                    statusFilter === 'completed'
                                        ? 'bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-400 shadow-xs'
                                        : 'text-slate-600 dark:text-slate-400'
                                }`}
                            >
                                Completed
                            </button>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
                            <thead className="bg-slate-50/75 dark:bg-slate-800/50 text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 font-semibold">
                                <tr>
                                    <th className="py-3 px-4">Ref & Title</th>
                                    <th className="py-3 px-3">Employee</th>
                                    <th className="py-3 px-3">Principal</th>
                                    <th className="py-3 px-3">Monthly Installment</th>
                                    <th className="py-3 px-3">Repayment Progress</th>
                                    <th className="py-3 px-3">Balance Remaining</th>
                                    <th className="py-3 px-3">Status</th>
                                    <th className="py-3 px-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                                {filteredLoans.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="py-12 text-center text-slate-400">
                                            No employee loans matching criteria. Click "+ New Loan / Advance" to issue a loan.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredLoans.map((loan) => {
                                        const total = Number(loan.total_payable_amount);
                                        const paid = Number(loan.total_paid_amount);
                                        const pct = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;

                                        return (
                                            <tr key={loan.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                                                <td className="py-3.5 px-4">
                                                    <span className="font-mono text-[11px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800">
                                                        {loan.loan_reference_no}
                                                    </span>
                                                    <p className="text-xs font-bold text-slate-900 dark:text-white mt-1">
                                                        {loan.loan_title}
                                                    </p>
                                                    <p className="text-[11px] text-slate-400">
                                                        Disbursed: {loan.disbursed_at}
                                                    </p>
                                                </td>

                                                <td className="py-3.5 px-3">
                                                    <p className="text-xs font-bold text-slate-900 dark:text-white">
                                                        {loan.employee?.full_name}
                                                    </p>
                                                    <p className="font-mono text-[11px] text-slate-400">
                                                        {loan.employee?.emp_no} • {loan.employee?.department?.name ?? 'General'}
                                                    </p>
                                                </td>

                                                <td className="py-3.5 px-3">
                                                    <span className="font-mono font-bold text-slate-900 dark:text-white text-sm">
                                                        {formatLKR(Number(loan.principal_amount))}
                                                    </span>
                                                    {Number(loan.interest_rate_percentage) > 0 ? (
                                                        <p className="text-[10px] text-slate-400">
                                                            + {loan.interest_rate_percentage}% Interest
                                                        </p>
                                                    ) : (
                                                        <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                                                            0% Interest Free
                                                        </p>
                                                    )}
                                                </td>

                                                <td className="py-3.5 px-3">
                                                    <span className="font-mono font-bold text-slate-900 dark:text-white">
                                                        {formatLKR(Number(loan.monthly_installment))}
                                                    </span>
                                                    <p className="text-[10px] text-slate-400">
                                                        {loan.installment_count} monthly deductions
                                                    </p>
                                                </td>

                                                <td className="py-3.5 px-3">
                                                    <div className="w-36">
                                                        <div className="flex items-center justify-between text-[10px] font-semibold mb-1">
                                                            <span className="text-emerald-600 dark:text-emerald-400">{pct}% Repaid</span>
                                                            <span className="text-slate-400">{formatLKR(paid)}</span>
                                                        </div>
                                                        <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                                                            <div
                                                                className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500"
                                                                style={{ width: `${pct}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                </td>

                                                <td className="py-3.5 px-3 font-mono font-bold text-amber-600 dark:text-amber-400 text-sm">
                                                    {formatLKR(Number(loan.remaining_balance))}
                                                </td>

                                                <td className="py-3.5 px-3">
                                                    {loan.status === 'active' && (
                                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                                                            <PlayCircle className="w-3 h-3" />
                                                            Active
                                                        </span>
                                                    )}
                                                    {loan.status === 'paused' && (
                                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                                                            <PauseCircle className="w-3 h-3" />
                                                            Paused
                                                        </span>
                                                    )}
                                                    {loan.status === 'completed' && (
                                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300">
                                                            <CheckCircle2 className="w-3 h-3" />
                                                            Completed
                                                        </span>
                                                    )}
                                                    {loan.status === 'cancelled' && (
                                                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
                                                            <XCircle className="w-3 h-3" />
                                                            Cancelled
                                                        </span>
                                                    )}
                                                </td>

                                                <td className="py-3.5 px-4 text-right">
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        <button
                                                            onClick={() => setSelectedLoanForSchedule(loan)}
                                                            className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition"
                                                        >
                                                            Schedule
                                                        </button>

                                                        {loan.status === 'active' && (
                                                            <button
                                                                onClick={() => handlePauseLoan(loan)}
                                                                className="p-1 rounded-lg text-amber-600 hover:bg-amber-50 dark:hover:bg-slate-800 transition"
                                                                title="Pause Deductions"
                                                            >
                                                                <PauseCircle className="w-4 h-4" />
                                                            </button>
                                                        )}

                                                        {loan.status === 'paused' && (
                                                            <button
                                                                onClick={() => handleResumeLoan(loan)}
                                                                className="p-1 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-slate-800 transition"
                                                                title="Resume Deductions"
                                                            >
                                                                <PlayCircle className="w-4 h-4" />
                                                            </button>
                                                        )}

                                                        {['active', 'paused'].includes(loan.status) && (
                                                            <button
                                                                onClick={() => handleCancelLoan(loan)}
                                                                className="p-1 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-slate-800 transition"
                                                                title="Cancel Remaining Loan"
                                                            >
                                                                <XCircle className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Modal: New Staff Loan */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <CreditCard className="w-5 h-5 text-indigo-500" />
                                Issue New Staff Loan / Salary Advance
                            </h3>
                            <button
                                onClick={() => setIsCreateModalOpen(false)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleCreateLoan} className="p-6 space-y-4 text-xs">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2 sm:col-span-1">
                                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                        Beneficiary Employee <span className="text-rose-500">*</span>
                                    </label>
                                    <select
                                        value={loanForm.data.employee_id}
                                        onChange={(e) => loanForm.setData('employee_id', e.target.value)}
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
                                        Loan Reference No
                                    </label>
                                    <input
                                        type="text"
                                        value={loanForm.data.loan_reference_no}
                                        onChange={(e) => loanForm.setData('loan_reference_no', e.target.value)}
                                        placeholder="Leave blank to auto-generate"
                                        className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono text-slate-900 dark:text-white"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                    Loan Title / Purpose <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={loanForm.data.loan_title}
                                    onChange={(e) => loanForm.setData('loan_title', e.target.value)}
                                    placeholder="e.g. Festival Advance, Distress Loan, Motorbike Advance"
                                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                        Principal (LKR) <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="number"
                                        step="1000"
                                        value={loanForm.data.principal_amount}
                                        onChange={(e) => handlePrincipalChange(parseFloat(e.target.value) || 0)}
                                        className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono font-bold text-slate-900 dark:text-white"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                        Tenure (Months) <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="60"
                                        value={loanForm.data.installment_count}
                                        onChange={(e) => handleCountChange(parseInt(e.target.value, 10) || 1)}
                                        className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                        Interest Rate (%)
                                    </label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        value={loanForm.data.interest_rate_percentage}
                                        onChange={(e) => handleInterestChange(parseFloat(e.target.value) || 0)}
                                        className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                                    />
                                </div>
                            </div>

                            {/* Live Calculation Callout */}
                            <div className="bg-indigo-50 dark:bg-indigo-950/50 p-4 rounded-xl border border-indigo-200 dark:border-indigo-800/80 flex items-center justify-between">
                                <div>
                                    <span className="text-[11px] font-semibold text-indigo-700 dark:text-indigo-300 uppercase tracking-wider">
                                        Calculated Monthly Installment
                                    </span>
                                    <p className="text-xl font-mono font-bold text-indigo-900 dark:text-indigo-200 mt-0.5">
                                        {formatLKR(loanForm.data.monthly_installment)} / month
                                    </p>
                                </div>
                                <div className="text-right">
                                    <span className="text-[11px] text-slate-500 dark:text-slate-400">Total Repayable</span>
                                    <p className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                                        {formatLKR(loanForm.data.principal_amount + (loanForm.data.principal_amount * loanForm.data.interest_rate_percentage) / 100)}
                                    </p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                        Disbursed Date <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="date"
                                        value={loanForm.data.disbursed_at}
                                        onChange={(e) => loanForm.setData('disbursed_at', e.target.value)}
                                        className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                        First Deduction Month <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="date"
                                        value={loanForm.data.deduction_start_month}
                                        onChange={(e) => loanForm.setData('deduction_start_month', e.target.value)}
                                        className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                    Management Notes / Approval Authority
                                </label>
                                <textarea
                                    rows={2}
                                    value={loanForm.data.notes}
                                    onChange={(e) => loanForm.setData('notes', e.target.value)}
                                    placeholder="Approved per HR committee minute / staff agreement..."
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
                                    disabled={loanForm.processing}
                                    className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-lg shadow-indigo-600/30 transition disabled:opacity-50"
                                >
                                    {loanForm.processing ? 'Generating...' : 'Disburse & Generate Schedule'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal / Drawer: Installment Schedule */}
            {selectedLoanForSchedule && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-xl w-full shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
                        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                            <div>
                                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                    <Calendar className="w-5 h-5 text-indigo-500" />
                                    Installment Schedule: {selectedLoanForSchedule.loan_reference_no}
                                </h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                    {selectedLoanForSchedule.employee?.full_name} • {selectedLoanForSchedule.loan_title}
                                </p>
                            </div>
                            <button
                                onClick={() => setSelectedLoanForSchedule(null)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto flex-1 space-y-3">
                            <div className="grid grid-cols-3 gap-2 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl text-center text-xs">
                                <div>
                                    <span className="text-slate-400 text-[10px] uppercase">Principal</span>
                                    <p className="font-bold font-mono text-slate-900 dark:text-white">
                                        {formatLKR(Number(selectedLoanForSchedule.principal_amount))}
                                    </p>
                                </div>
                                <div>
                                    <span className="text-slate-400 text-[10px] uppercase">Recovered</span>
                                    <p className="font-bold font-mono text-emerald-600 dark:text-emerald-400">
                                        {formatLKR(Number(selectedLoanForSchedule.total_paid_amount))}
                                    </p>
                                </div>
                                <div>
                                    <span className="text-slate-400 text-[10px] uppercase">Remaining</span>
                                    <p className="font-bold font-mono text-amber-600 dark:text-amber-400">
                                        {formatLKR(Number(selectedLoanForSchedule.remaining_balance))}
                                    </p>
                                </div>
                            </div>

                            <table className="w-full text-left text-xs">
                                <thead className="bg-slate-100 dark:bg-slate-800 text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                                    <tr>
                                        <th className="py-2.5 px-3">#</th>
                                        <th className="py-2.5 px-3">Due Period</th>
                                        <th className="py-2.5 px-3">Amount</th>
                                        <th className="py-2.5 px-3">Status</th>
                                        <th className="py-2.5 px-3 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                                    {(selectedLoanForSchedule.installments ?? []).map((inst) => (
                                        <tr key={inst.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                                            <td className="py-2.5 px-3 font-mono font-bold text-slate-700 dark:text-slate-300">
                                                #{inst.installment_number}
                                            </td>
                                            <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-slate-200">
                                                {new Date(inst.due_year, inst.due_month - 1).toLocaleString('default', {
                                                    month: 'short',
                                                    year: 'numeric',
                                                })}
                                            </td>
                                            <td className="py-2.5 px-3 font-mono font-bold text-slate-900 dark:text-white">
                                                {formatLKR(Number(inst.amount))}
                                            </td>
                                            <td className="py-2.5 px-3">
                                                {inst.status === 'deducted' && (
                                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                                                        Deducted
                                                    </span>
                                                )}
                                                {inst.status === 'scheduled' && (
                                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                                                        Scheduled
                                                    </span>
                                                )}
                                                {inst.status === 'skipped' && (
                                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                                                        Skipped
                                                    </span>
                                                )}
                                            </td>
                                            <td className="py-2.5 px-3 text-right">
                                                {inst.status === 'scheduled' && (
                                                    <button
                                                        onClick={() => setSkippingInstallment(inst)}
                                                        className="px-2 py-1 rounded-lg text-[11px] font-semibold bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 transition"
                                                    >
                                                        Skip Month
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex justify-end">
                            <button
                                onClick={() => setSelectedLoanForSchedule(null)}
                                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-semibold text-xs transition"
                            >
                                Close Schedule
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Confirm Skip Installment */}
            {skippingInstallment && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl">
                        <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold text-sm mb-2">
                            <SkipForward className="w-5 h-5" />
                            Skip & Defer Installment #{skippingInstallment.installment_number}
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-300 mb-3">
                            Skipping this month's installment of <span className="font-mono font-bold text-slate-900 dark:text-white">{formatLKR(Number(skippingInstallment.amount))}</span> will append a new installment to the end of the loan tenure.
                        </p>
                        <textarea
                            rows={2}
                            value={skipRemarks}
                            onChange={(e) => setSkipRemarks(e.target.value)}
                            placeholder="Reason for skipping installment (e.g. employee requested hardship deferral)..."
                            className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white mb-4"
                        />
                        <div className="flex items-center justify-end gap-2">
                            <button
                                onClick={() => setSkippingInstallment(null)}
                                className="px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-semibold"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleConfirmSkipInstallment}
                                className="px-4 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow"
                            >
                                Confirm Deferral
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </AuthenticatedLayout>
    );
}
