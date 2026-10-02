import React, { useState, useMemo } from 'react';
import { Head, router, useForm } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import {
    Award,
    Plus,
    Search,
    Filter,
    FileText,
    CheckCircle2,
    Clock,
    AlertCircle,
    X,
    User,
    Building2,
    Calendar,
    ChevronRight,
    Star,
    ShieldCheck,
    Sliders,
    ArrowUpRight,
    Download,
    Eye,
    Edit3,
    Trash2,
    Sparkles,
    Check,
    ExternalLink,
    Percent,
} from 'lucide-react';

interface Employee {
    id: string;
    emp_no: string;
    full_name: string;
    department_id?: string | null;
    designation_id?: string | null;
    date_of_joining?: string | null;
    department?: { id: string; name: string } | null;
    designation?: { id: string; title: string } | null;
    branch?: { id: string; name: string } | null;
}

interface CriterionRating {
    key: string;
    title: string;
    description: string;
    weight: number;
    score: number;
    rating?: number;
    weighted_score: number;
    remarks?: string | null;
}

interface Evaluation {
    id: string;
    tenant_id: string;
    employee_id: string;
    evaluator_id: number;
    evaluation_period: string;
    evaluation_date: string;
    ratings_json: Record<string, CriterionRating>;
    overall_score: number;
    performance_grade: string;
    hod_comments?: string | null;
    hr_reviewer_id?: number | null;
    hr_comments?: string | null;
    status: 'draft' | 'submitted_to_hr' | 'confirmed_by_hr' | 'rejected' | 'archived';
    is_bypassed_by_hr: boolean;
    hr_actioned_at?: string | null;
    created_at: string;
    updated_at: string;
    employee: Employee;
    evaluator?: { id: number; name: string; email: string } | null;
    hrReviewer?: { id: number; name: string; email: string } | null;
}

interface CriterionDefinition {
    key: string;
    title: string;
    weight: number;
    description: string;
}

interface Statistics {
    total: number;
    pending_hr: number;
    confirmed: number;
    drafts: number;
    average_score: number;
    average_grade: string;
    grade_counts: Record<string, number>;
}

interface Department {
    id: string;
    name: string;
}

interface PaginatedData<T> {
    data: T[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    links: { url: string | null; label: string; active: boolean }[];
}

interface Props {
    evaluations: PaginatedData<Evaluation>;
    statistics: Statistics;
    departments: Department[];
    employees: Employee[];
    standardPeriods: string[];
    criteriaDefinitions: CriterionDefinition[];
    filters: {
        period: string;
        department_id: string;
        status: string;
        search: string;
    };
    canSubmit: boolean;
    canHrReview: boolean;
    isHod: boolean;
}

export default function EvaluationsIndex({
    evaluations,
    statistics,
    departments,
    employees,
    standardPeriods,
    criteriaDefinitions,
    filters,
    canSubmit,
    canHrReview,
    isHod,
}: Props) {
    const [searchTerm, setSearchTerm] = useState(filters.search || '');
    const [selectedPeriod, setSelectedPeriod] = useState(filters.period || 'all');
    const [selectedDept, setSelectedDept] = useState(filters.department_id || 'all');
    const [selectedStatus, setSelectedStatus] = useState(filters.status || 'all');

    // Modals & Drawers state
    const [isAppraisalModalOpen, setIsAppraisalModalOpen] = useState(false);
    const [isHrReviewModalOpen, setIsHrReviewModalOpen] = useState(false);
    const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false);
    const [activeEvaluation, setActiveEvaluation] = useState<Evaluation | null>(null);
    const [editingEvaluation, setEditingEvaluation] = useState<Evaluation | null>(null);

    // Form state for creating / updating evaluation
    const { data, setData, post, put, processing, errors, reset } = useForm({
        employee_id: '',
        evaluation_period: standardPeriods[0] || 'Annual 2026',
        evaluation_date: new Date().toISOString().split('T')[0],
        ratings_json: {} as Record<string, { score: number; remarks: string }>,
        hod_comments: '',
        is_draft: false,
        submit_to_hr: false,
    });

    // Form state for HR review
    const {
        data: hrData,
        setData: setHrData,
        post: postHrReview,
        processing: hrProcessing,
        errors: hrErrors,
        reset: resetHr,
    } = useForm({
        decision: 'confirm',
        hr_comments: '',
        direct_bypass: false,
        adjusted_ratings: {} as Record<string, { score: number; remarks: string }>,
    });

