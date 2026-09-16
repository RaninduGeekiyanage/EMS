import React from 'react';
import { Head } from '@inertiajs/react';
import { ShieldCheck, Users, Clock, Landmark, Sparkles, Building2, CheckCircle2 } from 'lucide-react';

interface Props {
    title?: string;
}

export default function Welcome({ title = 'EMS — Employee Management System' }: Props) {
    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-indigo-500 selection:text-white">
            <Head title="Welcome" />

            {/* Header / Navbar */}
            <header className="border-b border-slate-800/80 backdrop-blur-md bg-slate-950/60 sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-sky-400 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                            <Building2 className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                                EMS
                            </span>
                            <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                                Sri Lanka
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <a
                            href="/login"
                            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-indigo-600/30 transition"
                        >
                            <span>Sign In</span>
                            <span aria-hidden="true">&rarr;</span>
                        </a>
                    </div>
                </div>
            </header>

            {/* Hero Section */}
            <main className="flex-1 max-w-7xl mx-auto px-6 py-20 flex flex-col justify-center items-center text-center">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-slate-400 text-xs font-medium mb-8">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Multi-Tenant SaaS Attendance & Payroll Platform</span>
                </div>

                <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight max-w-4xl text-balance bg-gradient-to-b from-white via-slate-100 to-slate-400 bg-clip-text text-transparent leading-[1.15]">
                    Engineered for Sri Lankan Labor Law & Enterprise Workflows
                </h1>

                <p className="mt-6 text-base md:text-lg text-slate-400 max-w-2xl text-balance leading-relaxed">
                    Compliant with Shop & Office Act, Wages Board Ordinance, EPF/ETF Acts, and APIT Income Tax.
                    Featuring ULID keys, repository pattern, and strict tenant isolation.
                </p>

                {/* Feature Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-16 w-full text-left">
                    <a
                        href="/company/profile?tenant=ceylon-tea"
                        className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 hover:border-indigo-500/60 hover:bg-slate-900/90 transition duration-300 group block"
                    >
                        <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-4 border border-indigo-500/20 group-hover:scale-105 transition">
                            <Users className="w-5 h-5" />
                        </div>
                        <h3 className="font-semibold text-slate-200 mb-1 group-hover:text-indigo-300 transition">
                            M01: Master Module →
                        </h3>
                        <p className="text-xs text-slate-400 leading-relaxed">
                            Multi-tenant organization tree, branches, departments, designations & employee profiles.
                        </p>
                    </a>

                    <a
                        href="/shifts?tenant=ceylon-tea"
                        className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 hover:border-sky-500/60 hover:bg-slate-900/90 transition duration-300 group block"
                    >
                        <div className="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-400 flex items-center justify-center mb-4 border border-sky-500/20 group-hover:scale-105 transition">
                            <Clock className="w-5 h-5" />
                        </div>
                        <h3 className="font-semibold text-slate-200 mb-1 group-hover:text-sky-300 transition">
                            M02: AMS Attendance →
                        </h3>
                        <p className="text-xs text-slate-400 leading-relaxed">
                            Biometric machine integration, shift rosters, overtime rules & leave management.
                        </p>
                    </a>

                    <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 opacity-70">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-4 border border-emerald-500/20">
                            <Landmark className="w-5 h-5" />
                        </div>
                        <h3 className="font-semibold text-slate-200 mb-1">M03: Payroll Engine</h3>
                        <p className="text-xs text-slate-400 leading-relaxed">
                            Monthly/daily/hourly pay modes, EPF/ETF calculation, APIT tax bands & bank export files.
                        </p>
                    </div>

                    <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 opacity-70">
                        <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center mb-4 border border-purple-500/20">
                            <ShieldCheck className="w-5 h-5" />
                        </div>
                        <h3 className="font-semibold text-slate-200 mb-1">Strict Tenancy & RBAC</h3>
                        <p className="text-xs text-slate-400 leading-relaxed">
                            Tenant-scoped Global Scope, Spatie Teams permissions, and encrypted personal data.
                        </p>
                    </div>
                </div>
            </main>

            {/* Footer */}
            <footer className="border-t border-slate-800/80 py-6 text-center text-xs text-slate-500">
                EMS &copy; {new Date().getFullYear()} &bull; Built with Laravel 11, Inertia.js, React 18 & TypeScript
            </footer>
        </div>
    );
}
