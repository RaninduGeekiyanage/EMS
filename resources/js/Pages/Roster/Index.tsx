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
    Copy,
    Download,
    Printer,
    Lock,
    AlertTriangle,
    ShieldCheck,
    Layers,
    Plus,
    Check,
    ChevronDown,
    ChevronUp,
    Info,
    CalendarDays,
    Archive,
    Building2,
    Briefcase,
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
    entries_count?: number;
}

interface AvailableEmployee {
    id: string;
    emp_no: string;
    full_name: string;
    department_id?: string | null;
    department_name: string;
    designation_title: string;
    is_available: boolean;
    exclusion_reason?: string | null;
    current_roster?: {
        id: string;
        name: string;
        code: string;
    } | null;
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
    all_employees?: {
        id: string;
        emp_no: string;
        full_name: string;
        department_id: string;
        designation_id?: string;
        department?: { id: string; name: string };
        designation?: { id: string; title: string };
    }[];
    selected_department: string | null;
    rosters: RosterHeader[];
    active_roster: RosterHeader | null;
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
    all_employees = [],
    selected_department,
    rosters,
    active_roster,
    available_employees = [],
    coverage_summary,
    is_payroll_locked = false,
    summary,
}: Props) {
    const [searchQuery, setSearchQuery] = useState('');
    const [viewMode, setViewMode] = useState<'department' | 'flat'>('department');
    const [deptFilter, setDeptFilter] = useState<string>(selected_department || 'all');
    const [collapsedDepartments, setCollapsedDepartments] = useState<Record<string, boolean>>({});

    // Modals
    const [isNewRosterModalOpen, setIsNewRosterModalOpen] = useState(false);
    const [isQuickPatternModalOpen, setIsQuickPatternModalOpen] = useState(false);
    const [isCloneModalOpen, setIsCloneModalOpen] = useState(false);
    const [quickPatternEmpSearch, setQuickPatternEmpSearch] = useState('');
    const [quickPatternDeptFilter, setQuickPatternDeptFilter] = useState('all');

    const [selectedCell, setSelectedCell] = useState<{
        employeeId: string;
        employeeName: string;
        date: string;
        cell: MatrixCell;
    } | null>(null);

    // Filter matrix rows based on search and department
    const filteredMatrix = useMemo(() => {
        return matrix.filter((row) => {
            const matchesSearch =
                !searchQuery ||
                row.employee.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                row.employee.emp_no.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (row.employee.department?.name && row.employee.department.name.toLowerCase().includes(searchQuery.toLowerCase()));

            const matchesDept =
                deptFilter === 'all' ||
                row.employee.department?.id === deptFilter ||
                row.employee.department?.name === deptFilter;

            return matchesSearch && matchesDept;
        });
    }, [matrix, searchQuery, deptFilter]);

    // Group rows by Department for Department view
    const groupedByDepartment = useMemo(() => {
        const groups: Record<string, { id: string; name: string; rows: MatrixRow[] }> = {};

        filteredMatrix.forEach((row) => {
            const deptId = row.employee.department?.id || 'unassigned';
            const deptName = row.employee.department?.name || 'General / Unassigned';
            if (!groups[deptId]) {
                groups[deptId] = { id: deptId, name: deptName, rows: [] };
            }
            groups[deptId].rows.push(row);
        });

        return groups;
    }, [filteredMatrix]);

    // Unified employee pool for selection
    const employeePool = useMemo(() => {
        if (all_employees && all_employees.length > 0) {
            return all_employees.map((e) => ({
                id: e.id,
                emp_no: e.emp_no,
                full_name: e.full_name,
                department_id: e.department_id,
                department_name: e.department?.name || 'General',
                designation_title: e.designation?.title || 'Staff',
            }));
        }
        return matrix.map((r) => ({
            id: r.employee.id,
            emp_no: r.employee.emp_no,
            full_name: r.employee.full_name,
            department_id: r.employee.department?.id || null,
            department_name: r.employee.department?.name || 'General',
            designation_title: 'Staff',
        }));
    }, [all_employees, matrix]);

    // Navigation & Month Switchers
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

    // 1. Single Cell Override Form
    const cellForm = useForm({
        employee_id: '',
        date: '',
        shift_id: '',
        schedule_type: 'shift' as 'shift' | 'rest_day' | 'off',
        override_reason: 'Supervisor Operational Reassignment',
        notes: '',
        status: 'published',
        roster_id: '',
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
            status: active_roster?.status === 'draft' ? 'draft' : (cell.status || 'published'),
            roster_id: active_roster?.id || '',
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
        name: `${month_name} ${year} - Operations Roster`,
        code: `RST-${year}-${String(month).padStart(2, '0')}-OPS`,
        department_id: '',
        start_date: `${year}-${String(month).padStart(2, '0')}-01`,
        end_date: (() => {
            const lastDay = new Date(year, month, 0).getDate();
            return `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
        })(),
        status: 'draft' as 'draft' | 'published',
        notes: '',
        pattern_id: '',
        employee_ids: [] as string[],
    });

    const [newRosterEmpSearch, setNewRosterEmpSearch] = useState('');

    const openNewRosterModal = () => {
        const lastDay = new Date(year, month, 0).getDate();
        newRosterForm.setData({
            name: `${month_name} ${year} - Operations Roster`,
            code: `RST-${year}-${String(month).padStart(2, '0')}-OPS`,
            department_id: '',
            start_date: `${year}-${String(month).padStart(2, '0')}-01`,
            end_date: `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
            status: 'draft',
            notes: '',
            pattern_id: '',
            employee_ids: [],
        });
        setNewRosterEmpSearch('');
        setIsNewRosterModalOpen(true);
    };

    const handleNewRosterSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        newRosterForm.post('/roster/rosters', {
            onSuccess: () => setIsNewRosterModalOpen(false),
        });
    };

    // 3. Quick Pattern / Bulk Apply Form
    const quickPatternForm = useForm({
        pattern_id: patterns[0]?.id || '',
        start_date: active_roster?.start_date || `${year}-${String(month).padStart(2, '0')}-01`,
        end_date: active_roster?.end_date || (() => {
            const lastDay = new Date(year, month, 0).getDate();
            return `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
        })(),
        employee_ids: matrix.map((r) => r.employee.id),
        preserve_leaves: true,
        status: 'published',
        roster_id: active_roster?.id || '',
    });

    const openQuickPatternModal = () => {
        setQuickPatternEmpSearch('');
        setQuickPatternDeptFilter('all');
        quickPatternForm.setData({
            pattern_id: patterns[0]?.id || '',
            start_date: active_roster?.start_date || `${year}-${String(month).padStart(2, '0')}-01`,
            end_date: active_roster?.end_date || (() => {
                const lastDay = new Date(year, month, 0).getDate();
                return `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
            })(),
            employee_ids: matrix.map((r) => r.employee.id),
            preserve_leaves: true,
            status: active_roster?.status === 'draft' ? 'draft' : 'published',
            roster_id: active_roster?.id || '',
        });
        setIsQuickPatternModalOpen(true);
    };

    const handleQuickPatternSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        quickPatternForm.post('/roster/generate', {
            preserveScroll: true,
            onSuccess: () => setIsQuickPatternModalOpen(false),
        });
    };

    // 4. Clone Roster Form
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

        const mName = curStart.toLocaleString('default', { month: 'long' });

        cloneForm.setData({
            name: `${mName} ${y} - ${active_roster.name.replace(/^[A-Za-z]+ \d{4} - /, '')}`,
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

    // Publish / Revert Draft Toggle
    const handlePublishToggle = (publish: boolean) => {
        if (!active_roster) return;
        router.post(
            `/roster/rosters/${active_roster.id}/publish`,
            { publish },
            { preserveScroll: true }
        );
    };

    const toggleDepartmentCollapse = (deptId: string) => {
        setCollapsedDepartments((prev) => ({ ...prev, [deptId]: !prev[deptId] }));
    };

    // Render an individual row in the matrix
    const renderMatrixRow = (row: MatrixRow) => {
        return (
            <tr key={row.employee.id} className="hover:bg-slate-800/40 transition">
                {/* Employee Name (Sticky Left) */}
                <td className="sticky left-0 z-20 bg-slate-900 px-3.5 py-2 border-r border-slate-800 max-w-[260px] group/empcell">
                    <div className="flex items-center justify-between gap-1.5">
                        <div className="min-w-0 flex-1">
                            <div className="font-bold text-white truncate text-xs">
                                {row.employee.full_name}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono truncate">
                                {row.employee.emp_no} &bull; {row.employee.department?.name || 'General'}
                            </div>
                        </div>
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
                                                {rst.name} ({rst.code}) • {rst.start_date} → {rst.end_date} [{rst.status.toUpperCase()}]
                                            </option>
                                        ))}
                                        {rosters.length === 0 && <option value="">No Rosters Found</option>}
                                    </select>
                                </div>

                                <button
                                    onClick={openNewRosterModal}
                                    className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition"
                                    title="Create a new Named Roster"
                                >
                                    <Plus className="w-3.5 h-3.5" />
                                    <span>New Roster</span>
                                </button>

                                {active_roster && (
                                    <>
                                        <button
                                            onClick={openCloneModal}
                                            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 hover:border-slate-600 transition flex items-center gap-1.5 shadow-sm"
                                            title="Clone this roster to next month"
                                        >
                                            <Copy className="w-3.5 h-3.5 text-sky-400" />
                                            <span>Clone</span>
                                        </button>

                                        {active_roster.status === 'draft' && active_roster.published_at === null ? (
                                            <button
                                                onClick={() => {
                                                    if (confirm(`Are you sure you want to discard draft roster '${active_roster.name}'? This will permanently delete this draft and any associated draft entries.`)) {
                                                        router.delete(`/roster/rosters/${active_roster.id}`, { preserveScroll: true });
                                                    }
                                                }}
                                                className="px-3 py-1.5 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 text-xs font-semibold border border-rose-800/60 hover:border-rose-700 transition flex items-center gap-1.5 shadow-sm"
                                                title="Discard this un-published draft roster permanently"
                                            >
                                                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                                                <span>Discard Draft</span>
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => {
                                                    if (confirm(`Archive roster '${active_roster.name}'? This withdraws it from active scheduling while strictly preserving historical attendance logs and biometric audit trails.`)) {
                                                        router.post(`/roster/rosters/${active_roster.id}/archive`, {}, { preserveScroll: true });
                                                    }
                                                }}
                                                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 hover:border-slate-600 transition flex items-center gap-1.5 shadow-sm"
                                                title="Archive this roster to protect historical audit trail"
                                            >
                                                <Archive className="w-3.5 h-3.5 text-slate-400" />
                                                <span>Archive</span>
                                            </button>
                                        )}
                                    </>
                                )}
                            </div>

                            {active_roster && (
                                <p className="text-xs text-slate-400 flex items-center gap-3">
                                    <span>
                                        Period: <strong className="text-slate-300 font-mono">{active_roster.start_date} &rarr; {active_roster.end_date}</strong>
                                    </span>
                                    <span>&bull;</span>
                                    <span>
                                        Department: <strong className="text-slate-300">{active_roster.department?.name || 'All Departments'}</strong>
                                    </span>
                                </p>
                            )}
                        </div>

                        {/* Top Operational Action Buttons */}
                        <div className="flex flex-wrap items-center gap-2">
                            {active_roster && (
                                <>
                                    <button
                                        onClick={openQuickPatternModal}
                                        className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-sm"
                                        title="Quick fill shifts using a pattern"
                                    >
                                        <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                                        <span>Apply Pattern</span>
                                    </button>

                                    {active_roster.status === 'published' ? (
                                        <button
                                            onClick={() => handlePublishToggle(false)}
                                            className="px-3 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-xs font-semibold flex items-center gap-1.5 transition shadow-sm"
                                            title="Revert Roster to Draft"
                                        >
                                            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                                            <span>Revert to Draft</span>
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

                            <Link
                                href="/roster/shift-swaps"
                                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition shadow-sm"
                                title="Departmental Shift Swaps Governance"
                            >
                                <ArrowLeftRight className="w-3.5 h-3.5 text-sky-400" />
                                <span>Shift Swaps</span>
                            </Link>

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

                {/* 1b. Draft Mode Visual Alert Banner */}
                {active_roster && active_roster.status === 'draft' && (
                    <div className="bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-slate-900 border border-amber-500/30 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center shrink-0">
                                <AlertTriangle className="w-5 h-5 text-amber-400" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h4 className="text-xs font-bold text-amber-300 uppercase tracking-wider">
                                        Unpublished Draft Roster
                                    </h4>
                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-200 border border-amber-400/30 font-semibold">
                                        Draft Stage &bull; Full Editing Enabled
                                    </span>
                                </div>
                                <p className="text-xs text-slate-300 mt-0.5">
                                    Shifts in this roster are not yet official or visible to standard staff. You can alter schedules, apply rotation patterns, or publish when finalized.
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            <button
                                type="button"
                                onClick={openQuickPatternModal}
                                className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-sm"
                            >
                                <Sparkles className="w-3.5 h-3.5" />
                                <span>Apply Pattern</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => handlePublishToggle(true)}
                                className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-md"
                            >
                                <ShieldCheck className="w-3.5 h-3.5" />
                                <span>Publish Official</span>
                            </button>
                        </div>
                    </div>
                )}

                {/* 2. Control & Filter Strip */}
                <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-md">
                    <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
                        {/* View Switcher: Department Grouped vs Flat */}
                        <div className="bg-slate-950 p-1 rounded-xl border border-slate-800 flex items-center text-xs font-semibold">
                            <button
                                onClick={() => setViewMode('department')}
                                className={`px-3 py-1 rounded-lg transition ${
                                    viewMode === 'department'
                                        ? 'bg-indigo-600 text-white shadow-sm'
                                        : 'text-slate-400 hover:text-white'
                                }`}
                            >
                                Group by Department
                            </button>
                            <button
                                onClick={() => setViewMode('flat')}
                                className={`px-3 py-1 rounded-lg transition ${
                                    viewMode === 'flat'
                                        ? 'bg-indigo-600 text-white shadow-sm'
                                        : 'text-slate-400 hover:text-white'
                                }`}
                            >
                                Flat Staff List
                            </button>
                        </div>

                        {/* Department Filter Dropdown */}
                        <div className="relative">
                            <select
                                value={deptFilter}
                                onChange={(e) => setDeptFilter(e.target.value)}
                                className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl px-3 py-1.5 pr-8 hover:border-slate-700 focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                            >
                                <option value="all">All Departments ({departments.length})</option>
                                {departments.map((d) => (
                                    <option key={d.id} value={d.id}>
                                        {d.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Search Input */}
                        <div className="relative flex-1 sm:w-64">
                            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search staff name or ID..."
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
                            {month_name} {year}
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
                                {viewMode === 'department' ? (
                                    // DEPARTMENT GROUPED VIEW
                                    Object.entries(groupedByDepartment).map(([deptId, deptData]) => {
                                        const isCollapsed = collapsedDepartments[deptId];
                                        return (
                                            <React.Fragment key={deptId}>
                                                {/* Department Header Row */}
                                                <tr className="bg-slate-950/90 border-y border-indigo-500/20">
                                                    <td
                                                        colSpan={days.length + 2}
                                                        className="px-4 py-2 text-xs font-bold text-white cursor-pointer select-none"
                                                        onClick={() => toggleDepartmentCollapse(deptId)}
                                                    >
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-3">
                                                                <button
                                                                    type="button"
                                                                    className="p-1 rounded text-slate-400 hover:text-white"
                                                                >
                                                                    {isCollapsed ? (
                                                                        <ChevronDown className="w-4 h-4" />
                                                                    ) : (
                                                                        <ChevronUp className="w-4 h-4" />
                                                                    )}
                                                                </button>
                                                                <Building2 className="w-4 h-4 text-indigo-400" />
                                                                <span className="font-bold text-white text-xs">
                                                                    {deptData.name}
                                                                </span>
                                                                <span className="text-[10px] text-slate-400 font-mono">
                                                                    ({deptData.rows.length} Staff)
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>

                                                {/* Staff Rows */}
                                                {!isCollapsed &&
                                                    deptData.rows.map((row) => renderMatrixRow(row))}
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
                                            className="px-6 py-16 text-center text-slate-400"
                                        >
                                            <AlertCircle className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                                            <p className="text-sm font-semibold text-white">
                                                No roster entries found.
                                            </p>
                                            <p className="text-xs text-slate-500 mt-1">
                                                Try adjusting your department or search filter, or click "Apply Pattern" to populate shifts.
                                            </p>
                                        </td>
                                    </tr>
                                )}
                            </tbody>

                            {/* Sticky Daily Coverage Summary Footer */}
                            {coverage_summary && filteredMatrix.length > 0 && (
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

                        <form onSubmit={handleCellSubmit} className="space-y-4 text-xs">
                            <div>
                                <label className="block text-slate-400 font-medium mb-1.5">
                                    Schedule Type
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => cellForm.setData('schedule_type', 'shift')}
                                        className={`py-2 px-3 rounded-xl border text-center font-semibold transition ${
                                            cellForm.data.schedule_type === 'shift'
                                                ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm'
                                                : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                                        }`}
                                    >
                                        Working Shift
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => cellForm.setData('schedule_type', 'rest_day')}
                                        className={`py-2 px-3 rounded-xl border text-center font-semibold transition ${
                                            cellForm.data.schedule_type === 'rest_day'
                                                ? 'bg-slate-800 text-white border-slate-600 shadow-sm'
                                                : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                                        }`}
                                    >
                                        Rest Day (OFF)
                                    </button>
                                </div>
                            </div>

                            {cellForm.data.schedule_type === 'shift' && (
                                <div>
                                    <label className="block text-slate-400 font-medium mb-1.5">
                                        Assigned Shift
                                    </label>
                                    <select
                                        value={cellForm.data.shift_id}
                                        onChange={(e) => cellForm.setData('shift_id', e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-semibold focus:ring-1 focus:ring-indigo-500"
                                    >
                                        {shifts.map((s) => (
                                            <option key={s.id} value={s.id}>
                                                {s.name} ({s.code}) &bull; {s.start_time} - {s.end_time}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <div>
                                <label className="block text-slate-400 font-medium mb-1.5">
                                    Reason for Override
                                </label>
                                <input
                                    type="text"
                                    value={cellForm.data.override_reason}
                                    onChange={(e) => cellForm.setData('override_reason', e.target.value)}
                                    placeholder="e.g. Sick cover, operational emergency, supervisor request"
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:ring-1 focus:ring-indigo-500"
                                />
                            </div>

                            <div>
                                <label className="block text-slate-400 font-medium mb-1.5">
                                    Notes (Optional)
                                </label>
                                <textarea
                                    value={cellForm.data.notes}
                                    onChange={(e) => cellForm.setData('notes', e.target.value)}
                                    rows={2}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:ring-1 focus:ring-indigo-500"
                                    placeholder="Add any internal supervisor remarks..."
                                />
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                                <button
                                    type="button"
                                    onClick={() => setSelectedCell(null)}
                                    className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={cellForm.processing}
                                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-md transition disabled:opacity-50"
                                >
                                    {cellForm.processing ? 'Saving...' : 'Apply Shift Update'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL 2: Create New Roster Modal */}
            {isNewRosterModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl relative">
                        <button
                            onClick={() => setIsNewRosterModalOpen(false)}
                            className="absolute top-4 right-4 text-slate-400 hover:text-white"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <div>
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                                Roster Management
                            </span>
                            <h3 className="text-lg font-bold text-white mt-1">
                                Create New Duty Roster
                            </h3>
                            <p className="text-xs text-slate-400 mt-0.5">
                                Define the operational scheduling period and scope.
                            </p>
                        </div>

                        <form onSubmit={handleNewRosterSubmit} className="space-y-4 text-xs">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-slate-400 font-medium mb-1">
                                        Roster Title
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={newRosterForm.data.name}
                                        onChange={(e) => newRosterForm.setData('name', e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-medium focus:ring-1 focus:ring-indigo-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-slate-400 font-medium mb-1">
                                        Roster Code
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={newRosterForm.data.code}
                                        onChange={(e) => newRosterForm.setData('code', e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:ring-1 focus:ring-indigo-500"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div>
                                    <label className="block text-slate-400 font-medium mb-1">
                                        Department Scope
                                    </label>
                                    <select
                                        value={newRosterForm.data.department_id}
                                        onChange={(e) => newRosterForm.setData('department_id', e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:ring-1 focus:ring-indigo-500"
                                    >
                                        <option value="">All Company Departments</option>
                                        {departments.map((d) => (
                                            <option key={d.id} value={d.id}>
                                                {d.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-slate-400 font-medium mb-1">
                                        Start Date
                                    </label>
                                    <input
                                        type="date"
                                        required
                                        value={newRosterForm.data.start_date}
                                        onChange={(e) => newRosterForm.setData('start_date', e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:ring-1 focus:ring-indigo-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-slate-400 font-medium mb-1">
                                        End Date
                                    </label>
                                    <input
                                        type="date"
                                        required
                                        value={newRosterForm.data.end_date}
                                        onChange={(e) => newRosterForm.setData('end_date', e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:ring-1 focus:ring-indigo-500"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-slate-400 font-medium mb-1">
                                    Initial Status
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => newRosterForm.setData('status', 'draft')}
                                        className={`py-2 px-3 rounded-xl border text-center font-semibold transition ${
                                            newRosterForm.data.status === 'draft'
                                                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm'
                                                : 'bg-slate-950 text-slate-400 border-slate-800'
                                        }`}
                                    >
                                        Draft Mode (Planning)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => newRosterForm.setData('status', 'published')}
                                        className={`py-2 px-3 rounded-xl border text-center font-semibold transition ${
                                            newRosterForm.data.status === 'published'
                                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm'
                                                : 'bg-slate-950 text-slate-400 border-slate-800'
                                        }`}
                                    >
                                        Official Published
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-slate-400 font-medium mb-1">
                                    Notes / Operational Scope
                                </label>
                                <textarea
                                    value={newRosterForm.data.notes}
                                    onChange={(e) => newRosterForm.setData('notes', e.target.value)}
                                    rows={2}
                                    placeholder="Add any guidance or special instructions..."
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:ring-1 focus:ring-indigo-500"
                                />
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                                <button
                                    type="button"
                                    onClick={() => setIsNewRosterModalOpen(false)}
                                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={newRosterForm.processing}
                                    className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-md transition disabled:opacity-50"
                                >
                                    {newRosterForm.processing ? 'Creating...' : 'Create Roster'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL 3: Apply Pattern / Bulk Roster Generator */}
            {isQuickPatternModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-2xl relative">
                        <button
                            onClick={() => setIsQuickPatternModalOpen(false)}
                            className="absolute top-4 right-4 text-slate-400 hover:text-white"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <div>
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                                Pattern Automation
                            </span>
                            <h3 className="text-lg font-bold text-white mt-1">
                                Apply Shift Rotation Pattern
                            </h3>
                            <p className="text-xs text-slate-400 mt-0.5">
                                Automatically calculate and populate recurring shift rotations across selected personnel.
                            </p>
                        </div>

                        <form onSubmit={handleQuickPatternSubmit} className="space-y-4 text-xs">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-slate-400 font-medium mb-1">
                                        Select Pattern
                                    </label>
                                    <select
                                        required
                                        value={quickPatternForm.data.pattern_id}
                                        onChange={(e) => quickPatternForm.setData('pattern_id', e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-semibold focus:ring-1 focus:ring-indigo-500"
                                    >
                                        {patterns.map((p) => (
                                            <option key={p.id} value={p.id}>
                                                {p.name} ({p.pattern_type}, {p.cycle_length_days}d cycle)
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="block text-slate-400 font-medium mb-1">
                                            Start Date
                                        </label>
                                        <input
                                            type="date"
                                            required
                                            value={quickPatternForm.data.start_date}
                                            onChange={(e) => quickPatternForm.setData('start_date', e.target.value)}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-white font-mono focus:ring-1 focus:ring-indigo-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-slate-400 font-medium mb-1">
                                            End Date
                                        </label>
                                        <input
                                            type="date"
                                            required
                                            value={quickPatternForm.data.end_date}
                                            onChange={(e) => quickPatternForm.setData('end_date', e.target.value)}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-white font-mono focus:ring-1 focus:ring-indigo-500"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Options: Preserve Leaves */}
                            <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl flex items-center justify-between">
                                <div>
                                    <div className="font-semibold text-white">
                                        Preserve Approved Leaves
                                    </div>
                                    <div className="text-[11px] text-slate-400">
                                        Do not overwrite approved leave records with pattern shifts.
                                    </div>
                                </div>
                                <input
                                    type="checkbox"
                                    checked={quickPatternForm.data.preserve_leaves}
                                    onChange={(e) => quickPatternForm.setData('preserve_leaves', e.target.checked)}
                                    className="w-4 h-4 rounded text-indigo-600 bg-slate-900 border-slate-700 focus:ring-indigo-500 cursor-pointer"
                                />
                            </div>

                            {/* Personnel Selection */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <label className="font-medium text-slate-300">
                                        Apply to Personnel ({quickPatternForm.data.employee_ids.length} Selected)
                                    </label>
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const allFiltered = employeePool
                                                    .filter((e) => {
                                                        const mSearch = !quickPatternEmpSearch || e.full_name.toLowerCase().includes(quickPatternEmpSearch.toLowerCase()) || e.emp_no.toLowerCase().includes(quickPatternEmpSearch.toLowerCase());
                                                        const mDept = quickPatternDeptFilter === 'all' || e.department_id === quickPatternDeptFilter;
                                                        return mSearch && mDept;
                                                    })
                                                    .map((e) => e.id);
                                                quickPatternForm.setData('employee_ids', Array.from(new Set([...quickPatternForm.data.employee_ids, ...allFiltered])));
                                            }}
                                            className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold"
                                        >
                                            Select All Filtered
                                        </button>
                                        <span className="text-slate-600">&bull;</span>
                                        <button
                                            type="button"
                                            onClick={() => quickPatternForm.setData('employee_ids', [])}
                                            className="text-xs text-slate-400 hover:text-slate-300 font-semibold"
                                        >
                                            Clear All
                                        </button>
                                    </div>
                                </div>

                                {/* Filter Controls */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    <div className="relative">
                                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                        <input
                                            type="text"
                                            value={quickPatternEmpSearch}
                                            onChange={(e) => setQuickPatternEmpSearch(e.target.value)}
                                            placeholder="Search personnel..."
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-white placeholder-slate-500"
                                        />
                                    </div>
                                    <select
                                        value={quickPatternDeptFilter}
                                        onChange={(e) => setQuickPatternDeptFilter(e.target.value)}
                                        className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-white"
                                    >
                                        <option value="all">All Departments</option>
                                        {departments.map((d) => (
                                            <option key={d.id} value={d.id}>
                                                {d.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Employee Checkbox List */}
                                <div className="max-h-56 overflow-y-auto border border-slate-800 rounded-xl p-2 bg-slate-950/60 divide-y divide-slate-800/50">
                                    {employeePool
                                        .filter((e) => {
                                            const mSearch =
                                                !quickPatternEmpSearch ||
                                                e.full_name.toLowerCase().includes(quickPatternEmpSearch.toLowerCase()) ||
                                                e.emp_no.toLowerCase().includes(quickPatternEmpSearch.toLowerCase());
                                            const mDept = quickPatternDeptFilter === 'all' || e.department_id === quickPatternDeptFilter;
                                            return mSearch && mDept;
                                        })
                                        .map((emp) => {
                                            const isSelected = quickPatternForm.data.employee_ids.includes(emp.id);
                                            return (
                                                <label
                                                    key={emp.id}
                                                    className="flex items-center justify-between px-2.5 py-1.5 hover:bg-slate-800/40 rounded-lg cursor-pointer transition"
                                                >
                                                    <div className="flex items-center gap-2.5">
                                                        <input
                                                            type="checkbox"
                                                            checked={isSelected}
                                                            onChange={(e) => {
                                                                if (e.target.checked) {
                                                                    quickPatternForm.setData('employee_ids', [...quickPatternForm.data.employee_ids, emp.id]);
                                                                } else {
                                                                    quickPatternForm.setData('employee_ids', quickPatternForm.data.employee_ids.filter((id) => id !== emp.id));
                                                                }
                                                            }}
                                                            className="w-4 h-4 rounded text-indigo-600 bg-slate-900 border-slate-700 focus:ring-indigo-500 cursor-pointer"
                                                        />
                                                        <div>
                                                            <div className="font-semibold text-white">
                                                                {emp.full_name}
                                                            </div>
                                                            <div className="text-[10px] text-slate-400 font-mono">
                                                                {emp.emp_no} &bull; {emp.department_name}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </label>
                                            );
                                        })}
                                </div>
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                                <button
                                    type="button"
                                    onClick={() => setIsQuickPatternModalOpen(false)}
                                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={quickPatternForm.processing || quickPatternForm.data.employee_ids.length === 0}
                                    className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-md transition disabled:opacity-50"
                                >
                                    {quickPatternForm.processing ? 'Generating...' : `Apply Pattern to ${quickPatternForm.data.employee_ids.length} Staff`}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL 4: Clone Roster Modal */}
            {isCloneModalOpen && active_roster && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl relative">
                        <button
                            onClick={() => setIsCloneModalOpen(false)}
                            className="absolute top-4 right-4 text-slate-400 hover:text-white"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <div>
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-sky-500/10 text-sky-400 border border-sky-500/20">
                                Continuity Planning
                            </span>
                            <h3 className="text-lg font-bold text-white mt-1">
                                Clone Roster Structure
                            </h3>
                            <p className="text-xs text-slate-400 mt-0.5">
                                Replicate shifts and schedule templates into a subsequent operational period.
                            </p>
                        </div>

                        <form onSubmit={handleCloneSubmit} className="space-y-4 text-xs">
                            <div>
                                <label className="block text-slate-400 font-medium mb-1">
                                    New Roster Name
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={cloneForm.data.name}
                                    onChange={(e) => cloneForm.setData('name', e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-medium focus:ring-1 focus:ring-indigo-500"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-slate-400 font-medium mb-1">
                                        Start Date
                                    </label>
                                    <input
                                        type="date"
                                        required
                                        value={cloneForm.data.start_date}
                                        onChange={(e) => cloneForm.setData('start_date', e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:ring-1 focus:ring-indigo-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-slate-400 font-medium mb-1">
                                        End Date
                                    </label>
                                    <input
                                        type="date"
                                        required
                                        value={cloneForm.data.end_date}
                                        onChange={(e) => cloneForm.setData('end_date', e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:ring-1 focus:ring-indigo-500"
                                    />
                                </div>
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                                <button
                                    type="button"
                                    onClick={() => setIsCloneModalOpen(false)}
                                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={cloneForm.processing}
                                    className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-md transition disabled:opacity-50"
                                >
                                    {cloneForm.processing ? 'Cloning...' : 'Clone Structure'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </AuthenticatedLayout>
    );
}
