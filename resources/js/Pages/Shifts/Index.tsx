import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Head, useForm, router, Link } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import {
    Clock,
    Plus,
    Edit2,
    Trash2,
    Users,
    Sparkles,
    Calendar,
    Sun,
    Moon,
    RotateCw,
    CheckCircle2,
    AlertCircle,
    AlertTriangle,
    X,
    UserCheck,
    Coffee,
    ShieldAlert,
    ChevronRight,
    ChevronDown,
    Search,
    UserMinus,
    Fingerprint,
    CalendarRange,
    Check,
    Info,
} from 'lucide-react';

interface Shift {
    id: string;
    tenant_id: string;
    name: string;
    code: string;
    shift_type: string;
    start_time: string;
    end_time: string;
    break_minutes: number;
    grace_minutes: number;
    ot_threshold_minutes: number;
    is_night_shift: boolean;
    in_window_before_start?: number;
    in_window_after_start?: number;
    out_window_before_end?: number;
    out_window_after_end?: number;
    first_half_end_time?: string | null;
    second_half_start_time?: string | null;
    early_in_as_ot?: boolean;
    early_in_as_att_in?: boolean;
    ot_start_time?: string | null;
    working_minutes?: number | null;
    color: string | null;
    description: string | null;
    is_active: boolean;
    assignments_count?: number;
}

interface EmployeeAssignment {
    id: string;
    emp_no: string;
    full_name: string;
    department?: { id: string; name: string } | null;
    shift_assignments?: {
        id: string;
        effective_from: string;
        effective_to: string | null;
        shift: { id: string; name: string; code: string; color: string | null };
    }[];
}

interface Props {
    shifts: Shift[];
    employees: EmployeeAssignment[];
    stats: {
        total_shifts: number;
        active_shifts: number;
        night_shifts: number;
        rotational_shifts: number;
        total_assignments: number;
    };
}