    // Initialize ratings when modal opens
    const openCreateModal = (existing?: Evaluation) => {
        if (existing) {
            setEditingEvaluation(existing);
            const initialRatings: Record<string, { score: number; remarks: string }> = {};
            criteriaDefinitions.forEach((c) => {
                const item = existing.ratings_json?.[c.key];
                initialRatings[c.key] = {
                    score: item ? item.score : 75,
                    remarks: item?.remarks || '',
                };
            });

            setData({
                employee_id: existing.employee_id,
                evaluation_period: existing.evaluation_period,
                evaluation_date: existing.evaluation_date,
                ratings_json: initialRatings,
                hod_comments: existing.hod_comments || '',
                is_draft: existing.status === 'draft',
                submit_to_hr: false,
            });
        } else {
            setEditingEvaluation(null);
            const initialRatings: Record<string, { score: number; remarks: string }> = {};
            criteriaDefinitions.forEach((c) => {
                initialRatings[c.key] = {
                    score: 75,
                    remarks: '',
                };
            });

            setData({
                employee_id: employees.length > 0 ? employees[0].id : '',
                evaluation_period: standardPeriods[0] || 'Annual 2026',
                evaluation_date: new Date().toISOString().split('T')[0],
                ratings_json: initialRatings,
                hod_comments: '',
                is_draft: false,
                submit_to_hr: false,
            });
        }
        setIsAppraisalModalOpen(true);
    };

    // Open HR Review Modal
    const openHrReviewModal = (evaluation: Evaluation) => {
        setActiveEvaluation(evaluation);
        const adjusted: Record<string, { score: number; remarks: string }> = {};
        criteriaDefinitions.forEach((c) => {
            const item = evaluation.ratings_json?.[c.key];
            adjusted[c.key] = {
                score: item ? item.score : 75,
                remarks: item?.remarks || '',
            };
        });

        setHrData({
            decision: 'confirm',
            hr_comments: '',
            direct_bypass: evaluation.status === 'draft',
            adjusted_ratings: adjusted,
        });
        setIsHrReviewModalOpen(true);
    };

    // Open details drawer
    const openDetailsDrawer = (evaluation: Evaluation) => {
        setActiveEvaluation(evaluation);
        setIsDetailDrawerOpen(true);
    };

    // Filter submit handler
    const applyFilters = (newPeriod?: string, newDept?: string, newStatus?: string, newSearch?: string) => {
        router.get(
            '/evaluations',
            {
                period: newPeriod !== undefined ? newPeriod : selectedPeriod,
                department_id: newDept !== undefined ? newDept : selectedDept,
                status: newStatus !== undefined ? newStatus : selectedStatus,
                search: newSearch !== undefined ? newSearch : searchTerm,
            },
            { preserveState: true, preserveScroll: true }
        );
    };

    // Calculate live score in modal
    const liveCalculatedScore = useMemo(() => {
        let totalWeighted = 0;
        let totalWeight = 0;

        criteriaDefinitions.forEach((crit) => {
            const userScore = data.ratings_json[crit.key]?.score ?? 75;
            totalWeighted += (userScore * crit.weight) / 100;
            totalWeight += crit.weight;
        });

        const score = totalWeight > 0 ? (totalWeighted / totalWeight) * 100 : totalWeighted;
        const clamped = Math.max(0, Math.min(100, Math.round(score * 10) / 10));

        let grade = 'D';
        if (clamped >= 90) grade = 'A+';
        else if (clamped >= 80) grade = 'A';
        else if (clamped >= 70) grade = 'B';
        else if (clamped >= 60) grade = 'C';

        return { score: clamped, grade };
    }, [data.ratings_json, criteriaDefinitions]);

    // Handle Form Submit for Save Draft or Submit to HR
    const handleSubmitAppraisal = (submitToHr: boolean) => {
        const payload = {
            ...data,
            submit_to_hr: submitToHr,
            is_draft: !submitToHr,
        };

        if (editingEvaluation) {
            router.put(`/evaluations/${editingEvaluation.id}`, payload, {
                onSuccess: () => {
                    setIsAppraisalModalOpen(false);
                    reset();
                },
            });
        } else {
            router.post('/evaluations', payload, {
                onSuccess: () => {
                    setIsAppraisalModalOpen(false);
                    reset();
                },
            });
        }
    };

    // Handle HR Review submit
    const handleSubmitHrReview = () => {
        if (!activeEvaluation) return;

        router.post(`/evaluations/${activeEvaluation.id}/hr-review`, hrData, {
            onSuccess: () => {
                setIsHrReviewModalOpen(false);
                resetHr();
            },
        });
    };

