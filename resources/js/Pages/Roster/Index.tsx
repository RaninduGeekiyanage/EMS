import React, { useState, useMemo } from 'react';
import { Head, useForm, router, Link } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import {
    Calendar as CalendarIcon,
    ChevronLeft,
    ChevronRight,
    Sparkles,
    Filter,
    Search,
    RefreshCw,
    ArrowLeftRight,
    Trash2,
    CheckCircle2,
    AlertCircle,
    X,
    Clock,
    Users,
    CalendarRange,
    Copy,
    Download,
    Printer,
    Lock,
    AlertTriangle,
    Loader2,
    ShieldCheck,
    Layers,
    UserPlus,
    UserMinus,
    Plus,
    Check,
    ChevronDown,
    ChevronUp,
    HelpCircle,
    Info,
    CalendarDays,
    Settings,
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
    pattern_type: 'daily' | 'weekly' | 'cyclical';
    cycle_length_days: number;
    pattern_data: any;
    is_active: boolean;
}

interface Department {
    id: string;
    name: string;
    code: string;
}

interface RosterHeader {
    id: string;
    name: string;
    code: string;
    department_id: string | null;
    start_date: string;
    end_date: string;
    status: 'draft' | 'published' | 'locked' | 'archived';
    published_at: string | null;
    notes?: string | null;
    department?: Department | null;
    publisher?: { id: number; name: string } | null;
    groups_count?: number;
    entries_count?: number;
}

interface RosterGroup {
    id: string;
    roster_id: string;
    roster_pattern_id?: string | null;
    name: string;
    code: string;
    color: string | null;
    description?: string | null;
    pattern?: RosterPattern | null;
    employees?: {
        id: string;
        emp_no: string;
        full_name: string;
        department?: { id: string; name: string } | null;
    }[];
}

interface AvailableEmployee {
    id: string;
    emp_no: string;
    full_name: string;
    department_name: string;
    designation_title: string;
    is_available: boolean;
    exclusion_reason?: string | null;
}

interface DayHeader {
    day: number;
    date: string;
    day_name: string;
    is_weekend: boolean;
    is_sunday: boolean;
    is_saturday: boolean;
    holiday: {
        id: string;
        name: string;
        type: string;
    } | null;
}

interface MatrixCell {
    entry_id: string | null;
    date: string;
    schedule_type: 'shift' | 'rest_day' | 'off' | null;
    shift: Shift | null;
    original_shift?: {
        id: string;
        name: string;
        code: string;
        color: string | null;
    } | null;
    status: 'draft' | 'published' | 'locked' | null;
    is_overridden: boolean;
    override_reason?: string | null;
    overridden_by?: string | null;
    notes: string | null;
    fatigue_warning?: boolean;
    rest_hours?: number | null;
    leave: {
        id: string;
        leave_type: string;
        leave_code: string;
        is_half_day: boolean;
    } | null;
}

interface MatrixRow {
    employee: {
        id: string;
        emp_no: string;
        full_name: string;
        department: { id: string; name: string } | null;
    };
    squad?: {
        id: string;
        name: string;
        code: string;
        color: string | null;
        pattern_name?: string | null;
    } | null;
    cells: Record<string, MatrixCell>;
    stats: {
        work_days: number;
        rest_days: number;
        total_hours: number;
    };
}

interface Props {
    year: number;
    month: number;
    month_name: string;
    days: DayHeader[];
    matrix: MatrixRow[];
    shifts: Shift[];
    patterns: RosterPattern[];
    departments: Department[];
    selected_department: string | null;
    rosters: RosterHeader[];
    active_roster: RosterHeader | null;
    squads: RosterGroup[];
    available_employees: AvailableEmployee[];
    coverage_summary?: Record<string, {
        shifts: Record<string, number>;
        total_working: number;
        total_rest: number;
        total_leave: number;
    }>;
    is_payroll_locked?: boolean;
    summary: {
        total_employees: number;
        total_scheduled_shifts: number;
        total_rest_days: number;
        draft_entries: number;
        published_entries: number;
        is_published: boolean;
    };
}

