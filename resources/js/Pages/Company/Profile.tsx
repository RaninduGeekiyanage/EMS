import React, { useState } from 'react';
import { Head, useForm, router } from '@inertiajs/react';
import {
    Building2,
    MapPin,
    Phone,
    Mail,
    FileText,
    ShieldCheck,
    Plus,
    Edit2,
    Trash2,
    CheckCircle2,
    Briefcase,
    Globe,
    Layers,
    X,
    AlertCircle,
} from 'lucide-react';

interface Company {
    id: string;
    tenant_id: string;
    name: string;
    br_number: string | null;
    epf_number: string | null;
    etf_number: string | null;
    logo_path: string | null;
    email: string | null;
    phone: string | null;
    address: string | null;
}

interface Branch {
    id: string;
    company_id: string;
    name: string;
    code: string | null;
    address: string | null;
    phone: string | null;
    email: string | null;
    is_head_office: boolean;
    is_active: boolean;
}

interface Props {
    company: Company;
    branches: Branch[];
}

export default function Profile({ company, branches }: Props) {
    const [activeTab, setActiveTab] = useState<'general' | 'statutory' | 'branches'>('general');
    const [isBranchModalOpen, setIsBranchModalOpen] = useState(false);
    const [editingBranch, setEditingBranch] = useState<Branch | null>(null);

    // Company Edit Form
    const companyForm = useForm({
        name: company.name || '',
        br_number: company.br_number || '',
        epf_number: company.epf_number || '',
        etf_number: company.etf_number || '',
        logo_path: company.logo_path || '',
        email: company.email || '',
        phone: company.phone || '',
        address: company.address || '',
    });

    // Branch Form
    const branchForm = useForm({
        company_id: company.id,
        name: '',
        code: '',
        address: '',
        phone: '',
        email: '',
        is_head_office: false,
        is_active: true,
    });

    const handleCompanySubmit = (e: React.FormEvent) => {
        e.preventDefault();
        companyForm.put(`/company/${company.id}`, {
            preserveScroll: true,
        });
    };

    const openCreateBranchModal = () => {
        setEditingBranch(null);
        branchForm.reset();
        branchForm.setData({
            company_id: company.id,
            name: '',
            code: '',
            address: '',
            phone: '',
            email: '',
            is_head_office: false,
            is_active: true,
        });
        setIsBranchModalOpen(true);
    };

    const openEditBranchModal = (branch: Branch) => {
        setEditingBranch(branch);
        branchForm.setData({
            company_id: branch.company_id,
            name: branch.name,
            code: branch.code || '',
            address: branch.address || '',
            phone: branch.phone || '',
            email: branch.email || '',
            is_head_office: Boolean(branch.is_head_office),
            is_active: Boolean(branch.is_active),
        });
        setIsBranchModalOpen(true);
    };

    const handleBranchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (editingBranch) {
            branchForm.put(`/branches/${editingBranch.id}`, {
                preserveScroll: true,
                onSuccess: () => setIsBranchModalOpen(false),
            });
        } else {
            branchForm.post('/branches', {
                preserveScroll: true,
                onSuccess: () => setIsBranchModalOpen(false),
            });
        }
    };

    const handleDeleteBranch = (branchId: string) => {
        if (confirm('Are you sure you want to delete this branch?')) {
            router.delete(`/branches/${branchId}`, {
                preserveScroll: true,
            });
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-indigo-500 selection:text-white pb-24">
            <Head title={`Company Profile — ${company.name}`} />

            {/* Top Navigation Bar */}
            <header className="border-b border-slate-800/80 bg-slate-950/70 backdrop-blur-md sticky top-0 z-40">
                <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-sky-400 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                            <Building2 className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <span className="text-lg font-bold tracking-tight text-white">
                                {company.name}
                            </span>
                            <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                                Organization Master
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <a
                            href="/departments"
                            className="text-xs font-medium text-slate-400 hover:text-slate-200 px-3 py-1.5 rounded-lg border border-slate-800 hover:border-slate-700 transition"
                        >
                            Departments Hierarchy →
                        </a>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-6 pt-10">
                {/* Header Profile Card */}
                <div className="p-8 rounded-3xl bg-slate-900/60 border border-slate-800/80 shadow-2xl relative overflow-hidden backdrop-blur-sm mb-8">
                    <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
                    
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
                        <div className="flex items-center gap-5">
                            <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-indigo-950 to-slate-800 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-inner">
                                <Briefcase className="w-10 h-10" />
                            </div>
                            <div>
                                <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white">
                                    {company.name}
                                </h1>
                                <p className="text-sm text-slate-400 mt-1 flex items-center gap-2">
                                    <MapPin className="w-4 h-4 text-slate-500" />
                                    {company.address || 'Address not configured'}
                                </p>
                            </div>
                        </div>

                        {/* Statutory Registration Badges */}
                        <div className="flex flex-wrap gap-2.5">
                            <div className="px-3.5 py-2 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center gap-2 text-xs">
                                <FileText className="w-4 h-4 text-sky-400" />
                                <span className="text-slate-400">BR No:</span>
                                <span className="font-semibold text-slate-200">
                                    {company.br_number || 'Pending'}
                                </span>
                            </div>
                            <div className="px-3.5 py-2 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center gap-2 text-xs">
                                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                                <span className="text-slate-400">EPF No:</span>
                                <span className="font-semibold text-slate-200">
                                    {company.epf_number || 'Pending'}
                                </span>
                            </div>
                            <div className="px-3.5 py-2 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center gap-2 text-xs">
                                <ShieldCheck className="w-4 h-4 text-amber-400" />
                                <span className="text-slate-400">ETF No:</span>
                                <span className="font-semibold text-slate-200">
                                    {company.etf_number || 'Pending'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Navigation Tabs */}
                    <div className="flex items-center gap-2 border-b border-slate-800 mt-8 pt-2">
                        <button
                            type="button"
                            onClick={() => setActiveTab('general')}
                            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition flex items-center gap-2 ${
                                activeTab === 'general'
                                    ? 'border-indigo-500 text-indigo-400'
                                    : 'border-transparent text-slate-400 hover:text-slate-200'
                            }`}
                        >
                            <Building2 className="w-4 h-4" />
                            General Information
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('statutory')}
                            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition flex items-center gap-2 ${
                                activeTab === 'statutory'
                                    ? 'border-indigo-500 text-indigo-400'
                                    : 'border-transparent text-slate-400 hover:text-slate-200'
                            }`}
                        >
                            <ShieldCheck className="w-4 h-4" />
                            Statutory Registrations
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('branches')}
                            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition flex items-center gap-2 ${
                                activeTab === 'branches'
                                    ? 'border-indigo-500 text-indigo-400'
                                    : 'border-transparent text-slate-400 hover:text-slate-200'
                            }`}
                        >
                            <Layers className="w-4 h-4" />
                            Physical Branches
                            <span className="px-2 py-0.5 rounded-full text-xs bg-slate-800 text-slate-300">
                                {branches.length}
                            </span>
                        </button>
                    </div>
                </div>

                {/* Tab 1: General Info */}
                {activeTab === 'general' && (
                    <form onSubmit={handleCompanySubmit} className="p-8 rounded-3xl bg-slate-900/60 border border-slate-800/80">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                                    Company Legal Name *
                                </label>
                                <input
                                    type="text"
                                    value={companyForm.data.name}
                                    onChange={(e) => companyForm.setData('name', e.target.value)}
                                    required
                                    className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                                />
                                {companyForm.errors.name && (
                                    <p className="text-xs text-rose-400 mt-1.5">{companyForm.errors.name}</p>
                                )}
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                                    Official Email Address
                                </label>
                                <input
                                    type="email"
                                    value={companyForm.data.email}
                                    onChange={(e) => companyForm.setData('email', e.target.value)}
                                    className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                                />
                                {companyForm.errors.email && (
                                    <p className="text-xs text-rose-400 mt-1.5">{companyForm.errors.email}</p>
                                )}
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                                    Primary Contact Phone
                                </label>
                                <input
                                    type="text"
                                    value={companyForm.data.phone}
                                    onChange={(e) => companyForm.setData('phone', e.target.value)}
                                    className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                                />
                                {companyForm.errors.phone && (
                                    <p className="text-xs text-rose-400 mt-1.5">{companyForm.errors.phone}</p>
                                )}
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                                    Brand Logo URL / Path
                                </label>
                                <input
                                    type="text"
                                    value={companyForm.data.logo_path}
                                    onChange={(e) => companyForm.setData('logo_path', e.target.value)}
                                    className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                                    placeholder="/logos/company.png"
                                />
                            </div>

                            <div className="md:col-span-2">
                                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                                    Registered Business Address
                                </label>
                                <textarea
                                    rows={3}
                                    value={companyForm.data.address}
                                    onChange={(e) => companyForm.setData('address', e.target.value)}
                                    className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                                />
                            </div>
                        </div>

                        <div className="mt-8 pt-6 border-t border-slate-800 flex justify-end">
                            <button
                                type="submit"
                                disabled={companyForm.processing}
                                className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold shadow-lg shadow-indigo-600/30 transition disabled:opacity-50"
                            >
                                {companyForm.processing ? 'Saving...' : 'Save Profile Changes'}
                            </button>
                        </div>
                    </form>
                )}

                {/* Tab 2: Statutory Info */}
                {activeTab === 'statutory' && (
                    <form onSubmit={handleCompanySubmit} className="p-8 rounded-3xl bg-slate-900/60 border border-slate-800/80">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div>
                                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                                    Business Registration (BR) Number
                                </label>
                                <input
                                    type="text"
                                    value={companyForm.data.br_number}
                                    onChange={(e) => companyForm.setData('br_number', e.target.value)}
                                    placeholder="PV 123456"
                                    className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                                    EPF Employer Number
                                </label>
                                <input
                                    type="text"
                                    value={companyForm.data.epf_number}
                                    onChange={(e) => companyForm.setData('epf_number', e.target.value)}
                                    placeholder="A/12345"
                                    className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                                    ETF Employer Number
                                </label>
                                <input
                                    type="text"
                                    value={companyForm.data.etf_number}
                                    onChange={(e) => companyForm.setData('etf_number', e.target.value)}
                                    placeholder="ETF/98765"
                                    className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                                />
                            </div>
                        </div>

                        {/* Sri Lanka Compliance Info Box */}
                        <div className="mt-8 p-6 rounded-2xl bg-indigo-950/20 border border-indigo-800/40 flex items-start gap-4">
                            <ShieldCheck className="w-6 h-6 text-indigo-400 mt-1 flex-shrink-0" />
                            <div>
                                <h4 className="text-sm font-semibold text-indigo-300">
                                    Sri Lanka Labor Law Compliance
                                </h4>
                                <p className="text-xs text-indigo-200/70 mt-1 leading-relaxed">
                                    The EPF & ETF employer numbers configured above will automatically stamp on all monthly C-Form and return documents, payslip declarations, and electronic remittance files in Module 3 (Payroll).
                                </p>
                            </div>
                        </div>

                        <div className="mt-8 pt-6 border-t border-slate-800 flex justify-end">
                            <button
                                type="submit"
                                disabled={companyForm.processing}
                                className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold shadow-lg shadow-indigo-600/30 transition disabled:opacity-50"
                            >
                                {companyForm.processing ? 'Saving...' : 'Update Statutory Information'}
                            </button>
                        </div>
                    </form>
                )}

                {/* Tab 3: Physical Branches */}
                {activeTab === 'branches' && (
                    <div>
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h3 className="text-lg font-bold text-white">Physical Branches</h3>
                                <p className="text-xs text-slate-400">
                                    Manage corporate headquarters and regional operations facilities.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={openCreateBranchModal}
                                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-indigo-600/20 transition"
                            >
                                <Plus className="w-4 h-4" />
                                Add Branch
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {branches.map((branch) => (
                                <div
                                    key={branch.id}
                                    className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition flex flex-col justify-between"
                                >
                                    <div>
                                        <div className="flex items-start justify-between gap-3 mb-3">
                                            <div>
                                                <h4 className="text-base font-bold text-white flex items-center gap-2">
                                                    {branch.name}
                                                    {branch.is_head_office && (
                                                        <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                                                            Head Office
                                                        </span>
                                                    )}
                                                </h4>
                                                {branch.code && (
                                                    <span className="text-xs font-mono text-indigo-400">
                                                        Code: {branch.code}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <button
                                                    type="button"
                                                    onClick={() => openEditBranchModal(branch)}
                                                    className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleDeleteBranch(branch.id)}
                                                    className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>

                                        <div className="space-y-2 text-xs text-slate-400 mt-4">
                                            <div className="flex items-center gap-2">
                                                <MapPin className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                                                <span className="truncate">{branch.address || 'No address registered'}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Phone className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                                                <span>{branch.phone || 'No phone'}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Mail className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                                                <span>{branch.email || 'No email'}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs">
                                        <span className="text-slate-500">Status</span>
                                        <span
                                            className={`font-semibold ${
                                                branch.is_active ? 'text-emerald-400' : 'text-slate-500'
                                            }`}
                                        >
                                            {branch.is_active ? 'Active' : 'Inactive'}
                                        </span>
                                    </div>
                                </div>
                            ))}

                            {branches.length === 0 && (
                                <div className="col-span-full p-12 text-center rounded-2xl bg-slate-900/40 border border-slate-800/60 text-slate-400">
                                    <Layers className="w-12 h-12 mx-auto text-slate-600 mb-3" />
                                    <p className="text-sm">No branches registered yet.</p>
                                    <button
                                        type="button"
                                        onClick={openCreateBranchModal}
                                        className="mt-4 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-500 transition"
                                    >
                                        Register First Branch
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </main>

            {/* Branch Create / Edit Modal */}
            {isBranchModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
                    <div className="w-full max-w-lg rounded-3xl bg-slate-900 border border-slate-800 p-6 shadow-2xl relative">
                        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                            <h3 className="text-base font-bold text-white">
                                {editingBranch ? 'Edit Branch' : 'Add Physical Branch'}
                            </h3>
                            <button
                                type="button"
                                onClick={() => setIsBranchModalOpen(false)}
                                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleBranchSubmit} className="mt-6 space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1">
                                    Branch Name *
                                </label>
                                <input
                                    type="text"
                                    value={branchForm.data.name}
                                    onChange={(e) => branchForm.setData('name', e.target.value)}
                                    required
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                                        Branch Code
                                    </label>
                                    <input
                                        type="text"
                                        value={branchForm.data.code}
                                        onChange={(e) => branchForm.setData('code', e.target.value)}
                                        placeholder="BR-COL"
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                                        Contact Phone
                                    </label>
                                    <input
                                        type="text"
                                        value={branchForm.data.phone}
                                        onChange={(e) => branchForm.setData('phone', e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1">
                                    Branch Email
                                </label>
                                <input
                                    type="email"
                                    value={branchForm.data.email}
                                    onChange={(e) => branchForm.setData('email', e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1">
                                    Physical Address
                                </label>
                                <textarea
                                    rows={2}
                                    value={branchForm.data.address}
                                    onChange={(e) => branchForm.setData('address', e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                                />
                            </div>

                            <div className="flex items-center gap-6 pt-2">
                                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-300">
                                    <input
                                        type="checkbox"
                                        checked={branchForm.data.is_head_office}
                                        onChange={(e) => branchForm.setData('is_head_office', e.target.checked)}
                                        className="w-4 h-4 rounded border-slate-700 text-indigo-600 focus:ring-0 focus:ring-offset-0 bg-slate-950"
                                    />
                                    Is Corporate Head Office
                                </label>

                                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-300">
                                    <input
                                        type="checkbox"
                                        checked={branchForm.data.is_active}
                                        onChange={(e) => branchForm.setData('is_active', e.target.checked)}
                                        className="w-4 h-4 rounded border-slate-700 text-indigo-600 focus:ring-0 focus:ring-offset-0 bg-slate-950"
                                    />
                                    Active Branch
                                </label>
                            </div>

                            <div className="pt-6 border-t border-slate-800 flex items-center justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsBranchModalOpen(false)}
                                    className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={branchForm.processing}
                                    className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/20 disabled:opacity-50"
                                >
                                    {branchForm.processing ? 'Saving...' : editingBranch ? 'Update Branch' : 'Create Branch'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
