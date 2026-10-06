import React, { useState } from 'react';
import { Head, Link, useForm } from '@inertiajs/react';
import { UserCheck, Lock, Eye, EyeOff, ArrowRight, ShieldCheck, CheckCircle2, AlertCircle, Sparkles, Building2 } from 'lucide-react';

interface Props {
    status?: string;
}

export default function EmployeeLogin({ status }: Props) {
    const [showPassword, setShowPassword] = useState(false);

    const { data, setData, post, processing, errors } = useForm({
        login: '',
        password: '',
        remember: true,
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        post('/login');
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center px-4 selection:bg-indigo-500 selection:text-white relative overflow-hidden">
            <Head title="Employee Self-Service (ESS) — Sign In" />

            {/* Ambient Background Lighting */}
            <div className="absolute top-1/4 -left-32 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-teal-500/15 rounded-full blur-3xl pointer-events-none" />

            <div className="w-full max-w-md z-10">
                {/* Brand Header */}
                <div className="text-center mb-6">
                    <div className="inline-flex w-16 h-16 rounded-3xl bg-gradient-to-tr from-teal-500 via-indigo-600 to-indigo-700 items-center justify-center shadow-xl shadow-indigo-600/30 mb-4 border border-indigo-400/20">
                        <UserCheck className="w-8 h-8 text-white" />
                    </div>
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold mb-2">
                        <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Employee Self-Service (ESS)</span>
                    </div>
                    <h1 className="text-2xl font-bold tracking-tight text-white">Staff Portal Sign In</h1>
                    <p className="text-xs text-slate-400 mt-1">
                        Access your Duty Roster, Attendance, Leaves & Salary Payslips
                    </p>
                </div>

                {/* Status Alert */}
                {status && (
                    <div className="mb-5 p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-800/60 text-emerald-300 text-xs flex items-center gap-2 shadow-lg">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                        <span>{status}</span>
                    </div>
                )}

                {/* Login Card */}
                <div className="p-8 rounded-3xl bg-slate-900/85 border border-slate-800/90 shadow-2xl backdrop-blur-xl">
                    <form onSubmit={handleSubmit} className="space-y-5">
                        {/* Identifier Field */}
                        <div>
                            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
                                <span>Employee ID / Phone / Email</span>
                                <span className="text-[10px] text-teal-400 font-mono">e.g. EMP1001</span>
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                                    <UserCheck className="w-4 h-4" />
                                </div>
                                <input
                                    type="text"
                                    required
                                    autoFocus
                                    value={data.login}
                                    onChange={(e) => setData('login', e.target.value)}
                                    placeholder="Enter EMP ID or Registered Mobile"
                                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950/70 border border-slate-800 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 text-slate-100 text-sm placeholder:text-slate-600 transition tracking-wide"
                                />
                            </div>
                            {errors.login && (
                                <p className="mt-1.5 text-xs text-rose-400 font-medium">
                                    {errors.login}
                                </p>
                            )}
                            {errors.email && !errors.login && (
                                <p className="mt-1.5 text-xs text-rose-400 font-medium">
                                    {errors.email}
                                </p>
                            )}
                        </div>

                        {/* Password Field */}
                        <div>
                            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
                                <span>Password</span>
                                <span className="text-[10px] text-slate-500">Default: 123456</span>
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                                    <Lock className="w-4 h-4" />
                                </div>
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    required
                                    value={data.password}
                                    onChange={(e) => setData('password', e.target.value)}
                                    placeholder="••••••••"
                                    className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-slate-950/70 border border-slate-800 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 text-slate-100 text-sm placeholder:text-slate-600 transition"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300 transition"
                                >
                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                            {errors.password && (
                                <p className="mt-1.5 text-xs text-rose-400 font-medium">
                                    {errors.password}
                                </p>
                            )}
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={processing}
                            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-teal-500 via-indigo-600 to-indigo-700 hover:from-teal-400 hover:to-indigo-600 text-white font-semibold text-sm shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition duration-200 disabled:opacity-50"
                        >
                            {processing ? (
                                <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                                <>
                                    <span>Sign In to Self-Service</span>
                                    <ArrowRight className="w-4 h-4" />
                                </>
                            )}
                        </button>
                    </form>

                    {/* Helper Footer */}
                    <div className="mt-6 pt-5 border-t border-slate-800/80 text-center space-y-3">
                        <p className="text-xs text-slate-500">
                            Forgot your password or don't have login credentials? Please contact your <span className="text-slate-400 font-medium">HR Department</span>.
                        </p>
                        <div className="pt-2">
                            <Link
                                href="/login"
                                className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-indigo-400 transition"
                            >
                                <Building2 className="w-3.5 h-3.5" />
                                <span>Switch to Management & HR Login</span>
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
