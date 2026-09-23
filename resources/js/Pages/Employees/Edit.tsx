import React, { useState } from 'react';
import { Head, useForm, Link } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import {
    Edit3,
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
    AlertCircle,
} from 'lucide-react';
import { Employee, DepartmentSummary, DesignationSummary, BranchSummary, JobGradeSummary, WagesBoardCategorySummary, EmploymentStatus, EmploymentType, PaymentMode } from '../../Types/employee';

interface Props {
    employee: Employee;
    departments: DepartmentSummary[];
    designations: DesignationSummary[];
    branches: BranchSummary[];
    jobGrades?: JobGradeSummary[];
    wagesBoardCategories?: WagesBoardCategorySummary[];
    employmentTypes: Array<{ value: string; label: string }>;
    paymentModes: Array<{ value: string; label: string }>;
}

type SectionKey = 'personal' | 'job' | 'compensation' | 'banking';

const sectionFields: Record<SectionKey, string[]> = {
    personal: ['full_name', 'nic', 'email', 'phone', 'landline', 'date_of_birth', 'gender', 'marital_status', 'permanent_address', 'temporary_address', 'city', 'date_of_joining'],
    job: ['emp_no', 'employment_type', 'department_id', 'designation_id', 'branch_id', 'job_grade_id', 'employment_category', 'wages_board_category_id', 'attendance_mode', 'biometric_device_id', 'employment_status'],
    compensation: ['payment_mode', 'effective_date', 'basic_salary', 'daily_rate', 'hourly_rate'],
    banking: ['is_epf_member', 'epf_no', 'bank_code', 'bank_name', 'branch_name', 'account_no', 'account_holder_name'],
};

