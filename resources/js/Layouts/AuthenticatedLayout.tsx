import React, { useState } from 'react';
import { Head, Link, router, usePage } from '@inertiajs/react';
import ThemeToggle from '@/Components/ThemeToggle';
import {
    LayoutDashboard,
    Building2,
    FolderTree,
    Users,
    Clock,
    CalendarDays,
    CalendarRange,
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
    UserCheck,
    ArrowLeftRight,
    CheckCircle2,
    AlertCircle,
    ShieldCheck,
    Sparkles,
    ArrowLeft,
    Layers,
    FileText,
    Cpu,
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
    backUrl?: string;
    showBackButton?: boolean;
    children: React.ReactNode;
}

export default function AuthenticatedLayout({
    title,
    backUrl,
    showBackButton,
    children,
}: LayoutProps) {
    const { auth, flash } = usePage<PageProps>().props;
    const [collapsed, setCollapsed] = useState<boolean>(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('ems_sidebar_collapsed') === 'true';
        }
        return false;
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

    const { url } = usePage();
    const currentPath = (url || (typeof window !== 'undefined' ? window.location.pathname : '')).split('?')[0];

    const isLinkActive = (path: string) => {
        if (path === '/dashboard' || path === '/admin/dashboard') {
            return currentPath === path;
        }
        if (path === '/roster') {
            return (
                currentPath === '/roster' ||
                (currentPath.startsWith('/roster/') &&
                    !currentPath.startsWith('/roster/patterns') &&
                    !currentPath.startsWith('/roster/shift-swaps'))
            );
        }
        return currentPath === path || currentPath.startsWith(`${path}/`);
    };

    const navItemClass = (path: string) => `
        flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition duration-150 group
        ${collapsed ? 'justify-center' : ''}
        ${isLinkActive(path)
            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25 font-semibold'
            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-900/80'}
    `;

    const canAccessSettings = Boolean(
        auth?.user?.is_super_admin ||
        auth?.user?.is_company_owner ||
        auth?.user?.roles?.includes('Company Admin') ||
        auth?.user?.roles?.includes('HR Manager')
    );

    // Determine back button visibility
    const shouldShowBack = showBackButton !== undefined
        ? showBackButton
        : Boolean(backUrl || (currentPath && currentPath !== '/dashboard' && currentPath !== '/admin/dashboard' && currentPath !== '/'));

    const handleBack = () => {
        if (backUrl) {
            router.visit(backUrl);
        } else if (typeof window !== 'undefined' && window.history.length > 1) {
            window.history.back();
        } else {
            router.visit(auth?.user?.is_super_admin && !auth?.tenant ? '/admin/dashboard' : '/dashboard');
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col selection:bg-indigo-500 selection:text-white transition-colors duration-200">
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
                    className={`hidden lg:flex flex-col border-r border-slate-200 dark:border-slate-800/80 bg-white/95 dark:bg-slate-950/90 backdrop-blur-md transition-all duration-300 z-30 ${
                        collapsed ? 'w-20' : 'w-64'
                    }`}
                >
                    {/* Brand / Company Header */}
                    <div className="h-16 border-b border-slate-200 dark:border-slate-800/80 px-4 flex items-center justify-between">
                        <Link href="/dashboard" className="flex items-center gap-3 overflow-hidden">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-sky-500 flex-shrink-0 flex items-center justify-center shadow-lg shadow-indigo-500/20 text-white">
                                <Building2 className="w-5 h-5" />
                            </div>
                            {!collapsed && (
                                <div className="truncate">
                                    <h1 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight truncate">
                                        {auth?.tenant?.name ?? 'EMS Enterprise'}
                                    </h1>
                                    <span className="text-[10px] text-indigo-600 dark:text-indigo-400 uppercase tracking-wider font-semibold">
                                        {auth?.user?.is_super_admin ? 'Super Admin' : (auth?.user?.roles?.[0] ?? 'Company Admin')}
                                    </span>
                                </div>
                            )}
                        </Link>
                        <button
                            onClick={toggleCollapsed}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900 transition"
                            title={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
                        >
                            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                        </button>
                    </div>

                    {/* Navigation Menu Links */}
                    <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
                        {/* Overview Section */}
                        <div className="space-y-1">
                            {!collapsed && (
                                <p className="px-3 text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                                    Overview
                                </p>
                            )}
                            <Link href="/dashboard" className={navItemClass('/dashboard')} title="Dashboard">
                                <LayoutDashboard className="w-4 h-4 flex-shrink-0" />
                                {!collapsed && <span>Executive Dashboard</span>}
                            </Link>
                        </div>

                        {/* Workforce Management */}
                        <div className="space-y-1">
                            {!collapsed && (
                                <p className="px-3 text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                                    Workforce
                                </p>
                            )}
                            <Link href="/employees" className={navItemClass('/employees')} title="Employees">
                                <Users className="w-4 h-4 flex-shrink-0" />
                                {!collapsed && <span>Employees Master</span>}
                            </Link>
                            <Link href="/departments" className={navItemClass('/departments')} title="Departments & HODs">
                                <FolderTree className="w-4 h-4 flex-shrink-0" />
                                {!collapsed && <span>Departments & HODs</span>}
                            </Link>
                            <Link href="/company/profile" className={navItemClass('/company/profile')} title="Company Profile">
                                <Building2 className="w-4 h-4 flex-shrink-0" />
                                {!collapsed && <span>Company Profile</span>}
                            </Link>
                            <Link href="/users" className={navItemClass('/users')} title="User Accounts">
                                <UserCheck className="w-4 h-4 flex-shrink-0" />
                                {!collapsed && <span>User Accounts</span>}
                            </Link>
                            <Link href="/access-control" className={navItemClass('/access-control')} title="Access Control">
                                <ShieldCheck className="w-4 h-4 flex-shrink-0" />
                                {!collapsed && <span>Roles & Permissions</span>}
                            </Link>
                        </div>

                        {/* Time & Attendance (AMS) */}
                        {auth?.tenant?.is_ams_enabled && (
                            <div className="space-y-1">
                                {!collapsed && (
                                    <p className="px-3 text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                                        Time & Attendance
                                    </p>
                                )}
                                <Link href="/shifts" className={navItemClass('/shifts')} title="Shift Definitions & Master Timings">
                                    <Clock className="w-4 h-4 flex-shrink-0" />
                                    {!collapsed && <span>Shift Master</span>}
                                </Link>
                                <Link href="/roster/patterns" className={navItemClass('/roster/patterns')} title="Shift Groups & Rotation Templates">
                                    <Sparkles className="w-4 h-4 flex-shrink-0" />
                                    {!collapsed && <span>Shift Groups & Patterns</span>}
                                </Link>
                                <Link href="/roster" className={navItemClass('/roster')} title="Monthly Duty Roster Calendar">
                                    <CalendarRange className="w-4 h-4 flex-shrink-0" />
                                    {!collapsed && <span>Duty Roster</span>}
                                </Link>
                                <Link href="/roster/shift-swaps" className={navItemClass('/roster/shift-swaps')} title="Shift Swap Requests">
                                    <ArrowLeftRight className="w-4 h-4 flex-shrink-0" />
                                    {!collapsed && <span>Shift Swap Requests</span>}
                                </Link>
                                <Link href="/attendance/daily" className={navItemClass('/attendance/daily')} title="Daily Attendance Ledger">
                                    <CalendarCheck className="w-4 h-4 flex-shrink-0" />
                                    {!collapsed && <span>Daily Attendance</span>}
                                </Link>
                                <Link href="/attendance/import" className={navItemClass('/attendance/import')} title="Biometric Ingestion">
                                    <FileSpreadsheet className="w-4 h-4 flex-shrink-0" />
                                    {!collapsed && <span>Biometric Import</span>}
                                </Link>
                                <Link href="/work-calendar" className={navItemClass('/work-calendar')} title="Work Calendar & Holidays">
                                    <CalendarDays className="w-4 h-4 flex-shrink-0" />
                                    {!collapsed && <span>Work Calendar & Holidays</span>}
                                </Link>
                            </div>
                        )}

                        {/* Leave Management */}
                        <div className="space-y-1">
                            {!collapsed && (
                                <p className="px-3 text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                                    Leave Management
                                </p>
                            )}
                            <Link href="/leave/requests" className={navItemClass('/leave/requests')} title="Leave Requests & Entitlements">
                                <Palmtree className="w-4 h-4 flex-shrink-0" />
                                {!collapsed && <span>Leave & Entitlements</span>}
                            </Link>
                        </div>

                        {/* Payroll & Compliance */}
                        {auth?.tenant?.is_payroll_enabled && (
                            <div className="space-y-1">
                                {!collapsed && (
                                    <p className="px-3 text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                                        Payroll & Finance
                                    </p>
                                )}
                                <Link href="/payroll" className={navItemClass('/payroll')} title="Payroll Runs & Disbursal">
                                    <DollarSign className="w-4 h-4 flex-shrink-0" />
                                    {!collapsed && <span>Payroll Runs</span>}
                                </Link>
                            </div>
                        )}

                        {/* Reports & Analytics */}
                        <div className="space-y-1">
                            {!collapsed && (
                                <p className="px-3 text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                                    Intelligence & Reports
                                </p>
                            )}
                            <Link href="/reports/custom" className={navItemClass('/reports/custom')} title="Custom HR Report Builder">
                                <FileText className="w-4 h-4 flex-shrink-0" />
                                {!collapsed && <span>Custom HR Builder</span>}
                            </Link>
                        </div>

                        {/* Settings */}
                        {canAccessSettings && (
                            <div className="space-y-1">
                                {!collapsed && (
                                    <p className="px-3 text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                                        Settings
                                    </p>
                                )}
                                <Link href="/settings/biometric" className={navItemClass('/settings/biometric')} title="Biometric Device Configuration">
                                    <Cpu className="w-4 h-4 flex-shrink-0" />
                                    {!collapsed && <span>Biometric Config</span>}
                                </Link>
                            </div>
                        )}

                        {/* Super Admin Switcher Link */}
                        {auth?.user?.is_super_admin && (
                            <div className="pt-3 border-t border-slate-200 dark:border-slate-800/80 space-y-1">
                                {!collapsed && (
                                    <p className="px-3 text-[10px] font-semibold text-amber-600 dark:text-amber-400/80 uppercase tracking-wider">
                                        Platform Hub
                                    </p>
                                )}
                                <Link
                                    href="/admin/dashboard"
                                    className="flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/40 border border-amber-300 dark:border-amber-500/20 transition"
                                >
                                    <ShieldAlert className="w-4 h-4 flex-shrink-0 text-amber-600 dark:text-amber-400" />
                                    {!collapsed && <span>Super Admin Panel</span>}
                                </Link>
                                <Link
                                    href="/admin/access-control"
                                    className="flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 border border-indigo-300 dark:border-indigo-500/20 transition"
                                >
                                    <ShieldCheck className="w-4 h-4 flex-shrink-0 text-indigo-600 dark:text-indigo-400" />
                                    {!collapsed && <span>Global Access Control</span>}
                                </Link>
                            </div>
                        )}
                    </nav>

                    {/* Footer User Info */}
                    <div className="p-3 border-t border-slate-200 dark:border-slate-800/80">
                        <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-slate-100/80 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
                            <div className="flex items-center gap-2 overflow-hidden">
                                <div className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-300 font-bold text-xs flex-shrink-0">
                                    {auth?.user?.name ? auth.user.name.charAt(0).toUpperCase() : 'U'}
                                </div>
                                {!collapsed && (
                                    <div className="truncate">
                                        <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                                            {auth?.user?.name}
                                        </p>
                                        <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                                            {auth?.user?.email}
                                        </p>
                                    </div>
                                )}
                            </div>
                            {!collapsed && (
                                <button
                                    onClick={handleLogout}
                                    title="Sign Out"
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition"
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
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
                    />
                )}

                {/* Mobile Off-Canvas Sidebar */}
                <aside
                    className={`fixed inset-y-0 left-0 w-72 bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 z-50 transform transition-transform duration-300 lg:hidden flex flex-col ${
                        mobileOpen ? 'translate-x-0' : '-translate-x-full'
                    }`}
                >
                    <div className="h-16 border-b border-slate-200 dark:border-slate-800 px-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white">
                                <Building2 className="w-5 h-5" />
                            </div>
                            <div>
                                <h1 className="text-sm font-bold text-slate-900 dark:text-white">
                                    {auth?.tenant?.name ?? 'EMS Enterprise'}
                                </h1>
                                <span className="text-[10px] text-indigo-600 dark:text-indigo-400">
                                    {auth?.user?.roles?.[0] ?? 'Company Admin'}
                                </span>
                            </div>
                        </div>
                        <button onClick={() => setMobileOpen(false)} className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <nav className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                        <Link href="/dashboard" className={navItemClass('/dashboard')} onClick={() => setMobileOpen(false)}>
                            <LayoutDashboard className="w-4 h-4" />
                            <span>Executive Dashboard</span>
                        </Link>
                        <Link href="/employees" className={navItemClass('/employees')} onClick={() => setMobileOpen(false)}>
                            <Users className="w-4 h-4" />
                            <span>Employees Master</span>
                        </Link>
                        <Link href="/departments" className={navItemClass('/departments')} onClick={() => setMobileOpen(false)}>
                            <FolderTree className="w-4 h-4" />
                            <span>Departments & HODs</span>
                        </Link>
                        <Link href="/company/profile" className={navItemClass('/company/profile')} onClick={() => setMobileOpen(false)}>
                            <Building2 className="w-4 h-4" />
                            <span>Company Profile</span>
                        </Link>
                        <Link href="/users" className={navItemClass('/users')} onClick={() => setMobileOpen(false)}>
                            <UserCheck className="w-4 h-4" />
                            <span>User Accounts</span>
                        </Link>
                        <Link href="/access-control" className={navItemClass('/access-control')} onClick={() => setMobileOpen(false)}>
                            <ShieldCheck className="w-4 h-4" />
                            <span>Roles & Permissions</span>
                        </Link>

                        {auth?.tenant?.is_ams_enabled && (
                            <>
                                <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                                    <p className="px-3 text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">
                                        Time & Attendance
                                    </p>
                                    <Link href="/shifts" className={navItemClass('/shifts')} onClick={() => setMobileOpen(false)}>
                                        <Clock className="w-4 h-4" />
                                        <span>Shift Master</span>
                                    </Link>
                                    <Link href="/roster/patterns" className={navItemClass('/roster/patterns')} onClick={() => setMobileOpen(false)}>
                                        <Sparkles className="w-4 h-4" />
                                        <span>Shift Groups & Patterns</span>
                                    </Link>
                                    <Link href="/roster" className={navItemClass('/roster')} onClick={() => setMobileOpen(false)}>
                                        <CalendarRange className="w-4 h-4" />
                                        <span>Duty Roster</span>
                                    </Link>
                                    <Link href="/roster/shift-swaps" className={navItemClass('/roster/shift-swaps')} onClick={() => setMobileOpen(false)}>
                                        <ArrowLeftRight className="w-4 h-4" />
                                        <span>Shift Swap Requests</span>
                                    </Link>
                                    <Link href="/attendance/daily" className={navItemClass('/attendance/daily')} onClick={() => setMobileOpen(false)}>
                                        <CalendarCheck className="w-4 h-4" />
                                        <span>Daily Attendance</span>
                                    </Link>
                                    <Link href="/attendance/import" className={navItemClass('/attendance/import')} onClick={() => setMobileOpen(false)}>
                                        <FileSpreadsheet className="w-4 h-4" />
                                        <span>Biometric Import</span>
                                    </Link>
                                    <Link href="/work-calendar" className={navItemClass('/work-calendar')} onClick={() => setMobileOpen(false)}>
                                        <CalendarDays className="w-4 h-4" />
                                        <span>Work Calendar</span>
                                    </Link>
                                </div>
                            </>
                        )}

                        <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                            <p className="px-3 text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">
                                Leave & Payroll
                            </p>
                            <Link href="/leave/requests" className={navItemClass('/leave/requests')} onClick={() => setMobileOpen(false)}>
                                <Palmtree className="w-4 h-4" />
                                <span>Leave & Entitlements</span>
                            </Link>
                            {auth?.tenant?.is_payroll_enabled && (
                                <Link href="/payroll" className={navItemClass('/payroll')} onClick={() => setMobileOpen(false)}>
                                    <DollarSign className="w-4 h-4" />
                                    <span>Payroll Runs</span>
                                </Link>
                            )}
                            <Link href="/reports/custom" className={navItemClass('/reports/custom')} onClick={() => setMobileOpen(false)}>
                                <FileText className="w-4 h-4" />
                                <span>Custom HR Builder</span>
                            </Link>
                        </div>

                        {canAccessSettings && (
                            <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                                <p className="px-3 text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">
                                    Settings
                                </p>
                                <Link href="/settings/biometric" className={navItemClass('/settings/biometric')} onClick={() => setMobileOpen(false)}>
                                    <Cpu className="w-4 h-4" />
                                    <span>Biometric Config</span>
                                </Link>
                            </div>
                        )}

                        {auth?.user?.is_super_admin && (
                            <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                                <Link href="/admin/dashboard" className="flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-500/20" onClick={() => setMobileOpen(false)}>
                                    <ShieldAlert className="w-4 h-4" />
                                    <span>Super Admin Panel</span>
                                </Link>
                            </div>
                        )}
                    </nav>

                    <div className="p-4 border-t border-slate-200 dark:border-slate-800">
                        <button
                            onClick={handleLogout}
                            className="w-full py-2.5 px-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/40 text-red-600 dark:text-red-300 text-xs font-semibold flex items-center justify-center gap-2"
                        >
                            <LogOut className="w-4 h-4" />
                            Sign Out
                        </button>
                    </div>
                </aside>

                {/* Main Content Area */}
                <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
                    {/* Top Navigation Bar */}
                    <header className="h-16 border-b border-slate-200 dark:border-slate-800/80 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md sticky top-0 z-20 px-4 lg:px-8 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setMobileOpen(true)}
                                className="lg:hidden p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-900 transition"
                                title="Open navigation menu"
                            >
                                <Menu className="w-5 h-5" />
                            </button>

                            {shouldShowBack && (
                                <button
                                    onClick={handleBack}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white text-xs font-semibold transition shadow-sm active:scale-95 group"
                                    title="Go back to previous page"
                                >
                                    <ArrowLeft className="w-4 h-4 text-indigo-600 dark:text-indigo-400 group-hover:-translate-x-0.5 transition-transform" />
                                    <span>Back</span>
                                </button>
                            )}

                            {title && (
                                <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-800/80">
                                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 tracking-tight">
                                        {title}
                                    </span>
                                </div>
                            )}

                            <div className="hidden md:flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
                                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                                    {auth?.tenant?.name ?? (auth?.user?.is_super_admin ? 'Super Admin System' : 'EMS Enterprise')}
                                </span>
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/20">
                                    {auth?.tenant?.slug ?? 'system'}
                                </span>
                            </div>
                        </div>

                        {/* Top Bar Right: Theme Toggle & Profile Dropdown */}
                        <div className="flex items-center gap-3">
                            <ThemeToggle />

                            <div className="relative">
                                <button
                                    onClick={() => setProfileOpen(!profileOpen)}
                                    className="flex items-center gap-3 p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-900 border border-transparent hover:border-slate-200 dark:hover:border-slate-800 transition"
                                >
                                    <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-600/20 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/30 flex items-center justify-center font-bold text-xs">
                                        {auth?.user?.name ? auth.user.name.charAt(0).toUpperCase() : 'U'}
                                    </div>
                                    <div className="hidden sm:block text-left">
                                        <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">{auth?.user?.name}</p>
                                        <p className="text-[10px] text-slate-500 dark:text-slate-400">{auth?.user?.roles?.[0] ?? (auth?.user?.is_super_admin ? 'Super Admin' : 'Staff')}</p>
                                    </div>
                                </button>

                                {profileOpen && (
                                    <div
                                        onMouseLeave={() => setProfileOpen(false)}
                                        className="absolute right-0 mt-2 w-56 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl py-2 z-50 text-xs"
                                    >
                                        <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800">
                                            <p className="font-semibold text-slate-900 dark:text-white">{auth?.user?.name}</p>
                                            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{auth?.user?.email}</p>
                                            <div className="mt-1.5">
                                                <span className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30">
                                                    {auth?.user?.roles?.[0] ?? (auth?.user?.is_super_admin ? 'Super Admin' : 'Staff')}
                                                </span>
                                            </div>
                                        </div>

                                        {auth?.user?.is_super_admin && (
                                            <Link
                                                href="/admin/dashboard"
                                                className="w-full text-left px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-amber-600 dark:text-amber-300 flex items-center gap-2"
                                                onClick={() => setProfileOpen(false)}
                                            >
                                                <ShieldAlert className="w-3.5 h-3.5" />
                                                Super Admin Panel
                                            </Link>
                                        )}

                                        <button
                                            onClick={handleLogout}
                                            className="w-full text-left px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-red-600 dark:text-red-400 flex items-center gap-2"
                                        >
                                            <LogOut className="w-3.5 h-3.5" />
                                            Sign Out
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </header>

                    {/* Global Flash Alerts */}
                    <div className="px-4 lg:px-8 pt-4">
                        {flash?.success && (
                            <div className="mb-4 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2.5 shadow-sm">
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                                <span>{flash.success}</span>
                            </div>
                        )}
                        {flash?.error && (
                            <div className="mb-4 p-4 rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800/60 text-red-800 dark:text-red-300 text-xs flex items-center gap-2.5 shadow-sm">
                                <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0" />
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
