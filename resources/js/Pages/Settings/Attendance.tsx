import React, { useState } from 'react';
import { Head, useForm, Link } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import {
    SlidersHorizontal,
    Clock,
    Shield,
    CheckCircle2,
    AlertCircle,
    Info,
    Sparkles,
    ArrowRight,
    Save,
    RotateCcw,
    Layers,
    ToggleLeft,
    ToggleRight,
    ShieldAlert,
    Cpu,
    CalendarCheck,
} from 'lucide-react';

interface AttendanceSettingsData {
    ignore_terminal_punch_type: boolean;
    anti_passback_minutes: number;
    auto_detect_shift: boolean;
    allow_early_in_as_ot: boolean;
    overtime_minimum_minutes: number;
}

interface Props {
    settings: AttendanceSettingsData;
    canManage?: boolean;
}

export default function AttendanceSettings({
    settings: initialSettings,
    canManage = false,
}: Props) {
    const [savedSuccess, setSavedSuccess] = useState(false);

    const form = useForm<AttendanceSettingsData>({
        ignore_terminal_punch_type: initialSettings.ignore_terminal_punch_type ?? true,
        anti_passback_minutes: initialSettings.anti_passback_minutes ?? 3,
        auto_detect_shift: initialSettings.auto_detect_shift ?? true,
        allow_early_in_as_ot: initialSettings.allow_early_in_as_ot ?? false,
        overtime_minimum_minutes: initialSettings.overtime_minimum_minutes ?? 15,
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!canManage) return;

        form.post('/settings/attendance', {
            preserveScroll: true,
            onSuccess: () => {
                setSavedSuccess(true);
                setTimeout(() => setSavedSuccess(false), 4000);
            },
        });
    };

    const handleResetDefaults = () => {
        form.setData({
            ignore_terminal_punch_type: true,
            anti_passback_minutes: 3,
            auto_detect_shift: true,
            allow_early_in_as_ot: false,
            overtime_minimum_minutes: 15,
        });
    };

    return (
        <AuthenticatedLayout title="Attendance Settings" backUrl="/attendance/daily">
            <Head title="Attendance Settings — EMS" />

            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
                {/* Header & Breadcrumb */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
                    <div>
                        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-1">
                            <Link href="/dashboard" className="hover:text-indigo-600 transition">Dashboard</Link>
                            <span>/</span>
                            <span>Settings</span>
                            <span>/</span>
                            <span className="text-slate-800 dark:text-slate-200 font-medium">Attendance Settings</span>
                        </div>
                        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
                            <span className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                                <SlidersHorizontal className="w-6 h-6" />
                            </span>
                            Attendance Calculation & Telemetry Settings
                        </h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-3xl">
                            Configure global punch pairing algorithms, anti-passback debouncing, device telemetry policies, and overtime eligibility thresholds across your company.
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <Link
                            href="/attendance/daily"
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition"
                        >
                            <CalendarCheck className="w-4 h-4" />
                            Daily Attendance
                        </Link>
                        <Link
                            href="/settings/biometric"
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition"
                        >
                            <Cpu className="w-4 h-4" />
                            Biometric Devices
                        </Link>
                    </div>
                </div>

                {/* Feedback Alerts */}
                {savedSuccess && (
                    <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                        <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-500" />
                        <div className="text-sm font-medium">
                            Global attendance settings saved successfully. All upcoming calculations will utilize these rules.
                        </div>
                    </div>
                )}

                {form.hasErrors && (
                    <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-500 mt-0.5" />
                        <div className="text-sm space-y-1">
                            <p className="font-semibold">Unable to save attendance settings:</p>
                            <ul className="list-disc list-inside text-xs space-y-0.5">
                                {Object.values(form.errors).map((err, idx) => (
                                    <li key={idx}>{err}</li>
                                ))}
                            </ul>
                        </div>
                    </div>
                )}

                {!canManage && (
                    <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 flex items-center gap-3">
                        <ShieldAlert className="w-5 h-5 flex-shrink-0 text-amber-500" />
                        <div className="text-sm">
                            <span className="font-semibold">View-Only Access:</span> You do not have permission (<code className="font-mono text-xs bg-amber-500/20 px-1 py-0.5 rounded">attendance.settings.manage</code>) to modify these settings. Contact an administrator to adjust company policies.
                        </div>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-8">
                    {/* Shift-Level Policy Information Banner */}
                    <div className="bg-gradient-to-r from-indigo-900/20 via-purple-900/10 to-transparent border border-indigo-500/20 rounded-2xl p-6 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2">
                                <span className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                                    <Layers className="w-4 h-4" />
                                </span>
                                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                                    Shift-Level Punch Modes & Break Policies
                                </h2>
                                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                    Shift Defined
                                </span>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-2xl">
                                Punch Pairing Modes (First-In/Last-Out vs Actual Punch Segments) and Break Policies (Auto-Deduct Lunch, Actual Biometric Swipes, or Paid Breaks) are configured individually per Shift to support mixed corporate, factory, and security operations.
                            </p>
                        </div>
                        <Link
                            href="/shifts"
                            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition whitespace-nowrap"
                        >
                            Configure Shifts
                            <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                    </div>

                    {/* Setting 2 & 3: Telemetry Direction & Anti-Passback */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Terminal Punch Type Ignore */}
                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4 flex flex-col justify-between">
                            <div>
                                <div className="flex items-center justify-between gap-3 mb-2">
                                    <div className="flex items-center gap-2">
                                        <span className="p-1.5 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                                            <Cpu className="w-4 h-4" />
                                        </span>
                                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                                            Direction-Agnostic Telemetry
                                        </h3>
                                    </div>
                                    <button
                                        type="button"
                                        disabled={!canManage}
                                        onClick={() => form.setData('ignore_terminal_punch_type', !form.data.ignore_terminal_punch_type)}
                                        className={`transition-colors focus:outline-none ${!canManage ? 'opacity-60 cursor-not-allowed' : ''}`}
                                    >
                                        {form.data.ignore_terminal_punch_type ? (
                                            <ToggleRight className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
                                        ) : (
                                            <ToggleLeft className="w-8 h-8 text-slate-400 dark:text-slate-600" />
                                        )}
                                    </button>
                                </div>

                                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                                    <strong className="text-slate-800 dark:text-slate-200">Ignore Terminal Keypad Buttons:</strong> When active (recommended), the engine ignores terminal keypad IN/OUT state and infers punch direction contextually using shift roster windows and chronological sequence.
                                </p>
                            </div>

                            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-400 flex items-start gap-2">
                                <Info className="w-4 h-4 text-sky-500 flex-shrink-0 mt-0.5" />
                                <span>
                                    Prevents massive calculation errors caused by employees pressing the wrong keypad button or leaving the hardware terminal on an incorrect status.
                                </span>
                            </div>
                        </div>

                        {/* Anti-Passback Window */}
                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4 flex flex-col justify-between">
                            <div>
                                <div className="flex items-center justify-between gap-3 mb-2">
                                    <div className="flex items-center gap-2">
                                        <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                            <Shield className="w-4 h-4" />
                                        </span>
                                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                                            Anti-Passback Debouncing Window
                                        </h3>
                                    </div>
                                    <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                                        {form.data.anti_passback_minutes} Minutes
                                    </span>
                                </div>

                                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-4">
                                    Compresses duplicate biometric swipes occurring within this time window into a single valid punch. De-duplicates nervous double-taps at turnstiles.
                                </p>

                                <div className="space-y-2">
                                    <input
                                        type="range"
                                        min="0"
                                        max="15"
                                        step="1"
                                        value={form.data.anti_passback_minutes}
                                        disabled={!canManage}
                                        onChange={(e) => form.setData('anti_passback_minutes', parseInt(e.target.value) || 0)}
                                        className="w-full accent-indigo-600 cursor-pointer"
                                    />
                                    <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                                        <span>0m (Disabled)</span>
                                        <span>3m (Standard)</span>
                                        <span>5m</span>
                                        <span>10m</span>
                                        <span>15m (Max)</span>
                                    </div>
                                </div>
                            </div>

                            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-400 flex items-start gap-2">
                                <Sparkles className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                                <span>
                                    Recommended: <strong>3 minutes</strong>. Setting to 0 records every swipe as an individual raw punch event.
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Setting 4 & 5: Shift Detection & Early Arrival OT */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Auto-Detect Shift */}
                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4 flex flex-col justify-between">
                            <div>
                                <div className="flex items-center justify-between gap-3 mb-2">
                                    <div className="flex items-center gap-2">
                                        <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                            <Sparkles className="w-4 h-4" />
                                        </span>
                                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                                            Auto-Detect Shift on Swap / Unscheduled
                                        </h3>
                                    </div>
                                    <button
                                        type="button"
                                        disabled={!canManage}
                                        onClick={() => form.setData('auto_detect_shift', !form.data.auto_detect_shift)}
                                        className={`transition-colors focus:outline-none ${!canManage ? 'opacity-60 cursor-not-allowed' : ''}`}
                                    >
                                        {form.data.auto_detect_shift ? (
                                            <ToggleRight className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
                                        ) : (
                                            <ToggleLeft className="w-8 h-8 text-slate-400 dark:text-slate-600" />
                                        )}
                                    </button>
                                </div>

                                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                                    If an employee works a different shift than scheduled (e.g. morning vs evening), the engine automatically detects the best matching company shift based on check-in arrival time rather than generating false absence or late flags.
                                </p>
                            </div>

                            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-400 flex items-start gap-2">
                                <Info className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                                <span>
                                    Eliminates HR manual intervention for operational shift swaps and unrostered emergency overtime coverages.
                                </span>
                            </div>
                        </div>

                        {/* Pre-Shift Early Arrival as OT */}
                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4 flex flex-col justify-between">
                            <div>
                                <div className="flex items-center justify-between gap-3 mb-2">
                                    <div className="flex items-center gap-2">
                                        <span className="p-1.5 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                                            <Clock className="w-4 h-4" />
                                        </span>
                                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                                            Allow Pre-Shift Early Arrival as OT
                                        </h3>
                                    </div>
                                    <button
                                        type="button"
                                        disabled={!canManage}
                                        onClick={() => form.setData('allow_early_in_as_ot', !form.data.allow_early_in_as_ot)}
                                        className={`transition-colors focus:outline-none ${!canManage ? 'opacity-60 cursor-not-allowed' : ''}`}
                                    >
                                        {form.data.allow_early_in_as_ot ? (
                                            <ToggleRight className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
                                        ) : (
                                            <ToggleLeft className="w-8 h-8 text-slate-400 dark:text-slate-600" />
                                        )}
                                    </button>
                                </div>

                                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                                    When disabled (statutory standard), employees arriving 30-45 minutes before shift start have their work hours clamped to shift start time. When enabled, early arrival minutes count toward total payable overtime.
                                </p>
                            </div>

                            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-400 flex items-start gap-2">
                                <ShieldAlert className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
                                <span>
                                    Standard Sri Lanka Shop & Office practice: <strong>Disabled</strong>. Only post-shift stay accumulates overtime unless specifically pre-authorized.
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Setting 6: Overtime Minimum Qualification Threshold */}
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div>
                                <div className="flex items-center gap-2">
                                    <h2 className="text-base font-bold text-slate-900 dark:text-white">
                                        Overtime Qualification Threshold
                                    </h2>
                                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold border border-slate-200 dark:border-slate-700">
                                        Unified Policy Sync
                                    </span>
                                </div>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
                                    The minimum additional minutes worked after scheduled shift end before overtime starts accumulating. Synchronized with the company default attendance calculation rule.
                                </p>
                            </div>

                            <div className="flex items-center gap-3">
                                <div className="relative">
                                    <input
                                        type="number"
                                        min="0"
                                        max="120"
                                        step="5"
                                        value={form.data.overtime_minimum_minutes}
                                        disabled={!canManage}
                                        onChange={(e) => form.setData('overtime_minimum_minutes', parseInt(e.target.value) || 0)}
                                        className="w-28 text-center text-sm font-bold font-mono py-2 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                                    />
                                    <span className="absolute right-3 top-2.5 text-xs text-slate-400">min</span>
                                </div>
                            </div>
                        </div>

                        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-400 flex items-start gap-2">
                            <Info className="w-4 h-4 text-indigo-500 flex-shrink-0 mt-0.5" />
                            <span>
                                If set to 15 minutes, an employee working 14 minutes past shift end receives 0h OT. If they work 16 minutes, overtime is granted and calculated according to standard statutory OT rules.
                            </span>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    {canManage && (
                        <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800">
                            <button
                                type="button"
                                onClick={handleResetDefaults}
                                disabled={form.processing}
                                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                            >
                                <RotateCcw className="w-4 h-4" />
                                Reset to Enterprise Defaults
                            </button>

                            <button
                                type="submit"
                                disabled={form.processing || !form.isDirty}
                                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-600/20 disabled:opacity-50 disabled:cursor-not-allowed transition"
                            >
                                <Save className="w-4 h-4" />
                                {form.processing ? 'Saving Settings...' : 'Save Attendance Settings'}
                            </button>
                        </div>
                    )}
                </form>
            </div>
        </AuthenticatedLayout>
    );
}
