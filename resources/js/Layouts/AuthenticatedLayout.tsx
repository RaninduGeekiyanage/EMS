import React, { useState, useEffect } from 'react';
import { Head, Link, router, usePage } from '@inertiajs/react';
import {
    LayoutDashboard,
    Building2,
    FolderTree,
    Users,
    Clock,
    CalendarDays,
    FileSpreadsheet,
    CalendarCheck,
    Palmtree,
    DollarSign,
    ShieldAlert,
    LogOut,
    ChevronLeft,
    ChevronRight,
    Menu,
    X,
    User as UserIcon,
    ArrowLeftRight,
    CheckCircle2,
    AlertCircle,
} from 'lucide-react';

interface AuthProps {
    user: {
        id: number;
        name: string;
        email: string;
        tenant_id: string | null;
        is_super_admin: boolean;
        is_company_owner: boolean;
        roles: string[];
    } | null;
    tenant: {
        id: string;
        name: string;
        slug: string;
        is_active: boolean;
        is_ams_enabled: boolean;
        is_payroll_enabled: boolean;
    } | null;
    is_impersonating: boolean;
}

interface PageProps {
    auth: AuthProps;
    flash: {
        status?: string;
        success?: string;
        error?: string;
    };
    [key: string]: any;
}

interface LayoutProps {
    title?: string;
    children: React.ReactNode;
}

