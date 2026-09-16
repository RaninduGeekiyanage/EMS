import React, { useState } from 'react';
import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import {
    Building2,
    Users,
    ShieldAlert,
    Plus,
    Search,
    KeyRound,
    ArrowRight,
    CheckCircle2,
    XCircle,
    Sliders,
    Power,
    X,
    Eye,
    EyeOff,
    Check,
    LogOut,
    Sparkles,
} from 'lucide-react';

interface TenantItem {
    id: string;
    name: string;
    slug: string;
    is_active: boolean;
    is_ams_enabled: boolean;
    is_payroll_enabled: boolean;
    users_count: number;
    owner: {
        id: number;
        name: string;
        email: string;
    } | null;
    created_at: string;
}

interface Metrics {
    total_companies: number;
    active_companies: number;
    total_users: number;
    ams_enabled_count: number;
    payroll_enabled_count: number;
}

interface Props {
    tenants: TenantItem[];
    metrics: Metrics;
    filters: {
        search?: string;
    };
}

export default function SuperAdminDashboard({ tenants, metrics, filters }: Props) {
    const { flash } = usePage<{ flash: { success?: string; error?: string } }>().props;
    const [search, setSearch] = useState(filters.search || '');
    const [createModalOpen, setCreateModalOpen] = useState(false);
    const [resetModalTenant, setResetModalTenant] = useState<TenantItem | null>(null);

    // Create Company Form
    const createForm = useForm({
        name: '',
        slug: '',
        owner_name: '',
        owner_email: '',
        owner_password: '',
        is_ams_enabled: true,
        is_payroll_enabled: true,
    });

    // Reset Password Form
    const resetForm = useForm({
        password: '',
    });

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        router.get('/admin/dashboard', { search: search || undefined }, { preserveState: true, replace: true });
    };

    const handleNameChange = (val: string) => {
        createForm.setData((prev) => ({
            ...prev,
            name: val,
            slug: val
                .toLowerCase()
                .trim()
                .replace(/[^a-z0-9\s-]/g, '')
                .replace(/\s+/g, '-'),
        }));
    };

    const handleCreateSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        createForm.post('/admin/companies', {
            onSuccess: () => {
                setCreateModalOpen(false);
                createForm.reset();
            },
        });
    };

    const handleResetSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!resetModalTenant) return;
        resetForm.post(`/admin/companies/${resetModalTenant.id}/reset-admin-password`, {
            onSuccess: () => {
                setResetModalTenant(null);
                resetForm.reset();
            },
        });
    };

    const toggleCompanyStatus = (tenant: TenantItem) => {
        router.post(`/admin/companies/${tenant.id}/toggle-status`, {}, { preserveScroll: true });
    };

    const toggleModule = (tenant: TenantItem, module: 'ams' | 'payroll') => {
        router.post(`/admin/companies/${tenant.id}/toggle-module/${module}`, {}, { preserveScroll: true });
    };

    const handleImpersonate = (tenant: TenantItem) => {
        router.post(`/admin/companies/${tenant.id}/impersonate`);
    };

    const handleLogout = () => {
        router.post('/logout');
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-indigo-500 selection:text-white">
            <Head title="Super Admin Platform Dashboard" />

            {/* Top Bar */}
            <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md sticky top-0 z-30 px-6 h-16 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-amber-500/20">
                        <ShieldAlert className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                            EMS Super Admin Hub
                            <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                Platform Root
                            </span>
                        </h1>
                        <p className="text-xs text-slate-400">Multi-Company Architecture & Tenant Governance</p>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <button
                        onClick={handleLogout}
                        className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-red-500/40 text-xs font-semibold text-slate-300 hover:text-red-400 flex items-center gap-2 transition"
                    >
                        <LogOut className="w-3.5 h-3.5" />
                        Sign Out
                    </button>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-6 py-8 flex-1 w-full space-y-8">
                {/* Flash Messages */}
                {flash?.success && (
                    <div className="p-4 rounded-2xl bg-emerald-950/60 border border-emerald-800/60 text-emerald-300 text-xs flex items-center gap-2.5 shadow-lg">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                        <span>{flash.success}</span>
                    </div>
                )}
                {flash?.error && (
                    <div className="p-4 rounded-2xl bg-red-950/60 border border-red-800/60 text-red-300 text-xs flex items-center gap-2.5 shadow-lg">
                        <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                        <span>{flash.error}</span>
                    </div>
                )}

                {/* KPI Metrics Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                    <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80">
                        <span className="text-xs text-slate-400 font-medium">Total Companies</span>
                        <h3 className="text-2xl font-bold text-white mt-1">{metrics.total_companies}</h3>
                        <p className="text-[11px] text-slate-500 mt-1">Managed Workspaces</p>
                    </div>

                    <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80">
                        <span className="text-xs text-slate-400 font-medium">Active Tenants</span>
                        <h3 className="text-2xl font-bold text-emerald-400 mt-1">{metrics.active_companies}</h3>
                        <p className="text-[11px] text-emerald-500/70 mt-1">Live Operational</p>
                    </div>

                    <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80">
                        <span className="text-xs text-slate-400 font-medium">Platform Users</span>
                        <h3 className="text-2xl font-bold text-indigo-400 mt-1">{metrics.total_users}</h3>
                        <p className="text-[11px] text-slate-500 mt-1">Admins & Staff Accounts</p>
                    </div>

                    <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80">
                        <span className="text-xs text-slate-400 font-medium">AMS Enabled</span>
                        <h3 className="text-2xl font-bold text-sky-400 mt-1">{metrics.ams_enabled_count}</h3>
                        <p className="text-[11px] text-sky-500/70 mt-1">Biometric Attendance</p>
                    </div>

                    <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80">
                        <span className="text-xs text-slate-400 font-medium">Payroll Enabled</span>
                        <h3 className="text-2xl font-bold text-purple-400 mt-1">{metrics.payroll_enabled_count}</h3>
                        <p className="text-[11px] text-purple-500/70 mt-1">Statutory Engine</p>
                    </div>
                </div>

                {/* Companies Section */}
                <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800/80 space-y-6">
                    {/* Header & Controls */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h2 className="text-lg font-bold text-white tracking-tight">Registered Companies</h2>
                            <p className="text-xs text-slate-400">
                                Provision companies, configure active modules, and access tenant environments.
                            </p>
                        </div>

                        <div className="flex items-center gap-3">
                            <form onSubmit={handleSearch} className="relative">
                                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                                <input
                                    type="text"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Search company or slug..."
                                    className="pl-9 pr-4 py-2 rounded-xl bg-slate-950/70 border border-slate-800 focus:border-indigo-500 text-xs text-slate-100 placeholder:text-slate-600 w-56 transition"
                                />
                            </form>

                            <button
                                onClick={() => setCreateModalOpen(true)}
                                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-indigo-600/30 transition"
                            >
                                <Plus className="w-4 h-4" />
                                New Company
                            </button>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto rounded-2xl border border-slate-800/80">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[10px]">
                                <tr>
                                    <th className="px-5 py-3.5 font-semibold">Company / Slug</th>
                                    <th className="px-5 py-3.5 font-semibold">Company Owner</th>
                                    <th className="px-5 py-3.5 font-semibold text-center">Status</th>
                                    <th className="px-5 py-3.5 font-semibold text-center">Modules</th>
                                    <th className="px-5 py-3.5 font-semibold text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/60 bg-slate-900/30">
                                {tenants.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-5 py-8 text-center text-slate-500 text-xs">
                                            No companies found. Create your first company above.
                                        </td>
                                    </tr>
                                ) : (
                                    tenants.map((t) => (
                                        <tr key={t.id} className="hover:bg-slate-800/40 transition">
                                            <td className="px-5 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-lg bg-indigo-600/20 text-indigo-400 border border-indigo-500/20 flex items-center justify-center font-bold text-xs">
                                                        <Building2 className="w-4 h-4" />
                                                    </div>
                                                    <div>
                                                        <p className="font-semibold text-white">{t.name}</p>
                                                        <p className="text-[11px] font-mono text-indigo-400">{t.slug}</p>
                                                    </div>
                                                </div>
                                            </td>

                                            <td className="px-5 py-4">
                                                {t.owner ? (
                                                    <div>
                                                        <p className="font-medium text-slate-200">{t.owner.name}</p>
                                                        <p className="text-[11px] text-slate-400">{t.owner.email}</p>
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-500 italic">No owner assigned</span>
                                                )}
                                            </td>

                                            <td className="px-5 py-4 text-center">
                                                <button
                                                    onClick={() => toggleCompanyStatus(t)}
                                                    className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition ${
                                                        t.is_active
                                                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                                                            : 'bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20'
                                                    }`}
                                                >
                                                    {t.is_active ? 'Active' : 'Inactive'}
                                                </button>
                                            </td>

                                            <td className="px-5 py-4">
                                                <div className="flex items-center justify-center gap-2">
                                                    <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-300 border border-slate-700">
                                                        M01 Master
                                                    </span>

                                                    <button
                                                        onClick={() => toggleModule(t, 'ams')}
                                                        className={`px-2 py-0.5 rounded text-[10px] font-medium border transition ${
                                                            t.is_ams_enabled
                                                                ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                                                                : 'bg-slate-800/40 text-slate-500 border-slate-800 line-through'
                                                        }`}
                                                        title="Click to toggle AMS module"
                                                    >
                                                        M02 AMS
                                                    </button>

                                                    <button
                                                        onClick={() => toggleModule(t, 'payroll')}
                                                        className={`px-2 py-0.5 rounded text-[10px] font-medium border transition ${
                                                            t.is_payroll_enabled
                                                                ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                                                                : 'bg-slate-800/40 text-slate-500 border-slate-800 line-through'
                                                        }`}
                                                        title="Click to toggle Payroll module"
                                                    >
                                                        M03 Payroll
                                                    </button>
                                                </div>
                                            </td>

                                            <td className="px-5 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={() => setResetModalTenant(t)}
                                                        className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1.5 transition border border-slate-700"
                                                        title="Reset Top Admin Password"
                                                    >
                                                        <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                                                        <span>Reset Pass</span>
                                                    </button>

                                                    <button
                                                        onClick={() => handleImpersonate(t)}
                                                        className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium flex items-center gap-1.5 transition shadow"
                                                        title="Manage company as Admin"
                                                    >
                                                        <span>Work as Admin</span>
                                                        <ArrowRight className="w-3.5 h-3.5" />
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
            </main>

            {/* Create Company Modal */}
            {createModalOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg p-6 space-y-6 shadow-2xl">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
                                    <Plus className="w-4 h-4" />
                                </div>
                                <h3 className="font-bold text-white text-base">Provision New Company</h3>
                            </div>
                            <button onClick={() => setCreateModalOpen(false)} className="text-slate-500 hover:text-slate-300">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-slate-300 font-semibold mb-1">Company Legal Name</label>
                                    <input
                                        type="text"
                                        required
                                        value={createForm.data.name}
                                        onChange={(e) => handleNameChange(e.target.value)}
                                        placeholder="e.g. Ceylon Logistics Ltd"
                                        className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 focus:border-indigo-500 text-slate-100 text-xs"
                                    />
                                    {createForm.errors.name && <p className="text-red-400 mt-1">{createForm.errors.name}</p>}
                                </div>

                                <div>
                                    <label className="block text-slate-300 font-semibold mb-1">Workspace Slug</label>
                                    <input
                                        type="text"
                                        required
                                        value={createForm.data.slug}
                                        onChange={(e) => createForm.setData('slug', e.target.value)}
                                        placeholder="e.g. ceylon-logistics"
                                        className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 focus:border-indigo-500 text-slate-100 text-xs font-mono"
                                    />
                                    {createForm.errors.slug && <p className="text-red-400 mt-1">{createForm.errors.slug}</p>}
                                </div>
                            </div>

                            <div className="pt-2 border-t border-slate-800">
                                <p className="text-[11px] text-amber-400 uppercase font-semibold tracking-wider mb-2">Initial Company Owner Account</p>
                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-slate-300 font-semibold mb-1">Owner Full Name</label>
                                        <input
                                            type="text"
                                            required
                                            value={createForm.data.owner_name}
                                            onChange={(e) => createForm.setData('owner_name', e.target.value)}
                                            placeholder="John Silva"
                                            className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 focus:border-indigo-500 text-slate-100 text-xs"
                                        />
                                        {createForm.errors.owner_name && <p className="text-red-400 mt-1">{createForm.errors.owner_name}</p>}
                                    </div>

                                    <div>
                                        <label className="block text-slate-300 font-semibold mb-1">Owner Email</label>
                                        <input
                                            type="email"
                                            required
                                            value={createForm.data.owner_email}
                                            onChange={(e) => createForm.setData('owner_email', e.target.value)}
                                            placeholder="admin@ceylonlogistics.com"
                                            className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 focus:border-indigo-500 text-slate-100 text-xs"
                                        />
                                        {createForm.errors.owner_email && <p className="text-red-400 mt-1">{createForm.errors.owner_email}</p>}
                                    </div>

                                    <div>
                                        <label className="block text-slate-300 font-semibold mb-1">Owner Password</label>
                                        <input
                                            type="password"
                                            required
                                            value={createForm.data.owner_password}
                                            onChange={(e) => createForm.setData('owner_password', e.target.value)}
                                            placeholder="Min. 8 characters"
                                            className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 focus:border-indigo-500 text-slate-100 text-xs"
                                        />
                                        {createForm.errors.owner_password && <p className="text-red-400 mt-1">{createForm.errors.owner_password}</p>}
                                    </div>
                                </div>
                            </div>

                            <div className="pt-2 border-t border-slate-800">
                                <p className="text-[11px] text-slate-400 uppercase font-semibold tracking-wider mb-2">Module Access Toggles</p>
                                <div className="space-y-2">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={createForm.data.is_ams_enabled}
                                            onChange={(e) => createForm.setData('is_ams_enabled', e.target.checked)}
                                            className="rounded bg-slate-950 border-slate-800 text-indigo-600"
                                        />
                                        <span className="text-slate-300 font-medium">Enable M02 — Attendance Management System (AMS)</span>
                                    </label>

                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={createForm.data.is_payroll_enabled}
                                            onChange={(e) => createForm.setData('is_payroll_enabled', e.target.checked)}
                                            className="rounded bg-slate-950 border-slate-800 text-indigo-600"
                                        />
                                        <span className="text-slate-300 font-medium">Enable M03 — Payroll & Statutory Compliance</span>
                                    </label>
                                </div>
                            </div>

                            <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-800">
                                <button
                                    type="button"
                                    onClick={() => setCreateModalOpen(false)}
                                    className="px-4 py-2 rounded-xl border border-slate-800 text-slate-400 hover:text-white text-xs font-semibold"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={createForm.processing}
                                    className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition"
                                >
                                    {createForm.processing ? 'Provisioning...' : 'Provision Company'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Reset Password Modal */}
            {resetModalTenant && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 space-y-5 shadow-2xl">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
                                    <KeyRound className="w-4 h-4" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-white text-sm">Reset Owner Password</h3>
                                    <p className="text-[11px] text-slate-400">{resetModalTenant.name}</p>
                                </div>
                            </div>
                            <button onClick={() => setResetModalTenant(null)} className="text-slate-500 hover:text-slate-300">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleResetSubmit} className="space-y-4 text-xs">
                            <div>
                                <p className="text-slate-400 mb-2">
                                    Set a new password for account: <strong className="text-white">{resetModalTenant.owner?.email ?? 'Company Owner'}</strong>
                                </p>
                                <label className="block text-slate-300 font-semibold mb-1">New Password</label>
                                <input
                                    type="password"
                                    required
                                    value={resetForm.data.password}
                                    onChange={(e) => resetForm.setData('password', e.target.value)}
                                    placeholder="Enter new password (min. 8 chars)"
                                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 focus:border-indigo-500 text-slate-100 text-xs"
                                />
                                {resetForm.errors.password && <p className="text-red-400 mt-1">{resetForm.errors.password}</p>}
                            </div>

                            <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-800">
                                <button
                                    type="button"
                                    onClick={() => setResetModalTenant(null)}
                                    className="px-4 py-2 rounded-xl border border-slate-800 text-slate-400 hover:text-white text-xs font-semibold"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={resetForm.processing}
                                    className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs transition"
                                >
                                    {resetForm.processing ? 'Updating...' : 'Update Password'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
