import React, { useState, useMemo } from 'react';
import { Head, useForm, router, Link } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import {
    Sparkles,
    Calendar,
    RefreshCw,
    Clock,
    Plus,
    Users,
    Search,
    Filter,
    Edit2,
    Trash2,
    Copy,
    CheckCircle2,
    AlertTriangle,
    ArrowRight,
    X,
    CalendarRange,
    ChevronRight,
    Briefcase,
    Building2,
    Check,
    AlertCircle,
    Info,
    CalendarDays,
} from 'lucide-react';

interface Shift {
    id: string;
    name: string;
    code: string;
    color: string | null;
    start_time: string;
    end_time: string;
    is_night_shift: boolean;
    break_minutes?: number;
}

interface RosterPattern {
    id: string;
    name: string;
    code: string;
    pattern_type: 'weekly' | 'cyclical' | 'daily';
    cycle_length_days: number;
    pattern_data: any;
    is_active: boolean;
}

interface Employee {
    id: string;
    emp_no: string;
    full_name: string;
    department?: { id: string; name: string } | null;
    designation?: { id: string; title: string } | null;
}

interface Department {
    id: string;
    name: string;
    code: string;
}

interface Designation {
    id: string;
    title: string;
}

interface Props {
    patterns: RosterPattern[];
    shifts: Shift[];
    employees: Employee[];
    departments: Department[];
    designations: Designation[];
    stats: {
        total_patterns: number;
        weekly_patterns: number;
        cyclical_patterns: number;
        daily_patterns: number;
        total_active_employees: number;
    };
}

