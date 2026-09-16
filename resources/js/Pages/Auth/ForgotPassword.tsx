import React from 'react';
import { Head, Link, useForm } from '@inertiajs/react';
import { Building2, Mail, ArrowLeft, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';

interface Props {
    status?: string;
}

export default function ForgotPassword({ status }: Props) {
    const { data, setData, post, processing, errors } = useForm({
        email: '',
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        post('/forgot-password');
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center px-4 selection:bg-indigo-500 selection:text-white relative overflow-hidden">
            <Head title="Forgot Password — EMS" />

            {/* Ambient Background Glow */}
            <div className="absolute top-1/4 -left-32 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="w-full max-w-md z-10">
                {/* Brand Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-sky-400 items-center justify-center shadow-xl shadow-indigo-600/20 mb-4">
                        <Building2 className="w-7 h-7 text-white" />
                    </div>
                    <h1 className="text-2xl font-bold tracking-tight text-white">Reset Your Password</h1>
                    <p className="text-xs text-slate-400 mt-1.5 max-w-xs mx-auto">
                        Enter your registered email address and we'll send you a password reset link.
                    </p>
                </div>

                {/* Status Alert */}
                {status && (
                    <div className="mb-5 p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-800/60 text-emerald-300 text-xs flex items-center gap-2 shadow-lg">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                        <span>{status}</span>
                    </div>
                )}

                {/* Card */}
                <div className="p-8 rounded-3xl bg-slate-900/80 border border-slate-800/90 shadow-2xl backdrop-blur-xl">
                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                                Registered Email Address
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                                    <Mail className="w-4 h-4" />
                                </div>
                                <input
                                    type="email"
                                    required
                                    autoFocus
                                    value={data.email}
                                    onChange={(e) => setData('email', e.target.value)}
                                    placeholder="name@company.com"
                                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950/70 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-slate-100 text-sm placeholder:text-slate-600 transition"
                                />
                            </div>
                            {errors.email && (
                                <p className="mt-1.5 text-xs text-red-400 flex items-center gap-1">
                                    <AlertCircle className="w-3.5 h-3.5" />
                                    {errors.email}
                                </p>
                            )}
                        </div>

                        <button
                            type="submit"
                            disabled={processing}
                            className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 transition duration-200"
                        >
                            {processing ? (
                                <span>Sending link...</span>
                            ) : (
                                <>
                                    <span>Send Reset Link</span>
                                    <ArrowRight className="w-4 h-4" />
                                </>
                            )}
                        </button>
                    </form>

                    <div className="mt-6 pt-5 border-t border-slate-800/80 text-center">
                        <Link
                            href="/login"
                            className="text-xs text-slate-400 hover:text-indigo-400 flex items-center justify-center gap-1.5 transition"
                        >
                            <ArrowLeft className="w-3.5 h-3.5" />
                            Return to Sign In
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
