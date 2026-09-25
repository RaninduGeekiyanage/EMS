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
    pattern?: {
        id: string;
        name: string;
        code: string;
        pattern_type: string;
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
    is_pre_hire?: boolean;
    is_current_roster?: boolean;
    is_allocated_here?: boolean;
    other_roster?: {
        id: string;
        name: string;
        code: string;
    } | null;
}

const PATTERN_PALETTE = [
    { bg: 'bg-orange-500', border: 'border-orange-500', text: 'text-orange-400', hex: '#f97316', lightBg: 'rgba(249, 115, 22, 0.08)' },
    { bg: 'bg-cyan-500', border: 'border-cyan-500', text: 'text-cyan-400', hex: '#06b6d4', lightBg: 'rgba(6, 182, 212, 0.08)' },
    { bg: 'bg-purple-500', border: 'border-purple-500', text: 'text-purple-400', hex: '#a855f7', lightBg: 'rgba(168, 85, 247, 0.08)' },
    { bg: 'bg-emerald-500', border: 'border-emerald-500', text: 'text-emerald-400', hex: '#10b981', lightBg: 'rgba(168, 85, 247, 0.08)' },
    { bg: 'bg-pink-500', border: 'border-pink-500', text: 'text-pink-400', hex: '#ec4899', lightBg: 'rgba(236, 72, 153, 0.08)' },
    { bg: 'bg-amber-500', border: 'border-amber-500', text: 'text-amber-400', hex: '#f59e0b', lightBg: 'rgba(245, 158, 11, 0.08)' },
    { bg: 'bg-blue-500', border: 'border-blue-500', text: 'text-blue-400', hex: '#3b82f6', lightBg: 'rgba(59, 130, 246, 0.08)' },
    { bg: 'bg-teal-500', border: 'border-teal-500', text: 'text-teal-400', hex: '#14b8a6', lightBg: 'rgba(20, 184, 166, 0.08)' },
];

const getPatternStyle = (patternId: string | null | undefined, patternsList: RosterPattern[]) => {
    if (!patternId) return null;
    const idx = patternsList.findIndex((p) => p.id === patternId);
    const charSum = patternId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const colorIdx = idx >= 0 ? idx % PATTERN_PALETTE.length : charSum % PATTERN_PALETTE.length;
    return PATTERN_PALETTE[colorIdx];
};

interface MatrixRow {
    employee: {
        id: string;
        emp_no: string;
        full_name: string;
        department: { id: string; name: string } | null;
        pattern?: {
            id: string;
            name: string;
            code: string;
            pattern_type: string;
        } | null;
    };
    cells: Record<string, MatrixCell>;
    stats: {
        work_days: number;
        rest_days: number;
        total_hours: number;
        roster_work_days?: number;
        roster_rest_days?: number;
        roster_hours?: number;
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
    const [selectedPatternId, setSelectedPatternId] = useState<string | null>(null);
    const [showPatternLines, setShowPatternLines] = useState<boolean>(true);

    // Modals
    const [isNewRosterModalOpen, setIsNewRosterModalOpen] = useState(false);
    const [isQuickPatternModalOpen, setIsQuickPatternModalOpen] = useState(false);
    const [isCloneModalOpen, setIsCloneModalOpen] = useState(false);
    const [isAddEmployeeModalOpen, setIsAddEmployeeModalOpen] = useState(false);
    const [isRemoveEmployeeModalOpen, setIsRemoveEmployeeModalOpen] = useState(false);
    const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);

    const [quickPatternEmpSearch, setQuickPatternEmpSearch] = useState('');
    const [quickPatternDeptFilter, setQuickPatternDeptFilter] = useState('all');
    const [addEmpSearch, setAddEmpSearch] = useState('');

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

    // Active patterns summary present across filtered entries
    const activePatternsSummary = useMemo(() => {
        const counts: Record<string, { id: string; name: string; code: string; pattern_type: string; count: number }> = {};
        filteredMatrix.forEach((row) => {
            Object.values(row.cells).forEach((cell) => {
                if (cell.pattern?.id && cell.is_current_roster !== false) {
                    if (!counts[cell.pattern.id]) {
                        counts[cell.pattern.id] = {
                            id: cell.pattern.id,
                            name: cell.pattern.name,
                            code: cell.pattern.code,
                            pattern_type: cell.pattern.pattern_type,
                            count: 0,
                        };
                    }
                    counts[cell.pattern.id].count++;
                }
            });
        });
        return Object.values(counts);
    }, [filteredMatrix]);

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

