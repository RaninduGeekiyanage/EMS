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
import BiometricProfileModal, { BiometricDeviceProfile } from '@/Components/BiometricProfileModal';

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
    };
    employees: EmployeeItem[];
    adapters: AdapterOption[];
    profiles?: BiometricDeviceProfile[];
    canManageProfiles?: boolean;
}

export default function Import({ imports, stats, employees, adapters, profiles = [], canManageProfiles = false }: Props) {
    const [selectedAdapter, setSelectedAdapter] = useState<string>('zkteco');
    const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
    const [profilesList, setProfilesList] = useState<BiometricDeviceProfile[]>(profiles);
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
    const [editingProfile, setEditingProfile] = useState<BiometricDeviceProfile | null>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [deviceIdInput, setDeviceIdInput] = useState<string>('');
    const [isDragging, setIsDragging] = useState(false);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [previewData, setPreviewData] = useState<PreviewData | null>(null);
    const [previewError, setPreviewError] = useState<string | null>(null);

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
        adapter_type: 'zkteco',
        profile_id: '',
        device_id: '',
    });

    const handleFileSelect = (file: File) => {
        setSelectedFile(file);
        setPreviewData(null);
        setPreviewError(null);
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

    const handleProfileSaved = (saved: BiometricDeviceProfile) => {
        setProfilesList((prev) => {
            const exists = prev.some((p) => p.id === saved.id);
            if (exists) {
                return prev.map((p) => (p.id === saved.id ? saved : p));
            }
            return [saved, ...prev];
        });
        setSelectedAdapter('configurable');
        setSelectedProfileId(saved.id);
        setPreviewData(null);
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
                if (selectedProfileId === profileId) {
                    setSelectedProfileId(null);
                    setSelectedAdapter('zkteco');
                }
            }
        } catch (err) {
            console.error('Failed to delete profile:', err);
        }
    };

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
                // Re-run preview if file is loaded to update the grid
                if (selectedFile) {
                    runPreview();
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
            <div className="max-w-7xl mx-auto space-y-8">
                {/* Header Subnavigation Bar */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-2 border-b border-slate-800/80">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 via-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                            <Fingerprint className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-xl font-bold tracking-tight text-white">
                                    Biometric Attendance Ingestion
                                </h1>
                                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                                    M02 Phase 2
                                </span>
                            </div>
                            <p className="text-xs text-slate-400">
                                Direct USB/CSV/Excel upload, ZKTeco biometric log parser, and punch validation pipeline
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
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
                {/* Metric Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm relative overflow-hidden group hover:border-indigo-500/50 transition">
                        <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
                            <span>Ingested Punch Records</span>
                            <Database className="w-4 h-4 text-indigo-400" />
                        </div>
                        <div className="mt-2 text-3xl font-extrabold text-white tracking-tight">
                            {stats.total_logs.toLocaleString()}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                            Stored in high-fidelity attendance log
                        </div>
                    </div>

                    <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm relative overflow-hidden group hover:border-cyan-500/50 transition">
                        <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
                            <span>Import Batches</span>
                            <HardDrive className="w-4 h-4 text-cyan-400" />
                        </div>
                        <div className="mt-2 text-3xl font-extrabold text-white tracking-tight">
                            {stats.total_imports}
                        </div>
                        <div className="mt-1 text-xs text-slate-500 flex items-center gap-1">
                            Status: {getStatusPill(stats.last_import_status)}
                        </div>
                    </div>

                    <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm relative overflow-hidden group hover:border-amber-500/50 transition">
                        <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
                            <span>Missing Biometric Pins</span>
                            <Users className="w-4 h-4 text-amber-400" />
                        </div>
                        <div className="mt-2 text-3xl font-extrabold text-amber-400 tracking-tight">
                            {stats.unmapped_employees_count}
                            <span className="text-sm font-normal text-slate-400 ml-1">
                                / {stats.total_employees} staff
                            </span>
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                            {stats.unmapped_employees_count === 0 ? 'All employees mapped' : 'Need device ID allocation'}
                        </div>
                    </div>

                    <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm relative overflow-hidden group hover:border-purple-500/50 transition">
                        <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
                            <span>Biometric Adapters</span>
                            <Cpu className="w-4 h-4 text-purple-400" />
                        </div>
                        <div className="mt-2 text-3xl font-extrabold text-white tracking-tight">
                            {adapters.length}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                            ZKTeco DAT • Generic CSV • Excel XLSX
                        </div>
                    </div>
                </div>

                {/* Import Workflow Container */}
                <div className="p-6 md:p-8 rounded-3xl bg-slate-900/50 border border-slate-800/80 backdrop-blur-md shadow-2xl relative">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
                        <div>
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                <UploadCloud className="w-6 h-6 text-cyan-400" />
                                Ingest Biometric Attendance Punch Log
                            </h2>
                            <p className="text-xs text-slate-400 mt-1">
                                Upload raw machine dumps, preview employee matching, and commit deduplicated logs into your attendance ledger.
                            </p>
                        </div>

                        {/* Format template download shortcut */}
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs text-slate-400">Sample Templates:</span>
                            <a
                                href="/attendance/import/template/zkteco"
                                className="text-xs font-medium px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition flex items-center gap-1 border border-slate-700/50"
                            >
                                <Download className="w-3 h-3 text-cyan-400" /> ZKTeco (.dat)
                            </a>
                            <a
                                href="/attendance/import/template/hikvision"
                                className="text-xs font-medium px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition flex items-center gap-1 border border-slate-700/50"
                            >
                                <Download className="w-3 h-3 text-blue-400" /> Hikvision (.txt)
                            </a>
                            <a
                                href="/attendance/import/template/realand"
                                className="text-xs font-medium px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition flex items-center gap-1 border border-slate-700/50"
                            >
                                <Download className="w-3 h-3 text-indigo-400" /> Realand (.txt)
                            </a>
                            <a
                                href="/attendance/import/template/csv"
                                className="text-xs font-medium px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition flex items-center gap-1 border border-slate-700/50"
                            >
                                <Download className="w-3 h-3 text-emerald-400" /> CSV Template
                            </a>
                        </div>
                    </div>

                    {/* Step 1: Choose Biometric Adapter / Saved Device Profile */}
                    <div className="mt-6 space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div>
                                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                                    <Cpu className="w-4 h-4 text-cyan-400" />
                                    Step 1: Select Biometric Device or Ingestion Format
                                </label>
                                <p className="text-[11px] text-slate-500 mt-0.5">
                                    Choose from standard adapters or your organization's custom configured hardware profiles (Hikvision, Realand, ZKTeco)
                                </p>
                            </div>

                            {canManageProfiles && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setEditingProfile(null);
                                        setIsProfileModalOpen(true);
                                    }}
                                    className="px-3.5 py-1.5 text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 rounded-xl shadow-md shadow-blue-500/10 transition flex items-center gap-1.5 self-start sm:self-auto"
                                >
                                    <Plus className="w-3.5 h-3.5" />
                                    Configure Biometric Device
                                </button>
                            )}
                        </div>

                        {/* Section A: Configured Device Profiles */}
                        {profilesList.length > 0 && (
                            <div className="space-y-2">
                                <div className="text-xs font-semibold text-slate-300 flex items-center gap-2">
                                    <span>Configured Biometric Devices</span>
                                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                                        {profilesList.length} Active
                                    </span>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    {profilesList.map((prof) => {
                                        const isSelected = selectedProfileId === prof.id;
                                        return (
                                            <div
                                                key={prof.id}
                                                onClick={() => {
                                                    setSelectedAdapter('configurable');
                                                    setSelectedProfileId(prof.id);
                                                    setPreviewData(null);
                                                }}
                                                className={`p-4 rounded-2xl border transition cursor-pointer relative group ${
                                                    isSelected
                                                        ? 'bg-gradient-to-br from-blue-950/70 via-slate-900 to-indigo-950/60 border-blue-500/80 shadow-lg shadow-blue-500/15 ring-1 ring-blue-500/50'
                                                        : 'bg-slate-900/50 border-slate-800 hover:border-slate-700 hover:bg-slate-900/80'
                                                }`}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 uppercase">
                                                        {prof.device_brand}
                                                    </span>
                                                    <div className="flex items-center gap-1.5">
                                                        {canManageProfiles && (
                                                            <>
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setEditingProfile(prof);
                                                                        setIsProfileModalOpen(true);
                                                                    }}
                                                                    className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                                                                    title="Edit profile configuration"
                                                                >
                                                                    <Edit2 className="w-3.5 h-3.5" />
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => handleDeleteProfile(prof.id, prof.name, e)}
                                                                    className="p-1 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition"
                                                                    title="Delete profile"
                                                                >
                                                                    <Trash2 className="w-3.5 h-3.5" />
                                                                </button>
                                                            </>
                                                        )}
                                                        {isSelected && (
                                                            <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center text-white">
                                                                <Check className="w-3 h-3" />
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                <h3 className="text-sm font-bold text-white mt-2.5 line-clamp-1">
                                                    {prof.name}
                                                </h3>
                                                <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">
                                                    {prof.model_name ? `${prof.model_name} • ` : ''}
                                                    {prof.delimiter_type.toUpperCase()} Delimited
                                                </p>
                                                <div className="mt-3 flex items-center justify-between text-[11px] font-mono text-cyan-400">
                                                    <span>.{prof.file_extension}</span>
                                                    <span className="text-slate-500 text-[10px] font-sans">
                                                        {prof.date_mode === 'separate' ? 'Split Date+Time' : 'Combined DateTime'}
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Section B: Standard Format Adapters */}
                        <div className="space-y-2">
                            <div className="text-xs font-semibold text-slate-400">
                                Standard Formats
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                {adapters.map((adapter) => {
                                    const isSelected = selectedProfileId === null && selectedAdapter === adapter.key;
                                    return (
                                        <div
                                            key={adapter.key}
                                            onClick={() => {
                                                setSelectedAdapter(adapter.key);
                                                setSelectedProfileId(null);
                                                setPreviewData(null);
                                            }}
                                            className={`p-4 rounded-2xl border transition cursor-pointer relative ${
                                                isSelected
                                                    ? 'bg-gradient-to-br from-indigo-950/60 to-slate-900 border-indigo-500/80 shadow-lg shadow-indigo-500/10 ring-1 ring-indigo-500/50'
                                                    : 'bg-slate-900/40 border-slate-800 hover:border-slate-700 hover:bg-slate-900/70'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                                                    {adapter.badge}
                                                </span>
                                                {isSelected && (
                                                    <div className="w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center text-white">
                                                        <Check className="w-3 h-3" />
                                                    </div>
                                                )}
                                            </div>
                                            <h3 className="text-sm font-bold text-white mt-2.5">
                                                {adapter.name}
                                            </h3>
                                            <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                                                {adapter.description}
                                            </p>
                                            <div className="mt-3 text-[11px] font-mono text-indigo-400">
                                                {adapter.extension}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Step 2: Upload File & Terminal ID */}
                    <div className="mt-6 space-y-3">
                        <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                            Step 2: Upload File & Ingestion Settings
                        </label>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* Drag and drop dropzone */}
                            <div
                                onDragOver={(e) => {
                                    e.preventDefault();
                                    setIsDragging(true);
                                }}
                                onDragLeave={() => setIsDragging(false)}
                                onDrop={handleDrop}
                                onClick={() => fileInputRef.current?.click()}
                                className={`md:col-span-2 p-8 rounded-2xl border-2 border-dashed transition flex flex-col items-center justify-center cursor-pointer text-center relative overflow-hidden ${
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

                        {previewError && (
                            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4 shrink-0" />
                                <span>{previewError}</span>
                            </div>
                        )}
                    </div>

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
                                        onClick={handleCommitImport}
                                        disabled={uploadForm.processing}
                                        className="py-2 px-5 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white transition flex items-center gap-2 shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                                    >
                                        {uploadForm.processing ? (
                                            <>
                                                <RefreshCw className="w-4 h-4 animate-spin" />
                                                Committing Punches...
                                            </>
                                        ) : (
                                            <>
                                                <Check className="w-4 h-4" />
                                                Commit {previewData.mapped_count} Punches
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

            {/* Configurable Biometric Device Profile Wizard Modal */}
            <BiometricProfileModal
                isOpen={isProfileModalOpen}
                onClose={() => setIsProfileModalOpen(false)}
                onSaved={handleProfileSaved}
                editingProfile={editingProfile}
            />
            </div>
        </AuthenticatedLayout>
    );
}
