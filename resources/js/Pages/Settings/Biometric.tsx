import React, { useState } from 'react';
import { Head, router, Link } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import {
    Cpu,
    CheckCircle2,
    Plus,
    Edit2,
    Trash2,
    Check,
    Download,
    HardDrive,
    Sparkles,
    Settings,
    FileSpreadsheet,
    Clock,
    ArrowRight,
    Loader2,
    AlertCircle,
    Info,
} from 'lucide-react';
import BiometricProfileModal, { BiometricDeviceProfile } from '@/Components/BiometricProfileModal';

interface AdapterOption {
    key: string;
    name: string;
    description: string;
    extension: string;
    badge: string;
}

interface ActiveConfig {
    adapter_type: string;
    profile_id: string | null;
}

interface Props {
    profiles: BiometricDeviceProfile[];
    adapters: AdapterOption[];
    activeConfig: ActiveConfig;
    canManage?: boolean;
}

export default function Biometric({
    profiles: initialProfiles = [],
    adapters = [],
    activeConfig: initialActiveConfig,
    canManage = false,
}: Props) {
    const [profilesList, setProfilesList] = useState<BiometricDeviceProfile[]>(initialProfiles);
    const [activeConfig, setActiveConfig] = useState<ActiveConfig>(initialActiveConfig);
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
    const [editingProfile, setEditingProfile] = useState<BiometricDeviceProfile | null>(null);
    const [isSettingDefault, setIsSettingDefault] = useState<string | null>(null);
    const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const getCsrfToken = () => {
        const meta = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
        if (meta) return meta;
        const match = document.cookie.match(/XSRF-TOKEN=([^;]+)/);
        return match ? decodeURIComponent(match[1]) : '';
    };

    const handleProfileSaved = (saved: BiometricDeviceProfile) => {
        setProfilesList((prev) => {
            const exists = prev.some((p) => p.id === saved.id);
            if (exists) {
                return prev.map((p) => (p.id === saved.id ? saved : p));
            }
            return [saved, ...prev];
        });

        // If it was marked as default, update activeConfig
        if (saved.is_default) {
            setActiveConfig({
                adapter_type: 'configurable',
                profile_id: saved.id,
            });
        }
        setFeedbackMessage({
            type: 'success',
            text: `Biometric profile "${saved.name}" saved successfully.`,
        });
        setTimeout(() => setFeedbackMessage(null), 5000);
    };

    const handleDeleteProfile = async (profileId: string, profileName: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm(`Are you sure you want to delete biometric profile "${profileName}"?`)) return;

        const csrfToken = getCsrfToken();
        try {
            const res = await fetch(`/biometric-devices/${profileId}`, {
                method: 'DELETE',
                headers: {
                    'X-CSRF-TOKEN': csrfToken,
                    'X-XSRF-TOKEN': csrfToken,
                    'Accept': 'application/json',
                },
            });
            if (res.ok) {
                setProfilesList((prev) => prev.filter((p) => p.id !== profileId));
                if (activeConfig.profile_id === profileId) {
                    setActiveConfig({
                        adapter_type: 'zkteco',
                        profile_id: null,
                    });
                }
                setFeedbackMessage({
                    type: 'success',
                    text: `Profile "${profileName}" deleted.`,
                });
                setTimeout(() => setFeedbackMessage(null), 4000);
            }
        } catch (err: any) {
            setFeedbackMessage({
                type: 'error',
                text: 'Failed to delete profile: ' + err.message,
            });
        }
    };

    const handleSetDefault = async (adapterType: string, profileId: string | null = null) => {
        if (!canManage) return;

        const key = profileId ?? adapterType;
        setIsSettingDefault(key);
        setFeedbackMessage(null);

        const csrfToken = getCsrfToken();
        try {
            const res = await fetch('/settings/biometric/default', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': csrfToken,
                    'X-XSRF-TOKEN': csrfToken,
                    'Accept': 'application/json',
                },
                body: JSON.stringify({
                    adapter_type: adapterType,
                    profile_id: profileId,
                }),
            });

            const data = await res.json();
            if (res.ok && data.success) {
                setActiveConfig({
                    adapter_type: adapterType,
                    profile_id: profileId,
                });
                setProfilesList((prev) =>
                    prev.map((p) => ({
                        ...p,
                        is_default: p.id === profileId,
                    }))
                );
                setFeedbackMessage({
                    type: 'success',
                    text: data.message || 'Default biometric configuration updated.',
                });
                setTimeout(() => setFeedbackMessage(null), 5000);
            } else {
                setFeedbackMessage({
                    type: 'error',
                    text: data.message || 'Failed to update default configuration.',
                });
            }
        } catch (err: any) {
            setFeedbackMessage({
                type: 'error',
                text: err.message || 'Error updating default configuration.',
            });
        } finally {
            setIsSettingDefault(null);
        }
    };

    // Find active profile entity if custom
    const activeCustomProfile = activeConfig.adapter_type === 'configurable'
        ? profilesList.find((p) => p.id === activeConfig.profile_id)
        : null;

    const activeStandardAdapter = activeConfig.adapter_type !== 'configurable'
        ? adapters.find((a) => a.key === activeConfig.adapter_type)
        : null;

    return (
        <AuthenticatedLayout title="Biometric Device Settings" backUrl="/attendance/import">
            <Head title="Biometric Device Settings — EMS" />

            <div className="max-w-7xl mx-auto space-y-8 pb-12">
                {/* Header */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800/80">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 via-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                            <Cpu className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                                    Biometric Device Configuration
                                </h1>
                                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                                    Company Settings
                                </span>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                Configure biometric hardware profiles, delimiters, column mappings, and select the default ingestion format for this tenant.
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <Link
                            href="/attendance/import"
                            className="text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-white px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900/60 transition flex items-center gap-1.5 shadow-sm"
                        >
                            <FileSpreadsheet className="w-3.5 h-3.5 text-cyan-500" />
                            Biometric Attendance Import
                        </Link>
                        <Link
                            href="/attendance/daily"
                            className="text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-white px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900/60 transition flex items-center gap-1.5 shadow-sm"
                        >
                            <Clock className="w-3.5 h-3.5 text-indigo-500" />
                            Daily Attendance
                        </Link>

                        {canManage && (
                            <button
                                type="button"
                                onClick={() => {
                                    setEditingProfile(null);
                                    setIsProfileModalOpen(true);
                                }}
                                className="px-3.5 py-1.5 text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 rounded-xl shadow-md shadow-blue-500/15 transition flex items-center gap-1.5 ml-2"
                            >
                                <Plus className="w-3.5 h-3.5" />
                                Configure Biometric Device
                            </button>
                        )}
                    </div>
                </div>

                {/* Feedback Notification */}
                {feedbackMessage && (
                    <div
                        className={`p-4 rounded-2xl border text-xs font-medium flex items-center gap-2 transition shadow-sm ${
                            feedbackMessage.type === 'success'
                                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                                : 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300'
                        }`}
                    >
                        {feedbackMessage.type === 'success' ? (
                            <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-500" />
                        ) : (
                            <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-500" />
                        )}
                        <span>{feedbackMessage.text}</span>
                    </div>
                )}

                {/* Active Ingestion Configuration Banner */}
                <div className="p-6 rounded-3xl bg-gradient-to-br from-indigo-950/40 via-slate-900/60 to-slate-950/80 border border-indigo-500/30 backdrop-blur-md shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-400">
                                <Sparkles className="w-4 h-4 text-indigo-400" />
                                <span>Default System Biometric Configuration</span>
                                <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-semibold lowercase">
                                    active
                                </span>
                            </div>

                            <h2 className="text-xl font-extrabold text-white mt-2">
                                {activeCustomProfile
                                    ? activeCustomProfile.name
                                    : activeStandardAdapter
                                    ? activeStandardAdapter.name
                                    : 'ZKTeco Standard DAT'}
                            </h2>

                            <p className="text-xs text-slate-400 mt-1 max-w-2xl">
                                {activeCustomProfile ? (
                                    <>
                                        Hardware Profile: <strong className="text-slate-200">{activeCustomProfile.device_brand.toUpperCase()}</strong>
                                        {activeCustomProfile.model_name ? ` (${activeCustomProfile.model_name})` : ''} • Delimiter:{' '}
                                        <span className="font-mono text-cyan-400">{activeCustomProfile.delimiter_type}</span> • File: <span className="font-mono text-cyan-400">.{activeCustomProfile.file_extension}</span> • Mode:{' '}
                                        <span className="text-slate-300">{activeCustomProfile.date_mode === 'separate' ? 'Split Date + Time' : 'Combined DateTime'}</span>
                                    </>
                                ) : activeStandardAdapter ? (
                                    <>
                                        {activeStandardAdapter.description} • Extensions: <span className="font-mono text-indigo-300">{activeStandardAdapter.extension}</span>
                                    </>
                                ) : (
                                    'Standard Space/Tab delimited punch log (.dat, .txt)'
                                )}
                            </p>
                        </div>

                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                            <div className="px-3.5 py-2 rounded-xl bg-slate-900/80 border border-slate-700/80 text-xs text-slate-300 flex items-center gap-2">
                                <Info className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                                <span>Applied automatically at <Link href="/attendance/import" className="text-indigo-400 underline hover:text-indigo-300">attendance/import</Link></span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Section A: Configured Device Profiles */}
                <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <HardDrive className="w-4 h-4 text-blue-500" />
                                Configured Biometric Devices
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                Custom hardware profiles tuned for specific terminal models (Hikvision, Realand, ZKTeco, custom formats).
                            </p>
                        </div>

                        {canManage && (
                            <button
                                type="button"
                                onClick={() => {
                                    setEditingProfile(null);
                                    setIsProfileModalOpen(true);
                                }}
                                className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 flex items-center gap-1"
                            >
                                <Plus className="w-3.5 h-3.5" />
                                Add Device Profile
                            </button>
                        )}
                    </div>

                    {profilesList.length === 0 ? (
                        <div className="p-8 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-950/40 text-center">
                            <Cpu className="w-10 h-10 text-slate-400 mx-auto mb-2 opacity-50" />
                            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                                No custom device profiles configured yet
                            </h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
                                If your office or factory uses Hikvision, Realand, or non-standard terminal formats, configure a custom profile to parse punch logs with zero manual adjustments.
                            </p>
                            {canManage && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setEditingProfile(null);
                                        setIsProfileModalOpen(true);
                                    }}
                                    className="mt-4 px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition inline-flex items-center gap-1.5"
                                >
                                    <Plus className="w-3.5 h-3.5" />
                                    Configure First Biometric Profile
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {profilesList.map((prof) => {
                                const isCurrentDefault =
                                    activeConfig.adapter_type === 'configurable' &&
                                    activeConfig.profile_id === prof.id;

                                return (
                                    <div
                                        key={prof.id}
                                        className={`p-5 rounded-2xl border transition relative flex flex-col justify-between ${
                                            isCurrentDefault
                                                ? 'bg-gradient-to-br from-blue-950/60 via-slate-900 to-indigo-950/50 border-blue-500/80 shadow-lg shadow-blue-500/10 ring-1 ring-blue-500/40'
                                                : 'bg-white dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                                        }`}
                                    >
                                        <div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 uppercase tracking-wide">
                                                    {prof.device_brand}
                                                </span>

                                                <div className="flex items-center gap-1">
                                                    {isCurrentDefault ? (
                                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                                                            <Check className="w-3 h-3" /> Active Default
                                                        </span>
                                                    ) : (
                                                        canManage && (
                                                            <button
                                                                type="button"
                                                                disabled={isSettingDefault === prof.id}
                                                                onClick={() => handleSetDefault('configurable', prof.id)}
                                                                className="px-2 py-1 rounded-lg text-[11px] font-semibold text-slate-700 dark:text-slate-300 hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-indigo-600 dark:hover:bg-indigo-600 border border-slate-200 dark:border-slate-700 transition flex items-center gap-1"
                                                                title="Set as active default device for attendance imports"
                                                            >
                                                                {isSettingDefault === prof.id ? (
                                                                    <Loader2 className="w-3 h-3 animate-spin" />
                                                                ) : (
                                                                    <Check className="w-3 h-3" />
                                                                )}
                                                                Set Default
                                                            </button>
                                                        )
                                                    )}

                                                    {canManage && (
                                                        <>
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setEditingProfile(prof);
                                                                    setIsProfileModalOpen(true);
                                                                }}
                                                                className="p-1 rounded-lg text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                                                                title="Edit profile configuration"
                                                            >
                                                                <Edit2 className="w-3.5 h-3.5" />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={(e) => handleDeleteProfile(prof.id, prof.name, e)}
                                                                className="p-1 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition"
                                                                title="Delete profile"
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </div>

                                            <h4 className="text-sm font-bold text-slate-900 dark:text-white mt-3 line-clamp-1">
                                                {prof.name}
                                            </h4>
                                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                                                {prof.model_name ? `${prof.model_name} • ` : ''}
                                                {prof.delimiter_type.toUpperCase()} Delimited
                                            </p>

                                            <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800/80 flex items-center justify-between text-[11px] font-mono text-cyan-600 dark:text-cyan-400">
                                                <span>.{prof.file_extension}</span>
                                                <span className="text-slate-500 text-[10px] font-sans">
                                                    {prof.date_mode === 'separate' ? 'Split Date+Time' : 'Combined DateTime'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Section B: Standard Ingestion Formats */}
                <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                    <div>
                        <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <Settings className="w-4 h-4 text-purple-500" />
                            Standard Ingestion Formats
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            Out-of-the-box system parsers for standard punch log formats and office spreadsheets.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {adapters.map((adapter) => {
                            const isCurrentDefault =
                                activeConfig.adapter_type === adapter.key;

                            return (
                                <div
                                    key={adapter.key}
                                    className={`p-5 rounded-2xl border transition relative flex flex-col justify-between ${
                                        isCurrentDefault
                                            ? 'bg-gradient-to-br from-indigo-950/60 to-slate-900 border-indigo-500/80 shadow-lg shadow-indigo-500/10 ring-1 ring-indigo-500/50'
                                            : 'bg-white dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                                    }`}
                                >
                                    <div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                                {adapter.badge}
                                            </span>

                                            {isCurrentDefault ? (
                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                                                    <Check className="w-3 h-3" /> Active Default
                                                </span>
                                            ) : (
                                                canManage && (
                                                    <button
                                                        type="button"
                                                        disabled={isSettingDefault === adapter.key}
                                                        onClick={() => handleSetDefault(adapter.key, null)}
                                                        className="px-2 py-1 rounded-lg text-[11px] font-semibold text-slate-700 dark:text-slate-300 hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-indigo-600 dark:hover:bg-indigo-600 border border-slate-200 dark:border-slate-700 transition flex items-center gap-1"
                                                    >
                                                        {isSettingDefault === adapter.key ? (
                                                            <Loader2 className="w-3 h-3 animate-spin" />
                                                        ) : (
                                                            <Check className="w-3 h-3" />
                                                        )}
                                                        Set Default
                                                    </button>
                                                )
                                            )}
                                        </div>

                                        <h4 className="text-sm font-bold text-slate-900 dark:text-white mt-3">
                                            {adapter.name}
                                        </h4>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                                            {adapter.description}
                                        </p>
                                    </div>

                                    <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800/80 flex items-center justify-between text-[11px] font-mono text-indigo-600 dark:text-indigo-400">
                                        <span>{adapter.extension}</span>
                                        <a
                                            href={`/attendance/import/template/${adapter.key === 'excel' ? 'csv' : adapter.key}`}
                                            className="text-[11px] font-sans text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center gap-1"
                                        >
                                            <Download className="w-3 h-3" /> Sample
                                        </a>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Biometric Profile Modal */}
            <BiometricProfileModal
                isOpen={isProfileModalOpen}
                onClose={() => setIsProfileModalOpen(false)}
                onSaved={handleProfileSaved}
                editingProfile={editingProfile}
            />
        </AuthenticatedLayout>
    );
}
