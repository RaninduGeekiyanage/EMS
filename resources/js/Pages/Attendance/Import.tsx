import React, { useState, useRef } from 'react';
import { Head, useForm, router, Link } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import {
    UploadCloud,
    FileSpreadsheet,
    Cpu,
    CheckCircle2,
    AlertTriangle,
    XCircle,
    Clock,
    Calendar,
    UserCheck,
    Search,
    Trash2,
    Download,
    RefreshCw,
    FileText,
    Sparkles,
    Building2,
    Users,
    ChevronRight,
    ArrowRight,
    HelpCircle,
    Fingerprint,
    HardDrive,
    Database,
    ShieldAlert,
    Check,
    X,
    Loader2,
    Settings,
    Edit2,
    Plus,
} from 'lucide-react';
import type { BiometricDeviceProfile } from '@/Components/BiometricProfileModal';

interface MatchedEmployee {
    id: string;
    full_name: string;
    emp_no: string;
    department: string;
}

interface PreviewRow {
    line_number: number;
    biometric_id: string;
    matched_employee: MatchedEmployee | null;
    punch_datetime: string;
    punch_type: 'in' | 'out' | 'auto';
    device_id: string | null;
    status: 'ready' | 'unmapped' | 'duplicate';
}

interface PreviewData {
    total_rows: number;
    valid_rows: number;
    invalid_rows: number;
    mapped_count: number;
    unmapped_count: number;
    unique_unmapped: { biometric_id: string; occurrences: number }[];
    preview_rows: PreviewRow[];
    invalid_records: any[];
}

interface AttendanceImportRecord {
    id: string;
    tenant_id: string;
    filename: string;
    adapter_type: string;
    profile_id?: string | null;
    profile?: { id: string; name: string; device_brand: string; model_name: string | null } | null;
    total_rows: number;
    processed_rows: number;
    failed_rows: number;
    status: 'pending' | 'processing' | 'completed' | 'partial' | 'failed';
    created_at: string;
    imported_by?: { id: number; name: string; email: string } | null;
    logs_count?: number;
    errors?: {
        unmapped_punches_count?: number;
        unmapped_samples?: any[];
        invalid_records_count?: number;
    } | null;
}

interface EmployeeItem {
    id: string;
    emp_no: string;
    full_name: string;
    biometric_device_id: string | null;
    department?: { id: string; name: string } | null;
}

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
    profile?: BiometricDeviceProfile | null;
}

interface Props {
    imports: {
        data: AttendanceImportRecord[];
        current_page: number;
        last_page: number;
        total: number;
    };
    stats: {
        total_logs: number;
        total_imports: number;
        last_import_date: string | null;
        last_import_status: string;
        unmapped_employees_count: number;
        total_employees: number;
        pending_staging_punches?: number;
    };
    employees: EmployeeItem[];
    adapters: AdapterOption[];
    profiles?: BiometricDeviceProfile[];
    activeConfig?: ActiveConfig;
    canManageProfiles?: boolean;
}