export default function Patterns({
    patterns,
    shifts,
    employees,
    departments,
    designations,
    stats,
}: Props) {
    const [searchQuery, setSearchQuery] = useState('');
    const [typeFilter, setTypeFilter] = useState<'all' | 'weekly' | 'cyclical' | 'daily'>('all');
    const [isBuilderOpen, setIsBuilderOpen] = useState(false);
    const [editingPattern, setEditingPattern] = useState<RosterPattern | null>(null);

    // Assign Drawer State
    const [isAssignOpen, setIsAssignOpen] = useState(false);
    const [assigningPattern, setAssigningPattern] = useState<RosterPattern | null>(null);
    const [empSearch, setEmpSearch] = useState('');
    const [deptFilter, setDeptFilter] = useState('all');
    const [desigFilter, setDesigFilter] = useState('all');
    const [selectedEmpIds, setSelectedEmpIds] = useState<string[]>([]);

    // Pattern Form State
    const patternForm = useForm({
        name: '',
        code: '',
        pattern_type: 'weekly' as 'weekly' | 'cyclical' | 'daily',
        cycle_length_days: 7,
        pattern_data: [] as any,
        is_active: true,
    });

    // Assign Form State
    const assignForm = useForm({
        pattern_id: '',
        start_date: new Date().toISOString().split('T')[0],
        end_date: (() => {
            const d = new Date();
            d.setMonth(d.getMonth() + 1);
            return d.toISOString().split('T')[0];
        })(),
        employee_ids: [] as string[],
        department_id: '',
        conflict_mode: 'overwrite',
        status: 'published',
        preserve_leaves: true,
    });

    // Filter patterns
    const filteredPatterns = useMemo(() => {
        return patterns.filter((p) => {
            const matchesSearch =
                p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                p.code.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesType = typeFilter === 'all' || p.pattern_type === typeFilter;
            return matchesSearch && matchesType;
        });
    }, [patterns, searchQuery, typeFilter]);

    // Filter employees for assignment
    const filteredEmployees = useMemo(() => {
        return employees.filter((emp) => {
            const matchesSearch =
                emp.full_name.toLowerCase().includes(empSearch.toLowerCase()) ||
                emp.emp_no.toLowerCase().includes(empSearch.toLowerCase());
            const matchesDept = deptFilter === 'all' || emp.department?.id === deptFilter;
            const matchesDesig = desigFilter === 'all' || emp.designation?.id === desigFilter;
            return matchesSearch && matchesDept && matchesDesig;
        });
    }, [employees, empSearch, deptFilter, desigFilter]);

    // Calculate turnaround rest between two shifts
    const calculateRestInterval = (shift1: Shift | null, shift2: Shift | null): number | null => {
        if (!shift1 || !shift2) return null;

        const [h1, m1] = shift1.end_time.split(':').map(Number);
        const [h2, m2] = shift2.start_time.split(':').map(Number);

        let endMinutes = h1 * 60 + m1;
        let startMinutes = h2 * 60 + m2;

        if (shift1.is_night_shift) {
            endMinutes += 24 * 60;
        }

        let gapMinutes = startMinutes + 24 * 60 - endMinutes;
        if (gapMinutes >= 24 * 60) {
            gapMinutes -= 24 * 60;
        }

        return Number((gapMinutes / 60).toFixed(1));
    };

    // Open Builder for Create
    const openCreateBuilder = () => {
        setEditingPattern(null);
        const initialWeekly = [
            { day: 0, day_name: 'Mon', shift_id: shifts[0]?.id || '', is_rest_day: false },
            { day: 1, day_name: 'Tue', shift_id: shifts[0]?.id || '', is_rest_day: false },
            { day: 2, day_name: 'Wed', shift_id: shifts[0]?.id || '', is_rest_day: false },
            { day: 3, day_name: 'Thu', shift_id: shifts[0]?.id || '', is_rest_day: false },
            { day: 4, day_name: 'Fri', shift_id: shifts[0]?.id || '', is_rest_day: false },
            { day: 5, day_name: 'Sat', shift_id: '', is_rest_day: true },
            { day: 6, day_name: 'Sun', shift_id: '', is_rest_day: true },
        ];
        patternForm.setData({
            name: '',
            code: '',
            pattern_type: 'weekly',
            cycle_length_days: 7,
            pattern_data: initialWeekly,
            is_active: true,
        });
        setIsBuilderOpen(true);
    };

    // Open Builder for Edit
    const openEditBuilder = (pattern: RosterPattern) => {
        setEditingPattern(pattern);
        patternForm.setData({
            name: pattern.name,
            code: pattern.code,
            pattern_type: pattern.pattern_type,
            cycle_length_days: pattern.cycle_length_days,
            pattern_data: pattern.pattern_data,
            is_active: pattern.is_active,
        });
        setIsBuilderOpen(true);
    };

    // Submit Pattern (Create or Update)
    const handlePatternSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (editingPattern) {
            patternForm.put(`/roster/patterns/${editingPattern.id}`, {
                preserveScroll: true,
                onSuccess: () => setIsBuilderOpen(false),
            });
        } else {
            patternForm.post('/roster/patterns', {
                preserveScroll: true,
                onSuccess: () => setIsBuilderOpen(false),
            });
        }
    };

    // Delete Pattern
    const handleDeletePattern = (pattern: RosterPattern) => {
        if (confirm(`Are you sure you want to delete roster pattern "${pattern.name}"?`)) {
            router.delete(`/roster/patterns/${pattern.id}`, { preserveScroll: true });
        }
    };

    // Open Assign Drawer
    const openAssignDrawer = (pattern: RosterPattern) => {
        setAssigningPattern(pattern);
        setSelectedEmpIds([]);
        assignForm.setData({
            pattern_id: pattern.id,
            start_date: new Date().toISOString().split('T')[0],
            end_date: (() => {
                const d = new Date();
                d.setMonth(d.getMonth() + 1);
                return d.toISOString().split('T')[0];
            })(),
            employee_ids: [],
            department_id: '',
            conflict_mode: 'overwrite',
            status: 'published',
            preserve_leaves: true,
        });
        setIsAssignOpen(true);
    };

    // Toggle Select All Employees
    const handleToggleSelectAll = () => {
        const visibleIds = filteredEmployees.map((e) => e.id);
        const allSelected = visibleIds.every((id) => selectedEmpIds.includes(id));
        if (allSelected) {
            setSelectedEmpIds(selectedEmpIds.filter((id) => !visibleIds.includes(id)));
        } else {
            const combined = Array.from(new Set([...selectedEmpIds, ...visibleIds]));
            setSelectedEmpIds(combined);
        }
    };

    // Handle Assign Submit
    const handleAssignSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (selectedEmpIds.length === 0 && (!deptFilter || deptFilter === 'all')) {
            alert('Please select at least one employee or a department to assign this roster to.');
            return;
        }

        assignForm.setData({
            ...assignForm.data,
            employee_ids: selectedEmpIds,
            department_id: deptFilter !== 'all' ? deptFilter : '',
        });

        assignForm.post('/roster/patterns/assign', {
            preserveScroll: true,
            onSuccess: () => setIsAssignOpen(false),
        });
    };

    return (
        <AuthenticatedLayout>
            <Head title="Roster Patterns & Templates" />

            <div className="space-y-6">
                {/* 1. Header Banner & Actions */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-slate-900/90 to-indigo-950/40 p-6 rounded-2xl border border-slate-800 shadow-xl">
                    <div className="space-y-1">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                                <Sparkles className="w-6 h-6" />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                                    Roster Patterns & Templates
                                </h1>
                                <p className="text-xs text-slate-400">
                                    Define, sequence, and manage reusable work rotations and assign them directly to personnel.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <Link
                            href="/roster"
                            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 transition flex items-center gap-2 shadow-sm"
                        >
                            <CalendarRange className="w-4 h-4 text-slate-400" />
                            <span>Open Duty Roster Cockpit</span>
                        </Link>

                        <button
                            onClick={openCreateBuilder}
                            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition flex items-center gap-2 shadow-lg shadow-indigo-600/20"
                        >
                            <Plus className="w-4 h-4" />
                            <span>Create New Roster</span>
                        </button>
                    </div>
                </div>

                {/* 2. Metrics Strip */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="bg-slate-900/70 border border-slate-800/80 p-4 rounded-xl flex items-center gap-3.5">
                        <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                            <Sparkles className="w-5 h-5" />
                        </div>
                        <div>
                            <span className="text-xs text-slate-400 font-medium">Total Rosters</span>
                            <h4 className="text-lg font-bold text-white">{stats.total_patterns}</h4>
                        </div>
                    </div>

                    <div className="bg-slate-900/70 border border-slate-800/80 p-4 rounded-xl flex items-center gap-3.5">
                        <div className="p-2.5 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
                            <Calendar className="w-5 h-5" />
                        </div>
                        <div>
                            <span className="text-xs text-slate-400 font-medium">Weekly 7-Day</span>
                            <h4 className="text-lg font-bold text-white">{stats.weekly_patterns}</h4>
                        </div>
                    </div>

                    <div className="bg-slate-900/70 border border-slate-800/80 p-4 rounded-xl flex items-center gap-3.5">
                        <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            <RefreshCw className="w-5 h-5" />
                        </div>
                        <div>
                            <span className="text-xs text-slate-400 font-medium">Rolling Cyclical</span>
                            <h4 className="text-lg font-bold text-white">{stats.cyclical_patterns}</h4>
                        </div>
                    </div>

                    <div className="bg-slate-900/70 border border-slate-800/80 p-4 rounded-xl flex items-center gap-3.5">
                        <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <Users className="w-5 h-5" />
                        </div>
                        <div>
                            <span className="text-xs text-slate-400 font-medium">Active Personnel</span>
                            <h4 className="text-lg font-bold text-white">{stats.total_active_employees}</h4>
                        </div>
                    </div>
                </div>

                {/* 3. Search & Filters */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/50 p-3 rounded-xl border border-slate-800">
                    <div className="relative w-full sm:w-80">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            placeholder="Search roster by name or code..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-slate-800/90 border border-slate-700/80 text-slate-200 text-xs rounded-xl pl-9 pr-4 py-2 focus:ring-2 focus:ring-indigo-500 placeholder:text-slate-500"
                        />
                    </div>

                    <div className="flex items-center gap-1.5 w-full sm:w-auto">
                        <button
                            onClick={() => setTypeFilter('all')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                                typeFilter === 'all'
                                    ? 'bg-indigo-600 text-white shadow-sm'
                                    : 'bg-slate-800 text-slate-400 hover:text-white'
                            }`}
                        >
                            All ({patterns.length})
                        </button>
                        <button
                            onClick={() => setTypeFilter('weekly')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                                typeFilter === 'weekly'
                                    ? 'bg-indigo-600 text-white shadow-sm'
                                    : 'bg-slate-800 text-slate-400 hover:text-white'
                            }`}
                        >
                            Weekly ({stats.weekly_patterns})
                        </button>
                        <button
                            onClick={() => setTypeFilter('cyclical')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                                typeFilter === 'cyclical'
                                    ? 'bg-indigo-600 text-white shadow-sm'
                                    : 'bg-slate-800 text-slate-400 hover:text-white'
                            }`}
                        >
                            Cyclical ({stats.cyclical_patterns})
                        </button>
                        <button
                            onClick={() => setTypeFilter('daily')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                                typeFilter === 'daily'
                                    ? 'bg-indigo-600 text-white shadow-sm'
                                    : 'bg-slate-800 text-slate-400 hover:text-white'
                            }`}
                        >
                            Daily ({stats.daily_patterns})
                        </button>
                    </div>
                </div>

                {/* 4. Roster Cards Grid */}
                {filteredPatterns.length === 0 ? (
                    <div className="bg-slate-900/40 border border-dashed border-slate-800 rounded-2xl p-12 text-center space-y-4">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mx-auto">
                            <Sparkles className="w-6 h-6" />
                        </div>
                        <div className="space-y-1">
                            <h3 className="text-base font-bold text-white">No Roster Patterns Found</h3>
                            <p className="text-xs text-slate-400 max-w-sm mx-auto">
                                Create your organization's first reusable duty roster template (e.g. 7-day office schedule or 24/7 continuous rotation).
                            </p>
                        </div>
                        <button
                            onClick={openCreateBuilder}
                            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white inline-flex items-center gap-2"
                        >
                            <Plus className="w-4 h-4" />
                            <span>Create First Roster</span>
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {filteredPatterns.map((pattern) => {
                            // Extract shift sequence chips
                            let sequenceChips: { label: string; isRest: boolean; color?: string | null }[] = [];
                            if (pattern.pattern_type === 'weekly' && Array.isArray(pattern.pattern_data)) {
                                sequenceChips = pattern.pattern_data.map((item: any) => {
                                    const shift = shifts.find((s) => s.id === item.shift_id);
                                    return {
                                        label: item.is_rest_day ? 'OFF' : shift?.code || 'SHIFT',
                                        isRest: item.is_rest_day,
                                        color: shift?.color,
                                    };
                                });
                            } else if (pattern.pattern_type === 'cyclical') {
                                const steps = pattern.pattern_data?.steps || pattern.pattern_data || [];
                                sequenceChips = steps.map((item: any) => {
                                    const shift = shifts.find((s) => s.id === item.shift_id);
                                    return {
                                        label: item.is_rest_day ? 'OFF' : shift?.code || 'SHIFT',
                                        isRest: item.is_rest_day,
                                        color: shift?.color,
                                    };
                                });
                            }

                            return (
                                <div
                                    key={pattern.id}
                                    className="bg-slate-900 border border-slate-800 hover:border-slate-700/80 rounded-2xl p-5 shadow-lg flex flex-col justify-between transition group"
                                >
                                    <div className="space-y-4">
                                        {/* Card Top */}
                                        <div className="flex items-start justify-between gap-2">
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wider uppercase bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                                                        {pattern.code}
                                                    </span>
                                                    <span className="text-xs text-slate-400 capitalize">
                                                        {pattern.pattern_type} ({pattern.cycle_length_days}d)
                                                    </span>
                                                </div>
                                                <h3 className="text-sm font-bold text-white mt-1 group-hover:text-indigo-400 transition">
                                                    {pattern.name}
                                                </h3>
                                            </div>

                                            <div className="flex items-center gap-1">
                                                <button
                                                    onClick={() => openEditBuilder(pattern)}
                                                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                                                    title="Edit Pattern"
                                                >
                                                    <Edit2 className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                    onClick={() => handleDeletePattern(pattern)}
                                                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition"
                                                    title="Delete Pattern"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Shift Sequence Visual Timeline */}
                                        <div className="space-y-1.5 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                                            <span className="text-[11px] font-semibold text-slate-400">Sequence Timeline:</span>
                                            <div className="flex flex-wrap items-center gap-1.5 max-h-24 overflow-y-auto">
                                                {sequenceChips.map((chip, idx) => (
                                                    <span
                                                        key={idx}
                                                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold border transition ${
                                                            chip.isRest
                                                                ? 'bg-slate-800/70 border-slate-700 text-slate-400'
                                                                : 'bg-indigo-600/20 border-indigo-500/40 text-indigo-300'
                                                        }`}
                                                        style={chip.color ? { borderColor: `${chip.color}55`, color: chip.color } : {}}
                                                    >
                                                        {chip.label}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Card Footer Actions */}
                                    <div className="pt-4 border-t border-slate-800/80 mt-4 flex items-center justify-between">
                                        <span className="text-[11px] text-slate-500">
                                            {pattern.is_active ? 'Active Template' : 'Archived'}
                                        </span>

                                        <button
                                            onClick={() => openAssignDrawer(pattern)}
                                            className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white flex items-center gap-1.5 shadow-md shadow-indigo-600/20 transition"
                                        >
                                            <Users className="w-3.5 h-3.5" />
                                            <span>Assign to Staff</span>
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* ========================================================================= */}
            {/* 5. VISUAL ROSTER PATTERN BUILDER MODAL */}
            {/* ========================================================================= */}
            {isBuilderOpen && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full p-6 shadow-2xl space-y-6 my-8">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 rounded-xl bg-indigo-600/20 text-indigo-400">
                                    <Sparkles className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-white">
                                        {editingPattern ? 'Edit Roster Pattern' : 'Create Roster Pattern'}
                                    </h3>
                                    <p className="text-xs text-slate-400 mt-0.5">
                                        Configure shift sequences, cycle duration, and statutory rest intervals.
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsBuilderOpen(false)}
                                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handlePatternSubmit} className="space-y-5">
                            {/* Metadata */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 mb-1">Roster Name</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. 24/7 Security 4x2 Cycle"
                                        value={patternForm.data.name}
                                        onChange={(e) => patternForm.setData('name', e.target.value)}
                                        className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 mb-1">Pattern Code</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. SEC-4X2"
                                        value={patternForm.data.code}
                                        onChange={(e) => patternForm.setData('code', e.target.value)}
                                        className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-500 uppercase"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 mb-1">Pattern Type</label>
                                    <select
                                        value={patternForm.data.pattern_type}
                                        onChange={(e) => {
                                            const type = e.target.value as 'weekly' | 'cyclical' | 'daily';
                                            if (type === 'weekly') {
                                                patternForm.setData({
                                                    ...patternForm.data,
                                                    pattern_type: 'weekly',
                                                    cycle_length_days: 7,
                                                    pattern_data: [
                                                        { day: 0, day_name: 'Mon', shift_id: shifts[0]?.id || '', is_rest_day: false },
                                                        { day: 1, day_name: 'Tue', shift_id: shifts[0]?.id || '', is_rest_day: false },
                                                        { day: 2, day_name: 'Wed', shift_id: shifts[0]?.id || '', is_rest_day: false },
                                                        { day: 3, day_name: 'Thu', shift_id: shifts[0]?.id || '', is_rest_day: false },
                                                        { day: 4, day_name: 'Fri', shift_id: shifts[0]?.id || '', is_rest_day: false },
                                                        { day: 5, day_name: 'Sat', shift_id: '', is_rest_day: true },
                                                        { day: 6, day_name: 'Sun', shift_id: '', is_rest_day: true },
                                                    ],
                                                });
                                            } else if (type === 'cyclical') {
                                                patternForm.setData({
                                                    ...patternForm.data,
                                                    pattern_type: 'cyclical',
                                                    cycle_length_days: 6,
                                                    pattern_data: {
                                                        steps: [
                                                            { step: 1, shift_id: shifts[0]?.id || '', is_rest_day: false },
                                                            { step: 2, shift_id: shifts[0]?.id || '', is_rest_day: false },
                                                            { step: 3, shift_id: shifts[1]?.id || shifts[0]?.id || '', is_rest_day: false },
                                                            { step: 4, shift_id: shifts[1]?.id || shifts[0]?.id || '', is_rest_day: false },
                                                            { step: 5, shift_id: '', is_rest_day: true },
                                                            { step: 6, shift_id: '', is_rest_day: true },
                                                        ],
                                                    },
                                                });
                                            }
                                        }}
                                        className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                                    >
                                        <option value="weekly">Weekly 7-Day Matrix</option>
                                        <option value="cyclical">Rolling N-Day Cyclical</option>
                                    </select>
                                </div>
                            </div>

                            {/* Weekly Sequence Builder */}
                            {patternForm.data.pattern_type === 'weekly' && Array.isArray(patternForm.data.pattern_data) && (
                                <div className="space-y-3 bg-slate-950/60 p-4 rounded-xl border border-slate-800">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-indigo-400">Weekly 7-Day Day-by-Day Setup</span>
                                        <span className="text-[11px] text-slate-400">Mon ➔ Sun</span>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                        {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(
                                            (dayName, idx) => {
                                                const dayCfg = patternForm.data.pattern_data[idx] || {
                                                    shift_id: shifts[0]?.id || '',
                                                    is_rest_day: idx >= 5,
                                                };

                                                return (
                                                    <div
                                                        key={dayName}
                                                        className="flex items-center gap-2 bg-slate-900 p-2.5 rounded-lg border border-slate-800 text-xs"
                                                    >
                                                        <span className="w-12 font-bold text-slate-300">{dayName.substring(0, 3)}</span>
                                                        <select
                                                            disabled={dayCfg.is_rest_day}
                                                            value={dayCfg.shift_id}
                                                            onChange={(e) => {
                                                                const updated = [...patternForm.data.pattern_data];
                                                                updated[idx] = { ...dayCfg, shift_id: e.target.value };
                                                                patternForm.setData('pattern_data', updated);
                                                            }}
                                                            className="flex-1 bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg px-2 py-1.5 disabled:opacity-30"
                                                        >
                                                            {shifts.map((s) => (
                                                                <option key={s.id} value={s.id}>
                                                                    {s.name} ({s.code})
                                                                </option>
                                                            ))}
                                                        </select>
                                                        <label className="flex items-center gap-1 text-[11px] text-amber-400 cursor-pointer">
                                                            <input
                                                                type="checkbox"
                                                                checked={dayCfg.is_rest_day}
                                                                onChange={(e) => {
                                                                    const updated = [...patternForm.data.pattern_data];
                                                                    updated[idx] = { ...dayCfg, is_rest_day: e.target.checked };
                                                                    patternForm.setData('pattern_data', updated);
                                                                }}
                                                                className="rounded bg-slate-800 border-slate-700 text-amber-500"
                                                            />
                                                            <span>Off</span>
                                                        </label>
                                                    </div>
                                                );
                                            }
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Cyclical Steps Builder */}
                            {patternForm.data.pattern_type === 'cyclical' && (
                                <div className="space-y-3 bg-slate-950/60 p-4 rounded-xl border border-slate-800">
                                    <div className="flex items-center justify-between">
                                        <div className="text-xs font-bold text-indigo-400">
                                            Cycle Rotation Steps ({patternForm.data.pattern_data?.steps?.length || 0} Steps)
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const currentSteps = patternForm.data.pattern_data?.steps || [];
                                                const nextStep = currentSteps.length + 1;
                                                const updatedSteps = [
                                                    ...currentSteps,
                                                    { step: nextStep, shift_id: shifts[0]?.id || '', is_rest_day: false },
                                                ];
                                                patternForm.setData({
                                                    ...patternForm.data,
                                                    cycle_length_days: updatedSteps.length,
                                                    pattern_data: { steps: updatedSteps },
                                                });
                                            }}
                                            className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1"
                                        >
                                            <Plus className="w-3.5 h-3.5" />
                                            <span>Add Step</span>
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto">
                                        {(patternForm.data.pattern_data?.steps || []).map((step: any, idx: number) => (
                                            <div
                                                key={idx}
                                                className="flex items-center gap-2 bg-slate-900 p-2.5 rounded-lg border border-slate-800 text-xs"
                                            >
                                                <span className="w-14 text-slate-400 font-bold">Step {idx + 1}</span>
                                                <select
                                                    disabled={step.is_rest_day}
                                                    value={step.shift_id}
                                                    onChange={(e) => {
                                                        const steps = [...patternForm.data.pattern_data.steps];
                                                        steps[idx] = { ...step, shift_id: e.target.value };
                                                        patternForm.setData('pattern_data', { steps });
                                                    }}
                                                    className="flex-1 bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg px-2 py-1.5 disabled:opacity-30"
                                                >
                                                    {shifts.map((s) => (
                                                        <option key={s.id} value={s.id}>
                                                            {s.code}
                                                        </option>
                                                    ))}
                                                </select>
                                                <label className="flex items-center gap-1 text-[11px] text-amber-400">
                                                    <input
                                                        type="checkbox"
                                                        checked={step.is_rest_day}
                                                        onChange={(e) => {
                                                            const steps = [...patternForm.data.pattern_data.steps];
                                                            steps[idx] = { ...step, is_rest_day: e.target.checked };
                                                            patternForm.setData('pattern_data', { steps });
                                                        }}
                                                        className="rounded bg-slate-800 border-slate-700 text-amber-500"
                                                    />
                                                    <span>Off</span>
                                                </label>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const steps = patternForm.data.pattern_data.steps.filter((_: any, i: number) => i !== idx);
                                                        patternForm.setData({
                                                            ...patternForm.data,
                                                            cycle_length_days: steps.length,
                                                            pattern_data: { steps },
                                                        });
                                                    }}
                                                    className="text-slate-500 hover:text-rose-400 p-1"
                                                >
                                                    <X className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                                <button
                                    type="button"
                                    onClick={() => setIsBuilderOpen(false)}
                                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={patternForm.processing}
                                    className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition shadow-lg shadow-indigo-600/20"
                                >
                                    {patternForm.processing ? 'Saving...' : editingPattern ? 'Update Pattern' : 'Save Pattern'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* 6. BULK & INDIVIDUAL EMPLOYEE ROSTER ASSIGNMENT DRAWER / MODAL */}
            {/* ========================================================================= */}
            {isAssignOpen && assigningPattern && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5 my-8">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 rounded-xl bg-indigo-600/20 text-indigo-400">
                                    <Users className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-white">
                                        Assign Roster: <span className="text-indigo-400">{assigningPattern.name}</span>
                                    </h3>
                                    <p className="text-xs text-slate-400 mt-0.5">
                                        Select employees individually or filter by department/role to apply this schedule.
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsAssignOpen(false)}
                                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleAssignSubmit} className="space-y-4">
                            {/* Date Range */}
                            <div className="grid grid-cols-2 gap-3 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 mb-1">Effective Start Date</label>
                                    <input
                                        type="date"
                                        value={assignForm.data.start_date}
                                        onChange={(e) => assignForm.setData('start_date', e.target.value)}
                                        className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 mb-1">Effective End Date</label>
                                    <input
                                        type="date"
                                        value={assignForm.data.end_date}
                                        onChange={(e) => assignForm.setData('end_date', e.target.value)}
                                        className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                                        required
                                    />
                                </div>
                            </div>

                            {/* Employee Filtering & Selection */}
                            <div className="space-y-2.5">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-slate-300">
                                        Select Target Personnel ({selectedEmpIds.length} Selected)
                                    </span>
                                    <button
                                        type="button"
                                        onClick={handleToggleSelectAll}
                                        className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold"
                                    >
                                        {filteredEmployees.length > 0 &&
                                        filteredEmployees.every((e) => selectedEmpIds.includes(e.id))
                                            ? 'Deselect All Visible'
                                            : 'Select All Visible'}
                                    </button>
                                </div>

                                {/* Filters */}
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                    <div className="relative">
                                        <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                                        <input
                                            type="text"
                                            placeholder="Search by name / emp no..."
                                            value={empSearch}
                                            onChange={(e) => setEmpSearch(e.target.value)}
                                            className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg pl-8 pr-2 py-1.5"
                                        />
                                    </div>

                                    <select
                                        value={deptFilter}
                                        onChange={(e) => setDeptFilter(e.target.value)}
                                        className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg px-2 py-1.5"
                                    >
                                        <option value="all">All Departments</option>
                                        {departments.map((d) => (
                                            <option key={d.id} value={d.id}>
                                                {d.name}
                                            </option>
                                        ))}
                                    </select>

                                    <select
                                        value={desigFilter}
                                        onChange={(e) => setDesigFilter(e.target.value)}
                                        className="bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg px-2 py-1.5"
                                    >
                                        <option value="all">All Designations</option>
                                        {designations.map((d) => (
                                            <option key={d.id} value={d.id}>
                                                {d.title}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Employee Checkbox List */}
                                <div className="max-h-52 overflow-y-auto border border-slate-800 rounded-xl bg-slate-950/60 divide-y divide-slate-800/60">
                                    {filteredEmployees.length === 0 ? (
                                        <div className="p-4 text-center text-xs text-slate-500">
                                            No employees match the selected filters.
                                        </div>
                                    ) : (
                                        filteredEmployees.map((emp) => {
                                            const isSelected = selectedEmpIds.includes(emp.id);
                                            return (
                                                <label
                                                    key={emp.id}
                                                    className="flex items-center justify-between p-2.5 hover:bg-slate-800/40 cursor-pointer transition text-xs"
                                                >
                                                    <div className="flex items-center gap-2.5">
                                                        <input
                                                            type="checkbox"
                                                            checked={isSelected}
                                                            onChange={() => {
                                                                if (isSelected) {
                                                                    setSelectedEmpIds(selectedEmpIds.filter((id) => id !== emp.id));
                                                                } else {
                                                                    setSelectedEmpIds([...selectedEmpIds, emp.id]);
                                                                }
                                                            }}
                                                            className="rounded bg-slate-800 border-slate-700 text-indigo-600 focus:ring-indigo-500"
                                                        />
                                                        <div>
                                                            <span className="font-semibold text-white">{emp.full_name}</span>
                                                            <span className="text-[11px] text-slate-500 ml-2">({emp.emp_no})</span>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-2">
                                                        {emp.department && (
                                                            <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px]">
                                                                {emp.department.name}
                                                            </span>
                                                        )}
                                                        {emp.designation && (
                                                            <span className="px-2 py-0.5 rounded bg-slate-800/60 text-slate-500 text-[10px]">
                                                                {emp.designation.title}
                                                            </span>
                                                        )}
                                                    </div>
                                                </label>
                                            );
                                        })
                                    )}
                                </div>
                            </div>

                            {/* Options */}
                            <div className="space-y-2 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                                <label className="flex items-center justify-between cursor-pointer">
                                    <div>
                                        <div className="text-xs font-bold text-teal-400">Preserve Approved Leaves</div>
                                        <p className="text-[11px] text-slate-400">
                                            Retain authorized leaves; do not schedule work over leave dates.
                                        </p>
                                    </div>
                                    <input
                                        type="checkbox"
                                        checked={assignForm.data.preserve_leaves}
                                        onChange={(e) => assignForm.setData('preserve_leaves', e.target.checked)}
                                        className="rounded bg-slate-800 border-slate-700 text-teal-500 focus:ring-teal-400"
                                    />
                                </label>
                            </div>

                            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                                <button
                                    type="button"
                                    onClick={() => setIsAssignOpen(false)}
                                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={assignForm.processing}
                                    className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition shadow-lg shadow-indigo-600/20 flex items-center gap-2"
                                >
                                    <Users className="w-4 h-4" />
                                    <span>{assignForm.processing ? 'Assigning...' : `Assign Roster to ${selectedEmpIds.length} Staff`}</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </AuthenticatedLayout>
    );
}
