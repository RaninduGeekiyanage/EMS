import React, { useState } from 'react';
import { Head, Link, router, useForm } from '@inertiajs/react';
import axios from 'axios';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import {
    DollarSign,
    Calendar,
    Users,
    ShieldCheck,
    CheckCircle2,
    Lock,
    Play,
    Settings,
    Eye,
    Trash2,
    RefreshCw,
    X,
    FileText,
    TrendingUp,
    AlertTriangle,
    Sliders,
    Building2,
    Briefcase,
    Loader2,
} from 'lucide-react';

interface PayrollRunItem {
    id: string;
    period_year: number;
    period_month: number;
    period_label: string;
    status: 'draft' | 'processing' | 'approved' | 'locked';
    total_gross: number;
    total_net: number;
    total_epf_employee: number;
    total_epf_employer: number;
    total_etf: number;
    total_apit: number;
    total_deductions: number;
    employee_count: number;
    run_by?: string | null;
    approved_by?: string | null;
    approved_at?: string | null;
    notes?: string | null;
    created_at?: string | null;
}

interface StatutorySettings {
    epf_enabled: boolean;
    epf_employee_rate: number;
    epf_employer_rate: number;
    etf_employer_rate: number;
    shop_office_nopay_divisor: number;
    wages_board_nopay_divisor: number;
}

interface Props {
    runs: PayrollRunItem[];
    selectedYear: number;
    availableYears: number[];
    metrics: {
        annual_gross: number;
        annual_net: number;
        annual_epf_employer: number;
        annual_etf: number;
        total_runs: number;
    };
    settings: StatutorySettings;
}

