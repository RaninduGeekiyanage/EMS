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
    Zap,
    Layers,
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
    start_date?: string | null;
    end_date?: string | null;
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

    // Pattern Form State
    const patternForm = useForm({
        name: '',
        code: '',
        pattern_type: 'weekly' as 'weekly' | 'cyclical' | 'daily',
        start_date: new Date().toISOString().split('T')[0],
        end_date: (() => {
            const d = new Date();
            d.setFullYear(d.getFullYear() + 1);
            return d.toISOString().split('T')[0];
        })(),
        cycle_length_days: 7,
        pattern_data: [] as any,
        is_active: true,
    });

    // Complementary Squad Generator Modal State
    const [isSquadGenModalOpen, setIsSquadGenModalOpen] = useState(false);
    const [squadGenPattern, setSquadGenPattern] = useState<RosterPattern | null>(null);
    const [targetSquadCount, setTargetSquadCount] = useState<number>(4);
    const [staggerInterval, setStaggerInterval] = useState<number>(2);
    const [isGeneratingSquads, setIsGeneratingSquads] = useState(false);

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
        const today = new Date();
        const startStr = today.toISOString().split('T')[0];
        const nextYear = new Date(today);
        nextYear.setFullYear(nextYear.getFullYear() + 1);
        const endStr = nextYear.toISOString().split('T')[0];

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
            start_date: startStr,
            end_date: endStr,
            cycle_length_days: 7,
            pattern_data: initialWeekly,
            is_active: true,
        });
        setIsBuilderOpen(true);
    };

    // Open Builder for Edit
    const openEditBuilder = (pattern: RosterPattern) => {
        setEditingPattern(pattern);
        const today = new Date().toISOString().split('T')[0];
        const defaultEnd = (() => {
            const d = new Date();
            d.setFullYear(d.getFullYear() + 1);
            return d.toISOString().split('T')[0];
        })();

        patternForm.setData({
            name: pattern.name,
            code: pattern.code,
            pattern_type: pattern.pattern_type,
            start_date: pattern.start_date || today,
            end_date: pattern.end_date || defaultEnd,
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

    // Open Auto-generate Squads Modal with Smart Suggestions
    const openSquadGenModal = (pattern: RosterPattern) => {
        setSquadGenPattern(pattern);
        const steps = pattern.pattern_data?.steps || pattern.pattern_data || [];
        const count = steps.length || pattern.cycle_length_days || 4;

        // Detect consecutive identical shift block length (e.g. 2 Morn, 2 Eve, 2 Night, 2 Off -> block size 2)
        let blockSize = 1;
        if (count >= 2) {
            const firstShiftId = steps[0]?.shift_id ?? null;
            const firstIsRest = Boolean(steps[0]?.is_rest_day);
            let bLen = 0;
            for (let i = 0; i < count; i++) {
                if (steps[i]?.shift_id === firstShiftId && Boolean(steps[i]?.is_rest_day) === firstIsRest) {
                    bLen++;
                } else {
                    break;
                }
            }
            if (bLen > 1 && count % bLen === 0) {
                blockSize = bLen;
            }
        }

        const suggestedSquads = blockSize > 1 ? Math.floor(count / blockSize) : (count <= 4 ? count : 4);
        const suggestedStagger = blockSize > 1 ? blockSize : Math.max(1, Math.round(count / suggestedSquads));
        setTargetSquadCount(suggestedSquads);
        setStaggerInterval(suggestedStagger);
        setIsSquadGenModalOpen(true);
    };

    const handleSquadGenSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!squadGenPattern) return;
        setIsGeneratingSquads(true);
        router.post(
            `/roster/patterns/${squadGenPattern.id}/generate-squads`,
            {
                total_squads: targetSquadCount,
                stagger_days: staggerInterval,
            },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setIsSquadGenModalOpen(false);
                    setIsGeneratingSquads(false);
                },
                onError: () => {
                    setIsGeneratingSquads(false);
                },
            }
        );
    };

    // Live Squad Rotation Previews
    const squadPreviews = useMemo(() => {
        if (!squadGenPattern) return [];
        const steps = squadGenPattern.pattern_data?.steps || squadGenPattern.pattern_data || [];
        const count = steps.length || squadGenPattern.cycle_length_days || 4;
        const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
        const baseName = squadGenPattern.name.replace(/(\s*-\s*Group\s*[A-Z].*)$/i, '');
        const baseCode = squadGenPattern.code.replace(/(-GRP-[A-Z].*)$/i, '');

        const previews = [];
        for (let i = 1; i < targetSquadCount; i++) {
            const letter = alphabet[i] || `G${i + 1}`;
            const offset = (i * staggerInterval) % count;
            const rotatedChips = [];
            for (let j = 0; j < count; j++) {
                const src = steps[(j + offset) % count];
                const shift = shifts.find((s) => s.id === src?.shift_id);
                rotatedChips.push({
                    label: src?.is_rest_day ? 'OFF' : shift?.code || 'SHIFT',
                    isRest: Boolean(src?.is_rest_day),
                    color: shift?.color,
                });
            }
            previews.push({
                letter,
                name: `${baseName} - Group ${letter}`,
                code: `${baseCode}-GRP-${letter}`,
                offset,
                chips: rotatedChips,
            });
        }
        return previews;
    }, [squadGenPattern, targetSquadCount, staggerInterval, shifts]);



    return (
        <AuthenticatedLayout>
            <Head title="Shift Groups & Rotation Templates" />

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
                                    Shift Groups & Rotation Templates
                                </h1>
                                <p className="text-xs text-slate-400">
                                    Option 2 (Shift Groups): Define rotating squad cards (Group A, B, C, D) and assign personnel directly to their rotation lines.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <Link
                            href="/roster"
                            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 transition flex items-center gap-2 shadow-sm"
                        >
                            <CalendarRange className="w-4 h-4 text-slate-400" />
                            <span>Duty Roster Cockpit</span>
                        </Link>



                        <button
                            onClick={openCreateBuilder}
                            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition flex items-center gap-2 shadow-lg shadow-indigo-600/20"
                        >
                            <Plus className="w-4 h-4" />
                            <span>Create Pattern</span>
                        </button>
                    </div>
                </div>

                {/* 2. Operational Overview & Metrics Strip (Side-by-Side) */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
                    {/* Left: Option 2 (Shift Groups / Squads) Reference Guide */}
                    <div className="lg:col-span-7 xl:col-span-8 bg-slate-900/90 border border-indigo-500/30 rounded-2xl p-4 shadow-xl relative overflow-hidden flex flex-col justify-between">
                        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
                        <div className="relative z-10 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                    Option 2 (Shift Groups / Squads)
                                </span>
                                <span className="text-xs text-slate-400 font-semibold">Sri Lankan &amp; Global Industry Standard</span>
                            </div>
                            <h3 className="text-sm font-bold text-white mt-1">
                                Workforce Rotation by Shift Groups (No Complex Math)
                            </h3>
                            <p className="text-xs text-slate-400">
                                Assign staff to dedicated rotating Group Cards. Each Group represents a crew's staggered rotation phase with 100% predictable daily coverage.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mt-3 pt-3 border-t border-slate-800/80 relative z-10">
                            <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs font-bold text-indigo-300">3 Shifts + 1 OFF</span>
                                    <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">4 Groups</span>
                                </div>
                                <p className="text-[10px] text-slate-400 leading-relaxed">
                                    Groups A, B, C, D rotate Shift 1 &rarr; 2 &rarr; 3 &rarr; OFF. Guarantees 3 active shifts &amp; 1 resting daily.
                                </p>
                            </div>

                            <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs font-bold text-indigo-300">2 Shifts + 1 OFF</span>
                                    <span className="text-[10px] font-mono text-sky-400 bg-sky-500/10 px-1.5 py-0.5 rounded border border-sky-500/20">3 Groups</span>
                                </div>
                                <p className="text-[10px] text-slate-400 leading-relaxed">
                                    Groups A, B, C rotate Shift 1 &rarr; Shift 2 &rarr; OFF. Guarantees 2 active shifts &amp; 1 resting staff daily.
                                </p>
                            </div>

                            <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs font-bold text-indigo-300">General Day Shift</span>
                                    <span className="text-[10px] font-mono text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded border border-purple-500/20">1 Weekly</span>
                                </div>
                                <p className="text-[10px] text-slate-400 leading-relaxed">
                                    Fixed Mon–Fri office hours, Sat &amp; Sun OFF. No rotation required.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Right: 4 Metrics Cards in compact 2x2 Grid */}
                    <div className="lg:col-span-5 xl:col-span-4 grid grid-cols-2 gap-3">
                        <div className="bg-slate-900/80 border border-slate-800/80 p-3.5 rounded-2xl flex flex-col justify-between hover:border-slate-700 transition shadow-lg">
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-slate-400 font-medium">Total Groups / Patterns</span>
                                <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                                    <Sparkles className="w-4 h-4" />
                                </div>
                            </div>
                            <h4 className="text-2xl font-black text-white mt-2">{stats.total_patterns}</h4>
                        </div>

                        <div className="bg-slate-900/80 border border-slate-800/80 p-3.5 rounded-2xl flex flex-col justify-between hover:border-slate-700 transition shadow-lg">
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-slate-400 font-medium">Weekly 7-Day</span>
                                <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
                                    <Calendar className="w-4 h-4" />
                                </div>
                            </div>
                            <h4 className="text-2xl font-black text-white mt-2">{stats.weekly_patterns}</h4>
                        </div>

                        <div className="bg-slate-900/80 border border-slate-800/80 p-3.5 rounded-2xl flex flex-col justify-between hover:border-slate-700 transition shadow-lg">
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-slate-400 font-medium">Rotating Squads</span>
                                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                    <RefreshCw className="w-4 h-4" />
                                </div>
                            </div>
                            <h4 className="text-2xl font-black text-white mt-2">{stats.cyclical_patterns}</h4>
                        </div>

                        <div className="bg-slate-900/80 border border-slate-800/80 p-3.5 rounded-2xl flex flex-col justify-between hover:border-slate-700 transition shadow-lg">
                            <div className="flex items-center justify-between">
                                <span className="text-xs text-slate-400 font-medium">Active Personnel</span>
                                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                    <Users className="w-4 h-4" />
                                </div>
                            </div>
                            <h4 className="text-2xl font-black text-white mt-2">{stats.total_active_employees}</h4>
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

                {/* 4. Enterprise Table View */}
                {filteredPatterns.length === 0 ? (
                    <div className="bg-slate-900/40 border border-dashed border-slate-800 rounded-2xl p-12 text-center space-y-4">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mx-auto">
                            <Sparkles className="w-6 h-6" />
                        </div>
                        <div className="space-y-1">
                            <h3 className="text-base font-bold text-white">No Shift Groups Found</h3>
                            <p className="text-xs text-slate-400 max-w-sm mx-auto">
                                No roster patterns match your search criteria. Create your organization's first reusable duty roster template or use 1-Click Group Set.
                            </p>
                        </div>
                        <button
                            onClick={openCreateBuilder}
                            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white inline-flex items-center gap-2 shadow-lg shadow-indigo-600/20"
                        >
                            <Plus className="w-4 h-4" />
                            <span>Create First Roster</span>
                        </button>
                    </div>
                ) : (
                    <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70 shadow-2xl backdrop-blur-sm">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-slate-800 bg-slate-950/60 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                                        <th className="py-3.5 px-4">Shift Group / Code</th>
                                        <th className="py-3.5 px-4">Type &amp; Cycle</th>
                                        <th className="py-3.5 px-4 min-w-[200px]">Operational Validity</th>
                                        <th className="py-3.5 px-4 min-w-[280px]">Rotation Sequence Steps</th>
                                        <th className="py-3.5 px-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/60 text-xs">
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

                                        const today = new Date().toISOString().split('T')[0];
                                        const isExpired = pattern.end_date && today > pattern.end_date;
                                        const isUpcoming = pattern.start_date && today < pattern.start_date;

                                        return (
                                            <tr
                                                key={pattern.id}
                                                className="hover:bg-slate-800/40 transition-colors duration-150 group"
                                            >
                                                {/* Group / Code & Name */}
                                                <td className="py-3.5 px-4 align-middle">
                                                    <div className="flex items-center gap-2.5">
                                                        <span className="font-mono font-bold text-[11px] text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded-md border border-indigo-500/20 shrink-0">
                                                            {pattern.code}
                                                        </span>
                                                        <div className="font-bold text-white text-xs group-hover:text-indigo-300 transition">
                                                            {pattern.name}
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* Type & Cycle */}
                                                <td className="py-3.5 px-4 align-middle whitespace-nowrap">
                                                    {pattern.pattern_type === 'cyclical' ? (
                                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/20">
                                                            <RefreshCw className="w-3 h-3 text-amber-400" />
                                                            <span>Squad ({pattern.cycle_length_days}d cycle)</span>
                                                        </span>
                                                    ) : pattern.pattern_type === 'weekly' ? (
                                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-sky-500/10 text-sky-300 border border-sky-500/20">
                                                            <Calendar className="w-3 h-3 text-sky-400" />
                                                            <span>Weekly (7-Day)</span>
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                                                            <Clock className="w-3 h-3 text-slate-400" />
                                                            <span>Daily Fixed</span>
                                                        </span>
                                                    )}
                                                </td>

                                                {/* Validity Period */}
                                                <td className="py-3.5 px-4 align-middle whitespace-nowrap">
                                                    {pattern.start_date && pattern.end_date ? (
                                                        <div className="flex items-center gap-2">
                                                            <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-300 bg-slate-950/60 px-2.5 py-1 rounded-md border border-slate-800">
                                                                <CalendarRange className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                                                                <span>{pattern.start_date} &rarr; {pattern.end_date}</span>
                                                            </div>
                                                            {isExpired ? (
                                                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase">
                                                                    Expired
                                                                </span>
                                                            ) : isUpcoming ? (
                                                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-sky-500/10 text-sky-400 border border-sky-500/20 uppercase">
                                                                    Upcoming
                                                                </span>
                                                            ) : (
                                                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase">
                                                                    Active
                                                                </span>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="text-[11px] text-slate-500 italic">No date range</span>
                                                    )}
                                                </td>

                                                {/* Rotation Sequence Steps */}
                                                <td className="py-3.5 px-4 align-middle">
                                                    <div className="flex flex-wrap items-center gap-1">
                                                        {sequenceChips.map((chip, idx) => (
                                                            <span
                                                                key={idx}
                                                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold border transition whitespace-nowrap ${
                                                                    chip.isRest
                                                                        ? 'bg-slate-800/80 border-slate-700 text-slate-400'
                                                                        : 'bg-indigo-600/20 border-indigo-500/30 text-indigo-200'
                                                                }`}
                                                                style={chip.color ? { borderColor: `${chip.color}66`, color: chip.color } : {}}
                                                                title={`Day/Step ${idx + 1}: ${chip.label}`}
                                                            >
                                                                {idx + 1}:{chip.label}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </td>

                                                {/* Actions */}
                                                <td className="py-3.5 px-4 align-middle text-right whitespace-nowrap">
                                                    <div className="flex items-center justify-end gap-1.5">


                                                        {pattern.pattern_type === 'cyclical' && (pattern.cycle_length_days || 0) > 1 && (
                                                            <button
                                                                onClick={() => openSquadGenModal(pattern)}
                                                                className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-300 hover:bg-emerald-950/50 transition border border-transparent hover:border-emerald-500/30"
                                                                title="Auto-generate complementary rotating squad groups (B, C, D...)"
                                                            >
                                                                <Copy className="w-3.5 h-3.5" />
                                                            </button>
                                                        )}

                                                        <button
                                                            onClick={() => openEditBuilder(pattern)}
                                                            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                                                            title="Edit / Extend Range"
                                                        >
                                                            <Edit2 className="w-3.5 h-3.5" />
                                                        </button>

                                                        <button
                                                            onClick={() => handleDeletePattern(pattern)}
                                                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition"
                                                            title="Delete Roster Pattern"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Table Footer with Summary */}
                        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-800 bg-slate-950/40 text-xs text-slate-400">
                            <span>
                                Showing <strong className="text-white">{filteredPatterns.length}</strong> of{' '}
                                <strong className="text-white">{patterns.length}</strong> shift groups / patterns
                            </span>
                            <span className="text-[11px] text-slate-500">
                                Click <strong className="text-slate-400">Assign Staff</strong> to allocate personnel or <strong className="text-slate-400">⚡ 1-Click Group Set</strong> to spin up new rotating squads.
                            </span>
                        </div>
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

                            {/* Operational Validity Period */}
                            <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <CalendarRange className="w-4 h-4 text-indigo-400" />
                                        <span className="text-xs font-bold text-white">Roster Date Range (Operational Active Window)</span>
                                    </div>
                                    {patternForm.data.start_date && patternForm.data.end_date && (
                                        <span className="text-[11px] font-mono text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                                            {Math.max(0, Math.round((new Date(patternForm.data.end_date).getTime() - new Date(patternForm.data.start_date).getTime()) / (1000 * 60 * 60 * 24)) + 1)} Days
                                        </span>
                                    )}
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-300 mb-1">
                                            Effective Start Date <span className="text-rose-400">*</span>
                                        </label>
                                        <input
                                            type="date"
                                            value={patternForm.data.start_date}
                                            onChange={(e) => patternForm.setData('start_date', e.target.value)}
                                            className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-300 mb-1">
                                            Effective End Date <span className="text-rose-400">*</span>
                                        </label>
                                        <input
                                            type="date"
                                            value={patternForm.data.end_date}
                                            onChange={(e) => patternForm.setData('end_date', e.target.value)}
                                            className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                                            required
                                        />
                                    </div>
                                </div>

                                {/* Range Presets & Extension shortcuts */}
                                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                                    <span className="text-[10px] text-slate-500 uppercase font-bold mr-1">Quick Presets:</span>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const now = new Date();
                                            const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
                                            const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
                                            patternForm.setData({ ...patternForm.data, start_date: start, end_date: end });
                                        }}
                                        className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-medium transition"
                                    >
                                        This Month
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const now = new Date();
                                            const start = patternForm.data.start_date || now.toISOString().split('T')[0];
                                            const d = new Date(start);
                                            d.setMonth(d.getMonth() + 3);
                                            patternForm.setData('end_date', d.toISOString().split('T')[0]);
                                        }}
                                        className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-medium transition"
                                    >
                                        3 Months (Quarter)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const now = new Date();
                                            const start = patternForm.data.start_date || now.toISOString().split('T')[0];
                                            const d = new Date(start);
                                            d.setMonth(d.getMonth() + 6);
                                            patternForm.setData('end_date', d.toISOString().split('T')[0]);
                                        }}
                                        className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-medium transition"
                                    >
                                        6 Months
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const now = new Date();
                                            const start = patternForm.data.start_date || now.toISOString().split('T')[0];
                                            const d = new Date(start);
                                            d.setFullYear(d.getFullYear() + 1);
                                            patternForm.setData('end_date', d.toISOString().split('T')[0]);
                                        }}
                                        className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-medium transition"
                                    >
                                        1 Year (Annual)
                                    </button>
                                    {editingPattern && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const currentEnd = patternForm.data.end_date ? new Date(patternForm.data.end_date) : new Date();
                                                currentEnd.setFullYear(currentEnd.getFullYear() + 1);
                                                patternForm.setData('end_date', currentEnd.toISOString().split('T')[0]);
                                            }}
                                            className="px-2.5 py-0.5 rounded-md bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 text-[10px] font-bold border border-indigo-500/40 transition flex items-center gap-1"
                                        >
                                            <Plus className="w-3 h-3" />
                                            <span>Extend +1 Year</span>
                                        </button>
                                    )}
                                </div>
                                <p className="text-[10px] text-slate-500 italic">
                                    Setting bounded date ranges prevents database row explosion. Extending a roster never affects existing or historical attendance logs.
                                </p>
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
            {/* 8. AUTO-GENERATE COMPLEMENTARY SQUAD GROUPS MODAL */}
            {/* ========================================================================= */}
            {isSquadGenModalOpen && squadGenPattern && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5 my-8">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
                                    <Copy className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-white">
                                        Auto-Generate Complementary Squad Groups: <span className="text-emerald-400">{squadGenPattern.name}</span>
                                    </h3>
                                    <p className="text-xs text-slate-400 mt-0.5">
                                        Instantly generate synchronized teams (e.g. Squad A, B, C, D) staggered across rotation steps.
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsSquadGenModalOpen(false)}
                                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Base Roster Info Card */}
                        <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800 space-y-2">
                            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                                <div>
                                    <span className="text-slate-400">Base Squad Card: </span>
                                    <strong className="text-white font-mono">{squadGenPattern.code}</strong> — <span className="text-slate-300">{squadGenPattern.name}</span>
                                </div>
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20">
                                    Cycle Length: {squadGenPattern.cycle_length_days} Days
                                </span>
                            </div>
                        </div>

                        <form onSubmit={handleSquadGenSubmit} className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                                        Total Squad Groups Desired
                                    </label>
                                    <input
                                        type="number"
                                        min={2}
                                        max={26}
                                        value={targetSquadCount}
                                        onChange={(e) => {
                                            const n = Math.max(2, Math.min(26, Number(e.target.value) || 2));
                                            setTargetSquadCount(n);
                                            const count = squadGenPattern.cycle_length_days || 4;
                                            setStaggerInterval(Math.max(1, Math.round(count / n)));
                                        }}
                                        className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-xl px-3 py-2 font-bold"
                                        required
                                    />
                                    <p className="text-[10px] text-slate-400 mt-1">
                                        Includes Group A. Generates <strong>{targetSquadCount - 1}</strong> new complementary squad cards.
                                    </p>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                                        Stagger Offset Interval (Days)
                                    </label>
                                    <input
                                        type="number"
                                        min={1}
                                        max={squadGenPattern.cycle_length_days || 365}
                                        value={staggerInterval}
                                        onChange={(e) => setStaggerInterval(Math.max(1, Number(e.target.value) || 1))}
                                        className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-xl px-3 py-2 font-bold"
                                        required
                                    />
                                    <p className="text-[10px] text-slate-400 mt-1">
                                        Each subsequent squad shifts forward by <strong>{staggerInterval}</strong> days.
                                    </p>
                                </div>
                            </div>

                            {/* Quick Presets based on cycle length */}
                            <div className="flex flex-wrap items-center gap-2 pt-1">
                                <span className="text-[11px] text-slate-400 font-medium">Quick Presets:</span>
                                {squadGenPattern.cycle_length_days === 8 && (
                                    <>
                                        <button
                                            type="button"
                                            onClick={() => { setTargetSquadCount(4); setStaggerInterval(2); }}
                                            className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 transition"
                                        >
                                            4 Squads (2-day stagger - Continental)
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => { setTargetSquadCount(2); setStaggerInterval(4); }}
                                            className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
                                        >
                                            2 Squads (4-day stagger)
                                        </button>
                                    </>
                                )}
                                {squadGenPattern.cycle_length_days === 4 && (
                                    <>
                                        <button
                                            type="button"
                                            onClick={() => { setTargetSquadCount(4); setStaggerInterval(1); }}
                                            className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 transition"
                                        >
                                            4 Squads (1-day stagger - 24/7)
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => { setTargetSquadCount(2); setStaggerInterval(2); }}
                                            className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
                                        >
                                            2 Squads (2-day stagger)
                                        </button>
                                    </>
                                )}
                                {squadGenPattern.cycle_length_days === 3 && (
                                    <button
                                        type="button"
                                        onClick={() => { setTargetSquadCount(3); setStaggerInterval(1); }}
                                        className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 transition"
                                    >
                                        3 Squads (1-day stagger - 2 Shifts + 1 OFF)
                                    </button>
                                )}
                            </div>

                            {/* Live Preview of Groups to be Created */}
                            <div className="space-y-2 pt-2">
                                <span className="text-xs font-semibold text-slate-300">
                                    Generated Squad Groups Preview ({squadPreviews.length} New Patterns):
                                </span>
                                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                                    {squadPreviews.map((p, idx) => (
                                        <div key={idx} className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between gap-3">
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono text-[10px] font-bold text-emerald-300 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                                                        {p.code}
                                                    </span>
                                                    <span className="text-xs font-bold text-white truncate">{p.name}</span>
                                                    <span className="text-[10px] text-slate-400 font-mono">
                                                        (+{idx * staggerInterval + staggerInterval}d offset)
                                                    </span>
                                                </div>
                                                <div className="flex flex-wrap items-center gap-1 mt-1.5">
                                                    {p.chips.map((chip, cIdx) => (
                                                        <span
                                                            key={cIdx}
                                                            className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${
                                                                chip.isRest
                                                                    ? 'bg-slate-800 border-slate-700 text-slate-400'
                                                                    : 'bg-indigo-600/20 border-indigo-500/30 text-indigo-200'
                                                            }`}
                                                            style={chip.color ? { borderColor: `${chip.color}66`, color: chip.color } : {}}
                                                        >
                                                            {cIdx + 1}:{chip.label}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                                <button
                                    type="button"
                                    onClick={() => setIsSquadGenModalOpen(false)}
                                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isGeneratingSquads || squadPreviews.length === 0}
                                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-xs font-bold text-white transition shadow-lg shadow-emerald-600/20 flex items-center gap-2"
                                >
                                    <Zap className="w-4 h-4 text-amber-300" />
                                    <span>
                                        {isGeneratingSquads
                                            ? 'Generating...'
                                            : `⚡ Generate ${squadPreviews.length} Squad Groups`}
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