export default function AuthenticatedLayout({ title, children }: LayoutProps) {
    const { auth, flash } = usePage<PageProps>().props;
    const [collapsed, setCollapsed] = useState<boolean>(() => {
        return localStorage.getItem('ems_sidebar_collapsed') === 'true';
    });
    const [mobileOpen, setMobileOpen] = useState(false);
    const [profileOpen, setProfileOpen] = useState(false);

    const toggleCollapsed = () => {
        const next = !collapsed;
        setCollapsed(next);
        localStorage.setItem('ems_sidebar_collapsed', String(next));
    };

    const handleLogout = (e: React.FormEvent) => {
        e.preventDefault();
        router.post('/logout');
    };

    const handleExitImpersonation = () => {
        router.post('/admin/impersonate/exit');
    };

    const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';

    const isLinkActive = (path: string) => {
        if (path === '/dashboard') {
            return currentPath === '/dashboard';
        }
        return currentPath.startsWith(path);
    };

    const navItemClass = (path: string) => `
        flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition duration-200 group
        ${isLinkActive(path)
            ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
            : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900/80'}
    `;

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-indigo-500 selection:text-white">
            <Head title={title ? `${title} — EMS` : 'EMS'} />

            {/* Impersonation Banner for Super Admin */}
            {auth?.is_impersonating && (
                <div className="bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 text-amber-950 px-4 py-2 text-xs font-bold flex items-center justify-between shadow-md z-50 sticky top-0">
                    <div className="flex items-center gap-2 max-w-7xl mx-auto w-full justify-between">
                        <div className="flex items-center gap-2">
                            <ShieldAlert className="w-4 h-4 text-amber-950 animate-pulse" />
                            <span>
                                Super Admin Mode: Acting as Company Admin for <span className="underline">{auth.tenant?.name}</span> ({auth.tenant?.slug})
                            </span>
                        </div>
                        <button
                            onClick={handleExitImpersonation}
                            className="bg-slate-950 text-amber-300 hover:bg-slate-900 px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shadow"
                        >
                            <ArrowLeftRight className="w-3.5 h-3.5" />
                            Exit to Super Admin
                        </button>
                    </div>
                </div>
            )}

            <div className="flex-1 flex overflow-hidden">
                {/* Desktop Sidebar */}
                <aside
                    className={`hidden lg:flex flex-col border-r border-slate-800/80 bg-slate-950/90 backdrop-blur-md transition-all duration-300 z-30 ${
                        collapsed ? 'w-20' : 'w-64'
                    }`}
                >
                    {/* Brand / Company Header */}
                    <div className="h-16 border-b border-slate-800/80 px-4 flex items-center justify-between">
                        <Link href="/dashboard" className="flex items-center gap-3 overflow-hidden">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-sky-400 flex-shrink-0 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                                <Building2 className="w-5 h-5 text-white" />
                            </div>
                            {!collapsed && (
                                <div className="truncate">
                                    <h1 className="text-sm font-bold text-white tracking-tight truncate">
                                        {auth?.tenant?.name ?? 'EMS Platform'}
                                    </h1>
                                    <span className="text-[10px] text-indigo-400 uppercase tracking-wider font-semibold">
                                        {auth?.user?.is_super_admin ? 'Super Admin' : (auth?.user?.roles?.[0] ?? 'Tenant Admin')}
                                    </span>
                                </div>
                            )}
                        </Link>
                        <button
                            onClick={toggleCollapsed}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-900 transition"
                            title={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
                        >
                            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                        </button>
                    </div>

                    {/* Navigation Menu Links */}
                    <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
                        {/* Core Section */}
                        <div className="space-y-1">
                            {!collapsed && <p className="px-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Overview</p>}
                            <Link href="/dashboard" className={navItemClass('/dashboard')} title="Dashboard">
                                <LayoutDashboard className="w-5 h-5 flex-shrink-0" />
                                {!collapsed && <span>Dashboard</span>}
                            </Link>
                        </div>

                        {/* M01: Organization Master */}
                        <div className="space-y-1">
                            {!collapsed && <p className="px-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Organization (M01)</p>}
                            <Link href="/company/profile" className={navItemClass('/company/profile')} title="Company Profile">
                                <Building2 className="w-5 h-5 flex-shrink-0" />
                                {!collapsed && <span>Company Profile</span>}
                            </Link>
                            <Link href="/departments" className={navItemClass('/departments')} title="Departments">
                                <FolderTree className="w-5 h-5 flex-shrink-0" />
                                {!collapsed && <span>Departments</span>}
                            </Link>
                            <Link href="/employees" className={navItemClass('/employees')} title="Employees">
                                <Users className="w-5 h-5 flex-shrink-0" />
                                {!collapsed && <span>Employees</span>}
                            </Link>
                        </div>

                        {/* M02: AMS (Conditional on is_ams_enabled) */}
                        {auth?.tenant?.is_ams_enabled && (
                            <div className="space-y-1">
                                {!collapsed && <p className="px-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Attendance (M02)</p>}
                                <Link href="/attendance/daily" className={navItemClass('/attendance/daily')} title="Daily Attendance">
                                    <CalendarCheck className="w-5 h-5 flex-shrink-0" />
                                    {!collapsed && <span>Daily Attendance</span>}
                                </Link>
                                <Link href="/attendance/import" className={navItemClass('/attendance/import')} title="Biometric Import">
                                    <FileSpreadsheet className="w-5 h-5 flex-shrink-0" />
                                    {!collapsed && <span>Biometric Import</span>}
                                </Link>
                                <Link href="/shifts" className={navItemClass('/shifts')} title="Shifts">
                                    <Clock className="w-5 h-5 flex-shrink-0" />
                                    {!collapsed && <span>Shifts Roster</span>}
                                </Link>
                                <Link href="/work-calendar" className={navItemClass('/work-calendar')} title="Work Calendar">
                                    <CalendarDays className="w-5 h-5 flex-shrink-0" />
                                    {!collapsed && <span>Work Calendar</span>}
                                </Link>
                                <Link href="/leave/requests" className={navItemClass('/leave/requests')} title="Leave Requests">
                                    <Palmtree className="w-5 h-5 flex-shrink-0" />
                                    {!collapsed && <span>Leave Management</span>}
                                </Link>
                            </div>
                        )}

                        {/* M03: Payroll (Conditional on is_payroll_enabled) */}
                        {auth?.tenant?.is_payroll_enabled && (
                            <div className="space-y-1">
                                {!collapsed && <p className="px-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Payroll (M03)</p>}
                                <div className="flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium text-slate-500 bg-slate-900/30 border border-slate-800/40">
                                    <div className="flex items-center gap-3">
                                        <DollarSign className="w-5 h-5 flex-shrink-0 text-slate-500" />
                                        {!collapsed && <span>Payroll Runs</span>}
                                    </div>
                                    {!collapsed && <span className="text-[10px] bg-slate-800 text-indigo-300 px-1.5 py-0.5 rounded font-mono">Ready</span>}
                                </div>
                            </div>
                        )}

                        {/* Super Admin Switcher Link */}
                        {auth?.user?.is_super_admin && (
                            <div className="pt-4 border-t border-slate-800/60 space-y-1">
                                {!collapsed && <p className="px-3 text-[10px] font-semibold text-amber-400/80 uppercase tracking-wider">Platform Hub</p>}
                                <Link href="/admin/dashboard" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-amber-300 hover:bg-amber-950/40 border border-amber-500/20 transition">
                                    <ShieldAlert className="w-5 h-5 flex-shrink-0 text-amber-400" />
                                    {!collapsed && <span>Super Admin Panel</span>}
                                </Link>
                            </div>
                        )}
                    </nav>

                    {/* Footer User Info */}
                    <div className="p-3 border-t border-slate-800/80">
                        <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-slate-900/60 border border-slate-800">
                            <div className="flex items-center gap-2 overflow-hidden">
                                <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-300 font-bold text-xs flex-shrink-0">
                                    {auth?.user?.name ? auth.user.name.charAt(0).toUpperCase() : 'U'}
                                </div>
                                {!collapsed && (
                                    <div className="truncate">
                                        <p className="text-xs font-semibold text-slate-200 truncate">{auth?.user?.name}</p>
                                        <p className="text-[10px] text-slate-400 truncate">{auth?.user?.email}</p>
                                    </div>
                                )}
                            </div>
                            {!collapsed && (
                                <button
                                    onClick={handleLogout}
                                    title="Sign Out"
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-950/30 transition"
                                >
                                    <LogOut className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    </div>
                </aside>

                {/* Mobile Drawer Backdrop */}
                {mobileOpen && (
                    <div
                        onClick={() => setMobileOpen(false)}
                        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 lg:hidden"
                    />
                )}

                {/* Mobile Off-Canvas Sidebar */}
                <aside
                    className={`fixed inset-y-0 left-0 w-72 bg-slate-950 border-r border-slate-800 z-50 transform transition-transform duration-300 lg:hidden flex flex-col ${
                        mobileOpen ? 'translate-x-0' : '-translate-x-full'
                    }`}
                >
                    <div className="h-16 border-b border-slate-800 px-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white">
                                <Building2 className="w-5 h-5" />
                            </div>
                            <div>
                                <h1 className="text-sm font-bold text-white">{auth?.tenant?.name ?? 'EMS'}</h1>
                                <span className="text-[10px] text-indigo-400">{auth?.user?.roles?.[0] ?? 'Admin'}</span>
                            </div>
                        </div>
                        <button onClick={() => setMobileOpen(false)} className="p-1.5 text-slate-400">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <nav className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                        <Link href="/dashboard" className={navItemClass('/dashboard')} onClick={() => setMobileOpen(false)}>
                            <LayoutDashboard className="w-5 h-5" />
                            <span>Dashboard</span>
                        </Link>
                        <Link href="/company/profile" className={navItemClass('/company/profile')} onClick={() => setMobileOpen(false)}>
                            <Building2 className="w-5 h-5" />
                            <span>Company Profile</span>
                        </Link>
                        <Link href="/departments" className={navItemClass('/departments')} onClick={() => setMobileOpen(false)}>
                            <FolderTree className="w-5 h-5" />
                            <span>Departments</span>
                        </Link>
                        <Link href="/employees" className={navItemClass('/employees')} onClick={() => setMobileOpen(false)}>
                            <Users className="w-5 h-5" />
                            <span>Employees</span>
                        </Link>
                        {auth?.tenant?.is_ams_enabled && (
                            <>
                                <Link href="/attendance/daily" className={navItemClass('/attendance/daily')} onClick={() => setMobileOpen(false)}>
                                    <CalendarCheck className="w-5 h-5" />
                                    <span>Daily Attendance</span>
                                </Link>
                                <Link href="/attendance/import" className={navItemClass('/attendance/import')} onClick={() => setMobileOpen(false)}>
                                    <FileSpreadsheet className="w-5 h-5" />
                                    <span>Biometric Import</span>
                                </Link>
                                <Link href="/shifts" className={navItemClass('/shifts')} onClick={() => setMobileOpen(false)}>
                                    <Clock className="w-5 h-5" />
                                    <span>Shifts</span>
                                </Link>
                                <Link href="/work-calendar" className={navItemClass('/work-calendar')} onClick={() => setMobileOpen(false)}>
                                    <CalendarDays className="w-5 h-5" />
                                    <span>Work Calendar</span>
                                </Link>
                                <Link href="/leave/requests" className={navItemClass('/leave/requests')} onClick={() => setMobileOpen(false)}>
                                    <Palmtree className="w-5 h-5" />
                                    <span>Leave Requests</span>
                                </Link>
                            </>
                        )}
                        {auth?.user?.is_super_admin && (
                            <Link href="/admin/dashboard" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-amber-400 bg-amber-950/20 border border-amber-500/20">
                                <ShieldAlert className="w-5 h-5" />
                                <span>Super Admin Panel</span>
                            </Link>
                        )}
                    </nav>

                    <div className="p-4 border-t border-slate-800">
                        <button
                            onClick={handleLogout}
                            className="w-full py-2.5 px-4 rounded-xl bg-red-950/40 border border-red-800/40 text-red-300 text-xs font-semibold flex items-center justify-center gap-2"
                        >
                            <LogOut className="w-4 h-4" />
                            Sign Out
                        </button>
                    </div>
                </aside>

                {/* Main Content Area */}
                <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
                    {/* Top Navigation Bar */}
                    <header className="h-16 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md sticky top-0 z-20 px-4 lg:px-8 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setMobileOpen(true)}
                                className="lg:hidden p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-900 transition"
                            >
                                <Menu className="w-5 h-5" />
                            </button>
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                <span className="text-xs font-medium text-slate-300">
                                    {auth?.tenant?.name ?? 'EMS Enterprise'}
                                </span>
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                                    {auth?.tenant?.slug ?? 'system'}
                                </span>
                            </div>
                        </div>

                        {/* Top Bar Right: Profile Dropdown */}
                        <div className="relative">
                            <button
                                onClick={() => setProfileOpen(!profileOpen)}
                                className="flex items-center gap-3 p-1.5 rounded-xl hover:bg-slate-900 border border-transparent hover:border-slate-800 transition"
                            >
                                <div className="w-8 h-8 rounded-lg bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center font-bold text-xs">
                                    {auth?.user?.name ? auth.user.name.charAt(0).toUpperCase() : 'U'}
                                </div>
                                <div className="hidden sm:block text-left">
                                    <p className="text-xs font-semibold text-slate-200">{auth?.user?.name}</p>
                                    <p className="text-[10px] text-slate-400">{auth?.user?.roles?.[0] ?? (auth?.user?.is_super_admin ? 'Super Admin' : 'Staff')}</p>
                                </div>
                            </button>

                            {profileOpen && (
                                <div
                                    onMouseLeave={() => setProfileOpen(false)}
                                    className="absolute right-0 mt-2 w-56 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl py-2 z-50 text-xs"
                                >
                                    <div className="px-4 py-2 border-b border-slate-800">
                                        <p className="font-semibold text-white">{auth?.user?.name}</p>
                                        <p className="text-[11px] text-slate-400 truncate">{auth?.user?.email}</p>
                                        <div className="mt-1.5">
                                            <span className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                                {auth?.user?.roles?.[0] ?? (auth?.user?.is_super_admin ? 'Super Admin' : 'Staff')}
                                            </span>
                                        </div>
                                    </div>

                                    {auth?.user?.is_super_admin && (
                                        <Link
                                            href="/admin/dashboard"
                                            className="w-full text-left px-4 py-2 hover:bg-slate-800 text-amber-300 flex items-center gap-2"
                                            onClick={() => setProfileOpen(false)}
                                        >
                                            <ShieldAlert className="w-3.5 h-3.5" />
                                            Super Admin Panel
                                        </Link>
                                    )}

                                    <button
                                        onClick={handleLogout}
                                        className="w-full text-left px-4 py-2 hover:bg-slate-800 text-red-400 flex items-center gap-2"
                                    >
                                        <LogOut className="w-3.5 h-3.5" />
                                        Sign Out
                                    </button>
                                </div>
                            )}
                        </div>
                    </header>

                    {/* Global Flash Alerts */}
                    <div className="px-4 lg:px-8 pt-4">
                        {flash?.success && (
                            <div className="mb-4 p-4 rounded-xl bg-emerald-950/60 border border-emerald-800/60 text-emerald-300 text-xs flex items-center gap-2.5 shadow-lg shadow-emerald-950/20">
                                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                                <span>{flash.success}</span>
                            </div>
                        )}
                        {flash?.error && (
                            <div className="mb-4 p-4 rounded-xl bg-red-950/60 border border-red-800/60 text-red-300 text-xs flex items-center gap-2.5 shadow-lg shadow-red-950/20">
                                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                                <span>{flash.error}</span>
                            </div>
                        )}
                    </div>

                    {/* Main Child Content */}
                    <main className="flex-1 px-4 lg:px-8 py-6">
                        {children}
                    </main>
                </div>
            </div>
        </div>
    );
}