export default function Index({
    runs,
    selectedYear,
    availableYears,
    metrics,
    settings,
}: Props) {
    const [isRunModalOpen, setIsRunModalOpen] = useState(false);
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
    const [runToDelete, setRunToDelete] = useState<PayrollRunItem | null>(null);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [previewData, setPreviewData] = useState<any | null>(null);

    const runForm = useForm({
        period_year: selectedYear,
        period_month: new Date().getMonth() + 1,
        notes: '',
    });

    const settingsForm = useForm({
        epf_enabled: settings.epf_enabled,
        epf_employee_rate: settings.epf_employee_rate,
        epf_employer_rate: settings.epf_employer_rate,
        etf_employer_rate: settings.etf_employer_rate,
        shop_office_nopay_divisor: settings.shop_office_nopay_divisor,
        wages_board_nopay_divisor: settings.wages_board_nopay_divisor,
    });

    const formatLKR = (val: number) => {
        return new Intl.NumberFormat('en-LK', {
            style: 'currency',
            currency: 'LKR',
            minimumFractionDigits: 2,
        }).format(val || 0);
    };

    const handleYearChange = (year: number) => {
        router.get('/payroll', { year }, { preserveState: true, replace: true });
    };

    const handleRunSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        runForm.post('/payroll/runs', {
            onSuccess: () => {
                setIsRunModalOpen(false);
                setPreviewData(null);
            },
        });
    };

    const handlePreview = () => {
        setPreviewLoading(true);
        axios
            .post('/payroll/preview', {
                period_year: runForm.data.period_year,
                period_month: runForm.data.period_month,
            })
            .then((res) => {
                setPreviewData(res.data.summary);
            })
            .catch((err) => {
                console.error(err);
            })
            .finally(() => {
                setPreviewLoading(false);
            });
    };

    const handleSettingsSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        settingsForm.post('/payroll/settings', {
            onSuccess: () => {
                setIsSettingsModalOpen(false);
            },
        });
    };

    const handleDeleteConfirm = () => {
        if (!runToDelete) return;
        router.delete(`/payroll/${runToDelete.id}`, {
            onFinish: () => setRunToDelete(null),
        });
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'locked':
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <Lock className="w-3 h-3" /> Locked
                    </span>
                );
            case 'approved':
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        <CheckCircle2 className="w-3 h-3" /> Approved
                    </span>
                );
            case 'processing':
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        <RefreshCw className="w-3 h-3 animate-spin" /> Processing
                    </span>
                );
            default:
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-500/10 text-slate-300 border border-slate-500/20">
                        <FileText className="w-3 h-3" /> Draft
                    </span>
                );
        }
    };

    return (
        <AuthenticatedLayout title="Payroll Runs & Compliance">
            <Head title="Payroll & Statutory Compliance" />

            <div className="space-y-6 max-w-7xl mx-auto">
                {/* Header Subnavigation & Control Bar */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                                <DollarSign className="w-6 h-6" />
                            </span>
                            <div>
                                <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-3">
                                    Payroll & Statutory Compliance
                                    <span className="text-xs px-2.5 py-0.5 rounded-full font-mono font-medium bg-slate-800 text-indigo-300 border border-slate-700">
                                        M03 Phase 1
                                    </span>
                                </h1>
                                <p className="text-xs text-slate-400">
                                    Multi-mode wages (Monthly, Daily, Hourly), Shop & Office Act, Wages Board, EPF/ETF and APIT Tax.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl px-2 py-1">
                            <Calendar className="w-4 h-4 text-slate-400 mr-2" />
                            <select
                                value={selectedYear}
                                onChange={(e) => handleYearChange(Number(e.target.value))}
                                className="bg-transparent text-sm text-white font-medium border-0 focus:ring-0 py-1 pl-1 pr-6 cursor-pointer"
                            >
                                {availableYears.map((yr) => (
                                    <option key={yr} value={yr} className="bg-slate-900 text-white">
                                        Year {yr}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <button
                            onClick={() => setIsSettingsModalOpen(true)}
                            className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 text-xs font-semibold flex items-center gap-2 transition"
                            title="Statutory Settings"
                        >
                            <Settings className="w-4 h-4 text-slate-400" />
                            <span>Statutory Setup</span>
                        </button>

                        <button
                            onClick={() => setIsRunModalOpen(true)}
                            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-indigo-600/20 transition"
                        >
                            <Play className="w-4 h-4" />
                            <span>Run Payroll</span>
                        </button>
                    </div>
                </div>

                {/* Statutory Quick Status Card */}
                <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-900/90 via-slate-900/60 to-slate-900/90 border border-slate-800/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className={`p-2.5 rounded-xl ${settings.epf_enabled ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}`}>
                            <ShieldCheck className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-sm font-semibold text-white">
                                    Company EPF/ETF Scheme: {settings.epf_enabled ? 'Enabled' : 'Disabled'}
                                </h3>
                                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${settings.epf_enabled ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'}`}>
                                    {settings.epf_enabled ? 'Statutory Active' : 'Non-Statutory Entity'}
                                </span>
                            </div>
                            <p className="text-xs text-slate-400 mt-0.5">
                                Rates: Employee EPF {settings.epf_employee_rate}% | Employer EPF {settings.epf_employer_rate}% | ETF {settings.etf_employer_rate}%
                                &nbsp;•&nbsp; No-Pay: Shop & Office ({settings.shop_office_nopay_divisor}d), Wages Board ({settings.wages_board_nopay_divisor}d)
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={() => setIsSettingsModalOpen(true)}
                        className="text-xs text-indigo-400 hover:text-indigo-300 underline font-medium flex items-center gap-1"
                    >
                        <Sliders className="w-3.5 h-3.5" /> Adjust Configuration
                    </button>
                </div>

                {/* Financial KPI Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80">
                        <div className="flex items-center justify-between text-slate-400 mb-2">
                            <span className="text-xs font-semibold uppercase tracking-wider">Annual Net Disbursal</span>
                            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
                                <TrendingUp className="w-4 h-4" />
                            </div>
                        </div>
                        <p className="text-xl font-bold text-white tracking-tight">
                            {formatLKR(metrics.annual_net)}
                        </p>
                        <p className="text-[11px] text-slate-500 mt-1">
                            Net salary paid across {metrics.total_runs} periods in {selectedYear}
                        </p>
                    </div>

                    <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80">
                        <div className="flex items-center justify-between text-slate-400 mb-2">
                            <span className="text-xs font-semibold uppercase tracking-wider">Total Gross Payroll</span>
                            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
                                <DollarSign className="w-4 h-4" />
                            </div>
                        </div>
                        <p className="text-xl font-bold text-white tracking-tight">
                            {formatLKR(metrics.annual_gross)}
                        </p>
                        <p className="text-[11px] text-slate-500 mt-1">
                            Before statutory & APIT tax deductions
                        </p>
                    </div>

                    <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80">
                        <div className="flex items-center justify-between text-slate-400 mb-2">
                            <span className="text-xs font-semibold uppercase tracking-wider">Employer EPF (12%)</span>
                            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
                                <ShieldCheck className="w-4 h-4" />
                            </div>
                        </div>
                        <p className="text-xl font-bold text-white tracking-tight">
                            {formatLKR(metrics.annual_epf_employer)}
                        </p>
                        <p className="text-[11px] text-slate-500 mt-1">
                            Central Bank statutory remittance liability
                        </p>
                    </div>

                    <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80">
                        <div className="flex items-center justify-between text-slate-400 mb-2">
                            <span className="text-xs font-semibold uppercase tracking-wider">Employer ETF (3%)</span>
                            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
                                <Building2 className="w-4 h-4" />
                            </div>
                        </div>
                        <p className="text-xl font-bold text-white tracking-tight">
                            {formatLKR(metrics.annual_etf)}
                        </p>
                        <p className="text-[11px] text-slate-500 mt-1">
                            Employees Trust Fund statutory contribution
                        </p>
                    </div>
                </div>

                {/* Runs Data Table */}
                <div className="rounded-2xl bg-slate-900/60 border border-slate-800 overflow-hidden shadow-sm">
                    <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
                        <div>
                            <h2 className="text-sm font-bold text-white">Payroll Runs ({selectedYear})</h2>
                            <p className="text-xs text-slate-400">
                                Monthly pay runs generated, audited against biometric attendance and tax brackets.
                            </p>
                        </div>
                        <span className="text-xs font-mono text-slate-400 bg-slate-800/60 px-2.5 py-1 rounded-lg border border-slate-700/60">
                            {runs.length} Runs Recorded
                        </span>
                    </div>

                    {runs.length === 0 ? (
                        <div className="p-12 text-center">
                            <div className="w-12 h-12 rounded-2xl bg-slate-800/60 text-slate-500 flex items-center justify-center mx-auto mb-3">
                                <DollarSign className="w-6 h-6" />
                            </div>
                            <h3 className="text-sm font-bold text-white mb-1">No Payroll Runs for {selectedYear}</h3>
                            <p className="text-xs text-slate-400 max-w-sm mx-auto mb-4">
                                No payroll calculations have been processed for this year yet. Click the button below to initiate calculation.
                            </p>
                            <button
                                onClick={() => setIsRunModalOpen(true)}
                                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold inline-flex items-center gap-2 transition"
                            >
                                <Play className="w-3.5 h-3.5" /> Start First Run
                            </button>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs text-slate-300">
                                <thead className="bg-slate-950/60 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                                    <tr>
                                        <th className="px-5 py-3">Period</th>
                                        <th className="px-4 py-3">Status</th>
                                        <th className="px-4 py-3 text-right">Employees</th>
                                        <th className="px-4 py-3 text-right">Total Gross</th>
                                        <th className="px-4 py-3 text-right">EPF (8%)</th>
                                        <th className="px-4 py-3 text-right">APIT Tax</th>
                                        <th className="px-4 py-3 text-right">Net Payout</th>
                                        <th className="px-4 py-3 text-right">EPF 12% + ETF 3%</th>
                                        <th className="px-5 py-3 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/60">
                                    {runs.map((run) => (
                                        <tr key={run.id} className="hover:bg-slate-800/30 transition">
                                            <td className="px-5 py-4 font-semibold text-white">
                                                <Link
                                                    href={`/payroll/${run.id}`}
                                                    className="hover:text-indigo-400 transition flex items-center gap-2"
                                                >
                                                    <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                                                    {run.period_label}
                                                </Link>
                                                {run.notes && (
                                                    <p className="text-[10px] text-slate-500 mt-0.5 truncate max-w-xs font-normal">
                                                        {run.notes}
                                                    </p>
                                                )}
                                            </td>
                                            <td className="px-4 py-4">{getStatusBadge(run.status)}</td>
                                            <td className="px-4 py-4 text-right font-mono text-slate-200">
                                                {run.employee_count}
                                            </td>
                                            <td className="px-4 py-4 text-right font-mono font-medium text-slate-200">
                                                {formatLKR(run.total_gross)}
                                            </td>
                                            <td className="px-4 py-4 text-right font-mono text-slate-400">
                                                {formatLKR(run.total_epf_employee)}
                                            </td>
                                            <td className="px-4 py-4 text-right font-mono text-rose-400/90">
                                                {formatLKR(run.total_apit)}
                                            </td>
                                            <td className="px-4 py-4 text-right font-mono font-bold text-emerald-400">
                                                {formatLKR(run.total_net)}
                                            </td>
                                            <td className="px-4 py-4 text-right font-mono text-blue-400">
                                                {formatLKR(run.total_epf_employer + run.total_etf)}
                                            </td>
                                            <td className="px-5 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <Link
                                                        href={`/payroll/${run.id}`}
                                                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-indigo-600 hover:text-white text-slate-300 transition"
                                                        title="View Run Details"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </Link>

                                                    {run.status === 'draft' && (
                                                        <button
                                                            onClick={() => setRunToDelete(run)}
                                                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950/60 hover:text-rose-400 text-slate-400 transition"
                                                            title="Delete Draft"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
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

            {/* Modal 1: Run Payroll Wizard */}
            {isRunModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
                            <div className="flex items-center gap-2">
                                <Play className="w-4 h-4 text-indigo-400" />
                                <h3 className="text-sm font-bold text-white">Execute Payroll Calculation Run</h3>
                            </div>
                            <button
                                onClick={() => {
                                    setIsRunModalOpen(false);
                                    setPreviewData(null);
                                }}
                                className="p-1 rounded-lg text-slate-400 hover:text-white transition"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <form onSubmit={handleRunSubmit} className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                                        Period Year
                                    </label>
                                    <select
                                        value={runForm.data.period_year}
                                        onChange={(e) => runForm.setData('period_year', Number(e.target.value))}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                                    >
                                        {availableYears.map((yr) => (
                                            <option key={yr} value={yr}>
                                                {yr}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                                        Period Month
                                    </label>
                                    <select
                                        value={runForm.data.period_month}
                                        onChange={(e) => runForm.setData('period_month', Number(e.target.value))}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                                    >
                                        {[
                                            'January', 'February', 'March', 'April', 'May', 'June',
                                            'July', 'August', 'September', 'October', 'November', 'December',
                                        ].map((name, idx) => (
                                            <option key={idx + 1} value={idx + 1}>
                                                {idx + 1} - {name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                                    Run Description / Notes (Optional)
                                </label>
                                <input
                                    type="text"
                                    placeholder="e.g. Regular monthly salary run"
                                    value={runForm.data.notes}
                                    onChange={(e) => runForm.setData('notes', e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                                />
                            </div>

                            {/* Dry Run Preview Box */}
                            {previewData && (
                                <div className="p-4 rounded-xl bg-slate-950/80 border border-indigo-500/30 space-y-2">
                                    <h4 className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                                        <TrendingUp className="w-3.5 h-3.5" /> Dry Run Preview: {previewData.period_label}
                                    </h4>
                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                        <div>
                                            <span className="text-slate-400">Headcount:</span>{' '}
                                            <span className="text-white font-mono">{previewData.employee_count}</span>
                                        </div>
                                        <div>
                                            <span className="text-slate-400">Gross Est.:</span>{' '}
                                            <span className="text-white font-mono">{formatLKR(previewData.total_gross)}</span>
                                        </div>
                                        <div>
                                            <span className="text-slate-400">EPF 8%:</span>{' '}
                                            <span className="text-white font-mono">{formatLKR(previewData.total_epf_employee)}</span>
                                        </div>
                                        <div>
                                            <span className="text-slate-400">Net Disbursal:</span>{' '}
                                            <span className="text-emerald-400 font-mono font-bold">
                                                {formatLKR(previewData.total_net)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
                                <button
                                    type="button"
                                    onClick={handlePreview}
                                    disabled={previewLoading}
                                    className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-50"
                                >
                                    <RefreshCw className={`w-3.5 h-3.5 ${previewLoading ? 'animate-spin' : ''}`} />
                                    {previewLoading ? 'Calculating...' : 'Preview Dry Run'}
                                </button>

                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setIsRunModalOpen(false)}
                                        className="px-3.5 py-2 rounded-xl border border-slate-800 hover:bg-slate-800 text-slate-400 text-xs font-semibold transition"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={runForm.processing}
                                        className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-2 transition disabled:opacity-50"
                                    >
                                        <Play className="w-3.5 h-3.5" />
                                        {runForm.processing ? 'Processing...' : 'Execute Run'}
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal 2: Statutory Settings Modal */}
            {isSettingsModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
                            <div className="flex items-center gap-2">
                                <Sliders className="w-4 h-4 text-amber-400" />
                                <h3 className="text-sm font-bold text-white">Company Statutory & Labor Act Setup</h3>
                            </div>
                            <button
                                onClick={() => setIsSettingsModalOpen(false)}
                                className="p-1 rounded-lg text-slate-400 hover:text-white transition"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <form onSubmit={handleSettingsSubmit} className="p-6 space-y-4">
                            {/* EPF Global Toggle */}
                            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                                <div>
                                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                                        EPF & ETF Scheme
                                    </h4>
                                    <p className="text-[11px] text-slate-400 mt-0.5">
                                        Toggle off for unregistered startups or entities not covered by Central Bank.
                                    </p>
                                </div>
                                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-300">
                                    <input
                                        type="checkbox"
                                        checked={settingsForm.data.epf_enabled}
                                        onChange={(e) => settingsForm.setData('epf_enabled', e.target.checked)}
                                        className="w-4 h-4 rounded border-slate-700 text-indigo-600 focus:ring-0 bg-slate-950"
                                    />
                                    {settingsForm.data.epf_enabled ? 'Enabled' : 'Disabled'}
                                </label>
                            </div>

                            {/* Rates */}
                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                                        Employee EPF (%)
                                    </label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        value={settingsForm.data.epf_employee_rate}
                                        onChange={(e) => settingsForm.setData('epf_employee_rate', Number(e.target.value))}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                                        Employer EPF (%)
                                    </label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        value={settingsForm.data.epf_employer_rate}
                                        onChange={(e) => settingsForm.setData('epf_employer_rate', Number(e.target.value))}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                                    />
                                </div>

                                <div>
                                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                                        Employer ETF (%)
                                    </label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        value={settingsForm.data.etf_employer_rate}
                                        onChange={(e) => settingsForm.setData('etf_employer_rate', Number(e.target.value))}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                                    />
                                </div>
                            </div>

                            {/* Labor Act Divisors */}
                            <div className="grid grid-cols-2 gap-4 pt-2">
                                <div>
                                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                                        Shop & Office No-Pay Divisor
                                    </label>
                                    <input
                                        type="number"
                                        value={settingsForm.data.shop_office_nopay_divisor}
                                        onChange={(e) => settingsForm.setData('shop_office_nopay_divisor', Number(e.target.value))}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                                    />
                                    <p className="text-[10px] text-slate-500 mt-1">Default 30 days under S&O Act</p>
                                </div>

                                <div>
                                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                                        Wages Board No-Pay Divisor
                                    </label>
                                    <input
                                        type="number"
                                        value={settingsForm.data.wages_board_nopay_divisor}
                                        onChange={(e) => settingsForm.setData('wages_board_nopay_divisor', Number(e.target.value))}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                                    />
                                    <p className="text-[10px] text-slate-500 mt-1">Standard 26 working days in WBO</p>
                                </div>
                            </div>

                            <div className="pt-4 border-t border-slate-800 flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setIsSettingsModalOpen(false)}
                                    className="px-3.5 py-2 rounded-xl border border-slate-800 hover:bg-slate-800 text-slate-400 text-xs font-semibold transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={settingsForm.processing}
                                    className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold flex items-center gap-2 transition disabled:opacity-50"
                                >
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    {settingsForm.processing ? 'Saving...' : 'Save Settings'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {/* Modal 3: Delete Confirmation Modal */}
            {runToDelete && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden p-6 space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-400">
                                <Trash2 className="w-5 h-5" />
                            </div>
                            <h3 className="text-sm font-bold text-white">Delete Draft Payroll Run</h3>
                        </div>

                        <p className="text-xs text-slate-400 leading-relaxed">
                            Are you sure you want to permanently delete the draft payroll for <strong className="text-white">{runToDelete.period_label}</strong>? This will remove all calculated employee line items.
                        </p>

                        <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setRunToDelete(null)}
                                className="px-3.5 py-2 rounded-xl border border-slate-800 hover:bg-slate-800 text-slate-400 text-xs font-semibold transition"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleDeleteConfirm}
                                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition shadow-lg shadow-rose-600/20"
                            >
                                Confirm Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Global Payroll Processing Overlay */}
            {runForm.processing && (
                <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex flex-col items-center justify-center text-white p-4">
                    <Loader2 className="w-12 h-12 animate-spin text-indigo-400 mb-3" />
                    <p className="text-lg font-semibold">Calculating Payroll Run...</p>
                    <p className="text-xs text-slate-400 mt-1">Processing wages, OT, EPF/ETF contributions, and APIT tax within database transaction...</p>
                </div>
            )}
        </AuthenticatedLayout>
    );
}
