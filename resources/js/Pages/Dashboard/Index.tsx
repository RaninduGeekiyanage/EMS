import React from 'react';
import { Head, Link, usePage } from '@inertiajs/react';
import AuthenticatedLayout from '../../Layouts/AuthenticatedLayout';
import {
    Users,
    UserPlus,
    Building2,
    CalendarCheck,
    Clock,
    Palmtree,
    DollarSign,
    FileSpreadsheet,
    CalendarDays,
    ArrowRight,
    AlertCircle,
    CheckCircle2,
    ShieldCheck,
    Sparkles,
} from 'lucide-react';

interface MetricData {
    master: {
        total_employees: number;
        active_employees: number;
        departments_count: number;
        branches_count: number;
        company_name: string;
        epf_enabled: boolean;
    };
    ams: {
        present_count: number;
        late_count: number;
        absent_count: number;
        on_leave_count: number;
        pending_leaves_count: number;
        recent_pending_leaves: Array<{
            id: string;
            employee_name: string;
            emp_no: string;
            leave_type: string;
            start_date: string;
            end_date: string;
            total_days: number;
        }>;
        upcoming_holidays: Array<{
            id: string;
            name: string;
            holiday_date: string;
            holiday_type: string;
        }>;
    } | null;
    payroll: {
        current_period: string;
        is_ready: boolean;
        statutory_compliant: boolean;
    } | null;
}

interface Props {
    metrics: MetricData;
}

