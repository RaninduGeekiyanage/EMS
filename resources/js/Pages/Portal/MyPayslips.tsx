import React, { useState } from 'react';
import { Head } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import {
    DollarSign,
    Download,
    Eye,
    Receipt,
    CreditCard,
    ShieldCheck,
    Calendar,
    Landmark,
    FileText,
    Percent,
    Sparkles,
    CheckCircle2,
    X,
    Clock,
    Briefcase,
    ShieldAlert,
} from 'lucide-react';

interface PayslipItem {
    id: string;
    period: string;
    payment_mode: string;
    worked_days: number;
    ot_hours: number;
    basic_salary: number;
    allowances: number;
    ot_pay: number;
    gross_pay: number;
    epf_employee: number;
    epf_employer: number;
    etf_employer: number;
    apit_tax: number;
    no_pay_deduction: number;
    other_deductions: number;
    net_pay: number;
    breakdown_json: any;
    run_status: string;
    created_at: string;
}

interface LoanItem {
    id: string;
    loan_type: string;
    principal_amount: number;
    monthly_installment: number;
    remaining_balance: number;
    installment_count: number;
    paid_installments_count: number;
    status: string;
    disbursement_date: string;
}

interface Props {
    employee: {
        id: string;
        emp_no: string;
        full_name: string;
        department_name?: string;
        designation_name?: string;
    } | null;
    payslips: PayslipItem[];
    loans: LoanItem[];
    metrics: {
        latest_net_pay: number;
        ytd_gross_pay: number;
        ytd_epf_employee: number;
        ytd_epf_employer: number;
        total_loan_balance: number;
    };
}