    // 2. New Roster Form (Multi-Pattern Cycle Rotation & Blank Shell)
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
        generation_mode: (patterns.length > 0 ? 'pattern' : 'blank') as 'pattern' | 'blank',
        selected_pattern_ids: (patterns.length > 0 ? [patterns[0].id] : []) as string[],
        pattern_allocations: {} as Record<string, string[]>,
        pattern_id: patterns[0]?.id || '',
        employee_ids: [] as string[],
    });

    const [rosterWizardStep, setRosterWizardStep] = useState<1 | 2 | 3>(1);
    const [wizardEmpSearch, setWizardEmpSearch] = useState('');
    const [wizardDeptFilter, setWizardDeptFilter] = useState('all');
    const [wizardAllocFilter, setWizardAllocFilter] = useState<'all' | 'unallocated'>('all');
    const [activeWizardPatternTab, setActiveWizardPatternTab] = useState<string>('');
    const [selectedPatternToAdd, setSelectedPatternToAdd] = useState<string>('');

    // List of RosterPattern objects currently selected in the wizard
    const selectedWizardPatterns = useMemo(() => {
        return newRosterForm.data.selected_pattern_ids
            .map((id) => patterns.find((p) => p.id === id))
            .filter(Boolean) as RosterPattern[];
    }, [patterns, newRosterForm.data.selected_pattern_ids]);

    // Active pattern object in Stage 3
    const currentActiveWizardPattern = useMemo(() => {
        return patterns.find((p) => p.id === activeWizardPatternTab) || selectedWizardPatterns[0] || null;
    }, [patterns, activeWizardPatternTab, selectedWizardPatterns]);

    // Total distinct employees allocated across all patterns
    const totalWizardAllocatedStaff = useMemo(() => {
        const allIds = new Set<string>();
        Object.values(newRosterForm.data.pattern_allocations || {}).forEach((ids) => {
            (ids || []).forEach((id) => allIds.add(id));
        });
        return allIds.size;
    }, [newRosterForm.data.pattern_allocations]);

    const openNewRosterModal = () => {
        const lastDay = new Date(year, month, 0).getDate();
        setRosterWizardStep(1);
        setWizardEmpSearch('');
        setWizardDeptFilter('all');
        setWizardAllocFilter('all');
        const initialPatternId = patterns[0]?.id || '';
        setActiveWizardPatternTab(initialPatternId);
        setSelectedPatternToAdd('');
        newRosterForm.setData({
            name: `${month_name} ${year} - Operations Roster`,
            code: `RST-${year}-${String(month).padStart(2, '0')}-OPS`,
            department_id: '',
            start_date: `${year}-${String(month).padStart(2, '0')}-01`,
            end_date: `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
            status: 'draft',
            notes: '',
            generation_mode: patterns.length > 0 ? 'pattern' : 'blank',
            selected_pattern_ids: initialPatternId ? [initialPatternId] : [],
            pattern_allocations: initialPatternId ? { [initialPatternId]: [] } : {},
            pattern_id: initialPatternId,
            employee_ids: [],
        });
        setIsNewRosterModalOpen(true);
    };

    const handleAddPatternToWizard = (patternId: string) => {
        if (!patternId || newRosterForm.data.selected_pattern_ids.includes(patternId)) return;
        const nextIds = [...newRosterForm.data.selected_pattern_ids, patternId];
        newRosterForm.setData({
            ...newRosterForm.data,
            selected_pattern_ids: nextIds,
            pattern_allocations: {
                ...newRosterForm.data.pattern_allocations,
                [patternId]: newRosterForm.data.pattern_allocations[patternId] || [],
            },
        });
        setSelectedPatternToAdd('');
        if (!activeWizardPatternTab) {
            setActiveWizardPatternTab(patternId);
        }
    };

    const handleRemovePatternFromWizard = (patternId: string) => {
        if (newRosterForm.data.selected_pattern_ids.length <= 1) return;
        const nextIds = newRosterForm.data.selected_pattern_ids.filter((id) => id !== patternId);
        const nextAllocations = { ...newRosterForm.data.pattern_allocations };
        delete nextAllocations[patternId];
        newRosterForm.setData({
            ...newRosterForm.data,
            selected_pattern_ids: nextIds,
            pattern_allocations: nextAllocations,
        });
        if (activeWizardPatternTab === patternId) {
            setActiveWizardPatternTab(nextIds[0] || '');
        }
    };

    const handleToggleEmployeeInPattern = (empId: string, targetPatternId: string) => {
        const currentInTarget = (newRosterForm.data.pattern_allocations[targetPatternId] || []).includes(empId);
        const nextAllocations = { ...newRosterForm.data.pattern_allocations };

        // Clean out from all patterns first (an employee can only belong to one pattern in the same roster)
        Object.keys(nextAllocations).forEach((pId) => {
            nextAllocations[pId] = (nextAllocations[pId] || []).filter((id) => id !== empId);
        });

        // If wasn't in target, add to target
        if (!currentInTarget) {
            nextAllocations[targetPatternId] = [...(nextAllocations[targetPatternId] || []), empId];
        }

        newRosterForm.setData('pattern_allocations', nextAllocations);
    };

    const handleAutoDistributeEvenly = () => {
        if (newRosterForm.data.selected_pattern_ids.length === 0) return;

        // Get matching available employees based on current filter & search
        const eligibleEmps = employeePool.filter((emp) => {
            const matchesSearch =
                !wizardEmpSearch ||
                emp.full_name.toLowerCase().includes(wizardEmpSearch.toLowerCase()) ||
                emp.emp_no.toLowerCase().includes(wizardEmpSearch.toLowerCase());
            const matchesDept = wizardDeptFilter === 'all' || emp.department_id === wizardDeptFilter;
            return matchesSearch && matchesDept;
        });

        const numPatterns = newRosterForm.data.selected_pattern_ids.length;
        const newAllocations: Record<string, string[]> = {};
        newRosterForm.data.selected_pattern_ids.forEach((pId) => {
            newAllocations[pId] = [];
        });

        eligibleEmps.forEach((emp, idx) => {
            const targetPatId = newRosterForm.data.selected_pattern_ids[idx % numPatterns];
            newAllocations[targetPatId].push(emp.id);
        });

        newRosterForm.setData('pattern_allocations', newAllocations);
    };

    const handleNewRosterSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (newRosterForm.data.generation_mode === 'blank') {
            newRosterForm.transform((data) => ({
                ...data,
                pattern_id: null,
                employee_ids: [],
                pattern_allocations: [],
            }));
            newRosterForm.post('/roster/rosters', {
                onSuccess: () => setIsNewRosterModalOpen(false),
            });
            return;
        }

        // Build pattern_allocations payload
        const allocationsPayload = newRosterForm.data.selected_pattern_ids
            .map((patId) => ({
                pattern_id: patId,
                employee_ids: newRosterForm.data.pattern_allocations[patId] || [],
            }))
            .filter((a) => a.employee_ids.length > 0);

        const allAllocatedIds = allocationsPayload.flatMap((a) => a.employee_ids);

        newRosterForm.transform((data) => ({
            ...data,
            pattern_allocations: allocationsPayload,
            pattern_id: allocationsPayload[0]?.pattern_id || data.selected_pattern_ids[0] || null,
            employee_ids: allAllocatedIds,
        }));

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

    const openQuickPatternModal = (empId?: string) => {
        setQuickPatternEmpSearch('');
        setQuickPatternDeptFilter('all');
        const empList = empId ? [empId] : matrix.map((r) => r.employee.id);
        quickPatternForm.setData({
            pattern_id: patterns[0]?.id || '',
            start_date: active_roster?.start_date || `${year}-${String(month).padStart(2, '0')}-01`,
            end_date: active_roster?.end_date || (() => {
                const lastDay = new Date(year, month, 0).getDate();
                return `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
            })(),
            employee_ids: empList,
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

    // 5. Add Employee Allocation Form
    const addEmployeeForm = useForm({
        employee_ids: [] as string[],
        effective_from: active_roster?.start_date || `${year}-${String(month).padStart(2, '0')}-01`,
        effective_to: active_roster?.end_date || `${year}-${String(month).padStart(2, '0')}-30`,
        pattern_id: '',
        notes: '',
    });

    const openAddEmployeeModal = () => {
        if (!active_roster) return;
        addEmployeeForm.setData({
            employee_ids: [],
            effective_from: active_roster.start_date,
            effective_to: active_roster.end_date,
            pattern_id: '',
            notes: '',
        });
        setAddEmpSearch('');
        setIsAddEmployeeModalOpen(true);
    };

    const handleAddEmployeeSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!active_roster) return;
        addEmployeeForm.post(`/roster/rosters/${active_roster.id}/allocations`, {
            preserveScroll: true,
            onSuccess: () => setIsAddEmployeeModalOpen(false),
        });
    };

    // 6. Remove Employee Allocation Form
    const removeEmployeeForm = useForm({
        employee_id: '',
        effective_removal_date: active_roster?.start_date || '',
        is_full_month: false,
    });

    const openRemoveEmployeeModal = (empId?: string) => {
        if (!active_roster) return;
        const targetEmp = empId || matrix[0]?.employee.id || '';
        removeEmployeeForm.setData({
            employee_id: targetEmp,
            effective_removal_date: active_roster.start_date,
            is_full_month: false,
        });
        setIsRemoveEmployeeModalOpen(true);
    };

    const handleRemoveEmployeeSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!active_roster) return;
        router.delete(`/roster/rosters/${active_roster.id}/allocations`, {
            data: {
                employee_id: removeEmployeeForm.data.employee_id,
                effective_removal_date: removeEmployeeForm.data.is_full_month ? null : removeEmployeeForm.data.effective_removal_date,
            },
            preserveScroll: true,
            onSuccess: () => setIsRemoveEmployeeModalOpen(false),
        });
    };

    // 7. Transfer / Change Pattern Form
    const transferForm = useForm({
        employee_id: '',
        target_roster_id: '',
        transfer_date: active_roster?.start_date || '',
        pattern_id: '',
    });

    const openTransferModal = (empId?: string) => {
        if (!active_roster) return;
        const targetEmp = matrix.find((m) => m.employee.id === empId);
        transferForm.setData({
            employee_id: empId || matrix[0]?.employee.id || '',
            target_roster_id: active_roster.id,
            transfer_date: active_roster.start_date,
            pattern_id: targetEmp?.employee.pattern?.id || patterns[0]?.id || '',
        });
        setIsTransferModalOpen(true);
    };

    const handleTransferSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!active_roster) return;
        transferForm.post(`/roster/rosters/${active_roster.id}/transfer`, {
            preserveScroll: true,
            onSuccess: () => setIsTransferModalOpen(false),
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
                            <div className="text-[10px] text-slate-400 font-mono truncate flex items-center gap-1.5 mt-0.5">
                                <span>{row.employee.emp_no} &bull; {row.employee.department?.name || 'General'}</span>
                                {row.employee.pattern && (
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            openTransferModal(row.employee.id);
                                        }}
                                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-500/25 transition cursor-pointer"
                                        title={`Pattern: ${row.employee.pattern.name}. Click to change.`}
                                    >
                                        <Sparkles className="w-2.5 h-2.5" />
                                        <span>{row.employee.pattern.code || row.employee.pattern.name}</span>
                                    </button>
                                )}
                            </div>
                        </div>
                        {active_roster && (
                            <div className="opacity-0 group-hover/empcell:opacity-100 flex items-center gap-1 transition shrink-0 no-print">
                                <button
                                    type="button"
                                    onClick={() => openTransferModal(row.employee.id)}
                                    className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                                    title="Transfer employee or change pattern effective date"
                                >
                                    <ArrowLeftRight className="w-3 h-3 text-sky-400" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => openQuickPatternModal(row.employee.id)}
                                    className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                                    title="Apply shift pattern to date range for this employee"
                                >
                                    <Sparkles className="w-3 h-3 text-amber-300" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => openRemoveEmployeeModal(row.employee.id)}
                                    className="p-1 rounded bg-slate-800 hover:bg-rose-900/60 text-slate-300 hover:text-rose-300 transition"
                                    title="Remove employee from roster"
                                >
                                    <Trash2 className="w-3 h-3 text-rose-400" />
                                </button>
                            </div>
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

                    if (cell.is_pre_hire) {
                        return (
                            <td
                                key={d.date}
                                className="border-r border-slate-800/60 p-0.5 text-center relative bg-slate-950/80 cursor-not-allowed select-none"
                                title={cell.notes || 'Mid-Joiner: Not yet employed'}
                            >
                                <span className="text-[9px] font-mono text-slate-600 italic">Not Join</span>
                            </td>
                        );
                    }

                    // Scheduled in another active roster (e.g. transferred to Gen Roster / 12H Roster)
                    if (cell.other_roster) {
                        return (
                            <td
                                key={d.date}
                                onClick={() => {
                                    if (cell.other_roster?.id) {
                                        handleRosterChange(cell.other_roster.id);
                                    }
                                }}
                                className="border-r border-slate-800/50 p-0.5 text-center relative bg-slate-950/40 select-none group/othercell transition hover:bg-slate-800/40 cursor-pointer"
                                title={`Scheduled in: ${cell.other_roster.name} (${cell.other_roster.code})\nShift: ${cell.shift ? `${cell.shift.name} (${cell.shift.code})` : 'Rest Day (OFF)'}\nClick to view ${cell.other_roster.name}`}
                            >
                                <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[8px] font-mono font-medium text-slate-500 bg-slate-900/70 border border-slate-800 group-hover/othercell:border-sky-500/40 group-hover/othercell:text-sky-300 transition truncate max-w-full">
                                    <span className="text-slate-600 font-sans">➔</span>
                                    <span className="truncate">{cell.other_roster.code || cell.other_roster.name}</span>
                                </span>
                            </td>
                        );
                    }

                    // Not allocated to this roster on this date and no shift scheduled
                    if (cell.is_allocated_here === false && !cell.shift && !cell.schedule_type) {
                        return (
                            <td
                                key={d.date}
                                onClick={() => openCellDrawer(row.employee.id, row.employee.full_name, d.date, cell)}
                                className="border-r border-slate-800/60 text-center p-0.5 bg-slate-950/20 hover:bg-indigo-600/20 cursor-pointer"
                                title="Not allocated to this roster on this date • Click to add single shift"
                            >
                                <span className="text-[10px] text-slate-700">-</span>
                            </td>
                        );
                    }

                    const isRest = cell.schedule_type === 'rest_day' || cell.schedule_type === 'off';
                    const hasLeave = cell.leave !== null;
                    const isOverridden = cell.is_overridden;
                    const patternStyle = cell.pattern ? getPatternStyle(cell.pattern.id, patterns) : null;
                    const isPatternDimmed = selectedPatternId !== null && cell.pattern?.id !== selectedPatternId;

                    return (
                        <td
                            key={d.date}
                            onClick={() => openCellDrawer(row.employee.id, row.employee.full_name, d.date, cell)}
                            style={{
                                backgroundColor: isPatternDimmed
                                    ? undefined
                                    : patternStyle
                                    ? patternStyle.lightBg
                                    : undefined,
                            }}
                            title={`${d.date} • ${cell.shift ? `${cell.shift.name} (${cell.shift.start_time} - ${cell.shift.end_time})` : 'Rest Day (OFF)'}${
                                cell.pattern ? `\nPattern: ${cell.pattern.name} (${cell.pattern.code})` : ''
                            }${
                                isOverridden
                                    ? `\nOperational Override:\nOriginal: ${cell.original_shift?.name || 'Base Pattern'}\nReason: ${cell.override_reason || 'Manual override'}\nBy: ${cell.overridden_by || 'Supervisor'}`
                                    : ''
                            }`}
                            className={`border-r border-slate-800/60 p-0.5 text-center relative cursor-pointer transition select-none hover:ring-1 hover:ring-indigo-400 ${
                                isPatternDimmed ? 'opacity-30 blur-[0.2px]' : ''
                            } ${
                                isRest
                                    ? 'bg-slate-950/40 text-slate-500'
                                    : cell.shift
                                    ? 'text-white'
                                    : 'text-slate-600'
                            }`}
                        >
                            {/* Pattern Top Color Edge Line Indicator */}
                            {showPatternLines && patternStyle && (
                                <span
                                    className="absolute top-0 left-0 right-0 h-[3.5px] z-10"
                                    style={{ backgroundColor: patternStyle.hex }}
                                    title={`Shift Pattern: ${cell.pattern?.name} (${cell.pattern?.code})`}
                                />
                            )}

                            {/* Operational Override Amber Indicator Dot */}
                            {isOverridden && (
                                <span
                                    className="absolute top-1 right-0.5 w-1.5 h-1.5 rounded-full bg-amber-400 ring-2 ring-slate-900 z-20"
                                    title={`Operational Override:\nOriginal: ${cell.original_shift?.name || 'Base Pattern'}\nReason: ${cell.override_reason || 'Manual override'}\nBy: ${cell.overridden_by || 'Supervisor'}`}
                                />
                            )}

                            {/* Fatigue Warning Indicator */}
                            {cell.fatigue_warning && (
                                <span
                                    className="absolute bottom-0.5 left-0.5 w-1.5 h-1.5 rounded-full bg-rose-500 z-20"
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
                <td 
                    className="px-2 py-2 text-center font-bold text-slate-300 font-mono text-xs"
                    title={active_roster && row.stats.roster_hours !== undefined && row.stats.roster_hours !== row.stats.total_hours
                        ? `Month Combined: ${row.stats.total_hours}h across rosters (${row.stats.roster_hours}h in ${active_roster.name})`
                        : `Month Total: ${row.stats.total_hours}h`}
                >
                    <div>{row.stats.total_hours}h</div>
                    {active_roster && row.stats.roster_hours !== undefined && row.stats.roster_hours !== row.stats.total_hours && (
                        <div className="text-[9px] font-normal text-slate-400 font-mono tracking-tight mt-0.5">
                            ({row.stats.roster_hours}h in roster)
                        </div>
                    )}
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
                                        <option value="">-- Select a Roster --</option>
                                        {rosters.map((rst) => (
                                            <option key={rst.id} value={rst.id}>
                                                {rst.name} ({rst.code}) • {rst.start_date} → {rst.end_date} [{rst.status.toUpperCase()}]
                                            </option>
                                        ))}
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
                                            onClick={openAddEmployeeModal}
                                            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition"
                                            title="Add allocated employees to active roster"
                                        >
                                            <Plus className="w-3.5 h-3.5" />
                                            <span>Add Employees</span>
                                        </button>

                                        <button
                                            onClick={() => openRemoveEmployeeModal()}
                                            className="px-3 py-1.5 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 text-xs font-semibold border border-rose-800/60 hover:border-rose-700 transition flex items-center gap-1.5 shadow-sm"
                                            title="Remove an employee from active roster"
                                        >
                                            <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                                            <span>Remove Employee</span>
                                        </button>

                                        <button
                                            onClick={() => openTransferModal()}
                                            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 hover:border-slate-600 transition flex items-center gap-1.5 shadow-sm"
                                            title="Transfer employee starting on effective date"
                                        >
                                            <ArrowLeftRight className="w-3.5 h-3.5 text-sky-400" />
                                            <span>Transfer</span>
                                        </button>

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
                                        onClick={() => openQuickPatternModal()}
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

                {/* 2.5 Pattern Legend & Highlight Toolbar */}
                {activePatternsSummary.length > 0 && (
                    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shadow-md no-print">
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                            <span className="font-bold text-slate-300 flex items-center gap-1.5 mr-1">
                                <Layers className="w-3.5 h-3.5 text-indigo-400" />
                                <span>Applied Patterns Legend:</span>
                            </span>

                            <button
                                type="button"
                                onClick={() => setSelectedPatternId(null)}
                                className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                                    selectedPatternId === null
                                        ? 'bg-indigo-600 text-white shadow-sm'
                                        : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-white'
                                }`}
                            >
                                All Patterns ({activePatternsSummary.reduce((acc, p) => acc + p.count, 0)})
                            </button>

                            {activePatternsSummary.map((p) => {
                                const style = getPatternStyle(p.id, patterns);
                                const isSelected = selectedPatternId === p.id;
                                return (
                                    <button
                                        key={p.id}
                                        type="button"
                                        onClick={() => setSelectedPatternId(isSelected ? null : p.id)}
                                        className={`px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1.5 transition border ${
                                            isSelected
                                                ? 'bg-slate-800 text-white ring-1 ring-white/20 shadow-sm'
                                                : 'bg-slate-950 text-slate-300 border-slate-800 hover:bg-slate-800/80'
                                        }`}
                                        style={{
                                            borderColor: isSelected ? style?.hex : undefined,
                                        }}
                                        title={`Click to filter/highlight matrix cells assigned to ${p.name}`}
                                    >
                                        <span
                                            className="w-2.5 h-2.5 rounded-full inline-block shrink-0"
                                            style={{ backgroundColor: style?.hex }}
                                        />
                                        <span>{p.name}</span>
                                        <span className="text-[10px] font-mono text-slate-400">
                                            ({p.code}) &bull; {p.count}d
                                        </span>
                                    </button>
                                );
                            })}
                        </div>

                        <div className="flex items-center gap-2 text-xs">
                            <button
                                type="button"
                                onClick={() => setShowPatternLines(!showPatternLines)}
                                className={`px-2.5 py-1 rounded-lg font-semibold transition border flex items-center gap-1.5 ${
                                    showPatternLines
                                        ? 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30'
                                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                                }`}
                                title="Toggle pattern top edge color indicators on date cells"
                            >
                                <span className={`w-2 h-2 rounded-full ${showPatternLines ? 'bg-indigo-400' : 'bg-slate-600'}`} />
                                <span>{showPatternLines ? 'Pattern Top Lines On' : 'Pattern Lines Off'}</span>
                            </button>
                        </div>
                    </div>
                )}

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
                            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 font-mono mt-0.5">
                                <span>Date: {selectedCell.date}</span>
                                {selectedCell.cell.pattern && (
                                    <>
                                        <span>&bull;</span>
                                        <span className="text-indigo-300 font-sans font-medium flex items-center gap-1">
                                            <Layers className="w-3 h-3 text-indigo-400 inline" />
                                            {selectedCell.cell.pattern.name} ({selectedCell.cell.pattern.code})
                                        </span>
                                    </>
                                )}
                            </div>
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

            {/* MODAL 2: 3-Stage Roster Creation Wizard */}
            {isNewRosterModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full p-6 space-y-5 shadow-2xl relative max-h-[90vh] flex flex-col">
                        <button
                            onClick={() => setIsNewRosterModalOpen(false)}
                            className="absolute top-4 right-4 text-slate-400 hover:text-white transition p-1 rounded-lg hover:bg-slate-800"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        {/* Wizard Header */}
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                                    Enterprise Scheduling Wizard
                                </span>
                                <span className="text-slate-500 text-xs">•</span>
                                <span className="text-xs text-slate-400 font-medium">Stage {rosterWizardStep} of {newRosterForm.data.generation_mode === 'blank' ? 2 : 3}</span>
                            </div>
                            <h3 className="text-lg font-bold text-white">
                                Create New Duty Roster
                            </h3>
                            <p className="text-xs text-slate-400">
                                Define operational timeline, choose shift rotation pattern or blank canvas, and allocate personnel.
                            </p>
                        </div>

                        {/* Step Navigation Pill Indicator */}
                        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-950 border border-slate-800/80">
                            <button
                                type="button"
                                onClick={() => setRosterWizardStep(1)}
                                className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition ${
                                    rosterWizardStep === 1
                                        ? 'bg-indigo-600 text-white shadow-md'
                                        : 'text-slate-400 hover:text-white'
                                }`}
                            >
                                <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                                    rosterWizardStep === 1 ? 'bg-white text-indigo-600' : 'bg-slate-800 text-slate-400'
                                }`}>1</span>
                                <span>Identity &amp; Horizon</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => {
                                    if (newRosterForm.data.name && newRosterForm.data.start_date && newRosterForm.data.end_date) {
                                        setRosterWizardStep(2);
                                    }
                                }}
                                className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition ${
                                    rosterWizardStep === 2
                                        ? 'bg-indigo-600 text-white shadow-md'
                                        : 'text-slate-400 hover:text-white'
                                }`}
                            >
                                <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                                    rosterWizardStep === 2 ? 'bg-white text-indigo-600' : 'bg-slate-800 text-slate-400'
                                }`}>2</span>
                                <span>Shift Strategy</span>
                            </button>

                            {newRosterForm.data.generation_mode !== 'blank' && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (newRosterForm.data.name && newRosterForm.data.start_date && newRosterForm.data.end_date) {
                                            setRosterWizardStep(3);
                                        }
                                    }}
                                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition ${
                                        rosterWizardStep === 3
                                            ? 'bg-indigo-600 text-white shadow-md'
                                            : 'text-slate-400 hover:text-white'
                                    }`}
                                >
                                    <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                                        rosterWizardStep === 3 ? 'bg-white text-indigo-600' : 'bg-slate-800 text-slate-400'
                                    }`}>3</span>
                                    <span>Staff Allocation ({totalWizardAllocatedStaff})</span>
                                </button>
                            )}
                        </div>

                        {/* Form Body - Scrollable content */}
                        <form onSubmit={handleNewRosterSubmit} className="space-y-4 overflow-y-auto flex-1 pr-1 text-xs">
                            {/* STAGE 1: Roster Identity & Horizon */}
                            {rosterWizardStep === 1 && (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                                        <div className="md:col-span-7">
                                            <label className="block font-semibold text-slate-300 mb-1">
                                                Roster Name *
                                            </label>
                                            <input
                                                type="text"
                                                required
                                                value={newRosterForm.data.name}
                                                onChange={(e) => newRosterForm.setData('name', e.target.value)}
                                                placeholder="e.g. November 2026 - Operations Roster"
                                                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-medium focus:ring-1 focus:ring-indigo-500"
                                            />
                                        </div>
                                        <div className="md:col-span-5">
                                            <label className="block font-semibold text-slate-300 mb-1">
                                                Roster Code
                                            </label>
                                            <input
                                                type="text"
                                                value={newRosterForm.data.code}
                                                onChange={(e) => newRosterForm.setData('code', e.target.value)}
                                                placeholder="e.g. RST-NOV-OPS"
                                                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono uppercase focus:ring-1 focus:ring-indigo-500"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                        <div>
                                            <label className="block font-semibold text-slate-300 mb-1">
                                                Department Scope
                                            </label>
                                            <select
                                                value={newRosterForm.data.department_id}
                                                onChange={(e) => {
                                                    const deptId = e.target.value;
                                                    newRosterForm.setData('department_id', deptId);
                                                    if (deptId) {
                                                        setWizardDeptFilter(deptId);
                                                    }
                                                }}
                                                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:ring-1 focus:ring-indigo-500 cursor-pointer"
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
                                            <label className="block font-semibold text-slate-300 mb-1">
                                                Start Date *
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
                                            <label className="block font-semibold text-slate-300 mb-1">
                                                End Date *
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
                                        <label className="block font-semibold text-slate-300 mb-1">
                                            Initial Lifecycle Status
                                        </label>
                                        <div className="grid grid-cols-2 gap-2">
                                            <button
                                                type="button"
                                                onClick={() => newRosterForm.setData('status', 'draft')}
                                                className={`py-2 px-3 rounded-xl border text-center font-semibold transition ${
                                                    newRosterForm.data.status === 'draft'
                                                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm'
                                                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                                                }`}
                                            >
                                                Draft Mode (Editable Planning)
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => newRosterForm.setData('status', 'published')}
                                                className={`py-2 px-3 rounded-xl border text-center font-semibold transition ${
                                                    newRosterForm.data.status === 'published'
                                                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm'
                                                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                                                }`}
                                            >
                                                Official Published (Live Roster)
                                            </button>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block font-semibold text-slate-300 mb-1">
                                            Operational Notes &amp; Guidelines
                                        </label>
                                        <textarea
                                            rows={2}
                                            value={newRosterForm.data.notes}
                                            onChange={(e) => newRosterForm.setData('notes', e.target.value)}
                                            placeholder="Staffing targets, seasonal remarks, coverage instructions..."
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:ring-1 focus:ring-indigo-500 placeholder-slate-600 resize-none"
                                        />
                                    </div>

                                    <div className="pt-3 flex items-center justify-between border-t border-slate-800">
                                        <button
                                            type="button"
                                            onClick={() => setIsNewRosterModalOpen(false)}
                                            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold transition"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (!newRosterForm.data.name || !newRosterForm.data.start_date || !newRosterForm.data.end_date) {
                                                    alert('Please fill in required fields: Roster Name, Start Date, and End Date.');
                                                    return;
                                                }
                                                setRosterWizardStep(2);
                                            }}
                                            className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-md transition flex items-center gap-1.5"
                                        >
                                            <span>Next: Shift Strategy</span>
                                            <ChevronRight className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* STAGE 2: Scheduling Strategy & Shift Pattern */}
                            {rosterWizardStep === 2 && (
                                <div className="space-y-4">
                                    <div>
                                        <label className="block font-semibold text-slate-300 mb-2">
                                            Choose Scheduling Strategy
                                        </label>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            {/* Option 1: Automated Pattern Rotation */}
                                            <div
                                                onClick={() => newRosterForm.setData('generation_mode', 'pattern')}
                                                className={`p-4 rounded-xl border cursor-pointer transition flex flex-col justify-between ${
                                                    newRosterForm.data.generation_mode === 'pattern'
                                                        ? 'bg-indigo-600/15 border-indigo-500 ring-1 ring-indigo-500 shadow-md'
                                                        : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                                                }`}
                                            >
                                                <div>
                                                    <div className="flex items-center justify-between mb-2">
                                                        <div className="flex items-center gap-2">
                                                            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
                                                                <Sparkles className="w-4 h-4" />
                                                            </div>
                                                            <div>
                                                                <span className="font-bold text-white block">Shift Rotation Pattern</span>
                                                                <span className="text-[10px] text-slate-400">Multi-pattern cycle or single shift</span>
                                                            </div>
                                                        </div>
                                                        <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 uppercase">
                                                            Recommended
                                                        </span>
                                                    </div>
                                                    <p className="text-[11px] text-slate-400 leading-relaxed">
                                                        Select 1 or more complementary shift patterns. Supports 12H (3-pattern) and 8H (4-pattern) continuous 24/7 crew rotations.
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Option 2: Blank Canvas Shell */}
                                            <div
                                                onClick={() => newRosterForm.setData('generation_mode', 'blank')}
                                                className={`p-4 rounded-xl border cursor-pointer transition flex flex-col justify-between ${
                                                    newRosterForm.data.generation_mode === 'blank'
                                                        ? 'bg-indigo-600/15 border-indigo-500 ring-1 ring-indigo-500 shadow-md'
                                                        : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                                                }`}
                                            >
                                                <div>
                                                    <div className="flex items-center justify-between mb-2">
                                                        <div className="flex items-center gap-2">
                                                            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
                                                                <CalendarDays className="w-4 h-4" />
                                                            </div>
                                                            <div>
                                                                <span className="font-bold text-white block">Blank Roster Shell</span>
                                                                <span className="text-[10px] text-slate-400">Manual / ad-hoc scheduling</span>
                                                            </div>
                                                        </div>
                                                        <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 uppercase">
                                                            Manual
                                                        </span>
                                                    </div>
                                                    <p className="text-[11px] text-slate-400 leading-relaxed">
                                                        Initialize an empty roster container. You can add employees and assign individual shifts directly from the interactive matrix.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Pattern Configuration & Visual Preview */}
                                    {newRosterForm.data.generation_mode === 'pattern' ? (
                                        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-4">
                                            {/* Top selector bar */}
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-slate-800/80">
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <label className="font-bold text-white text-xs block">
                                                            Shift Rotation Patterns for this Roster
                                                        </label>
                                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                                            {newRosterForm.data.selected_pattern_ids.length} Selected
                                                        </span>
                                                    </div>
                                                    <p className="text-[11px] text-slate-400 mt-0.5">
                                                        Add all shift patterns required for your rotation (e.g. 3 patterns for 12H, 4 for 8H).
                                                    </p>
                                                </div>

                                                {/* Add Pattern control */}
                                                <div className="flex items-center gap-2">
                                                    <select
                                                        value={selectedPatternToAdd}
                                                        onChange={(e) => setSelectedPatternToAdd(e.target.value)}
                                                        className="bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white focus:ring-1 focus:ring-indigo-500 cursor-pointer max-w-[220px]"
                                                    >
                                                        <option value="">Select pattern to add...</option>
                                                        {patterns
                                                            .filter((p) => !newRosterForm.data.selected_pattern_ids.includes(p.id))
                                                            .map((p) => (
                                                                <option key={p.id} value={p.id}>
                                                                    {p.name} ({p.code}) • {p.cycle_length_days}d
                                                                </option>
                                                            ))}
                                                    </select>
                                                    <button
                                                        type="button"
                                                        disabled={!selectedPatternToAdd}
                                                        onClick={() => handleAddPatternToWizard(selectedPatternToAdd)}
                                                        className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition disabled:opacity-40 flex items-center gap-1 shrink-0 text-xs shadow-sm"
                                                    >
                                                        <Plus className="w-3.5 h-3.5" />
                                                        <span>Add Pattern</span>
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Informational Callout */}
                                            <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl flex items-start gap-2.5">
                                                <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                                                <div className="text-[11px] text-slate-300 leading-relaxed">
                                                    <span className="font-semibold text-white">Continuous Operation Guidelines: </span>
                                                    For continuous 24/7 staffing: a 12-hour rotation typically uses <span className="text-indigo-300 font-semibold">3 patterns</span> (Crews A, B, C); an 8-hour continuous rotation uses <span className="text-indigo-300 font-semibold">4 patterns</span> (Crews A, B, C, D). Single pattern is appropriate for fixed day-shifts.
                                                </div>
                                            </div>

                                            {/* Pattern Cards List */}
                                            <div className="space-y-3">
                                                {selectedWizardPatterns.map((pat, pIdx) => {
                                                    const steps = pat.pattern_data?.steps || pat.pattern_data || [];
                                                    const patShiftIds = Array.from(new Set(steps.map((s: any) => s.shift_id).filter(Boolean)));
                                                    const patShifts = patShiftIds.map((id) => shifts.find((s) => s.id === id)).filter(Boolean) as Shift[];

                                                    return (
                                                        <div
                                                            key={pat.id}
                                                            className="bg-slate-900/90 rounded-xl p-3.5 border border-slate-800 space-y-3 relative group"
                                                        >
                                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center justify-center font-bold text-[10px]">
                                                                        {pIdx + 1}
                                                                    </span>
                                                                    <div>
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="font-bold text-white text-xs">{pat.name}</span>
                                                                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 uppercase">
                                                                                {pat.code || pat.pattern_type}
                                                                            </span>
                                                                        </div>
                                                                        <span className="text-[10px] text-slate-400">
                                                                            Cycle Length: {steps.length || pat.cycle_length_days} Days ({pat.pattern_type})
                                                                        </span>
                                                                    </div>
                                                                </div>

                                                                <div className="flex items-center gap-2">
                                                                    {patShifts.length > 0 && (
                                                                        <div className="flex flex-wrap items-center gap-1.5">
                                                                            {patShifts.map((sh) => (
                                                                                <span
                                                                                    key={sh.id}
                                                                                    className="px-2 py-0.5 rounded text-[10px] font-mono border flex items-center gap-1 bg-slate-950 text-slate-300 border-slate-800"
                                                                                >
                                                                                    <span
                                                                                        className="w-1.5 h-1.5 rounded-full"
                                                                                        style={{ backgroundColor: sh.color || '#3b82f6' }}
                                                                                    />
                                                                                    <span>{sh.name}</span>
                                                                                    <span className="text-slate-400">({sh.start_time?.slice(0, 5)} - {sh.end_time?.slice(0, 5)})</span>
                                                                                </span>
                                                                            ))}
                                                                        </div>
                                                                    )}

                                                                    {newRosterForm.data.selected_pattern_ids.length > 1 && (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleRemovePatternFromWizard(pat.id)}
                                                                            className="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition"
                                                                            title="Remove this pattern"
                                                                        >
                                                                            <Trash2 className="w-3.5 h-3.5" />
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            {/* Day by Day Chip Track */}
                                                            {steps.length > 0 && (
                                                                <div className="space-y-1">
                                                                    <div className="flex flex-wrap items-center gap-1.5">
                                                                        {steps.map((st: any, sIdx: number) => {
                                                                            const shift = shifts.find((s) => s.id === st.shift_id);
                                                                            const isRest = Boolean(st.is_rest_day);
                                                                            return (
                                                                                <div
                                                                                    key={sIdx}
                                                                                    className={`px-2 py-1 rounded-lg border text-center font-mono ${
                                                                                        isRest
                                                                                            ? 'bg-slate-950/80 text-slate-500 border-slate-800'
                                                                                            : 'bg-indigo-600/15 text-indigo-200 border-indigo-500/30'
                                                                                    }`}
                                                                                    style={shift?.color && !isRest ? { borderColor: `${shift.color}55`, color: shift.color } : {}}
                                                                                    title={`Day ${sIdx + 1}: ${isRest ? 'Rest Day' : shift?.name || 'Shift'}`}
                                                                                >
                                                                                    <div className="text-[9px] text-slate-400 font-sans">D{sIdx + 1}</div>
                                                                                    <div className="font-bold text-[10px]">{isRest ? 'OFF' : shift?.code || 'SH'}</div>
                                                                                </div>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-slate-400 text-xs flex items-start gap-3">
                                            <Info className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                                            <div>
                                                <span className="font-bold text-slate-200 block mb-0.5">Blank Canvas Mode Selected</span>
                                                An empty roster shell will be created. You can allocate employees and manually set duty shifts directly from the duty roster matrix.
                                            </div>
                                        </div>
                                    )}

                                    <div className="pt-3 flex items-center justify-between border-t border-slate-800">
                                        <button
                                            type="button"
                                            onClick={() => setRosterWizardStep(1)}
                                            className="px-4 py-2 rounded-xl text-slate-400 hover:text-white flex items-center gap-1 transition font-semibold"
                                        >
                                            <ChevronLeft className="w-3.5 h-3.5" />
                                            <span>Back</span>
                                        </button>

                                        {newRosterForm.data.generation_mode === 'blank' ? (
                                            <button
                                                type="submit"
                                                disabled={newRosterForm.processing}
                                                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-md transition disabled:opacity-50"
                                            >
                                                {newRosterForm.processing ? 'Creating Shell...' : 'Create Blank Roster Shell'}
                                            </button>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (newRosterForm.data.selected_pattern_ids.length === 0) {
                                                        alert('Please select at least one shift pattern.');
                                                        return;
                                                    }
                                                    if (!activeWizardPatternTab) {
                                                        setActiveWizardPatternTab(newRosterForm.data.selected_pattern_ids[0]);
                                                    }
                                                    setRosterWizardStep(3);
                                                }}
                                                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-md transition flex items-center gap-1.5"
                                            >
                                                <span>Next: Allocate Personnel</span>
                                                <ChevronRight className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* STAGE 3: Crew & Personnel Allocation (Manual + Auto Distribution) */}
                            {rosterWizardStep === 3 && (
                                <div className="space-y-3.5">
                                    {/* Top Crew Allocation Header */}
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-950 p-3 rounded-xl border border-slate-800">
                                        <div>
                                            <span className="font-bold text-white text-xs block">
                                                Crew &amp; Personnel Allocation
                                            </span>
                                            <p className="text-[11px] text-slate-400">
                                                Assign staff to each shift pattern. Use manual assignment by clicking staff, or click Auto-Distribute to balance crews evenly.
                                            </p>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <span className="px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-mono font-bold text-xs">
                                                {totalWizardAllocatedStaff} Total Allocated
                                            </span>
                                            <button
                                                type="button"
                                                onClick={handleAutoDistributeEvenly}
                                                className="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition text-xs flex items-center gap-1.5 shadow-sm"
                                                title="Distribute matching staff evenly across all active patterns in round-robin sequence"
                                            >
                                                <RefreshCw className="w-3.5 h-3.5" />
                                                <span>Auto-Distribute Crews</span>
                                            </button>
                                        </div>
                                    </div>

                                    {/* Pattern Switcher Tabs */}
                                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-800/80">
                                        {selectedWizardPatterns.map((pat) => {
                                            const count = (newRosterForm.data.pattern_allocations[pat.id] || []).length;
                                            const isActive = activeWizardPatternTab === pat.id;

                                            return (
                                                <button
                                                    key={pat.id}
                                                    type="button"
                                                    onClick={() => setActiveWizardPatternTab(pat.id)}
                                                    className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition shrink-0 border ${
                                                        isActive
                                                            ? 'bg-indigo-600 text-white border-indigo-500 shadow-md'
                                                            : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white hover:border-slate-700'
                                                    }`}
                                                >
                                                    <span>{pat.name}</span>
                                                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                                                        isActive
                                                            ? 'bg-white text-indigo-600'
                                                            : 'bg-slate-800 text-slate-300'
                                                    }`}>
                                                        {count} Staff
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>

                                    {/* Crew Control & Filter Toolbar */}
                                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
                                        <div className="flex flex-1 items-center gap-2">
                                            <div className="relative flex-1">
                                                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                                                <input
                                                    type="text"
                                                    value={wizardEmpSearch}
                                                    onChange={(e) => setWizardEmpSearch(e.target.value)}
                                                    placeholder="Search staff by name or employee number..."
                                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:ring-1 focus:ring-indigo-500"
                                                />
                                            </div>
                                            <select
                                                value={wizardDeptFilter}
                                                onChange={(e) => setWizardDeptFilter(e.target.value)}
                                                className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-300 focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                                            >
                                                <option value="all">All Departments</option>
                                                {departments.map((d) => (
                                                    <option key={d.id} value={d.id}>
                                                        {d.name}
                                                    </option>
                                                ))}
                                            </select>
                                            <select
                                                value={wizardAllocFilter}
                                                onChange={(e) => setWizardAllocFilter(e.target.value as any)}
                                                className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-300 focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                                            >
                                                <option value="all">All Staff</option>
                                                <option value="unallocated">Unallocated Only</option>
                                            </select>
                                        </div>

                                        {/* Crew Quick Actions */}
                                        <div className="flex items-center gap-1.5">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const curPatId = activeWizardPatternTab || newRosterForm.data.selected_pattern_ids[0];
                                                    if (!curPatId) return;
                                                    const filtered = employeePool.filter((emp) => {
                                                        const matchesSearch =
                                                            !wizardEmpSearch ||
                                                            emp.full_name.toLowerCase().includes(wizardEmpSearch.toLowerCase()) ||
                                                            emp.emp_no.toLowerCase().includes(wizardEmpSearch.toLowerCase());
                                                        const matchesDept = wizardDeptFilter === 'all' || emp.department_id === wizardDeptFilter;
                                                        return matchesSearch && matchesDept;
                                                    });
                                                    const filteredIds = filtered.map((e) => e.id);
                                                    const nextAllocations = { ...newRosterForm.data.pattern_allocations };
                                                    // Remove from other patterns
                                                    Object.keys(nextAllocations).forEach((pId) => {
                                                        if (pId !== curPatId) {
                                                            nextAllocations[pId] = (nextAllocations[pId] || []).filter((id) => !filteredIds.includes(id));
                                                        }
                                                    });
                                                    // Add to current pattern
                                                    nextAllocations[curPatId] = Array.from(new Set([...(nextAllocations[curPatId] || []), ...filteredIds]));
                                                    newRosterForm.setData('pattern_allocations', nextAllocations);
                                                }}
                                                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-indigo-300 font-semibold transition text-xs"
                                                title="Assign all matching filtered staff to this crew"
                                            >
                                                Select All to this Crew
                                            </button>
                                            {((newRosterForm.data.pattern_allocations[activeWizardPatternTab || newRosterForm.data.selected_pattern_ids[0]] || []).length > 0) && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const curPatId = activeWizardPatternTab || newRosterForm.data.selected_pattern_ids[0];
                                                        if (!curPatId) return;
                                                        newRosterForm.setData('pattern_allocations', {
                                                            ...newRosterForm.data.pattern_allocations,
                                                            [curPatId]: [],
                                                        });
                                                    }}
                                                    className="px-2.5 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 font-semibold transition text-xs"
                                                >
                                                    Clear Crew
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Employee List */}
                                    <div className="bg-slate-950 rounded-xl border border-slate-800 max-h-64 overflow-y-auto divide-y divide-slate-900 p-1">
                                        {employeePool
                                            .filter((emp) => {
                                                const matchesSearch =
                                                    !wizardEmpSearch ||
                                                    emp.full_name.toLowerCase().includes(wizardEmpSearch.toLowerCase()) ||
                                                    emp.emp_no.toLowerCase().includes(wizardEmpSearch.toLowerCase());
                                                const matchesDept = wizardDeptFilter === 'all' || emp.department_id === wizardDeptFilter;

                                                const currentPatternAlloc = Object.entries(newRosterForm.data.pattern_allocations || {}).find(([_, ids]) =>
                                                    ids.includes(emp.id)
                                                );
                                                const isUnallocated = !currentPatternAlloc;

                                                if (wizardAllocFilter === 'unallocated' && !isUnallocated) {
                                                    return false;
                                                }

                                                return matchesSearch && matchesDept;
                                            })
                                            .map((emp) => {
                                                const curPatId = activeWizardPatternTab || newRosterForm.data.selected_pattern_ids[0];
                                                const isSelectedInCurrent = (newRosterForm.data.pattern_allocations[curPatId] || []).includes(emp.id);

                                                // Check if in another pattern
                                                const otherAlloc = Object.entries(newRosterForm.data.pattern_allocations || {}).find(
                                                    ([pId, ids]) => pId !== curPatId && ids.includes(emp.id)
                                                );
                                                const otherPattern = otherAlloc ? patterns.find((p) => p.id === otherAlloc[0]) : null;

                                                const availInfo = available_employees.find((a) => a.id === emp.id);
                                                const hasConflict = availInfo && !availInfo.is_available;

                                                return (
                                                    <div
                                                        key={emp.id}
                                                        onClick={() => handleToggleEmployeeInPattern(emp.id, curPatId)}
                                                        className={`p-2.5 rounded-lg flex items-center justify-between cursor-pointer transition ${
                                                            isSelectedInCurrent
                                                                ? 'bg-indigo-600/15 border border-indigo-500/30'
                                                                : 'hover:bg-slate-900/60'
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-2.5">
                                                            <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                                                                isSelectedInCurrent
                                                                    ? 'bg-indigo-600 border-indigo-500 text-white'
                                                                    : 'border-slate-700 bg-slate-900'
                                                            }`}>
                                                                {isSelectedInCurrent && <Check className="w-3 h-3" />}
                                                            </div>
                                                            <div>
                                                                <span className="font-bold text-white block">
                                                                    {emp.full_name}
                                                                </span>
                                                                <span className="text-[10px] text-slate-400 font-mono">
                                                                    {emp.emp_no} &bull; {emp.department_name} &bull; {emp.designation_title}
                                                                </span>
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center gap-1.5">
                                                            {isSelectedInCurrent && (
                                                                <span className="text-[10px] text-emerald-400 font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                                                                    Assigned to this Crew
                                                                </span>
                                                            )}

                                                            {!isSelectedInCurrent && otherPattern && (
                                                                <span className="text-[10px] text-indigo-300 font-mono px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20" title="Click to move to current crew">
                                                                    In: {otherPattern.code || otherPattern.name} &rarr; Move
                                                                </span>
                                                            )}

                                                            {!isSelectedInCurrent && !otherPattern && (
                                                                <span className="text-[10px] text-slate-500 font-mono px-2 py-0.5">
                                                                    Available
                                                                </span>
                                                            )}

                                                            {hasConflict && (
                                                                <span className="text-[10px] text-amber-400 font-mono px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
                                                                    {availInfo?.exclusion_reason || 'Roster Overlap'}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                    </div>

                                    {/* Navigation & Submit footer */}
                                    <div className="pt-3 flex items-center justify-between border-t border-slate-800">
                                        <button
                                            type="button"
                                            onClick={() => setRosterWizardStep(2)}
                                            className="px-4 py-2 rounded-xl text-slate-400 hover:text-white flex items-center gap-1 transition font-semibold"
                                        >
                                            <ChevronLeft className="w-3.5 h-3.5" />
                                            <span>Back</span>
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={newRosterForm.processing || totalWizardAllocatedStaff === 0}
                                            className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-md transition disabled:opacity-40 flex items-center gap-2"
                                        >
                                            {newRosterForm.processing ? (
                                                <span>Generating Roster...</span>
                                            ) : (
                                                <span>Create &amp; Generate Roster ({totalWizardAllocatedStaff} Staff across {newRosterForm.data.selected_pattern_ids.length} Crews)</span>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            )}
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

            {/* MODAL 5: Add Employee Allocation Modal */}
            {isAddEmployeeModalOpen && active_roster && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl relative">
                        <button
                            onClick={() => setIsAddEmployeeModalOpen(false)}
                            className="absolute top-4 right-4 text-slate-400 hover:text-white"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <div>
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                Roster Membership
                            </span>
                            <h3 className="text-lg font-bold text-white mt-1">
                                Add Personnel to Roster
                            </h3>
                            <p className="text-xs text-slate-400 mt-0.5">
                                Select unallocated staff to assign to {active_roster.name}.
                            </p>
                        </div>

                        <form onSubmit={handleAddEmployeeSubmit} className="space-y-4 text-xs">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-slate-400 font-medium mb-1">
                                        Effective From Date
                                    </label>
                                    <input
                                        type="date"
                                        required
                                        value={addEmployeeForm.data.effective_from}
                                        onChange={(e) => addEmployeeForm.setData('effective_from', e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:ring-1 focus:ring-indigo-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-slate-400 font-medium mb-1">
                                        Effective To Date
                                    </label>
                                    <input
                                        type="date"
                                        required
                                        value={addEmployeeForm.data.effective_to}
                                        onChange={(e) => addEmployeeForm.setData('effective_to', e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:ring-1 focus:ring-indigo-500"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-slate-400 font-medium mb-1">
                                    Initial Shift Pattern (Optional)
                                </label>
                                <select
                                    value={addEmployeeForm.data.pattern_id}
                                    onChange={(e) => addEmployeeForm.setData('pattern_id', e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-medium focus:ring-1 focus:ring-indigo-500"
                                >
                                    <option value="">No Initial Pattern (Rest Days / Empty)</option>
                                    {patterns.map((p) => (
                                        <option key={p.id} value={p.id}>
                                            {p.name} ({p.code}) • {p.pattern_type.toUpperCase()}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-slate-400 font-medium mb-1">
                                    Select Available Employees ({available_employees.length} available)
                                </label>
                                <input
                                    type="text"
                                    value={addEmpSearch}
                                    onChange={(e) => setAddEmpSearch(e.target.value)}
                                    placeholder="Search available staff..."
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-white mb-2"
                                />
                                <div className="max-h-48 overflow-y-auto border border-slate-800 rounded-xl p-2 bg-slate-950/60 divide-y divide-slate-800/50">
                                    {available_employees
                                        .filter((e) => !addEmpSearch || e.full_name.toLowerCase().includes(addEmpSearch.toLowerCase()) || e.emp_no.toLowerCase().includes(addEmpSearch.toLowerCase()))
                                        .map((emp) => {
                                            const isSelected = addEmployeeForm.data.employee_ids.includes(emp.id);
                                            return (
                                                <label key={emp.id} className="flex items-center justify-between px-2.5 py-1.5 hover:bg-slate-800/40 rounded-lg cursor-pointer">
                                                    <div className="flex items-center gap-2.5">
                                                        <input
                                                            type="checkbox"
                                                            checked={isSelected}
                                                            onChange={(e) => {
                                                                if (e.target.checked) {
                                                                    addEmployeeForm.setData('employee_ids', [...addEmployeeForm.data.employee_ids, emp.id]);
                                                                } else {
                                                                    addEmployeeForm.setData('employee_ids', addEmployeeForm.data.employee_ids.filter((id) => id !== emp.id));
                                                                }
                                                            }}
                                                            className="w-4 h-4 rounded text-emerald-600 bg-slate-900 border-slate-700 focus:ring-emerald-500"
                                                        />
                                                        <div>
                                                            <div className="font-semibold text-white">{emp.full_name}</div>
                                                            <div className="text-[10px] text-slate-400 font-mono">{emp.emp_no} &bull; {emp.department_name}</div>
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
                                    onClick={() => setIsAddEmployeeModalOpen(false)}
                                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={addEmployeeForm.processing || addEmployeeForm.data.employee_ids.length === 0}
                                    className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-md transition disabled:opacity-50"
                                >
                                    {addEmployeeForm.processing ? 'Allocating...' : `Allocate ${addEmployeeForm.data.employee_ids.length} Staff`}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL 6: Remove Employee Allocation Modal */}
            {isRemoveEmployeeModalOpen && active_roster && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl relative">
                        <button
                            onClick={() => setIsRemoveEmployeeModalOpen(false)}
                            className="absolute top-4 right-4 text-slate-400 hover:text-white"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <div>
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                De-Allocation
                            </span>
                            <h3 className="text-lg font-bold text-white mt-1">
                                Remove Personnel from Roster
                            </h3>
                            <p className="text-xs text-slate-400 mt-0.5">
                                De-allocate employee from {active_roster.name}.
                            </p>
                        </div>

                        <form onSubmit={handleRemoveEmployeeSubmit} className="space-y-4 text-xs">
                            <div>
                                <label className="block text-slate-400 font-medium mb-1">
                                    Select Employee
                                </label>
                                <select
                                    value={removeEmployeeForm.data.employee_id}
                                    onChange={(e) => removeEmployeeForm.setData('employee_id', e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-medium focus:ring-1 focus:ring-indigo-500"
                                >
                                    {matrix.map((r) => (
                                        <option key={r.employee.id} value={r.employee.id}>
                                            {r.employee.full_name} ({r.employee.emp_no})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-slate-300 font-medium cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={removeEmployeeForm.data.is_full_month}
                                        onChange={(e) => removeEmployeeForm.setData('is_full_month', e.target.checked)}
                                        className="w-4 h-4 rounded text-rose-600 bg-slate-950 border-slate-700 focus:ring-rose-500"
                                    />
                                    <span>Remove Completely for Full Month</span>
                                </label>

                                {!removeEmployeeForm.data.is_full_month && (
                                    <div>
                                        <label className="block text-slate-400 font-medium mb-1">
                                            Effective Removal Date
                                        </label>
                                        <input
                                            type="date"
                                            value={removeEmployeeForm.data.effective_removal_date}
                                            onChange={(e) => removeEmployeeForm.setData('effective_removal_date', e.target.value)}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:ring-1 focus:ring-indigo-500"
                                        />
                                        <p className="text-[10px] text-slate-400 mt-1">
                                            Dates prior to this remain intact in this roster. From this date onwards, staff is deallocated.
                                        </p>
                                    </div>
                                )}
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                                <button
                                    type="button"
                                    onClick={() => setIsRemoveEmployeeModalOpen(false)}
                                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold shadow-md transition"
                                >
                                    Remove Staff
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL 7: Transfer Roster Modal */}
            {isTransferModalOpen && active_roster && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl relative">
                        <button
                            onClick={() => setIsTransferModalOpen(false)}
                            className="absolute top-4 right-4 text-slate-400 hover:text-white"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <div>
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-sky-500/10 text-sky-400 border border-sky-500/20">
                                Date-Bounded Roster Transfer
                            </span>
                            <h3 className="text-lg font-bold text-white mt-1">
                                Transfer Employee to Roster
                            </h3>
                            <p className="text-xs text-slate-400 mt-0.5">
                                Move personnel from {active_roster.name} to another active roster starting on transfer date.
                            </p>
                        </div>

                        <form onSubmit={handleTransferSubmit} className="space-y-4 text-xs">
                            <div>
                                <label className="block text-slate-400 font-medium mb-1">
                                    Select Employee
                                </label>
                                <select
                                    value={transferForm.data.employee_id}
                                    onChange={(e) => transferForm.setData('employee_id', e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-medium focus:ring-1 focus:ring-indigo-500"
                                >
                                    {matrix.map((r) => (
                                        <option key={r.employee.id} value={r.employee.id}>
                                            {r.employee.full_name} ({r.employee.emp_no})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-slate-400 font-medium mb-1">
                                    Destination Roster
                                </label>
                                <select
                                    required
                                    value={transferForm.data.target_roster_id}
                                    onChange={(e) => transferForm.setData('target_roster_id', e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-medium focus:ring-1 focus:ring-indigo-500"
                                >
                                    <option value={active_roster.id}>
                                        Same Roster: {active_roster.name} (Shift Pattern Switch)
                                    </option>
                                    {rosters.filter((r) => r.id !== active_roster.id).map((r) => (
                                        <option key={r.id} value={r.id}>
                                            {r.name} ({r.code})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-slate-400 font-medium mb-1">
                                    Effective Date
                                </label>
                                <input
                                    type="date"
                                    required
                                    value={transferForm.data.transfer_date}
                                    onChange={(e) => transferForm.setData('transfer_date', e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:ring-1 focus:ring-indigo-500"
                                />
                                <p className="text-[10px] text-slate-400 mt-1">
                                    {transferForm.data.target_roster_id === active_roster.id
                                        ? `Shifts prior to this date remain under previous pattern. From this date onwards, employee switches to new pattern.`
                                        : `Dates before this stay in ${active_roster.name}. From this date onwards, staff is transferred to target roster.`}
                                </p>
                            </div>

                            <div>
                                <label className="block text-slate-400 font-medium mb-1">
                                    Target Shift Pattern
                                </label>
                                <select
                                    value={transferForm.data.pattern_id}
                                    onChange={(e) => transferForm.setData('pattern_id', e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-medium focus:ring-1 focus:ring-indigo-500"
                                >
                                    <option value="">No Initial Pattern (Rest Days / Empty)</option>
                                    {patterns.map((p) => (
                                        <option key={p.id} value={p.id}>
                                            {p.name} ({p.code}) • {p.pattern_type.toUpperCase()}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                                <button
                                    type="button"
                                    onClick={() => setIsTransferModalOpen(false)}
                                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={transferForm.processing || !transferForm.data.target_roster_id}
                                    className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-semibold shadow-md transition disabled:opacity-50"
                                >
                                    {transferForm.processing
                                        ? 'Updating...'
                                        : transferForm.data.target_roster_id === active_roster.id
                                        ? 'Apply Pattern Switch'
                                        : 'Transfer Employee'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </AuthenticatedLayout>
    );
}
