import React, { useState } from 'react';
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
    CheckCircle2,
    AlertCircle,
    X,
    UserCheck,
    Coffee,
    ShieldAlert,
    Briefcase,
    Building2,
    ChevronRight,
    Search,
    UserMinus,
    Fingerprint,
    CalendarRange,
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
    const [filterType, setFilterType] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const [editingShift, setEditingShift] = useState<Shift | null>(null);
    const [selectedShiftForAssign, setSelectedShiftForAssign] = useState<Shift | null>(null);

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
            color: '#3B82F6',
            description: '',
            is_active: true,
        });
        setIsShiftModalOpen(true);
    };

    const openEditModal = (shift: Shift) => {
        setEditingShift(shift);
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

    const handleDeleteShift = (shiftId: string, name: string) => {
        if (confirm(`Are you sure you want to delete shift "${name}"?`)) {
            router.delete(`/shifts/${shiftId}`, {
                preserveScroll: true,
            });
        }
    };

    const handleSeedPresets = () => {
        if (confirm('Load Sri Lankan standard shift templates (General Day, Rotational 3-Shift, Saturday Half-Day, Flexible)?')) {
            router.post('/shifts/seed-presets', {}, {
                preserveScroll: true,
            });
        }
    };

    const openAssignModal = (shift?: Shift) => {
        setSelectedShiftForAssign(shift || null);
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
        assignForm.post('/shifts/assign', {
            preserveScroll: true,
            onSuccess: () => setIsAssignModalOpen(false),
        });
    };

    const handleRemoveAssignment = (assignmentId: string) => {
        if (confirm('Remove this shift assignment?')) {
            router.delete(`/shifts/assignments/${assignmentId}`, {
                preserveScroll: true,
            });
        }
    };

    const filteredShifts = shifts.filter((shift) => {
        const matchesType = filterType === 'all' || shift.shift_type === filterType;
        const matchesQuery =
            shift.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            shift.code.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesType && matchesQuery;
    });

    const getShiftTypeBadge = (type: string, isNight: boolean) => {
        if (isNight) {
            return (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center gap-1">
                    <Moon className="w-3 h-3" /> Night Shift
                </span>
            );
        }
        switch (type) {
            case 'rotational':
                return (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        Rotational
                    </span>
                );
            case 'half_day':
                return (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-pink-500/10 text-pink-400 border border-pink-500/20">
                        Half Day
                    </span>
                );
            case 'flexible':
                return (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                        Flexible
                    </span>
                );
            default:
                return (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center gap-1">
                        <Sun className="w-3 h-3" /> Regular Day
                    </span>
                );
        }
    };

    return (
        <AuthenticatedLayout title="Shift Definitions & Baseline Schedules" backUrl="/dashboard">
            <div className="max-w-7xl mx-auto space-y-8">
                {/* Header Subnavigation Bar */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-2 border-b border-slate-800/80">
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
                                Master shift hours, break policies, and permanent contractual defaults for fixed-schedule personnel
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <Link
                            href="/roster"
                            className="text-xs font-semibold text-white px-3.5 py-2 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-sky-600 hover:from-purple-500 hover:to-sky-500 shadow-md shadow-indigo-500/20 transition flex items-center gap-1.5"
                            title="Open interactive monthly Duty Roster planner"
                        >
                            <CalendarRange className="w-4 h-4" />
                            Open Duty Roster Planner
                        </Link>
                        <Link
                            href="/work-calendar"
                            className="text-xs font-medium text-slate-300 hover:text-white px-3 py-1.5 rounded-lg border border-slate-800 hover:border-slate-700 bg-slate-900/60 transition flex items-center gap-1.5"
                        >
                            <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                            Work Calendar
                        </Link>
                        <Link
                            href="/attendance/import"
                            className="text-xs font-medium text-slate-300 hover:text-white px-3 py-1.5 rounded-lg border border-slate-800 hover:border-slate-700 bg-slate-900/60 transition flex items-center gap-1.5"
                        >
                            <Fingerprint className="w-3.5 h-3.5 text-cyan-400" />
                            Biometric Import
                        </Link>
                        <button
                            type="button"
                            onClick={handleSeedPresets}
                            className="text-xs font-medium text-amber-400 hover:text-amber-300 px-3 py-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 transition flex items-center gap-1.5"
                            title="Load standard Sri Lankan shift templates"
                        >
                            <Sparkles className="w-3.5 h-3.5" />
                            Populate SL Presets
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

                {/* Enterprise Workflow Guidance Card */}
                <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-950/40 via-slate-900/80 to-purple-950/40 border border-indigo-500/20 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
                    <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <CalendarRange className="w-4 h-4 text-indigo-400" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-xs font-bold text-white uppercase tracking-wider">Enterprise Scheduling Workflow</h2>
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 font-medium">Standard WFM Flow</span>
                            </div>
                            <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                                <strong className="text-white">Fixed 9–5 Personnel:</strong> Assign their permanent default shift once in the table below.
                                <br />
                                <strong className="text-indigo-300">Rotational / Shift Workers:</strong> Use the <strong className="text-white">Duty Roster Planner</strong> to schedule dynamic monthly patterns (7-Day, 4x2 Cyclical), manage swaps, and track statutory rest intervals.
                            </p>
                        </div>
                    </div>
                    <Link
                        href="/roster"
                        className="self-start md:self-center px-4 py-2 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-semibold whitespace-nowrap transition flex items-center gap-1.5 group"
                    >
                        <span>Launch Duty Roster Planner</span>
                        <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </Link>
                </div>
                {/* Metric Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
                    <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80">
                        <span className="text-xs text-slate-400 font-medium">Total Shifts</span>
                        <div className="text-2xl font-bold text-white mt-1">{stats.total_shifts}</div>
                    </div>
                    <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80">
                        <span className="text-xs text-emerald-400 font-medium">Active Definitions</span>
                        <div className="text-2xl font-bold text-emerald-400 mt-1">{stats.active_shifts}</div>
                    </div>
                    <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80">
                        <span className="text-xs text-purple-400 font-medium">Night Shifts</span>
                        <div className="text-2xl font-bold text-purple-400 mt-1">{stats.night_shifts}</div>
                    </div>
                    <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80">
                        <span className="text-xs text-amber-400 font-medium">Rotational Cycles</span>
                        <div className="text-2xl font-bold text-amber-400 mt-1">{stats.rotational_shifts}</div>
                    </div>
                    <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80">
                        <span className="text-xs text-sky-400 font-medium">Active Staff Assigned</span>
                        <div className="text-2xl font-bold text-sky-400 mt-1">{stats.total_assignments}</div>
                    </div>
                </div>

                {/* Filter and Action Bar */}
                <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 mb-6 flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-2 w-full md:w-auto">
                        <div className="relative flex-1 md:w-64">
                            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                            <input
                                type="text"
                                placeholder="Search by name or code..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                            />
                        </div>

                        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
                            {(['all', 'regular', 'rotational', 'night', 'half_day', 'flexible'] as const).map((type) => (
                                <button
                                    key={type}
                                    type="button"
                                    onClick={() => setFilterType(type)}
                                    className={`px-3 py-1 rounded-lg capitalize font-medium transition ${
                                        filterType === type
                                            ? 'bg-indigo-600 text-white'
                                            : 'text-slate-400 hover:text-slate-200'
                                    }`}
                                >
                                    {type === 'half_day' ? 'Half-Day' : type}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => openAssignModal()}
                            className="px-3 py-1.5 rounded-xl border border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 text-xs font-semibold flex items-center gap-1.5 transition"
                        >
                            <UserCheck className="w-4 h-4" />
                            Assign Shift to Employee
                        </button>
                    </div>
                </div>

                {/* Shifts Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredShifts.map((shift) => (
                        <div
                            key={shift.id}
                            className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700/80 transition shadow-lg flex flex-col justify-between"
                        >
                            <div>
                                <div className="flex items-start justify-between gap-3 mb-4">
                                    <div className="flex items-center gap-3">
                                        <div
                                            className="w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-md font-bold text-xs"
                                            style={{ backgroundColor: shift.color || '#3B82F6' }}
                                        >
                                            {shift.code.substring(0, 3)}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h3 className="font-bold text-white text-base tracking-tight">
                                                    {shift.name}
                                                </h3>
                                                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                                                    {shift.code}
                                                </span>
                                            </div>
                                            <div className="mt-1">
                                                {getShiftTypeBadge(shift.shift_type, shift.is_night_shift)}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-1">
                                        <button
                                            type="button"
                                            onClick={() => openEditModal(shift)}
                                            title="Edit Shift"
                                            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                                        >
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleDeleteShift(shift.id, shift.name)}
                                            title="Delete Shift"
                                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>

                                {shift.description && (
                                    <p className="text-xs text-slate-400 mb-4 line-clamp-2">
                                        {shift.description}
                                    </p>
                                )}

                                {/* Working Hours Visual Display */}
                                <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800/80 mb-4">
                                    <div className="flex items-center justify-between text-xs font-semibold text-slate-200 mb-2">
                                        <span className="flex items-center gap-1.5">
                                            <Clock className="w-3.5 h-3.5 text-indigo-400" />
                                            {shift.start_time.substring(0, 5)} — {shift.end_time.substring(0, 5)}
                                        </span>
                                        <span className="text-[11px] text-slate-400">
                                            OT after {Math.floor(shift.ot_threshold_minutes / 60)}h{' '}
                                            {shift.ot_threshold_minutes % 60 > 0 ? `${shift.ot_threshold_minutes % 60}m` : ''}
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400 pt-2 border-t border-slate-800">
                                        <div className="flex items-center gap-1.5">
                                            <Coffee className="w-3 h-3 text-amber-400" />
                                            Break: <span className="text-slate-200 font-medium">{shift.break_minutes} mins</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <ShieldAlert className="w-3 h-3 text-emerald-400" />
                                            Grace: <span className="text-slate-200 font-medium">{shift.grace_minutes} mins</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Bottom Card Footer */}
                            <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs">
                                <span className="text-slate-400 flex items-center gap-1.5">
                                    <Users className="w-3.5 h-3.5 text-slate-400" />
                                    {shift.assignments_count ?? 0} Staff Assigned
                                </span>

                                <button
                                    type="button"
                                    onClick={() => openAssignModal(shift)}
                                    className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1 hover:underline"
                                >
                                    Assign Roster →
                                </button>
                            </div>
                        </div>
                    ))}

                    {filteredShifts.length === 0 && (
                        <div className="col-span-full p-16 text-center rounded-3xl bg-slate-900/40 border border-slate-800/60 text-slate-400">
                            <Clock className="w-12 h-12 mx-auto text-slate-600 mb-3" />
                            <h3 className="text-base font-semibold text-white">No Shifts Found</h3>
                            <p className="text-xs text-slate-400 mt-1">
                                Click "Populate SL Presets" to seed standard Sri Lankan shift models, or create a custom one.
                            </p>
                            <div className="mt-4 flex items-center justify-center gap-3">
                                <button
                                    type="button"
                                    onClick={handleSeedPresets}
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
                        </div>
                    )}
                </div>

                {/* Assigned Staff Preview Table */}
                <div className="mt-12 p-6 rounded-3xl bg-slate-900/60 border border-slate-800/80">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h3 className="text-base font-bold text-white">Current Employee Shift Roster</h3>
                            <p className="text-xs text-slate-400 mt-0.5">
                                Active assignments mapping employees to operational shifts.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => openAssignModal()}
                            className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow transition"
                        >
                            + New Assignment
                        </button>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs text-slate-300">
                            <thead className="bg-slate-950/60 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
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
                                    .map((emp) =>
                                        emp.shift_assignments?.map((assignment) => (
                                            <tr key={assignment.id} className="hover:bg-slate-800/30 transition">
                                                <td className="px-4 py-3 font-mono font-bold text-white">
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
                                                        className="px-2.5 py-1 rounded-lg text-xs font-semibold text-white border"
                                                        style={{
                                                            backgroundColor: `${assignment.shift.color || '#3B82F6'}22`,
                                                            borderColor: assignment.shift.color || '#3B82F6',
                                                        }}
                                                    >
                                                        {assignment.shift.name} ({assignment.shift.code})
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-slate-400 font-mono">
                                                    {assignment.effective_from} → {assignment.effective_to || 'Ongoing'}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveAssignment(assignment.id)}
                                                        title="Remove Shift Assignment"
                                                        className="p-1 rounded text-slate-400 hover:text-rose-400 transition"
                                                    >
                                                        <UserMinus className="w-4 h-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}

                                {employees.filter((e) => e.shift_assignments && e.shift_assignments.length > 0).length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                                            No employee shift assignments registered yet. Click "Assign Roster" to map staff.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

            {/* Shift Definition Modal */}
            {isShiftModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
                    <div className="w-full max-w-lg rounded-3xl bg-slate-900 border border-slate-800 p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                            <h3 className="text-base font-bold text-white flex items-center gap-2">
                                <Clock className="w-5 h-5 text-indigo-400" />
                                {editingShift ? 'Edit Shift Configuration' : 'Create New Shift'}
                            </h3>
                            <button
                                type="button"
                                onClick={() => setIsShiftModalOpen(false)}
                                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleShiftSubmit} className="mt-6 space-y-4">
                            <div className="grid grid-cols-3 gap-4">
                                <div className="col-span-2">
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
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                                        Shift Code *
                                    </label>
                                    <input
                                        type="text"
                                        value={shiftForm.data.code}
                                        onChange={(e) => shiftForm.setData('code', e.target.value)}
                                        required
                                        placeholder="GEN-DAY"
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white uppercase focus:outline-none focus:border-indigo-500 font-mono"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                                        Shift Classification
                                    </label>
                                    <select
                                        value={shiftForm.data.shift_type}
                                        onChange={(e) => shiftForm.setData('shift_type', e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                                    >
                                        <option value="regular">Regular Day Shift</option>
                                        <option value="rotational">Rotational Pattern</option>
                                        <option value="night">Night Shift</option>
                                        <option value="half_day">Half-Day (Saturday)</option>
                                        <option value="flexible">Flexible Hours</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                                        Theme Color
                                    </label>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="color"
                                            value={shiftForm.data.color}
                                            onChange={(e) => shiftForm.setData('color', e.target.value)}
                                            className="w-10 h-9 bg-slate-950 border border-slate-800 rounded-xl cursor-pointer p-1"
                                        />
                                        <span className="text-xs font-mono text-slate-400">{shiftForm.data.color}</span>
                                    </div>
                                </div>
                            </div>

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
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                                    />
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
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                                        Meal Break (mins)
                                    </label>
                                    <input
                                        type="number"
                                        value={shiftForm.data.break_minutes}
                                        onChange={(e) => shiftForm.setData('break_minutes', parseInt(e.target.value) || 0)}
                                        min="0"
                                        max="240"
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 font-mono"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                                        Late Grace (mins)
                                    </label>
                                    <input
                                        type="number"
                                        value={shiftForm.data.grace_minutes}
                                        onChange={(e) => shiftForm.setData('grace_minutes', parseInt(e.target.value) || 0)}
                                        min="0"
                                        max="60"
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 font-mono"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                                        OT Threshold (mins)
                                    </label>
                                    <input
                                        type="number"
                                        value={shiftForm.data.ot_threshold_minutes}
                                        onChange={(e) => shiftForm.setData('ot_threshold_minutes', parseInt(e.target.value) || 0)}
                                        min="0"
                                        max="720"
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 font-mono"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1">
                                    Description & Notes
                                </label>
                                <textarea
                                    value={shiftForm.data.description}
                                    onChange={(e) => shiftForm.setData('description', e.target.value)}
                                    rows={2}
                                    placeholder="Compliance notes, roster details..."
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                                />
                            </div>

                            <div className="flex items-center gap-6 pt-2">
                                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-300">
                                    <input
                                        type="checkbox"
                                        checked={shiftForm.data.is_night_shift}
                                        onChange={(e) => shiftForm.setData('is_night_shift', e.target.checked)}
                                        className="w-4 h-4 rounded border-slate-700 text-indigo-600 focus:ring-0 focus:ring-offset-0 bg-slate-950"
                                    />
                                    Night Shift (Cross-midnight)
                                </label>

                                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-300">
                                    <input
                                        type="checkbox"
                                        checked={shiftForm.data.is_active}
                                        onChange={(e) => shiftForm.setData('is_active', e.target.checked)}
                                        className="w-4 h-4 rounded border-slate-700 text-indigo-600 focus:ring-0 focus:ring-offset-0 bg-slate-950"
                                    />
                                    Active Shift
                                </label>
                            </div>

                            <div className="pt-6 border-t border-slate-800 flex items-center justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsShiftModalOpen(false)}
                                    className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={shiftForm.processing}
                                    className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/20 disabled:opacity-50"
                                >
                                    {shiftForm.processing ? 'Saving...' : editingShift ? 'Update Shift' : 'Create Shift'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Employee Shift Assignment Modal */}
            {isAssignModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
                    <div className="w-full max-w-md rounded-3xl bg-slate-900 border border-slate-800 p-6 shadow-2xl relative">
                        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                            <h3 className="text-base font-bold text-white flex items-center gap-2">
                                <UserCheck className="w-5 h-5 text-indigo-400" />
                                Assign Shift Roster
                            </h3>
                            <button
                                type="button"
                                onClick={() => setIsAssignModalOpen(false)}
                                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleAssignSubmit} className="mt-6 space-y-4">
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
                                        <option value="" disabled>No registered employees found</option>
                                    )}
                                </select>
                            </div>

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
                                If Effective To is left blank, this shift becomes the ongoing default roster for the employee.
                            </p>

                            <div className="pt-6 border-t border-slate-800 flex items-center justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsAssignModalOpen(false)}
                                    className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={assignForm.processing || employees.length === 0 || shifts.length === 0}
                                    className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/20 disabled:opacity-50"
                                >
                                    {assignForm.processing ? 'Assigning...' : 'Confirm Assignment'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            </div>
        </AuthenticatedLayout>
    );
}
