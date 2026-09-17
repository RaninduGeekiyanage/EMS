import React, { useState, useMemo } from 'react';
import { Head, Link, router } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import {
    ArrowLeft,
    CheckCircle2,
    Lock,
    RefreshCw,
    Search,
    SlidersHorizontal,
    DollarSign,
    ShieldCheck,
    Briefcase,
    Building2,
    Calendar,
    Users,
    Info,
    X,
    FileText,
    TrendingUp,
    AlertCircle,
    UserCheck,
    Hash,
    Download,
    ChevronDown,
    ExternalLink,
    Landmark,
} from 'lucide-react';

interface EmployeeItem {
    id: string;
    employee_id: string;
    emp_no: string;
    full_name: string;
    department: string;
    designation: string;
    payment_mode: 'monthly' | 'daily' | 'hourly';
    employment_type: string;
    labor_act: 'shop_and_office' | 'wages_board';
    wages_board_category?: string | null;
    is_epf_eligible: boolean;
    worked_days: number;
    no_pay_days: number;
    ot_hours: number;
    double_ot_hours: number;
    basic_salary: number;
    hourly_rate: number;
    ot_pay: number;
    allowances: number;
    no_pay_deduction: number;
    gross_pay: number;
    epf_eligible_earnings: number;
    epf_employee: number;
    epf_employer: number;
    etf_employer: number;
    apit_tax: number;
    other_deductions: number;
    net_pay: number;
    breakdown?: any;
}

