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
    status: 'draft' | 'published' | 'locked' | null;
    is_overridden: boolean;
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
    selected_department: string | null;
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
    coverage_summary,
    is_payroll_locked = false,
    summary,
}: Props) {
    const [searchQuery, setSearchQuery] = useState('');
    const [departmentFilter, setDepartmentFilter] = useState<string>(selected_department || 'all');
    const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
    const [isSwapModalOpen, setIsSwapModalOpen] = useState(false);
    const [selectedCell, setSelectedCell] = useState<{
        employeeId: string;
        employeeName: string;
        date: string;
        cell: MatrixCell;
    } | null>(null);

    // Enhanced Roster Generation States
    const [generationSource, setGenerationSource] = useState<'template' | 'custom'>(patterns.length > 0 ? 'template' : 'custom');
    const [selectedPatternId, setSelectedPatternId] = useState<string>(patterns[0]?.id || '');
    const [staffScope, setStaffScope] = useState<'all' | 'department' | 'specific'>('all');
    const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);
    const [staffSearchQuery, setStaffSearchQuery] = useState<string>('');

    const staffList = useMemo(() => {
        return matrix.map((r) => r.employee);
    }, [matrix]);

    const filteredStaffList = useMemo(() => {
        return staffList.filter((s) => {
            const q = staffSearchQuery.toLowerCase();
            return (
                s.full_name.toLowerCase().includes(q) ||
                s.emp_no.toLowerCase().includes(q) ||
                (s.department?.name && s.department.name.toLowerCase().includes(q))
            );
        });
    }, [staffList, staffSearchQuery]);

    // Filter rows by search
    const filteredMatrix = useMemo(() => {
        return matrix.filter((row) => {
            const matchesSearch =
                row.employee.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                row.employee.emp_no.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (row.employee.department?.name && row.employee.department.name.toLowerCase().includes(searchQuery.toLowerCase()));
            return matchesSearch;
        });
    }, [matrix, searchQuery]);

    // Navigation handlers
    const navigateMonth = (targetYear: number, targetMonth: number) => {
        router.get(
            '/roster',
            {
                year: targetYear,
                month: targetMonth,
                department_id: departmentFilter !== 'all' ? departmentFilter : undefined,
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

    const handleDepartmentChange = (deptId: string) => {
        setDepartmentFilter(deptId);
        router.get(
            '/roster',
            {
                year,
                month,
                department_id: deptId !== 'all' ? deptId : undefined,
            },
            { preserveState: true }
        );
    };

    // Quick jump to next month or current month
    const handleQuickJump = (target: 'current' | 'next' | 'quarter') => {
        const now = new Date();
        if (target === 'current') {
            navigateMonth(now.getFullYear(), now.getMonth() + 1);
        } else if (target === 'next') {
            let nextMonth = now.getMonth() + 2;
            let nextYear = now.getFullYear();
            if (nextMonth > 12) {
                nextMonth = 1;
                nextYear += 1;
            }
            navigateMonth(nextYear, nextMonth);
        } else if (target === 'quarter') {
            let qMonth = now.getMonth() + 4;
            let qYear = now.getFullYear();
            if (qMonth > 12) {
                qMonth -= 12;
                qYear += 1;
            }
            navigateMonth(qYear, qMonth);
        }
    };

    // Export to noticeboard CSV
    const handleExportCsv = () => {
        const url = `/roster/export?year=${year}&month=${month}${departmentFilter !== 'all' ? `&department_id=${departmentFilter}` : ''}`;
        window.location.href = url;
    };

    // Print Noticeboard
    const handlePrintNoticeboard = () => {
        window.print();
    };

    // Form for Single Cell Edit
    interface CellFormData {
        employee_id: string;
        date: string;
        shift_id: string;
        schedule_type: 'shift' | 'rest_day' | 'off';
        notes: string;
        status: 'draft' | 'published' | 'locked';
    }

    const cellForm = useForm<CellFormData>({
        employee_id: '',
        date: '',
        shift_id: '',
        schedule_type: 'shift',
        notes: '',
        status: 'published',
    });

    const openCellModal = (empId: string, empName: string, date: string, cell: MatrixCell) => {
        if (is_payroll_locked) {
            alert('Cannot edit roster entries for a finalized and locked payroll period.');
            return;
        }

        setSelectedCell({ employeeId: empId, employeeName: empName, date, cell });
        cellForm.setData((prev) => ({
            ...prev,
            employee_id: empId,
            date: date,
            shift_id: cell.shift?.id || (shifts[0]?.id ?? ''),
            schedule_type: cell.schedule_type || 'shift',
            notes: cell.notes || '',
            status: cell.status || 'published',
        }));
    };

    const handleCellSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        cellForm.post('/roster/entry', {
            preserveScroll: true,
            onSuccess: () => setSelectedCell(null),
        });
    };

    // Form for Shift Swap
    const swapForm = useForm({
        employee_a_id: matrix[0]?.employee.id || '',
        employee_b_id: matrix[1]?.employee.id || '',
        date: days[0]?.date || `${year}-${String(month).padStart(2, '0')}-01`,
    });

    const handleSwapSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        swapForm.post('/roster/swap', {
            preserveScroll: true,
            onSuccess: () => setIsSwapModalOpen(false),
        });
    };

    // Form for Roster Generator
    const firstDayStr = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDayStr = days[days.length - 1]?.date || `${year}-${String(month).padStart(2, '0')}-28`;

    const defaultWeeklyConfig = [
        { shift_id: shifts[0]?.id || '', is_rest_day: false }, // Mon (0)
        { shift_id: shifts[0]?.id || '', is_rest_day: false }, // Tue (1)
        { shift_id: shifts[0]?.id || '', is_rest_day: false }, // Wed (2)
        { shift_id: shifts[0]?.id || '', is_rest_day: false }, // Thu (3)
        { shift_id: shifts[0]?.id || '', is_rest_day: false }, // Fri (4)
        { shift_id: shifts[4]?.id || shifts[0]?.id || '', is_rest_day: false }, // Sat (5)
        { shift_id: '', is_rest_day: true }, // Sun (6)
    ];

    const generateForm = useForm({
        pattern_mode: 'weekly' as 'daily' | 'weekly' | 'cyclical' | 'copy_month',
        start_date: firstDayStr,
        end_date: lastDayStr,
        department_id: departmentFilter !== 'all' ? departmentFilter : '',
        conflict_mode: 'overwrite' as 'overwrite' | 'preserve',
        status: 'published' as 'draft' | 'published',
        preserve_leaves: true,

        // Daily mode
        daily_config: {
            shift_id: shifts[0]?.id || '',
            rest_days: ['Sunday'],
        },

        // Weekly mode
        weekly_config: defaultWeeklyConfig,

        // Cyclical mode
        cyclical_config: {
            anchor_date: firstDayStr,
            steps: [
                { shift_id: shifts[0]?.id || '', is_rest_day: false, notes: 'Day 1' },
                { shift_id: shifts[0]?.id || '', is_rest_day: false, notes: 'Day 2' },
                { shift_id: shifts[0]?.id || '', is_rest_day: false, notes: 'Day 3' },
                { shift_id: shifts[0]?.id || '', is_rest_day: false, notes: 'Day 4' },
                { shift_id: '', is_rest_day: true, notes: 'Rest Day 1' },
                { shift_id: '', is_rest_day: true, notes: 'Rest Day 2' },
            ],
        },

        // Copy Month mode
        copy_config: {
            source_year: month === 1 ? year - 1 : year,
            source_month: month === 1 ? 12 : month - 1,
        },
    });

    const handleGenerateSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const payload: any = {
            start_date: generateForm.data.start_date,
            end_date: generateForm.data.end_date,
            conflict_mode: generateForm.data.conflict_mode,
            status: generateForm.data.status,
            preserve_leaves: generateForm.data.preserve_leaves,
        };

        if (generationSource === 'template') {
            if (!selectedPatternId) {
                alert('Please select a roster template.');
                return;
            }
            payload.pattern_id = selectedPatternId;
        } else {
            payload.pattern_mode = generateForm.data.pattern_mode;
            if (generateForm.data.pattern_mode === 'weekly') {
                payload.weekly_config = generateForm.data.weekly_config;
            } else if (generateForm.data.pattern_mode === 'cyclical') {
                payload.cyclical_config = generateForm.data.cyclical_config;
            } else if (generateForm.data.pattern_mode === 'daily') {
                payload.daily_config = generateForm.data.daily_config;
            } else if (generateForm.data.pattern_mode === 'copy_month') {
                payload.copy_config = generateForm.data.copy_config;
            }
        }

        if (staffScope === 'specific') {
            if (selectedStaffIds.length === 0) {
                alert('Please select at least one employee.');
                return;
            }
            payload.employee_ids = selectedStaffIds;
        } else if (staffScope === 'department') {
            payload.department_id = generateForm.data.department_id;
        }

        router.post('/roster/generate', payload, {
            preserveScroll: true,
            onSuccess: () => {
                setIsGenerateModalOpen(false);
                setSelectedStaffIds([]);
            },
        });
    };

    // Toggle Publish Status
    const handlePublishToggle = (publish: boolean) => {
        router.post(
            '/roster/publish',
            {
                year,
                month,
                department_id: departmentFilter !== 'all' ? departmentFilter : undefined,
                publish,
            },
            { preserveScroll: true }
        );
    };

    // Clear Roster
    const handleClearRoster = () => {
        if (confirm(`Are you sure you want to clear roster entries for ${month_name}?`)) {
            router.delete('/roster/clear', {
                data: {
                    year,
                    month,
                    department_id: departmentFilter !== 'all' ? departmentFilter : undefined,
                    only_drafts: false,
                },
                preserveScroll: true,
            });
        }
    };

    const isGlobalProcessing = generateForm.processing || cellForm.processing || swapForm.processing;

    return (
        <AuthenticatedLayout>
            <Head title={`Duty Roster - ${month_name}`} />

            {/* Print Stylesheet for Physical Noticeboards */}
            <style>{`
                @media print {
                    body {
                        background-color: white !important;
                        color: black !important;
                    }
                    nav, header, .no-print {
                        display: none !important;
                    }
                    .print-only {
                        display: block !important;
                    }
                    table {
                        width: 100% !important;
                        border-collapse: collapse !important;
                    }
                    th, td {
                        border: 1px solid #94a3b8 !important;
                        color: black !important;
                        background: white !important;
                    }
                }
            `}</style>

            {/* Global Spinner Processing Overlay (Prevents UI Freezing) */}
            {isGlobalProcessing && (
                <div className="fixed inset-0 z-[100] bg-slate-950/75 backdrop-blur-sm flex flex-col items-center justify-center p-4">
                    <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-2xl flex flex-col items-center gap-3 max-w-sm text-center">
                        <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
                        <h3 className="text-base font-bold text-white">Updating Duty Roster</h3>
                        <p className="text-xs text-slate-400">
                            Executing atomic database transaction with low-memory batching... please wait.
                        </p>
                    </div>
                </div>
            )}

            <div className="space-y-6">
                {/* 1. Header Banner */}
                <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 border border-indigo-900/40 shadow-xl relative overflow-hidden no-print">
                    <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                        <div>
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold uppercase tracking-wider mb-2">
                                <CalendarRange className="w-3.5 h-3.5" />
                                Workforce Scheduling (M02 - AMS)
                            </div>
                            <h1 className="text-2xl lg:text-3xl font-bold text-white tracking-tight">
                                Duty Roster Planner
                            </h1>
                            <p className="text-slate-400 text-sm mt-1">
                                Plan, rotate, and publish month-by-month employee shift schedules, dynamic rest days, and noticeboard sheets.
                            </p>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-wrap items-center gap-2">
                            <Link
                                href="/roster/patterns"
                                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-950/60 hover:bg-indigo-900/60 text-indigo-300 border border-indigo-500/30 text-xs font-semibold transition shadow-sm"
                                title="Manage Reusable Roster Patterns & Templates"
                            >
                                <Sparkles className="w-4 h-4 text-indigo-400" />
                                Roster Patterns
                            </Link>

                            <Link
                                href="/roster/shift-swaps"
                                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-950/60 hover:bg-indigo-900/60 text-cyan-300 border border-cyan-500/30 text-xs font-semibold transition shadow-sm"
                                title="Departmentalized Shift Swaps & HOD Approvals"
                            >
                                <ArrowLeftRight className="w-4 h-4 text-cyan-400" />
                                Shift Swaps
                            </Link>

                            <Link
                                href="/shifts"
                                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition"
                                title="Configure Shift Hours & Baseline Assignments"
                            >
                                <Clock className="w-4 h-4 text-indigo-400" />
                                Shift Definitions
                            </Link>

                            <button
                                onClick={handleExportCsv}
                                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition"
                                title="Export Noticeboard CSV Matrix"
                            >
                                <Download className="w-4 h-4" />
                                Export CSV
                            </button>

                            <button
                                onClick={handlePrintNoticeboard}
                                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition"
                                title="Print Physical Noticeboard Matrix"
                            >
                                <Printer className="w-4 h-4" />
                                Print
                            </button>

                            {!is_payroll_locked && (
                                <>
                                    <button
                                        onClick={() => setIsGenerateModalOpen(true)}
                                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-lg shadow-indigo-600/30 transition"
                                    >
                                        <Sparkles className="w-4 h-4" />
                                        Generate Roster
                                    </button>

                                    <button
                                        onClick={() => setIsSwapModalOpen(true)}
                                        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-xs transition"
                                    >
                                        <ArrowLeftRight className="w-4 h-4" />
                                        Shift Swap
                                    </button>

                                    {summary.published_entries > 0 ? (
                                        <button
                                            onClick={() => handlePublishToggle(false)}
                                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold text-xs transition"
                                            title="Revert to Draft for modifications"
                                        >
                                            <AlertCircle className="w-4 h-4" />
                                            Revert to Draft
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => handlePublishToggle(true)}
                                            disabled={summary.draft_entries === 0 && summary.total_scheduled_shifts === 0}
                                            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold text-xs shadow-lg shadow-emerald-600/30 transition"
                                        >
                                            <CheckCircle2 className="w-4 h-4" />
                                            Publish Roster
                                        </button>
                                    )}

                                    <button
                                        onClick={handleClearRoster}
                                        disabled={summary.total_scheduled_shifts === 0 && summary.total_rest_days === 0}
                                        className="p-2 rounded-xl bg-slate-800/80 hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 border border-slate-700 hover:border-rose-900 transition disabled:opacity-30"
                                        title="Clear Roster Entries"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Stats strip */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-800">
                        <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800/80">
                            <span className="text-xs text-slate-400 font-medium">Total Staff</span>
                            <div className="text-xl font-bold text-white mt-0.5">{summary.total_employees}</div>
                        </div>
                        <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800/80">
                            <span className="text-xs text-slate-400 font-medium">Scheduled Shifts</span>
                            <div className="text-xl font-bold text-indigo-400 mt-0.5">{summary.total_scheduled_shifts}</div>
                        </div>
                        <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800/80">
                            <span className="text-xs text-slate-400 font-medium">Scheduled Rest Days</span>
                            <div className="text-xl font-bold text-amber-400 mt-0.5">{summary.total_rest_days}</div>
                        </div>
                        <div className="bg-slate-900/60 p-3.5 rounded-xl border border-slate-800/80">
                            <span className="text-xs text-slate-400 font-medium">Roster Status</span>
                            <div className="mt-1">
                                {is_payroll_locked ? (
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                                        <Lock className="w-3 h-3" /> Locked by Payroll
                                    </span>
                                ) : summary.published_entries > 0 && summary.draft_entries === 0 ? (
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                        <CheckCircle2 className="w-3 h-3" /> Published
                                    </span>
                                ) : summary.draft_entries > 0 ? (
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                        <AlertCircle className="w-3 h-3" /> Draft Mode
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                                        Unscheduled
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. Month Navigator & Filter Bar */}
                <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 shadow-md flex flex-col md:flex-row items-center justify-between gap-4 no-print">
                    {/* Month Picker Controls */}
                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <button
                            onClick={handlePrevMonth}
                            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
                            title="Previous Month"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/80 rounded-xl border border-slate-700">
                            <CalendarIcon className="w-4 h-4 text-indigo-400" />
                            <span className="text-base font-bold text-white min-w-[140px] text-center">
                                {month_name}
                            </span>
                        </div>
                        <button
                            onClick={handleNextMonth}
                            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
                            title="Next Month"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>

                        {/* Quick jumps */}
                        <div className="hidden sm:flex items-center gap-1 border-l border-slate-800 pl-3">
                            <button
                                onClick={() => handleQuickJump('current')}
                                className="px-2.5 py-1 text-xs rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                            >
                                Current
                            </button>
                            <button
                                onClick={() => handleQuickJump('next')}
                                className="px-2.5 py-1 text-xs rounded-lg bg-slate-800 hover:bg-slate-700 text-indigo-300 transition"
                            >
                                Next Month
                            </button>
                            <button
                                onClick={() => handleQuickJump('quarter')}
                                className="px-2.5 py-1 text-xs rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                            >
                                Next Quarter
                            </button>
                        </div>
                    </div>

                    {/* Department & Search Filters */}
                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <div className="relative flex-1 md:w-48">
                            <Filter className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                            <select
                                value={departmentFilter}
                                onChange={(e) => handleDepartmentChange(e.target.value)}
                                className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-xl pl-9 pr-8 py-2 focus:ring-2 focus:ring-indigo-500 transition"
                            >
                                <option value="all">All Departments</option>
                                {departments.map((dept) => (
                                    <option key={dept.id} value={dept.id}>
                                        {dept.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="relative flex-1 md:w-56">
                            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                            <input
                                type="text"
                                placeholder="Search personnel..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-xl pl-9 pr-3 py-2 focus:ring-2 focus:ring-indigo-500 transition placeholder-slate-500"
                            />
                        </div>
                    </div>
                </div>

                {/* 3. Shifts Legend & Fatigue Warning Alert Strip */}
                <div className="bg-slate-900/70 px-4 py-3 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs no-print">
                    <div className="flex flex-wrap items-center gap-3">
                        <span className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">Legend:</span>
                        {shifts.map((s) => (
                            <div key={s.id} className="flex items-center gap-1.5">
                                <span
                                    className="w-2.5 h-2.5 rounded-full"
                                    style={{ backgroundColor: s.color || '#3B82F6' }}
                                />
                                <span className="text-slate-200 font-medium">{s.code}</span>
                                <span className="text-slate-500 text-[10px]">({s.start_time.substring(0, 5)}-{s.end_time.substring(0, 5)})</span>
                            </div>
                        ))}
                        <div className="flex items-center gap-1.5 border-l border-slate-800 pl-2.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                            <span className="text-amber-300 font-medium">OFF</span>
                            <span className="text-slate-500 text-[10px]">(Rest)</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                            <span className="text-rose-300 font-medium">PH</span>
                            <span className="text-slate-500 text-[10px]">(Holiday)</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-teal-500" />
                            <span className="text-teal-300 font-medium">LV</span>
                            <span className="text-slate-500 text-[10px]">(Leave)</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-lg text-amber-300 text-[11px]">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                        <span>Fatigue Alert: Badges flag &lt;11h rest between consecutive shifts (Shop &amp; Office Law).</span>
                    </div>
                </div>

                {/* 4. Interactive Matrix Grid */}
                <div className="bg-slate-900 rounded-2xl border border-slate-800 shadow-xl overflow-hidden">
                    <div className="overflow-x-auto max-h-[750px]">
                        <table className="w-full border-collapse text-left text-xs">
                            {/* Table Header */}
                            <thead className="bg-slate-950 text-slate-400 sticky top-0 z-20 shadow-md">
                                <tr>
                                    {/* Sticky Employee column header */}
                                    <th className="p-3.5 sticky left-0 z-30 bg-slate-950 border-r border-slate-800 min-w-[220px] font-semibold text-slate-300 shadow-[2px_0_5px_rgba(0,0,0,0.3)]">
                                        Employee ({filteredMatrix.length})
                                    </th>

                                    {/* Sticky Monthly stats header */}
                                    <th className="p-2.5 text-center bg-slate-950 border-r border-slate-800 min-w-[75px] font-semibold text-slate-400 text-[11px]">
                                        Work / Off
                                    </th>

                                    {/* Day columns */}
                                    {days.map((day) => (
                                        <th
                                            key={day.day}
                                            className={`p-2 text-center border-r border-slate-800/60 min-w-[42px] max-w-[48px] ${
                                                day.is_sunday
                                                    ? 'bg-amber-950/20 text-amber-400'
                                                    : day.is_saturday
                                                    ? 'bg-slate-900/60 text-indigo-300'
                                                    : 'text-slate-300'
                                            }`}
                                        >
                                            <div className="font-bold text-xs">{day.day}</div>
                                            <div className="text-[10px] uppercase font-semibold text-slate-500">
                                                {day.day_name}
                                            </div>
                                            {day.holiday && (
                                                <div
                                                    className="w-1.5 h-1.5 rounded-full bg-rose-500 mx-auto mt-0.5"
                                                    title={`Holiday: ${day.holiday.name} (${day.holiday.type})`}
                                                />
                                            )}
                                        </th>
                                    ))}
                                </tr>
                            </thead>

                            {/* Table Body */}
                            <tbody className="divide-y divide-slate-800/60">
                                {filteredMatrix.length === 0 ? (
                                    <tr>
                                        <td colSpan={days.length + 2} className="text-center py-16 text-slate-500">
                                            <Users className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                                            No employee records found matching your filters.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredMatrix.map((row) => (
                                        <tr key={row.employee.id} className="hover:bg-slate-800/40 transition">
                                            {/* Employee info (Sticky left) */}
                                            <td className="p-3 sticky left-0 z-10 bg-slate-900/95 border-r border-slate-800 shadow-[2px_0_5px_rgba(0,0,0,0.2)]">
                                                <div className="font-semibold text-slate-200 text-xs truncate max-w-[190px]">
                                                    {row.employee.full_name}
                                                </div>
                                                <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-0.5">
                                                    <span className="font-mono text-indigo-400 font-semibold">{row.employee.emp_no}</span>
                                                    {row.employee.department && (
                                                        <span>• {row.employee.department.name}</span>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Employee Monthly Stats */}
                                            <td className="p-2 text-center border-r border-slate-800 bg-slate-900/70">
                                                <div className="font-bold text-xs text-white">
                                                    <span className="text-emerald-400">{row.stats.work_days}</span>
                                                    <span className="text-slate-500">/</span>
                                                    <span className="text-amber-400">{row.stats.rest_days}</span>
                                                </div>
                                                <div className="text-[10px] text-slate-500 font-medium">
                                                    {row.stats.total_hours}h
                                                </div>
                                            </td>

                                            {/* Daily cells */}
                                            {days.map((day) => {
                                                const cell = row.cells[day.date];
                                                const isHoliday = day.holiday !== null;
                                                const isLeave = cell?.leave !== null;
                                                const isRest = cell?.schedule_type === 'rest_day' || cell?.schedule_type === 'off';
                                                const hasShift = cell?.schedule_type === 'shift' && cell?.shift !== null;
                                                const hasFatigue = Boolean(cell?.fatigue_warning);

                                                return (
                                                    <td
                                                        key={day.date}
                                                        onClick={() =>
                                                            openCellModal(
                                                                row.employee.id,
                                                                row.employee.full_name,
                                                                day.date,
                                                                cell || {
                                                                    entry_id: null,
                                                                    date: day.date,
                                                                    schedule_type: null,
                                                                    shift: null,
                                                                    status: null,
                                                                    is_overridden: false,
                                                                    notes: null,
                                                                    leave: null,
                                                                }
                                                            )
                                                        }
                                                        className={`p-1 text-center border-r border-slate-800/40 cursor-pointer hover:ring-2 hover:ring-indigo-500/50 transition relative ${
                                                            day.is_sunday ? 'bg-amber-950/5' : ''
                                                        }`}
                                                    >
                                                        {isLeave ? (
                                                            <div
                                                                className="h-8 rounded-lg bg-teal-500/15 border border-teal-500/30 flex flex-col items-center justify-center text-teal-300 font-bold text-[10px] shadow-sm"
                                                                title={`Approved Leave: ${cell.leave?.leave_type}`}
                                                            >
                                                                <span>{cell.leave?.leave_code || 'LV'}</span>
                                                            </div>
                                                        ) : isHoliday && !hasShift ? (
                                                            <div
                                                                className="h-8 rounded-lg bg-rose-500/10 border border-rose-500/25 flex flex-col items-center justify-center text-rose-300 font-bold text-[10px]"
                                                                title={`Holiday: ${day.holiday?.name}`}
                                                            >
                                                                <span>PH</span>
                                                            </div>
                                                        ) : isRest ? (
                                                            <div
                                                                className="h-8 rounded-lg bg-amber-500/10 border border-amber-500/25 flex flex-col items-center justify-center text-amber-300 font-bold text-[10px]"
                                                                title="Scheduled Rest Day"
                                                            >
                                                                <span>OFF</span>
                                                            </div>
                                                        ) : hasShift ? (
                                                            <div
                                                                className="h-8 rounded-lg flex flex-col items-center justify-center text-white font-bold text-[10px] shadow-sm transition relative"
                                                                style={{
                                                                    backgroundColor: `${cell.shift?.color || '#3B82F6'}25`,
                                                                    borderColor: hasFatigue ? '#F59E0B' : `${cell.shift?.color || '#3B82F6'}60`,
                                                                    borderWidth: hasFatigue ? '1.5px' : '1px',
                                                                    color: cell.shift?.color || '#93C5FD',
                                                                }}
                                                                title={`${cell.shift?.name} (${cell.shift?.start_time}-${cell.shift?.end_time})${
                                                                    hasFatigue ? `\n⚠️ Alert: Rest turnaround is ${cell.rest_hours}h (<11h).` : ''
                                                                }`}
                                                            >
                                                                <span>{cell.shift?.code}</span>
                                                                {hasFatigue && (
                                                                    <span
                                                                        className="w-2 h-2 rounded-full bg-amber-400 absolute -top-1 -right-1 border border-slate-900"
                                                                        title={`Rest interval ${cell.rest_hours}h (<11h)`}
                                                                    />
                                                                )}
                                                                {cell.is_overridden && (
                                                                    <span className="w-1 h-1 rounded-full bg-indigo-400 absolute bottom-0.5 right-0.5" />
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <div className="h-8 rounded-lg border border-dashed border-slate-800 flex items-center justify-center text-slate-600 hover:border-slate-700 hover:text-slate-400">
                                                                <span className="text-[10px]">-</span>
                                                            </div>
                                                        )}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))
                                )}
                            </tbody>

                            {/* 5. Sticky Daily Coverage Headcount Summary Footer */}
                            {coverage_summary && (
                                <tfoot className="bg-slate-950 text-slate-300 border-t-2 border-slate-700 sticky bottom-0 z-20 shadow-[0_-4px_6px_rgba(0,0,0,0.3)]">
                                    <tr>
                                        <td className="p-2.5 font-bold text-xs sticky left-0 bg-slate-950 border-r border-slate-800 text-indigo-400 shadow-[2px_0_5px_rgba(0,0,0,0.3)]">
                                            Daily Working Headcount
                                        </td>
                                        <td className="p-2 text-center border-r border-slate-800 bg-slate-950 text-[10px] text-slate-400 font-semibold">
                                            Staff On Duty
                                        </td>
                                        {days.map((day) => {
                                            const stat = coverage_summary[day.date];
                                            const count = stat?.total_working ?? 0;
                                            return (
                                                <td
                                                    key={day.date}
                                                    className={`p-1.5 text-center border-r border-slate-800/60 font-bold text-xs ${
                                                        count === 0 && !day.is_sunday
                                                            ? 'text-rose-400 bg-rose-950/20'
                                                            : 'text-indigo-300'
                                                    }`}
                                                    title={`Working: ${count} staff\nRest: ${stat?.total_rest ?? 0}\nLeave: ${stat?.total_leave ?? 0}`}
                                                >
                                                    {count}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                    <tr>
                                        <td className="p-2 text-xs sticky left-0 bg-slate-950 border-r border-slate-800 text-amber-400 font-semibold shadow-[2px_0_5px_rgba(0,0,0,0.3)]">
                                            Scheduled Rest Days (OFF)
                                        </td>
                                        <td className="p-1 text-center border-r border-slate-800 bg-slate-950 text-[10px] text-slate-500">
                                            Rest Days
                                        </td>
                                        {days.map((day) => (
                                            <td
                                                key={day.date}
                                                className="p-1 text-center border-r border-slate-800/60 text-amber-400 text-[11px] font-medium"
                                            >
                                                {coverage_summary[day.date]?.total_rest ?? 0}
                                            </td>
                                        ))}
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>
                </div>
            </div>

            {/* 6. Cell Edit Modal */}
            {selectedCell && (
                <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                            <div>
                                <h3 className="text-base font-bold text-white">Adjust Roster Entry</h3>
                                <p className="text-xs text-slate-400 mt-0.5">
                                    {selectedCell.employeeName} • {selectedCell.date}
                                </p>
                            </div>
                            <button
                                onClick={() => setSelectedCell(null)}
                                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleCellSubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                                    Schedule Type
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => cellForm.setData((p) => ({ ...p, schedule_type: 'shift' }))}
                                        className={`py-2 px-3 rounded-xl border text-xs font-semibold transition ${
                                            cellForm.data.schedule_type === 'shift'
                                                ? 'bg-indigo-600 border-indigo-500 text-white shadow-md'
                                                : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                                        }`}
                                    >
                                        Work Shift
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => cellForm.setData((p) => ({ ...p, schedule_type: 'rest_day' }))}
                                        className={`py-2 px-3 rounded-xl border text-xs font-semibold transition ${
                                            cellForm.data.schedule_type === 'rest_day'
                                                ? 'bg-amber-600 border-amber-500 text-white shadow-md'
                                                : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                                        }`}
                                    >
                                        Rest Day (OFF)
                                    </button>
                                </div>
                            </div>

                            {cellForm.data.schedule_type === 'shift' && (
                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                                        Select Shift
                                    </label>
                                    <select
                                        value={cellForm.data.shift_id}
                                        onChange={(e) => cellForm.setData((p) => ({ ...p, shift_id: e.target.value }))}
                                        className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-indigo-500"
                                        required
                                    >
                                        {shifts.map((s) => (
                                            <option key={s.id} value={s.id}>
                                                {s.name} ({s.code}) [{s.start_time.substring(0, 5)} - {s.end_time.substring(0, 5)}]
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                                    Notes (Optional)
                                </label>
                                <input
                                    type="text"
                                    placeholder="e.g., Managerial substitution or emergency cover"
                                    value={cellForm.data.notes}
                                    onChange={(e) => cellForm.setData((p) => ({ ...p, notes: e.target.value }))}
                                    className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>

                            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                                <button
                                    type="button"
                                    onClick={() => setSelectedCell(null)}
                                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={cellForm.processing}
                                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30"
                                >
                                    Save Entry
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* 7. Shift Swap Modal */}
            {isSwapModalOpen && (
                <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                            <div className="flex items-center gap-2">
                                <div className="p-2 rounded-xl bg-indigo-600/20 text-indigo-400">
                                    <ArrowLeftRight className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-white">Shift Swap</h3>
                                    <p className="text-xs text-slate-400 mt-0.5">
                                        Atomically swap shifts between two employees on a chosen date.
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsSwapModalOpen(false)}
                                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSwapSubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                                    Swap Date
                                </label>
                                <input
                                    type="date"
                                    value={swapForm.data.date}
                                    onChange={(e) => swapForm.setData('date', e.target.value)}
                                    className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-indigo-500"
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                                        Employee A
                                    </label>
                                    <select
                                        value={swapForm.data.employee_a_id}
                                        onChange={(e) => swapForm.setData('employee_a_id', e.target.value)}
                                        className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-indigo-500"
                                        required
                                    >
                                        {matrix.map((m) => (
                                            <option key={m.employee.id} value={m.employee.id}>
                                                {m.employee.emp_no} - {m.employee.full_name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                                        Employee B
                                    </label>
                                    <select
                                        value={swapForm.data.employee_b_id}
                                        onChange={(e) => swapForm.setData('employee_b_id', e.target.value)}
                                        className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-indigo-500"
                                        required
                                    >
                                        {matrix.map((m) => (
                                            <option key={m.employee.id} value={m.employee.id}>
                                                {m.employee.emp_no} - {m.employee.full_name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                                <button
                                    type="button"
                                    onClick={() => setIsSwapModalOpen(false)}
                                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={swapForm.processing}
                                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30"
                                >
                                    Execute Swap
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* 8. Bulk Pattern-Based Roster Generator Modal */}
            {isGenerateModalOpen && (
                <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-6 my-8">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 rounded-xl bg-indigo-600/20 text-indigo-400">
                                    <Sparkles className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-white">Generate Duty Roster</h3>
                                    <p className="text-xs text-slate-400 mt-0.5">
                                        Build schedules across date ranges using high-performance chunked database batching.
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsGenerateModalOpen(false)}
                                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleGenerateSubmit} className="space-y-5">
                            {/* Generation Source: Saved Template vs Custom */}
                            <div className="flex items-center justify-between p-1 bg-slate-950 rounded-xl border border-slate-800">
                                <button
                                    type="button"
                                    onClick={() => setGenerationSource('template')}
                                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition ${
                                        generationSource === 'template'
                                            ? 'bg-indigo-600 text-white shadow-md'
                                            : 'text-slate-400 hover:text-white'
                                    }`}
                                >
                                    <Sparkles className="w-3.5 h-3.5" />
                                    <span>Apply Saved Template ({patterns.length})</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setGenerationSource('custom')}
                                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition ${
                                        generationSource === 'custom'
                                            ? 'bg-indigo-600 text-white shadow-md'
                                            : 'text-slate-400 hover:text-white'
                                    }`}
                                >
                                    <CalendarIcon className="w-3.5 h-3.5" />
                                    <span>Custom On-The-Fly Pattern</span>
                                </button>
                            </div>

                            {/* If Saved Template: Pattern Picker & Preview */}
                            {generationSource === 'template' && (
                                <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-semibold text-slate-300">
                                            Select Roster Template
                                        </label>
                                        <a
                                            href="/roster/patterns"
                                            className="text-[11px] text-indigo-400 hover:text-indigo-300 hover:underline flex items-center gap-1"
                                            target="_blank"
                                            rel="noreferrer"
                                        >
                                            Manage Templates &rarr;
                                        </a>
                                    </div>
                                    {patterns.length === 0 ? (
                                        <div className="text-center py-4 text-xs text-slate-500">
                                            No roster templates configured yet.{' '}
                                            <a href="/roster/patterns" className="text-indigo-400 underline">
                                                Create your first template
                                            </a>{' '}
                                            or switch to "Custom On-The-Fly".
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            <select
                                                value={selectedPatternId}
                                                onChange={(e) => setSelectedPatternId(e.target.value)}
                                                className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-indigo-500"
                                            >
                                                {patterns.map((p) => (
                                                    <option key={p.id} value={p.id}>
                                                        {p.name} ({p.code}) — {p.pattern_type === 'weekly' ? 'Weekly 7-Day' : 'Rolling Cyclical'}
                                                    </option>
                                                ))}
                                            </select>
                                            {/* Preview selected pattern sequence */}
                                            {(() => {
                                                const sel = patterns.find((p) => p.id === selectedPatternId);
                                                if (!sel) return null;
                                                return (
                                                    <div className="pt-1">
                                                        <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1.5">
                                                            Sequence Preview ({sel.pattern_type === 'weekly' ? 'Weekly 7-Day' : 'Rolling Cyclical'}):
                                                        </div>
                                                        <div className="flex flex-wrap gap-1.5">
                                                            {sel.pattern_type === 'weekly' && Array.isArray(sel.pattern_data) &&
                                                                sel.pattern_data.map((day: any, idx: number) => {
                                                                    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
                                                                    const shift = shifts.find((s) => s.id === day.shift_id);
                                                                    return (
                                                                        <span
                                                                            key={idx}
                                                                            className={`px-2 py-0.5 rounded text-[11px] font-mono font-medium ${
                                                                                day.is_rest_day
                                                                                    ? 'bg-amber-950/60 text-amber-300 border border-amber-800/60'
                                                                                    : 'bg-indigo-950/60 text-indigo-300 border border-indigo-800/60'
                                                                            }`}
                                                                        >
                                                                            {dayNames[idx]}: {day.is_rest_day ? 'OFF' : (shift?.code || 'Shift')}
                                                                        </span>
                                                                    );
                                                                })}
                                                            {sel.pattern_type === 'cyclical' &&
                                                                (Array.isArray(sel.pattern_data?.steps) ? sel.pattern_data.steps : Array.isArray(sel.pattern_data) ? sel.pattern_data : []).map((step: any, idx: number) => {
                                                                    const shift = shifts.find((s) => s.id === step.shift_id);
                                                                    return (
                                                                        <span
                                                                            key={idx}
                                                                            className={`px-2 py-0.5 rounded text-[11px] font-mono font-medium ${
                                                                                step.is_rest_day
                                                                                    ? 'bg-amber-950/60 text-amber-300 border border-amber-800/60'
                                                                                    : 'bg-teal-950/60 text-teal-300 border border-teal-800/60'
                                                                            }`}
                                                                        >
                                                                            Step {idx + 1}: {step.is_rest_day ? 'OFF' : (shift?.code || 'Shift')}
                                                                        </span>
                                                                    );
                                                                })}
                                                        </div>
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* If Custom: Mode Tabs and Configurations */}
                            {generationSource === 'custom' && (
                                <>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-300 mb-2">
                                            Select Generation Pattern
                                        </label>
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                            <button
                                                type="button"
                                                onClick={() => generateForm.setData('pattern_mode', 'weekly')}
                                                className={`p-3 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1.5 transition ${
                                                    generateForm.data.pattern_mode === 'weekly'
                                                        ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300'
                                                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
                                                }`}
                                            >
                                                <CalendarIcon className="w-4 h-4" />
                                                <span>7-Day Weekly</span>
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => generateForm.setData('pattern_mode', 'cyclical')}
                                                className={`p-3 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1.5 transition ${
                                                    generateForm.data.pattern_mode === 'cyclical'
                                                        ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300'
                                                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
                                                }`}
                                            >
                                                <RefreshCw className="w-4 h-4" />
                                                <span>Rolling N-Day</span>
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => generateForm.setData('pattern_mode', 'daily')}
                                                className={`p-3 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1.5 transition ${
                                                    generateForm.data.pattern_mode === 'daily'
                                                        ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300'
                                                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
                                                }`}
                                            >
                                                <Clock className="w-4 h-4" />
                                                <span>Daily Single</span>
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => generateForm.setData('pattern_mode', 'copy_month')}
                                                className={`p-3 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1.5 transition ${
                                                    generateForm.data.pattern_mode === 'copy_month'
                                                        ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300'
                                                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
                                                }`}
                                            >
                                                <Copy className="w-4 h-4" />
                                                <span>Clone Month</span>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Custom Weekly Matrix */}
                                    {generateForm.data.pattern_mode === 'weekly' && (
                                        <div className="space-y-3 bg-slate-950/60 p-4 rounded-xl border border-slate-800">
                                            <div className="text-xs font-bold text-indigo-400">Weekly 7-Day Schedule Matrix</div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                                {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(
                                                    (dayName, idx) => {
                                                        const dayCfg = generateForm.data.weekly_config[idx] || {
                                                            shift_id: shifts[0]?.id || '',
                                                            is_rest_day: idx === 6,
                                                        };

                                                        return (
                                                            <div
                                                                key={dayName}
                                                                className="flex items-center gap-2 bg-slate-900 p-2.5 rounded-lg border border-slate-800"
                                                            >
                                                                <span className="w-12 text-xs font-bold text-slate-300">{dayName.substring(0, 3)}</span>
                                                                <select
                                                                    disabled={dayCfg.is_rest_day}
                                                                    value={dayCfg.shift_id}
                                                                    onChange={(e) => {
                                                                        const updated = [...generateForm.data.weekly_config];
                                                                        updated[idx] = { ...dayCfg, shift_id: e.target.value };
                                                                        generateForm.setData('weekly_config', updated);
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
                                                                            const updated = [...generateForm.data.weekly_config];
                                                                            updated[idx] = {
                                                                                ...dayCfg,
                                                                                is_rest_day: e.target.checked,
                                                                            };
                                                                            generateForm.setData('weekly_config', updated);
                                                                        }}
                                                                        className="rounded bg-slate-800 border-slate-700 text-amber-500 focus:ring-amber-400"
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

                                    {/* Custom Cyclical Matrix */}
                                    {generateForm.data.pattern_mode === 'cyclical' && (
                                        <div className="space-y-3 bg-slate-950/60 p-4 rounded-xl border border-slate-800">
                                            <div className="flex items-center justify-between">
                                                <div className="text-xs font-bold text-indigo-400">
                                                    Rolling Rotation Cycle ({generateForm.data.cyclical_config.steps.length} Steps)
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const steps = [...generateForm.data.cyclical_config.steps];
                                                        steps.push({
                                                            shift_id: shifts[0]?.id || '',
                                                            is_rest_day: false,
                                                            notes: `Day ${steps.length + 1}`,
                                                        });
                                                        generateForm.setData('cyclical_config', {
                                                            ...generateForm.data.cyclical_config,
                                                            steps,
                                                        });
                                                    }}
                                                    className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold"
                                                >
                                                    + Add Step
                                                </button>
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                                                {generateForm.data.cyclical_config.steps.map((step, idx) => (
                                                    <div
                                                        key={idx}
                                                        className="flex items-center gap-2 bg-slate-900 p-2.5 rounded-lg border border-slate-800 text-xs"
                                                    >
                                                        <span className="w-14 text-slate-400 font-bold">Step {idx + 1}</span>
                                                        <select
                                                            disabled={step.is_rest_day}
                                                            value={step.shift_id}
                                                            onChange={(e) => {
                                                                const steps = [...generateForm.data.cyclical_config.steps];
                                                                steps[idx] = { ...step, shift_id: e.target.value };
                                                                generateForm.setData('cyclical_config', {
                                                                    ...generateForm.data.cyclical_config,
                                                                    steps,
                                                                });
                                                            }}
                                                            className="flex-1 bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-lg px-2 py-1 disabled:opacity-30"
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
                                                                    const steps = [...generateForm.data.cyclical_config.steps];
                                                                    steps[idx] = { ...step, is_rest_day: e.target.checked };
                                                                    generateForm.setData('cyclical_config', {
                                                                        ...generateForm.data.cyclical_config,
                                                                        steps,
                                                                    });
                                                                }}
                                                                className="rounded bg-slate-800 border-slate-700 text-amber-500"
                                                            />
                                                            <span>Off</span>
                                                        </label>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Custom Daily Matrix */}
                                    {generateForm.data.pattern_mode === 'daily' && (
                                        <div className="space-y-3 bg-slate-950/60 p-4 rounded-xl border border-slate-800">
                                            <div>
                                                <label className="block text-xs font-semibold text-slate-300 mb-1">
                                                    Working Shift
                                                </label>
                                                <select
                                                    value={generateForm.data.daily_config.shift_id}
                                                    onChange={(e) =>
                                                        generateForm.setData('daily_config', {
                                                            ...generateForm.data.daily_config,
                                                            shift_id: e.target.value,
                                                        })
                                                    }
                                                    className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-xl px-3 py-2"
                                                >
                                                    {shifts.map((s) => (
                                                        <option key={s.id} value={s.id}>
                                                            {s.name} ({s.code}) [{s.start_time.substring(0, 5)} - {s.end_time.substring(0, 5)}]
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                    )}

                                    {/* Custom Copy Month Matrix */}
                                    {generateForm.data.pattern_mode === 'copy_month' && (
                                        <div className="space-y-3 bg-slate-950/60 p-4 rounded-xl border border-slate-800">
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                                                        Source Year
                                                    </label>
                                                    <input
                                                        type="number"
                                                        value={generateForm.data.copy_config.source_year}
                                                        onChange={(e) =>
                                                            generateForm.setData('copy_config', {
                                                                ...generateForm.data.copy_config,
                                                                source_year: parseInt(e.target.value) || year,
                                                            })
                                                        }
                                                        className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-xl px-3 py-2"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                                                        Source Month
                                                    </label>
                                                    <input
                                                        type="number"
                                                        min={1}
                                                        max={12}
                                                        value={generateForm.data.copy_config.source_month}
                                                        onChange={(e) =>
                                                            generateForm.setData('copy_config', {
                                                                ...generateForm.data.copy_config,
                                                                source_month: parseInt(e.target.value) || 1,
                                                            })
                                                        }
                                                        className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-xl px-3 py-2"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}

                            {/* Personnel Assignment Target Scope */}
                            <div className="space-y-3">
                                <label className="block text-xs font-semibold text-slate-300">
                                    Target Personnel Scope
                                </label>
                                <div className="grid grid-cols-3 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setStaffScope('all')}
                                        className={`py-2 px-3 rounded-xl border text-xs font-medium transition ${
                                            staffScope === 'all'
                                                ? 'bg-indigo-600/30 border-indigo-500 text-indigo-200'
                                                : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:bg-slate-800'
                                        }`}
                                    >
                                        All Personnel ({staffList.length})
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setStaffScope('department')}
                                        className={`py-2 px-3 rounded-xl border text-xs font-medium transition ${
                                            staffScope === 'department'
                                                ? 'bg-indigo-600/30 border-indigo-500 text-indigo-200'
                                                : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:bg-slate-800'
                                        }`}
                                    >
                                        By Department
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setStaffScope('specific')}
                                        className={`py-2 px-3 rounded-xl border text-xs font-medium transition ${
                                            staffScope === 'specific'
                                                ? 'bg-indigo-600/30 border-indigo-500 text-indigo-200'
                                                : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:bg-slate-800'
                                        }`}
                                    >
                                        Specific Staff ({selectedStaffIds.length})
                                    </button>
                                </div>

                                {staffScope === 'department' && (
                                    <div>
                                        <select
                                            value={generateForm.data.department_id}
                                            onChange={(e) => generateForm.setData('department_id', e.target.value)}
                                            className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                                        >
                                            <option value="">Select a Department</option>
                                            {departments.map((d) => (
                                                <option key={d.id} value={d.id}>
                                                    {d.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                {staffScope === 'specific' && (
                                    <div className="space-y-2.5 p-3 rounded-xl bg-slate-950/70 border border-slate-800">
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="relative flex-1">
                                                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                                <input
                                                    type="text"
                                                    placeholder="Search personnel by name or ID..."
                                                    value={staffSearchQuery}
                                                    onChange={(e) => setStaffSearchQuery(e.target.value)}
                                                    className="w-full bg-slate-900 border border-slate-700 text-xs text-slate-200 rounded-lg pl-8 pr-3 py-1.5 focus:ring-1 focus:ring-indigo-500"
                                                />
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const allVisibleIds = filteredStaffList.map((s) => s.id);
                                                    const isAllSelected = allVisibleIds.every((id) => selectedStaffIds.includes(id));
                                                    if (isAllSelected) {
                                                        setSelectedStaffIds(selectedStaffIds.filter((id) => !allVisibleIds.includes(id)));
                                                    } else {
                                                        setSelectedStaffIds(Array.from(new Set([...selectedStaffIds, ...allVisibleIds])));
                                                    }
                                                }}
                                                className="text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 px-2 py-1 rounded bg-slate-800 border border-slate-700 whitespace-nowrap"
                                            >
                                                Select Visible
                                            </button>
                                        </div>

                                        <div className="max-h-40 overflow-y-auto space-y-1 divide-y divide-slate-800/50">
                                            {filteredStaffList.map((st) => {
                                                const isChecked = selectedStaffIds.includes(st.id);
                                                return (
                                                    <label
                                                        key={st.id}
                                                        className="flex items-center gap-2.5 p-1.5 rounded-lg hover:bg-slate-900 cursor-pointer text-xs"
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={isChecked}
                                                            onChange={(e) => {
                                                                if (e.target.checked) {
                                                                    setSelectedStaffIds([...selectedStaffIds, st.id]);
                                                                } else {
                                                                    setSelectedStaffIds(selectedStaffIds.filter((id) => id !== st.id));
                                                                }
                                                            }}
                                                            className="rounded bg-slate-800 border-slate-700 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
                                                        />
                                                        <div className="flex-1 min-w-0">
                                                            <div className="text-slate-200 font-medium truncate">{st.full_name}</div>
                                                            <div className="text-[10px] text-slate-500 truncate">
                                                                {st.emp_no} {st.department ? `· ${st.department.name}` : ''}
                                                            </div>
                                                        </div>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Date Range */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                                        Start Date
                                    </label>
                                    <input
                                        type="date"
                                        value={generateForm.data.start_date}
                                        onChange={(e) => generateForm.setData('start_date', e.target.value)}
                                        className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                                        End Date
                                    </label>
                                    <input
                                        type="date"
                                        value={generateForm.data.end_date}
                                        onChange={(e) => generateForm.setData('end_date', e.target.value)}
                                        className="w-full bg-slate-800 border border-slate-700 text-slate-200 text-xs rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-500"
                                        required
                                    />
                                </div>
                            </div>

                            {/* Leave Protection Option */}
                            <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
                                <div>
                                    <div className="text-xs font-bold text-teal-400">Preserve Approved Leaves</div>
                                    <p className="text-[11px] text-slate-400">
                                        Do not schedule work shifts over days with pre-approved employee leaves.
                                    </p>
                                </div>
                                <input
                                    type="checkbox"
                                    checked={generateForm.data.preserve_leaves}
                                    onChange={(e) => generateForm.setData('preserve_leaves', e.target.checked)}
                                    className="rounded bg-slate-800 border-slate-700 text-teal-500 focus:ring-teal-400 w-4 h-4 cursor-pointer"
                                />
                            </div>

                            {/* Conflict & State options */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                                        Existing Entries Conflict Mode
                                    </label>
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() => generateForm.setData('conflict_mode', 'overwrite')}
                                            className={`flex-1 py-1.5 px-3 rounded-lg border text-xs font-medium ${
                                                generateForm.data.conflict_mode === 'overwrite'
                                                    ? 'bg-indigo-600/30 border-indigo-500 text-indigo-300'
                                                    : 'bg-slate-800 border-slate-700 text-slate-400'
                                            }`}
                                        >
                                            Overwrite
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => generateForm.setData('conflict_mode', 'preserve')}
                                            className={`flex-1 py-1.5 px-3 rounded-lg border text-xs font-medium ${
                                                generateForm.data.conflict_mode === 'preserve'
                                                    ? 'bg-indigo-600/30 border-indigo-500 text-indigo-300'
                                                    : 'bg-slate-800 border-slate-700 text-slate-400'
                                            }`}
                                        >
                                            Preserve Existing
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                                        Roster Status
                                    </label>
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() => generateForm.setData('status', 'published')}
                                            className={`flex-1 py-1.5 px-3 rounded-lg border text-xs font-medium ${
                                                generateForm.data.status === 'published'
                                                    ? 'bg-emerald-600/30 border-emerald-500 text-emerald-300'
                                                    : 'bg-slate-800 border-slate-700 text-slate-400'
                                            }`}
                                        >
                                            Published
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => generateForm.setData('status', 'draft')}
                                            className={`flex-1 py-1.5 px-3 rounded-lg border text-xs font-medium ${
                                                generateForm.data.status === 'draft'
                                                    ? 'bg-amber-600/30 border-amber-500 text-amber-300'
                                                    : 'bg-slate-800 border-slate-700 text-slate-400'
                                            }`}
                                        >
                                            Draft
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                                <button
                                    type="button"
                                    onClick={() => setIsGenerateModalOpen(false)}
                                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={generateForm.processing}
                                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30"
                                >
                                    <Sparkles className="w-4 h-4" />
                                    Generate Roster
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </AuthenticatedLayout>
    );
}