    // Grade badge helper
    const renderGradeBadge = (grade: string) => {
        const colors: Record<string, string> = {
            'A+': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
            'A': 'bg-teal-500/10 text-teal-400 border-teal-500/30',
            'B': 'bg-blue-500/10 text-blue-400 border-blue-500/30',
            'C': 'bg-amber-500/10 text-amber-400 border-amber-500/30',
            'D': 'bg-rose-500/10 text-rose-400 border-rose-500/30',
        };

        return (
            <span
                className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold border ${
                    colors[grade] || 'bg-slate-500/10 text-slate-400 border-slate-500/30'
                }`}
            >
                Grade {grade}
            </span>
        );
    };

    // Status badge helper
    const renderStatusBadge = (status: string, bypassed = false) => {
        switch (status) {
            case 'confirmed_by_hr':
                return (
                    <div className="flex flex-col items-start gap-1">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Confirmed by HR
                        </span>
                        {bypassed && (
                            <span className="text-[10px] text-amber-400 font-medium flex items-center gap-1">
                                <ShieldCheck className="w-3 h-3" /> HR Direct Bypass
                            </span>
                        )}
                    </div>
                );
            case 'submitted_to_hr':
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                        <Clock className="w-3.5 h-3.5" />
                        Pending HR Review
                    </span>
                );
            case 'draft':
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-500/15 text-slate-400 border border-slate-500/30">
                        <Edit3 className="w-3.5 h-3.5" />
                        Draft
                    </span>
                );
            case 'rejected':
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30">
                        <AlertCircle className="w-3.5 h-3.5" />
                        Returned / Rejected
                    </span>
                );
            default:
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-500/15 text-slate-400">
                        {status}
                    </span>
                );
        }
    };

    return (
        <AuthenticatedLayout>
            <Head title="Performance & KPI Evaluations" />

            <div className="space-y-6">
                {/* Header banner */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-indigo-500/20 shadow-xl">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            <span className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                                <Award className="w-6 h-6" />
                            </span>
                            <h1 className="text-xl font-bold text-white tracking-tight">
                                Performance & KPI Evaluations
                            </h1>
                        </div>
                        <p className="text-xs text-slate-400">
                            Two-tier HOD appraisal scoring, multi-criteria KPI weighting, and HR executive sign-off engine.
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        {canSubmit && (
                            <button
                                onClick={() => openCreateModal()}
                                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30 transition transform active:scale-95"
                            >
                                <Plus className="w-4 h-4" />
                                New Appraisal
                            </button>
                        )}
                    </div>
                </div>

                {/* 4 Metric Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Total Evaluations */}
                    <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 shadow-sm flex flex-col justify-between">
                        <div className="flex items-center justify-between text-slate-400 text-xs">
                            <span>Total Appraisals</span>
                            <Award className="w-4 h-4 text-indigo-400" />
                        </div>
                        <div className="mt-2 flex items-baseline justify-between">
                            <span className="text-2xl font-bold text-white">{statistics.total}</span>
                            <span className="text-[10px] text-slate-500">All evaluation periods</span>
                        </div>
                    </div>

                    {/* Pending HR Review */}
                    <div className="p-4 rounded-xl bg-slate-900/60 border border-amber-500/20 shadow-sm flex flex-col justify-between">
                        <div className="flex items-center justify-between text-amber-400 text-xs font-medium">
                            <span>Pending HR Review</span>
                            <Clock className="w-4 h-4 text-amber-400" />
                        </div>
                        <div className="mt-2 flex items-baseline justify-between">
                            <span className="text-2xl font-bold text-amber-300">{statistics.pending_hr}</span>
                            <span className="text-[10px] text-amber-500/80">Awaiting executive review</span>
                        </div>
                    </div>

                    {/* Confirmed Appraisals */}
                    <div className="p-4 rounded-xl bg-slate-900/60 border border-emerald-500/20 shadow-sm flex flex-col justify-between">
                        <div className="flex items-center justify-between text-emerald-400 text-xs font-medium">
                            <span>Confirmed & Finalized</span>
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        </div>
                        <div className="mt-2 flex items-baseline justify-between">
                            <span className="text-2xl font-bold text-emerald-300">{statistics.confirmed}</span>
                            <span className="text-[10px] text-emerald-500/80">Locked official records</span>
                        </div>
                    </div>

                    {/* Company Average Score */}
                    <div className="p-4 rounded-xl bg-slate-900/60 border border-blue-500/20 shadow-sm flex flex-col justify-between">
                        <div className="flex items-center justify-between text-blue-400 text-xs font-medium">
                            <span>Company Average Score</span>
                            <Sparkles className="w-4 h-4 text-blue-400" />
                        </div>
                        <div className="mt-2 flex items-baseline justify-between">
                            <div className="flex items-center gap-2">
                                <span className="text-2xl font-bold text-blue-300">
                                    {statistics.average_score.toFixed(1)}
                                </span>
                                <span className="text-xs text-slate-400">/ 100</span>
                            </div>
                            {statistics.average_grade !== '-' && renderGradeBadge(statistics.average_grade)}
                        </div>
                    </div>
                </div>

                {/* Filters & Search Control Bar */}
                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-3">
                        {/* Search Input */}
                        <div className="relative w-full md:w-80">
                            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && applyFilters(undefined, undefined, undefined, searchTerm)}
                                placeholder="Search employee name or ID..."
                                className="w-full pl-9 pr-4 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                            />
                        </div>

                        {/* Dropdown Filters */}
                        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                            {/* Period Filter */}
                            <select
                                value={selectedPeriod}
                                onChange={(e) => {
                                    setSelectedPeriod(e.target.value);
                                    applyFilters(e.target.value, undefined, undefined, undefined);
                                }}
                                className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
                            >
                                <option value="all">All Evaluation Periods</option>
                                {standardPeriods.map((p) => (
                                    <option key={p} value={p}>
                                        {p}
                                    </option>
                                ))}
                            </select>

                            {/* Department Filter */}
                            <select
                                value={selectedDept}
                                onChange={(e) => {
                                    setSelectedDept(e.target.value);
                                    applyFilters(undefined, e.target.value, undefined, undefined);
                                }}
                                className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
                            >
                                <option value="all">All Departments</option>
                                {departments.map((d) => (
                                    <option key={d.id} value={d.id}>
                                        {d.name}
                                    </option>
                                ))}
                            </select>

                            {/* Status Filter */}
                            <select
                                value={selectedStatus}
                                onChange={(e) => {
                                    setSelectedStatus(e.target.value);
                                    applyFilters(undefined, undefined, e.target.value, undefined);
                                }}
                                className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
                            >
                                <option value="all">All Statuses</option>
                                <option value="submitted_to_hr">Pending HR Review</option>
                                <option value="confirmed_by_hr">Confirmed by HR</option>
                                <option value="draft">Drafts</option>
                                <option value="rejected">Rejected / Returned</option>
                            </select>

                            <button
                                onClick={() => applyFilters(selectedPeriod, selectedDept, selectedStatus, searchTerm)}
                                className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 transition"
                            >
                                Apply
                            </button>
                        </div>
                    </div>
                </div>

                {/* Evaluations Table */}
                <div className="rounded-xl bg-slate-900/60 border border-slate-800 overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-slate-800 bg-slate-950/40 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                                    <th className="py-3 px-4">Employee</th>
                                    <th className="py-3 px-4">Period & Date</th>
                                    <th className="py-3 px-4">Overall Score</th>
                                    <th className="py-3 px-4">Evaluator (HOD)</th>
                                    <th className="py-3 px-4">HR Reviewer</th>
                                    <th className="py-3 px-4">Status</th>
                                    <th className="py-3 px-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/60 text-xs text-slate-300">
                                {evaluations.data.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="py-12 text-center text-slate-500">
                                            <Award className="w-10 h-10 mx-auto text-slate-600 mb-2 opacity-50" />
                                            <p className="text-sm font-medium">No performance evaluations found.</p>
                                            <p className="text-xs mt-1">
                                                Click "+ New Appraisal" to submit an evaluation for team members.
                                            </p>
                                        </td>
                                    </tr>
                                ) : (
                                    evaluations.data.map((evalItem) => (
                                        <tr key={evalItem.id} className="hover:bg-slate-800/30 transition">
                                            {/* Employee */}
                                            <td className="py-3 px-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-xs flex-shrink-0">
                                                        {evalItem.employee.full_name.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <div className="font-semibold text-slate-200">
                                                            {evalItem.employee.full_name}
                                                        </div>
                                                        <div className="text-[11px] text-slate-500 flex items-center gap-2">
                                                            <span>{evalItem.employee.emp_no}</span>
                                                            <span>•</span>
                                                            <span>{evalItem.employee.department?.name || 'No Dept'}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Period & Date */}
                                            <td className="py-3 px-4">
                                                <div className="font-medium text-slate-200">
                                                    {evalItem.evaluation_period}
                                                </div>
                                                <div className="text-[11px] text-slate-500">
                                                    {new Date(evalItem.evaluation_date).toLocaleDateString('en-GB', {
                                                        day: '2-digit',
                                                        month: 'short',
                                                        year: 'numeric',
                                                    })}
                                                </div>
                                            </td>

                                            {/* Score & Grade */}
                                            <td className="py-3 px-4">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-white text-sm">
                                                        {evalItem.overall_score.toFixed(1)}
                                                    </span>
                                                    <span className="text-[11px] text-slate-500">/ 100</span>
                                                    {renderGradeBadge(evalItem.performance_grade)}
                                                </div>
                                            </td>

                                            {/* Evaluator */}
                                            <td className="py-3 px-4">
                                                <div className="text-slate-300 font-medium">
                                                    {evalItem.evaluator?.name || 'Unknown Evaluator'}
                                                </div>
                                                <div className="text-[10px] text-slate-500">HOD / Manager</div>
                                            </td>

                                            {/* HR Reviewer */}
                                            <td className="py-3 px-4">
                                                {evalItem.hrReviewer ? (
                                                    <div>
                                                        <div className="text-slate-300 font-medium">
                                                            {evalItem.hrReviewer.name}
                                                        </div>
                                                        <div className="text-[10px] text-emerald-400">
                                                            {evalItem.hr_actioned_at
                                                                ? new Date(evalItem.hr_actioned_at).toLocaleDateString('en-GB', {
                                                                      day: '2-digit',
                                                                      month: 'short',
                                                                  })
                                                                : 'Reviewed'}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <span className="text-[11px] text-slate-500 italic">
                                                        Pending HR Sign-off
                                                    </span>
                                                )}
                                            </td>

                                            {/* Status */}
                                            <td className="py-3 px-4">
                                                {renderStatusBadge(evalItem.status, evalItem.is_bypassed_by_hr)}
                                            </td>

                                            {/* Actions */}
                                            <td className="py-3 px-4 text-right">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    {/* View Details */}
                                                    <button
                                                        onClick={() => openDetailsDrawer(evalItem)}
                                                        title="View Appraisal Breakdown"
                                                        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </button>

                                                    {/* PDF Export */}
                                                    <a
                                                        href={`/evaluations/${evalItem.id}/pdf`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        title="Download Official PDF Record"
                                                        className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-slate-800 transition"
                                                    >
                                                        <Download className="w-4 h-4" />
                                                    </a>

                                                    {/* HR Review Action */}
                                                    {canHrReview && evalItem.status === 'submitted_to_hr' && (
                                                        <button
                                                            onClick={() => openHrReviewModal(evalItem)}
                                                            title="HR Sign-Off & Review"
                                                            className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs flex items-center gap-1 shadow transition"
                                                        >
                                                            <ShieldCheck className="w-3.5 h-3.5" />
                                                            HR Sign-Off
                                                        </button>
                                                    )}

                                                    {/* HR Direct Bypass on Draft */}
                                                    {canHrReview && evalItem.status === 'draft' && (
                                                        <button
                                                            onClick={() => openHrReviewModal(evalItem)}
                                                            title="HR Direct Managerial Bypass"
                                                            className="p-1.5 rounded-lg text-amber-400 hover:bg-amber-500/10 transition"
                                                        >
                                                            <ShieldCheck className="w-4 h-4" />
                                                        </button>
                                                    )}

                                                    {/* Edit Draft */}
                                                    {evalItem.status === 'draft' && (
                                                        <button
                                                            onClick={() => openCreateModal(evalItem)}
                                                            title="Edit Draft"
                                                            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                                                        >
                                                            <Edit3 className="w-4 h-4" />
                                                        </button>
                                                    )}

                                                    {/* Delete Draft */}
                                                    {evalItem.status === 'draft' && (
                                                        <button
                                                            onClick={() => {
                                                                if (confirm('Delete this evaluation draft?')) {
                                                                    router.delete(`/evaluations/${evalItem.id}`);
                                                                }
                                                            }}
                                                            title="Delete Draft"
                                                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {evaluations.last_page > 1 && (
                        <div className="p-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                            <div>
                                Showing Page {evaluations.current_page} of {evaluations.last_page} ({evaluations.total} records)
                            </div>
                            <div className="flex items-center gap-1">
                                {evaluations.links.map((link, idx) => (
                                    <button
                                        key={idx}
                                        disabled={!link.url}
                                        onClick={() => link.url && router.get(link.url)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                                            link.active
                                                ? 'bg-indigo-600 text-white'
                                                : 'text-slate-400 hover:bg-slate-800 disabled:opacity-30'
                                        }`}
                                        dangerouslySetInnerHTML={{ __html: link.label }}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* MODAL 1: Create / Edit Appraisal Modal */}
                {isAppraisalModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto">
                        <div className="relative w-full max-w-3xl rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden my-8">
                            {/* Modal Header */}
                            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
                                <div className="flex items-center gap-2">
                                    <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400">
                                        <Award className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="text-base font-bold text-white">
                                            {editingEvaluation ? 'Edit Performance Appraisal' : 'New Performance & KPI Appraisal'}
                                        </h3>
                                        <p className="text-xs text-slate-400">
                                            Structured multi-criteria evaluation with live score weighting
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setIsAppraisalModalOpen(false)}
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Modal Body */}
                            <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
                                {/* Top Form Row: Employee, Period, Date */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {/* Employee Selector */}
                                    <div>
                                        <label className="block text-xs font-medium text-slate-300 mb-1.5">
                                            Employee *
                                        </label>
                                        <select
                                            disabled={Boolean(editingEvaluation)}
                                            value={data.employee_id}
                                            onChange={(e) => setData('employee_id', e.target.value)}
                                            className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                                        >
                                            <option value="">Select Employee...</option>
                                            {employees.map((emp) => (
                                                <option key={emp.id} value={emp.id}>
                                                    {emp.full_name} ({emp.emp_no}) - {emp.department?.name || 'No Dept'}
                                                </option>
                                            ))}
                                        </select>
                                        {errors.employee_id && (
                                            <p className="text-[11px] text-rose-400 mt-1">{errors.employee_id}</p>
                                        )}
                                    </div>

                                    {/* Period Selector */}
                                    <div>
                                        <label className="block text-xs font-medium text-slate-300 mb-1.5">
                                            Evaluation Period *
                                        </label>
                                        <input
                                            type="text"
                                            list="period-options"
                                            value={data.evaluation_period}
                                            onChange={(e) => setData('evaluation_period', e.target.value)}
                                            placeholder="e.g. Annual 2026, Q1 2026"
                                            className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                                        />
                                        <datalist id="period-options">
                                            {standardPeriods.map((p) => (
                                                <option key={p} value={p} />
                                            ))}
                                        </datalist>
                                        {errors.evaluation_period && (
                                            <p className="text-[11px] text-rose-400 mt-1">{errors.evaluation_period}</p>
                                        )}
                                    </div>

                                    {/* Evaluation Date */}
                                    <div>
                                        <label className="block text-xs font-medium text-slate-300 mb-1.5">
                                            Evaluation Date *
                                        </label>
                                        <input
                                            type="date"
                                            value={data.evaluation_date}
                                            onChange={(e) => setData('evaluation_date', e.target.value)}
                                            className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                                        />
                                        {errors.evaluation_date && (
                                            <p className="text-[11px] text-rose-400 mt-1">{errors.evaluation_date}</p>
                                        )}
                                    </div>
                                </div>

                                {/* Live Scorecard Banner */}
                                <div className="p-4 rounded-xl bg-gradient-to-r from-indigo-950/40 via-slate-900 to-indigo-950/40 border border-indigo-500/30 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-400">
                                            <Sparkles className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                                                Live Calculated Overall Score
                                            </div>
                                            <div className="text-2xl font-black text-white flex items-baseline gap-2">
                                                {liveCalculatedScore.score.toFixed(1)}
                                                <span className="text-xs font-normal text-slate-400">/ 100</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-1">
                                            Predicted Grade
                                        </div>
                                        {renderGradeBadge(liveCalculatedScore.grade)}
                                    </div>
                                </div>

                                {/* Criteria Scoring Matrix */}
                                <div className="space-y-4">
                                    <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                                        <Sliders className="w-4 h-4 text-indigo-400" />
                                        Structured KPI & Competency Ratings
                                    </h4>

                                    <div className="space-y-4">
                                        {criteriaDefinitions.map((crit) => {
                                            const currentVal = data.ratings_json[crit.key]?.score ?? 75;
                                            const weightedContrib = ((currentVal * crit.weight) / 100).toFixed(1);

                                            return (
                                                <div
                                                    key={crit.key}
                                                    className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 hover:border-slate-700 transition space-y-3"
                                                >
                                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                                        <div>
                                                            <div className="font-semibold text-slate-200 text-xs flex items-center gap-2">
                                                                <span>{crit.title}</span>
                                                                <span className="px-2 py-0.5 rounded text-[10px] bg-indigo-500/10 text-indigo-400 font-bold border border-indigo-500/20">
                                                                    Weight: {crit.weight}%
                                                                </span>
                                                            </div>
                                                            <p className="text-[11px] text-slate-400 mt-0.5">
                                                                {crit.description}
                                                            </p>
                                                        </div>

                                                        {/* Score Display & Contribution */}
                                                        <div className="flex items-center gap-3 self-end sm:self-center">
                                                            <div className="text-right">
                                                                <span className="text-base font-bold text-white">
                                                                    {currentVal}
                                                                </span>
                                                                <span className="text-[10px] text-slate-400"> / 100</span>
                                                                <div className="text-[10px] text-emerald-400 font-medium">
                                                                    +{weightedContrib} pts
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Slider */}
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-[10px] text-slate-500 font-semibold">0</span>
                                                        <input
                                                            type="range"
                                                            min={0}
                                                            max={100}
                                                            step={1}
                                                            value={currentVal}
                                                            onChange={(e) => {
                                                                const val = Number(e.target.value);
                                                                setData('ratings_json', {
                                                                    ...data.ratings_json,
                                                                    [crit.key]: {
                                                                        ...data.ratings_json[crit.key],
                                                                        score: val,
                                                                    },
                                                                });
                                                            }}
                                                            className="w-full accent-indigo-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                                                        />
                                                        <span className="text-[10px] text-slate-500 font-semibold">100</span>
                                                    </div>

                                                    {/* Criterion Remarks */}
                                                    <div>
                                                        <input
                                                            type="text"
                                                            placeholder={`Specific observations for ${crit.title.toLowerCase()} (optional)...`}
                                                            value={data.ratings_json[crit.key]?.remarks || ''}
                                                            onChange={(e) => {
                                                                setData('ratings_json', {
                                                                    ...data.ratings_json,
                                                                    [crit.key]: {
                                                                        ...data.ratings_json[crit.key],
                                                                        remarks: e.target.value,
                                                                    },
                                                                });
                                                            }}
                                                            className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-[11px] text-slate-300 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                                                        />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* General HOD Comments */}
                                <div>
                                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                                        Department Head (Evaluator) Qualitative Comments & Recommendations
                                    </label>
                                    <textarea
                                        rows={3}
                                        value={data.hod_comments}
                                        onChange={(e) => setData('hod_comments', e.target.value)}
                                        placeholder="Highlight major achievements, areas for professional development, growth trajectory..."
                                        className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                                    />
                                </div>
                            </div>

                            {/* Modal Footer */}
                            <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-950/60">
                                <button
                                    type="button"
                                    onClick={() => setIsAppraisalModalOpen(false)}
                                    className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white transition"
                                >
                                    Cancel
                                </button>

                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        disabled={processing}
                                        onClick={() => handleSubmitAppraisal(false)}
                                        className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition"
                                    >
                                        Save as Draft
                                    </button>

                                    <button
                                        type="button"
                                        disabled={processing}
                                        onClick={() => handleSubmitAppraisal(true)}
                                        className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30 transition transform active:scale-95"
                                    >
                                        Submit to HR for Sign-Off
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* MODAL 2: HR Review & Sign-Off Modal */}
                {isHrReviewModalOpen && activeEvaluation && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto">
                        <div className="relative w-full max-w-2xl rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden my-8">
                            {/* Modal Header */}
                            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
                                <div className="flex items-center gap-2">
                                    <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
                                        <ShieldCheck className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="text-base font-bold text-white">
                                            HR Executive Appraisal Sign-Off
                                        </h3>
                                        <p className="text-xs text-slate-400">
                                            Review HOD submission, verify score consistency, and finalize official record
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setIsHrReviewModalOpen(false)}
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Modal Body */}
                            <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
                                {/* Employee Summary Box */}
                                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                                    <div>
                                        <h4 className="text-sm font-bold text-white">
                                            {activeEvaluation.employee.full_name}
                                        </h4>
                                        <div className="text-xs text-slate-400 mt-0.5">
                                            {activeEvaluation.employee.emp_no} • {activeEvaluation.employee.department?.name} • {activeEvaluation.evaluation_period}
                                        </div>
                                        <div className="text-[11px] text-slate-500 mt-1">
                                            Evaluated by {activeEvaluation.evaluator?.name || 'Department Head'} on {activeEvaluation.evaluation_date}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-xl font-black text-white">
                                            {activeEvaluation.overall_score.toFixed(1)} / 100
                                        </div>
                                        {renderGradeBadge(activeEvaluation.performance_grade)}
                                    </div>
                                </div>

                                {/* HOD Comments Preview */}
                                {activeEvaluation.hod_comments && (
                                    <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 text-xs">
                                        <span className="font-semibold text-slate-300 block mb-1">
                                            HOD Evaluator Remarks:
                                        </span>
                                        <p className="text-slate-400 italic">"{activeEvaluation.hod_comments}"</p>
                                    </div>
                                )}

                                {/* Decision Selector */}
                                <div>
                                    <label className="block text-xs font-medium text-slate-300 mb-2">
                                        Sign-Off Decision *
                                    </label>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setHrData('decision', 'confirm')}
                                            className={`p-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition ${
                                                hrData.decision === 'confirm'
                                                    ? 'bg-emerald-600/20 text-emerald-300 border-emerald-500/50 shadow'
                                                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                                            }`}
                                        >
                                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                            Confirm & Lock
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => setHrData('decision', 'amend_and_confirm')}
                                            className={`p-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition ${
                                                hrData.decision === 'amend_and_confirm'
                                                    ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/50 shadow'
                                                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                                            }`}
                                        >
                                            <Edit3 className="w-4 h-4 text-indigo-400" />
                                            Amend & Confirm
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => setHrData('decision', 'reject')}
                                            className={`p-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition ${
                                                hrData.decision === 'reject'
                                                    ? 'bg-rose-600/20 text-rose-300 border-rose-500/50 shadow'
                                                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                                            }`}
                                        >
                                            <AlertCircle className="w-4 h-4 text-rose-400" />
                                            Return / Reject
                                        </button>
                                    </div>
                                </div>

                                {/* HR Comments */}
                                <div>
                                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                                        Human Resources Final Sign-Off Remarks
                                    </label>
                                    <textarea
                                        rows={3}
                                        value={hrData.hr_comments}
                                        onChange={(e) => setHrData('hr_comments', e.target.value)}
                                        placeholder="Executive comments regarding promotion eligibility, salary increment, or performance notes..."
                                        className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                                    />
                                </div>

                                {/* Direct Bypass notice */}
                                {activeEvaluation.status === 'draft' && (
                                    <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-center gap-2">
                                        <ShieldCheck className="w-4 h-4 flex-shrink-0" />
                                        <span>
                                            This evaluation is currently in draft. Finalizing will record it via <strong>HR Direct Managerial Bypass</strong>.
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* Modal Footer */}
                            <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-950/60">
                                <button
                                    type="button"
                                    onClick={() => setIsHrReviewModalOpen(false)}
                                    className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white transition"
                                >
                                    Cancel
                                </button>

                                <button
                                    type="button"
                                    disabled={hrProcessing}
                                    onClick={handleSubmitHrReview}
                                    className={`px-5 py-2 rounded-xl text-xs font-semibold shadow-lg transition transform active:scale-95 text-white ${
                                        hrData.decision === 'reject'
                                            ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/30'
                                            : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/30'
                                    }`}
                                >
                                    {hrData.decision === 'reject' ? 'Return to HOD' : 'Finalize & Sign-Off'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* DRAWER: Detail Inspector */}
                {isDetailDrawerOpen && activeEvaluation && (
                    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs">
                        <div className="w-full max-w-xl h-full bg-slate-900 border-l border-slate-800 p-6 overflow-y-auto space-y-6 shadow-2xl">
                            {/* Drawer Header */}
                            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                                <div className="flex items-center gap-2">
                                    <Award className="w-5 h-5 text-indigo-400" />
                                    <h3 className="text-base font-bold text-white">Appraisal Details</h3>
                                </div>
                                <button
                                    onClick={() => setIsDetailDrawerOpen(false)}
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Employee Profile Header */}
                            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h4 className="text-base font-bold text-white">
                                            {activeEvaluation.employee.full_name}
                                        </h4>
                                        <p className="text-xs text-slate-400 mt-0.5">
                                            {activeEvaluation.employee.emp_no} • {activeEvaluation.employee.designation?.title || 'Staff'}
                                        </p>
                                        <p className="text-xs text-slate-500">
                                            {activeEvaluation.employee.department?.name || 'No Dept'}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-2xl font-black text-white">
                                            {activeEvaluation.overall_score.toFixed(1)}
                                        </div>
                                        {renderGradeBadge(activeEvaluation.performance_grade)}
                                    </div>
                                </div>
                            </div>

                            {/* Appraisal Metadata */}
                            <div className="grid grid-cols-2 gap-3 text-xs">
                                <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
                                    <span className="text-[10px] text-slate-500 uppercase block font-semibold">
                                        Evaluation Period
                                    </span>
                                    <span className="text-slate-200 font-medium">
                                        {activeEvaluation.evaluation_period}
                                    </span>
                                </div>
                                <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
                                    <span className="text-[10px] text-slate-500 uppercase block font-semibold">
                                        Evaluation Date
                                    </span>
                                    <span className="text-slate-200 font-medium">
                                        {activeEvaluation.evaluation_date}
                                    </span>
                                </div>
                                <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
                                    <span className="text-[10px] text-slate-500 uppercase block font-semibold">
                                        Evaluator (HOD)
                                    </span>
                                    <span className="text-slate-200 font-medium">
                                        {activeEvaluation.evaluator?.name || 'N/A'}
                                    </span>
                                </div>
                                <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800">
                                    <span className="text-[10px] text-slate-500 uppercase block font-semibold">
                                        Workflow Status
                                    </span>
                                    {renderStatusBadge(activeEvaluation.status, activeEvaluation.is_bypassed_by_hr)}
                                </div>
                            </div>

                            {/* Criteria Breakdown */}
                            <div className="space-y-3">
                                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                                    Criteria Breakdown
                                </h4>
                                <div className="space-y-2">
                                    {Object.entries(activeEvaluation.ratings_json || {}).map(([key, item]) => (
                                        <div
                                            key={key}
                                            className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1.5"
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="font-semibold text-slate-200">
                                                    {item.title || key}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-slate-400 font-mono">
                                                        {item.score} / 100
                                                    </span>
                                                    <span className="text-emerald-400 font-bold font-mono">
                                                        +{item.weighted_score.toFixed(1)} pts
                                                    </span>
                                                </div>
                                            </div>
                                            {item.remarks && (
                                                <p className="text-[11px] text-slate-400 italic">
                                                    "{item.remarks}"
                                                </p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Qualitative Comments */}
                            {activeEvaluation.hod_comments && (
                                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs">
                                    <span className="font-semibold text-slate-300 block mb-1">
                                        HOD Observations & Comments:
                                    </span>
                                    <p className="text-slate-400 whitespace-pre-wrap">
                                        {activeEvaluation.hod_comments}
                                    </p>
                                </div>
                            )}

                            {activeEvaluation.hr_comments && (
                                <div className="p-4 rounded-xl bg-slate-950 border border-indigo-500/20 text-xs">
                                    <span className="font-semibold text-indigo-300 block mb-1">
                                        HR Review Remarks:
                                    </span>
                                    <p className="text-slate-400 whitespace-pre-wrap">
                                        {activeEvaluation.hr_comments}
                                    </p>
                                </div>
                            )}

                            {/* PDF Button */}
                            <div className="pt-4 border-t border-slate-800">
                                <a
                                    href={`/evaluations/${activeEvaluation.id}/pdf`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/30 transition"
                                >
                                    <Download className="w-4 h-4" />
                                    Download Official Printable PDF
                                </a>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </AuthenticatedLayout>
    );
}