export default function Edit({
    employee,
    departments,
    designations,
    branches,
    jobGrades = [],
    wagesBoardCategories = [],
    employmentTypes,
    paymentModes,
}: Props) {
    const [activeSection, setActiveSection] = useState<SectionKey>('personal');

    const form = useForm({
        // Core & Personal
        emp_no: employee.emp_no,
        full_name: employee.full_name,
        nic: employee.nic || '',
        email: employee.email || '',
        phone: employee.phone || '',
        landline: employee.landline || '',
        gender: employee.gender || '',
        date_of_birth: employee.date_of_birth || '',
        marital_status: employee.marital_status || '',
        permanent_address: employee.permanent_address || '',
        temporary_address: employee.temporary_address || '',
        city: employee.city || '',

        // Placement & Statutory
        department_id: employee.department_id || '',
        designation_id: employee.designation_id || '',
        branch_id: employee.branch_id || '',
        job_grade_id: employee.job_grade_id || '',
        wages_board_category_id: employee.wages_board_category_id || '',
        employment_type: employee.employment_type || 'permanent',
        employment_status: employee.employment_status || 'active',
        employment_category: employee.employment_category || 'shop_and_office',
        attendance_mode: employee.attendance_mode || 'both',
        date_of_joining: employee.date_of_joining || '',
        biometric_device_id: employee.biometric_device_id || '',

        // Payment
        payment_mode: employee.payment_info?.payment_mode || 'monthly',
        basic_salary: employee.payment_info?.basic_salary || 0,
        daily_rate: employee.payment_info?.daily_rate || 0,
        hourly_rate: employee.payment_info?.hourly_rate || 0,
        effective_date: employee.payment_info?.effective_date || '',

        // Banking & EPF
        bank_code: employee.bank_info?.bank_code || '',
        bank_name: employee.bank_info?.bank_name || '',
        branch_name: employee.bank_info?.branch_name || '',
        account_no: employee.bank_info?.account_no || '',
        account_holder_name: employee.bank_info?.account_holder_name || '',
        is_epf_member: employee.epf_info ? Boolean(employee.epf_info.is_epf_member) : true,
        epf_no: employee.epf_info?.epf_no || '',
    });

    const getSectionForField = (field: string): SectionKey => {
        if (sectionFields.personal.includes(field)) return 'personal';
        if (sectionFields.job.includes(field)) return 'job';
        if (sectionFields.compensation.includes(field)) return 'compensation';
        return 'banking';
    };

    const getSectionErrorsCount = (section: SectionKey) => {
        return sectionFields[section].filter((field) => !!form.errors[field as keyof typeof form.errors]).length;
    };

    const totalErrorsCount = Object.keys(form.errors).length;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        form.put(`/employees/${employee.id}`, {
            onError: (errors) => {
                const firstErrField = Object.keys(errors)[0];
                if (firstErrField) {
                    setActiveSection(getSectionForField(firstErrField));
                }
            },
        });
    };

    const getInputClass = (hasError: boolean) =>
        `w-full bg-slate-950 border ${
            hasError ? 'border-rose-500 focus:border-rose-400 ring-1 ring-rose-500/20' : 'border-slate-800 focus:border-indigo-500'
        } rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none transition`;

    return (
        <AuthenticatedLayout title={`Edit Employee: ${employee.full_name}`} backUrl="/employees">
            <div className="max-w-5xl mx-auto space-y-8">
                {/* Header Subnavigation Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800/80">
                    <div className="flex items-center gap-3">
                        <Link
                            href="/employees"
                            className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition"
                            title="Back to Employee List"
                        >
                            <ArrowLeft className="w-4 h-4" />
                        </Link>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-xl font-bold tracking-tight text-white">
                                    Edit Employee Profile
                                </h1>
                                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-mono">
                                    {employee.emp_no}
                                </span>
                            </div>
                            <p className="text-xs text-slate-400">
                                Updating core details, salary structure, and bank disbursements for {employee.full_name}
                            </p>
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
                            {form.processing ? 'Saving...' : 'Save Profile Changes'}
                        </button>
                    </div>
                </div>

                {/* Validation Errors Banner */}
                {totalErrorsCount > 0 && (
                    <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-start gap-3 animate-in fade-in duration-200">
                        <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                        <div className="flex-1">
                            <h4 className="text-xs font-bold text-rose-200 uppercase tracking-wider">
                                Please resolve {totalErrorsCount} validation {totalErrorsCount === 1 ? 'error' : 'errors'} before saving:
                            </h4>
                            <div className="mt-2.5 flex flex-wrap gap-2">
                                {Object.entries(form.errors).map(([field, msg]) => {
                                    const section = getSectionForField(field);
                                    return (
                                        <button
                                            key={field}
                                            type="button"
                                            onClick={() => setActiveSection(section)}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-950/70 border border-rose-500/40 text-xs text-rose-200 hover:bg-rose-900/80 hover:border-rose-400 transition"
                                        >
                                            <span className="font-semibold capitalize">{field.replace(/_/g, ' ')}:</span>
                                            <span>{msg}</span>
                                            <span className="text-[11px] text-rose-400 underline font-medium ml-1">
                                                (in {section.charAt(0).toUpperCase() + section.slice(1)})
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}

                {/* Stepper Tabs */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
                    <button
                        type="button"
                        onClick={() => setActiveSection('personal')}
                        className={`p-4 rounded-2xl border text-left transition flex items-center justify-between gap-3 ${
                            activeSection === 'personal'
                                ? 'bg-indigo-600/10 border-indigo-500 text-white'
                                : 'bg-slate-900/50 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                    >
                        <div className="flex items-center gap-3">
                            <User className="w-5 h-5 text-indigo-400" />
                            <div>
                                <div className="text-xs font-bold">1. Personal Details</div>
                                <div className="text-[11px] text-slate-400">NIC & Identity</div>
                            </div>
                        </div>
                        {getSectionErrorsCount('personal') > 0 && (
                            <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[10px] font-bold">
                                {getSectionErrorsCount('personal')} err
                            </span>
                        )}
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveSection('job')}
                        className={`p-4 rounded-2xl border text-left transition flex items-center justify-between gap-3 ${
                            activeSection === 'job'
                                ? 'bg-indigo-600/10 border-indigo-500 text-white'
                                : 'bg-slate-900/50 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                    >
                        <div className="flex items-center gap-3">
                            <Briefcase className="w-5 h-5 text-sky-400" />
                            <div>
                                <div className="text-xs font-bold">2. Job Assignment</div>
                                <div className="text-[11px] text-slate-400">Dept, Role & Branch</div>
                            </div>
                        </div>
                        {getSectionErrorsCount('job') > 0 && (
                            <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[10px] font-bold">
                                {getSectionErrorsCount('job')} err
                            </span>
                        )}
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveSection('compensation')}
                        className={`p-4 rounded-2xl border text-left transition flex items-center justify-between gap-3 ${
                            activeSection === 'compensation'
                                ? 'bg-indigo-600/10 border-indigo-500 text-white'
                                : 'bg-slate-900/50 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                    >
                        <div className="flex items-center gap-3">
                            <CreditCard className="w-5 h-5 text-emerald-400" />
                            <div>
                                <div className="text-xs font-bold">3. Compensation</div>
                                <div className="text-[11px] text-slate-400">Mode & Pay Rates</div>
                            </div>
                        </div>
                        {getSectionErrorsCount('compensation') > 0 && (
                            <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[10px] font-bold">
                                {getSectionErrorsCount('compensation')} err
                            </span>
                        )}
                    </button>

                    <button
                        type="button"
                        onClick={() => setActiveSection('banking')}
                        className={`p-4 rounded-2xl border text-left transition flex items-center justify-between gap-3 ${
                            activeSection === 'banking'
                                ? 'bg-indigo-600/10 border-indigo-500 text-white'
                                : 'bg-slate-900/50 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                    >
                        <div className="flex items-center gap-3">
                            <Landmark className="w-5 h-5 text-amber-400" />
                            <div>
                                <div className="text-xs font-bold">4. Bank & EPF</div>
                                <div className="text-[11px] text-slate-400">Encrypted Remittance</div>
                            </div>
                        </div>
                        {getSectionErrorsCount('banking') > 0 && (
                            <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[10px] font-bold">
                                {getSectionErrorsCount('banking')} err
                            </span>
                        )}
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
                                        placeholder="e.g. Kasun Chamara Perera"
                                        className={getInputClass(!!form.errors.full_name)}
                                    />
                                    {form.errors.full_name && (
                                        <p className="text-xs text-rose-400 mt-1.5 flex items-center gap-1">
                                            <AlertCircle className="w-3.5 h-3.5" />
                                            {form.errors.full_name}
                                        </p>
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
                                        placeholder="e.g. 199012345678 or 901234567V"
                                        className={`${getInputClass(!!form.errors.nic)} font-mono`}
                                    />
                                    {form.errors.nic && (
                                        <p className="text-xs text-rose-400 mt-1.5 flex items-center gap-1">
                                            <AlertCircle className="w-3.5 h-3.5" />
                                            {form.errors.nic}
                                        </p>
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
                                        className={getInputClass(!!form.errors.email)}
                                    />
                                    {form.errors.email && (
                                        <p className="text-xs text-rose-400 mt-1.5 flex items-center gap-1">
                                            <AlertCircle className="w-3.5 h-3.5" />
                                            {form.errors.email}
                                        </p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                                        Phone Number (Mobile)
                                    </label>
                                    <input
                                        type="text"
                                        value={form.data.phone}
                                        onChange={(e) => form.setData('phone', e.target.value)}
                                        placeholder="+94 77 123 4567"
                                        className={getInputClass(!!form.errors.phone)}
                                    />
                                    {form.errors.phone && (
                                        <p className="text-xs text-rose-400 mt-1.5 flex items-center gap-1">
                                            <AlertCircle className="w-3.5 h-3.5" />
                                            {form.errors.phone}
                                        </p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                                        Landline
                                    </label>
                                    <input
                                        type="text"
                                        value={form.data.landline}
                                        onChange={(e) => form.setData('landline', e.target.value)}
                                        placeholder="+94 11 234 5678"
                                        className={getInputClass(!!form.errors.landline)}
                                    />
                                    {form.errors.landline && (
                                        <p className="text-xs text-rose-400 mt-1.5 flex items-center gap-1">
                                            <AlertCircle className="w-3.5 h-3.5" />
                                            {form.errors.landline}
                                        </p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                                        Date of Birth
                                    </label>
                                    <input
                                        type="date"
                                        value={form.data.date_of_birth}
                                        onChange={(e) => form.setData('date_of_birth', e.target.value)}
                                        className={getInputClass(!!form.errors.date_of_birth)}
                                    />
                                    {form.errors.date_of_birth && (
                                        <p className="text-xs text-rose-400 mt-1.5 flex items-center gap-1">
                                            <AlertCircle className="w-3.5 h-3.5" />
                                            {form.errors.date_of_birth}
                                        </p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                                        Gender
                                    </label>
                                    <select
                                        value={form.data.gender}
                                        onChange={(e) => form.setData('gender', e.target.value)}
                                        className={getInputClass(!!form.errors.gender)}
                                    >
                                        <option value="">Select Gender...</option>
                                        <option value="male">Male</option>
                                        <option value="female">Female</option>
                                        <option value="other">Other</option>
                                    </select>
                                    {form.errors.gender && (
                                        <p className="text-xs text-rose-400 mt-1.5 flex items-center gap-1">
                                            <AlertCircle className="w-3.5 h-3.5" />
                                            {form.errors.gender}
                                        </p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                                        Marital Status
                                    </label>
                                    <select
                                        value={form.data.marital_status}
                                        onChange={(e) => form.setData('marital_status', e.target.value)}
                                        className={getInputClass(!!form.errors.marital_status)}
                                    >
                                        <option value="">Select Status...</option>
                                        <option value="single">Single</option>
                                        <option value="married">Married</option>
                                        <option value="divorced">Divorced</option>
                                        <option value="widowed">Widowed</option>
                                    </select>
                                    {form.errors.marital_status && (
                                        <p className="text-xs text-rose-400 mt-1.5 flex items-center gap-1">
                                            <AlertCircle className="w-3.5 h-3.5" />
                                            {form.errors.marital_status}
                                        </p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                                        City
                                    </label>
                                    <input
                                        type="text"
                                        value={form.data.city}
                                        onChange={(e) => form.setData('city', e.target.value)}
                                        placeholder="e.g. Colombo"
                                        className={getInputClass(!!form.errors.city)}
                                    />
                                    {form.errors.city && (
                                        <p className="text-xs text-rose-400 mt-1.5 flex items-center gap-1">
                                            <AlertCircle className="w-3.5 h-3.5" />
                                            {form.errors.city}
                                        </p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                                        Date of Joining
                                    </label>
                                    <input
                                        type="date"
                                        value={form.data.date_of_joining}
                                        onChange={(e) => form.setData('date_of_joining', e.target.value)}
                                        className={getInputClass(!!form.errors.date_of_joining)}
                                    />
                                    {form.errors.date_of_joining && (
                                        <p className="text-xs text-rose-400 mt-1.5 flex items-center gap-1">
                                            <AlertCircle className="w-3.5 h-3.5" />
                                            {form.errors.date_of_joining}
                                        </p>
                                    )}
                                </div>

                                <div className="md:col-span-2">
                                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                                        Permanent Address
                                    </label>
                                    <input
                                        type="text"
                                        value={form.data.permanent_address}
                                        onChange={(e) => form.setData('permanent_address', e.target.value)}
                                        placeholder="Permanent residential address..."
                                        className={getInputClass(!!form.errors.permanent_address)}
                                    />
                                    {form.errors.permanent_address && (
                                        <p className="text-xs text-rose-400 mt-1.5 flex items-center gap-1">
                                            <AlertCircle className="w-3.5 h-3.5" />
                                            {form.errors.permanent_address}
                                        </p>
                                    )}
                                </div>

                                <div className="md:col-span-2">
                                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                                        Temporary / Current Address
                                    </label>
                                    <input
                                        type="text"
                                        value={form.data.temporary_address}
                                        onChange={(e) => form.setData('temporary_address', e.target.value)}
                                        placeholder="Current contact address (if different)..."
                                        className={getInputClass(!!form.errors.temporary_address)}
                                    />
                                    {form.errors.temporary_address && (
                                        <p className="text-xs text-rose-400 mt-1.5 flex items-center gap-1">
                                            <AlertCircle className="w-3.5 h-3.5" />
                                            {form.errors.temporary_address}
                                        </p>
                                    )}
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
                                        className={`${getInputClass(!!form.errors.emp_no)} font-mono`}
                                    />
                                    {form.errors.emp_no && (
                                        <p className="text-xs text-rose-400 mt-1.5 flex items-center gap-1">
                                            <AlertCircle className="w-3.5 h-3.5" />
                                            {form.errors.emp_no}
                                        </p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                                        Employment Classification *
                                    </label>
                                    <select
                                        value={form.data.employment_type}
                                        onChange={(e) => form.setData('employment_type', e.target.value as EmploymentType)}
                                        className={getInputClass(!!form.errors.employment_type)}
                                    >
                                        {employmentTypes.map((t) => (
                                            <option key={t.value} value={t.value}>
                                                {t.label}
                                            </option>
                                        ))}
                                    </select>
                                    {form.errors.employment_type && (
                                        <p className="text-xs text-rose-400 mt-1.5 flex items-center gap-1">
                                            <AlertCircle className="w-3.5 h-3.5" />
                                            {form.errors.employment_type}
                                        </p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                                        Employment Status *
                                    </label>
                                    <select
                                        value={form.data.employment_status}
                                        onChange={(e) => form.setData('employment_status', e.target.value as EmploymentStatus)}
                                        className={getInputClass(!!form.errors.employment_status)}
                                    >
                                        <option value="active">Active</option>
                                        <option value="resigned">Resigned</option>
                                        <option value="terminated">Terminated</option>
                                        <option value="suspended">Suspended</option>
                                    </select>
                                    {form.errors.employment_status && (
                                        <p className="text-xs text-rose-400 mt-1.5 flex items-center gap-1">
                                            <AlertCircle className="w-3.5 h-3.5" />
                                            {form.errors.employment_status}
                                        </p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                                        Assigned Department *
                                    </label>
                                    <select
                                        value={form.data.department_id}
                                        onChange={(e) => form.setData('department_id', e.target.value)}
                                        className={getInputClass(!!form.errors.department_id)}
                                    >
                                        <option value="">Select Department...</option>
                                        {departments.map((d) => (
                                            <option key={d.id} value={d.id}>
                                                {d.name} {d.code ? `(${d.code})` : ''}
                                            </option>
                                        ))}
                                    </select>
                                    {form.errors.department_id && (
                                        <p className="text-xs text-rose-400 mt-1.5 flex items-center gap-1">
                                            <AlertCircle className="w-3.5 h-3.5" />
                                            {form.errors.department_id}
                                        </p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                                        Designation / Job Title
                                    </label>
                                    <select
                                        value={form.data.designation_id}
                                        onChange={(e) => form.setData('designation_id', e.target.value)}
                                        className={getInputClass(!!form.errors.designation_id)}
                                    >
                                        <option value="">Select Designation...</option>
                                        {designations.map((desig) => (
                                            <option key={desig.id} value={desig.id}>
                                                {desig.title} {desig.grade ? `(${desig.grade})` : ''}
                                            </option>
                                        ))}
                                    </select>
                                    {form.errors.designation_id && (
                                        <p className="text-xs text-rose-400 mt-1.5 flex items-center gap-1">
                                            <AlertCircle className="w-3.5 h-3.5" />
                                            {form.errors.designation_id}
                                        </p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                                        Physical Branch
                                    </label>
                                    <select
                                        value={form.data.branch_id}
                                        onChange={(e) => form.setData('branch_id', e.target.value)}
                                        className={getInputClass(!!form.errors.branch_id)}
                                    >
                                        <option value="">Select Branch...</option>
                                        {branches.map((b) => (
                                             <option key={b.id} value={b.id}>
                                                 {b.name}
                                             </option>
                                        ))}
                                    </select>
                                    {form.errors.branch_id && (
                                        <p className="text-xs text-rose-400 mt-1.5 flex items-center gap-1">
                                            <AlertCircle className="w-3.5 h-3.5" />
                                            {form.errors.branch_id}
                                        </p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                                        Corporate Job Grade
                                    </label>
                                    <select
                                        value={form.data.job_grade_id}
                                        onChange={(e) => form.setData('job_grade_id', e.target.value)}
                                        className={getInputClass(!!form.errors.job_grade_id)}
                                    >
                                        <option value="">Select Job Grade...</option>
                                        {jobGrades.map((g) => (
                                            <option key={g.id} value={g.id}>
                                                {g.grade_name} ({g.grade_code})
                                            </option>
                                        ))}
                                    </select>
                                    {form.errors.job_grade_id && (
                                        <p className="text-xs text-rose-400 mt-1.5 flex items-center gap-1">
                                            <AlertCircle className="w-3.5 h-3.5" />
                                            {form.errors.job_grade_id}
                                        </p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                                        Statutory Labor Category *
                                    </label>
                                    <select
                                        value={form.data.employment_category}
                                        onChange={(e) => form.setData('employment_category', e.target.value as 'shop_and_office' | 'wages_board')}
                                        className={getInputClass(!!form.errors.employment_category)}
                                    >
                                        <option value="shop_and_office">Shop & Office Act (White Collar / Standard)</option>
                                        <option value="wages_board">Wages Board Ordinance (Blue Collar / Industry)</option>
                                    </select>
                                    {form.errors.employment_category && (
                                        <p className="text-xs text-rose-400 mt-1.5 flex items-center gap-1">
                                            <AlertCircle className="w-3.5 h-3.5" />
                                            {form.errors.employment_category}
                                        </p>
                                    )}
                                </div>

                                {form.data.employment_category === 'wages_board' && (
                                    <div>
                                        <label className="block text-xs font-semibold text-amber-400 uppercase tracking-wider mb-2">
                                            Wages Board Category *
                                        </label>
                                        <select
                                            value={form.data.wages_board_category_id}
                                            onChange={(e) => form.setData('wages_board_category_id', e.target.value)}
                                            className={getInputClass(!!form.errors.wages_board_category_id)}
                                        >
                                            <option value="">Select Board Category...</option>
                                            {wagesBoardCategories.map((wb) => (
                                                <option key={wb.id} value={wb.id}>
                                                    {wb.category_name} ({wb.category_code})
                                                </option>
                                            ))}
                                        </select>
                                        {form.errors.wages_board_category_id && (
                                            <p className="text-xs text-rose-400 mt-1.5 flex items-center gap-1">
                                                <AlertCircle className="w-3.5 h-3.5" />
                                                {form.errors.wages_board_category_id}
                                            </p>
                                        )}
                                    </div>
                                )}

                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                                        Attendance Tracking Mode *
                                    </label>
                                    <select
                                        value={form.data.attendance_mode}
                                        onChange={(e) => form.setData('attendance_mode', e.target.value as any)}
                                        className={getInputClass(!!form.errors.attendance_mode)}
                                    >
                                        <option value="both">Both (Biometric & Manual Attendance)</option>
                                        <option value="biometric">Biometric Only</option>
                                        <option value="manual">Manual Register Only</option>
                                    </select>
                                    {form.errors.attendance_mode && (
                                        <p className="text-xs text-rose-400 mt-1.5 flex items-center gap-1">
                                            <AlertCircle className="w-3.5 h-3.5" />
                                            {form.errors.attendance_mode}
                                        </p>
                                    )}
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
                                        className={`${getInputClass(!!form.errors.biometric_device_id)} font-mono`}
                                    />
                                    {form.errors.biometric_device_id ? (
                                        <p className="text-xs text-rose-400 mt-1.5 flex items-center gap-1">
                                            <AlertCircle className="w-3.5 h-3.5" />
                                            {form.errors.biometric_device_id}
                                        </p>
                                    ) : (
                                        <p className="text-[11px] text-slate-500 mt-1">
                                            Mapped against biometric device terminal punches for 4-window sliding contracts.
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="pt-6 border-t border-slate-800 flex justify-between">
                                <button
                                    type="button"
                                    onClick={() => setActiveSection('personal')}
                                    className="px-4 py-2 rounded-xl border border-slate-800 text-slate-400 hover:text-white text-xs font-semibold transition"
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
                                        onChange={(e) => form.setData('payment_mode', e.target.value as PaymentMode)}
                                        className={getInputClass(!!form.errors.payment_mode)}
                                    >
                                        {paymentModes.map((m) => (
                                            <option key={m.value} value={m.value}>
                                                {m.label}
                                            </option>
                                        ))}
                                    </select>
                                    {form.errors.payment_mode && (
                                        <p className="text-xs text-rose-400 mt-1.5 flex items-center gap-1">
                                            <AlertCircle className="w-3.5 h-3.5" />
                                            {form.errors.payment_mode}
                                        </p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                                        Effective Date
                                    </label>
                                    <input
                                        type="date"
                                        value={form.data.effective_date}
                                        onChange={(e) => form.setData('effective_date', e.target.value)}
                                        className={getInputClass(!!form.errors.effective_date)}
                                    />
                                    {form.errors.effective_date && (
                                        <p className="text-xs text-rose-400 mt-1.5 flex items-center gap-1">
                                            <AlertCircle className="w-3.5 h-3.5" />
                                            {form.errors.effective_date}
                                        </p>
                                    )}
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
                                            className={`${getInputClass(!!form.errors.basic_salary)} font-mono`}
                                        />
                                        {form.errors.basic_salary && (
                                            <p className="text-xs text-rose-400 mt-1.5 flex items-center gap-1">
                                                <AlertCircle className="w-3.5 h-3.5" />
                                                {form.errors.basic_salary}
                                            </p>
                                        )}
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
                                            className={`${getInputClass(!!form.errors.daily_rate)} font-mono`}
                                        />
                                        {form.errors.daily_rate && (
                                            <p className="text-xs text-rose-400 mt-1.5 flex items-center gap-1">
                                                <AlertCircle className="w-3.5 h-3.5" />
                                                {form.errors.daily_rate}
                                            </p>
                                        )}
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
                                            className={`${getInputClass(!!form.errors.hourly_rate)} font-mono`}
                                        />
                                        {form.errors.hourly_rate && (
                                            <p className="text-xs text-rose-400 mt-1.5 flex items-center gap-1">
                                                <AlertCircle className="w-3.5 h-3.5" />
                                                {form.errors.hourly_rate}
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="pt-6 border-t border-slate-800 flex justify-between">
                                <button
                                    type="button"
                                    onClick={() => setActiveSection('job')}
                                    className="px-4 py-2 rounded-xl border border-slate-800 text-slate-400 hover:text-white text-xs font-semibold transition"
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
                                        className={`${getInputClass(!!form.errors.epf_no)} font-mono`}
                                    />
                                    {form.errors.epf_no && (
                                        <p className="text-xs text-rose-400 mt-1.5 flex items-center gap-1">
                                            <AlertCircle className="w-3.5 h-3.5" />
                                            {form.errors.epf_no}
                                        </p>
                                    )}
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
                                        className={getInputClass(!!form.errors.bank_name)}
                                    />
                                    {form.errors.bank_name && (
                                        <p className="text-xs text-rose-400 mt-1.5 flex items-center gap-1">
                                            <AlertCircle className="w-3.5 h-3.5" />
                                            {form.errors.bank_name}
                                        </p>
                                    )}
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
                                        className={getInputClass(!!form.errors.branch_name)}
                                    />
                                    {form.errors.branch_name && (
                                        <p className="text-xs text-rose-400 mt-1.5 flex items-center gap-1">
                                            <AlertCircle className="w-3.5 h-3.5" />
                                            {form.errors.branch_name}
                                        </p>
                                    )}
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
                                        className={`${getInputClass(!!form.errors.account_no)} font-mono`}
                                    />
                                    {form.errors.account_no && (
                                        <p className="text-xs text-rose-400 mt-1.5 flex items-center gap-1">
                                            <AlertCircle className="w-3.5 h-3.5" />
                                            {form.errors.account_no}
                                        </p>
                                    )}
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
                                        className={getInputClass(!!form.errors.account_holder_name)}
                                    />
                                    {form.errors.account_holder_name && (
                                        <p className="text-xs text-rose-400 mt-1.5 flex items-center gap-1">
                                            <AlertCircle className="w-3.5 h-3.5" />
                                            {form.errors.account_holder_name}
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="pt-6 border-t border-slate-800 flex justify-between">
                                <button
                                    type="button"
                                    onClick={() => setActiveSection('compensation')}
                                    className="px-4 py-2 rounded-xl border border-slate-800 text-slate-400 hover:text-white text-xs font-semibold transition"
                                >
                                    ← Back
                                </button>
                                <button
                                    type="submit"
                                    disabled={form.processing}
                                    className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 transition disabled:opacity-50"
                                >
                                    {form.processing ? 'Saving...' : 'Save Profile Changes'}
                                </button>
                            </div>
                        </div>
                    )}
                </form>
            </div>
        </AuthenticatedLayout>
    );
}