export default function MyPayslips({
    employee,
    payslips,
    loans,
    metrics,
}: Props) {
    const [selectedPayslip, setSelectedPayslip] = useState<PayslipItem | null>(null);

    const formatCurrency = (val: number) => {
        return 'LKR ' + val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    return (
        <AuthenticatedLayout title="My Payslips">
            <Head title="My Payslips — ESS Portal" />

            <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
                {/* Notice if no employee profile linked */}
                {!employee && (
                    <div className="bg-amber-950/30 border border-amber-500/40 rounded-2xl p-4 flex items-center gap-3 text-amber-300 shadow-xl">
                        <ShieldAlert className="w-5 h-5 flex-shrink-0 text-amber-400" />
                        <div className="text-xs">
                            <p className="font-bold">No Employee Master Record Linked</p>
                            <p className="text-amber-400/80">
                                Please contact HR to link your staff record so your salary records and payslips can be retrieved.
                            </p>
                        </div>
                    </div>
                )}

                {/* Header Profile & Security Notice */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-800 text-white font-black text-xl flex items-center justify-center shadow-lg shadow-emerald-600/30">
                            <DollarSign className="w-8 h-8" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                    Confidential Compensation
                                </span>
                                <span className="inline-flex items-center gap-1 text-[10px] font-mono text-slate-400">
                                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                                    Statutory EPF / ETF & APIT Verified
                                </span>
                            </div>
                            <h1 className="text-2xl font-black text-white tracking-tight mt-0.5">
                                My Salary Slips & Remuneration
                            </h1>
                            <p className="text-xs text-slate-400 mt-0.5">
                                {employee?.full_name ?? 'Employee'} • {employee?.department_name ?? 'Team Member'}
                            </p>
                        </div>
                    </div>

                    <div className="text-right self-start md:self-auto bg-slate-950 px-4 py-2.5 rounded-2xl border border-slate-800">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Latest Net Salary</span>
                        <p className="text-xl font-black text-emerald-400 font-mono">
                            {formatCurrency(metrics.latest_net_pay)}
                        </p>
                    </div>
                </div>

                {/* Financial KPI Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-lg flex items-center gap-3.5">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center font-bold">
                            <DollarSign className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">YTD Gross Earnings</p>
                            <p className="text-lg font-black text-white mt-0.5 font-mono">
                                {formatCurrency(metrics.ytd_gross_pay)}
                            </p>
                        </div>
                    </div>

                    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-lg flex items-center gap-3.5">
                        <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center font-bold">
                            <Landmark className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">My EPF Deducted (8%)</p>
                            <p className="text-lg font-black text-indigo-300 mt-0.5 font-mono">
                                {formatCurrency(metrics.ytd_epf_employee)}
                            </p>
                        </div>
                    </div>

                    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-lg flex items-center gap-3.5">
                        <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center justify-center font-bold">
                            <Sparkles className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Employer EPF/ETF (15%)</p>
                            <p className="text-lg font-black text-purple-300 mt-0.5 font-mono">
                                {formatCurrency(metrics.ytd_epf_employer)}
                            </p>
                        </div>
                    </div>

                    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-lg flex items-center gap-3.5">
                        <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center font-bold">
                            <CreditCard className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Active Loans Balance</p>
                            <p className="text-lg font-black text-amber-300 mt-0.5 font-mono">
                                {formatCurrency(metrics.total_loan_balance)}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Payslips Archive Ledger Table */}
                <div className="bg-slate-900/90 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
                    <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Receipt className="w-4 h-4 text-emerald-400" />
                            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                                Disbursed Salary Receipts ({payslips.length})
                            </h2>
                        </div>
                        <span className="text-[11px] text-slate-500">
                            Generated by EMS Sri Lankan Statutory Engine
                        </span>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs text-slate-300">
                            <thead className="bg-slate-950/70 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800">
                                <tr>
                                    <th className="py-3 px-4">Period</th>
                                    <th className="py-3 px-4">Days / OT</th>
                                    <th className="py-3 px-4">Basic Pay</th>
                                    <th className="py-3 px-4">Allowances</th>
                                    <th className="py-3 px-4">Gross Earnings</th>
                                    <th className="py-3 px-4">EPF (8%)</th>
                                    <th className="py-3 px-4">Other Deductions</th>
                                    <th className="py-3 px-4">Net Payout</th>
                                    <th className="py-3 px-4">Status</th>
                                    <th className="py-3 px-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/60">
                                {payslips.length > 0 ? (
                                    payslips.map((ps) => (
                                        <tr key={ps.id} className="hover:bg-slate-800/40 transition">
                                            <td className="py-3 px-4 font-bold text-white font-mono">
                                                {ps.period}
                                            </td>
                                            <td className="py-3 px-4 font-mono text-slate-400">
                                                {ps.worked_days}d • {ps.ot_hours > 0 ? `${ps.ot_hours}h OT` : 'No OT'}
                                            </td>
                                            <td className="py-3 px-4 font-mono">
                                                {formatCurrency(ps.basic_salary)}
                                            </td>
                                            <td className="py-3 px-4 font-mono text-slate-300">
                                                {formatCurrency(ps.allowances + ps.ot_pay)}
                                            </td>
                                            <td className="py-3 px-4 font-mono font-bold text-white">
                                                {formatCurrency(ps.gross_pay)}
                                            </td>
                                            <td className="py-3 px-4 font-mono text-indigo-300">
                                                -{formatCurrency(ps.epf_employee)}
                                            </td>
                                            <td className="py-3 px-4 font-mono text-red-300">
                                                -{formatCurrency(ps.other_deductions + ps.apit_tax + ps.no_pay_deduction)}
                                            </td>
                                            <td className="py-3 px-4 font-mono font-black text-emerald-400 text-sm">
                                                {formatCurrency(ps.net_pay)}
                                            </td>
                                            <td className="py-3 px-4">
                                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase">
                                                    <CheckCircle2 className="w-3 h-3" />
                                                    {ps.run_status}
                                                </span>
                                            </td>
                                            <td className="py-3 px-4 text-right">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    <button
                                                        type="button"
                                                        onClick={() => setSelectedPayslip(ps)}
                                                        className="p-1.5 rounded-xl text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition"
                                                        title="View Itemized Breakdown"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </button>
                                                    <a
                                                        href={`/portal/payslips/${ps.id}/download`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="p-1.5 rounded-xl text-emerald-400 hover:text-white bg-emerald-500/10 hover:bg-emerald-600 transition"
                                                        title="Download Official PDF"
                                                    >
                                                        <Download className="w-4 h-4" />
                                                    </a>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={10} className="py-12 text-center text-slate-500">
                                            No finalized payslips are available for your account yet.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Active Staff Loans Summary (If employee has loans) */}
                {loans.length > 0 && (
                    <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
                        <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
                            <CreditCard className="w-4 h-4 text-amber-400" />
                            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                                Staff Loans & Salary Advances Portfolio
                            </h3>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {loans.map((loan) => (
                                <div key={loan.id} className="bg-slate-950 p-4 rounded-2xl border border-slate-800/80 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="font-bold text-white text-xs uppercase tracking-tight">
                                            {loan.loan_type.replace('_', ' ')}
                                        </span>
                                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase">
                                            {loan.status}
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                        <div>
                                            <span className="text-[10px] text-slate-500">Principal Disbursed</span>
                                            <p className="font-mono text-slate-300 font-semibold">{formatCurrency(loan.principal_amount)}</p>
                                        </div>
                                        <div>
                                            <span className="text-[10px] text-slate-500">Monthly Deduction</span>
                                            <p className="font-mono text-amber-400 font-semibold">-{formatCurrency(loan.monthly_installment)}</p>
                                        </div>
                                        <div>
                                            <span className="text-[10px] text-slate-500">Remaining Balance</span>
                                            <p className="font-mono text-emerald-400 font-bold">{formatCurrency(loan.remaining_balance)}</p>
                                        </div>
                                        <div>
                                            <span className="text-[10px] text-slate-500">Installments Progress</span>
                                            <p className="font-mono text-slate-300">{loan.paid_installments_count} / {loan.installment_count} Paid</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Itemized Payslip Breakdown Modal */}
                {selectedPayslip && (
                    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                        <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-xl w-full p-6 space-y-5 shadow-2xl">
                            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-10 h-10 rounded-2xl bg-emerald-600/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center font-bold">
                                        <FileText className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-bold text-white">Itemized Payslip Details</h3>
                                        <p className="text-xs text-slate-400">Period: {selectedPayslip.period}</p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setSelectedPayslip(null)}
                                    className="p-1 rounded-lg text-slate-400 hover:text-white"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            <div className="space-y-4 text-xs">
                                {/* Top highlight card */}
                                <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex items-center justify-between">
                                    <div>
                                        <span className="text-[10px] text-slate-500 uppercase font-bold">Net Final Payout</span>
                                        <p className="text-2xl font-black text-emerald-400 font-mono mt-0.5">
                                            {formatCurrency(selectedPayslip.net_pay)}
                                        </p>
                                    </div>
                                    <a
                                        href={`/portal/payslips/${selectedPayslip.id}/download`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 transition shadow-md shadow-emerald-600/30"
                                    >
                                        <Download className="w-3.5 h-3.5" />
                                        PDF Slipsheet
                                    </a>
                                </div>

                                {/* Earnings & Deductions Columns */}
                                <div className="grid grid-cols-2 gap-4">
                                    {/* Earnings */}
                                    <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800/80 space-y-2">
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                                            Earnings & Allowances
                                        </p>
                                        <div className="space-y-1.5">
                                            <div className="flex justify-between">
                                                <span className="text-slate-400">Basic Salary:</span>
                                                <span className="font-mono text-white">{formatCurrency(selectedPayslip.basic_salary)}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-slate-400">Overtime Earnings:</span>
                                                <span className="font-mono text-white">{formatCurrency(selectedPayslip.ot_pay)}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-slate-400">Other Allowances:</span>
                                                <span className="font-mono text-white">{formatCurrency(selectedPayslip.allowances)}</span>
                                            </div>
                                            <div className="pt-2 border-t border-slate-800 flex justify-between font-bold">
                                                <span className="text-slate-300">Gross Salary:</span>
                                                <span className="font-mono text-emerald-400">{formatCurrency(selectedPayslip.gross_pay)}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Deductions */}
                                    <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800/80 space-y-2">
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-red-400">
                                            Deductions & Levies
                                        </p>
                                        <div className="space-y-1.5">
                                            <div className="flex justify-between">
                                                <span className="text-slate-400">EPF Employee (8%):</span>
                                                <span className="font-mono text-red-300">-{formatCurrency(selectedPayslip.epf_employee)}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-slate-400">APIT Tax:</span>
                                                <span className="font-mono text-red-300">-{formatCurrency(selectedPayslip.apit_tax)}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-slate-400">No-Pay Deduction:</span>
                                                <span className="font-mono text-red-300">-{formatCurrency(selectedPayslip.no_pay_deduction)}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-slate-400">Other / Loans:</span>
                                                <span className="font-mono text-red-300">-{formatCurrency(selectedPayslip.other_deductions)}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Statutory Employer Contributions */}
                                <div className="bg-purple-950/20 border border-purple-500/20 p-3 rounded-2xl flex items-center justify-between text-purple-200">
                                    <span className="text-[11px]">Employer Statutory Contributions (EPF 12% + ETF 3%):</span>
                                    <span className="font-mono font-bold">
                                        {formatCurrency(selectedPayslip.epf_employer + selectedPayslip.etf_employer)}
                                    </span>
                                </div>
                            </div>

                            <div className="flex justify-end pt-2 border-t border-slate-800">
                                <button
                                    type="button"
                                    onClick={() => setSelectedPayslip(null)}
                                    className="px-5 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition"
                                >
                                    Close Inspector
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </AuthenticatedLayout>
    );
}
