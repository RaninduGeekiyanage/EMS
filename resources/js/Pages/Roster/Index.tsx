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
    Archive,
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
    department_id?: string | null;
    department_name: string;
    designation_title: string;
    is_available: boolean;
    exclusion_reason?: string | null;
    current_squad?: {
        id: string;
        name: string;
        code: string;
        color: string | null;
        start_date?: string;
        end_date?: string;
    } | null;
    current_roster?: {
        id: string;
        name: string;
        code: string;
    } | null;
    can_transfer?: boolean;
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
    all_employees = [],
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
    const [deptFilter, setDeptFilter] = useState<string>(selected_department || 'all');
    const [squadFilter, setSquadFilter] = useState<string>('all');
    const [collapsedSquads, setCollapsedSquads] = useState<Record<string, boolean>>({});

    // Modals & Drawers
    const [isNewRosterModalOpen, setIsNewRosterModalOpen] = useState(false);
    const [rosterWizardStep, setRosterWizardStep] = useState<1 | 2 | 3>(1);
    const [wizardEmpSearch, setWizardEmpSearch] = useState('');
    const [wizardDeptFilter, setWizardDeptFilter] = useState('all');

    const [isNewSquadModalOpen, setIsNewSquadModalOpen] = useState(false);
    const [isEditSquadModalOpen, setIsEditSquadModalOpen] = useState(false);
    const [editingSquad, setEditingSquad] = useState<RosterGroup | null>(null);
    const [isSquadDirectoryModalOpen, setIsSquadDirectoryModalOpen] = useState(false);
    const [squadEmpSearch, setSquadEmpSearch] = useState('');
    const [squadDeptFilter, setSquadDeptFilter] = useState('all');

    const [isQuickPatternModalOpen, setIsQuickPatternModalOpen] = useState(false);
    const [quickPatternEmpSearch, setQuickPatternEmpSearch] = useState('');

    const [isCloneModalOpen, setIsCloneModalOpen] = useState(false);
    const [isManageMembersModalOpen, setIsManageMembersModalOpen] = useState(false);
    const [targetSquadForEnroll, setTargetSquadForEnroll] = useState<RosterGroup | null>(null);

    // Dedicated Modals for Personnel Lifecycle (Replacing Prompts/Confirms)
    const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
    const [transferringEmployee, setTransferringEmployee] = useState<{
        id: string;
        full_name: string;
        emp_no: string;
        current_squad?: { id: string; name: string; code: string; color: string | null } | null;
        current_roster?: { id: string; name: string; code: string } | null;
    } | null>(null);
    const [transferTargetSquadId, setTransferTargetSquadId] = useState<string>('');
    const [transferEffectiveDate, setTransferEffectiveDate] = useState<string>('');
    const [transferProcessing, setTransferProcessing] = useState(false);

    const [isRemoveModalOpen, setIsRemoveModalOpen] = useState(false);
    const [removingEmployee, setRemovingEmployee] = useState<{
        id: string;
        full_name: string;
        emp_no: string;
        squad_id?: string;
        squad_name?: string;
    } | null>(null);
    const [removeMode, setRemoveMode] = useState<'effective_date' | 'purge_all'>('effective_date');
    const [removeEffectiveDate, setRemoveEffectiveDate] = useState<string>('');
    const [removeProcessing, setRemoveProcessing] = useState(false);

    const [isRosterPersonnelModalOpen, setIsRosterPersonnelModalOpen] = useState(false);
    const [personnelHubTab, setPersonnelHubTab] = useState<'available' | 'transfer' | 'assigned'>('available');
    const [personnelHubTargetSquadId, setPersonnelHubTargetSquadId] = useState<string>('');
    const [personnelHubSearch, setPersonnelHubSearch] = useState('');
    const [personnelHubDeptFilter, setPersonnelHubDeptFilter] = useState('all');
    const [personnelHubSelectedEmpIds, setPersonnelHubSelectedEmpIds] = useState<string[]>([]);
    const [personnelHubEffectiveDate, setPersonnelHubEffectiveDate] = useState<string>('');
    const [personnelHubProcessing, setPersonnelHubProcessing] = useState(false);

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
                !searchQuery ||
                row.employee.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                row.employee.emp_no.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (row.employee.department?.name && row.employee.department.name.toLowerCase().includes(searchQuery.toLowerCase()));

            const matchesDept =
                deptFilter === 'all' ||
                row.employee.department?.id === deptFilter ||
                row.employee.department?.name === deptFilter;

            const matchesSquad = squadFilter === 'all' || row.squad?.id === squadFilter;

            return matchesSearch && matchesDept && matchesSquad;
        });
    }, [matrix, searchQuery, squadFilter, deptFilter]);

    // Group rows by Squad for Squad View
    const groupedBySquad = useMemo(() => {
        const groups: Record<string, { squad: RosterGroup | { id: string; name: string; color: string | null; pattern_name?: string | null }; rows: MatrixRow[] }> = {};

        // Prepopulate all squads belonging to active roster
        squads.forEach((sq) => {
            groups[sq.id] = { squad: sq, rows: [] };
        });

        // Add 'unassigned' group bucket for direct/non-squad employees
        groups['unassigned'] = {
            squad: { id: 'unassigned', name: 'Department Personnel / Direct Assigned', color: '#64748b' },
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
        if (groups['unassigned'].rows.length === 0) {
            delete groups['unassigned'];
        }

        return groups;
    }, [filteredMatrix, squads]);

    // Unified employee pool for creation wizards
    const wizardEmployeePool = useMemo(() => {
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

    const [activeSquadTabIndex, setActiveSquadTabIndex] = useState<number>(0);

    // 2. New Roster Form (Unified Multi-Squad Wizard)
    const newRosterForm = useForm({
        name: `${month_name} - Operations Roster`,
        code: `RST-${year}-${String(month).padStart(2, '0')}-OPS`,
        department_id: '',
        start_date: `${year}-${String(month).padStart(2, '0')}-01`,
        end_date: (() => {
            const lastDay = new Date(year, month, 0).getDate();
            return `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
        })(),
        status: 'draft' as 'draft' | 'published',
        notes: '',
        generation_mode: 'auto_stagger_squads' as 'auto_stagger_squads' | 'multi_pattern' | 'direct_pattern' | 'blank',
        base_pattern_id: patterns[0]?.id || '',
        squad_count: 4,
        stagger_days: 2,
        squads: [] as Array<{
            name: string;
            code: string;
            color: string;
            pattern_id?: string;
            offset_days?: number;
            employee_ids: string[];
        }>,
        pattern_id: patterns[0]?.id || '',
        employee_ids: [] as string[],
    });

    const defaultSquadColors = useMemo(() => ['#3b82f6', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b', '#06b6d4', '#f97316', '#6366f1'], []);

    // Helper to generate squads array for auto-stagger
    const buildAutoStaggerSquads = (count: number, stagger: number) => {
        const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
        const squadsList = [];
        for (let i = 0; i < count; i++) {
            const letter = alphabet[i] || `G${i + 1}`;
            squadsList.push({
                name: `Squad ${letter}`,
                code: `SQD-${letter}`,
                color: defaultSquadColors[i % defaultSquadColors.length],
                offset_days: i * stagger,
                employee_ids: [] as string[],
            });
        }
        return squadsList;
    };

    const openNewRosterModal = () => {
        setRosterWizardStep(1);
        setActiveSquadTabIndex(0);
        setWizardEmpSearch('');
        setWizardDeptFilter('all');

        const initialSquadCount = 4;
        const initialStagger = 2;
        const initialBasePattern = patterns[0]?.id || '';
        const initialSquads = buildAutoStaggerSquads(initialSquadCount, initialStagger);

        newRosterForm.setData({
            name: `${month_name} - Operations Roster`,
            code: `RST-${year}-${String(month).padStart(2, '0')}-OPS`,
            department_id: '',
            start_date: `${year}-${String(month).padStart(2, '0')}-01`,
            end_date: (() => {
                const lastDay = new Date(year, month, 0).getDate();
                return `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
            })(),
            status: 'draft',
            notes: '',
            generation_mode: 'auto_stagger_squads',
            base_pattern_id: initialBasePattern,
            squad_count: initialSquadCount,
            stagger_days: initialStagger,
            squads: initialSquads,
            pattern_id: initialBasePattern,
            employee_ids: [],
        });
        setIsNewRosterModalOpen(true);
    };

    // Live preview computation for auto-stagger mode
    const selectedBasePattern = useMemo(() => {
        return patterns.find((p) => p.id === newRosterForm.data.base_pattern_id) || patterns[0] || null;
    }, [patterns, newRosterForm.data.base_pattern_id]);

    const basePatternSteps = useMemo(() => {
        if (!selectedBasePattern) return [];
        return selectedBasePattern.pattern_data?.steps || selectedBasePattern.pattern_data || [];
    }, [selectedBasePattern]);

    // Unique shifts in the base pattern with timings
    const basePatternShifts = useMemo(() => {
        if (!basePatternSteps.length) return [];
        const shiftIds = Array.from(new Set(basePatternSteps.map((s: any) => s.shift_id).filter(Boolean)));
        return shiftIds.map((id) => shifts.find((s) => s.id === id)).filter(Boolean) as Shift[];
    }, [basePatternSteps, shifts]);

    // Live rotated squads preview
    const autoStaggerPreviews = useMemo(() => {
        if (!selectedBasePattern || basePatternSteps.length === 0) return [];
        const count = basePatternSteps.length;
        const squadCount = newRosterForm.data.squad_count || 4;
        const stagger = newRosterForm.data.stagger_days || 2;
        const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

        const previews = [];
        for (let i = 0; i < squadCount; i++) {
            const letter = alphabet[i] || `G${i + 1}`;
            const offset = (i * stagger) % count;
            const chips = [];
            for (let j = 0; j < count; j++) {
                const src = basePatternSteps[(j + offset) % count];
                const shift = shifts.find((s) => s.id === src?.shift_id);
                chips.push({
                    label: src?.is_rest_day ? 'OFF' : shift?.code || 'SHIFT',
                    isRest: Boolean(src?.is_rest_day),
                    color: shift?.color,
                    shiftName: shift?.name,
                    startTime: shift?.start_time,
                    endTime: shift?.end_time,
                });
            }
            previews.push({
                letter,
                name: newRosterForm.data.squads[i]?.name || `Squad ${letter}`,
                code: newRosterForm.data.squads[i]?.code || `SQD-${letter}`,
                color: newRosterForm.data.squads[i]?.color || defaultSquadColors[i % defaultSquadColors.length],
                offset,
                chips,
            });
        }
        return previews;
    }, [selectedBasePattern, basePatternSteps, newRosterForm.data.squad_count, newRosterForm.data.stagger_days, newRosterForm.data.squads, shifts, defaultSquadColors]);

    // 1-Click Distribute Evenly across squads
    const handleDistributeEvenly = () => {
        const availablePool = wizardEmployeePool.filter((e) => {
            const matchesSearch =
                e.full_name.toLowerCase().includes(wizardEmpSearch.toLowerCase()) ||
                e.emp_no.toLowerCase().includes(wizardEmpSearch.toLowerCase());
            const matchesDept = wizardDeptFilter === 'all' || e.department_id === wizardDeptFilter;
            return matchesSearch && matchesDept;
        });

        const currentSquads = newRosterForm.data.squads.map((sq) => ({ ...sq, employee_ids: [] as string[] }));
        if (currentSquads.length === 0) return;

        availablePool.forEach((emp, index) => {
            const targetIndex = index % currentSquads.length;
            currentSquads[targetIndex].employee_ids.push(emp.id);
        });

        newRosterForm.setData('squads', currentSquads);
    };

    // Toggle single employee in specific squad
    const handleToggleEmployeeInSquad = (squadIdx: number, employeeId: string) => {
        const currentSquads = [...newRosterForm.data.squads];
        if (!currentSquads[squadIdx]) return;

        const isCurrentlyInThisSquad = currentSquads[squadIdx].employee_ids.includes(employeeId);

        // Remove employee from all squads first (exclusivity guard)
        currentSquads.forEach((sq) => {
            sq.employee_ids = sq.employee_ids.filter((id) => id !== employeeId);
        });

        // If wasn't in this squad, add them
        if (!isCurrentlyInThisSquad) {
            currentSquads[squadIdx].employee_ids.push(employeeId);
        }

        newRosterForm.setData('squads', currentSquads);
    };

    const handleNewRosterSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        newRosterForm.post('/roster/rosters', {
            onSuccess: () => setIsNewRosterModalOpen(false),
        });
    };

    // 2b. New Squad Form
    const newSquadForm = useForm({
        name: '',
        code: '',
        color: '#3b82f6',
        roster_pattern_id: patterns[0]?.id || '',
        description: '',
        employee_ids: [] as string[],
    });

    const selectedSquadPattern = useMemo(() => {
        return patterns.find((p) => p.id === newSquadForm.data.roster_pattern_id) || null;
    }, [patterns, newSquadForm.data.roster_pattern_id]);

    const squadPatternSteps = useMemo(() => {
        if (!selectedSquadPattern) return [];
        return selectedSquadPattern.pattern_data?.steps || selectedSquadPattern.pattern_data || [];
    }, [selectedSquadPattern]);

    const openNewSquadModal = () => {
        setSquadEmpSearch('');
        setSquadDeptFilter('all');
        newSquadForm.setData({
            name: '',
            code: '',
            color: '#3b82f6',
            roster_pattern_id: patterns[0]?.id || '',
            description: '',
            employee_ids: [],
        });
        setIsNewSquadModalOpen(true);
    };

    const handleSelectAllSquadAvailable = () => {
        const matchingAvailable = available_employees
            .filter((emp) => {
                const matchesSearch =
                    emp.full_name.toLowerCase().includes(squadEmpSearch.toLowerCase()) ||
                    emp.emp_no.toLowerCase().includes(squadEmpSearch.toLowerCase());
                const matchesDept =
                    squadDeptFilter === 'all' ||
                    emp.department_id === squadDeptFilter ||
                    emp.department_name === squadDeptFilter;
                return matchesSearch && matchesDept && emp.is_available && !emp.current_squad;
            })
            .map((emp) => emp.id);

        const merged = Array.from(new Set([...newSquadForm.data.employee_ids, ...matchingAvailable]));
        newSquadForm.setData('employee_ids', merged);
    };

    const handleDeselectAllSquad = () => {
        newSquadForm.setData('employee_ids', []);
    };

    const handleNewSquadSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const url = active_roster ? `/roster/rosters/${active_roster.id}/squads` : '/roster/squads';
        newSquadForm.post(url, {
            preserveScroll: true,
            onSuccess: () => setIsNewSquadModalOpen(false),
        });
    };

    // 2b-ii. Edit Squad Form
    const editSquadForm = useForm({
        name: '',
        code: '',
        color: '#3b82f6',
        roster_pattern_id: '',
        description: '',
        employee_ids: [] as string[],
    });

    const selectedEditSquadPattern = useMemo(() => {
        return patterns.find((p) => p.id === editSquadForm.data.roster_pattern_id) || null;
    }, [patterns, editSquadForm.data.roster_pattern_id]);

    const editSquadPatternSteps = useMemo(() => {
        if (!selectedEditSquadPattern) return [];
        return selectedEditSquadPattern.pattern_data?.steps || selectedEditSquadPattern.pattern_data || [];
    }, [selectedEditSquadPattern]);

    const openEditSquadModal = (squad: RosterGroup) => {
        setEditingSquad(squad);
        editSquadForm.setData({
            name: squad.name,
            code: squad.code,
            color: squad.color || '#3b82f6',
            roster_pattern_id: squad.roster_pattern_id || '',
            description: squad.description || '',
            employee_ids: (squad.employees || []).map((e) => e.id),
        });
        setSquadEmpSearch('');
        setSquadDeptFilter('all');
        setIsEditSquadModalOpen(true);
    };

    const handleEditSquadSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingSquad) return;
        editSquadForm.put(`/roster/squads/${editingSquad.id}`, {
            preserveScroll: true,
            onSuccess: () => {
                setIsEditSquadModalOpen(false);
                setEditingSquad(null);
            },
        });
    };

    const handleSelectAllEditSquadAvailable = () => {
        const matchingAvailable = available_employees
            .filter((emp) => {
                const matchesSearch =
                    emp.full_name.toLowerCase().includes(squadEmpSearch.toLowerCase()) ||
                    emp.emp_no.toLowerCase().includes(squadEmpSearch.toLowerCase());
                const matchesDept =
                    squadDeptFilter === 'all' ||
                    emp.department_id === squadDeptFilter ||
                    emp.department_name === squadDeptFilter;
                const isCurrentlyInThisEditingSquad = editingSquad && (editingSquad.employees || []).some((e) => e.id === emp.id);
                return matchesSearch && matchesDept && (isCurrentlyInThisEditingSquad || (emp.is_available && !emp.current_squad));
            })
            .map((emp) => emp.id);

        const merged = Array.from(new Set([...editSquadForm.data.employee_ids, ...matchingAvailable]));
        editSquadForm.setData('employee_ids', merged);
    };

    const handleDeselectAllEditSquad = () => {
        editSquadForm.setData('employee_ids', []);
    };

    const handleDeleteSquad = (squad: RosterGroup) => {
        if (confirm(`Are you sure you want to delete squad '${squad.name}'? All member enrollments will be cleared.`)) {
            router.delete(`/roster/squads/${squad.id}`, {
                preserveScroll: true,
            });
        }
    };

    // 2c. Quick Pattern / Bulk Fill Form
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
        quickPatternForm.setData({
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
        setIsQuickPatternModalOpen(true);
    };

    const handleQuickPatternSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        quickPatternForm.post('/roster/generate', {
            preserveScroll: true,
            onSuccess: () => setIsQuickPatternModalOpen(false),
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

    // 4. Dedicated Modal Openers & Handlers (Replacing native prompts & confirms)
    const [selectedEnrollEmpIds, setSelectedEnrollEmpIds] = useState<string[]>([]);
    const [memberSearchQuery, setMemberSearchQuery] = useState('');
    const [memberDeptFilter, setMemberDeptFilter] = useState('all');
    const [enrollEffectiveDate, setEnrollEffectiveDate] = useState<string>('');
    const [manageMembersTab, setManageMembersTab] = useState<'current' | 'add'>('current');

    const openManageMembers = (squad: RosterGroup) => {
        setTargetSquadForEnroll(squad);
        setSelectedEnrollEmpIds([]);
        setMemberSearchQuery('');
        setEnrollEffectiveDate(active_roster?.start_date || new Date().toISOString().split('T')[0]);
        setManageMembersTab('current');
        setIsManageMembersModalOpen(true);
    };

    const handleEnrollSubmit = () => {
        if (!targetSquadForEnroll || selectedEnrollEmpIds.length === 0) return;
        router.post(
            `/roster/squads/${targetSquadForEnroll.id}/enroll`,
            {
                employee_ids: selectedEnrollEmpIds,
                effective_start_date: enrollEffectiveDate || undefined,
            },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setSelectedEnrollEmpIds([]);
                    setIsManageMembersModalOpen(false);
                },
            }
        );
    };

    // 4a. Transfer Staff Modal Opener & Submitter
    const openTransferModal = (emp: {
        id: string;
        full_name: string;
        emp_no: string;
        current_squad?: { id: string; name: string; code: string; color: string | null } | null;
        current_roster?: { id: string; name: string; code: string } | null;
    }) => {
        setTransferringEmployee(emp);
        const otherSquad = squads.find((s) => s.id !== emp.current_squad?.id) || squads[0];
        setTransferTargetSquadId(otherSquad?.id || '');
        const todayStr = new Date().toISOString().split('T')[0];
        const defaultDate = active_roster?.start_date && todayStr < active_roster.start_date
            ? active_roster.start_date
            : todayStr;
        setTransferEffectiveDate(defaultDate);
        setIsTransferModalOpen(true);
    };

    const handleTransferSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!transferringEmployee || !transferTargetSquadId || !transferEffectiveDate) return;

        setTransferProcessing(true);
        router.post(
            `/roster/squads/${transferTargetSquadId}/transfer`,
            {
                employee_id: transferringEmployee.id,
                effective_date: transferEffectiveDate,
            },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setIsTransferModalOpen(false);
                    setTransferringEmployee(null);
                    setTransferProcessing(false);
                },
                onError: () => {
                    setTransferProcessing(false);
                },
            }
        );
    };

    // 4b. Remove Staff Modal Opener & Submitter
    const openRemoveModal = (emp: {
        id: string;
        full_name: string;
        emp_no: string;
        squad_id?: string;
        squad_name?: string;
    }) => {
        setRemovingEmployee(emp);
        setRemoveMode(active_roster?.status === 'draft' ? 'purge_all' : 'effective_date');
        setRemoveEffectiveDate(new Date().toISOString().split('T')[0]);
        setIsRemoveModalOpen(true);
    };

    const handleRemoveSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!removingEmployee || !removingEmployee.squad_id) return;

        const effectiveDate = removeMode === 'purge_all' ? null : (removeEffectiveDate || null);

        setRemoveProcessing(true);
        router.post(
            `/roster/squads/${removingEmployee.squad_id}/remove-member`,
            {
                employee_id: removingEmployee.id,
                effective_date: effectiveDate,
            },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setIsRemoveModalOpen(false);
                    setRemovingEmployee(null);
                    setRemoveProcessing(false);
                },
                onError: () => {
                    setRemoveProcessing(false);
                },
            }
        );
    };

    // 4c. Unified Roster Personnel Hub
    const openRosterPersonnelModal = () => {
        setPersonnelHubTab('available');
        setPersonnelHubTargetSquadId(squads[0]?.id || '');
        setPersonnelHubSearch('');
        setPersonnelHubDeptFilter('all');
        setPersonnelHubSelectedEmpIds([]);
        setPersonnelHubEffectiveDate(active_roster?.start_date || new Date().toISOString().split('T')[0]);
        setIsRosterPersonnelModalOpen(true);
    };

    const handleRosterPersonnelEnroll = (e: React.FormEvent) => {
        e.preventDefault();
        if (!personnelHubTargetSquadId || personnelHubSelectedEmpIds.length === 0) return;

        setPersonnelHubProcessing(true);
        router.post(
            `/roster/squads/${personnelHubTargetSquadId}/enroll`,
            {
                employee_ids: personnelHubSelectedEmpIds,
                effective_start_date: personnelHubEffectiveDate || undefined,
            },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setPersonnelHubSelectedEmpIds([]);
                    setIsRosterPersonnelModalOpen(false);
                    setPersonnelHubProcessing(false);
                },
                onError: () => {
                    setPersonnelHubProcessing(false);
                },
            }
        );
    };

    // 5. 1-Click Roster Sync
    const handleSyncRoster = () => {
        if (!active_roster) return;
        router.post(`/roster/rosters/${active_roster.id}/sync`, {}, { preserveScroll: true });
    };

    // 6. Publish / Draft Toggle
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
        newSquadForm.processing ||
        quickPatternForm.processing ||
        cloneForm.processing;

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
                        <div className="flex items-center gap-1 shrink-0">
                            {row.squad && viewMode === 'flat' && (
                                <span
                                    className="text-[9px] font-bold px-1.5 py-0.5 rounded text-white shrink-0"
                                    style={{ backgroundColor: row.squad.color || '#3b82f6' }}
                                >
                                    {row.squad.code}
                                </span>
                            )}
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    openTransferModal({
                                        id: row.employee.id,
                                        full_name: row.employee.full_name,
                                        emp_no: row.employee.emp_no,
                                        current_squad: row.squad ? { id: row.squad.id, name: row.squad.name, code: row.squad.code, color: row.squad.color } : null,
                                        current_roster: active_roster ? { id: active_roster.id, name: active_roster.name, code: active_roster.code } : null,
                                    });
                                }}
                                className="p-1 rounded text-slate-400 hover:text-indigo-300 hover:bg-slate-800 transition"
                                title="Transfer Staff to Another Squad / Rotation (Mid-Period)"
                            >
                                <ArrowLeftRight className="w-3.5 h-3.5" />
                            </button>
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    const assignedSquadId = row.squad?.id || squads[0]?.id;
                                    openRemoveModal({
                                        id: row.employee.id,
                                        full_name: row.employee.full_name,
                                        emp_no: row.employee.emp_no,
                                        squad_id: assignedSquadId,
                                        squad_name: row.squad?.name || 'Assigned Squad',
                                    });
                                }}
                                className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition"
                                title="Remove or End Assignment"
                            >
                                <UserMinus className="w-3.5 h-3.5" />
                            </button>
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
                                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 hover:border-slate-600 transition flex items-center gap-1.5 shadow-sm"
                                    title="Create a new Named Roster"
                                >
                                    <Plus className="w-3.5 h-3.5 text-indigo-400" />
                                    <span>New Roster</span>
                                </button>

                                {active_roster && (
                                    <>
                                        <button
                                            onClick={openRosterPersonnelModal}
                                            className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition"
                                            title="Manage, enroll, or transfer personnel for this roster"
                                        >
                                            <Users className="w-3.5 h-3.5" />
                                            <span>Manage Personnel</span>
                                        </button>

                                        <button
                                            onClick={openNewSquadModal}
                                            className="px-3 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 text-xs font-semibold border border-indigo-500/30 hover:border-indigo-500/50 transition flex items-center gap-1.5 shadow-sm"
                                            title="Create a new workforce squad under this roster"
                                        >
                                            <UserPlus className="w-3.5 h-3.5 text-indigo-400" />
                                            <span>+ Add Squad</span>
                                        </button>
                                    </>
                                )}

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
                                                <span>Archive Roster</span>
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
                                        onClick={openQuickPatternModal}
                                        className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-sm"
                                        title="Quick fill shifts using a pattern"
                                    >
                                        <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                                        <span>Apply Pattern</span>
                                    </button>

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
                                    Shifts in this roster are not yet official or visible to standard staff. You can add/remove personnel, alter schedules, or publish when finalized.
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            <button
                                type="button"
                                onClick={openRosterPersonnelModal}
                                className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-sm"
                            >
                                <UserPlus className="w-3.5 h-3.5" />
                                <span>Manage Personnel</span>
                            </button>
                            <button
                                type="button"
                                onClick={handleSyncRoster}
                                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition"
                            >
                                <RefreshCw className="w-3.5 h-3.5 text-indigo-400" />
                                <span>Sync Shifts</span>
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
                    {/* View Switcher, Department & Squad Filters */}
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

                        {/* Department Filter Dropdown (Added after All Personnel) */}
                        <div className="relative">
                            <select
                                value={deptFilter}
                                onChange={(e) => {
                                    setDeptFilter(e.target.value);
                                    if (!viewMode) setViewMode('squad');
                                }}
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

                        {/* Squad Filter Dropdown */}
                        <div className="relative">
                            <select
                                value={squadFilter}
                                onChange={(e) => {
                                    setSquadFilter(e.target.value);
                                    if (!viewMode) setViewMode('squad');
                                }}
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

                        <button
                            type="button"
                            onClick={openNewSquadModal}
                            className="px-2.5 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-indigo-400 hover:text-indigo-300 text-xs font-semibold flex items-center gap-1 transition shadow-sm"
                            title="Create a new squad or permanent crew"
                        >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add Squad</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setIsSquadDirectoryModalOpen(true)}
                            className="px-2.5 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-sm"
                            title="View and manage all squads, patterns & enrollments"
                        >
                            <Users className="w-3.5 h-3.5 text-indigo-400" />
                            <span>Squad Directory</span>
                        </button>

                        {/* Search Input */}
                        <div className="relative flex-1 sm:w-60">
                            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => {
                                    setSearchQuery(e.target.value);
                                    if (!viewMode) setViewMode('squad');
                                }}
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

                                                            {/* Squad Actions: Edit, Manage Staff, Delete */}
                                                            {'roster_id' in squad && (
                                                                <div className="flex items-center gap-1.5">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => openEditSquadModal(squad as RosterGroup)}
                                                                        className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-[11px] font-semibold flex items-center gap-1 transition"
                                                                        title="Edit Squad Details and Rotation Pattern"
                                                                    >
                                                                        <Settings className="w-3.5 h-3.5" />
                                                                        <span>Edit</span>
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => openManageMembers(squad as RosterGroup)}
                                                                        className="px-2.5 py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-[11px] font-semibold flex items-center gap-1.5 transition"
                                                                        title="Add or Remove Staff from Squad"
                                                                    >
                                                                        <UserPlus className="w-3.5 h-3.5" />
                                                                        <span>Manage Staff ({rows.length})</span>
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleDeleteSquad(squad as RosterGroup)}
                                                                        className="p-1 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 hover:text-rose-300 border border-rose-800/40 text-[11px] transition"
                                                                        title="Delete Squad"
                                                                    >
                                                                        <Trash2 className="w-3.5 h-3.5" />
                                                                    </button>
                                                                </div>
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
                                ) : viewMode === 'flat' ? (
                                    // FLAT STAFF VIEW
                                    filteredMatrix.map((row) => renderMatrixRow(row))
                                ) : null}

                                {filteredMatrix.length === 0 && (
                                    <tr>
                                        <td
                                            colSpan={days.length + 2}
                                            className="px-6 py-16 text-center text-slate-400"
                                        >
                                            {!viewMode ? (
                                                <div className="max-w-md mx-auto space-y-3">
                                                    <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto shadow-inner">
                                                        <Users className="w-6 h-6" />
                                                    </div>
                                                    <div>
                                                        <h4 className="text-sm font-bold text-white">
                                                            Select a View Filter to Display Roster
                                                        </h4>
                                                        <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                                                            Choose a viewing mode, select a department, or pick a squad above to load and explore schedule matrix data.
                                                        </p>
                                                    </div>
                                                    <div className="flex items-center justify-center gap-2.5 pt-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => setViewMode('squad')}
                                                            className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md transition flex items-center gap-1.5"
                                                        >
                                                            <Users className="w-3.5 h-3.5" />
                                                            <span>Group by Squad</span>
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => setViewMode('flat')}
                                                            className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold shadow-sm transition"
                                                        >
                                                            All Personnel
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <>
                                                    <AlertCircle className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                                                    <p className="text-sm font-semibold text-white">
                                                        No personnel roster entries found.
                                                    </p>
                                                    <p className="text-xs text-slate-500 mt-1">
                                                        Try adjusting your department, squad, or search filter.
                                                    </p>
                                                </>
                                            )}
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

            {/* MODAL 3: Unified Multi-Squad Roster Creation Wizard */}
            {isNewRosterModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6 bg-black/80 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg md:max-w-3xl lg:max-w-4xl xl:max-w-5xl 2xl:max-w-6xl p-5 md:p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto flex flex-col">
                        <button
                            type="button"
                            onClick={() => setIsNewRosterModalOpen(false)}
                            className="absolute top-5 right-5 text-slate-400 hover:text-white transition"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <div className="mb-4">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                                Enterprise Scheduling Wizard
                            </span>
                            <h3 className="text-base md:text-lg font-bold text-white mt-1">
                                Create Operational Roster
                            </h3>
                            <p className="text-xs text-slate-400">
                                Setup monthly schedule, configure shift rotation squads, and allocate personnel with guaranteed continuous coverage.
                            </p>
                        </div>

                        {/* Wizard Step Indicator */}
                        <div className="flex items-center gap-2 p-1 bg-slate-950/80 rounded-xl border border-slate-800 mb-4">
                            <button
                                type="button"
                                onClick={() => setRosterWizardStep(1)}
                                className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                                    rosterWizardStep === 1
                                        ? 'bg-indigo-600 text-white shadow-md'
                                        : 'text-slate-400 hover:text-white'
                                }`}
                            >
                                <span className="w-4 h-4 rounded-full bg-black/30 flex items-center justify-center text-[10px]">1</span>
                                <span>Period &amp; Horizon</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setRosterWizardStep(2)}
                                className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                                    rosterWizardStep === 2
                                        ? 'bg-indigo-600 text-white shadow-md'
                                        : 'text-slate-400 hover:text-white'
                                }`}
                            >
                                <span className="w-4 h-4 rounded-full bg-black/30 flex items-center justify-center text-[10px]">2</span>
                                <span>Strategy &amp; Timings</span>
                            </button>
                            {newRosterForm.data.generation_mode !== 'blank' && (
                                <button
                                    type="button"
                                    onClick={() => setRosterWizardStep(3)}
                                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                                        rosterWizardStep === 3
                                            ? 'bg-indigo-600 text-white shadow-md'
                                            : 'text-slate-400 hover:text-white'
                                    }`}
                                >
                                    <span className="w-4 h-4 rounded-full bg-black/30 flex items-center justify-center text-[10px]">3</span>
                                    <span>
                                        {newRosterForm.data.generation_mode === 'direct_pattern'
                                            ? `Target Staff (${newRosterForm.data.employee_ids.length})`
                                            : `Squad Allocation (${newRosterForm.data.squads.reduce((acc, s) => acc + s.employee_ids.length, 0)})`}
                                    </span>
                                </button>
                            )}
                        </div>

                        <form onSubmit={handleNewRosterSubmit} className="space-y-4">
                            {/* STEP 1: Roster Identity & Horizon */}
                            {rosterWizardStep === 1 && (
                                <div className="space-y-3.5">
                                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                                        <div className="md:col-span-7">
                                            <label className="block text-xs font-semibold text-slate-300 mb-1">
                                                Roster Name *
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
                                        <div className="md:col-span-5">
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
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-300 mb-1">
                                                Department Scope
                                            </label>
                                            <select
                                                value={newRosterForm.data.department_id}
                                                onChange={(e) => newRosterForm.setData('department_id', e.target.value)}
                                                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                                            >
                                                <option value="">All Company Personnel</option>
                                                {departments.map((d) => (
                                                    <option key={d.id} value={d.id}>
                                                        {d.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-300 mb-1">
                                                Start Date *
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
                                                End Date *
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
                                            Operational Notes
                                        </label>
                                        <textarea
                                            rows={2}
                                            value={newRosterForm.data.notes}
                                            onChange={(e) => newRosterForm.setData('notes', e.target.value)}
                                            placeholder="Staffing targets, seasonal remarks..."
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:ring-1 focus:ring-indigo-500 placeholder-slate-600 resize-none"
                                        />
                                    </div>

                                    <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-800">
                                        <button
                                            type="button"
                                            onClick={() => setIsNewRosterModalOpen(false)}
                                            className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white transition"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setRosterWizardStep(2)}
                                            className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-md transition flex items-center gap-1.5"
                                        >
                                            <span>Next: Strategy &amp; Timings</span>
                                            <ChevronRight className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* STEP 2: Scheduling Strategy & Shift Timings */}
                            {rosterWizardStep === 2 && (
                                <div className="space-y-4">
                                    {/* 4 Clean Strategy Cards */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                        {/* Option B: Auto-Stagger Multi-Squad Rotation (Primary) */}
                                        <div
                                            onClick={() => {
                                                newRosterForm.setData({
                                                    ...newRosterForm.data,
                                                    generation_mode: 'auto_stagger_squads',
                                                    squads: buildAutoStaggerSquads(newRosterForm.data.squad_count || 4, newRosterForm.data.stagger_days || 2),
                                                });
                                            }}
                                            className={`p-3.5 rounded-xl border cursor-pointer transition relative overflow-hidden flex flex-col justify-between ${
                                                newRosterForm.data.generation_mode === 'auto_stagger_squads'
                                                    ? 'bg-indigo-600/20 border-indigo-500 ring-1 ring-indigo-500'
                                                    : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                                            }`}
                                        >
                                            <div>
                                                <div className="flex items-center justify-between mb-1.5">
                                                    <div className="flex items-center gap-2">
                                                        <RefreshCw className="w-4 h-4 text-emerald-400" />
                                                        <span className="font-bold text-xs text-white">Auto-Stagger Squads</span>
                                                    </div>
                                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 uppercase">
                                                        24/7 Standard
                                                    </span>
                                                </div>
                                                <p className="text-[11px] text-slate-400 leading-relaxed">
                                                    Select 1 master pattern &amp; auto-generate Squads A, B, C, D with staggered shifts for continuous 24/7 coverage.
                                                </p>
                                            </div>
                                        </div>

                                        {/* Option A: Multi-Pattern Squad Selection */}
                                        <div
                                            onClick={() => {
                                                const initialMulti = patterns.slice(0, 3).map((p, idx) => ({
                                                    name: `Squad ${String.fromCharCode(65 + idx)}`,
                                                    code: `SQD-${String.fromCharCode(65 + idx)}`,
                                                    color: defaultSquadColors[idx % defaultSquadColors.length],
                                                    pattern_id: p.id,
                                                    employee_ids: [],
                                                }));
                                                newRosterForm.setData({
                                                    ...newRosterForm.data,
                                                    generation_mode: 'multi_pattern',
                                                    squads: initialMulti,
                                                });
                                            }}
                                            className={`p-3.5 rounded-xl border cursor-pointer transition flex flex-col justify-between ${
                                                newRosterForm.data.generation_mode === 'multi_pattern'
                                                    ? 'bg-indigo-600/20 border-indigo-500 ring-1 ring-indigo-500'
                                                    : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                                            }`}
                                        >
                                            <div>
                                                <div className="flex items-center justify-between mb-1.5">
                                                    <div className="flex items-center gap-2">
                                                        <Layers className="w-4 h-4 text-sky-400" />
                                                        <span className="font-bold text-xs text-white">Multi-Pattern Squads</span>
                                                    </div>
                                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-300 border border-sky-500/20 uppercase">
                                                        Custom Mix
                                                    </span>
                                                </div>
                                                <p className="text-[11px] text-slate-400 leading-relaxed">
                                                    Pick multiple existing shift patterns from library and assign to custom squads.
                                                </p>
                                            </div>
                                        </div>

                                        {/* Option C: Direct Single Pattern */}
                                        <div
                                            onClick={() => newRosterForm.setData('generation_mode', 'direct_pattern')}
                                            className={`p-3.5 rounded-xl border cursor-pointer transition flex flex-col justify-between ${
                                                newRosterForm.data.generation_mode === 'direct_pattern'
                                                    ? 'bg-indigo-600/20 border-indigo-500 ring-1 ring-indigo-500'
                                                    : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                                            }`}
                                        >
                                            <div>
                                                <div className="flex items-center justify-between mb-1.5">
                                                    <div className="flex items-center gap-2">
                                                        <Sparkles className="w-4 h-4 text-purple-400" />
                                                        <span className="font-bold text-xs text-white">Single Pattern</span>
                                                    </div>
                                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20 uppercase">
                                                        Fixed Schedule
                                                    </span>
                                                </div>
                                                <p className="text-[11px] text-slate-400 leading-relaxed">
                                                    Apply a single pattern directly to all selected personnel (e.g. Mon–Fri 9-5).
                                                </p>
                                            </div>
                                        </div>

                                        {/* Option D: Blank Roster Shell */}
                                        <div
                                            onClick={() => newRosterForm.setData('generation_mode', 'blank')}
                                            className={`p-3.5 rounded-xl border cursor-pointer transition flex flex-col justify-between ${
                                                newRosterForm.data.generation_mode === 'blank'
                                                    ? 'bg-indigo-600/20 border-indigo-500 ring-1 ring-indigo-500'
                                                    : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                                            }`}
                                        >
                                            <div>
                                                <div className="flex items-center justify-between mb-1.5">
                                                    <div className="flex items-center gap-2">
                                                        <CalendarDays className="w-4 h-4 text-amber-400" />
                                                        <span className="font-bold text-xs text-white">Blank Shell</span>
                                                    </div>
                                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20 uppercase">
                                                        Manual
                                                    </span>
                                                </div>
                                                <p className="text-[11px] text-slate-400 leading-relaxed">
                                                    Create an empty roster canvas to schedule ad-hoc or add squads later.
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Strategy 1 Configuration: Option B (Auto-Stagger Multi-Squad) */}
                                    {newRosterForm.data.generation_mode === 'auto_stagger_squads' && (
                                        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-4">
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                                <div>
                                                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                                                        Master Base Pattern *
                                                    </label>
                                                    <select
                                                        value={newRosterForm.data.base_pattern_id}
                                                        onChange={(e) => {
                                                            const pId = e.target.value;
                                                            newRosterForm.setData({
                                                                ...newRosterForm.data,
                                                                base_pattern_id: pId,
                                                            });
                                                        }}
                                                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                                                    >
                                                        {patterns.map((p) => (
                                                            <option key={p.id} value={p.id}>
                                                                {p.name} ({p.cycle_length_days}d cycle)
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>

                                                <div>
                                                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                                                        Number of Squads
                                                    </label>
                                                    <input
                                                        type="number"
                                                        min={2}
                                                        max={8}
                                                        value={newRosterForm.data.squad_count}
                                                        onChange={(e) => {
                                                            const c = Math.max(2, Math.min(8, parseInt(e.target.value) || 2));
                                                            newRosterForm.setData({
                                                                ...newRosterForm.data,
                                                                squad_count: c,
                                                                squads: buildAutoStaggerSquads(c, newRosterForm.data.stagger_days || 2),
                                                            });
                                                        }}
                                                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:ring-1 focus:ring-indigo-500"
                                                    />
                                                </div>

                                                <div>
                                                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                                                        Stagger Interval (Days)
                                                    </label>
                                                    <input
                                                        type="number"
                                                        min={1}
                                                        max={14}
                                                        value={newRosterForm.data.stagger_days}
                                                        onChange={(e) => {
                                                            const st = Math.max(1, parseInt(e.target.value) || 1);
                                                            newRosterForm.setData({
                                                                ...newRosterForm.data,
                                                                stagger_days: st,
                                                                squads: buildAutoStaggerSquads(newRosterForm.data.squad_count || 4, st),
                                                            });
                                                        }}
                                                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:ring-1 focus:ring-indigo-500"
                                                    />
                                                </div>
                                            </div>

                                            {/* Shift Timings & Duration Inspector */}
                                            {basePatternShifts.length > 0 && (
                                                <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800/80 space-y-2">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-[11px] font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                                                            <Clock className="w-3.5 h-3.5 text-indigo-400" />
                                                            <span>Shift Timings &amp; Durations in Cycle</span>
                                                        </span>
                                                        <span className="text-[10px] text-slate-400 font-mono">
                                                            Cycle Length: {basePatternSteps.length} Days
                                                        </span>
                                                    </div>
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                                                        {basePatternShifts.map((s) => {
                                                            const [h1, m1] = s.start_time.split(':').map(Number);
                                                            const [h2, m2] = s.end_time.split(':').map(Number);
                                                            let dur = (h2 * 60 + m2 - (h1 * 60 + m1)) / 60;
                                                            if (dur < 0) dur += 24;

                                                            return (
                                                                <div
                                                                    key={s.id}
                                                                    className="bg-slate-950/80 p-2 rounded-lg border border-slate-800 text-xs flex items-center justify-between"
                                                                >
                                                                    <div className="flex items-center gap-2">
                                                                        <span
                                                                            className="w-2.5 h-2.5 rounded-full shrink-0"
                                                                            style={{ backgroundColor: s.color || '#3b82f6' }}
                                                                        />
                                                                        <div>
                                                                            <div className="font-bold text-white text-[11px]">{s.name} ({s.code})</div>
                                                                            <div className="text-[10px] text-slate-400 font-mono">{s.start_time.slice(0, 5)} &rarr; {s.end_time.slice(0, 5)}</div>
                                                                        </div>
                                                                    </div>
                                                                    <span className="text-[10px] font-bold font-mono text-indigo-300 bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/20">
                                                                        {dur.toFixed(1)}h
                                                                    </span>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Live Rotated Squads Preview Cards */}
                                            <div className="space-y-2">
                                                <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                                                    Live Rotated Squad Rotation Phases (Daily Coverage Guarantee)
                                                </span>
                                                <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                                                    {autoStaggerPreviews.map((sq) => (
                                                        <div
                                                            key={sq.letter}
                                                            className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                                                        >
                                                            <div className="flex items-center gap-2 shrink-0">
                                                                <span
                                                                    className="w-2.5 h-2.5 rounded-full"
                                                                    style={{ backgroundColor: sq.color }}
                                                                />
                                                                <span className="font-bold text-xs text-white">{sq.name}</span>
                                                                <span className="text-[10px] text-slate-400 font-mono">(Offset: +{sq.offset}d)</span>
                                                            </div>
                                                            <div className="flex flex-wrap items-center gap-1">
                                                                {sq.chips.map((c, cIdx) => (
                                                                    <span
                                                                        key={cIdx}
                                                                        className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border ${
                                                                            c.isRest
                                                                                ? 'bg-slate-950 text-slate-500 border-slate-800'
                                                                                : 'bg-indigo-600/20 text-indigo-200 border-indigo-500/30'
                                                                        }`}
                                                                        style={c.color && !c.isRest ? { borderColor: `${c.color}66`, color: c.color } : {}}
                                                                        title={`Day ${cIdx + 1}: ${c.label} (${c.startTime || ''} - ${c.endTime || ''})`}
                                                                    >
                                                                        {c.label}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Strategy 2 Configuration: Option A (Multi-Pattern Squad Sets) */}
                                    {newRosterForm.data.generation_mode === 'multi_pattern' && (
                                        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                                            <div className="flex items-center justify-between">
                                                <label className="text-xs font-semibold text-slate-300">
                                                    Configure Squads &amp; Rotation Patterns
                                                </label>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const count = newRosterForm.data.squads.length;
                                                        const letter = String.fromCharCode(65 + count);
                                                        const next = [
                                                            ...newRosterForm.data.squads,
                                                            {
                                                                name: `Squad ${letter}`,
                                                                code: `SQD-${letter}`,
                                                                color: defaultSquadColors[count % defaultSquadColors.length],
                                                                pattern_id: patterns[0]?.id || '',
                                                                employee_ids: [],
                                                            },
                                                        ];
                                                        newRosterForm.setData('squads', next);
                                                    }}
                                                    className="px-2.5 py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 text-[11px] font-semibold flex items-center gap-1 border border-indigo-500/30 transition"
                                                >
                                                    <Plus className="w-3 h-3" />
                                                    <span>Add Squad</span>
                                                </button>
                                            </div>

                                            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                                                {newRosterForm.data.squads.map((sq, idx) => (
                                                    <div
                                                        key={idx}
                                                        className="bg-slate-900 p-2.5 rounded-xl border border-slate-800 grid grid-cols-1 sm:grid-cols-12 gap-2 items-center"
                                                    >
                                                        <div className="sm:col-span-4 flex items-center gap-2">
                                                            <input
                                                                type="color"
                                                                value={sq.color}
                                                                onChange={(e) => {
                                                                    const updated = [...newRosterForm.data.squads];
                                                                    updated[idx].color = e.target.value;
                                                                    newRosterForm.setData('squads', updated);
                                                                }}
                                                                className="w-6 h-6 rounded border border-slate-700 bg-transparent cursor-pointer"
                                                            />
                                                            <input
                                                                type="text"
                                                                value={sq.name}
                                                                onChange={(e) => {
                                                                    const updated = [...newRosterForm.data.squads];
                                                                    updated[idx].name = e.target.value;
                                                                    newRosterForm.setData('squads', updated);
                                                                }}
                                                                placeholder="Squad Name"
                                                                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-white"
                                                            />
                                                        </div>

                                                        <div className="sm:col-span-7">
                                                            <select
                                                                value={sq.pattern_id || ''}
                                                                onChange={(e) => {
                                                                    const updated = [...newRosterForm.data.squads];
                                                                    updated[idx].pattern_id = e.target.value;
                                                                    newRosterForm.setData('squads', updated);
                                                                }}
                                                                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-white"
                                                            >
                                                                {patterns.map((p) => (
                                                                    <option key={p.id} value={p.id}>
                                                                        {p.name} ({p.pattern_type.toUpperCase()}, {p.cycle_length_days}d)
                                                                    </option>
                                                                ))}
                                                            </select>
                                                        </div>

                                                        <div className="sm:col-span-1 text-right">
                                                            {newRosterForm.data.squads.length > 1 && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        const updated = newRosterForm.data.squads.filter((_, i) => i !== idx);
                                                                        newRosterForm.setData('squads', updated);
                                                                    }}
                                                                    className="p-1 text-slate-400 hover:text-rose-400 transition"
                                                                    title="Remove squad"
                                                                >
                                                                    <Trash2 className="w-3.5 h-3.5" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Strategy 3 Configuration: Option C (Single Direct Pattern) */}
                                    {newRosterForm.data.generation_mode === 'direct_pattern' && (
                                        <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                                            <label className="block text-xs font-semibold text-slate-300">
                                                Select Roster Pattern to Broadcast *
                                            </label>
                                            <select
                                                value={newRosterForm.data.pattern_id}
                                                onChange={(e) => newRosterForm.setData('pattern_id', e.target.value)}
                                                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                                            >
                                                {patterns.map((p) => (
                                                    <option key={p.id} value={p.id}>
                                                        {p.name} ({p.pattern_type.toUpperCase()}, {p.cycle_length_days}d cycle)
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    )}

                                    {/* Strategy 4 Configuration: Option D (Blank Shell) */}
                                    {newRosterForm.data.generation_mode === 'blank' && (
                                        <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 text-xs text-slate-400">
                                            A blank roster container will be initialized without predefined squads. You can build schedules manually or attach squads later.
                                        </div>
                                    )}

                                    <div className="pt-3 flex items-center justify-between border-t border-slate-800">
                                        <button
                                            type="button"
                                            onClick={() => setRosterWizardStep(1)}
                                            className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white flex items-center gap-1 transition"
                                        >
                                            <ChevronLeft className="w-3.5 h-3.5" />
                                            <span>Back</span>
                                        </button>

                                        {newRosterForm.data.generation_mode !== 'blank' ? (
                                            <button
                                                type="button"
                                                onClick={() => setRosterWizardStep(3)}
                                                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-md transition flex items-center gap-1.5"
                                            >
                                                <span>Next: Allocate Personnel</span>
                                                <ChevronRight className="w-3.5 h-3.5" />
                                            </button>
                                        ) : (
                                            <button
                                                type="submit"
                                                disabled={newRosterForm.processing}
                                                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-md transition disabled:opacity-50"
                                            >
                                                {newRosterForm.processing ? 'Creating Roster...' : 'Create Roster Now'}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* STEP 3: Squad & Personnel Allocation */}
                            {rosterWizardStep === 3 && (
                                <div className="space-y-4">
                                    {newRosterForm.data.generation_mode === 'direct_pattern' ? (
                                        // Direct Pattern Flat Selection
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs text-slate-300 font-semibold">
                                                    Select staff members to receive this pattern:
                                                </span>
                                                <span className="text-xs text-indigo-400 font-mono font-bold">
                                                    {newRosterForm.data.employee_ids.length} Selected
                                                </span>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <div className="relative flex-1">
                                                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                                                    <input
                                                        type="text"
                                                        value={wizardEmpSearch}
                                                        onChange={(e) => setWizardEmpSearch(e.target.value)}
                                                        placeholder="Search staff..."
                                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-2.5 py-1.5 text-xs text-white placeholder-slate-500"
                                                    />
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const allIds = wizardEmployeePool.map((e) => e.id);
                                                        newRosterForm.setData('employee_ids', allIds);
                                                    }}
                                                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-indigo-300 text-xs font-semibold transition"
                                                >
                                                    Select All
                                                </button>
                                            </div>

                                            <div className="bg-slate-950 rounded-xl border border-slate-800 h-[280px] lg:h-[320px] overflow-y-auto divide-y divide-slate-900 p-1">
                                                {wizardEmployeePool
                                                    .filter((emp) => {
                                                        const matchesSearch =
                                                            emp.full_name.toLowerCase().includes(wizardEmpSearch.toLowerCase()) ||
                                                            emp.emp_no.toLowerCase().includes(wizardEmpSearch.toLowerCase());
                                                        const matchesDept = wizardDeptFilter === 'all' || emp.department_id === wizardDeptFilter;
                                                        return matchesSearch && matchesDept;
                                                    })
                                                    .map((emp) => {
                                                        const isSelected = newRosterForm.data.employee_ids.includes(emp.id);
                                                        return (
                                                            <div
                                                                key={emp.id}
                                                                onClick={() => {
                                                                    const next = isSelected
                                                                        ? newRosterForm.data.employee_ids.filter((id) => id !== emp.id)
                                                                        : [...newRosterForm.data.employee_ids, emp.id];
                                                                    newRosterForm.setData('employee_ids', next);
                                                                }}
                                                                className={`p-2 rounded-lg flex items-center justify-between cursor-pointer transition ${
                                                                    isSelected ? 'bg-indigo-600/15' : 'hover:bg-slate-900/60'
                                                                }`}
                                                            >
                                                                <div className="flex items-center gap-2">
                                                                    <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                                                                        isSelected ? 'bg-indigo-600 border-indigo-500 text-white' : 'border-slate-700 bg-slate-900'
                                                                    }`}>
                                                                        {isSelected && <Check className="w-3 h-3" />}
                                                                    </div>
                                                                    <span className="font-semibold text-xs text-white">{emp.full_name} ({emp.emp_no})</span>
                                                                </div>
                                                                <span className="text-[10px] text-slate-400 font-mono">{emp.department_name}</span>
                                                            </div>
                                                        );
                                                    })}
                                            </div>
                                        </div>
                                    ) : (
                                        // Multi-Squad Allocation (Option B & Option A)
                                        <div className="space-y-3">
                                            {/* Pre-Defined Squad Loader Dropdown */}
                                            {squads.length > 0 && (
                                                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-xs">
                                                    <span className="text-slate-300 font-semibold flex items-center gap-1.5 shrink-0">
                                                        <Users className="w-3.5 h-3.5 text-indigo-400" />
                                                        <span>Load from Existing Squad:</span>
                                                    </span>
                                                    <select
                                                        onChange={(e) => {
                                                            const targetSquadId = e.target.value;
                                                            if (!targetSquadId) return;
                                                            const srcSquad = squads.find((s) => s.id === targetSquadId);
                                                            if (srcSquad && srcSquad.employees) {
                                                                const empIds = srcSquad.employees.map((em) => em.id);
                                                                const currentSquads = [...newRosterForm.data.squads];
                                                                // Exclusivity: remove imported employees from all other squads
                                                                currentSquads.forEach((sq, sIdx) => {
                                                                    if (sIdx !== activeSquadTabIndex) {
                                                                        sq.employee_ids = sq.employee_ids.filter((id) => !empIds.includes(id));
                                                                    }
                                                                });
                                                                currentSquads[activeSquadTabIndex].employee_ids = empIds;
                                                                newRosterForm.setData('squads', currentSquads);
                                                            }
                                                            e.target.value = '';
                                                        }}
                                                        className="bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 w-full sm:w-auto sm:min-w-[280px] focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                                                    >
                                                        <option value="">-- Choose Squad to Import Members --</option>
                                                        {squads.map((sq) => (
                                                            <option key={sq.id} value={sq.id}>
                                                                {sq.name} ({sq.employees?.length || 0} members)
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>
                                            )}

                                            {/* Squad Tabs Bar & Distribute Evenly Action */}
                                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                                                <div className="flex flex-wrap items-center gap-1.5">
                                                    {newRosterForm.data.squads.map((sq, sIdx) => {
                                                        const count = sq.employee_ids.length;
                                                        const isActive = activeSquadTabIndex === sIdx;
                                                        return (
                                                            <button
                                                                key={sIdx}
                                                                type="button"
                                                                onClick={() => setActiveSquadTabIndex(sIdx)}
                                                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                                                                    isActive
                                                                        ? 'bg-indigo-600 text-white shadow-md'
                                                                        : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                                                                }`}
                                                            >
                                                                <span
                                                                    className="w-2 h-2 rounded-full"
                                                                    style={{ backgroundColor: sq.color }}
                                                                />
                                                                <span>{sq.name}</span>
                                                                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/40 font-mono">
                                                                    {count}
                                                                </span>
                                                            </button>
                                                        );
                                                    })}
                                                </div>

                                                <button
                                                    type="button"
                                                    onClick={handleDistributeEvenly}
                                                    className="px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-semibold flex items-center gap-1.5 transition shadow-sm"
                                                    title="Automatically divide available staff equally across all squads"
                                                >
                                                    <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                                                    <span>⚡ Distribute Evenly</span>
                                                </button>
                                            </div>

                                            {/* Search & Dept Filter */}
                                            <div className="flex items-center gap-2">
                                                <div className="relative flex-1">
                                                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                                                    <input
                                                        type="text"
                                                        value={wizardEmpSearch}
                                                        onChange={(e) => setWizardEmpSearch(e.target.value)}
                                                        placeholder="Search personnel to assign..."
                                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-2.5 py-1.5 text-xs text-white placeholder-slate-500"
                                                    />
                                                </div>
                                                <select
                                                    value={wizardDeptFilter}
                                                    onChange={(e) => setWizardDeptFilter(e.target.value)}
                                                    className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-300"
                                                >
                                                    <option value="all">All Departments</option>
                                                    {departments.map((d) => (
                                                        <option key={d.id} value={d.id}>{d.name}</option>
                                                    ))}
                                                </select>
                                            </div>

                                            {/* Staff Allocation Checkbox List */}
                                            <div className="bg-slate-950 rounded-xl border border-slate-800 h-[280px] lg:h-[320px] overflow-y-auto divide-y divide-slate-900 p-1">
                                                {wizardEmployeePool
                                                    .filter((emp) => {
                                                        const matchesSearch =
                                                            emp.full_name.toLowerCase().includes(wizardEmpSearch.toLowerCase()) ||
                                                            emp.emp_no.toLowerCase().includes(wizardEmpSearch.toLowerCase());
                                                        const matchesDept = wizardDeptFilter === 'all' || emp.department_id === wizardDeptFilter;
                                                        return matchesSearch && matchesDept;
                                                    })
                                                    .map((emp) => {
                                                        const activeSquad = newRosterForm.data.squads[activeSquadTabIndex];
                                                        const isAssignedToActive = activeSquad?.employee_ids.includes(emp.id);
                                                        const assignedOtherSquad = newRosterForm.data.squads.find(
                                                            (s, idx) => idx !== activeSquadTabIndex && s.employee_ids.includes(emp.id)
                                                        );
                                                        const availInfo = available_employees.find((a) => a.id === emp.id);
                                                        const hasOverlapConflict = availInfo && !availInfo.is_available;

                                                        return (
                                                            <div
                                                                key={emp.id}
                                                                onClick={() => handleToggleEmployeeInSquad(activeSquadTabIndex, emp.id)}
                                                                className={`p-2.5 rounded-lg flex items-center justify-between cursor-pointer transition ${
                                                                    isAssignedToActive
                                                                        ? 'bg-indigo-600/20 border border-indigo-500/30'
                                                                        : assignedOtherSquad
                                                                        ? 'opacity-60 hover:bg-slate-900/60'
                                                                        : 'hover:bg-slate-900/60'
                                                                }`}
                                                            >
                                                                <div className="flex items-center gap-2.5">
                                                                    <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                                                                        isAssignedToActive
                                                                            ? 'bg-indigo-600 border-indigo-500 text-white'
                                                                            : 'border-slate-700 bg-slate-900'
                                                                    }`}>
                                                                        {isAssignedToActive && <Check className="w-3 h-3" />}
                                                                    </div>
                                                                    <div>
                                                                        <span className="font-bold text-xs text-white block">
                                                                            {emp.full_name}
                                                                        </span>
                                                                        <span className="text-[10px] text-slate-400 font-mono">
                                                                            {emp.emp_no} &bull; {emp.department_name}
                                                                        </span>
                                                                    </div>
                                                                </div>

                                                                <div>
                                                                    {isAssignedToActive ? (
                                                                        <span
                                                                            className="text-[10px] font-bold px-2 py-0.5 rounded text-white font-mono"
                                                                            style={{ backgroundColor: activeSquad?.color || '#3b82f6' }}
                                                                        >
                                                                            In {activeSquad?.name}
                                                                        </span>
                                                                    ) : assignedOtherSquad ? (
                                                                        <span
                                                                            className="text-[10px] font-medium px-2 py-0.5 rounded text-slate-300 font-mono border border-slate-700 bg-slate-900"
                                                                        >
                                                                            In {assignedOtherSquad.name}
                                                                        </span>
                                                                    ) : hasOverlapConflict ? (
                                                                        <span className="text-[10px] text-amber-400 font-mono px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
                                                                            {availInfo?.exclusion_reason || 'Roster Overlap'}
                                                                        </span>
                                                                    ) : (
                                                                        <span className="text-[10px] text-slate-500 font-mono">
                                                                            Available
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                            </div>
                                        </div>
                                    )}

                                    <div className="pt-3 flex items-center justify-between border-t border-slate-800">
                                        <button
                                            type="button"
                                            onClick={() => setRosterWizardStep(2)}
                                            className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white flex items-center gap-1 transition"
                                        >
                                            <ChevronLeft className="w-3.5 h-3.5" />
                                            <span>Back</span>
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={
                                                newRosterForm.processing ||
                                                (newRosterForm.data.generation_mode === 'direct_pattern'
                                                    ? newRosterForm.data.employee_ids.length === 0
                                                    : newRosterForm.data.squads.reduce((acc, s) => acc + s.employee_ids.length, 0) === 0)
                                            }
                                            className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-md transition disabled:opacity-40"
                                        >
                                            {newRosterForm.processing
                                                ? 'Generating Operational Roster...'
                                                : `Create & Generate Roster`}
                                        </button>
                                    </div>
                                </div>
                            )}
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

            {/* MODAL 5: Manage Squad Members & Mid-Month Transfers */}
            {isManageMembersModalOpen && targetSquadForEnroll && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6 bg-black/80 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl md:max-w-2xl lg:max-w-3xl w-full p-5 md:p-6 space-y-4 shadow-2xl relative max-h-[90vh] overflow-y-auto">
                        <button
                            type="button"
                            onClick={() => setIsManageMembersModalOpen(false)}
                            className="absolute top-5 right-5 text-slate-400 hover:text-white transition"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <div className="flex items-center gap-2.5">
                            <span
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: targetSquadForEnroll.color || '#3b82f6' }}
                            />
                            <div>
                                <h3 className="text-base font-bold text-white">
                                    Manage Members &bull; {targetSquadForEnroll.name}
                                </h3>
                                <p className="text-xs text-slate-400">
                                    {targetSquadForEnroll.pattern
                                        ? `Pattern: ${targetSquadForEnroll.pattern.name} (${targetSquadForEnroll.pattern.cycle_length_days}d cycle)`
                                        : 'Manual Assignment'}
                                </p>
                            </div>
                        </div>

                        {/* Tabs */}
                        <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                            <button
                                type="button"
                                onClick={() => setManageMembersTab('current')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                                    manageMembersTab === 'current'
                                        ? 'bg-indigo-600 text-white shadow-sm'
                                        : 'text-slate-400 hover:text-white'
                                }`}
                            >
                                Enrolled Personnel ({targetSquadForEnroll.employees?.length || 0})
                            </button>
                            <button
                                type="button"
                                onClick={() => setManageMembersTab('add')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                                    manageMembersTab === 'add'
                                        ? 'bg-indigo-600 text-white shadow-sm'
                                        : 'text-slate-400 hover:text-white'
                                }`}
                            >
                                + Enroll / Transfer Staff
                            </button>
                        </div>

                        {/* TAB 1: Current Members */}
                        {manageMembersTab === 'current' && (
                            <div className="space-y-3">
                                <div className="bg-slate-950 rounded-xl border border-slate-800 divide-y divide-slate-900 max-h-72 overflow-y-auto">
                                    {(targetSquadForEnroll.employees || []).map((emp) => (
                                        <div
                                            key={emp.id}
                                            className="p-3 flex items-center justify-between hover:bg-slate-900/50 transition"
                                        >
                                            <div>
                                                <span className="font-semibold text-xs text-white block">
                                                    {emp.full_name}
                                                </span>
                                                <span className="text-[10px] text-slate-400 font-mono">
                                                    {emp.emp_no} &bull; {emp.department?.name || 'General'}
                                                </span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveMember(targetSquadForEnroll.id, emp.id, emp.full_name)}
                                                className="px-2 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[11px] font-medium flex items-center gap-1 transition"
                                                title="Remove or end squad assignment"
                                            >
                                                <UserMinus className="w-3.5 h-3.5 text-rose-400" />
                                                <span>Remove / End</span>
                                            </button>
                                        </div>
                                    ))}
                                    {(!targetSquadForEnroll.employees || targetSquadForEnroll.employees.length === 0) && (
                                        <div className="p-6 text-center text-xs text-slate-500">
                                            No personnel currently enrolled in this squad. Click "+ Enroll / Transfer Staff" to add members.
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* TAB 2: Enroll / Transfer Staff */}
                        {manageMembersTab === 'add' && (
                            <div className="space-y-3.5">
                                {/* Effective Date Setting */}
                                <div className="bg-slate-950 p-3 rounded-xl border border-indigo-500/30 space-y-1">
                                    <label className="block text-xs font-semibold text-indigo-300">
                                        Effective Assignment / Transfer Date *
                                    </label>
                                    <input
                                        type="date"
                                        value={enrollEffectiveDate}
                                        onChange={(e) => setEnrollEffectiveDate(e.target.value)}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:ring-1 focus:ring-indigo-500"
                                    />
                                    <p className="text-[10px] text-slate-400">
                                        For mid-month transfers or new joiners, pick the exact start date. Prior worked shifts before this date remain 100% preserved.
                                    </p>
                                </div>

                                {/* Filters */}
                                <div className="flex items-center gap-2">
                                    <div className="relative flex-1">
                                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                                        <input
                                            type="text"
                                            value={memberSearchQuery}
                                            onChange={(e) => setMemberSearchQuery(e.target.value)}
                                            placeholder="Search staff by name or emp no..."
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-2.5 py-1.5 text-xs text-white placeholder-slate-500"
                                        />
                                    </div>
                                    <select
                                        value={memberDeptFilter}
                                        onChange={(e) => setMemberDeptFilter(e.target.value)}
                                        className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-300"
                                    >
                                        <option value="all">All Departments</option>
                                        {departments.map((d) => (
                                            <option key={d.id} value={d.id}>{d.name}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Employee Pool */}
                                <div className="bg-slate-950 rounded-xl border border-slate-800 max-h-56 overflow-y-auto divide-y divide-slate-900 p-1">
                                    {available_employees
                                        .filter((emp) => {
                                            const matchesSearch =
                                                emp.full_name.toLowerCase().includes(memberSearchQuery.toLowerCase()) ||
                                                emp.emp_no.toLowerCase().includes(memberSearchQuery.toLowerCase());
                                            const matchesDept =
                                                memberDeptFilter === 'all' ||
                                                emp.department_id === memberDeptFilter ||
                                                emp.department_name === memberDeptFilter;
                                            return matchesSearch && matchesDept;
                                        })
                                        .map((emp) => {
                                            const isSelected = selectedEnrollEmpIds.includes(emp.id);
                                            const isAlreadyInThisSquad = targetSquadForEnroll.employees?.some((e) => e.id === emp.id);

                                            if (isAlreadyInThisSquad) {
                                                return (
                                                    <div key={emp.id} className="p-2.5 flex items-center justify-between opacity-50 bg-slate-900/30">
                                                        <div>
                                                            <span className="font-semibold text-xs text-slate-300 block">{emp.full_name}</span>
                                                            <span className="text-[10px] text-slate-500 font-mono">Already in this squad</span>
                                                        </div>
                                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400">Enrolled</span>
                                                    </div>
                                                );
                                            }

                                            if (emp.current_squad) {
                                                return (
                                                    <div key={emp.id} className="p-2.5 flex items-center justify-between hover:bg-slate-900/60 transition">
                                                        <div>
                                                            <span className="font-semibold text-xs text-white block">{emp.full_name}</span>
                                                            <span className="text-[10px] text-amber-400 font-mono">
                                                                Currently in {emp.current_squad.name} ({emp.current_roster?.name})
                                                            </span>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleTransferMember(emp.id, emp.full_name)}
                                                            className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-[11px] font-semibold flex items-center gap-1 transition shadow-sm"
                                                        >
                                                            <span>Transfer &rarr; {enrollEffectiveDate || 'Date'}</span>
                                                        </button>
                                                    </div>
                                                );
                                            }

                                            return (
                                                <div
                                                    key={emp.id}
                                                    onClick={() => {
                                                        const next = isSelected
                                                            ? selectedEnrollEmpIds.filter((id) => id !== emp.id)
                                                            : [...selectedEnrollEmpIds, emp.id];
                                                        setSelectedEnrollEmpIds(next);
                                                    }}
                                                    className={`p-2.5 rounded-lg flex items-center justify-between cursor-pointer transition ${
                                                        isSelected ? 'bg-indigo-600/20 border border-indigo-500/30' : 'hover:bg-slate-900/60'
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-2.5">
                                                        <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                                                            isSelected ? 'bg-indigo-600 border-indigo-500 text-white' : 'border-slate-700 bg-slate-900'
                                                        }`}>
                                                            {isSelected && <Check className="w-3 h-3" />}
                                                        </div>
                                                        <div>
                                                            <span className="font-bold text-xs text-white block">{emp.full_name}</span>
                                                            <span className="text-[10px] text-slate-400 font-mono">{emp.emp_no} &bull; {emp.department_name}</span>
                                                        </div>
                                                    </div>
                                                    <span className="text-[10px] text-slate-400 font-mono">Available</span>
                                                </div>
                                            );
                                        })}
                                </div>

                                <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-800">
                                    <button
                                        type="button"
                                        onClick={() => setIsManageMembersModalOpen(false)}
                                        className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white"
                                    >
                                        Close
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleEnrollSubmit}
                                        disabled={selectedEnrollEmpIds.length === 0}
                                        className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-md transition disabled:opacity-40"
                                    >
                                        Enroll Selected ({selectedEnrollEmpIds.length})
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* MODAL 6: Create New Squad */}
            {isNewSquadModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6 bg-black/80 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg md:max-w-3xl lg:max-w-4xl xl:max-w-5xl 2xl:max-w-6xl p-5 md:p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto flex flex-col">
                        <button
                            type="button"
                            onClick={() => setIsNewSquadModalOpen(false)}
                            className="absolute top-5 right-5 text-slate-400 hover:text-white transition"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <div className="mb-4">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                                Team Group Management
                            </span>
                            <h3 className="text-base md:text-lg font-bold text-white mt-1">
                                {active_roster ? `Add Squad to ${active_roster.name}` : 'Create Permanent Squad / Crew'}
                            </h3>
                            <p className="text-xs text-slate-400">
                                {active_roster
                                    ? 'Create a rotating workforce squad for this active roster, link its rotation pattern, and enroll members.'
                                    : 'Create a permanent organizational squad / crew. You can import this squad when generating future monthly rosters.'}
                            </p>
                        </div>

                        <form onSubmit={handleNewSquadSubmit} className="space-y-4">
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6">
                                {/* Left Column: Squad Configuration */}
                                <div className="lg:col-span-5 space-y-3.5 flex flex-col justify-between">
                                    <div className="space-y-3.5">
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-xs font-semibold text-slate-300 mb-1">
                                                    Squad Name *
                                                </label>
                                                <input
                                                    type="text"
                                                    required
                                                    value={newSquadForm.data.name}
                                                    onChange={(e) => newSquadForm.setData('name', e.target.value)}
                                                    placeholder="e.g. Group Alpha / Morning"
                                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:ring-1 focus:ring-indigo-500"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-semibold text-slate-300 mb-1">
                                                    Squad Code
                                                </label>
                                                <input
                                                    type="text"
                                                    value={newSquadForm.data.code}
                                                    onChange={(e) => newSquadForm.setData('code', e.target.value)}
                                                    placeholder="e.g. SQD-A"
                                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono uppercase focus:ring-1 focus:ring-indigo-500"
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-semibold text-slate-300 mb-1">
                                                Squad Color Badge
                                            </label>
                                            <div className="flex items-center gap-2">
                                                {['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'].map((color) => (
                                                    <button
                                                        key={color}
                                                        type="button"
                                                        onClick={() => newSquadForm.setData('color', color)}
                                                        className={`w-6 h-6 rounded-full border-2 transition ${
                                                            newSquadForm.data.color === color ? 'border-white scale-110' : 'border-transparent opacity-60 hover:opacity-100'
                                                        }`}
                                                        style={{ backgroundColor: color }}
                                                    />
                                                ))}
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-semibold text-slate-300 mb-1">
                                                Assigned Rotation Pattern
                                            </label>
                                            <select
                                                value={newSquadForm.data.roster_pattern_id}
                                                onChange={(e) => newSquadForm.setData('roster_pattern_id', e.target.value)}
                                                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                                            >
                                                <option value="">-- No Rotation Pattern (Manual Assign) --</option>
                                                {patterns.map((p) => (
                                                    <option key={p.id} value={p.id}>
                                                        {p.name} ({p.cycle_length_days}d cycle)
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* Live Shift Pattern Chips Preview */}
                                        {selectedSquadPattern && squadPatternSteps.length > 0 && (
                                            <div className="bg-slate-950 p-2.5 rounded-xl border border-indigo-500/20 space-y-1.5">
                                                <div className="flex items-center justify-between text-[11px]">
                                                    <span className="font-semibold text-indigo-300 flex items-center gap-1">
                                                        <Clock className="w-3.5 h-3.5" />
                                                        <span>Rotation Sequence Preview:</span>
                                                    </span>
                                                    <span className="text-slate-400 font-mono text-[10px]">
                                                        {squadPatternSteps.length} Days Cycle
                                                    </span>
                                                </div>
                                                <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto pr-1">
                                                    {squadPatternSteps.map((st: any, sIdx: number) => {
                                                        const shift = shifts.find((s) => s.id === st.shift_id);
                                                        const isRest = Boolean(st.is_rest_day);
                                                        return (
                                                            <span
                                                                key={sIdx}
                                                                className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                                                                    isRest
                                                                        ? 'bg-slate-800 text-slate-400 border border-slate-700'
                                                                        : 'text-white border'
                                                                }`}
                                                                style={{
                                                                    backgroundColor: isRest ? undefined : (shift?.color ? `${shift.color}33` : '#3b82f633'),
                                                                    borderColor: isRest ? undefined : (shift?.color || '#3b82f6'),
                                                                    color: isRest ? undefined : (shift?.color || '#93c5fd'),
                                                                }}
                                                            >
                                                                {isRest ? 'OFF' : shift?.code || `D${sIdx + 1}`}
                                                            </span>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}

                                        <div>
                                            <label className="block text-xs font-semibold text-slate-300 mb-1">
                                                Description / Responsibilities
                                            </label>
                                            <textarea
                                                rows={2}
                                                value={newSquadForm.data.description}
                                                onChange={(e) => newSquadForm.setData('description', e.target.value)}
                                                placeholder="Operational notes, primary tasks..."
                                                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 resize-none focus:ring-1 focus:ring-indigo-500"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Right Column: Member Enrollment */}
                                <div className="lg:col-span-7 flex flex-col space-y-2">
                                    <div className="flex items-center justify-between mb-0.5">
                                        <label className="block text-xs font-semibold text-slate-300">
                                            Enroll Members ({newSquadForm.data.employee_ids.length} Selected)
                                        </label>
                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={handleSelectAllSquadAvailable}
                                                className="text-[10px] text-indigo-400 hover:text-indigo-300 font-semibold transition"
                                            >
                                                Select All Available
                                            </button>
                                            <span className="text-slate-600">&bull;</span>
                                            <button
                                                type="button"
                                                onClick={handleDeselectAllSquad}
                                                className="text-[10px] text-slate-400 hover:text-slate-300 transition"
                                            >
                                                Clear
                                            </button>
                                        </div>
                                    </div>

                                    {/* Search & Dept Filter */}
                                    <div className="flex items-center gap-2">
                                        <div className="relative flex-1">
                                            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                                            <input
                                                type="text"
                                                value={squadEmpSearch}
                                                onChange={(e) => setSquadEmpSearch(e.target.value)}
                                                placeholder="Search staff to enroll..."
                                                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-2.5 py-1.5 text-xs text-white placeholder-slate-500"
                                            />
                                        </div>
                                        <select
                                            value={squadDeptFilter}
                                            onChange={(e) => setSquadDeptFilter(e.target.value)}
                                            className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-300"
                                        >
                                            <option value="all">All Departments</option>
                                            {departments.map((d) => (
                                                <option key={d.id} value={d.id}>{d.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="bg-slate-950 rounded-xl border border-slate-800 h-[280px] lg:h-[320px] overflow-y-auto divide-y divide-slate-900 p-1">
                                        {available_employees
                                            .filter((emp) => {
                                                const matchesSearch =
                                                    emp.full_name.toLowerCase().includes(squadEmpSearch.toLowerCase()) ||
                                                    emp.emp_no.toLowerCase().includes(squadEmpSearch.toLowerCase());
                                                const matchesDept =
                                                    squadDeptFilter === 'all' ||
                                                    emp.department_id === squadDeptFilter ||
                                                    emp.department_name === squadDeptFilter;
                                                return matchesSearch && matchesDept;
                                            })
                                            .map((emp) => {
                                                const isSelected = newSquadForm.data.employee_ids.includes(emp.id);
                                                const isEnrolledElsewhere = emp.current_squad;
                                                const hasConflict = !emp.is_available;

                                                return (
                                                    <div
                                                        key={emp.id}
                                                        onClick={() => {
                                                            const next = isSelected
                                                                ? newSquadForm.data.employee_ids.filter((id) => id !== emp.id)
                                                                : [...newSquadForm.data.employee_ids, emp.id];
                                                            newSquadForm.setData('employee_ids', next);
                                                        }}
                                                        className={`p-2 rounded-lg flex items-center justify-between cursor-pointer transition ${
                                                            isSelected
                                                                ? 'bg-indigo-600/20 border border-indigo-500/30'
                                                                : 'hover:bg-slate-900/60'
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-2.5">
                                                            <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition ${
                                                                isSelected ? 'bg-indigo-600 border-indigo-500 text-white' : 'border-slate-700 bg-slate-900'
                                                            }`}>
                                                                {isSelected && <Check className="w-2.5 h-2.5" />}
                                                            </div>
                                                            <div>
                                                                <span className="font-semibold text-xs text-white block">
                                                                    {emp.full_name}
                                                                </span>
                                                                <span className="text-[10px] text-slate-400 font-mono">
                                                                    {emp.emp_no} &bull; {emp.department_name}
                                                                </span>
                                                            </div>
                                                        </div>

                                                        <div>
                                                            {isEnrolledElsewhere ? (
                                                                <span className="text-[10px] font-mono px-2 py-0.5 rounded text-amber-300 bg-amber-500/10 border border-amber-500/20">
                                                                    In {emp.current_squad?.name}
                                                                </span>
                                                            ) : hasConflict ? (
                                                                <span className="text-[10px] font-mono px-2 py-0.5 rounded text-rose-400 bg-rose-500/10 border border-rose-500/20">
                                                                    {emp.exclusion_reason || 'Roster Overlap'}
                                                                </span>
                                                            ) : (
                                                                <span className="text-[10px] text-emerald-400 font-mono px-1.5 py-0.5 rounded bg-emerald-500/10">
                                                                    Available
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                    </div>
                                </div>
                            </div>

                            <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-800">
                                <button
                                    type="button"
                                    onClick={() => setIsNewSquadModalOpen(false)}
                                    className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={newSquadForm.processing || !newSquadForm.data.name}
                                    className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-md transition disabled:opacity-50"
                                >
                                    {newSquadForm.processing ? 'Creating...' : 'Create Squad'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL 6b: Edit Squad & Member Allocation */}
            {isEditSquadModalOpen && editingSquad && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6 bg-black/80 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg md:max-w-3xl lg:max-w-4xl xl:max-w-5xl 2xl:max-w-6xl p-5 md:p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto flex flex-col">
                        <button
                            type="button"
                            onClick={() => {
                                setIsEditSquadModalOpen(false);
                                setEditingSquad(null);
                            }}
                            className="absolute top-5 right-5 text-slate-400 hover:text-white transition"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <div className="mb-4">
                            <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                                    Edit Squad Settings
                                </span>
                                {editingSquad.roster_id ? (
                                    <span className="text-[10px] text-slate-400 font-mono">
                                        Roster-Scoped
                                    </span>
                                ) : (
                                    <span className="text-[10px] text-purple-400 font-mono bg-purple-500/10 px-1.5 py-0.5 rounded border border-purple-500/20">
                                        Master Squad
                                    </span>
                                )}
                            </div>
                            <h3 className="text-base md:text-lg font-bold text-white mt-1">
                                {editingSquad.name}
                            </h3>
                            <p className="text-xs text-slate-400">
                                Update squad profile, assigned rotational pattern, and add or remove team members.
                            </p>
                        </div>

                        <form onSubmit={handleEditSquadSubmit} className="space-y-4">
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6">
                                {/* Left Column: Squad Configuration */}
                                <div className="lg:col-span-5 space-y-3.5 flex flex-col justify-between">
                                    <div className="space-y-3.5">
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-xs font-semibold text-slate-300 mb-1">
                                                    Squad Name *
                                                </label>
                                                <input
                                                    type="text"
                                                    required
                                                    value={editSquadForm.data.name}
                                                    onChange={(e) => editSquadForm.setData('name', e.target.value)}
                                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:ring-1 focus:ring-indigo-500"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-semibold text-slate-300 mb-1">
                                                    Squad Code
                                                </label>
                                                <input
                                                    type="text"
                                                    value={editSquadForm.data.code}
                                                    onChange={(e) => editSquadForm.setData('code', e.target.value)}
                                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono uppercase focus:ring-1 focus:ring-indigo-500"
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-semibold text-slate-300 mb-1">
                                                Squad Color Badge
                                            </label>
                                            <div className="flex items-center gap-2">
                                                {['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'].map((color) => (
                                                    <button
                                                        key={color}
                                                        type="button"
                                                        onClick={() => editSquadForm.setData('color', color)}
                                                        className={`w-6 h-6 rounded-full border-2 transition ${
                                                            editSquadForm.data.color === color ? 'border-white scale-110' : 'border-transparent opacity-60 hover:opacity-100'
                                                        }`}
                                                        style={{ backgroundColor: color }}
                                                    />
                                                ))}
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-semibold text-slate-300 mb-1">
                                                Assigned Rotation Pattern
                                            </label>
                                            <select
                                                value={editSquadForm.data.roster_pattern_id}
                                                onChange={(e) => editSquadForm.setData('roster_pattern_id', e.target.value)}
                                                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                                            >
                                                <option value="">-- No Rotation Pattern (Manual Assign) --</option>
                                                {patterns.map((p) => (
                                                    <option key={p.id} value={p.id}>
                                                        {p.name} ({p.cycle_length_days}d cycle)
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* Live Shift Pattern Chips Preview */}
                                        {selectedEditSquadPattern && editSquadPatternSteps.length > 0 && (
                                            <div className="bg-slate-950 p-2.5 rounded-xl border border-indigo-500/20 space-y-1.5">
                                                <div className="flex items-center justify-between text-[11px]">
                                                    <span className="font-semibold text-indigo-300 flex items-center gap-1">
                                                        <Clock className="w-3.5 h-3.5" />
                                                        <span>Pattern Cycle Preview:</span>
                                                    </span>
                                                    <span className="text-slate-400 font-mono text-[10px]">
                                                        {editSquadPatternSteps.length} Days Cycle
                                                    </span>
                                                </div>
                                                <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto pr-1">
                                                    {editSquadPatternSteps.map((st: any, sIdx: number) => {
                                                        const shift = shifts.find((s) => s.id === st.shift_id);
                                                        const isRest = Boolean(st.is_rest_day);
                                                        return (
                                                            <span
                                                                key={sIdx}
                                                                className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                                                                    isRest
                                                                        ? 'bg-slate-800 text-slate-400 border border-slate-700'
                                                                        : 'text-white border'
                                                                }`}
                                                                style={{
                                                                    backgroundColor: isRest ? undefined : (shift?.color ? `${shift.color}33` : '#3b82f633'),
                                                                    borderColor: isRest ? undefined : (shift?.color || '#3b82f6'),
                                                                    color: isRest ? undefined : (shift?.color || '#93c5fd'),
                                                                }}
                                                            >
                                                                {isRest ? 'OFF' : shift?.code || `D${sIdx + 1}`}
                                                            </span>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}

                                        <div>
                                            <label className="block text-xs font-semibold text-slate-300 mb-1">
                                                Description / Responsibilities
                                            </label>
                                            <textarea
                                                rows={2}
                                                value={editSquadForm.data.description}
                                                onChange={(e) => editSquadForm.setData('description', e.target.value)}
                                                placeholder="Operational notes, primary tasks..."
                                                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 resize-none focus:ring-1 focus:ring-indigo-500"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Right Column: Add / Remove Members Checklist */}
                                <div className="lg:col-span-7 flex flex-col space-y-2">
                                    <div className="flex items-center justify-between mb-0.5">
                                        <label className="block text-xs font-semibold text-slate-300">
                                            Squad Members ({editSquadForm.data.employee_ids.length} Enrolled)
                                        </label>
                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={handleSelectAllEditSquadAvailable}
                                                className="text-[10px] text-indigo-400 hover:text-indigo-300 font-semibold transition"
                                            >
                                                Select All Available
                                            </button>
                                            <span className="text-slate-600">&bull;</span>
                                            <button
                                                type="button"
                                                onClick={handleDeselectAllEditSquad}
                                                className="text-[10px] text-slate-400 hover:text-slate-300 transition"
                                            >
                                                Clear All
                                            </button>
                                        </div>
                                    </div>

                                    {/* Search & Dept Filter */}
                                    <div className="flex items-center gap-2">
                                        <div className="relative flex-1">
                                            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                                            <input
                                                type="text"
                                                value={squadEmpSearch}
                                                onChange={(e) => setSquadEmpSearch(e.target.value)}
                                                placeholder="Search staff to add/remove..."
                                                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-2.5 py-1.5 text-xs text-white placeholder-slate-500"
                                            />
                                        </div>
                                        <select
                                            value={squadDeptFilter}
                                            onChange={(e) => setSquadDeptFilter(e.target.value)}
                                            className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-300"
                                        >
                                            <option value="all">All Departments</option>
                                            {departments.map((d) => (
                                                <option key={d.id} value={d.id}>{d.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="bg-slate-950 rounded-xl border border-slate-800 h-[280px] lg:h-[320px] overflow-y-auto divide-y divide-slate-900 p-1">
                                        {available_employees
                                            .filter((emp) => {
                                                const matchesSearch =
                                                    emp.full_name.toLowerCase().includes(squadEmpSearch.toLowerCase()) ||
                                                    emp.emp_no.toLowerCase().includes(squadEmpSearch.toLowerCase());
                                                const matchesDept =
                                                    squadDeptFilter === 'all' ||
                                                    emp.department_id === squadDeptFilter ||
                                                    emp.department_name === squadDeptFilter;
                                                return matchesSearch && matchesDept;
                                            })
                                            .map((emp) => {
                                                const isSelected = editSquadForm.data.employee_ids.includes(emp.id);
                                                const isEnrolledInAnotherSquad = emp.current_squad && emp.current_squad.id !== editingSquad.id;
                                                const hasConflict = !emp.is_available && !isSelected;

                                                return (
                                                    <div
                                                        key={emp.id}
                                                        onClick={() => {
                                                            const next = isSelected
                                                                ? editSquadForm.data.employee_ids.filter((id) => id !== emp.id)
                                                                : [...editSquadForm.data.employee_ids, emp.id];
                                                            editSquadForm.setData('employee_ids', next);
                                                        }}
                                                        className={`p-2 rounded-lg flex items-center justify-between cursor-pointer transition ${
                                                            isSelected
                                                                ? 'bg-indigo-600/20 border border-indigo-500/30'
                                                                : 'hover:bg-slate-900/60'
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-2.5">
                                                            <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition ${
                                                                isSelected ? 'bg-indigo-600 border-indigo-500 text-white' : 'border-slate-700 bg-slate-900'
                                                            }`}>
                                                                {isSelected && <Check className="w-2.5 h-2.5" />}
                                                            </div>
                                                            <div>
                                                                <span className="font-semibold text-xs text-white block">
                                                                    {emp.full_name}
                                                                </span>
                                                                <span className="text-[10px] text-slate-400 font-mono">
                                                                    {emp.emp_no} &bull; {emp.department_name}
                                                                </span>
                                                            </div>
                                                        </div>

                                                        <div>
                                                            {isSelected ? (
                                                                <span className="text-[10px] font-mono px-2 py-0.5 rounded text-emerald-400 bg-emerald-500/10 border border-emerald-500/20">
                                                                    Enrolled
                                                                </span>
                                                            ) : isEnrolledInAnotherSquad ? (
                                                                <span className="text-[10px] font-mono px-2 py-0.5 rounded text-amber-300 bg-amber-500/10 border border-amber-500/20">
                                                                    In {emp.current_squad?.name}
                                                                </span>
                                                            ) : hasConflict ? (
                                                                <span className="text-[10px] font-mono px-2 py-0.5 rounded text-rose-400 bg-rose-500/10 border border-rose-500/20">
                                                                    {emp.exclusion_reason || 'Roster Overlap'}
                                                                </span>
                                                            ) : (
                                                                <span className="text-[10px] text-slate-400 font-mono px-1.5 py-0.5 rounded bg-slate-800">
                                                                    Available
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                    </div>
                                </div>
                            </div>

                            <div className="pt-3 flex items-center justify-between border-t border-slate-800">
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (confirm(`Are you sure you want to delete squad '${editingSquad.name}'?`)) {
                                            handleDeleteSquad(editingSquad);
                                            setIsEditSquadModalOpen(false);
                                            setEditingSquad(null);
                                        }
                                    }}
                                    className="px-3 py-1.5 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 hover:text-rose-300 border border-rose-800/40 text-xs font-semibold flex items-center gap-1.5 transition"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    <span>Delete Squad</span>
                                </button>

                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsEditSquadModalOpen(false);
                                            setEditingSquad(null);
                                        }}
                                        className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white transition"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={editSquadForm.processing || !editSquadForm.data.name}
                                        className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-md transition disabled:opacity-50"
                                    >
                                        {editSquadForm.processing ? 'Saving...' : 'Save Changes'}
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL 6c: Squads & Crews Directory */}
            {isSquadDirectoryModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full p-6 space-y-4 shadow-2xl relative max-h-[85vh] overflow-y-auto">
                        <button
                            type="button"
                            onClick={() => setIsSquadDirectoryModalOpen(false)}
                            className="absolute top-5 right-5 text-slate-400 hover:text-white"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <div className="flex items-center justify-between pr-8">
                            <div>
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                                    Organizational Structure
                                </span>
                                <h3 className="text-base font-bold text-white mt-1">
                                    Squads & Crews Directory
                                </h3>
                                <p className="text-xs text-slate-400">
                                    View and manage all rotating operational squads, rotation rules, and enrolled personnel.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    setIsSquadDirectoryModalOpen(false);
                                    openNewSquadModal();
                                }}
                                className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-sm"
                            >
                                <Plus className="w-3.5 h-3.5" />
                                <span>New Squad</span>
                            </button>
                        </div>

                        <div className="space-y-3 pt-2">
                            {squads.length === 0 ? (
                                <div className="p-8 text-center bg-slate-950 rounded-xl border border-slate-800 text-slate-400 text-xs">
                                    <Users className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                                    <p className="font-semibold text-slate-300">No Squads Configured Yet</p>
                                    <p className="text-slate-500 mt-1">
                                        Click "+ New Squad" above to define your first operational crew.
                                    </p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {squads.map((sq) => {
                                        const memberCount = sq.employees ? sq.employees.length : 0;
                                        return (
                                            <div
                                                key={sq.id}
                                                className="p-4 bg-slate-950 rounded-xl border border-slate-800 hover:border-slate-700 transition flex flex-col justify-between space-y-3"
                                            >
                                                <div>
                                                    <div className="flex items-start justify-between">
                                                        <div className="flex items-center gap-2.5">
                                                            <span
                                                                className="w-3.5 h-3.5 rounded-full shrink-0"
                                                                style={{ backgroundColor: sq.color || '#3b82f6' }}
                                                            />
                                                            <div>
                                                                <h4 className="text-sm font-bold text-white">
                                                                    {sq.name}
                                                                </h4>
                                                                <span className="text-[10px] font-mono text-slate-400">
                                                                    {sq.code || 'NO-CODE'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-1">
                                                            {sq.roster_id ? (
                                                                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                                                                    Roster Squad
                                                                </span>
                                                            ) : (
                                                                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20">
                                                                    Master Squad
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {sq.pattern && (
                                                        <div className="mt-2.5 text-xs text-slate-300 bg-slate-900/80 p-2 rounded-lg border border-slate-800">
                                                            <div className="flex items-center justify-between text-[11px]">
                                                                <span className="text-indigo-400 font-semibold">
                                                                    {sq.pattern.name}
                                                                </span>
                                                                <span className="text-[10px] font-mono text-slate-400">
                                                                    {sq.pattern.cycle_length_days}d cycle
                                                                </span>
                                                            </div>
                                                        </div>
                                                    )}

                                                    <div className="mt-2 flex items-center justify-between text-xs">
                                                        <span className="text-slate-400 text-[11px]">
                                                            Personnel Enrolled:
                                                        </span>
                                                        <span className="font-bold text-white font-mono bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                                                            {memberCount} Staff
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="pt-2 border-t border-slate-800 flex items-center justify-end gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setIsSquadDirectoryModalOpen(false);
                                                            openManageMembers(sq);
                                                        }}
                                                        className="px-2.5 py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-semibold flex items-center gap-1 transition"
                                                    >
                                                        <UserPlus className="w-3 h-3" />
                                                        <span>Staff ({memberCount})</span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setIsSquadDirectoryModalOpen(false);
                                                            openEditSquadModal(sq);
                                                        }}
                                                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1 transition"
                                                    >
                                                        <Settings className="w-3 h-3" />
                                                        <span>Edit</span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDeleteSquad(sq)}
                                                        className="p-1 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 border border-rose-800/40 transition"
                                                        title="Delete Squad"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        <div className="pt-3 flex justify-end border-t border-slate-800">
                            <button
                                type="button"
                                onClick={() => setIsSquadDirectoryModalOpen(false)}
                                className="px-4 py-2 rounded-xl text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 font-semibold"
                            >
                                Close Directory
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL 7: Quick Pattern / Bulk Fill Modal */}
            {isQuickPatternModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl relative max-h-[85vh] overflow-y-auto">
                        <button
                            onClick={() => setIsQuickPatternModalOpen(false)}
                            className="absolute top-5 right-5 text-slate-400 hover:text-white"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <div>
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                Fast Schedule Ingestion
                            </span>
                            <h3 className="text-base font-bold text-white mt-1">
                                Apply Shift Pattern to Personnel
                            </h3>
                            <p className="text-xs text-slate-400">
                                Choose a rotation pattern and apply it to target employees across the month.
                            </p>
                        </div>

                        <form onSubmit={handleQuickPatternSubmit} className="space-y-3.5">
                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1">
                                    Pattern to Apply *
                                </label>
                                <select
                                    required
                                    value={quickPatternForm.data.pattern_id}
                                    onChange={(e) => quickPatternForm.setData('pattern_id', e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                                >
                                    {patterns.map((p) => (
                                        <option key={p.id} value={p.id}>
                                            {p.name} ({p.pattern_type.toUpperCase()}, {p.cycle_length_days}d cycle)
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                                        Start Date *
                                    </label>
                                    <input
                                        type="date"
                                        required
                                        value={quickPatternForm.data.start_date}
                                        onChange={(e) => quickPatternForm.setData('start_date', e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:ring-1 focus:ring-indigo-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                                        End Date *
                                    </label>
                                    <input
                                        type="date"
                                        required
                                        value={quickPatternForm.data.end_date}
                                        onChange={(e) => quickPatternForm.setData('end_date', e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:ring-1 focus:ring-indigo-500"
                                    />
                                </div>
                            </div>

                            <div className="flex items-center gap-2 pt-1">
                                <input
                                    type="checkbox"
                                    id="preserveLeavesQuick"
                                    checked={quickPatternForm.data.preserve_leaves}
                                    onChange={(e) => quickPatternForm.setData('preserve_leaves', e.target.checked)}
                                    className="rounded bg-slate-950 border-slate-800 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                                />
                                <label htmlFor="preserveLeavesQuick" className="text-xs text-slate-300 cursor-pointer">
                                    Preserve approved leaves (never overwrite with shifts)
                                </label>
                            </div>

                            {/* Target Staff Selector */}
                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <label className="block text-xs font-semibold text-slate-300">
                                        Target Staff ({quickPatternForm.data.employee_ids.length} Selected)
                                    </label>
                                    <div className="flex items-center gap-2 text-[11px]">
                                        <button
                                            type="button"
                                            onClick={() => quickPatternForm.setData('employee_ids', matrix.map(r => r.employee.id))}
                                            className="text-indigo-400 hover:text-indigo-300"
                                        >
                                            Select All Visible
                                        </button>
                                        <span className="text-slate-600">|</span>
                                        <button
                                            type="button"
                                            onClick={() => quickPatternForm.setData('employee_ids', [])}
                                            className="text-slate-400 hover:text-white"
                                        >
                                            Clear
                                        </button>
                                    </div>
                                </div>

                                <input
                                    type="text"
                                    value={quickPatternEmpSearch}
                                    onChange={(e) => setQuickPatternEmpSearch(e.target.value)}
                                    placeholder="Search roster staff..."
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 mb-2"
                                />

                                <div className="bg-slate-950 rounded-xl border border-slate-800 max-h-40 overflow-y-auto divide-y divide-slate-900 p-1">
                                    {matrix
                                        .filter((r) =>
                                            r.employee.full_name.toLowerCase().includes(quickPatternEmpSearch.toLowerCase()) ||
                                            r.employee.emp_no.toLowerCase().includes(quickPatternEmpSearch.toLowerCase())
                                        )
                                        .map((r) => {
                                            const isSelected = quickPatternForm.data.employee_ids.includes(r.employee.id);
                                            return (
                                                <div
                                                    key={r.employee.id}
                                                    onClick={() => {
                                                        const next = isSelected
                                                            ? quickPatternForm.data.employee_ids.filter((id) => id !== r.employee.id)
                                                            : [...quickPatternForm.data.employee_ids, r.employee.id];
                                                        quickPatternForm.setData('employee_ids', next);
                                                    }}
                                                    className={`p-2 rounded-lg flex items-center justify-between cursor-pointer transition ${
                                                        isSelected ? 'bg-indigo-600/15' : 'hover:bg-slate-900/60'
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition ${
                                                            isSelected ? 'bg-indigo-600 border-indigo-500 text-white' : 'border-slate-700 bg-slate-900'
                                                        }`}>
                                                            {isSelected && <Check className="w-2.5 h-2.5" />}
                                                        </div>
                                                        <span className="font-medium text-xs text-white">
                                                            {r.employee.full_name}
                                                        </span>
                                                        <span className="text-[10px] text-slate-400 font-mono">
                                                            ({r.employee.emp_no})
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                </div>
                            </div>

                            <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-800">
                                <button
                                    type="button"
                                    onClick={() => setIsQuickPatternModalOpen(false)}
                                    className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={quickPatternForm.processing || quickPatternForm.data.employee_ids.length === 0}
                                    className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs shadow-md transition disabled:opacity-50"
                                >
                                    {quickPatternForm.processing ? 'Applying...' : `Apply Pattern (${quickPatternForm.data.employee_ids.length} Staff)`}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {/* MODAL 8: Dedicated Temporal Transfer Staff Modal */}
            {isTransferModalOpen && transferringEmployee && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl relative max-h-[90vh] overflow-y-auto">
                        <button
                            type="button"
                            onClick={() => {
                                setIsTransferModalOpen(false);
                                setTransferringEmployee(null);
                            }}
                            className="absolute top-5 right-5 text-slate-400 hover:text-white transition"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <div>
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                                Mid-Period Operational Reassignment
                            </span>
                            <h3 className="text-base font-bold text-white mt-1">
                                Transfer Staff &bull; {transferringEmployee.full_name}
                            </h3>
                            <p className="text-xs text-slate-400">
                                Shift staff member to a new squad or rotation pattern effective from a specific date.
                            </p>
                        </div>

                        <form onSubmit={handleTransferSubmit} className="space-y-4">
                            {/* Current Squad Info */}
                            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
                                <div>
                                    <span className="text-[10px] text-slate-400 uppercase font-mono block">Current Squad / Roster</span>
                                    <span className="text-xs font-bold text-white">
                                        {transferringEmployee.current_squad?.name || 'Department Direct Assigned'}
                                    </span>
                                </div>
                                {transferringEmployee.current_squad && (
                                    <span
                                        className="text-[10px] font-bold px-2 py-0.5 rounded text-white font-mono"
                                        style={{ backgroundColor: transferringEmployee.current_squad.color || '#3b82f6' }}
                                    >
                                        {transferringEmployee.current_squad.code}
                                    </span>
                                )}
                            </div>

                            {/* Target Squad Selector */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1">
                                    Target Squad / Destination Rotation *
                                </label>
                                <select
                                    required
                                    value={transferTargetSquadId}
                                    onChange={(e) => setTransferTargetSquadId(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                                >
                                    <option value="">-- Select Destination Squad --</option>
                                    {squads.map((sq) => (
                                        <option key={sq.id} value={sq.id}>
                                            {sq.name} ({sq.code}) {sq.pattern ? `• ${sq.pattern.name} (${sq.pattern.cycle_length_days}d)` : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Effective Transfer Date */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1">
                                    Effective Transfer Date (Start in new squad) *
                                </label>
                                <input
                                    type="date"
                                    required
                                    value={transferEffectiveDate}
                                    onChange={(e) => setTransferEffectiveDate(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:ring-1 focus:ring-indigo-500"
                                />
                            </div>

                            {/* Impact Summary Box */}
                            <div className="bg-indigo-950/30 border border-indigo-500/20 rounded-xl p-3 space-y-1.5 text-xs">
                                <span className="font-semibold text-indigo-300 flex items-center gap-1">
                                    <Info className="w-3.5 h-3.5" />
                                    <span>Temporal Lineage Continuity Rules:</span>
                                </span>
                                <ul className="list-disc list-inside text-slate-300 text-[11px] space-y-1 pl-1">
                                    <li>
                                        <strong>Prior shifts before {transferEffectiveDate || '[Date]'}:</strong> Will remain 100% intact under the current squad with past attendance preserved.
                                    </li>
                                    <li>
                                        <strong>Shifts from {transferEffectiveDate || '[Date]'} onwards:</strong> Will be generated under the new target squad's rotation pattern.
                                    </li>
                                </ul>
                            </div>

                            <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-800">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsTransferModalOpen(false);
                                        setTransferringEmployee(null);
                                    }}
                                    className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={transferProcessing || !transferTargetSquadId || !transferEffectiveDate}
                                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-md transition disabled:opacity-50 flex items-center gap-1.5"
                                >
                                    <ArrowLeftRight className="w-3.5 h-3.5" />
                                    <span>{transferProcessing ? 'Transferring...' : 'Execute Transfer'}</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL 9: Dedicated Remove / End Assignment Modal */}
            {isRemoveModalOpen && removingEmployee && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl relative max-h-[90vh] overflow-y-auto">
                        <button
                            type="button"
                            onClick={() => {
                                setIsRemoveModalOpen(false);
                                setRemovingEmployee(null);
                            }}
                            className="absolute top-5 right-5 text-slate-400 hover:text-white transition"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <div>
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                Personnel Assignment Removal
                            </span>
                            <h3 className="text-base font-bold text-white mt-1">
                                Remove Staff &bull; {removingEmployee.full_name}
                            </h3>
                            <p className="text-xs text-slate-400">
                                Choose how to detach {removingEmployee.full_name} ({removingEmployee.emp_no}) from {removingEmployee.squad_name || 'this roster'}.
                            </p>
                        </div>

                        <form onSubmit={handleRemoveSubmit} className="space-y-4">
                            <div className="space-y-2.5">
                                {/* Option 1: Effective-Dated End */}
                                <label
                                    onClick={() => setRemoveMode('effective_date')}
                                    className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition ${
                                        removeMode === 'effective_date'
                                            ? 'bg-indigo-950/30 border-indigo-500/50 text-white'
                                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                                    }`}
                                >
                                    <input
                                        type="radio"
                                        name="removeMode"
                                        checked={removeMode === 'effective_date'}
                                        onChange={() => setRemoveMode('effective_date')}
                                        className="mt-0.5 bg-slate-900 border-slate-700 text-indigo-600 focus:ring-indigo-500"
                                    />
                                    <div className="space-y-1">
                                        <span className="font-bold text-xs block text-slate-200">
                                            End Assignment on Date (Recommended)
                                        </span>
                                        <p className="text-[11px] text-slate-400 leading-relaxed">
                                            Preserves past attendance and worked shifts prior to the selected date. Only clears future uncompleted shifts.
                                        </p>
                                    </div>
                                </label>

                                {removeMode === 'effective_date' && (
                                    <div className="pl-6 pt-1">
                                        <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                                            Effective End Date *
                                        </label>
                                        <input
                                            type="date"
                                            required
                                            value={removeEffectiveDate}
                                            onChange={(e) => setRemoveEffectiveDate(e.target.value)}
                                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white font-mono focus:ring-1 focus:ring-indigo-500"
                                        />
                                    </div>
                                )}

                                {/* Option 2: Complete Purge */}
                                <label
                                    onClick={() => setRemoveMode('purge_all')}
                                    className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition ${
                                        removeMode === 'purge_all'
                                            ? 'bg-rose-950/30 border-rose-500/50 text-white'
                                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                                    }`}
                                >
                                    <input
                                        type="radio"
                                        name="removeMode"
                                        checked={removeMode === 'purge_all'}
                                        onChange={() => setRemoveMode('purge_all')}
                                        className="mt-0.5 bg-slate-900 border-slate-700 text-rose-600 focus:ring-rose-500"
                                    />
                                    <div className="space-y-1">
                                        <span className="font-bold text-xs block text-slate-200">
                                            Complete Draft Purge
                                        </span>
                                        <p className="text-[11px] text-slate-400 leading-relaxed">
                                            Completely deletes all generated shifts for this employee for this month's roster.
                                        </p>
                                    </div>
                                </label>
                            </div>

                            <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-800">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsRemoveModalOpen(false);
                                        setRemovingEmployee(null);
                                    }}
                                    className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={removeProcessing}
                                    className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs shadow-md transition disabled:opacity-50 flex items-center gap-1.5"
                                >
                                    <UserMinus className="w-3.5 h-3.5" />
                                    <span>{removeProcessing ? 'Removing...' : 'Confirm Removal'}</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL 10: Unified Roster Personnel Management Hub */}
            {isRosterPersonnelModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6 bg-black/80 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full p-6 space-y-4 shadow-2xl relative max-h-[88vh] overflow-y-auto flex flex-col">
                        <button
                            type="button"
                            onClick={() => setIsRosterPersonnelModalOpen(false)}
                            className="absolute top-5 right-5 text-slate-400 hover:text-white transition"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <div>
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                                Workforce Management
                            </span>
                            <h3 className="text-base md:text-lg font-bold text-white mt-1">
                                Roster Personnel Hub &bull; {active_roster?.name || 'Active Roster'}
                            </h3>
                            <p className="text-xs text-slate-400">
                                Add available staff, execute mid-period temporal transfers, or review currently enrolled personnel.
                            </p>
                        </div>

                        {/* Tabs */}
                        <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                            <button
                                type="button"
                                onClick={() => setPersonnelHubTab('available')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                                    personnelHubTab === 'available'
                                        ? 'bg-indigo-600 text-white shadow-sm'
                                        : 'text-slate-400 hover:text-white'
                                }`}
                            >
                                Available Staff (Unassigned)
                            </button>
                            <button
                                type="button"
                                onClick={() => setPersonnelHubTab('transfer')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                                    personnelHubTab === 'transfer'
                                        ? 'bg-indigo-600 text-white shadow-sm'
                                        : 'text-slate-400 hover:text-white'
                                }`}
                            >
                                Assigned Elsewhere / Transfer
                            </button>
                            <button
                                type="button"
                                onClick={() => setPersonnelHubTab('assigned')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                                    personnelHubTab === 'assigned'
                                        ? 'bg-indigo-600 text-white shadow-sm'
                                        : 'text-slate-400 hover:text-white'
                                }`}
                            >
                                Current Roster Members ({filteredMatrix.length})
                            </button>
                        </div>

                        {/* TAB 1: Available Staff (Direct Enrollment) */}
                        {personnelHubTab === 'available' && (
                            <form onSubmit={handleRosterPersonnelEnroll} className="space-y-3.5 flex-1 flex flex-col justify-between">
                                <div className="space-y-3">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-300 mb-1">
                                                Enroll Into Squad *
                                            </label>
                                            <select
                                                required
                                                value={personnelHubTargetSquadId}
                                                onChange={(e) => setPersonnelHubTargetSquadId(e.target.value)}
                                                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                                            >
                                                {squads.map((sq) => (
                                                    <option key={sq.id} value={sq.id}>
                                                        {sq.name} ({sq.code}) {sq.pattern ? `• ${sq.pattern.name}` : ''}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-slate-300 mb-1">
                                                Effective Start Date *
                                            </label>
                                            <input
                                                type="date"
                                                required
                                                value={personnelHubEffectiveDate}
                                                onChange={(e) => setPersonnelHubEffectiveDate(e.target.value)}
                                                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white font-mono focus:ring-1 focus:ring-indigo-500"
                                            />
                                        </div>
                                    </div>

                                    {/* Search & Dept Filters */}
                                    <div className="flex items-center gap-2">
                                        <div className="relative flex-1">
                                            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                                            <input
                                                type="text"
                                                value={personnelHubSearch}
                                                onChange={(e) => setPersonnelHubSearch(e.target.value)}
                                                placeholder="Search available personnel..."
                                                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-2.5 py-1.5 text-xs text-white placeholder-slate-500"
                                            />
                                        </div>
                                        <select
                                            value={personnelHubDeptFilter}
                                            onChange={(e) => setPersonnelHubDeptFilter(e.target.value)}
                                            className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-slate-300"
                                        >
                                            <option value="all">All Departments</option>
                                            {departments.map((d) => (
                                                <option key={d.id} value={d.id}>{d.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Available Staff List */}
                                    <div className="bg-slate-950 rounded-xl border border-slate-800 h-60 overflow-y-auto divide-y divide-slate-900 p-1">
                                        {available_employees
                                            .filter((emp) => emp.is_available)
                                            .filter((emp) => {
                                                const matchesSearch =
                                                    emp.full_name.toLowerCase().includes(personnelHubSearch.toLowerCase()) ||
                                                    emp.emp_no.toLowerCase().includes(personnelHubSearch.toLowerCase());
                                                const matchesDept =
                                                    personnelHubDeptFilter === 'all' ||
                                                    emp.department_id === personnelHubDeptFilter ||
                                                    emp.department_name === personnelHubDeptFilter;
                                                return matchesSearch && matchesDept;
                                            })
                                            .map((emp) => {
                                                const isSelected = personnelHubSelectedEmpIds.includes(emp.id);
                                                return (
                                                    <div
                                                        key={emp.id}
                                                        onClick={() => {
                                                            const next = isSelected
                                                                ? personnelHubSelectedEmpIds.filter((id) => id !== emp.id)
                                                                : [...personnelHubSelectedEmpIds, emp.id];
                                                            setPersonnelHubSelectedEmpIds(next);
                                                        }}
                                                        className={`p-2.5 rounded-lg flex items-center justify-between cursor-pointer transition ${
                                                            isSelected ? 'bg-indigo-600/20 border border-indigo-500/30' : 'hover:bg-slate-900/60'
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-2.5">
                                                            <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                                                                isSelected ? 'bg-indigo-600 border-indigo-500 text-white' : 'border-slate-700 bg-slate-900'
                                                            }`}>
                                                                {isSelected && <Check className="w-3 h-3" />}
                                                            </div>
                                                            <div>
                                                                <span className="font-bold text-xs text-white block">
                                                                    {emp.full_name}
                                                                </span>
                                                                <span className="text-[10px] text-slate-400 font-mono">
                                                                    {emp.emp_no} &bull; {emp.department_name}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                                            Available
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        {available_employees.filter((emp) => emp.is_available).length === 0 && (
                                            <div className="p-8 text-center text-xs text-slate-500">
                                                No unassigned employees available for direct enrollment. Check the "Transfer" tab to reassign staff.
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="pt-3 flex items-center justify-between border-t border-slate-800">
                                    <span className="text-xs text-slate-400">
                                        {personnelHubSelectedEmpIds.length} Staff Selected
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setIsRosterPersonnelModalOpen(false)}
                                            className="px-4 py-2 rounded-xl text-xs text-slate-400 hover:text-white"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={personnelHubProcessing || personnelHubSelectedEmpIds.length === 0 || !personnelHubTargetSquadId}
                                            className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-md transition disabled:opacity-40"
                                        >
                                            {personnelHubProcessing ? 'Enrolling...' : `Enroll Selected (${personnelHubSelectedEmpIds.length})`}
                                        </button>
                                    </div>
                                </div>
                            </form>
                        )}

                        {/* TAB 2: Assigned Elsewhere / Transfer */}
                        {personnelHubTab === 'transfer' && (
                            <div className="space-y-3">
                                <div className="bg-slate-950 rounded-xl border border-slate-800 divide-y divide-slate-900 max-h-72 overflow-y-auto p-1">
                                    {available_employees
                                        .filter((emp) => !emp.is_available)
                                        .map((emp) => (
                                            <div key={emp.id} className="p-3 flex items-center justify-between hover:bg-slate-900/50 transition">
                                                <div>
                                                    <span className="font-semibold text-xs text-white block">
                                                        {emp.full_name}
                                                    </span>
                                                    <span className="text-[10px] text-amber-300 font-mono">
                                                        {emp.exclusion_reason || 'Currently Scheduled in another squad'}
                                                    </span>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setIsRosterPersonnelModalOpen(false);
                                                        openTransferModal({
                                                            id: emp.id,
                                                            full_name: emp.full_name,
                                                            emp_no: emp.emp_no,
                                                            current_squad: emp.current_squad,
                                                            current_roster: emp.current_roster,
                                                        });
                                                    }}
                                                    className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-xs font-semibold flex items-center gap-1.5 transition shadow-sm"
                                                >
                                                    <ArrowLeftRight className="w-3.5 h-3.5" />
                                                    <span>Transfer to this Roster</span>
                                                </button>
                                            </div>
                                        ))}
                                    {available_employees.filter((emp) => !emp.is_available).length === 0 && (
                                        <div className="p-8 text-center text-xs text-slate-500">
                                            No occupied personnel found.
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* TAB 3: Current Roster Members */}
                        {personnelHubTab === 'assigned' && (
                            <div className="space-y-3">
                                <div className="bg-slate-950 rounded-xl border border-slate-800 divide-y divide-slate-900 max-h-72 overflow-y-auto p-1">
                                    {filteredMatrix.map((r) => (
                                        <div key={r.employee.id} className="p-3 flex items-center justify-between hover:bg-slate-900/50 transition">
                                            <div>
                                                <span className="font-semibold text-xs text-white block">
                                                    {r.employee.full_name}
                                                </span>
                                                <span className="text-[10px] text-slate-400 font-mono">
                                                    {r.employee.emp_no} &bull; {r.employee.department?.name || 'General'}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {r.squad && (
                                                    <span
                                                        className="text-[10px] font-bold px-2 py-0.5 rounded text-white font-mono"
                                                        style={{ backgroundColor: r.squad.color || '#3b82f6' }}
                                                    >
                                                        {r.squad.name}
                                                    </span>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setIsRosterPersonnelModalOpen(false);
                                                        openTransferModal({
                                                            id: r.employee.id,
                                                            full_name: r.employee.full_name,
                                                            emp_no: r.employee.emp_no,
                                                            current_squad: r.squad ? { id: r.squad.id, name: r.squad.name, code: r.squad.code, color: r.squad.color } : null,
                                                            current_roster: active_roster ? { id: active_roster.id, name: active_roster.name, code: active_roster.code } : null,
                                                        });
                                                    }}
                                                    className="px-2 py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-semibold flex items-center gap-1 transition"
                                                >
                                                    <ArrowLeftRight className="w-3 h-3" />
                                                    <span>Transfer</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setIsRosterPersonnelModalOpen(false);
                                                        openRemoveModal({
                                                            id: r.employee.id,
                                                            full_name: r.employee.full_name,
                                                            emp_no: r.employee.emp_no,
                                                            squad_id: r.squad?.id || squads[0]?.id,
                                                            squad_name: r.squad?.name || 'Assigned Squad',
                                                        });
                                                    }}
                                                    className="px-2 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-semibold flex items-center gap-1 transition"
                                                >
                                                    <UserMinus className="w-3 h-3" />
                                                    <span>Remove</span>
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </AuthenticatedLayout>
    );
}