export default function Index({ shifts, employees, stats }: Props) {
    const [activeTab, setActiveTab] = useState<'shifts' | 'assignments'>('shifts');
    const [filterType, setFilterType] = useState<string>('all');
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [assignmentSearch, setAssignmentSearch] = useState('');

    // Modal States
    const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
    const [shiftModalTab, setShiftModalTab] = useState<'basic' | 'schedule' | 'biometrics'>('basic');
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const [editingShift, setEditingShift] = useState<Shift | null>(null);
    const [selectedShiftForAssign, setSelectedShiftForAssign] = useState<Shift | null>(null);

    // Confirmation Dialog States
    const [shiftToDelete, setShiftToDelete] = useState<Shift | null>(null);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

    const [assignmentToDelete, setAssignmentToDelete] = useState<{ id: string; empName: string; shiftName: string } | null>(null);
    const [isDeleteAssignmentModalOpen, setIsDeleteAssignmentModalOpen] = useState(false);

    const [isSeedModalOpen, setIsSeedModalOpen] = useState(false);

    // Action menu dropdown state
    const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);
    const actionMenuRef = useRef<HTMLDivElement | null>(null);

    // Bulk Assignment States
    const [assignMode, setAssignMode] = useState<'single' | 'bulk'>('single');
    const [selectedBulkEmpIds, setSelectedBulkEmpIds] = useState<string[]>([]);
    const [bulkEmpSearch, setBulkEmpSearch] = useState('');
    const [bulkDeptFilter, setBulkDeptFilter] = useState('all');

    // Close action dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (actionMenuRef.current && !actionMenuRef.current.contains(event.target as Node)) {
                setOpenActionMenuId(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Form for Shift create/edit
    const shiftForm = useForm({
        name: '',
        code: '',
        shift_type: 'regular',
        start_time: '08:30',
        end_time: '17:00',
        break_minutes: 60,
        grace_minutes: 10,
        ot_threshold_minutes: 480,
        is_night_shift: false,
        in_window_before_start: 60,
        in_window_after_start: 120,
        out_window_before_end: 120,
        out_window_after_end: 180,
        first_half_end_time: '',
        second_half_start_time: '',
        early_in_as_ot: false,
        early_in_as_att_in: true,
        ot_start_time: '',
        working_minutes: 0,
        color: '#3B82F6',
        description: '',
        is_active: true,
    });

    // Form for Shift Assignment
    const assignForm = useForm({
        employee_id: '',
        shift_id: '',
        effective_from: new Date().toISOString().split('T')[0],
        effective_to: '',
    });

    const openCreateModal = () => {
        setEditingShift(null);
        setShiftModalTab('basic');
        shiftForm.setData({
            name: '',
            code: '',
            shift_type: 'regular',
            start_time: '08:30',
            end_time: '17:00',
            break_minutes: 60,
            grace_minutes: 10,
            ot_threshold_minutes: 480,
            is_night_shift: false,
            in_window_before_start: 60,
            in_window_after_start: 120,
            out_window_before_end: 120,
            out_window_after_end: 180,
            first_half_end_time: '',
            second_half_start_time: '',
            early_in_as_ot: false,
            early_in_as_att_in: true,
            ot_start_time: '',
            working_minutes: 0,
            color: '#3B82F6',
            description: '',
            is_active: true,
        });
        setIsShiftModalOpen(true);
    };

    const openEditModal = (shift: Shift) => {
        setEditingShift(shift);
        setShiftModalTab('basic');
        setOpenActionMenuId(null);
        shiftForm.setData({
            name: shift.name,
            code: shift.code,
            shift_type: shift.shift_type,
            start_time: shift.start_time.substring(0, 5),
            end_time: shift.end_time.substring(0, 5),
            break_minutes: shift.break_minutes,
            grace_minutes: shift.grace_minutes,
            ot_threshold_minutes: shift.ot_threshold_minutes,
            is_night_shift: Boolean(shift.is_night_shift),
            in_window_before_start: shift.in_window_before_start ?? 60,
            in_window_after_start: shift.in_window_after_start ?? 120,
            out_window_before_end: shift.out_window_before_end ?? 120,
            out_window_after_end: shift.out_window_after_end ?? 180,
            first_half_end_time: shift.first_half_end_time ? shift.first_half_end_time.substring(0, 5) : '',
            second_half_start_time: shift.second_half_start_time ? shift.second_half_start_time.substring(0, 5) : '',
            early_in_as_ot: Boolean(shift.early_in_as_ot),
            early_in_as_att_in: shift.early_in_as_att_in !== undefined ? Boolean(shift.early_in_as_att_in) : true,
            ot_start_time: shift.ot_start_time ? shift.ot_start_time.substring(0, 5) : '',
            working_minutes: shift.working_minutes ?? 0,
            color: shift.color || '#3B82F6',
            description: shift.description || '',
            is_active: Boolean(shift.is_active),
        });
        setIsShiftModalOpen(true);
    };

    const handleShiftSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (editingShift) {
            shiftForm.put(`/shifts/${editingShift.id}`, {
                preserveScroll: true,
                onSuccess: () => setIsShiftModalOpen(false),
            });
        } else {
            shiftForm.post('/shifts', {
                preserveScroll: true,
                onSuccess: () => setIsShiftModalOpen(false),
            });
        }
    };

    const confirmDeleteShift = (shift: Shift) => {
        setShiftToDelete(shift);
        setOpenActionMenuId(null);
        setIsDeleteModalOpen(true);
    };

    const executeDeleteShift = () => {
        if (!shiftToDelete) return;
        router.delete(`/shifts/${shiftToDelete.id}`, {
            preserveScroll: true,
            onSuccess: () => {
                setIsDeleteModalOpen(false);
                setShiftToDelete(null);
            },
        });
    };

    const executeSeedPresets = () => {
        router.post('/shifts/seed-presets', {}, {
            preserveScroll: true,
            onSuccess: () => {
                setIsSeedModalOpen(false);
            },
        });
    };

    const openAssignModal = (shift?: Shift) => {
        setSelectedShiftForAssign(shift || null);
        setSelectedBulkEmpIds([]);
        setAssignMode('single');
        setOpenActionMenuId(null);
        assignForm.setData({
            employee_id: employees.length > 0 ? employees[0].id : '',
            shift_id: shift ? shift.id : shifts.length > 0 ? shifts[0].id : '',
            effective_from: new Date().toISOString().split('T')[0],
            effective_to: '',
        });
        setIsAssignModalOpen(true);
    };

    const handleAssignSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (assignMode === 'bulk') {
            if (selectedBulkEmpIds.length === 0) {
                return;
            }
            router.post('/shifts/assign', {
                employee_ids: selectedBulkEmpIds,
                shift_id: assignForm.data.shift_id,
                effective_from: assignForm.data.effective_from,
                effective_to: assignForm.data.effective_to || null,
            }, {
                preserveScroll: true,
                onSuccess: () => {
                    setIsAssignModalOpen(false);
                    setSelectedBulkEmpIds([]);
                },
            });
        } else {
            assignForm.post('/shifts/assign', {
                preserveScroll: true,
                onSuccess: () => setIsAssignModalOpen(false),
            });
        }
    };

    const confirmRemoveAssignment = (id: string, empName: string, shiftName: string) => {
        setAssignmentToDelete({ id, empName, shiftName });
        setIsDeleteAssignmentModalOpen(true);
    };

    const executeRemoveAssignment = () => {
        if (!assignmentToDelete) return;
        router.delete(`/shifts/assignments/${assignmentToDelete.id}`, {
            preserveScroll: true,
            onSuccess: () => {
                setIsDeleteAssignmentModalOpen(false);
                setAssignmentToDelete(null);
            },
        });
    };

    const uniqueDepartments = useMemo(() => {
        const depts = new Map<string, { id: string; name: string }>();
        employees.forEach((emp) => {
            if (emp.department) {
                depts.set(emp.department.id, emp.department);
            }
        });
        return Array.from(depts.values());
    }, [employees]);

    const filteredBulkEmployees = useMemo(() => {
        return employees.filter((emp) => {
            const matchesSearch =
                emp.full_name.toLowerCase().includes(bulkEmpSearch.toLowerCase()) ||
                emp.emp_no.toLowerCase().includes(bulkEmpSearch.toLowerCase());
            const matchesDept = bulkDeptFilter === 'all' || emp.department?.id === bulkDeptFilter;
            return matchesSearch && matchesDept;
        });
    }, [employees, bulkEmpSearch, bulkDeptFilter]);

    const filteredShifts = useMemo(() => {
        return shifts.filter((shift) => {
            const matchesType = filterType === 'all' || shift.shift_type === filterType;
            const matchesStatus =
                statusFilter === 'all' ||
                (statusFilter === 'active' && shift.is_active) ||
                (statusFilter === 'inactive' && !shift.is_active);
            const q = searchQuery.toLowerCase().trim();
            const matchesQuery =
                !q ||
                shift.name.toLowerCase().includes(q) ||
                shift.code.toLowerCase().includes(q) ||
                (shift.description && shift.description.toLowerCase().includes(q));
            return matchesType && matchesStatus && matchesQuery;
        });
    }, [shifts, filterType, statusFilter, searchQuery]);

    const calculateDuration = (start: string, end: string, isNight: boolean): string => {
        try {
            const [sh, sm] = start.substring(0, 5).split(':').map(Number);
            const [eh, em] = end.substring(0, 5).split(':').map(Number);
            let startMins = sh * 60 + sm;
            let endMins = eh * 60 + em;
            if (endMins < startMins || isNight) {
                endMins += 24 * 60;
            }
            const diff = endMins - startMins;
            const hrs = Math.floor(diff / 60);
            const mins = diff % 60;
            return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
        } catch {
            return '—';
        }
    };

    const getShiftTypeBadge = (type: string, isNight: boolean) => {
        if (isNight) {
            return (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium bg-purple-500/10 text-purple-300 border border-purple-500/20">
                    <Moon className="w-3 h-3 text-purple-400" /> Night Shift
                </span>
            );
        }
        switch (type) {
            case 'rotational':
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium bg-amber-500/10 text-amber-300 border border-amber-500/20">
                        <RotateCw className="w-3 h-3 text-amber-400" /> Rotational
                    </span>
                );
            case 'half_day':
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium bg-pink-500/10 text-pink-300 border border-pink-500/20">
                        <Clock className="w-3 h-3 text-pink-400" /> Half Day
                    </span>
                );
            case 'flexible':
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                        <Sparkles className="w-3 h-3 text-cyan-400" /> Flexible
                    </span>
                );
            default:
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium bg-sky-500/10 text-sky-300 border border-sky-500/20">
                        <Sun className="w-3 h-3 text-sky-400" /> Regular Day
                    </span>
                );
        }
    };

    return (
        <AuthenticatedLayout title="Shift Definitions & Baseline Schedules" backUrl="/dashboard">
            <Head title="Shift Definitions" />

            <div className="max-w-7xl mx-auto space-y-6">
                {/* Header & Subnavigation Bar */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-600 via-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                            <Clock className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-xl font-bold tracking-tight text-white">
                                    Shift Definitions & Baseline Schedules
                                </h1>
                                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                                    M02 AMS
                                </span>
                            </div>
                            <p className="text-xs text-slate-400">
                                Master shift hours, grace windows, biometric punch rules, and permanent contractual defaults
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5">
                        <Link
                            href="/roster"
                            className="text-xs font-semibold text-white px-3.5 py-2 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-sky-600 hover:from-purple-500 hover:to-sky-500 shadow-md shadow-indigo-500/20 transition flex items-center gap-1.5"
                            title="Open interactive monthly Duty Roster planner"
                        >
                            <CalendarRange className="w-4 h-4" />
                            Duty Roster
                        </Link>
                        <Link
                            href="/roster/patterns"
                            className="text-xs font-semibold text-indigo-300 px-3.5 py-2 rounded-xl bg-indigo-950/60 hover:bg-indigo-900/60 border border-indigo-500/30 transition flex items-center gap-1.5 shadow-sm"
                            title="Manage reusable Roster Patterns & Templates"
                        >
                            <Sparkles className="w-4 h-4 text-indigo-400" />
                            Roster Patterns
                        </Link>
                        <Link
                            href="/work-calendar"
                            className="text-xs font-medium text-slate-300 hover:text-white px-3 py-1.5 rounded-lg border border-slate-800 hover:border-slate-700 bg-slate-900/60 transition flex items-center gap-1.5"
                        >
                            <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                            Calendar
                        </Link>
                        <button
                            type="button"
                            onClick={() => setIsSeedModalOpen(true)}
                            className="text-xs font-medium text-amber-300 hover:text-amber-200 px-3 py-2 rounded-xl border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 transition flex items-center gap-1.5"
                            title="Load standard Sri Lankan shift templates"
                        >
                            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                            Presets
                        </button>
                        <button
                            type="button"
                            onClick={() => openAssignModal()}
                            className="text-xs font-semibold text-indigo-200 hover:text-white px-3.5 py-2 rounded-xl border border-indigo-500/40 bg-indigo-900/40 hover:bg-indigo-800/50 transition flex items-center gap-1.5"
                        >
                            <UserCheck className="w-4 h-4 text-indigo-400" />
                            Assign Shift
                        </button>
                        <button
                            type="button"
                            onClick={openCreateModal}
                            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-indigo-600/20 transition"
                        >
                            <Plus className="w-4 h-4" />
                            Add Shift
                        </button>
                    </div>
                </div>

                {/* Metric Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
                    <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800/80 shadow-sm">
                        <span className="text-xs text-slate-400 font-medium">Total Shifts</span>
                        <div className="text-2xl font-bold text-white mt-0.5">{stats.total_shifts}</div>
                        <span className="text-[10px] text-slate-500">Configured in tenant</span>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800/80 shadow-sm">
                        <span className="text-xs text-emerald-400 font-medium">Active Definitions</span>
                        <div className="text-2xl font-bold text-emerald-400 mt-0.5">{stats.active_shifts}</div>
                        <span className="text-[10px] text-slate-500">Available for assignment</span>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800/80 shadow-sm">
                        <span className="text-xs text-purple-400 font-medium">Night Shifts</span>
                        <div className="text-2xl font-bold text-purple-400 mt-0.5">{stats.night_shifts}</div>
                        <span className="text-[10px] text-slate-500">Cross-midnight hours</span>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800/80 shadow-sm">
                        <span className="text-xs text-amber-400 font-medium">Rotational Cycles</span>
                        <div className="text-2xl font-bold text-amber-400 mt-0.5">{stats.rotational_shifts}</div>
                        <span className="text-[10px] text-slate-500">Roster template base</span>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800/80 shadow-sm">
                        <span className="text-xs text-sky-400 font-medium">Baseline Assigned</span>
                        <div className="text-2xl font-bold text-sky-400 mt-0.5">{stats.total_assignments}</div>
                        <span className="text-[10px] text-slate-500">Fixed schedule staff</span>
                    </div>
                </div>

                {/* View Tabs */}
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setActiveTab('shifts')}
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                                activeTab === 'shifts'
                                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                                    : 'bg-slate-900/80 text-slate-400 hover:text-white border border-slate-800'
                            }`}
                        >
                            <Clock className="w-4 h-4" />
                            <span>Shift Master Catalog ({shifts.length})</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('assignments')}
                            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                                activeTab === 'assignments'
                                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                                    : 'bg-slate-900/80 text-slate-400 hover:text-white border border-slate-800'
                            }`}
                        >
                            <Users className="w-4 h-4" />
                            <span>Baseline Assignments ({stats.total_assignments})</span>
                        </button>
                    </div>

                    {activeTab === 'shifts' && (
                        <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400">
                            <span>Showing <strong className="text-white">{filteredShifts.length}</strong> of {shifts.length} shifts</span>
                        </div>
                    )}
                </div>

                {/* TAB 1: SHIFT MASTER CATALOG (TRADITIONAL TABLE VIEW) */}
                {activeTab === 'shifts' && (
                    <div className="space-y-4">
                        {/* Table Toolbar & Filters */}
                        <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800/80 flex flex-col md:flex-row items-center justify-between gap-3">
                            <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
                                {/* Search Box */}
                                <div className="relative flex-1 md:w-64">
                                    <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                                    <input
                                        type="text"
                                        placeholder="Search by name, code..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                                    />
                                    {searchQuery && (
                                        <button
                                            type="button"
                                            onClick={() => setSearchQuery('')}
                                            className="absolute right-2.5 top-2 text-slate-500 hover:text-slate-300 text-xs"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </div>

                                {/* Shift Type Filter */}
                                <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
                                    {(['all', 'regular', 'rotational', 'night', 'half_day', 'flexible'] as const).map((type) => (
                                        <button
                                            key={type}
                                            type="button"
                                            onClick={() => setFilterType(type)}
                                            className={`px-2.5 py-1 rounded-lg capitalize font-medium text-[11px] transition ${
                                                filterType === type
                                                    ? 'bg-indigo-600 text-white'
                                                    : 'text-slate-400 hover:text-slate-200'
                                            }`}
                                        >
                                            {type === 'half_day' ? 'Half-Day' : type}
                                        </button>
                                    ))}
                                </div>

                                {/* Status Filter */}
                                <select
                                    value={statusFilter}
                                    onChange={(e) => setStatusFilter(e.target.value as any)}
                                    className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
                                >
                                    <option value="all">All Statuses</option>
                                    <option value="active">Active Only</option>
                                    <option value="inactive">Inactive Only</option>
                                </select>
                            </div>

                            <div className="flex items-center gap-2 self-end md:self-auto">
                                <button
                                    type="button"
                                    onClick={openCreateModal}
                                    className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition"
                                >
                                    <Plus className="w-3.5 h-3.5" />
                                    <span>New Shift</span>
                                </button>
                            </div>
                        </div>

                        {/* Traditional Data Table */}
                        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 overflow-hidden shadow-xl">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs">
                                    <thead className="border-b border-slate-800 bg-slate-950/70 text-slate-400 uppercase text-[10px] tracking-wider font-semibold">
                                        <tr>
                                            <th className="py-3.5 px-4">Shift Details</th>
                                            <th className="py-3.5 px-4">Type</th>
                                            <th className="py-3.5 px-4">Working Hours</th>
                                            <th className="py-3.5 px-4">Break & Grace</th>
                                            <th className="py-3.5 px-4">Overtime</th>
                                            <th className="py-3.5 px-4">Biometric Windows</th>
                                            <th className="py-3.5 px-4 text-center">Assigned</th>
                                            <th className="py-3.5 px-4 text-center">Status</th>
                                            <th className="py-3.5 px-4 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800/60">
                                        {filteredShifts.map((shift) => {
                                            const duration = calculateDuration(shift.start_time, shift.end_time, shift.is_night_shift);
                                            const otHours = Math.floor(shift.ot_threshold_minutes / 60);
                                            const otMins = shift.ot_threshold_minutes % 60;

                                            return (
                                                <tr key={shift.id} className="hover:bg-slate-800/30 transition group">
                                                    {/* Shift Name & Code */}
                                                    <td className="py-3.5 px-4">
                                                        <div className="flex items-center gap-3">
                                                            <div
                                                                className="w-3.5 h-3.5 rounded-full flex-shrink-0 shadow-sm border border-white/20"
                                                                style={{ backgroundColor: shift.color || '#3B82F6' }}
                                                                title={`Color: ${shift.color || '#3B82F6'}`}
                                                            />
                                                            <div>
                                                                <div className="flex items-center gap-2">
                                                                    <span className="font-semibold text-white text-sm">
                                                                        {shift.name}
                                                                    </span>
                                                                    <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-950 text-indigo-300 border border-slate-800 font-bold">
                                                                        {shift.code}
                                                                    </span>
                                                                </div>
                                                                {shift.description && (
                                                                    <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1 max-w-xs">
                                                                        {shift.description}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </td>

                                                    {/* Classification */}
                                                    <td className="py-3.5 px-4 whitespace-nowrap">
                                                        {getShiftTypeBadge(shift.shift_type, shift.is_night_shift)}
                                                    </td>

                                                    {/* Working Hours */}
                                                    <td className="py-3.5 px-4 whitespace-nowrap">
                                                        <div className="font-semibold text-slate-200 font-mono text-xs flex items-center gap-1.5">
                                                            <Clock className="w-3.5 h-3.5 text-indigo-400" />
                                                            <span>
                                                                {shift.start_time.substring(0, 5)} — {shift.end_time.substring(0, 5)}
                                                            </span>
                                                        </div>
                                                        <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1.5">
                                                            <span>Duration: <strong className="text-slate-300">{duration}</strong></span>
                                                            {shift.is_night_shift && (
                                                                <span className="text-purple-400 font-medium">• Overnight</span>
                                                            )}
                                                        </div>
                                                    </td>

                                                    {/* Break & Grace */}
                                                    <td className="py-3.5 px-4 whitespace-nowrap text-slate-300 text-xs">
                                                        <div className="flex items-center gap-2">
                                                            <span className="inline-flex items-center gap-1 text-[11px] text-slate-300">
                                                                <Coffee className="w-3 h-3 text-amber-400" />
                                                                {shift.break_minutes}m break
                                                            </span>
                                                        </div>
                                                        <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1">
                                                            <ShieldAlert className="w-3 h-3 text-emerald-400" />
                                                            Grace: {shift.grace_minutes}m
                                                        </div>
                                                    </td>

                                                    {/* Overtime Policy */}
                                                    <td className="py-3.5 px-4 whitespace-nowrap text-slate-300 text-xs">
                                                        <span className="font-medium text-slate-200">
                                                            &gt; {otHours}h {otMins > 0 ? `${otMins}m` : ''}
                                                        </span>
                                                        <div className="text-[10px] text-slate-400 mt-0.5">
                                                            {shift.early_in_as_ot ? (
                                                                <span className="text-indigo-300 font-medium">Early In as OT</span>
                                                            ) : (
                                                                <span>Standard Day OT</span>
                                                            )}
                                                        </div>
                                                    </td>

                                                    {/* Biometric Sliding Windows */}
                                                    <td className="py-3.5 px-4 whitespace-nowrap text-[11px] font-mono text-slate-400">
                                                        <div className="flex items-center gap-1.5">
                                                            <Fingerprint className="w-3.5 h-3.5 text-indigo-400" />
                                                            <span>IN: -{shift.in_window_before_start ?? 60}m / +{shift.in_window_after_start ?? 120}m</span>
                                                        </div>
                                                        <div className="text-[10px] text-slate-500 pl-5">
                                                            OUT: -{shift.out_window_before_end ?? 120}m / +{shift.out_window_after_end ?? 180}m
                                                        </div>
                                                    </td>

                                                    {/* Assigned Staff */}
                                                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setActiveTab('assignments');
                                                                setAssignmentSearch(shift.code);
                                                            }}
                                                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition"
                                                            title="View assigned personnel"
                                                        >
                                                            <Users className="w-3 h-3 text-indigo-400" />
                                                            <span>{shift.assignments_count ?? 0}</span>
                                                        </button>
                                                    </td>

                                                    {/* Status */}
                                                    <td className="py-3.5 px-4 text-center whitespace-nowrap">
                                                        {shift.is_active ? (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                                                <Check className="w-3 h-3" /> Active
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                                                                Inactive
                                                            </span>
                                                        )}
                                                    </td>

                                                    {/* Actions Column */}
                                                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                                                        <div className="flex items-center justify-end gap-1.5">
                                                            <button
                                                                type="button"
                                                                onClick={() => openEditModal(shift)}
                                                                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                                                                title="Edit Shift"
                                                            >
                                                                <Edit2 className="w-4 h-4" />
                                                            </button>

                                                            {/* Dropdown Action Button */}
                                                            <div className="relative inline-block text-left" ref={openActionMenuId === shift.id ? actionMenuRef : null}>
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setOpenActionMenuId(openActionMenuId === shift.id ? null : shift.id);
                                                                    }}
                                                                    className="px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1 transition border border-slate-700/60"
                                                                >
                                                                    <span>Actions</span>
                                                                    <ChevronDown className="w-3 h-3 text-slate-400" />
                                                                </button>

                                                                {openActionMenuId === shift.id && (
                                                                    <div className="absolute right-0 mt-1.5 w-44 rounded-xl bg-slate-900 border border-slate-700 shadow-2xl py-1 z-30 divide-y divide-slate-800">
                                                                        <div className="py-1">
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => openEditModal(shift)}
                                                                                className="w-full text-left px-3.5 py-2 text-xs text-slate-200 hover:bg-slate-800 flex items-center gap-2"
                                                                            >
                                                                                <Edit2 className="w-3.5 h-3.5 text-indigo-400" />
                                                                                <span>Edit Shift</span>
                                                                            </button>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => openAssignModal(shift)}
                                                                                className="w-full text-left px-3.5 py-2 text-xs text-slate-200 hover:bg-slate-800 flex items-center gap-2"
                                                                            >
                                                                                <UserCheck className="w-3.5 h-3.5 text-sky-400" />
                                                                                <span>Assign Staff</span>
                                                                            </button>
                                                                        </div>
                                                                        <div className="py-1">
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => confirmDeleteShift(shift)}
                                                                                className="w-full text-left px-3.5 py-2 text-xs text-rose-400 hover:bg-rose-500/10 flex items-center gap-2"
                                                                            >
                                                                                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                                                                                <span>Delete Shift</span>
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}

                                        {filteredShifts.length === 0 && (
                                            <tr>
                                                <td colSpan={9} className="py-16 text-center text-slate-400">
                                                    <Clock className="w-12 h-12 mx-auto text-slate-600 mb-3" />
                                                    <h3 className="text-base font-semibold text-white">No Shifts Found</h3>
                                                    <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                                                        {searchQuery || filterType !== 'all' || statusFilter !== 'all'
                                                            ? 'No shifts matched your active search or filter criteria. Try resetting filters.'
                                                            : 'No shift definitions are configured yet. Populate standard presets or create a custom shift.'}
                                                    </p>
                                                    <div className="mt-4 flex items-center justify-center gap-3">
                                                        <button
                                                            type="button"
                                                            onClick={() => setIsSeedModalOpen(true)}
                                                            className="px-4 py-2 rounded-xl bg-amber-600/20 text-amber-300 border border-amber-500/30 text-xs font-semibold hover:bg-amber-600/30 transition"
                                                        >
                                                            Populate SL Presets
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={openCreateModal}
                                                            className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-500 transition"
                                                        >
                                                            Create First Shift
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {/* TAB 2: BASELINE CONTRACTUAL ASSIGNMENTS */}
                {activeTab === 'assignments' && (
                    <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-5">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div>
                                <h3 className="text-base font-bold text-white">Permanent Baseline Assignments</h3>
                                <p className="text-xs text-slate-400 mt-0.5">
                                    Fixed permanent shifts assigned to contractual staff (e.g. 9–5 office personnel). Rotational staff use the Duty Roster Planner.
                                </p>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="relative w-64">
                                    <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                                    <input
                                        type="text"
                                        placeholder="Filter staff, emp no, department..."
                                        value={assignmentSearch}
                                        onChange={(e) => setAssignmentSearch(e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                                    />
                                    {assignmentSearch && (
                                        <button
                                            type="button"
                                            onClick={() => setAssignmentSearch('')}
                                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => openAssignModal()}
                                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/20 transition flex items-center gap-1.5 whitespace-nowrap"
                                >
                                    <Plus className="w-4 h-4" />
                                    <span>Assign Baseline Shift</span>
                                </button>
                            </div>
                        </div>

                        <div className="rounded-xl border border-slate-800/80 overflow-hidden bg-slate-950/40">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs text-slate-300">
                                    <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                                        <tr>
                                            <th className="px-4 py-3">Emp No</th>
                                            <th className="px-4 py-3">Employee Name</th>
                                            <th className="px-4 py-3">Department</th>
                                            <th className="px-4 py-3">Assigned Shift</th>
                                            <th className="px-4 py-3">Effective Range</th>
                                            <th className="px-4 py-3 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800/60">
                                        {employees
                                            .filter((e) => e.shift_assignments && e.shift_assignments.length > 0)
                                            .filter((e) => {
                                                if (!assignmentSearch) return true;
                                                const q = assignmentSearch.toLowerCase();
                                                return (
                                                    e.full_name.toLowerCase().includes(q) ||
                                                    e.emp_no.toLowerCase().includes(q) ||
                                                    (e.department?.name && e.department.name.toLowerCase().includes(q)) ||
                                                    e.shift_assignments?.some(
                                                        (a) =>
                                                            a.shift.name.toLowerCase().includes(q) ||
                                                            a.shift.code.toLowerCase().includes(q)
                                                    )
                                                );
                                            })
                                            .map((emp) =>
                                                emp.shift_assignments?.map((assignment) => (
                                                    <tr key={assignment.id} className="hover:bg-slate-800/30 transition">
                                                        <td className="px-4 py-3 font-mono font-bold text-indigo-400">
                                                            {emp.emp_no}
                                                        </td>
                                                        <td className="px-4 py-3 font-semibold text-slate-200">
                                                            {emp.full_name}
                                                        </td>
                                                        <td className="px-4 py-3 text-slate-400">
                                                            {emp.department?.name || '—'}
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <span
                                                                className="px-2.5 py-1 rounded-md text-xs font-semibold text-white border"
                                                                style={{
                                                                    backgroundColor: `${assignment.shift.color || '#3B82F6'}22`,
                                                                    borderColor: assignment.shift.color || '#3B82F6',
                                                                }}
                                                            >
                                                                {assignment.shift.name} ({assignment.shift.code})
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 text-slate-400 font-mono text-xs">
                                                            {assignment.effective_from} → {assignment.effective_to || 'Ongoing'}
                                                        </td>
                                                        <td className="px-4 py-3 text-right">
                                                            <button
                                                                type="button"
                                                                onClick={() =>
                                                                    confirmRemoveAssignment(
                                                                        assignment.id,
                                                                        emp.full_name,
                                                                        assignment.shift.name
                                                                    )
                                                                }
                                                                title="Remove Shift Assignment"
                                                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}

                                        {employees.filter((e) => e.shift_assignments && e.shift_assignments.length > 0).length === 0 && (
                                            <tr>
                                                <td colSpan={6} className="px-4 py-12 text-center text-slate-500">
                                                    <Users className="w-10 h-10 mx-auto text-slate-600 mb-2" />
                                                    <p className="text-sm text-slate-400">No baseline shift assignments registered yet.</p>
                                                    <p className="text-xs text-slate-500 mt-1">Click "Assign Baseline Shift" above to map staff to permanent shifts.</p>
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* ========================================================= */}
            {/* DIALOG BOX 1: CREATE / EDIT SHIFT (TABBED, STREAMLINED) */}
            {/* ========================================================= */}
            {isShiftModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
                    <div className="w-full max-w-2xl rounded-3xl bg-slate-900 border border-slate-800 p-6 shadow-2xl relative max-h-[90vh] flex flex-col">
                        {/* Dialog Header */}
                        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center">
                                    <Clock className="w-5 h-5 text-indigo-400" />
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-white">
                                        {editingShift ? `Edit Shift: ${editingShift.name}` : 'Create New Shift'}
                                    </h3>
                                    <p className="text-xs text-slate-400">
                                        Configure schedule, OT thresholds, and biometric tolerance windows
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsShiftModalOpen(false)}
                                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Dialog Navigation Tabs */}
                        <div className="flex items-center gap-2 pt-4 pb-2 border-b border-slate-800/80">
                            <button
                                type="button"
                                onClick={() => setShiftModalTab('basic')}
                                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition ${
                                    shiftModalTab === 'basic'
                                        ? 'bg-indigo-600 text-white shadow-sm'
                                        : 'text-slate-400 hover:text-white bg-slate-950/50 border border-slate-800'
                                }`}
                            >
                                1. General Details
                            </button>
                            <button
                                type="button"
                                onClick={() => setShiftModalTab('schedule')}
                                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition ${
                                    shiftModalTab === 'schedule'
                                        ? 'bg-indigo-600 text-white shadow-sm'
                                        : 'text-slate-400 hover:text-white bg-slate-950/50 border border-slate-800'
                                }`}
                            >
                                2. Schedule & Overtime
                            </button>
                            <button
                                type="button"
                                onClick={() => setShiftModalTab('biometrics')}
                                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition ${
                                    shiftModalTab === 'biometrics'
                                        ? 'bg-indigo-600 text-white shadow-sm'
                                        : 'text-slate-400 hover:text-white bg-slate-950/50 border border-slate-800'
                                }`}
                            >
                                3. Biometric Precision Windows
                            </button>
                        </div>

                        {/* Dialog Body Form */}
                        <form onSubmit={handleShiftSubmit} className="flex-1 overflow-y-auto pt-4 space-y-4 pr-1">
                            {/* TAB 1: BASIC DETAILS */}
                            {shiftModalTab === 'basic' && (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                        <div className="sm:col-span-2">
                                            <label className="block text-xs font-semibold text-slate-300 mb-1">
                                                Shift Name *
                                            </label>
                                            <input
                                                type="text"
                                                value={shiftForm.data.name}
                                                onChange={(e) => shiftForm.setData('name', e.target.value)}
                                                required
                                                placeholder="e.g. General Day Shift"
                                                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                                            />
                                            {shiftForm.errors.name && (
                                                <span className="text-[11px] text-rose-400 mt-1 block">{shiftForm.errors.name}</span>
                                            )}
                                        </div>

                                        <div>
                                            <label className="block text-xs font-semibold text-slate-300 mb-1">
                                                Shift Code *
                                            </label>
                                            <input
                                                type="text"
                                                value={shiftForm.data.code}
                                                onChange={(e) => shiftForm.setData('code', e.target.value.toUpperCase())}
                                                required
                                                placeholder="GEN-DAY"
                                                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white uppercase focus:outline-none focus:border-indigo-500 font-mono font-bold"
                                            />
                                            {shiftForm.errors.code && (
                                                <span className="text-[11px] text-rose-400 mt-1 block">{shiftForm.errors.code}</span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-300 mb-1">
                                                Classification / Pattern Type
                                            </label>
                                            <select
                                                value={shiftForm.data.shift_type}
                                                onChange={(e) => shiftForm.setData('shift_type', e.target.value)}
                                                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                                            >
                                                <option value="regular">Regular Day Shift (Fixed)</option>
                                                <option value="rotational">Rotational Cycle Shift</option>
                                                <option value="night">Night Shift (Overnight)</option>
                                                <option value="half_day">Half-Day (Saturday)</option>
                                                <option value="flexible">Flexible Hours</option>
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-semibold text-slate-300 mb-1">
                                                Theme Color (Calendar & Roster Accent)
                                            </label>
                                            <div className="flex items-center gap-3">
                                                <input
                                                    type="color"
                                                    value={shiftForm.data.color || '#3B82F6'}
                                                    onChange={(e) => shiftForm.setData('color', e.target.value)}
                                                    className="w-11 h-9 bg-slate-950 border border-slate-800 rounded-xl cursor-pointer p-1"
                                                />
                                                <input
                                                    type="text"
                                                    value={shiftForm.data.color || '#3B82F6'}
                                                    onChange={(e) => shiftForm.setData('color', e.target.value)}
                                                    className="w-28 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white font-mono uppercase"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-semibold text-slate-300 mb-1">
                                            Description & Operational Scope
                                        </label>
                                        <textarea
                                            value={shiftForm.data.description}
                                            onChange={(e) => shiftForm.setData('description', e.target.value)}
                                            rows={2}
                                            placeholder="Applicable departments, contract clauses, or scheduling notes..."
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                                        />
                                    </div>

                                    <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between">
                                        <div>
                                            <div className="text-xs font-bold text-white">Shift Active Status</div>
                                            <div className="text-[11px] text-slate-400">
                                                Inactive shifts will be hidden from new roster planners and staff assignment
                                            </div>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={shiftForm.data.is_active}
                                                onChange={(e) => shiftForm.setData('is_active', e.target.checked)}
                                                className="sr-only peer"
                                            />
                                            <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                                        </label>
                                    </div>
                                </div>
                            )}

                            {/* TAB 2: SCHEDULE & OVERTIME */}
                            {shiftModalTab === 'schedule' && (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-300 mb-1">
                                                Start Time (HH:MM) *
                                            </label>
                                            <input
                                                type="time"
                                                value={shiftForm.data.start_time}
                                                onChange={(e) => shiftForm.setData('start_time', e.target.value)}
                                                required
                                                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white font-mono focus:outline-none focus:border-indigo-500"
                                            />
                                            {shiftForm.errors.start_time && (
                                                <span className="text-[11px] text-rose-400 mt-1 block">{shiftForm.errors.start_time}</span>
                                            )}
                                        </div>

                                        <div>
                                            <label className="block text-xs font-semibold text-slate-300 mb-1">
                                                End Time (HH:MM) *
                                            </label>
                                            <input
                                                type="time"
                                                value={shiftForm.data.end_time}
                                                onChange={(e) => shiftForm.setData('end_time', e.target.value)}
                                                required
                                                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white font-mono focus:outline-none focus:border-indigo-500"
                                            />
                                            {shiftForm.errors.end_time && (
                                                <span className="text-[11px] text-rose-400 mt-1 block">{shiftForm.errors.end_time}</span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-3 gap-4">
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-300 mb-1">
                                                Meal Break (Minutes)
                                            </label>
                                            <input
                                                type="number"
                                                value={shiftForm.data.break_minutes}
                                                onChange={(e) => shiftForm.setData('break_minutes', parseInt(e.target.value) || 0)}
                                                min="0"
                                                max="240"
                                                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 font-mono"
                                            />
                                            <span className="text-[10px] text-slate-500 mt-0.5 block">Deducted from gross duration</span>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-semibold text-slate-300 mb-1">
                                                Late Grace (Minutes)
                                            </label>
                                            <input
                                                type="number"
                                                value={shiftForm.data.grace_minutes}
                                                onChange={(e) => shiftForm.setData('grace_minutes', parseInt(e.target.value) || 0)}
                                                min="0"
                                                max="60"
                                                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 font-mono"
                                            />
                                            <span className="text-[10px] text-slate-500 mt-0.5 block">Permitted delay before tardy</span>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-semibold text-slate-300 mb-1">
                                                OT Threshold (Minutes)
                                            </label>
                                            <input
                                                type="number"
                                                value={shiftForm.data.ot_threshold_minutes}
                                                onChange={(e) => shiftForm.setData('ot_threshold_minutes', parseInt(e.target.value) || 0)}
                                                min="0"
                                                max="720"
                                                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 font-mono"
                                            />
                                            <span className="text-[10px] text-slate-500 mt-0.5 block">
                                                {Math.floor(shiftForm.data.ot_threshold_minutes / 60)}h{' '}
                                                {shiftForm.data.ot_threshold_minutes % 60}m standard day
                                            </span>
                                        </div>
                                    </div>

                                    <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-3">
                                        <label className="flex items-center gap-3 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={shiftForm.data.is_night_shift}
                                                onChange={(e) => shiftForm.setData('is_night_shift', e.target.checked)}
                                                className="w-4 h-4 rounded border-slate-700 text-indigo-600 focus:ring-0 focus:ring-offset-0 bg-slate-900"
                                            />
                                            <div>
                                                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                                                    <Moon className="w-3.5 h-3.5 text-purple-400" />
                                                    Night Shift (Crosses Midnight)
                                                </span>
                                                <p className="text-[11px] text-slate-400">
                                                    Enable if the shift begins on Day N and ends on Day N+1 (e.g., 20:00 to 05:00)
                                                </p>
                                            </div>
                                        </label>
                                    </div>
                                </div>
                            )}

                            {/* TAB 3: BIOMETRIC PRECISION WINDOWS */}
                            {shiftModalTab === 'biometrics' && (
                                <div className="space-y-4">
                                    <div className="p-3 rounded-xl bg-indigo-950/30 border border-indigo-500/20 text-xs text-indigo-200 flex items-start gap-2.5">
                                        <Info className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-0.5" />
                                        <span>
                                            Sliding punch windows prevent attendance collisions when employees punch early or late, ensuring biometric logs match this shift.
                                        </span>
                                    </div>

                                    <div>
                                        <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                                            Check-In Sliding Tolerances
                                        </h4>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                                                    Allow Punch In Before Start (Mins)
                                                </label>
                                                <input
                                                    type="number"
                                                    value={shiftForm.data.in_window_before_start}
                                                    onChange={(e) => shiftForm.setData('in_window_before_start', parseInt(e.target.value) || 0)}
                                                    min="0"
                                                    max="360"
                                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                                                    Allow Punch In After Start (Mins)
                                                </label>
                                                <input
                                                    type="number"
                                                    value={shiftForm.data.in_window_after_start}
                                                    onChange={(e) => shiftForm.setData('in_window_after_start', parseInt(e.target.value) || 0)}
                                                    min="0"
                                                    max="360"
                                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                                            Check-Out Sliding Tolerances
                                        </h4>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                                                    Allow Punch Out Before End (Mins)
                                                </label>
                                                <input
                                                    type="number"
                                                    value={shiftForm.data.out_window_before_end}
                                                    onChange={(e) => shiftForm.setData('out_window_before_end', parseInt(e.target.value) || 0)}
                                                    min="0"
                                                    max="360"
                                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                                                    Allow Punch Out After End (Mins)
                                                </label>
                                                <input
                                                    type="number"
                                                    value={shiftForm.data.out_window_after_end}
                                                    onChange={(e) => shiftForm.setData('out_window_after_end', parseInt(e.target.value) || 0)}
                                                    min="0"
                                                    max="360"
                                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="pt-2 border-t border-slate-800 space-y-2">
                                        <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-300">
                                            <input
                                                type="checkbox"
                                                checked={shiftForm.data.early_in_as_ot}
                                                onChange={(e) => shiftForm.setData('early_in_as_ot', e.target.checked)}
                                                className="w-4 h-4 rounded border-slate-700 text-indigo-600 focus:ring-0 focus:ring-offset-0 bg-slate-950"
                                            />
                                            Calculate Early Punch-In as Overtime
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-300">
                                            <input
                                                type="checkbox"
                                                checked={shiftForm.data.early_in_as_att_in}
                                                onChange={(e) => shiftForm.setData('early_in_as_att_in', e.target.checked)}
                                                className="w-4 h-4 rounded border-slate-700 text-indigo-600 focus:ring-0 focus:ring-offset-0 bg-slate-950"
                                            />
                                            Use Early Arrival Punch as Shift In-Time
                                        </label>
                                    </div>
                                </div>
                            )}

                            {/* Dialog Footer Actions */}
                            <div className="pt-5 border-t border-slate-800 flex items-center justify-between">
                                <div className="text-[11px] text-slate-500">
                                    Step {shiftModalTab === 'basic' ? '1' : shiftModalTab === 'schedule' ? '2' : '3'} of 3
                                </div>

                                <div className="flex items-center gap-2.5">
                                    <button
                                        type="button"
                                        onClick={() => setIsShiftModalOpen(false)}
                                        className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 rounded-xl hover:bg-slate-800 transition"
                                    >
                                        Cancel
                                    </button>

                                    {shiftModalTab !== 'biometrics' ? (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (shiftModalTab === 'basic') setShiftModalTab('schedule');
                                                else if (shiftModalTab === 'schedule') setShiftModalTab('biometrics');
                                            }}
                                            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold flex items-center gap-1.5 transition"
                                        >
                                            <span>Next</span>
                                            <ChevronRight className="w-3.5 h-3.5" />
                                        </button>
                                    ) : null}

                                    <button
                                        type="submit"
                                        disabled={shiftForm.processing}
                                        className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/20 disabled:opacity-50 transition"
                                    >
                                        {shiftForm.processing
                                            ? 'Saving...'
                                            : editingShift
                                            ? 'Update Shift'
                                            : 'Create Shift'}
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ========================================================= */}
            {/* DIALOG BOX 2: DELETE SHIFT CONFIRMATION MODAL */}
            {/* ========================================================= */}
            {isDeleteModalOpen && shiftToDelete && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
                    <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl space-y-4">
                        <div className="flex items-start gap-4">
                            <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center flex-shrink-0">
                                <AlertTriangle className="w-5 h-5 text-rose-400" />
                            </div>
                            <div className="flex-1">
                                <h3 className="text-base font-bold text-white">Delete Shift Definition</h3>
                                <p className="text-xs text-slate-400 mt-1">
                                    Are you sure you want to delete <strong className="text-white">"{shiftToDelete.name}"</strong> (<span className="font-mono text-indigo-300">{shiftToDelete.code}</span>)?
                                </p>
                            </div>
                        </div>

                        {(shiftToDelete.assignments_count ?? 0) > 0 && (
                            <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-500/30 text-xs text-rose-300 flex items-center gap-2">
                                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                <span>
                                    Warning: This shift is currently assigned to <strong>{shiftToDelete.assignments_count} staff member(s)</strong>. Deleting it will detach these assignments.
                                </span>
                            </div>
                        )}

                        <p className="text-xs text-slate-400">
                            This action cannot be undone. Any historical duty rosters referencing this shift definition will remain intact.
                        </p>

                        <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2.5">
                            <button
                                type="button"
                                onClick={() => {
                                    setIsDeleteModalOpen(false);
                                    setShiftToDelete(null);
                                }}
                                className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={executeDeleteShift}
                                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-lg shadow-rose-600/20 transition flex items-center gap-1.5"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Delete Shift</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ========================================================= */}
            {/* DIALOG BOX 3: SEED SRI LANKAN PRESETS CONFIRMATION MODAL */}
            {/* ========================================================= */}
            {isSeedModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
                    <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl space-y-4">
                        <div className="flex items-start gap-4">
                            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
                                <Sparkles className="w-5 h-5 text-amber-400" />
                            </div>
                            <div className="flex-1">
                                <h3 className="text-base font-bold text-white">Populate Sri Lankan Presets</h3>
                                <p className="text-xs text-slate-400 mt-1">
                                    Load industry standard Sri Lankan shift models into your tenant:
                                </p>
                            </div>
                        </div>

                        <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-xs text-slate-300 space-y-1.5 font-mono">
                            <div className="flex items-center justify-between">
                                <span>• General Day (08:30 – 17:00)</span>
                                <span className="text-slate-500 text-[10px]">8h 30m</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span>• Rotational Morning (06:00 – 14:00)</span>
                                <span className="text-slate-500 text-[10px]">8h</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span>• Rotational Evening (14:00 – 22:00)</span>
                                <span className="text-slate-500 text-[10px]">8h</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span>• Rotational Night (22:00 – 06:00)</span>
                                <span className="text-purple-400 text-[10px]">Overnight</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span>• Saturday Half-Day (08:30 – 13:00)</span>
                                <span className="text-slate-500 text-[10px]">4h 30m</span>
                            </div>
                        </div>

                        <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2.5">
                            <button
                                type="button"
                                onClick={() => setIsSeedModalOpen(false)}
                                className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={executeSeedPresets}
                                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shadow-lg shadow-amber-600/20 transition flex items-center gap-1.5"
                            >
                                <Sparkles className="w-3.5 h-3.5" />
                                <span>Load Presets</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ========================================================= */}
            {/* DIALOG BOX 4: DELETE ASSIGNMENT CONFIRMATION MODAL */}
            {/* ========================================================= */}
            {isDeleteAssignmentModalOpen && assignmentToDelete && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
                    <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl space-y-4">
                        <div className="flex items-start gap-4">
                            <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center flex-shrink-0">
                                <UserMinus className="w-5 h-5 text-rose-400" />
                            </div>
                            <div className="flex-1">
                                <h3 className="text-base font-bold text-white">Remove Baseline Assignment</h3>
                                <p className="text-xs text-slate-400 mt-1">
                                    Remove shift <strong className="text-white">"{assignmentToDelete.shiftName}"</strong> from employee <strong className="text-white">{assignmentToDelete.empName}</strong>?
                                </p>
                            </div>
                        </div>

                        <p className="text-xs text-slate-400">
                            The employee will no longer have this default baseline shift applied for attendance calculations.
                        </p>

                        <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2.5">
                            <button
                                type="button"
                                onClick={() => {
                                    setIsDeleteAssignmentModalOpen(false);
                                    setAssignmentToDelete(null);
                                }}
                                className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={executeRemoveAssignment}
                                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-lg shadow-rose-600/20 transition flex items-center gap-1.5"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Remove</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ========================================================= */}
            {/* DIALOG BOX 5: ASSIGN SHIFT MODAL (SINGLE / BULK) */}
            {/* ========================================================= */}
            {isAssignModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
                    <div className="w-full max-w-xl rounded-3xl bg-slate-900 border border-slate-800 p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center">
                                    <UserCheck className="w-5 h-5 text-indigo-400" />
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-white">
                                        Assign Baseline Shift
                                    </h3>
                                    <p className="text-xs text-slate-400">
                                        Set permanent schedule for regular contractual personnel
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsAssignModalOpen(false)}
                                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleAssignSubmit} className="mt-5 space-y-4">
                            {/* Mode Selector */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Assignment Scope</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setAssignMode('single')}
                                        className={`py-2 px-3 rounded-xl text-xs font-semibold border transition flex items-center justify-center gap-1.5 ${
                                            assignMode === 'single'
                                                ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300 shadow-sm'
                                                : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800'
                                        }`}
                                    >
                                        <UserCheck className="w-3.5 h-3.5" />
                                        <span>Single Employee</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setAssignMode('bulk')}
                                        className={`py-2 px-3 rounded-xl text-xs font-semibold border transition flex items-center justify-center gap-1.5 ${
                                            assignMode === 'bulk'
                                                ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300 shadow-sm'
                                                : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800'
                                        }`}
                                    >
                                        <Users className="w-3.5 h-3.5" />
                                        <span>Multiple Staff (Bulk)</span>
                                    </button>
                                </div>
                            </div>

                            {assignMode === 'single' ? (
                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                                        Select Employee *
                                    </label>
                                    <select
                                        value={assignForm.data.employee_id}
                                        onChange={(e) => assignForm.setData('employee_id', e.target.value)}
                                        required
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                                    >
                                        {employees.map((emp) => (
                                            <option key={emp.id} value={emp.id}>
                                                {emp.emp_no} — {emp.full_name} ({emp.department?.name || 'No Dept'})
                                            </option>
                                        ))}
                                        {employees.length === 0 && (
                                            <option value="" disabled>No registered active employees found</option>
                                        )}
                                    </select>
                                </div>
                            ) : (
                                <div className="space-y-2.5">
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-semibold text-slate-300">
                                            Select Target Staff ({selectedBulkEmpIds.length} Selected)
                                        </label>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const visibleIds = filteredBulkEmployees.map((e) => e.id);
                                                const allSelected = visibleIds.every((id) => selectedBulkEmpIds.includes(id));
                                                if (allSelected) {
                                                    setSelectedBulkEmpIds(selectedBulkEmpIds.filter((id) => !visibleIds.includes(id)));
                                                } else {
                                                    setSelectedBulkEmpIds(Array.from(new Set([...selectedBulkEmpIds, ...visibleIds])));
                                                }
                                            }}
                                            className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold"
                                        >
                                            {filteredBulkEmployees.length > 0 &&
                                            filteredBulkEmployees.every((e) => selectedBulkEmpIds.includes(e.id))
                                                ? 'Deselect All Visible'
                                                : 'Select All Visible'}
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2">
                                        <input
                                            type="text"
                                            placeholder="Search by name / emp no..."
                                            value={bulkEmpSearch}
                                            onChange={(e) => setBulkEmpSearch(e.target.value)}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500"
                                        />
                                        <select
                                            value={bulkDeptFilter}
                                            onChange={(e) => setBulkDeptFilter(e.target.value)}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white"
                                        >
                                            <option value="all">All Departments</option>
                                            {uniqueDepartments.map((d) => (
                                                <option key={d.id} value={d.id}>
                                                    {d.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="max-h-48 overflow-y-auto border border-slate-800 rounded-xl bg-slate-950/60 divide-y divide-slate-800/60">
                                        {filteredBulkEmployees.length === 0 ? (
                                            <div className="p-3 text-center text-xs text-slate-500">
                                                No employees match filter.
                                            </div>
                                        ) : (
                                            filteredBulkEmployees.map((emp) => {
                                                const isChecked = selectedBulkEmpIds.includes(emp.id);
                                                return (
                                                    <label
                                                        key={emp.id}
                                                        className="flex items-center justify-between p-2 hover:bg-slate-800/40 cursor-pointer text-xs"
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            <input
                                                                type="checkbox"
                                                                checked={isChecked}
                                                                onChange={() => {
                                                                    if (isChecked) {
                                                                        setSelectedBulkEmpIds(selectedBulkEmpIds.filter((id) => id !== emp.id));
                                                                    } else {
                                                                        setSelectedBulkEmpIds([...selectedBulkEmpIds, emp.id]);
                                                                    }
                                                                }}
                                                                className="rounded bg-slate-800 border-slate-700 text-indigo-600 focus:ring-indigo-500"
                                                            />
                                                            <span className="font-semibold text-white">{emp.full_name}</span>
                                                            <span className="text-slate-500 text-[11px]">({emp.emp_no})</span>
                                                        </div>
                                                        {emp.department && (
                                                            <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                                                                {emp.department.name}
                                                            </span>
                                                        )}
                                                    </label>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1">
                                    Select Target Shift *
                                </label>
                                <select
                                    value={assignForm.data.shift_id}
                                    onChange={(e) => assignForm.setData('shift_id', e.target.value)}
                                    required
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                                >
                                    {shifts.map((s) => (
                                        <option key={s.id} value={s.id}>
                                            {s.name} ({s.code}) — {s.start_time.substring(0, 5)} to {s.end_time.substring(0, 5)}
                                        </option>
                                    ))}
                                    {shifts.length === 0 && (
                                        <option value="" disabled>No shifts configured</option>
                                    )}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                                        Effective From *
                                    </label>
                                    <input
                                        type="date"
                                        value={assignForm.data.effective_from}
                                        onChange={(e) => assignForm.setData('effective_from', e.target.value)}
                                        required
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                                        Effective To (Optional)
                                    </label>
                                    <input
                                        type="date"
                                        value={assignForm.data.effective_to}
                                        onChange={(e) => assignForm.setData('effective_to', e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                                    />
                                </div>
                            </div>

                            <p className="text-[11px] text-slate-500">
                                If Effective To is left blank, this shift becomes the ongoing contractual baseline schedule.
                            </p>

                            <div className="pt-5 border-t border-slate-800 flex items-center justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsAssignModalOpen(false)}
                                    className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 rounded-xl hover:bg-slate-800 transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={
                                        assignForm.processing ||
                                        (assignMode === 'single' && !assignForm.data.employee_id) ||
                                        (assignMode === 'bulk' && selectedBulkEmpIds.length === 0) ||
                                        shifts.length === 0
                                    }
                                    className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/20 disabled:opacity-50 flex items-center gap-2 transition"
                                >
                                    <UserCheck className="w-4 h-4" />
                                    <span>
                                        {assignForm.processing
                                            ? 'Assigning...'
                                            : assignMode === 'bulk'
                                            ? `Assign to ${selectedBulkEmpIds.length} Staff`
                                            : 'Confirm Assignment'}
                                    </span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </AuthenticatedLayout>
    );
}
