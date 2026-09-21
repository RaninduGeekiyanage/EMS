import React, { useState } from 'react';
import { Head, router } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import {
    FileSpreadsheet,
    FileText,
    Filter,
    Check,
    RotateCcw,
    Layers,
    Download,
    Eye,
    CheckSquare,
    Square,
    Sparkles,
    UserCheck,
    Building2,
    Users,
} from 'lucide-react';

interface ColumnDef {
    label: string;
    group: string;
}

interface Department {
    id: string;
    name: string;
    code: string | null;
}

interface PreviewData {
    headers: Record<string, string>;
    rows: Array<Record<string, any>>;
    total: number;
}

interface Filters {
    department_id?: string;
    status?: string;
    employment_category?: string;
    gender?: string;
}

interface Props {
    availableColumns: Record<string, ColumnDef>;
    departments: Department[];
    previewData: PreviewData;
    selectedColumns: string[];
    filters: Filters;
}

const DEFAULT_PRESET = [
    'emp_no',
    'full_name',
    'department',
    'designation',
    'employment_category',
    'employment_status',
    'basic_salary',
];

export default function CustomBuilder({
    availableColumns,
    departments,
    previewData,
    selectedColumns: initialColumns,
    filters: initialFilters,
}: Props) {
    const [selectedCols, setSelectedCols] = useState<string[]>(
        initialColumns && initialColumns.length > 0 ? initialColumns : DEFAULT_PRESET
    );
    const [filters, setFilters] = useState<Filters>(initialFilters || {});
    const [activeGroup, setActiveGroup] = useState<string>('All');
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Group columns by their category
    const groups = ['All', ...Array.from(new Set(Object.values(availableColumns).map((c) => c.group)))];

    const toggleColumn = (colKey: string) => {
        setSelectedCols((prev) =>
            prev.includes(colKey)
                ? prev.length > 1
                    ? prev.filter((k) => k !== colKey)
                    : prev // Keep at least 1 column selected
                : [...prev, colKey]
        );
    };

    const selectAll = () => {
        setSelectedCols(Object.keys(availableColumns));
    };

    const selectNone = () => {
        setSelectedCols(['emp_no', 'full_name']); // Minimum anchor
    };

    const applyDefaultPreset = () => {
        setSelectedCols(DEFAULT_PRESET);
    };

    const handleApplyQuery = () => {
        setIsRefreshing(true);
        router.get(
            '/reports/custom',
            {
                columns: selectedCols,
                department_id: filters.department_id || undefined,
                status: filters.status || undefined,
                employment_category: filters.employment_category || undefined,
                gender: filters.gender || undefined,
            },
            {
                preserveState: true,
                preserveScroll: true,
                onFinish: () => setIsRefreshing(false),
            }
        );
    };

    const handleResetFilters = () => {
        setFilters({});
        router.get(
            '/reports/custom',
            {
                columns: selectedCols,
            },
            {
                preserveState: true,
                preserveScroll: true,
            }
        );
    };

    const buildExportUrl = (format: 'csv' | 'pdf') => {
        const params = new URLSearchParams();
        selectedCols.forEach((col) => params.append('columns[]', col));
        if (filters.department_id) params.append('department_id', filters.department_id);
        if (filters.status) params.append('status', filters.status);
        if (filters.employment_category) params.append('employment_category', filters.employment_category);
        if (filters.gender) params.append('gender', filters.gender);

        const baseUrl = format === 'csv' ? '/reports/custom/csv' : '/reports/custom/pdf';
        return `${baseUrl}?${params.toString()}`;
    };

    const filteredColumns = Object.entries(availableColumns).filter(([_, def]) => {
        if (activeGroup === 'All') return true;
        return def.group === activeGroup;
    });

    return (
        <AuthenticatedLayout>
            <Head title="Custom HR Report Builder" />

            <div className="space-y-6">
                {/* Header with Title & Export Actions */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1.5 rounded-md bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-700 ring-1 ring-inset ring-indigo-700/10 dark:bg-indigo-950/50 dark:text-indigo-300 dark:ring-indigo-400/20">
                                <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
                                M04 Enterprise Intelligence
                            </span>
                            <span className="text-xs text-slate-500 dark:text-slate-400">Projected Live Stream</span>
                        </div>
                        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                            Custom HR Report Builder
                        </h1>
                        <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
                            Compose customized workforce records across payroll, statutory classification, and demographics.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5">
                        <a
                            href={buildExportUrl('csv')}
                            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 dark:bg-emerald-700 dark:hover:bg-emerald-600"
                        >
                            <FileSpreadsheet className="h-4 w-4" />
                            Export CSV
                        </a>
                        <a
                            href={buildExportUrl('pdf')}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600 dark:bg-rose-700 dark:hover:bg-rose-600"
                        >
                            <FileText className="h-4 w-4" />
                            Export PDF
                        </a>
                    </div>
                </div>

                {/* Filter Controls Card */}
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
                        <div className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
                            <Filter className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                            <span>Filter Dataset Criteria</span>
                        </div>
                        <button
                            type="button"
                            onClick={handleResetFilters}
                            className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                        >
                            <RotateCcw className="h-3 w-3" />
                            Reset All Filters
                        </button>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        {/* Department Filter */}
                        <div>
                            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                                Department
                            </label>
                            <select
                                value={filters.department_id || ''}
                                onChange={(e) => setFilters({ ...filters, department_id: e.target.value })}
                                className="mt-1 block w-full rounded-lg border-slate-300 bg-white py-1.5 text-sm text-slate-800 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                            >
                                <option value="">All Departments</option>
                                {departments.map((dept) => (
                                    <option key={dept.id} value={dept.id}>
                                        {dept.name} {dept.code ? `(${dept.code})` : ''}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Status Filter */}
                        <div>
                            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                                Employment Status
                            </label>
                            <select
                                value={filters.status || ''}
                                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                                className="mt-1 block w-full rounded-lg border-slate-300 bg-white py-1.5 text-sm text-slate-800 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                            >
                                <option value="">All Statuses</option>
                                <option value="active">Active</option>
                                <option value="probation">Probation</option>
                                <option value="inactive">Inactive</option>
                                <option value="resigned">Resigned</option>
                                <option value="terminated">Terminated</option>
                            </select>
                        </div>

                        {/* Statutory Category */}
                        <div>
                            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                                Statutory Category
                            </label>
                            <select
                                value={filters.employment_category || ''}
                                onChange={(e) => setFilters({ ...filters, employment_category: e.target.value })}
                                className="mt-1 block w-full rounded-lg border-slate-300 bg-white py-1.5 text-sm text-slate-800 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                            >
                                <option value="">All Categories</option>
                                <option value="shop_office">Shop & Office Employees</option>
                                <option value="wages_board">Wages Board Ordinance</option>
                                <option value="non_statutory">Non-Statutory / Contract</option>
                            </select>
                        </div>

                        {/* Gender */}
                        <div>
                            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                                Gender
                            </label>
                            <select
                                value={filters.gender || ''}
                                onChange={(e) => setFilters({ ...filters, gender: e.target.value })}
                                className="mt-1 block w-full rounded-lg border-slate-300 bg-white py-1.5 text-sm text-slate-800 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                            >
                                <option value="">All Genders</option>
                                <option value="male">Male</option>
                                <option value="female">Female</option>
                                <option value="other">Other</option>
                            </select>
                        </div>
                    </div>

                    <div className="mt-4 flex justify-end">
                        <button
                            type="button"
                            onClick={handleApplyQuery}
                            disabled={isRefreshing}
                            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50 dark:bg-indigo-700 dark:hover:bg-indigo-600"
                        >
                            <Eye className="h-4 w-4" />
                            {isRefreshing ? 'Applying...' : 'Apply Filters & Refresh'}
                        </button>
                    </div>
                </div>

                {/* Column Selection Card */}
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
                        <div className="flex items-center gap-2">
                            <Layers className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                                Select Columns to Include ({selectedCols.length} selected)
                            </h2>
                        </div>

                        <div className="flex items-center gap-2 text-xs">
                            <button
                                type="button"
                                onClick={selectAll}
                                className="rounded px-2 py-1 font-medium text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/50"
                            >
                                Select All
                            </button>
                            <span className="text-slate-300 dark:text-slate-700">|</span>
                            <button
                                type="button"
                                onClick={selectNone}
                                className="rounded px-2 py-1 font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                            >
                                Deselect
                            </button>
                            <span className="text-slate-300 dark:text-slate-700">|</span>
                            <button
                                type="button"
                                onClick={applyDefaultPreset}
                                className="rounded px-2 py-1 font-medium text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/50"
                            >
                                Default Preset
                            </button>
                        </div>
                    </div>

                    {/* Group Tab Pills */}
                    <div className="mt-3 flex flex-wrap gap-1.5 border-b border-slate-100 pb-3 dark:border-slate-800">
                        {groups.map((group) => {
                            const count =
                                group === 'All'
                                    ? Object.keys(availableColumns).length
                                    : Object.values(availableColumns).filter((c) => c.group === group).length;
                            const isCurrent = activeGroup === group;

                            return (
                                <button
                                    key={group}
                                    type="button"
                                    onClick={() => setActiveGroup(group)}
                                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition ${
                                        isCurrent
                                            ? 'bg-indigo-600 text-white shadow-sm dark:bg-indigo-700'
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                                    }`}
                                >
                                    <span>{group}</span>
                                    <span
                                        className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                                            isCurrent
                                                ? 'bg-indigo-800 text-white dark:bg-indigo-900'
                                                : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                                        }`}
                                    >
                                        {count}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Column Pickers */}
                    <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                        {filteredColumns.map(([colKey, def]) => {
                            const isChecked = selectedCols.includes(colKey);
                            return (
                                <button
                                    key={colKey}
                                    type="button"
                                    onClick={() => toggleColumn(colKey)}
                                    className={`flex items-center justify-between rounded-lg border p-2.5 text-left transition ${
                                        isChecked
                                            ? 'border-indigo-300 bg-indigo-50/60 text-indigo-950 dark:border-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-200'
                                            : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-700'
                                    }`}
                                >
                                    <div className="min-w-0 pr-2">
                                        <p className="truncate text-xs font-semibold">{def.label}</p>
                                        <p className="text-[10px] text-slate-500 dark:text-slate-400">{def.group}</p>
                                    </div>
                                    <div
                                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded ${
                                            isChecked
                                                ? 'bg-indigo-600 text-white dark:bg-indigo-500'
                                                : 'border border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-800'
                                        }`}
                                    >
                                        {isChecked && <Check className="h-3 w-3 stroke-[3]" />}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Data Preview Table */}
                <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <div className="flex flex-col gap-2 p-5 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 dark:border-slate-800">
                        <div>
                            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                                Live Report Preview
                            </h2>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                Showing preview of matching records (Total: {previewData.total} employees matched)
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={handleApplyQuery}
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
                        >
                            <RotateCcw className="h-3.5 w-3.5" />
                            Update Preview
                        </button>
                    </div>

                    <div className="overflow-x-auto">
                        {previewData.rows.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-center">
                                <Users className="h-10 w-10 text-slate-400 dark:text-slate-600" />
                                <h3 className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
                                    No records found
                                </h3>
                                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                    Try adjusting your filter criteria to match workforce records.
                                </p>
                            </div>
                        ) : (
                            <table className="w-full text-left text-xs text-slate-700 dark:text-slate-200">
                                <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wider text-slate-600 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-400">
                                    <tr>
                                        <th className="py-3 px-4 font-semibold">#</th>
                                        {selectedCols.map((colKey) => (
                                            <th key={colKey} className="py-3 px-4 font-semibold whitespace-nowrap">
                                                {previewData.headers[colKey] || colKey}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {previewData.rows.map((row, idx) => (
                                        <tr
                                            key={idx}
                                            className="transition hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                                        >
                                            <td className="py-2.5 px-4 text-slate-400 font-mono text-[10px]">
                                                {idx + 1}
                                            </td>
                                            {selectedCols.map((colKey) => {
                                                const val = row[colKey];
                                                return (
                                                    <td
                                                        key={colKey}
                                                        className="py-2.5 px-4 whitespace-nowrap font-medium text-slate-800 dark:text-slate-200"
                                                    >
                                                        {val !== null && val !== undefined ? String(val) : '—'}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