export default function DashboardIndex({ metrics }: Props) {
    const { auth } = usePage<{ auth: any }>().props;
    const { master, ams, payroll } = metrics;

    const todayDate = new Intl.DateTimeFormat('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    }).format(new Date());

    return (
        <AuthenticatedLayout title="Dashboard">
            <div className="space-y-8">
                {/* Greeting & Header Banner */}
                <div className="p-6 md:p-8 rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800/90 relative overflow-hidden shadow-2xl">
                    <div className="absolute -right-16 -top-16 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
                        <div>
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold mb-3">
                                <Sparkles className="w-3.5 h-3.5" />
                                <span>{master.company_name} Workspace</span>
                            </div>
                            <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
                                Welcome back, {auth?.user?.name?.split(' ')[0] ?? 'Admin'}!
                            </h1>
                            <p className="text-xs text-slate-400 mt-1">
                                Today is {todayDate} &bull; All organization systems operational
                            </p>
                        </div>

                        {/* Quick Actions */}
                        <div className="flex flex-wrap items-center gap-3">
                            <Link
                                href="/employees/create"
                                className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-indigo-600/30 transition"
                            >
                                <UserPlus className="w-4 h-4" />
                                Add Employee
                            </Link>

                            {ams && (
                                <Link
                                    href="/attendance/import"
                                    className="px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 hover:border-slate-600 text-slate-200 text-xs font-semibold flex items-center gap-2 transition"
                                >
                                    <FileSpreadsheet className="w-4 h-4 text-sky-400" />
                                    Import Attendance
                                </Link>
                            )}
                        </div>
                    </div>
                </div>

                {/* Primary Metrics Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                    {/* Headcount Card */}
                    <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800/80 space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-slate-400 font-medium">Total Staff</span>
                            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                                <Users className="w-4 h-4" />
                            </div>
                        </div>
                        <h3 className="text-3xl font-extrabold text-white">{master.total_employees}</h3>
                        <p className="text-xs text-emerald-400 flex items-center gap-1.5 font-medium">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
                            {master.active_employees} active headcount
                        </p>
                    </div>

                    {/* Departments & Hierarchy */}
                    <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800/80 space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-slate-400 font-medium">Departments & Branches</span>
                            <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
                                <Building2 className="w-4 h-4" />
                            </div>
                        </div>
                        <h3 className="text-3xl font-extrabold text-white">{master.departments_count}</h3>
                        <p className="text-xs text-slate-400 font-medium">
                            Across {master.branches_count} operational branch locations
                        </p>
                    </div>

                    {/* Attendance Today (AMS) */}
                    {ams ? (
                        <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800/80 space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-slate-400 font-medium">Present Today</span>
                                <div className="w-8 h-8 rounded-xl bg-sky-500/10 text-sky-400 flex items-center justify-center">
                                    <CalendarCheck className="w-4 h-4" />
                                </div>
                            </div>
                            <h3 className="text-3xl font-extrabold text-sky-400">{ams.present_count}</h3>
                            <div className="flex items-center gap-3 text-[11px] text-slate-400">
                                <span>Late: <strong className="text-amber-400">{ams.late_count}</strong></span>
                                <span>Absent: <strong className="text-red-400">{ams.absent_count}</strong></span>
                                <span>Leave: <strong className="text-indigo-400">{ams.on_leave_count}</strong></span>
                            </div>
                        </div>
                    ) : (
                        <div className="p-6 rounded-3xl bg-slate-900/40 border border-slate-800/60 space-y-2 opacity-60">
                            <span className="text-xs text-slate-500 font-medium">Attendance System</span>
                            <h3 className="text-xl font-bold text-slate-400">AMS Disabled</h3>
                            <p className="text-xs text-slate-500">Enable in Super Admin settings</p>
                        </div>
                    )}

                    {/* Pending Leave Requests */}
                    {ams ? (
                        <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800/80 space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-slate-400 font-medium">Pending Leaves</span>
                                <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
                                    <Palmtree className="w-4 h-4" />
                                </div>
                            </div>
                            <h3 className="text-3xl font-extrabold text-amber-400">{ams.pending_leaves_count}</h3>
                            <p className="text-xs text-slate-400">
                                <Link href="/leave/requests" className="text-indigo-400 hover:text-indigo-300 font-semibold underline">
                                    Review approvals →
                                </Link>
                            </p>
                        </div>
                    ) : (
                        <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800/80 space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-slate-400 font-medium">Payroll Engine</span>
                                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                                    <DollarSign className="w-4 h-4" />
                                </div>
                            </div>
                            <h3 className="text-2xl font-bold text-emerald-400">{payroll?.current_period ?? 'Upcoming'}</h3>
                            <p className="text-xs text-slate-400">Statutory APIT & EPF/ETF Compliant</p>
                        </div>
                    )}
                </div>

                {/* Main Dashboard Grid: Pending Approvals & Upcoming Holidays */}
                {ams && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Pending Leave Approvals Widget */}
                        <div className="lg:col-span-2 p-6 rounded-3xl bg-slate-900/60 border border-slate-800/80 space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-base font-bold text-white tracking-tight">Recent Leave Requests</h2>
                                    <p className="text-xs text-slate-400">Awaiting management approval</p>
                                </div>
                                <Link
                                    href="/leave/requests"
                                    className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1"
                                >
                                    <span>View All</span>
                                    <ArrowRight className="w-3.5 h-3.5" />
                                </Link>
                            </div>

                            <div className="overflow-x-auto rounded-2xl border border-slate-800/80">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-slate-950 text-slate-400 uppercase text-[10px]">
                                        <tr>
                                            <th className="px-4 py-3 font-semibold">Employee</th>
                                            <th className="px-4 py-3 font-semibold">Type</th>
                                            <th className="px-4 py-3 font-semibold">Dates</th>
                                            <th className="px-4 py-3 font-semibold text-center">Days</th>
                                            <th className="px-4 py-3 font-semibold text-right">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800/60 bg-slate-900/30">
                                        {ams.recent_pending_leaves.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                                                    No pending leave requests at this time.
                                                </td>
                                            </tr>
                                        ) : (
                                            ams.recent_pending_leaves.map((item) => (
                                                <tr key={item.id} className="hover:bg-slate-800/30 transition">
                                                    <td className="px-4 py-3">
                                                        <p className="font-semibold text-white">{item.employee_name}</p>
                                                        <p className="text-[10px] text-slate-400 font-mono">{item.emp_no}</p>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-300">
                                                            {item.leave_type}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-slate-300">
                                                        {item.start_date} → {item.end_date}
                                                    </td>
                                                    <td className="px-4 py-3 text-center font-bold text-white">
                                                        {item.total_days}
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        <Link
                                                            href="/leave/requests"
                                                            className="px-2.5 py-1 rounded-lg bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600/30 font-semibold text-[11px] border border-indigo-500/30 transition"
                                                        >
                                                            Review
                                                        </Link>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Public Holidays Widget */}
                        <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800/80 space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-base font-bold text-white tracking-tight">Sri Lankan Holidays</h2>
                                    <p className="text-xs text-slate-400">Upcoming calendar events</p>
                                </div>
                                <Link
                                    href="/work-calendar"
                                    className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold"
                                >
                                    Calendar →
                                </Link>
                            </div>

                            <div className="space-y-3">
                                {ams.upcoming_holidays.length === 0 ? (
                                    <p className="text-xs text-slate-500 italic py-4 text-center">
                                        No upcoming holidays registered.
                                    </p>
                                ) : (
                                    ams.upcoming_holidays.map((h) => (
                                        <div
                                            key={h.id}
                                            className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 flex items-center justify-between"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-xl bg-sky-500/10 text-sky-400 flex items-center justify-center font-bold text-xs">
                                                    <CalendarDays className="w-4 h-4" />
                                                </div>
                                                <div>
                                                    <p className="text-xs font-semibold text-white">{h.name}</p>
                                                    <p className="text-[10px] text-slate-400">{h.holiday_date}</p>
                                                </div>
                                            </div>
                                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-medium">
                                                {h.holiday_type}
                                            </span>
                                        </div>
                                    ))
                                )}
                            </div>

                            {/* Compliance Box */}
                            <div className="mt-4 p-4 rounded-2xl bg-emerald-950/30 border border-emerald-800/40 text-xs text-emerald-300 flex items-center gap-3">
                                <ShieldCheck className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                                <div>
                                    <p className="font-semibold text-emerald-200">Statutory Compliant</p>
                                    <p className="text-[11px] text-emerald-400/80">
                                        Shop & Office Act &bull; EPF/ETF Enforced
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </AuthenticatedLayout>
    );
}