export default function Index({
    year,
    month,
    month_name,
    days,
    matrix,
    shifts,
    patterns,
    departments,
    selected_department,
    rosters,
    active_roster,
    squads,
    available_employees,
    coverage_summary,
    is_payroll_locked = false,
    summary,
}: Props) {
    const [searchQuery, setSearchQuery] = useState('');
    const [viewMode, setViewMode] = useState<'squad' | 'flat'>('squad');
    const [squadFilter, setSquadFilter] = useState<string>('all');
    const [collapsedSquads, setCollapsedSquads] = useState<Record<string, boolean>>({});

    // Modals & Drawers
    const [isNewRosterModalOpen, setIsNewRosterModalOpen] = useState(false);
    const [isCloneModalOpen, setIsCloneModalOpen] = useState(false);
    const [isManageMembersModalOpen, setIsManageMembersModalOpen] = useState(false);
    const [targetSquadForEnroll, setTargetSquadForEnroll] = useState<RosterGroup | null>(null);
    const [isSwapModalOpen, setIsSwapModalOpen] = useState(false);
    const [selectedCell, setSelectedCell] = useState<{
        employeeId: string;
        employeeName: string;
        date: string;
        cell: MatrixCell;
    } | null>(null);

    // Filter matrix rows
    const filteredMatrix = useMemo(() => {
        return matrix.filter((row) => {
            const matchesSearch =
                row.employee.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                row.employee.emp_no.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (row.employee.department?.name && row.employee.department.name.toLowerCase().includes(searchQuery.toLowerCase()));

            const matchesSquad = squadFilter === 'all' || row.squad?.id === squadFilter;

            return matchesSearch && matchesSquad;
        });
    }, [matrix, searchQuery, squadFilter]);

    // Group rows by Squad for Squad View
    const groupedBySquad = useMemo(() => {
        const groups: Record<string, { squad: RosterGroup | { id: string; name: string; color: string; pattern_name?: string }; rows: MatrixRow[] }> = {};

        // Prepopulate all squads belonging to active roster
        squads.forEach((sq) => {
            groups[sq.id] = { squad: sq, rows: [] };
        });

        // Add 'Unassigned' group bucket
        groups['unassigned'] = {
            squad: { id: 'unassigned', name: 'General / Unassigned to Squad', color: '#64748b' },
            rows: [],
        };

        filteredMatrix.forEach((row) => {
            const sqId = row.squad?.id || 'unassigned';
            if (!groups[sqId]) {
                groups[sqId] = {
                    squad: row.squad || { id: sqId, name: 'Other Group', color: '#64748b' },
                    rows: [],
                };
            }
            groups[sqId].rows.push(row);
        });

        // Filter out empty unassigned bucket if empty
        if (groups['unassigned'].rows.length === 0 && squads.length > 0) {
            delete groups['unassigned'];
        }

        return groups;
    }, [filteredMatrix, squads]);

    // Navigation & Switchers
    const handleRosterChange = (rosterId: string) => {
        router.get('/roster', { roster_id: rosterId }, { preserveState: false });
    };

    const navigateMonth = (targetYear: number, targetMonth: number) => {
        router.get(
            '/roster',
            {
                year: targetYear,
                month: targetMonth,
                roster_id: active_roster?.id,
            },
            { preserveState: true }
        );
    };

    const handlePrevMonth = () => {
        let newMonth = month - 1;
        let newYear = year;
        if (newMonth < 1) {
            newMonth = 12;
            newYear -= 1;
        }
        navigateMonth(newYear, newMonth);
    };

    const handleNextMonth = () => {
        let newMonth = month + 1;
        let newYear = year;
        if (newMonth > 12) {
            newMonth = 1;
            newYear += 1;
        }
        navigateMonth(newYear, newMonth);
    };

    // Forms
    // 1. Single Cell Override Form
    const cellForm = useForm({
        employee_id: '',
        date: '',
        shift_id: '',
        schedule_type: 'shift' as 'shift' | 'rest_day' | 'off',
        override_reason: 'Sick Cover',
        notes: '',
        status: 'published',
    });

    const openCellDrawer = (empId: string, empName: string, date: string, cell: MatrixCell) => {
        if (is_payroll_locked) {
            alert('Cannot edit roster entries for a finalized and locked payroll period.');
            return;
        }

        setSelectedCell({ employeeId: empId, employeeName: empName, date, cell });
        cellForm.setData({
            employee_id: empId,
            date: date,
            shift_id: cell.shift?.id || shifts[0]?.id || '',
            schedule_type: cell.schedule_type || 'shift',
            override_reason: cell.override_reason || 'Supervisor Operational Reassignment',
            notes: cell.notes || '',
            status: cell.status || 'published',
        });
    };

    const handleCellSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        cellForm.post('/roster/entry', {
            preserveScroll: true,
            onSuccess: () => setSelectedCell(null),
        });
    };

    // 2. New Roster Form
    const newRosterForm = useForm({
        name: `${month_name} - Operations Roster`,
        code: `RST-${year}-${String(month).padStart(2, '0')}-OPS`,
        department_id: departments[0]?.id || '',
        start_date: `${year}-${String(month).padStart(2, '0')}-01`,
        end_date: (() => {
            const lastDay = new Date(year, month, 0).getDate();
            return `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
        })(),
        status: 'draft',
        notes: '',
    });

    const handleNewRosterSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        newRosterForm.post('/roster/rosters', {
            onSuccess: () => setIsNewRosterModalOpen(false),
        });
    };

    // 3. Clone Roster Form
    const cloneForm = useForm({
        name: '',
        start_date: '',
        end_date: '',
    });

    const openCloneModal = () => {
        if (!active_roster) return;
        const curStart = new Date(active_roster.start_date);
        curStart.setMonth(curStart.getMonth() + 1);
        const y = curStart.getFullYear();
        const m = curStart.getMonth() + 1;
        const lastD = new Date(y, m, 0).getDate();

        const monthName = curStart.toLocaleString('default', { month: 'long' });

        cloneForm.setData({
            name: `${monthName} ${y} - ${active_roster.name.replace(/^[A-Za-z]+ \d{4} - /, '')}`,
            start_date: `${y}-${String(m).padStart(2, '0')}-01`,
            end_date: `${y}-${String(m).padStart(2, '0')}-${String(lastD).padStart(2, '0')}`,
        });
        setIsCloneModalOpen(true);
    };

    const handleCloneSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!active_roster) return;
        cloneForm.post(`/roster/rosters/${active_roster.id}/clone`, {
            onSuccess: () => setIsCloneModalOpen(false),
        });
    };

    // 4. Enroll Members Form
    const [selectedEnrollEmpIds, setSelectedEnrollEmpIds] = useState<string[]>([]);
    const [memberSearchQuery, setMemberSearchQuery] = useState('');
    const [memberDeptFilter, setMemberDeptFilter] = useState('all');

    const openManageMembers = (squad: RosterGroup) => {
        setTargetSquadForEnroll(squad);
        setSelectedEnrollEmpIds([]);
        setMemberSearchQuery('');
        setIsManageMembersModalOpen(true);
    };

    const handleEnrollSubmit = () => {
        if (!targetSquadForEnroll || selectedEnrollEmpIds.length === 0) return;
        router.post(
            `/roster/squads/${targetSquadForEnroll.id}/enroll`,
            { employee_ids: selectedEnrollEmpIds },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setSelectedEnrollEmpIds([]);
                    setIsManageMembersModalOpen(false);
                },
            }
        );
    };

    const handleRemoveMember = (squadId: string, empId: string, empName: string) => {
        if (confirm(`Are you sure you want to remove ${empName} from this squad?`)) {
            router.post(
                `/roster/squads/${squadId}/remove-member`,
                { employee_id: empId },
                { preserveScroll: true }
            );
        }
    };

    // 5. Shift Swap Form
    const swapForm = useForm({
        employee_a_id: matrix[0]?.employee.id || '',
        employee_b_id: matrix[1]?.employee.id || '',
        date: days[0]?.date || `${year}-${String(month).padStart(2, '0')}-01`,
        reason: 'Mutual shift trade',
    });

    const handleSwapSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        swapForm.post('/roster/swap', {
            preserveScroll: true,
            onSuccess: () => setIsSwapModalOpen(false),
        });
    };

    // 6. 1-Click Roster Sync
    const handleSyncRoster = () => {
        if (!active_roster) return;
        if (confirm(`Synchronize calendar entries for all squads in '${active_roster.name}'? Existing manual supervisor overrides will be preserved.`)) {
            router.post(`/roster/rosters/${active_roster.id}/sync`, {}, { preserveScroll: true });
        }
    };

    // 7. Publish / Draft Toggle
    const handlePublishToggle = (publish: boolean) => {
        if (!active_roster) return;
        router.post(
            `/roster/rosters/${active_roster.id}/publish`,
            { publish },
            { preserveScroll: true }
        );
    };

    const toggleSquadCollapse = (squadId: string) => {
        setCollapsedSquads((prev) => ({ ...prev, [squadId]: !prev[squadId] }));
    };

    const isGlobalProcessing =
        cellForm.processing ||
        newRosterForm.processing ||
        cloneForm.processing ||
        swapForm.processing;

    const renderMatrixRow = (row: MatrixRow) => {
        return (
            <tr key={row.employee.id} className="hover:bg-slate-800/40 transition">
                {/* Employee Name (Sticky Left) */}
                <td className="sticky left-0 z-20 bg-slate-900 px-4 py-2.5 border-r border-slate-800 max-w-[260px]">
                    <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                            <div className="font-bold text-white truncate text-xs">
                                {row.employee.full_name}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono truncate">
                                {row.employee.emp_no} &bull; {row.employee.department?.name || 'General'}
                            </div>
                        </div>
                        {row.squad && viewMode === 'flat' && (
                            <span
                                className="text-[9px] font-bold px-1.5 py-0.5 rounded text-white shrink-0"
                                style={{ backgroundColor: row.squad.color || '#3b82f6' }}
                            >
                                {row.squad.code}
                            </span>
                        )}
                    </div>
                </td>

                {/* Calendar Date Cells */}
                {days.map((d) => {
                    const cell = row.cells[d.date];
                    if (!cell) {
                        return (
                            <td
                                key={d.date}
                                onClick={() => openCellDrawer(row.employee.id, row.employee.full_name, d.date, {} as any)}
                                className="border-r border-slate-800/60 text-center p-0.5 hover:bg-indigo-600/20 cursor-pointer"
                            >
                                <span className="text-[10px] text-slate-600">-</span>
                            </td>
                        );
                    }

                    const isRest = cell.schedule_type === 'rest_day' || cell.schedule_type === 'off';
                    const hasLeave = cell.leave !== null;
                    const isOverridden = cell.is_overridden;

                    return (
                        <td
                            key={d.date}
                            onClick={() => openCellDrawer(row.employee.id, row.employee.full_name, d.date, cell)}
                            className={`border-r border-slate-800/60 p-0.5 text-center relative cursor-pointer transition select-none hover:ring-1 hover:ring-indigo-400 ${
                                isRest
                                    ? 'bg-slate-950/40 text-slate-500'
                                    : cell.shift
                                    ? 'text-white'
                                    : 'text-slate-600'
                            }`}
                        >
                            {/* Operational Override Amber Indicator Dot */}
                            {isOverridden && (
                                <span
                                    className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-amber-400 ring-2 ring-slate-900"
                                    title={`Operational Override:\nOriginal: ${cell.original_shift?.name || 'Base Pattern'}\nReason: ${cell.override_reason || 'Manual override'}\nBy: ${cell.overridden_by || 'Supervisor'}`}
                                />
                            )}

                            {/* Fatigue Warning Indicator */}
                            {cell.fatigue_warning && (
                                <span
                                    className="absolute bottom-0.5 left-0.5 w-1.5 h-1.5 rounded-full bg-rose-500"
                                    title={`Fatigue Warning: Rest gap < 11h (${cell.rest_hours}h turnaround)`}
                                />
                            )}

                            {hasLeave ? (
                                <span className="inline-block px-1 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                    {cell.leave?.leave_code || 'LV'}
                                </span>
                            ) : isRest ? (
                                <span className="text-[10px] font-mono text-slate-500 font-semibold">
                                    OFF
                                </span>
                            ) : cell.shift ? (
                                <span
                                    className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold font-mono tracking-tighter truncate max-w-full"
                                    style={{
                                        backgroundColor: cell.shift.color ? `${cell.shift.color}22` : '#3b82f622',
                                        borderColor: cell.shift.color || '#3b82f6',
                                        color: cell.shift.color || '#93c5fd',
                                        borderWidth: '1px',
                                    }}
                                    title={`${cell.shift.name} (${cell.shift.start_time} - ${cell.shift.end_time})`}
                                >
                                    {cell.shift.code}
                                </span>
                            ) : (
                                <span className="text-[10px] text-slate-600">-</span>
                            )}
                        </td>
                    );
                })}

                {/* Summary Hours */}
                <td className="px-2 py-2 text-center font-bold text-slate-300 font-mono text-xs">
                    {row.stats.total_hours}h
                </td>
            </tr>
        );
    };

    return (
        <AuthenticatedLayout>
            <Head title={`Duty Roster - ${active_roster ? active_roster.name : month_name}`} />

            {/* Print Stylesheet for Noticeboards */}
            <style>{`
                @media print {
                    body { background: white !important; color: black !important; }
                    nav, header, .no-print { display: none !important; }
                    .print-only { display: block !important; }
                    table { width: 100% !important; border-collapse: collapse !important; }
                    th, td { border: 1px solid #cbd5e1 !important; padding: 4px !important; }
                }
            `}</style>

            <div className="max-w-[1780px] mx-auto space-y-4 pb-12">
                {/* 1. Header & Roster Switcher Bar */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl relative overflow-hidden">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        {/* Title & Active Roster Selector */}
                        <div className="space-y-1.5">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wider uppercase bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                                    Enterprise Workforce Scheduling
                                </span>
                                {active_roster?.status === 'published' ? (
                                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                                        <CheckCircle2 className="w-3 h-3" />
                                        <span>Published &amp; Active</span>
                                    </span>
                                ) : active_roster?.status === 'locked' ? (
                                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-500/10 text-sky-400 border border-sky-500/30 flex items-center gap-1">
                                        <Lock className="w-3 h-3" />
                                        <span>Payroll Finalized</span>
                                    </span>
                                ) : (
                                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center gap-1">
                                        <AlertTriangle className="w-3 h-3" />
                                        <span>Draft Mode</span>
                                    </span>
                                )}
                            </div>

                            <div className="flex flex-wrap items-center gap-3">
                                {/* Named Roster Dropdown */}
                                <div className="relative">
                                    <select
                                        value={active_roster?.id || ''}
                                        onChange={(e) => handleRosterChange(e.target.value)}
                                        className="bg-slate-950 border border-slate-700 text-white font-bold text-base sm:text-lg rounded-xl px-3.5 py-1.5 pr-9 hover:border-indigo-500 focus:ring-2 focus:ring-indigo-500 transition shadow-inner cursor-pointer"
                                    >
                                        {rosters.map((rst) => (
                                            <option key={rst.id} value={rst.id}>
                                                {rst.name} ({rst.status.toUpperCase()})
                                            </option>
                                        ))}
                                        {rosters.length === 0 && <option value="">No Rosters Found</option>}
                                    </select>
                                </div>

                                <button
                                    onClick={() => setIsNewRosterModalOpen(true)}
                                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 hover:border-slate-600 transition flex items-center gap-1.5 shadow-sm"
                                    title="Create a new Named Roster"
                                >
                                    <Plus className="w-3.5 h-3.5 text-indigo-400" />
                                    <span>New Roster</span>
                                </button>

                                {active_roster && (
                                    <button
                                        onClick={openCloneModal}
                                        className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 hover:border-slate-600 transition flex items-center gap-1.5 shadow-sm"
                                        title="Clone this roster to next month"
                                    >
                                        <Copy className="w-3.5 h-3.5 text-sky-400" />
                                        <span>Clone</span>
                                    </button>
                                )}
                            </div>

                            {active_roster && (
                                <p className="text-xs text-slate-400 flex items-center gap-3">
                                    <span>
                                        Period: <strong className="text-slate-300 font-mono">{active_roster.start_date} &rarr; {active_roster.end_date}</strong>
                                    </span>
                                    <span>&bull;</span>
                                    <span>
                                        Department: <strong className="text-slate-300">{active_roster.department?.name || 'All Company'}</strong>
                                    </span>
                                </p>
                            )}
                        </div>

                        {/* Top Operational Action Buttons */}
                        <div className="flex flex-wrap items-center gap-2">
                            {active_roster && (
                                <>
                                    <button
                                        onClick={handleSyncRoster}
                                        className="px-3 py-2 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-semibold flex items-center gap-1.5 transition shadow-sm"
                                        title="Recalculate squad patterns for the month (preserves manual overrides)"
                                    >
                                        <RefreshCw className="w-3.5 h-3.5 text-indigo-400" />
                                        <span>Sync Dates</span>
                                    </button>

                                    {active_roster.status === 'published' ? (
                                        <button
                                            onClick={() => handlePublishToggle(false)}
                                            className="px-3 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-xs font-semibold flex items-center gap-1.5 transition shadow-sm"
                                            title="Revert Roster to Draft"
                                        >
                                            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                                            <span>Draft Mode</span>
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => handlePublishToggle(true)}
                                            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-md"
                                            title="Publish Roster as official operational schedule"
                                        >
                                            <ShieldCheck className="w-3.5 h-3.5" />
                                            <span>Publish Official</span>
                                        </button>
                                    )}
                                </>
                            )}

                            <button
                                onClick={() => setIsSwapModalOpen(true)}
                                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition shadow-sm"
                            >
                                <ArrowLeftRight className="w-3.5 h-3.5 text-sky-400" />
                                <span>Swap Shift</span>
                            </button>

                            <Link
                                href="/roster/patterns"
                                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition shadow-sm"
                                title="Pattern & Rotation Formulas Library"
                            >
                                <Layers className="w-3.5 h-3.5 text-purple-400" />
                                <span>Pattern Library</span>
                            </Link>

                            <button
                                onClick={() => window.print()}
                                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
                                title="Print Wall Noticeboard"
                            >
                                <Printer className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* 2. Control & Filter Strip */}
                <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-md">
                    {/* View Switcher & Squad Filter */}
                    <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
                        {/* View Switcher */}
                        <div className="bg-slate-950 p-1 rounded-xl border border-slate-800 flex items-center text-xs font-semibold">
                            <button
                                onClick={() => setViewMode('squad')}
                                className={`px-3 py-1 rounded-lg transition ${
                                    viewMode === 'squad'
                                        ? 'bg-indigo-600 text-white shadow-sm'
                                        : 'text-slate-400 hover:text-white'
                                }`}
                            >
                                Group by Squad
                            </button>
                            <button
                                onClick={() => setViewMode('flat')}
                                className={`px-3 py-1 rounded-lg transition ${
                                    viewMode === 'flat'
                                        ? 'bg-indigo-600 text-white shadow-sm'
                                        : 'text-slate-400 hover:text-white'
                                }`}
                            >
                                All Personnel
                            </button>
                        </div>

                        {/* Squad Filter Dropdown */}
                        <div className="relative">
                            <select
                                value={squadFilter}
                                onChange={(e) => setSquadFilter(e.target.value)}
                                className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl px-3 py-1.5 pr-8 hover:border-slate-700 focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                            >
                                <option value="all">All Squads ({squads.length})</option>
                                {squads.map((sq) => (
                                    <option key={sq.id} value={sq.id}>
                                        {sq.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Search Input */}
                        <div className="relative flex-1 sm:w-60">
                            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search employee..."
                                className="bg-slate-950 border border-slate-800 text-white text-xs rounded-xl pl-9 pr-3 py-1.5 w-full focus:ring-1 focus:ring-indigo-500 placeholder-slate-500"
                            />
                        </div>
                    </div>

                    {/* Month Navigator */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handlePrevMonth}
                            className="p-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 transition"
                            title="Previous Month"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <span className="font-bold text-xs text-white px-2 font-mono">
                            {month_name}
                        </span>
                        <button
                            onClick={handleNextMonth}
                            className="p-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 transition"
                            title="Next Month"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* 3. Main Roster Matrix Table */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
                    <div className="overflow-x-auto max-h-[750px] relative">
                        <table className="w-full text-left border-collapse text-xs">
                            {/* Sticky Header */}
                            <thead className="sticky top-0 z-30 bg-slate-950 border-b border-slate-800">
                                <tr>
                                    {/* Employee Info Header (Sticky Left) */}
                                    <th className="sticky left-0 z-40 bg-slate-950 px-4 py-3 min-w-[220px] max-w-[260px] font-bold text-slate-300 border-r border-slate-800">
                                        <div className="flex items-center justify-between">
                                            <span>Personnel</span>
                                            <span className="text-[10px] text-slate-500 font-mono">
                                                {filteredMatrix.length} Staff
                                            </span>
                                        </div>
                                    </th>

                                    {/* Days Headers */}
                                    {days.map((d) => (
                                        <th
                                            key={d.date}
                                            className={`px-1.5 py-2 text-center min-w-[36px] max-w-[42px] border-r border-slate-800/80 ${
                                                d.is_sunday
                                                    ? 'bg-rose-950/20 text-rose-300'
                                                    : d.is_saturday
                                                    ? 'bg-amber-950/20 text-amber-300'
                                                    : 'text-slate-300'
                                            }`}
                                        >
                                            <div className="text-[10px] font-mono text-slate-400 uppercase">
                                                {d.day_name}
                                            </div>
                                            <div className="text-xs font-bold font-mono text-white">
                                                {d.day}
                                            </div>
                                            {d.holiday && (
                                                <div
                                                    className="w-1.5 h-1.5 rounded-full bg-rose-500 mx-auto mt-0.5"
                                                    title={`Public Holiday: ${d.holiday.name}`}
                                                />
                                            )}
                                        </th>
                                    ))}

                                    {/* Summary Stats Header */}
                                    <th className="px-3 py-3 text-center min-w-[70px] font-bold text-slate-300 bg-slate-950">
                                        Hours
                                    </th>
                                </tr>
                            </thead>

                            {/* Table Body */}
                            <tbody className="divide-y divide-slate-800/60">
                                {viewMode === 'squad' ? (
                                    // SQUAD GROUPED VIEW
                                    Object.entries(groupedBySquad).map(([sqId, groupData]) => {
                                        const squad = groupData.squad;
                                        const rows = groupData.rows;
                                        const isCollapsed = collapsedSquads[sqId];

                                        return (
                                            <React.Fragment key={sqId}>
                                                {/* Squad Header Row */}
                                                <tr className="bg-slate-950/90 border-y border-indigo-500/20">
                                                    <td
                                                        colSpan={days.length + 2}
                                                        className="px-4 py-2 text-xs font-bold text-white"
                                                    >
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-3">
                                                                <button
                                                                    onClick={() => toggleSquadCollapse(sqId)}
                                                                    className="p-1 rounded text-slate-400 hover:text-white"
                                                                >
                                                                    {isCollapsed ? (
                                                                        <ChevronDown className="w-4 h-4" />
                                                                    ) : (
                                                                        <ChevronUp className="w-4 h-4" />
                                                                    )}
                                                                </button>
                                                                <span
                                                                    className="w-2.5 h-2.5 rounded-full shrink-0"
                                                                    style={{ backgroundColor: squad.color || '#3b82f6' }}
                                                                />
                                                                <span className="font-bold text-white text-xs">
                                                                    {squad.name}
                                                                </span>
                                                                {'pattern' in squad && squad.pattern && (
                                                                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                                                                        Pattern: {squad.pattern.name} ({squad.pattern.cycle_length_days}d cycle)
                                                                    </span>
                                                                )}
                                                                <span className="text-[10px] text-slate-400 font-mono">
                                                                    ({rows.length} Members)
                                                                </span>
                                                            </div>

                                                            {/* Squad Actions: Add Staff */}
                                                            {'roster_id' in squad && (
                                                                <button
                                                                    onClick={() => openManageMembers(squad as RosterGroup)}
                                                                    className="px-2.5 py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-[11px] font-semibold flex items-center gap-1.5 transition"
                                                                >
                                                                    <UserPlus className="w-3.5 h-3.5" />
                                                                    <span>Add / Manage Staff</span>
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>

                                                {/* Squad Member Rows */}
                                                {!isCollapsed &&
                                                    rows.map((row) => renderMatrixRow(row))}

                                                {!isCollapsed && rows.length === 0 && (
                                                    <tr>
                                                        <td
                                                            colSpan={days.length + 2}
                                                            className="px-6 py-4 text-center text-xs text-slate-500 italic"
                                                        >
                                                            No personnel enrolled in this squad yet.{' '}
                                                            {'roster_id' in squad && (
                                                                <button
                                                                    onClick={() => openManageMembers(squad as RosterGroup)}
                                                                    className="text-indigo-400 underline font-semibold ml-1"
                                                                >
                                                                    Enroll Staff Now
                                                                </button>
                                                            )}
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        );
                                    })
                                ) : (
                                    // FLAT STAFF VIEW
                                    filteredMatrix.map((row) => renderMatrixRow(row))
                                )}

                                {filteredMatrix.length === 0 && (
                                    <tr>
                                        <td
                                            colSpan={days.length + 2}
                                            className="px-6 py-12 text-center text-slate-400"
                                        >
                                            <AlertCircle className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                                            <p className="text-sm font-semibold text-white">
                                                No personnel roster entries found.
                                            </p>
                                            <p className="text-xs text-slate-500 mt-1">
                                                Enroll staff into squads or create a new Named Roster.
                                            </p>
                                        </td>
                                    </tr>
                                )}
                            </tbody>

                            {/* Sticky Daily Coverage Summary Footer */}
                            {coverage_summary && (
                                <tfoot className="sticky bottom-0 z-30 bg-slate-950 border-t-2 border-slate-700 text-xs font-mono font-semibold">
                                    <tr>
                                        <td className="sticky left-0 z-40 bg-slate-950 px-4 py-2.5 font-bold text-white border-r border-slate-800">
                                            Daily On-Duty Count
                                        </td>
                                        {days.map((d) => {
                                            const cov = coverage_summary[d.date];
                                            const working = cov?.total_working || 0;
                                            return (
                                                <td
                                                    key={d.date}
                                                    className="px-1 py-2 text-center border-r border-slate-800 text-[11px]"
                                                >
                                                    <span
                                                        className={`font-bold ${
                                                            working > 0 ? 'text-emerald-400' : 'text-slate-500'
                                                        }`}
                                                    >
                                                        {working}
                                                    </span>
                                                </td>
                                            );
                                        })}
                                        <td className="text-center font-bold text-indigo-400 px-2">
                                            Total
                                        </td>
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>
                </div>
            </div>



            {/* MODAL 1: Operational Cell Override Drawer */}
            {selectedCell && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl relative">
                        <button
                            onClick={() => setSelectedCell(null)}
                            className="absolute top-4 right-4 text-slate-400 hover:text-white"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <div>
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                                Operational Shift Override
                            </span>
                            <h3 className="text-base font-bold text-white mt-1">
                                {selectedCell.employeeName}
                            </h3>
                            <p className="text-xs text-slate-400 font-mono">
                                Date: {selectedCell.date}
                            </p>
                        </div>

                        <form onSubmit={handleCellSubmit} className="space-y-3.5">
                            {/* Schedule Type */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1">
                                    Duty Status
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => cellForm.setData('schedule_type', 'shift')}
                                        className={`py-2 px-3 rounded-xl border text-xs font-semibold transition ${
                                            cellForm.data.schedule_type === 'shift'
                                                ? 'bg-indigo-600 border-indigo-500 text-white'
                                                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                                        }`}
                                    >
                                        Working Shift
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => cellForm.setData('schedule_type', 'rest_day')}
                                        className={`py-2 px-3 rounded-xl border text-xs font-semibold transition ${
                                            cellForm.data.schedule_type === 'rest_day'
                                                ? 'bg-slate-800 border-slate-600 text-white'
                                                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                                        }`}
                                    >
                                        Rest Day (OFF)
                                    </button>
                                </div>
                            </div>

                            {/* Shift Selector */}
                            {cellForm.data.schedule_type === 'shift' && (
                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                                        Assigned Shift
                                    </label>
                                    <select
                                        value={cellForm.data.shift_id}
                                        onChange={(e) => cellForm.setData('shift_id', e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:ring-1 focus:ring-indigo-500"
                                    >
                                        {shifts.map((s) => (
                                            <option key={s.id} value={s.id}>
                                                {s.name} ({s.code}: {s.start_time} - {s.end_time})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* Reason for Override */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1">
                                    Reason for Override (Audit Log)
                                </label>
                                <select
                                    value={cellForm.data.override_reason}
                                    onChange={(e) => cellForm.setData('override_reason', e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:ring-1 focus:ring-indigo-500"
                                >
                                    <option value="Sick Cover">Sick Cover (Relief for absent colleague)</option>
                                    <option value="Shift Swap">Approved Shift Swap</option>
                                    <option value="Extra Duty / Extend">Extra Duty / Operational Surge</option>
                                    <option value="Staff Shortage">Line Staff Shortage</option>
                                    <option value="Personal Request">Employee Personal Request</option>
                                    <option value="Supervisor Operational Reassignment">Supervisor Operational Reassignment</option>
                                </select>
                            </div>

                            {/* Notes */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1">
                                    Supervisor Notes
                                </label>
                                <input
                                    type="text"
                                    value={cellForm.data.notes}
                                    onChange={(e) => cellForm.setData('notes', e.target.value)}
                                    placeholder="Optional reason details..."
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:ring-1 focus:ring-indigo-500 placeholder-slate-600"
                                />
                            </div>

                            <div className="pt-2 flex items-center justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setSelectedCell(null)}
                                    className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={cellForm.processing}
                                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-md transition disabled:opacity-50"
                                >
                                    {cellForm.processing ? 'Saving...' : 'Apply Shift Change'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL 2: Add / Manage Squad Members (With Exclusivity Guard) */}
            {isManageMembersModalOpen && targetSquadForEnroll && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-5 space-y-4 shadow-2xl relative max-h-[85vh] flex flex-col">
                        <button
                            onClick={() => setIsManageMembersModalOpen(false)}
                            className="absolute top-4 right-4 text-slate-400 hover:text-white"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <div>
                            <div className="flex items-center gap-2">
                                <span
                                    className="w-3 h-3 rounded-full"
                                    style={{ backgroundColor: targetSquadForEnroll.color || '#3b82f6' }}
                                />
                                <h3 className="text-base font-bold text-white">
                                    Manage Squad Members: {targetSquadForEnroll.name}
                                </h3>
                            </div>
                            <p className="text-xs text-slate-400 mt-1">
                                Enrolled personnel rotate automatically using the squad's attached pattern. Exclusivity guard prevents duplicate roster scheduling.
                            </p>
                        </div>

                        {/* Currently Enrolled Members */}
                        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
                            <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                                Currently Enrolled in {targetSquadForEnroll.code} ({(targetSquadForEnroll.employees || []).length})
                            </span>
                            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                                {(targetSquadForEnroll.employees || []).map((emp) => (
                                    <div
                                        key={emp.id}
                                        className="flex items-center gap-1.5 bg-slate-900 border border-slate-700 px-2.5 py-1 rounded-lg text-xs text-white"
                                    >
                                        <span className="font-semibold">{emp.full_name}</span>
                                        <span className="text-[10px] text-slate-400 font-mono">({emp.emp_no})</span>
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveMember(targetSquadForEnroll.id, emp.id, emp.full_name)}
                                            className="text-slate-400 hover:text-rose-400 ml-1"
                                            title="Unassign from this squad"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                ))}
                                {(targetSquadForEnroll.employees || []).length === 0 && (
                                    <span className="text-xs text-slate-500 italic">No personnel enrolled yet.</span>
                                )}
                            </div>
                        </div>

                        {/* Available Personnel List (Exclusivity Filtered) */}
                        <div className="space-y-2 flex-1 overflow-hidden flex flex-col">
                            <div className="flex items-center justify-between">
                                <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                                    Available Personnel to Enroll
                                </span>
                                <span className="text-[10px] text-emerald-400 font-semibold">
                                    {selectedEnrollEmpIds.length} Selected
                                </span>
                            </div>

                            <div className="flex items-center gap-2">
                                <div className="relative flex-1">
                                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                    <input
                                        type="text"
                                        value={memberSearchQuery}
                                        onChange={(e) => setMemberSearchQuery(e.target.value)}
                                        placeholder="Search available staff..."
                                        className="bg-slate-950 border border-slate-800 text-white text-xs rounded-xl pl-9 pr-3 py-1.5 w-full focus:ring-1 focus:ring-indigo-500"
                                    />
                                </div>
                            </div>

                            {/* Staff Scrollable List */}
                            <div className="flex-1 overflow-y-auto divide-y divide-slate-800 border border-slate-800 rounded-xl bg-slate-950">
                                {available_employees
                                    .filter((emp) => {
                                        const matchesSearch =
                                            emp.full_name.toLowerCase().includes(memberSearchQuery.toLowerCase()) ||
                                            emp.emp_no.toLowerCase().includes(memberSearchQuery.toLowerCase()) ||
                                            emp.department_name.toLowerCase().includes(memberSearchQuery.toLowerCase());
                                        return matchesSearch;
                                    })
                                    .map((emp) => {
                                        const isSelected = selectedEnrollEmpIds.includes(emp.id);
                                        const isAlreadyInThisSquad = (targetSquadForEnroll.employees || []).some(
                                            (e) => e.id === emp.id
                                        );

                                        return (
                                            <div
                                                key={emp.id}
                                                className={`p-2.5 flex items-center justify-between transition ${
                                                    isAlreadyInThisSquad
                                                        ? 'opacity-40 bg-slate-900/50'
                                                        : !emp.is_available
                                                        ? 'opacity-50 bg-rose-950/10'
                                                        : isSelected
                                                        ? 'bg-indigo-950/40'
                                                        : 'hover:bg-slate-900'
                                                }`}
                                            >
                                                <div className="flex items-center gap-2.5">
                                                    <input
                                                        type="checkbox"
                                                        disabled={isAlreadyInThisSquad || !emp.is_available}
                                                        checked={isSelected}
                                                        onChange={(e) => {
                                                            if (e.target.checked) {
                                                                setSelectedEnrollEmpIds((prev) => [...prev, emp.id]);
                                                            } else {
                                                                setSelectedEnrollEmpIds((prev) =>
                                                                    prev.filter((id) => id !== emp.id)
                                                                );
                                                            }
                                                        }}
                                                        className="rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500 disabled:opacity-30 cursor-pointer"
                                                    />
                                                    <div>
                                                        <div className="font-semibold text-white text-xs">
                                                            {emp.full_name}
                                                        </div>
                                                        <div className="text-[10px] text-slate-400 font-mono">
                                                            {emp.emp_no} &bull; {emp.department_name} ({emp.designation_title})
                                                        </div>
                                                    </div>
                                                </div>

                                                <div>
                                                    {isAlreadyInThisSquad ? (
                                                        <span className="text-[10px] text-slate-500 font-mono">Already in Squad</span>
                                                    ) : !emp.is_available ? (
                                                        <span className="text-[10px] text-rose-400 font-bold bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                                                            Rostered in Other Squad
                                                        </span>
                                                    ) : (
                                                        <span className="text-[10px] text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                                                            Available
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                            </div>
                        </div>

                        <div className="pt-2 flex items-center justify-between border-t border-slate-800">
                            <span className="text-xs text-slate-400">
                                Enrolling staff automatically syncs their monthly duty roster.
                            </span>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setIsManageMembersModalOpen(false)}
                                    className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    disabled={selectedEnrollEmpIds.length === 0}
                                    onClick={handleEnrollSubmit}
                                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-md transition disabled:opacity-40"
                                >
                                    Enroll Selected ({selectedEnrollEmpIds.length})
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL 3: Create New Named Roster */}
            {isNewRosterModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl relative">
                        <button
                            onClick={() => setIsNewRosterModalOpen(false)}
                            className="absolute top-4 right-4 text-slate-400 hover:text-white"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <div>
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                                Setup Workforce Schedule
                            </span>
                            <h3 className="text-base font-bold text-white mt-1">
                                Create Named Roster
                            </h3>
                            <p className="text-xs text-slate-400">
                                Defines the master schedule header for a department or team over a date range.
                            </p>
                        </div>

                        <form onSubmit={handleNewRosterSubmit} className="space-y-3.5">
                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1">
                                    Roster Name
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={newRosterForm.data.name}
                                    onChange={(e) => newRosterForm.setData('name', e.target.value)}
                                    placeholder="e.g. November 2026 - Operations Roster"
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:ring-1 focus:ring-indigo-500"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                                        Roster Code
                                    </label>
                                    <input
                                        type="text"
                                        value={newRosterForm.data.code}
                                        onChange={(e) => newRosterForm.setData('code', e.target.value)}
                                        placeholder="e.g. RST-NOV-OPS"
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono uppercase focus:ring-1 focus:ring-indigo-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                                        Department
                                    </label>
                                    <select
                                        value={newRosterForm.data.department_id}
                                        onChange={(e) => newRosterForm.setData('department_id', e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:ring-1 focus:ring-indigo-500"
                                    >
                                        <option value="">All Company</option>
                                        {departments.map((d) => (
                                            <option key={d.id} value={d.id}>
                                                {d.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                                        Start Date
                                    </label>
                                    <input
                                        type="date"
                                        required
                                        value={newRosterForm.data.start_date}
                                        onChange={(e) => newRosterForm.setData('start_date', e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:ring-1 focus:ring-indigo-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                                        End Date
                                    </label>
                                    <input
                                        type="date"
                                        required
                                        value={newRosterForm.data.end_date}
                                        onChange={(e) => newRosterForm.setData('end_date', e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:ring-1 focus:ring-indigo-500"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1">
                                    Notes
                                </label>
                                <textarea
                                    rows={2}
                                    value={newRosterForm.data.notes}
                                    onChange={(e) => newRosterForm.setData('notes', e.target.value)}
                                    placeholder="Operational goals or staffing notes..."
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:ring-1 focus:ring-indigo-500 placeholder-slate-600"
                                />
                            </div>

                            <div className="pt-2 flex items-center justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setIsNewRosterModalOpen(false)}
                                    className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={newRosterForm.processing}
                                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-md transition disabled:opacity-50"
                                >
                                    {newRosterForm.processing ? 'Creating...' : 'Create Roster'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL 4: Clone Roster to Next Month */}
            {isCloneModalOpen && active_roster && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl relative">
                        <button
                            onClick={() => setIsCloneModalOpen(false)}
                            className="absolute top-4 right-4 text-slate-400 hover:text-white"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <div>
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-sky-500/10 text-sky-400 border border-sky-500/20">
                                1-Click Roll Forward
                            </span>
                            <h3 className="text-base font-bold text-white mt-1">
                                Clone Roster: {active_roster.name}
                            </h3>
                            <p className="text-xs text-slate-400">
                                Clones all rotating squads and enrolled staff to the new period, automatically generating their synchronized shifts.
                            </p>
                        </div>

                        <form onSubmit={handleCloneSubmit} className="space-y-3.5">
                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1">
                                    New Roster Name
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={cloneForm.data.name}
                                    onChange={(e) => cloneForm.setData('name', e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:ring-1 focus:ring-indigo-500"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                                        Target Start Date
                                    </label>
                                    <input
                                        type="date"
                                        required
                                        value={cloneForm.data.start_date}
                                        onChange={(e) => cloneForm.setData('start_date', e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:ring-1 focus:ring-indigo-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                                        Target End Date
                                    </label>
                                    <input
                                        type="date"
                                        required
                                        value={cloneForm.data.end_date}
                                        onChange={(e) => cloneForm.setData('end_date', e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:ring-1 focus:ring-indigo-500"
                                    />
                                </div>
                            </div>

                            <div className="pt-2 flex items-center justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setIsCloneModalOpen(false)}
                                    className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={cloneForm.processing}
                                    className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs shadow-md transition disabled:opacity-50"
                                >
                                    {cloneForm.processing ? 'Cloning...' : 'Clone & Populate Shifts'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL 5: Shift Swap Modal */}
            {isSwapModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-2xl relative">
                        <button
                            onClick={() => setIsSwapModalOpen(false)}
                            className="absolute top-4 right-4 text-slate-400 hover:text-white"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <div>
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-sky-500/10 text-sky-400 border border-sky-500/20">
                                Shift Exchange
                            </span>
                            <h3 className="text-base font-bold text-white mt-1">
                                Atomic Shift Swap
                            </h3>
                            <p className="text-xs text-slate-400">
                                Exchanges duty assignments between two personnel on a specific date with audit trail.
                            </p>
                        </div>

                        <form onSubmit={handleSwapSubmit} className="space-y-3.5">
                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1">
                                    Date of Swap
                                </label>
                                <input
                                    type="date"
                                    required
                                    value={swapForm.data.date}
                                    onChange={(e) => swapForm.setData('date', e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:ring-1 focus:ring-indigo-500"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1">
                                    Employee A
                                </label>
                                <select
                                    value={swapForm.data.employee_a_id}
                                    onChange={(e) => swapForm.setData('employee_a_id', e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:ring-1 focus:ring-indigo-500"
                                >
                                    {matrix.map((r) => (
                                        <option key={r.employee.id} value={r.employee.id}>
                                            {r.employee.full_name} ({r.employee.emp_no})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1">
                                    Employee B
                                </label>
                                <select
                                    value={swapForm.data.employee_b_id}
                                    onChange={(e) => swapForm.setData('employee_b_id', e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:ring-1 focus:ring-indigo-500"
                                >
                                    {matrix.map((r) => (
                                        <option key={r.employee.id} value={r.employee.id}>
                                            {r.employee.full_name} ({r.employee.emp_no})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1">
                                    Reason / Reference
                                </label>
                                <input
                                    type="text"
                                    value={swapForm.data.reason}
                                    onChange={(e) => swapForm.setData('reason', e.target.value)}
                                    placeholder="e.g. Mutual consent / family obligation"
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:ring-1 focus:ring-indigo-500"
                                />
                            </div>

                            <div className="pt-2 flex items-center justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setIsSwapModalOpen(false)}
                                    className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={swapForm.processing || swapForm.data.employee_a_id === swapForm.data.employee_b_id}
                                    className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs shadow-md transition disabled:opacity-50"
                                >
                                    {swapForm.processing ? 'Swapping...' : 'Execute Shift Swap'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </AuthenticatedLayout>
    );
}