interface RunInfo {
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

interface Props {
    run: RunInfo;
    employees: EmployeeItem[];
    departments: Array<{ id: string; name: string }>;
    filters: {
        department_id?: string | null;
        payment_mode?: string | null;
        search?: string | null;
    };
}

const SUPPORTED_BANKS = [
    { code: 'boc', name: 'Bank of Ceylon (BoC)', desc: 'CEFTS / SLIPS fixed-width (.txt)' },
    { code: 'combank', name: 'Commercial Bank of Ceylon', desc: 'Direct Credit bulk (.csv)' },
    { code: 'sampath', name: 'Sampath Bank', desc: 'Direct Credit bulk (.csv)' },
    { code: 'hnb', name: 'Hatton National Bank (HNB)', desc: 'PayGate format (.csv)' },
    { code: 'peoples', name: "People's Bank", desc: 'Corporate Banking (.csv)' },
    { code: 'nsb', name: 'National Savings Bank (NSB)', desc: 'Bulk salary format (.csv)' },
];

export default function Run({ run, employees, departments, filters }: Props) {
    const [searchTerm, setSearchTerm] = useState(filters.search || '');
    const [selectedDept, setSelectedDept] = useState(filters.department_id || '');
    const [activeTab, setActiveTab] = useState<'all' | 'monthly' | 'daily' | 'hourly' | 'contract'>('all');
    const [inspectingEmployee, setInspectingEmployee] = useState<EmployeeItem | null>(null);
    const [bankDropdownOpen, setBankDropdownOpen] = useState(false);

    const formatLKR = (val: number) => {
        return new Intl.NumberFormat('en-LK', {
            style: 'currency',
            currency: 'LKR',
            minimumFractionDigits: 2,
        }).format(val || 0);
    };

    const [confirmAction, setConfirmAction] = useState<{
        type: 'approve' | 'lock' | 'recalculate';
        title: string;
        message: string;
    } | null>(null);

    const handleConfirmSubmit = () => {
        if (!confirmAction) return;
        if (confirmAction.type === 'approve') {
            router.post(`/payroll/${run.id}/approve`, {}, {
                onFinish: () => setConfirmAction(null),
            });
        } else if (confirmAction.type === 'lock') {
            router.post(`/payroll/${run.id}/lock`, {}, {
                onFinish: () => setConfirmAction(null),
            });
        } else if (confirmAction.type === 'recalculate') {
            router.post(`/payroll/${run.id}/recalculate`, {}, {
                onFinish: () => setConfirmAction(null),
            });
        }
    };

    const filteredEmployees = useMemo(() => {
        return employees.filter((emp) => {
            const matchesSearch =
                searchTerm === '' ||
                emp.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                emp.emp_no.toLowerCase().includes(searchTerm.toLowerCase());

            const matchesDept = selectedDept === '' || emp.department === selectedDept;

            let matchesTab = true;
            if (activeTab === 'monthly') matchesTab = emp.payment_mode === 'monthly';
            if (activeTab === 'daily') matchesTab = emp.payment_mode === 'daily';
            if (activeTab === 'hourly') matchesTab = emp.payment_mode === 'hourly';
            if (activeTab === 'contract') matchesTab = !emp.is_epf_eligible || emp.employment_type === 'contract';

            return matchesSearch && matchesDept && matchesTab;
        });
    }, [employees, searchTerm, selectedDept, activeTab]);

    return (
        <AuthenticatedLayout title={`${run.period_label} Payroll Run`} backUrl="/payroll">
            <Head title={`Payroll Run: ${run.period_label}`} />

            <div className="space-y-6 max-w-7xl mx-auto">
                {/* Header Control Bar */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
                    <div className="flex items-center gap-3">
                        <Link
                            href="/payroll"
                            className="p-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white transition"
                            title="Back to Payroll Dashboard"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </Link>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                                    {run.period_label} Payroll Run
                                </h1>
                                <span
                                    className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${
                                        run.status === 'locked'
                                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                            : run.status === 'approved'
                                            ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                            : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                    }`}
                                >
                                    {run.status.toUpperCase()}
                                </span>
                            </div>
                            <p className="text-xs text-slate-400 mt-0.5">
                                Processed {run.employee_count} employees &nbsp;•&nbsp; Run by: {run.run_by ?? 'System'}
                                {run.approved_by && ` • Approved by: ${run.approved_by} on ${run.approved_at}`}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {run.status !== 'locked' && (
                            <>
                                <button
                                    onClick={() =>
                                        setConfirmAction({
                                            type: 'recalculate',
                                            title: 'Recalculate Payroll Run',
                                            message: `Recalculate payroll for ${run.period_label}? All employee wage components and attendance will be refreshed.`,
                                        })
                                    }
                                    className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 text-xs font-semibold flex items-center gap-2 transition"
                                >
                                    <RefreshCw className="w-4 h-4 text-slate-400" />
                                    <span>Recalculate</span>
                                </button>

                                {run.status === 'draft' && (
                                    <button
                                        onClick={() =>
                                            setConfirmAction({
                                                type: 'approve',
                                                title: 'Approve Payroll Run',
                                                message: `Approve the payroll run for ${run.period_label}? Once approved, payslips can be generated.`,
                                            })
                                        }
                                        className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-blue-600/20 transition"
                                    >
                                        <CheckCircle2 className="w-4 h-4" />
                                        <span>Approve Run</span>
                                    </button>
                                )}

                                {run.status === 'approved' && (
                                    <button
                                        onClick={() =>
                                            setConfirmAction({
                                                type: 'lock',
                                                title: 'Lock Payroll Run',
                                                message: `Lock the payroll run for ${run.period_label}? Once locked, all calculations become permanent and immutable.`,
                                            })
                                        }
                                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-emerald-600/20 transition"
                                    >
                                        <Lock className="w-4 h-4" />
                                        <span>Lock Payroll</span>
                                    </button>
                                )}
                            </>
                        )}

                        {run.status === 'locked' && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 text-emerald-400 border border-emerald-500/20 text-xs font-medium">
                                <Lock className="w-3.5 h-3.5" /> Immutable Locked Record
                            </span>
                        )}

                        {/* Bulk Payslips PDF Download */}
                        <a
                            href={`/payroll/${run.id}/payslips/bulk`}
                            className="px-3.5 py-2 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 hover:text-indigo-200 border border-indigo-500/30 text-xs font-semibold flex items-center gap-2 transition"
                            download
                            title="Download all employee payslips in a single PDF"
                        >
                            <Download className="w-4 h-4" />
                            <span className="hidden sm:inline">Bulk Payslips (PDF)</span>
                        </a>

                        {/* Bank Disbursal Export Dropdown */}
                        <div className="relative">
                            <button
                                onClick={() => setBankDropdownOpen(!bankDropdownOpen)}
                                className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 text-xs font-semibold flex items-center gap-2 transition"
                            >
                                <Landmark className="w-4 h-4 text-emerald-400" />
                                <span className="hidden sm:inline">Export Bank File</span>
                                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                            </button>

                            {bankDropdownOpen && (
                                <div className="absolute right-0 mt-2 w-72 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95">
                                    <div className="px-3 py-2 border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                                        Select Direct Credit Bank
                                    </div>
                                    <div className="py-1 space-y-0.5 max-h-64 overflow-y-auto">
                                        {SUPPORTED_BANKS.map((b) => (
                                            <a
                                                key={b.code}
                                                href={`/payroll/${run.id}/bank-export?bank_code=${b.code}`}
                                                onClick={() => setBankDropdownOpen(false)}
                                                className="w-full text-left px-3 py-2 rounded-xl hover:bg-slate-800 text-slate-300 hover:text-white text-xs flex flex-col transition"
                                                download
                                            >
                                                <span className="font-semibold text-white">{b.name}</span>
                                                <span className="text-[10px] text-slate-500">{b.desc}</span>
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Financial Summary Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                    <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
                        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Gross Payroll</span>
                        <p className="text-lg font-bold text-white mt-1 font-mono">{formatLKR(run.total_gross)}</p>
                        <span className="text-[10px] text-slate-500">Base + OT + Allowances</span>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
                        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Employee EPF (8%)</span>
                        <p className="text-lg font-bold text-slate-300 mt-1 font-mono">{formatLKR(run.total_epf_employee)}</p>
                        <span className="text-[10px] text-slate-500">Employee statutory cut</span>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
                        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">APIT Tax Withheld</span>
                        <p className="text-lg font-bold text-rose-400 mt-1 font-mono">{formatLKR(run.total_apit)}</p>
                        <span className="text-[10px] text-slate-500">IRD progressive slabs</span>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
                        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Net Payout</span>
                        <p className="text-lg font-bold text-emerald-400 mt-1 font-mono">{formatLKR(run.total_net)}</p>
                        <span className="text-[10px] text-slate-500">Total payable to bank/cash</span>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 col-span-2 lg:col-span-1">
                        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Employer EPF/ETF</span>
                        <p className="text-lg font-bold text-blue-400 mt-1 font-mono">
                            {formatLKR(run.total_epf_employer + run.total_etf)}
                        </p>
                        <span className="text-[10px] text-slate-500">EPF 12% + ETF 3% company liability</span>
                    </div>
                </div>

                {/* Filter and Tab Navigation Bar */}
                <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 pt-2">
                    {/* Mode Tabs */}
                    <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-950 border border-slate-800 overflow-x-auto">
                        <button
                            onClick={() => setActiveTab('all')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap ${
                                activeTab === 'all'
                                    ? 'bg-indigo-600 text-white shadow-sm'
                                    : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            All ({employees.length})
                        </button>
                        <button
                            onClick={() => setActiveTab('monthly')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap ${
                                activeTab === 'monthly'
                                    ? 'bg-indigo-600 text-white shadow-sm'
                                    : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            Monthly Salaried ({employees.filter((e) => e.payment_mode === 'monthly').length})
                        </button>
                        <button
                            onClick={() => setActiveTab('daily')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap ${
                                activeTab === 'daily'
                                    ? 'bg-indigo-600 text-white shadow-sm'
                                    : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            Daily Wages ({employees.filter((e) => e.payment_mode === 'daily').length})
                        </button>
                        <button
                            onClick={() => setActiveTab('hourly')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap ${
                                activeTab === 'hourly'
                                    ? 'bg-indigo-600 text-white shadow-sm'
                                    : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            Hourly Wages ({employees.filter((e) => e.payment_mode === 'hourly').length})
                        </button>
                        <button
                            onClick={() => setActiveTab('contract')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap ${
                                activeTab === 'contract'
                                    ? 'bg-indigo-600 text-white shadow-sm'
                                    : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            Non-EPF / Contract ({employees.filter((e) => !e.is_epf_eligible).length})
                        </button>
                    </div>

                    {/* Search and Dept Filter */}
                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                                type="text"
                                placeholder="Search employee..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 w-48"
                            />
                        </div>

                        <select
                            value={selectedDept}
                            onChange={(e) => setSelectedDept(e.target.value)}
                            className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
                        >
                            <option value="">All Departments</option>
                            {departments.map((d) => (
                                <option key={d.id} value={d.name}>
                                    {d.name}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Detailed Roster Table */}
                <div className="rounded-2xl bg-slate-900/60 border border-slate-800 overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs text-slate-300">
                            <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                                <tr>
                                    <th className="px-4 py-3">Employee</th>
                                    <th className="px-3 py-3">Mode & Act</th>
                                    <th className="px-3 py-3 text-center">EPF Status</th>
                                    <th className="px-3 py-3 text-right">Days / OT</th>
                                    <th className="px-3 py-3 text-right">Base Wage</th>
                                    <th className="px-3 py-3 text-right">OT Pay</th>
                                    <th className="px-3 py-3 text-right">No-Pay</th>
                                    <th className="px-3 py-3 text-right">Gross Pay</th>
                                    <th className="px-3 py-3 text-right">EPF 8%</th>
                                    <th className="px-3 py-3 text-right">APIT Tax</th>
                                    <th className="px-3 py-3 text-right font-bold text-white">Net Pay</th>
                                    <th className="px-3 py-3 text-right">Co. Liability</th>
                                    <th className="px-4 py-3 text-center">Audit</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/60">
                                {filteredEmployees.length === 0 ? (
                                    <tr>
                                        <td colSpan={13} className="p-8 text-center text-slate-400 text-xs">
                                            No employee records matching criteria.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredEmployees.map((emp) => (
                                        <tr key={emp.id} className="hover:bg-slate-800/30 transition">
                                            <td className="px-4 py-3.5">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center font-bold text-[10px] text-slate-300">
                                                        {emp.emp_no.slice(-3)}
                                                    </div>
                                                    <div>
                                                        <p className="font-semibold text-white">{emp.full_name}</p>
                                                        <p className="text-[10px] text-slate-400">
                                                            {emp.emp_no} &bull; {emp.department}
                                                        </p>
                                                    </div>
                                                </div>
                                            </td>

                                            <td className="px-3 py-3.5">
                                                <div className="space-y-1">
                                                    <span className="inline-block text-[10px] px-2 py-0.5 rounded-full font-mono bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                                                        {emp.payment_mode.toUpperCase()}
                                                    </span>
                                                    <p className="text-[9px] text-slate-500">
                                                        {emp.labor_act === 'wages_board' ? 'WBO (26d)' : 'S&O (30d)'}
                                                    </p>
                                                </div>
                                            </td>

                                            <td className="px-3 py-3.5 text-center">
                                                {emp.is_epf_eligible ? (
                                                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                                        EPF 8/12
                                                    </span>
                                                ) : (
                                                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                                                        Non-EPF
                                                    </span>
                                                )}
                                            </td>

                                            <td className="px-3 py-3.5 text-right font-mono">
                                                <div>{emp.worked_days}d</div>
                                                {emp.ot_hours > 0 && (
                                                    <div className="text-[10px] text-amber-400">+{emp.ot_hours}h OT</div>
                                                )}
                                            </td>

                                            <td className="px-3 py-3.5 text-right font-mono text-slate-300">
                                                {formatLKR(emp.basic_salary)}
                                            </td>

                                            <td className="px-3 py-3.5 text-right font-mono text-amber-300">
                                                {formatLKR(emp.ot_pay)}
                                            </td>

                                            <td className="px-3 py-3.5 text-right font-mono text-rose-400/80">
                                                {emp.no_pay_deduction > 0 ? `-${formatLKR(emp.no_pay_deduction)}` : '0.00'}
                                            </td>

                                            <td className="px-3 py-3.5 text-right font-mono font-medium text-slate-200">
                                                {formatLKR(emp.gross_pay)}
                                            </td>

                                            <td className="px-3 py-3.5 text-right font-mono text-slate-400">
                                                {formatLKR(emp.epf_employee)}
                                            </td>

                                            <td className="px-3 py-3.5 text-right font-mono text-rose-400">
                                                {formatLKR(emp.apit_tax)}
                                            </td>

                                            <td className="px-3 py-3.5 text-right font-mono font-bold text-emerald-400">
                                                {formatLKR(emp.net_pay)}
                                            </td>

                                            <td className="px-3 py-3.5 text-right font-mono text-blue-400 text-[11px]">
                                                {formatLKR(emp.epf_employer + emp.etf_employer)}
                                            </td>

                                            <td className="px-4 py-3.5 text-center">
                                                <div className="flex items-center justify-center gap-1">
                                                    <a
                                                        href={`/payroll/employees/${emp.id}/payslip/stream`}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-blue-600 hover:text-white text-slate-400 transition"
                                                        title="Preview Payslip PDF"
                                                    >
                                                        <ExternalLink className="w-3.5 h-3.5" />
                                                    </a>
                                                    <a
                                                        href={`/payroll/employees/${emp.id}/payslip/download`}
                                                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-emerald-600 hover:text-white text-slate-400 transition"
                                                        title="Download Payslip PDF"
                                                        download
                                                    >
                                                        <Download className="w-3.5 h-3.5" />
                                                    </a>
                                                    <button
                                                        onClick={() => setInspectingEmployee(emp)}
                                                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-indigo-600 hover:text-white text-slate-400 transition"
                                                        title="Inspect Breakdown & Formulas"
                                                    >
                                                        <Info className="w-3.5 h-3.5" />
                                                    </button>
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

            {/* Modal: Employee Breakdown Inspection Drawer */}
            {inspectingEmployee && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="w-full max-w-2xl rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
                            <div className="flex items-center gap-2.5">
                                <FileText className="w-4 h-4 text-indigo-400" />
                                <div>
                                    <h3 className="text-sm font-bold text-white">
                                        Payroll Calculation Breakdown: {inspectingEmployee.full_name}
                                    </h3>
                                    <p className="text-[11px] text-slate-400">
                                        {inspectingEmployee.emp_no} &bull; Mode: {inspectingEmployee.payment_mode.toUpperCase()} &bull; Act: {inspectingEmployee.labor_act.toUpperCase()}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <a
                                    href={`/payroll/employees/${inspectingEmployee.id}/payslip/download`}
                                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition"
                                    download
                                >
                                    <Download className="w-3.5 h-3.5" />
                                    <span>Download PDF</span>
                                </a>
                                <button
                                    onClick={() => setInspectingEmployee(null)}
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-white transition"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto text-xs">
                            {/* Summary Banner */}
                            <div className="grid grid-cols-3 gap-3 p-4 rounded-xl bg-slate-950 border border-slate-800 text-center font-mono">
                                <div>
                                    <span className="text-slate-500 text-[10px] uppercase">Gross Earnings</span>
                                    <p className="text-sm font-bold text-white mt-0.5">{formatLKR(inspectingEmployee.gross_pay)}</p>
                                </div>
                                <div>
                                    <span className="text-slate-500 text-[10px] uppercase">Total Deductions</span>
                                    <p className="text-sm font-bold text-rose-400 mt-0.5">
                                        {formatLKR(inspectingEmployee.epf_employee + inspectingEmployee.apit_tax)}
                                    </p>
                                </div>
                                <div>
                                    <span className="text-slate-500 text-[10px] uppercase">Net Remittance</span>
                                    <p className="text-sm font-bold text-emerald-400 mt-0.5">{formatLKR(inspectingEmployee.net_pay)}</p>
                                </div>
                            </div>

                            {/* Section 1: Wage Formula Breakdown */}
                            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2">
                                <h4 className="font-bold text-indigo-300 uppercase tracking-wider text-[11px]">
                                    1. Earnings & Attendance Computation
                                </h4>
                                <div className="grid grid-cols-2 gap-2 text-slate-300">
                                    <div>
                                        <span className="text-slate-500">Contract Rate:</span>{' '}
                                        <span className="font-mono">{formatLKR(inspectingEmployee.basic_salary)}</span>
                                    </div>
                                    <div>
                                        <span className="text-slate-500">Derived Hourly Rate:</span>{' '}
                                        <span className="font-mono">{formatLKR(inspectingEmployee.hourly_rate)}/hr</span>
                                    </div>
                                    <div>
                                        <span className="text-slate-500">Days Logged:</span>{' '}
                                        <span className="font-mono">{inspectingEmployee.worked_days} worked / {inspectingEmployee.no_pay_days} no-pay</span>
                                    </div>
                                    <div>
                                        <span className="text-slate-500">Overtime Hours:</span>{' '}
                                        <span className="font-mono">{inspectingEmployee.ot_hours} hrs (1.5x)</span>
                                    </div>
                                    <div>
                                        <span className="text-slate-500">OT Remuneration:</span>{' '}
                                        <span className="font-mono text-amber-300">+{formatLKR(inspectingEmployee.ot_pay)}</span>
                                    </div>
                                    <div>
                                        <span className="text-slate-500">No-Pay Deduction:</span>{' '}
                                        <span className="font-mono text-rose-400">
                                            {inspectingEmployee.no_pay_deduction > 0 ? `-${formatLKR(inspectingEmployee.no_pay_deduction)}` : 'LKR 0.00'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Section 2: Statutory EPF / ETF */}
                            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2">
                                <h4 className="font-bold text-blue-300 uppercase tracking-wider text-[11px]">
                                    2. Statutory Compliance (EPF & ETF)
                                </h4>
                                <div className="grid grid-cols-2 gap-2 text-slate-300">
                                    <div>
                                        <span className="text-slate-500">EPF Enrolled Member:</span>{' '}
                                        <span className="font-semibold text-white">
                                            {inspectingEmployee.is_epf_eligible ? 'YES (Statutory Scheme)' : 'NO (Contract / Excluded)'}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-slate-500">EPF Eligible Base:</span>{' '}
                                        <span className="font-mono">{formatLKR(inspectingEmployee.epf_eligible_earnings)}</span>
                                    </div>
                                    <div>
                                        <span className="text-slate-500">Employee EPF (8%):</span>{' '}
                                        <span className="font-mono text-rose-300">{formatLKR(inspectingEmployee.epf_employee)}</span>
                                    </div>
                                    <div>
                                        <span className="text-slate-500">Employer EPF (12%):</span>{' '}
                                        <span className="font-mono text-blue-300">{formatLKR(inspectingEmployee.epf_employer)}</span>
                                    </div>
                                    <div>
                                        <span className="text-slate-500">Employer ETF (3%):</span>{' '}
                                        <span className="font-mono text-blue-300">{formatLKR(inspectingEmployee.etf_employer)}</span>
                                    </div>
                                    <div>
                                        <span className="text-slate-500">Total Employer Burden:</span>{' '}
                                        <span className="font-mono font-bold text-blue-400">
                                            {formatLKR(inspectingEmployee.epf_employer + inspectingEmployee.etf_employer)}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Section 3: APIT Tax */}
                            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-2">
                                <h4 className="font-bold text-rose-300 uppercase tracking-wider text-[11px]">
                                    3. APIT (Advance Personal Income Tax)
                                </h4>
                                <div className="space-y-1 text-slate-300">
                                    <div className="flex justify-between">
                                        <span className="text-slate-500">Monthly Taxable Earnings:</span>
                                        <span className="font-mono">{formatLKR(inspectingEmployee.gross_pay)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-500">Annual Projected Income:</span>
                                        <span className="font-mono">{formatLKR(inspectingEmployee.gross_pay * 12)}</span>
                                    </div>
                                    <div className="flex justify-between font-bold pt-1 border-t border-slate-800">
                                        <span className="text-slate-400">Monthly Tax Withholding:</span>
                                        <span className="font-mono text-rose-400">{formatLKR(inspectingEmployee.apit_tax)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/50 flex justify-end">
                            <button
                                onClick={() => setInspectingEmployee(null)}
                                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition"
                            >
                                Close Breakdown
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Confirmation Action Modal */}
            {confirmAction && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden p-6 space-y-4">
                        <div className="flex items-center gap-3">
                            <div className={`p-2.5 rounded-xl ${
                                confirmAction.type === 'lock'
                                    ? 'bg-emerald-500/10 text-emerald-400'
                                    : confirmAction.type === 'approve'
                                    ? 'bg-blue-500/10 text-blue-400'
                                    : 'bg-amber-500/10 text-amber-400'
                            }`}>
                                {confirmAction.type === 'lock' ? (
                                    <Lock className="w-5 h-5" />
                                ) : confirmAction.type === 'approve' ? (
                                    <CheckCircle2 className="w-5 h-5" />
                                ) : (
                                    <RefreshCw className="w-5 h-5" />
                                )}
                            </div>
                            <h3 className="text-sm font-bold text-white">{confirmAction.title}</h3>
                        </div>

                        <p className="text-xs text-slate-400 leading-relaxed">
                            {confirmAction.message}
                        </p>

                        <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setConfirmAction(null)}
                                className="px-3.5 py-2 rounded-xl border border-slate-800 hover:bg-slate-800 text-slate-400 text-xs font-semibold transition"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmSubmit}
                                className={`px-4 py-2 rounded-xl text-white text-xs font-semibold transition ${
                                    confirmAction.type === 'lock'
                                        ? 'bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-600/20'
                                        : confirmAction.type === 'approve'
                                        ? 'bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-600/20'
                                        : 'bg-amber-600 hover:bg-amber-500 shadow-lg shadow-amber-600/20'
                                }`}
                            >
                                Confirm & Proceed
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </AuthenticatedLayout>
    );
}