export default function Import({
    imports,
    stats,
    employees,
    adapters,
    profiles = [],
    activeConfig,
    canManageProfiles = false,
}: Props) {
    const defaultAdapter = activeConfig?.adapter_type || (profiles.some((p) => p.is_default) ? 'configurable' : 'zkteco');
    const defaultProfileId = activeConfig?.profile_id || (profiles.find((p) => p.is_default)?.id ?? null);

    const [activeTab, setActiveTab] = useState<'file' | 'staging'>(() => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            if (params.get('tab') === 'staging') return 'staging';
        }
        return 'file';
    });

    const [selectedAdapter, setSelectedAdapter] = useState<string>(defaultAdapter);
    const [selectedProfileId, setSelectedProfileId] = useState<string | null>(defaultProfileId);
    const [showAdapterOverride, setShowAdapterOverride] = useState<boolean>(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [deviceIdInput, setDeviceIdInput] = useState<string>('');
    const [isDragging, setIsDragging] = useState(false);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [previewData, setPreviewData] = useState<PreviewData | null>(null);
    const [previewError, setPreviewError] = useState<string | null>(null);

    // Direct Database Staging configuration state
    const defaultStagingProfile =
        profiles.find((p) => p.source_type === 'database_staging' && p.is_default) ||
        profiles.find((p) => p.source_type === 'database_staging');
    const [stagingProfileId, setStagingProfileId] = useState<string>(defaultStagingProfile?.id || '');
    const [stagingStartDate, setStagingStartDate] = useState<string>('');
    const [stagingEndDate, setStagingEndDate] = useState<string>('');
    const [stagingDeviceSn, setStagingDeviceSn] = useState<string>('');
    const [stagingStatus, setStagingStatus] = useState<string>('pending');
    const [isCommittingStaging, setIsCommittingStaging] = useState<boolean>(false);
    const [stagingSuccessMessage, setStagingSuccessMessage] = useState<string | null>(null);

    // Quick employee mapping modal
    const [isMapModalOpen, setIsMapModalOpen] = useState(false);
    const [mappingBioId, setMappingBioId] = useState<string>('');
    const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
    const [empSearch, setEmpSearch] = useState('');
    const [isMappingSubmitting, setIsMappingSubmitting] = useState(false);

    // Delete confirmation modal
    const [deletingImport, setDeletingImport] = useState<AttendanceImportRecord | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const uploadForm = useForm({
        file: null as File | null,
        adapter_type: defaultAdapter,
        profile_id: defaultProfileId || '',
        device_id: '',
    });

    const handleFileSelect = (file: File) => {
        setSelectedFile(file);
        setPreviewData(null);
        setPreviewError(null);
        setStagingSuccessMessage(null);
        uploadForm.setData('file', file);
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFileSelect(e.dataTransfer.files[0]);
        }
    };

    const getCsrfToken = () => {
        const meta = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
        if (meta) return meta;
        const match = document.cookie.match(/XSRF-TOKEN=([^;]+)/);
        return match ? decodeURIComponent(match[1]) : '';
    };

    const runPreview = async () => {
        if (!selectedFile) return;

        setPreviewLoading(true);
        setPreviewError(null);

        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('adapter_type', selectedAdapter);
        if (selectedProfileId) {
            formData.append('profile_id', selectedProfileId);
        }
        if (deviceIdInput) {
            formData.append('device_id', deviceIdInput);
        }

        try {
            const csrfToken = getCsrfToken();
            const response = await fetch('/attendance/import/preview', {
                method: 'POST',
                headers: {
                    'X-CSRF-TOKEN': csrfToken,
                    'X-XSRF-TOKEN': csrfToken,
                    'Accept': 'application/json',
                },
                body: formData,
            });

            const result = await response.json();

            if (response.ok && result.success) {
                setPreviewData(result.data);
            } else {
                setPreviewError(result.message || 'Failed to parse attendance file preview.');
            }
        } catch (err: any) {
            setPreviewError(err.message || 'Network error while generating file preview.');
        } finally {
            setPreviewLoading(false);
        }
    };

    const handleCommitImport = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedFile) return;

        uploadForm.setData({
            file: selectedFile,
            adapter_type: selectedAdapter,
            profile_id: selectedProfileId || '',
            device_id: deviceIdInput,
        });

        uploadForm.post('/attendance/import', {
            forceFormData: true,
            onSuccess: () => {
                setSelectedFile(null);
                setPreviewData(null);
                setDeviceIdInput('');
                if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                }
            },
        });
    };

    const runStagingPreview = async () => {
        setPreviewLoading(true);
        setPreviewError(null);
        setStagingSuccessMessage(null);

        try {
            const csrfToken = getCsrfToken();
            const response = await fetch('/attendance/import/staging-preview', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': csrfToken,
                    'X-XSRF-TOKEN': csrfToken,
                    'Accept': 'application/json',
                },
                body: JSON.stringify({
                    profile_id: stagingProfileId || null,
                    start_date: stagingStartDate || null,
                    end_date: stagingEndDate || null,
                    device_sn: stagingDeviceSn || null,
                    status: stagingStatus,
                }),
            });

            const result = await response.json();

            if (response.ok && result.success) {
                setPreviewData(result.data);
            } else {
                setPreviewError(result.message || 'Failed to fetch staging preview.');
            }
        } catch (err: any) {
            setPreviewError(err.message || 'Network error fetching staging preview.');
        } finally {
            setPreviewLoading(false);
        }
    };

    const handleCommitStaging = async () => {
        setIsCommittingStaging(true);
        setPreviewError(null);
        setStagingSuccessMessage(null);

        try {
            const csrfToken = getCsrfToken();
            const response = await fetch('/attendance/import/staging-commit', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': csrfToken,
                    'X-XSRF-TOKEN': csrfToken,
                    'Accept': 'application/json',
                },
                body: JSON.stringify({
                    profile_id: stagingProfileId || null,
                    start_date: stagingStartDate || null,
                    end_date: stagingEndDate || null,
                    device_sn: stagingDeviceSn || null,
                    status: stagingStatus,
                }),
            });

            const result = await response.json();

            if (response.ok && result.success) {
                setStagingSuccessMessage(result.message || 'Staging punches committed successfully.');
                setPreviewData(null);
                router.reload();
            } else {
                setPreviewError(result.message || 'Failed to commit staging punches.');
            }
        } catch (err: any) {
            setPreviewError(err.message || 'Error committing staging punches.');
        } finally {
            setIsCommittingStaging(false);
        }
    };

    const currentActiveProfile = selectedProfileId
        ? profiles.find((p) => p.id === selectedProfileId) ?? activeConfig?.profile
        : null;

    const currentStandardAdapter = selectedAdapter !== 'configurable'
        ? adapters.find((a) => a.key === selectedAdapter)
        : null;

    const handleDeleteImport = () => {
        if (!deletingImport) return;
        router.delete(`/attendance/import/${deletingImport.id}`, {
            onSuccess: () => setDeletingImport(null),
        });
    };

    const openMapModal = (bioId: string) => {
        setMappingBioId(bioId);
        setSelectedEmployeeId('');
        setEmpSearch('');
        setIsMapModalOpen(true);
    };

    const handleSaveMapping = async () => {
        if (!selectedEmployeeId || !mappingBioId) return;

        setIsMappingSubmitting(true);
        const csrfToken = getCsrfToken();

        try {
            const res = await fetch('/attendance/import/map-employee', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': csrfToken,
                    'X-XSRF-TOKEN': csrfToken,
                    'Accept': 'application/json',
                },
                body: JSON.stringify({
                    employee_id: selectedEmployeeId,
                    biometric_id: mappingBioId,
                }),
            });

            const json = await res.json();
            if (res.ok && json.success) {
                setIsMapModalOpen(false);
                // Re-run preview if file or staging is loaded to update the grid
                if (selectedFile) {
                    runPreview();
                } else if (activeTab === 'staging') {
                    runStagingPreview();
                } else {
                    router.reload();
                }
            } else {
                alert(json.message || 'Failed to map employee');
            }
        } catch (e: any) {
            alert('Error mapping employee: ' + e.message);
        } finally {
            setIsMappingSubmitting(false);
        }
    };

    const filteredEmployees = employees.filter(
        (emp) =>
            emp.full_name.toLowerCase().includes(empSearch.toLowerCase()) ||
            emp.emp_no.toLowerCase().includes(empSearch.toLowerCase()) ||
            (emp.biometric_device_id && emp.biometric_device_id.toLowerCase().includes(empSearch.toLowerCase()))
    );

    const getStatusPill = (status: string) => {
        switch (status) {
            case 'completed':
                return (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Completed
                    </span>
                );
            case 'partial':
                return (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> Partial
                    </span>
                );
            case 'failed':
                return (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center gap-1">
                        <XCircle className="w-3 h-3" /> Failed
                    </span>
                );
            case 'processing':
                return (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20 flex items-center gap-1">
                        <RefreshCw className="w-3 h-3 animate-spin" /> Ingesting...
                    </span>
                );
            default:
                return (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-500/10 text-slate-400 border border-slate-500/20">
                        {status}
                    </span>
                );
        }
    };

    const getPunchBadge = (type: string) => {
        switch (type.toLowerCase()) {
            case 'in':
                return (
                    <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                        IN
                    </span>
                );
            case 'out':
                return (
                    <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                        OUT
                    </span>
                );
            default:
                return (
                    <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-sky-500/15 text-sky-400 border border-sky-500/30">
                        AUTO
                    </span>
                );
        }
    };

    return (
        <AuthenticatedLayout title="Biometric Attendance Ingestion" backUrl="/attendance/daily">
            <div className="max-w-7xl mx-auto space-y-4 md:space-y-5">
                {/* Header Subnavigation Bar */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-600 via-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 shrink-0">
                            <Fingerprint className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <div className="flex flex-wrap items-center gap-2">
                                <h1 className="text-lg font-bold tracking-tight text-white">
                                    Biometric Attendance Ingestion
                                </h1>
                                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                                    M02 Phase 2
                                </span>
                                {/* Simple Active Ingestion Configuration indicator */}
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                    <span className="text-slate-400 font-normal">Active Config:</span>
                                    <strong className="text-white font-semibold">
                                        {currentActiveProfile
                                            ? `${currentActiveProfile.name} (${currentActiveProfile.device_brand.toUpperCase()})`
                                            : (currentStandardAdapter?.name ?? 'ZKTeco Standard DAT')}
                                    </strong>
                                </span>
                            </div>
                            <p className="text-xs text-slate-400 mt-0.5">
                                Direct USB/CSV/Excel upload, ZKTeco biometric log parser, and punch validation pipeline
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        {canManageProfiles && (
                            <Link
                                href="/settings/biometric"
                                className="text-xs font-medium text-indigo-300 hover:text-white px-2.5 py-1.5 rounded-lg border border-indigo-500/30 hover:border-indigo-500/60 bg-indigo-950/40 transition flex items-center gap-1.5"
                            >
                                <Settings className="w-3.5 h-3.5 text-indigo-400" />
                                Biometric Profiles
                            </Link>
                        )}
                        <Link
                            href="/attendance/daily"
                            className="text-xs font-medium text-slate-300 hover:text-white px-3 py-1.5 rounded-lg border border-slate-800 hover:border-slate-700 bg-slate-900/60 transition flex items-center gap-1.5"
                        >
                            <Clock className="w-3.5 h-3.5 text-indigo-400" />
                            Daily Attendance Ledger
                        </Link>
                        <Link
                            href="/shifts"
                            className="text-xs font-medium text-slate-300 hover:text-white px-3 py-1.5 rounded-lg border border-slate-800 hover:border-slate-700 bg-slate-900/60 transition flex items-center gap-1.5"
                        >
                            <Clock className="w-3.5 h-3.5 text-indigo-400" />
                            Shifts Roster
                        </Link>
                        <Link
                            href="/work-calendar"
                            className="text-xs font-medium text-slate-300 hover:text-white px-3 py-1.5 rounded-lg border border-slate-800 hover:border-slate-700 bg-slate-900/60 transition flex items-center gap-1.5"
                        >
                            <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                            Work Calendar
                        </Link>
                        <Link
                            href="/employees"
                            className="text-xs font-medium text-slate-400 hover:text-slate-200 px-3 py-1.5 rounded-lg border border-slate-800 hover:border-slate-700 transition"
                        >
                            Employees Directory
                        </Link>
                    </div>
                </div>

                {/* Metric Summary Cards - Compact Single Line */}
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-2.5">
                    <div className="px-3.5 py-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm flex items-center justify-between gap-2 hover:border-slate-700 transition">
                        <div className="flex items-center gap-2 min-w-0">
                            <Database className="w-4 h-4 text-indigo-400 shrink-0" />
                            <span className="text-xs text-slate-400 truncate">Ingested Punches</span>
                        </div>
                        <span className="text-sm font-bold text-white shrink-0">{stats.total_logs.toLocaleString()}</span>
                    </div>

                    <div className="px-3.5 py-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm flex items-center justify-between gap-2 hover:border-slate-700 transition">
                        <div className="flex items-center gap-2 min-w-0">
                            <HardDrive className="w-4 h-4 text-cyan-400 shrink-0" />
                            <span className="text-xs text-slate-400 truncate">Import Batches</span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-sm font-bold text-white">{stats.total_imports}</span>
                            {stats.last_import_status && stats.last_import_status !== 'none' && (
                                <span className="text-[10px] text-slate-500">({stats.last_import_status})</span>
                            )}
                        </div>
                    </div>

                    <div
                        onClick={() => {
                            setActiveTab('staging');
                            setPreviewData(null);
                            setPreviewError(null);
                        }}
                        className={`px-3.5 py-2.5 rounded-xl border backdrop-blur-sm flex items-center justify-between gap-2 cursor-pointer transition ${
                            activeTab === 'staging'
                                ? 'bg-amber-500/10 border-amber-500/50 shadow-md shadow-amber-500/10'
                                : 'bg-slate-900/60 border-slate-800/80 hover:border-amber-500/40'
                        }`}
                        title="Click to view & sync database staging punches"
                    >
                        <div className="flex items-center gap-2 min-w-0">
                            <Database className="w-4 h-4 text-amber-400 shrink-0" />
                            <span className="text-xs text-amber-300 truncate">Staging Buffer</span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-sm font-bold text-amber-400">
                                {stats.pending_staging_punches ?? 0}
                            </span>
                            <span className="text-[10px] text-slate-500">pending</span>
                        </div>
                    </div>

                    <div className="px-3.5 py-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm flex items-center justify-between gap-2 hover:border-slate-700 transition">
                        <div className="flex items-center gap-2 min-w-0">
                            <Users className="w-4 h-4 text-amber-400 shrink-0" />
                            <span className="text-xs text-slate-400 truncate">Missing PINs</span>
                        </div>
                        <span className="text-sm font-bold text-amber-400 shrink-0">
                            {stats.unmapped_employees_count}
                            <span className="text-xs text-slate-500 font-normal"> / {stats.total_employees}</span>
                        </span>
                    </div>

                    <div className="px-3.5 py-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm flex items-center justify-between gap-2 hover:border-slate-700 transition">
                        <div className="flex items-center gap-2 min-w-0">
                            <Cpu className="w-4 h-4 text-purple-400 shrink-0" />
                            <span className="text-xs text-slate-400 truncate">Adapters</span>
                        </div>
                        <span className="text-sm font-bold text-white shrink-0">{adapters.length}</span>
                    </div>
                </div>

                {/* Import Workflow Container */}
                <div className="p-4 md:p-5 rounded-2xl bg-slate-900/50 border border-slate-800/80 backdrop-blur-md shadow-2xl relative">
                    {/* Workflow Source Mode Selector Tabs */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800/80 mb-4">
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => {
                                    setActiveTab('file');
                                    setPreviewData(null);
                                    setPreviewError(null);
                                    setStagingSuccessMessage(null);
                                }}
                                className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                                    activeTab === 'file'
                                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                                        : 'bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                                }`}
                            >
                                <UploadCloud className="w-4 h-4" />
                                Upload Punch Log File
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setActiveTab('staging');
                                    setPreviewData(null);
                                    setPreviewError(null);
                                    setStagingSuccessMessage(null);
                                }}
                                className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 relative ${
                                    activeTab === 'staging'
                                        ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20 font-extrabold'
                                        : 'bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                                }`}
                            >
                                <Database className="w-4 h-4" />
                                Sync from Staging DB
                                {stats.pending_staging_punches !== undefined && stats.pending_staging_punches > 0 && (
                                    <span
                                        className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                                            activeTab === 'staging'
                                                ? 'bg-slate-950 text-amber-400'
                                                : 'bg-amber-500 text-slate-950'
                                        }`}
                                    >
                                        {stats.pending_staging_punches}
                                    </span>
                                )}
                            </button>
                        </div>

                        {/* Format template download shortcut & format switcher (File tab only) */}
                        {activeTab === 'file' && (
                            <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                                <span className="text-[11px] text-slate-400">Templates:</span>
                                <a
                                    href="/attendance/import/template/zkteco"
                                    className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition flex items-center gap-1 border border-slate-700/50"
                                >
                                    <Download className="w-3 h-3 text-cyan-400" /> ZKTeco
                                </a>
                                <a
                                    href="/attendance/import/template/hikvision"
                                    className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition flex items-center gap-1 border border-slate-700/50"
                                >
                                    <Download className="w-3 h-3 text-blue-400" /> Hikvision
                                </a>
                                <a
                                    href="/attendance/import/template/realand"
                                    className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition flex items-center gap-1 border border-slate-700/50"
                                >
                                    <Download className="w-3 h-3 text-indigo-400" /> Realand
                                </a>
                                <a
                                    href="/attendance/import/template/csv"
                                    className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition flex items-center gap-1 border border-slate-700/50"
                                >
                                    <Download className="w-3 h-3 text-emerald-400" /> CSV
                                </a>
                                <button
                                    type="button"
                                    onClick={() => setShowAdapterOverride(!showAdapterOverride)}
                                    className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition flex items-center gap-1 border border-slate-700 ml-1"
                                >
                                    <Cpu className="w-3 h-3 text-indigo-400" />
                                    {showAdapterOverride ? 'Hide Formats' : 'Change Format'}
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Staging Success Flash Message */}
                    {stagingSuccessMessage && (
                        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2 mb-4">
                            <CheckCircle2 className="w-4 h-4 shrink-0" />
                            <span>{stagingSuccessMessage}</span>
                        </div>
                    )}

                    {/* TAB 1: FILE LOG UPLOAD WORKFLOW */}
                    {activeTab === 'file' && (
                        <>
                            {/* Optional Ad-hoc Adapter Override */}
                            {showAdapterOverride && (
                                <div className="mb-4 p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2.5">
                                    <div className="flex items-center justify-between text-xs text-slate-400">
                                        <span className="font-semibold text-slate-300">Override Ingestion Format (Ad-hoc)</span>
                                        <span>Overrides default format for this upload only</span>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                                        {profiles.map((prof) => {
                                            const isSelected = selectedProfileId === prof.id;
                                            return (
                                                <div
                                                    key={prof.id}
                                                    onClick={() => {
                                                        setSelectedAdapter('configurable');
                                                        setSelectedProfileId(prof.id);
                                                        setPreviewData(null);
                                                    }}
                                                    className={`p-3 rounded-xl border text-xs cursor-pointer transition ${
                                                        isSelected
                                                            ? 'bg-blue-950/60 border-blue-500 text-white font-semibold'
                                                            : 'bg-slate-900/40 border-slate-800 text-slate-400 hover:border-slate-700'
                                                    }`}
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <span className="uppercase text-[10px] font-bold text-blue-400">{prof.device_brand}</span>
                                                        {isSelected && <Check className="w-3.5 h-3.5 text-blue-400" />}
                                                    </div>
                                                    <div className="font-medium text-white truncate mt-1">{prof.name}</div>
                                                </div>
                                            );
                                        })}
                                        {adapters.map((adap) => {
                                            const isSelected = selectedProfileId === null && selectedAdapter === adap.key;
                                            return (
                                                <div
                                                    key={adap.key}
                                                    onClick={() => {
                                                        setSelectedAdapter(adap.key);
                                                        setSelectedProfileId(null);
                                                        setPreviewData(null);
                                                    }}
                                                    className={`p-3 rounded-xl border text-xs cursor-pointer transition ${
                                                        isSelected
                                                            ? 'bg-indigo-950/60 border-indigo-500 text-white font-semibold'
                                                            : 'bg-slate-900/40 border-slate-800 text-slate-400 hover:border-slate-700'
                                                    }`}
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <span className="uppercase text-[10px] font-bold text-indigo-400">{adap.badge}</span>
                                                        {isSelected && <Check className="w-3.5 h-3.5 text-indigo-400" />}
                                                    </div>
                                                    <div className="font-medium text-white truncate mt-1">{adap.name}</div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Upload File & Ingestion Settings */}
                            <div className="space-y-2.5">
                                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                                    Upload File & Ingestion Settings
                                </label>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                                    {/* Drag and drop dropzone */}
                                    <div
                                        onDragOver={(e) => {
                                            e.preventDefault();
                                            setIsDragging(true);
                                        }}
                                        onDragLeave={() => setIsDragging(false)}
                                        onDrop={handleDrop}
                                        onClick={() => fileInputRef.current?.click()}
                                        className={`md:col-span-2 p-5 md:p-6 rounded-2xl border-2 border-dashed transition flex flex-col items-center justify-center cursor-pointer text-center relative overflow-hidden ${
                                            isDragging
                                                ? 'border-indigo-500 bg-indigo-500/10'
                                                : selectedFile
                                                ? 'border-emerald-500/60 bg-emerald-500/5'
                                                : 'border-slate-700 hover:border-slate-600 bg-slate-950/40'
                                        }`}
                                    >
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            className="hidden"
                                            accept=".dat,.txt,.csv,.xlsx,.xls"
                                            onChange={(e) => {
                                                if (e.target.files && e.target.files[0]) {
                                                    handleFileSelect(e.target.files[0]);
                                                }
                                            }}
                                        />

                                        {selectedFile ? (
                                            <div className="flex flex-col items-center gap-2">
                                                <div className="w-12 h-12 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                                                    <FileText className="w-6 h-6" />
                                                </div>
                                                <div>
                                                    <span className="text-sm font-bold text-white">
                                                        {selectedFile.name}
                                                    </span>
                                                    <span className="text-xs text-slate-400 ml-2">
                                                        ({(selectedFile.size / 1024).toFixed(1)} KB)
                                                    </span>
                                                </div>
                                                <p className="text-xs text-emerald-400 font-medium">
                                                    File ready. Click "Preview & Validate Punches" below.
                                                </p>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col items-center gap-2">
                                                <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 shadow-inner">
                                                    <UploadCloud className="w-6 h-6 text-indigo-400" />
                                                </div>
                                                <div>
                                                    <span className="text-sm font-semibold text-slate-200">
                                                        Drag & drop your biometric punch file here
                                                    </span>
                                                    <p className="text-xs text-slate-500 mt-0.5">
                                                        or browse files (.dat, .txt, .csv, .xlsx up to 10MB)
                                                    </p>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Optional terminal settings */}
                                    <div className="p-5 rounded-2xl bg-slate-950/40 border border-slate-800 space-y-4 flex flex-col justify-between">
                                        <div>
                                            <h4 className="text-xs font-semibold text-slate-300">
                                                Terminal / Device Details
                                            </h4>
                                            <p className="text-[11px] text-slate-500 mt-0.5">
                                                Assign an optional terminal serial or branch location identifier.
                                            </p>

                                            <div className="mt-3">
                                                <label className="text-[11px] font-medium text-slate-400">
                                                    Device Identifier (Optional)
                                                </label>
                                                <input
                                                    type="text"
                                                    value={deviceIdInput}
                                                    onChange={(e) => setDeviceIdInput(e.target.value)}
                                                    placeholder="e.g. ZK-LOBBY-01"
                                                    className="mt-1 w-full text-xs px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 focus:border-indigo-500 focus:outline-none text-slate-200 placeholder:text-slate-600 font-mono"
                                                />
                                            </div>
                                        </div>

                                        <button
                                            type="button"
                                            disabled={!selectedFile || previewLoading}
                                            onClick={runPreview}
                                            className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20"
                                        >
                                            {previewLoading ? (
                                                <>
                                                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                                    Analyzing Punch File...
                                                </>
                                            ) : (
                                                <>
                                                    <Sparkles className="w-3.5 h-3.5" />
                                                    Preview & Validate Punches
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}

                    {/* TAB 2: DIRECT DATABASE STAGING WORKFLOW */}
                    {activeTab === 'staging' && (
                        <div className="space-y-4">
                            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-4">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
                                    <div>
                                        <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                            <Database className="w-4 h-4 text-amber-400" />
                                            Direct Database Staging Punch Buffer
                                        </h3>
                                        <p className="text-xs text-slate-400 mt-0.5">
                                            Synchronize records pushed into <code className="text-amber-400 font-mono">raw_biometric_punches</code> by background daemons or direct database jobs.
                                        </p>
                                    </div>

                                    {canManageProfiles && (
                                        <Link
                                            href="/settings/biometric"
                                            className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1"
                                        >
                                            <Settings className="w-3.5 h-3.5" /> Configure Staging Mappings
                                        </Link>
                                    )}
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
                                    {/* Profile Selector */}
                                    <div>
                                        <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
                                            Biometric Profile Mapping
                                        </label>
                                        <select
                                            value={stagingProfileId}
                                            onChange={(e) => setStagingProfileId(e.target.value)}
                                            className="w-full text-xs px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 focus:border-amber-500 focus:outline-none text-slate-200"
                                        >
                                            <option value="">Default Column Config</option>
                                            {profiles.map((p) => (
                                                <option key={p.id} value={p.id}>
                                                    {p.name} {p.source_type === 'database_staging' ? '[Staging DB]' : `(${p.device_brand})`}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Date From */}
                                    <div>
                                        <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
                                            Start Date (Optional)
                                        </label>
                                        <input
                                            type="date"
                                            value={stagingStartDate}
                                            onChange={(e) => setStagingStartDate(e.target.value)}
                                            className="w-full text-xs px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 focus:border-amber-500 focus:outline-none text-slate-200"
                                        />
                                    </div>

                                    {/* Date To */}
                                    <div>
                                        <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
                                            End Date (Optional)
                                        </label>
                                        <input
                                            type="date"
                                            value={stagingEndDate}
                                            onChange={(e) => setStagingEndDate(e.target.value)}
                                            className="w-full text-xs px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 focus:border-amber-500 focus:outline-none text-slate-200"
                                        />
                                    </div>

                                    {/* Device SN filter */}
                                    <div>
                                        <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
                                            Terminal / Device SN
                                        </label>
                                        <input
                                            type="text"
                                            value={stagingDeviceSn}
                                            onChange={(e) => setStagingDeviceSn(e.target.value)}
                                            placeholder="e.g. ZK-LOBBY-01 (All)"
                                            className="w-full text-xs px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 focus:border-amber-500 focus:outline-none text-slate-200 font-mono placeholder:text-slate-600"
                                        />
                                    </div>
                                </div>

                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                                    <div className="flex items-center gap-3">
                                        <label className="text-xs text-slate-400 flex items-center gap-1.5">
                                            <span>Buffer Status:</span>
                                            <select
                                                value={stagingStatus}
                                                onChange={(e) => setStagingStatus(e.target.value)}
                                                className="text-xs px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 focus:border-amber-500 focus:outline-none font-medium"
                                            >
                                                <option value="pending">Pending Only (Unsynced)</option>
                                                <option value="all">All Records</option>
                                                <option value="failed">Failed / Skipped</option>
                                            </select>
                                        </label>
                                    </div>

                                    <button
                                        type="button"
                                        disabled={previewLoading}
                                        onClick={runStagingPreview}
                                        className="py-2.5 px-6 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20"
                                    >
                                        {previewLoading ? (
                                            <>
                                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                                Loading Staging Punches...
                                            </>
                                        ) : (
                                            <>
                                                <Sparkles className="w-3.5 h-3.5" />
                                                Preview Staging Punches
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {previewError && (
                        <div className="mt-4 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 shrink-0" />
                            <span>{previewError}</span>
                        </div>
                    )}

                    {/* Step 3: Live Preview & Validation Grid */}
                    {previewData && (
                        <div className="mt-8 pt-6 border-t border-slate-800 space-y-4 animate-in fade-in duration-300">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div>
                                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                                        Punch Validation Preview
                                    </h3>
                                    <p className="text-xs text-slate-400">
                                        Review detected attendance records and employee matching before saving to database.
                                    </p>
                                </div>

                                <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-2 text-xs">
                                        <span className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 font-mono">
                                            Total: {previewData.total_rows}
                                        </span>
                                        <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 font-mono border border-emerald-500/20">
                                            Mapped: {previewData.mapped_count}
                                        </span>
                                        {previewData.unmapped_count > 0 && (
                                            <span className="px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-400 font-mono border border-amber-500/20">
                                                Unmapped: {previewData.unmapped_count}
                                            </span>
                                        )}
                                    </div>

                                    <button
                                        type="button"
                                        onClick={activeTab === 'staging' ? handleCommitStaging : handleCommitImport}
                                        disabled={activeTab === 'staging' ? isCommittingStaging : uploadForm.processing}
                                        className="py-2 px-5 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white transition flex items-center gap-2 shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                                    >
                                        {(activeTab === 'staging' ? isCommittingStaging : uploadForm.processing) ? (
                                            <>
                                                <RefreshCw className="w-4 h-4 animate-spin" />
                                                Committing Punches...
                                            </>
                                        ) : (
                                            <>
                                                <Check className="w-4 h-4" />
                                                Commit {previewData.mapped_count} Punches {activeTab === 'staging' ? 'from Staging' : ''}
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>

                            {/* Unmapped IDs notice */}
                            {previewData.unique_unmapped.length > 0 && (
                                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                                    <div className="flex items-center gap-2">
                                        <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
                                        <span>
                                            Found <strong>{previewData.unique_unmapped.length}</strong> unmapped biometric ID(s). Punches for unmapped IDs will be skipped unless assigned.
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        {previewData.unique_unmapped.slice(0, 5).map((item) => (
                                            <button
                                                key={item.biometric_id}
                                                type="button"
                                                onClick={() => openMapModal(item.biometric_id)}
                                                className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/30 text-[11px] font-mono flex items-center gap-1"
                                                title={`Map biometric ID ${item.biometric_id} to an employee`}
                                            >
                                                Map #{item.biometric_id} ({item.occurrences}x) →
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Preview Grid Table */}
                            <div className="rounded-2xl border border-slate-800 overflow-hidden bg-slate-950/60 max-h-96 overflow-y-auto">
                                <table className="w-full text-left text-xs text-slate-300">
                                    <thead className="bg-slate-900/80 text-slate-400 uppercase text-[10px] tracking-wider sticky top-0 backdrop-blur-sm border-b border-slate-800">
                                        <tr>
                                            <th className="py-3 px-4">Line</th>
                                            <th className="py-3 px-4">Biometric ID</th>
                                            <th className="py-3 px-4">Matched Employee</th>
                                            <th className="py-3 px-4">Punch Time</th>
                                            <th className="py-3 px-4">Type</th>
                                            <th className="py-3 px-4">Device</th>
                                            <th className="py-3 px-4 text-right">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800/60">
                                        {previewData.preview_rows.map((row, idx) => (
                                            <tr
                                                key={idx}
                                                className="hover:bg-slate-900/40 transition"
                                            >
                                                <td className="py-2.5 px-4 font-mono text-slate-500">
                                                    #{row.line_number}
                                                </td>
                                                <td className="py-2.5 px-4 font-mono font-bold text-slate-200">
                                                    {row.biometric_id}
                                                </td>
                                                <td className="py-2.5 px-4">
                                                    {row.matched_employee ? (
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-300 flex items-center justify-center font-bold text-[10px]">
                                                                {row.matched_employee.full_name.charAt(0)}
                                                            </div>
                                                            <div>
                                                                <span className="font-semibold text-slate-100 block">
                                                                    {row.matched_employee.full_name}
                                                                </span>
                                                                <span className="text-[10px] text-slate-400 font-mono">
                                                                    {row.matched_employee.emp_no} • {row.matched_employee.department}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            onClick={() => openMapModal(row.biometric_id)}
                                                            className="text-amber-400 hover:text-amber-300 underline font-medium text-[11px]"
                                                        >
                                                            Unassigned (Click to map)
                                                        </button>
                                                    )}
                                                </td>
                                                <td className="py-2.5 px-4 font-mono text-slate-300">
                                                    {row.punch_datetime}
                                                </td>
                                                <td className="py-2.5 px-4">
                                                    {getPunchBadge(row.punch_type)}
                                                </td>
                                                <td className="py-2.5 px-4 font-mono text-slate-400 text-[11px]">
                                                    {row.device_id || '—'}
                                                </td>
                                                <td className="py-2.5 px-4 text-right">
                                                    {row.status === 'ready' && (
                                                        <span className="text-emerald-400 font-semibold text-[11px]">
                                                            ✓ Ready
                                                        </span>
                                                    )}
                                                    {row.status === 'unmapped' && (
                                                        <span className="text-amber-400 font-semibold text-[11px]">
                                                            ⚠ Unmapped
                                                        </span>
                                                    )}
                                                    {row.status === 'duplicate' && (
                                                        <span className="text-slate-400 font-medium text-[11px]">
                                                            Duplicate
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>

                {/* Past Ingestion History */}
                <div className="p-6 md:p-8 rounded-3xl bg-slate-900/40 border border-slate-800/80 backdrop-blur-md space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-base font-bold text-white flex items-center gap-2">
                                <Clock className="w-5 h-5 text-indigo-400" />
                                Attendance Ingestion History & Audit Log
                            </h3>
                            <p className="text-xs text-slate-400 mt-0.5">
                                Track past biometric imports and rollback erroneous batches if needed.
                            </p>
                        </div>
                        <span className="text-xs font-mono text-slate-400">
                            {imports.total} batch{imports.total === 1 ? '' : 'es'}
                        </span>
                    </div>

                    {imports.data.length === 0 ? (
                        <div className="py-12 text-center text-slate-500 text-xs">
                            No attendance files have been imported yet.
                        </div>
                    ) : (
                        <div className="rounded-2xl border border-slate-800 overflow-hidden">
                            <table className="w-full text-left text-xs text-slate-300">
                                <thead className="bg-slate-900 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                                    <tr>
                                        <th className="py-3 px-4">Filename & Format</th>
                                        <th className="py-3 px-4">Uploaded By</th>
                                        <th className="py-3 px-4">Ingested Date</th>
                                        <th className="py-3 px-4">Rows (Total / Processed / Skipped)</th>
                                        <th className="py-3 px-4">Status</th>
                                        <th className="py-3 px-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/60 bg-slate-950/40">
                                    {imports.data.map((item) => (
                                        <tr key={item.id} className="hover:bg-slate-900/30 transition">
                                            <td className="py-3 px-4">
                                                <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                                                    {item.profile ? (
                                                        <span className="text-cyan-400 flex items-center gap-1">
                                                            <Cpu className="w-3.5 h-3.5" />
                                                            {item.profile.name}
                                                        </span>
                                                    ) : (
                                                        item.filename
                                                    )}
                                                </div>
                                                <div className="text-[10px] text-slate-500 uppercase tracking-wider font-mono">
                                                    {item.profile ? item.filename : item.adapter_type}
                                                </div>
                                            </td>
                                            <td className="py-3 px-4 text-slate-400">
                                                {item.imported_by?.name || 'System / Admin'}
                                            </td>
                                            <td className="py-3 px-4 font-mono text-slate-400">
                                                {new Date(item.created_at).toLocaleString()}
                                            </td>
                                            <td className="py-3 px-4">
                                                <div className="font-mono text-xs">
                                                    <span className="text-emerald-400 font-bold">
                                                        {item.processed_rows}
                                                    </span>{' '}
                                                    / {item.total_rows}
                                                    {item.failed_rows > 0 && (
                                                        <span className="text-amber-400 ml-1">
                                                            ({item.failed_rows} skipped)
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="py-3 px-4">
                                                {getStatusPill(item.status)}
                                            </td>
                                            <td className="py-3 px-4 text-right">
                                                <button
                                                    type="button"
                                                    onClick={() => setDeletingImport(item)}
                                                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition"
                                                    title="Rollback import and remove its attendance logs"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

            {/* Modal: Quick Biometric ID Mapping */}
            {isMapModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
                    <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                            <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                <Fingerprint className="w-4 h-4 text-cyan-400" />
                                Map Biometric PIN #{mappingBioId}
                            </h3>
                            <button
                                type="button"
                                onClick={() => setIsMapModalOpen(false)}
                                className="text-slate-400 hover:text-white"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <p className="text-xs text-slate-400">
                            Assign device PIN <strong className="text-white font-mono">{mappingBioId}</strong> to an employee profile so punches automatically associate to them.
                        </p>

                        <div>
                            <label className="text-[11px] font-medium text-slate-400">
                                Search & Select Employee
                            </label>
                            <div className="relative mt-1">
                                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                                <input
                                    type="text"
                                    value={empSearch}
                                    onChange={(e) => setEmpSearch(e.target.value)}
                                    placeholder="Search by name or employee number..."
                                    className="w-full text-xs pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:outline-none text-slate-200 placeholder:text-slate-600"
                                />
                            </div>
                        </div>

                        <div className="max-h-48 overflow-y-auto space-y-1 rounded-xl border border-slate-800/80 p-2 bg-slate-950/40">
                            {filteredEmployees.map((emp) => {
                                const isSelected = selectedEmployeeId === emp.id;
                                return (
                                    <div
                                        key={emp.id}
                                        onClick={() => setSelectedEmployeeId(emp.id)}
                                        className={`p-2.5 rounded-xl cursor-pointer text-xs flex items-center justify-between transition ${
                                            isSelected
                                                ? 'bg-indigo-600/20 border border-indigo-500 text-white'
                                                : 'hover:bg-slate-800 text-slate-300'
                                        }`}
                                    >
                                        <div>
                                            <span className="font-semibold block">{emp.full_name}</span>
                                            <span className="text-[10px] text-slate-500 font-mono">
                                                {emp.emp_no} • {emp.department?.name || 'General'}
                                            </span>
                                        </div>
                                        {emp.biometric_device_id && (
                                            <span className="text-[10px] font-mono text-slate-500">
                                                Current: #{emp.biometric_device_id}
                                            </span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-2">
                            <button
                                type="button"
                                onClick={() => setIsMapModalOpen(false)}
                                className="px-3 py-1.5 rounded-xl text-xs text-slate-400 hover:text-white"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                disabled={!selectedEmployeeId || isMappingSubmitting}
                                onClick={handleSaveMapping}
                                className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40 transition flex items-center gap-1.5"
                            >
                                {isMappingSubmitting ? 'Saving...' : 'Confirm Mapping'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Delete / Rollback Confirmation */}
            {deletingImport && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
                    <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-4">
                        <div className="w-12 h-12 rounded-2xl bg-rose-500/15 text-rose-400 flex items-center justify-center mx-auto">
                            <Trash2 className="w-6 h-6" />
                        </div>
                        <div className="text-center">
                            <h3 className="text-sm font-bold text-white">
                                Rollback Attendance Import?
                            </h3>
                            <p className="text-xs text-slate-400 mt-1">
                                Are you sure you want to rollback <strong>{deletingImport.filename}</strong>? All {deletingImport.processed_rows} imported attendance logs will be permanently removed.
                            </p>
                        </div>
                        <div className="flex items-center justify-center gap-2 pt-2">
                            <button
                                type="button"
                                onClick={() => setDeletingImport(null)}
                                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleDeleteImport}
                                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white transition"
                            >
                                Yes, Rollback Punches
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Global Ingestion Processing Overlay */}
            {uploadForm.processing && (
                <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex flex-col items-center justify-center text-white p-4">
                    <Loader2 className="w-12 h-12 animate-spin text-emerald-400 mb-3" />
                    <p className="text-lg font-semibold">Committing Biometric Punches...</p>
                    <p className="text-xs text-slate-400 mt-1">Safely inserting punch logs in chunked database transactions...</p>
                </div>
            )}

            </div>
        </AuthenticatedLayout>
    );
}
