import React, { useState } from 'react';
import { Head, useForm, Link } from '@inertiajs/react';
import {
    UserPlus,
    Building2,
    Briefcase,
    CreditCard,
    ShieldCheck,
    Landmark,
    Fingerprint,
    CheckCircle2,
    ArrowLeft,
    DollarSign,
    Calendar,
    Phone,
    Mail,
    User,
    Lock,
} from 'lucide-react';
import { DepartmentSummary, DesignationSummary, BranchSummary } from '../../Types/employee';

interface Props {
    nextEmpNo: string;
    departments: DepartmentSummary[];
    designations: DesignationSummary[];
    branches: BranchSummary[];
    employmentTypes: Array<{ value: string; label: string }>;
    paymentModes: Array<{ value: string; label: string }>;
}

export default function Create({
    nextEmpNo,
    departments,
    designations,
    branches,
    employmentTypes,
    paymentModes,
}: Props) {
    const [activeSection, setActiveSection] = useState<'personal' | 'job' | 'compensation' | 'banking'>('personal');

    const form = useForm({
        // Core
        emp_no: nextEmpNo,
        full_name: '',
        nic: '',
        email: '',
        phone: '',
        department_id: '',
        designation_id: '',
        branch_id: '',
        employment_type: 'permanent',
        employment_status: 'active',
        date_of_joining: new Date().toISOString().split('T')[0],
        biometric_device_id: '',

        // Payment
        payment_mode: 'monthly',
        basic_salary: 0,
        daily_rate: 0,
        hourly_rate: 0,
        effective_date: new Date().toISOString().split('T')[0],

        // Banking & EPF
        bank_code: '',
        bank_name: '',
        branch_name: '',
        account_no: '',
        account_holder_name: '',
        is_epf_member: true,
        epf_no: '',
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        form.post('/employees');
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-indigo-500 selection:text-white pb-24">
            <Head title="Add Employee — EMS" />

            {/* Top Navigation Bar */}
            <header className="border-b border-slate-800/80 bg-slate-950/70 backdrop-blur-md sticky top-0 z-40">
                <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Link
                            href="/employees"
                            className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition"
                        >
                            <ArrowLeft className="w-4 h-4" />
                        </Link>
                        <div>
                            <span className="text-lg font-bold tracking-tight text-white">
                                Add New Employee
                            </span>
                            <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                                {form.data.emp_no}
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={handleSubmit}
                            disabled={form.processing}
                            className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-indigo-600/30 transition disabled:opacity-50"
                        >
                            <CheckCircle2 className="w-4 h-4" />
                            {form.processing ? 'Saving...' : 'Save Employee Profile'}
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-5xl mx-auto px-6 pt-10">
                {/* Stepper Tabs */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
                    <button
                        type="button"
                        onClick={() => setActiveSection('personal')}
                        className={`p-4 rounded-2xl border text-left transition flex items-center gap-3 ${
                            activeSection === 'personal'
                                ? 'bg-indigo-600/10 border-indigo-500 text-white'
                                : 'bg-slate-900/50 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                    >
                        <User className="w-5 h-5 text-indigo-400" />
                        <div>
                            <div className="text-xs font-bold">1. Personal Details</div>
                            <div className="text-[11px] text-slate-400">NIC & Contact</div>
                        </div>
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveSection('job')}
                        className={`p-4 rounded-2xl border text-left transition flex items-center gap-3 ${
                            activeSection === 'job'
                                ? 'bg-indigo-600/10 border-indigo-500 text-white'
                                : 'bg-slate-900/50 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                    >
                        <Briefcase className="w-5 h-5 text-sky-400" />
                        <div>
                            <div className="text-xs font-bold">2. Job Assignment</div>
                            <div className="text-[11px] text-slate-400">Dept, Role & Branch</div>
                        </div>
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveSection('compensation')}
                        className={`p-4 rounded-2xl border text-left transition flex items-center gap-3 ${
                            activeSection === 'compensation'
                                ? 'bg-indigo-600/10 border-indigo-500 text-white'
                                : 'bg-slate-900/50 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                    >
                        <CreditCard className="w-5 h-5 text-emerald-400" />
                        <div>
                            <div className="text-xs font-bold">3. Compensation</div>
                            <div className="text-[11px] text-slate-400">Mode & Base Rates</div>
                        </div>
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveSection('banking')}
                        className={`p-4 rounded-2xl border text-left transition flex items-center gap-3 ${
                            activeSection === 'banking'
                                ? 'bg-indigo-600/10 border-indigo-500 text-white'
                                : 'bg-slate-900/50 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                    >
                        <Landmark className="w-5 h-5 text-amber-400" />
                        <div>
                            <div className="text-xs font-bold">4. Bank & EPF</div>
                            <div className="text-[11px] text-slate-400">Encrypted Remittance</div>
                        </div>
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-8 rounded-3xl bg-slate-900/60 border border-slate-800/80 shadow-2xl">
                    {/* Section 1: Personal Details */}
                    {activeSection === 'personal' && (
                        <div className="space-y-6">
                            <div className="flex items-center gap-2 pb-4 border-b border-slate-800 text-sm font-bold text-white">
                                <User className="w-4 h-4 text-indigo-400" />
                                Personal Identity & Contacts
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                                        Full Name *
                                    </label>
                                    <input
                                        type="text"
                                        value={form.data.full_name}
                                        onChange={(e) => form.setData('full_name', e.target.value)}
                                        required
                                        placeholder="e.g. Kasun Chamara Perera"
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                                    />
                                    {form.errors.full_name && (
                                        <p className="text-xs text-rose-400 mt-1">{form.errors.full_name}</p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2 flex items-center justify-between">
                                        <span>National Identity Card (NIC) *</span>
                                        <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                                            <Lock className="w-3 h-3" /> Encrypted
                                        </span>
                                    </label>
                                    <input
                                        type="text"
                                        value={form.data.nic}
                                        onChange={(e) => form.setData('nic', e.target.value)}
                                        required
                                        placeholder="e.g. 199012345678 or 901234567V"
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 font-mono"
                                    />
                                    {form.errors.nic && (
                                        <p className="text-xs text-rose-400 mt-1">{form.errors.nic}</p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                                        Email Address
                                    </label>
                                    <input
                                        type="email"
                                        value={form.data.email}
                                        onChange={(e) => form.setData('email', e.target.value)}
                                        placeholder="kasun.p@example.com"
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                                        Phone Number
                                    </label>
                                    <input
                                        type="text"
                                        value={form.data.phone}
                                        onChange={(e) => form.setData('phone', e.target.value)}
                                        placeholder="+94 77 123 4567"
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                                        Date of Joining
                                    </label>
                                    <input
                                        type="date"
                                        value={form.data.date_of_joining}
                                        onChange={(e) => form.setData('date_of_joining', e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                                    />
                                </div>
                            </div>

                            <div className="pt-6 border-t border-slate-800 flex justify-end">
                                <button
                                    type="button"
                                    onClick={() => setActiveSection('job')}
                                    className="px-5 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-500 transition"
                                >
                                    Proceed to Job Assignment →
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Section 2: Job Assignment */}
                    {activeSection === 'job' && (
                        <div className="space-y-6">
                            <div className="flex items-center gap-2 pb-4 border-b border-slate-800 text-sm font-bold text-white">
                                <Briefcase className="w-4 h-4 text-sky-400" />
                                Organizational Placement & Attendance Device
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                                        Employee Number (ID) *
                                    </label>
                                    <input
                                        type="text"
                                        value={form.data.emp_no}
                                        onChange={(e) => form.setData('emp_no', e.target.value)}
                                        required
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 font-mono"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                                        Employment Classification *
                                    </label>
                                    <select
                                        value={form.data.employment_type}
                                        onChange={(e) => form.setData('employment_type', e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                                    >
                                        {employmentTypes.map((t) => (
                                            <option key={t.value} value={t.value}>
                                                {t.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                                        Assigned Department
                                    </label>
                                    <select
                                        value={form.data.department_id}
                                        onChange={(e) => form.setData('department_id', e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                                    >
                                        <option value="">Select Department...</option>
                                        {departments.map((d) => (
                                            <option key={d.id} value={d.id}>
                                                {d.name} {d.code ? `(${d.code})` : ''}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                                        Designation / Job Title
                                    </label>
                                    <select
                                        value={form.data.designation_id}
                                        onChange={(e) => form.setData('designation_id', e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                                    >
                                        <option value="">Select Designation...</option>
                                        {designations.map((desig) => (
                                            <option key={desig.id} value={desig.id}>
                                                {desig.title} {desig.grade ? `(${desig.grade})` : ''}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                                        Physical Branch
                                    </label>
                                    <select
                                        value={form.data.branch_id}
                                        onChange={(e) => form.setData('branch_id', e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                                    >
                                        <option value="">Select Branch...</option>
                                        {branches.map((b) => (
                                            <option key={b.id} value={b.id}>
                                                {b.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                                        Biometric Device User ID
                                    </label>
                                    <input
                                        type="text"
                                        value={form.data.biometric_device_id}
                                        onChange={(e) => form.setData('biometric_device_id', e.target.value)}
                                        placeholder="e.g. 1004"
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 font-mono"
                                    />
                                    <p className="text-[11px] text-slate-500 mt-1">
                                        Mapped against fingerprint / facial recognition attendance punches in Module 2.
                                    </p>
                                </div>
                            </div>

                            <div className="pt-6 border-t border-slate-800 flex justify-between">
                                <button
                                    type="button"
                                    onClick={() => setActiveSection('personal')}
                                    className="px-4 py-2 rounded-xl border border-slate-800 text-slate-400 hover:text-white text-xs font-semibold"
                                >
                                    ← Back
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setActiveSection('compensation')}
                                    className="px-5 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-500 transition"
                                >
                                    Proceed to Compensation →
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Section 3: Compensation */}
                    {activeSection === 'compensation' && (
                        <div className="space-y-6">
                            <div className="flex items-center gap-2 pb-4 border-b border-slate-800 text-sm font-bold text-white">
                                <CreditCard className="w-4 h-4 text-emerald-400" />
                                Payment Mode & Baseline Wage Rates
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                                        Payment Mode *
                                    </label>
                                    <select
                                        value={form.data.payment_mode}
                                        onChange={(e) => form.setData('payment_mode', e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                                    >
                                        {paymentModes.map((m) => (
                                            <option key={m.value} value={m.value}>
                                                {m.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                                        Effective Date
                                    </label>
                                    <input
                                        type="date"
                                        value={form.data.effective_date}
                                        onChange={(e) => form.setData('effective_date', e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                                    />
                                </div>

                                {form.data.payment_mode === 'monthly' && (
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                                            Basic Monthly Salary (LKR) *
                                        </label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={form.data.basic_salary}
                                            onChange={(e) => form.setData('basic_salary', parseFloat(e.target.value) || 0)}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 font-mono"
                                        />
                                    </div>
                                )}

                                {form.data.payment_mode === 'daily' && (
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                                            Daily Wage Rate (LKR) *
                                        </label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={form.data.daily_rate}
                                            onChange={(e) => form.setData('daily_rate', parseFloat(e.target.value) || 0)}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 font-mono"
                                        />
                                    </div>
                                )}

                                {form.data.payment_mode === 'hourly' && (
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                                            Hourly Rate (LKR) *
                                        </label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={form.data.hourly_rate}
                                            onChange={(e) => form.setData('hourly_rate', parseFloat(e.target.value) || 0)}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 font-mono"
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="pt-6 border-t border-slate-800 flex justify-between">
                                <button
                                    type="button"
                                    onClick={() => setActiveSection('job')}
                                    className="px-4 py-2 rounded-xl border border-slate-800 text-slate-400 hover:text-white text-xs font-semibold"
                                >
                                    ← Back
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setActiveSection('banking')}
                                    className="px-5 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-500 transition"
                                >
                                    Proceed to Bank & EPF →
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Section 4: Bank & EPF */}
                    {activeSection === 'banking' && (
                        <div className="space-y-6">
                            <div className="flex items-center gap-2 pb-4 border-b border-slate-800 text-sm font-bold text-white">
                                <Landmark className="w-4 h-4 text-amber-400" />
                                Bank Remittance & Statutory EPF Details
                            </div>

                            {/* EPF Toggle Card */}
                            <div className="p-5 rounded-2xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
                                <div>
                                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                                        EPF & ETF Membership
                                    </h4>
                                    <p className="text-xs text-slate-400 mt-0.5">
                                        Include in statutory 8% employee and 12% employer EPF deductions.
                                    </p>
                                </div>
                                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-300">
                                    <input
                                        type="checkbox"
                                        checked={form.data.is_epf_member}
                                        onChange={(e) => form.setData('is_epf_member', e.target.checked)}
                                        className="w-4 h-4 rounded border-slate-700 text-indigo-600 focus:ring-0 bg-slate-950"
                                    />
                                    Enable EPF Member
                                </label>
                            </div>

                            {form.data.is_epf_member && (
                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                                        EPF Member Number
                                    </label>
                                    <input
                                        type="text"
                                        value={form.data.epf_no}
                                        onChange={(e) => form.setData('epf_no', e.target.value)}
                                        placeholder="e.g. 5432"
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 font-mono"
                                    />
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-800/80">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                                        Bank Name
                                    </label>
                                    <input
                                        type="text"
                                        value={form.data.bank_name}
                                        onChange={(e) => form.setData('bank_name', e.target.value)}
                                        placeholder="e.g. Commercial Bank, Sampath Bank, BoC"
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                                        Branch Name
                                    </label>
                                    <input
                                        type="text"
                                        value={form.data.branch_name}
                                        onChange={(e) => form.setData('branch_name', e.target.value)}
                                        placeholder="e.g. Kollupitiya Branch"
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2 flex items-center justify-between">
                                        <span>Account Number</span>
                                        <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                                            <Lock className="w-3 h-3" /> Encrypted
                                        </span>
                                    </label>
                                    <input
                                        type="text"
                                        value={form.data.account_no}
                                        onChange={(e) => form.setData('account_no', e.target.value)}
                                        placeholder="e.g. 1000123456"
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 font-mono"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                                        Account Holder Name
                                    </label>
                                    <input
                                        type="text"
                                        value={form.data.account_holder_name}
                                        onChange={(e) => form.setData('account_holder_name', e.target.value)}
                                        placeholder="As registered in the bank passbook"
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                                    />
                                </div>
                            </div>

                            <div className="pt-6 border-t border-slate-800 flex justify-between">
                                <button
                                    type="button"
                                    onClick={() => setActiveSection('compensation')}
                                    className="px-4 py-2 rounded-xl border border-slate-800 text-slate-400 hover:text-white text-xs font-semibold"
                                >
                                    ← Back
                                </button>
                                <button
                                    type="submit"
                                    disabled={form.processing}
                                    className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 transition disabled:opacity-50"
                                >
                                    {form.processing ? 'Saving...' : 'Complete & Register Employee'}
                                </button>
                            </div>
                        </div>
                    )}
                </form>
            </main>
        </div>
    );
}
