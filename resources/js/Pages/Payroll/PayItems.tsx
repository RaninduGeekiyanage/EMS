import React, { useState } from 'react';
import { Head, router, useForm } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import {
    Receipt,
    Plus,
    Sparkles,
    Search,
    Filter,
    Edit2,
    Trash2,
    CheckCircle2,
    AlertCircle,
    X,
    Users,
    DollarSign,
    ShieldCheck,
    Layers,
    UserCheck,
    Percent,
    ArrowUpRight,
    ArrowDownRight,
    Info,
    Calendar,
} from 'lucide-react';

interface PayItem {
    id: string;
    code: string;
    name: string;
    item_type: 'earning' | 'deduction';
    calculation_type: 'fixed' | 'percentage_of_basic' | 'formula';
    default_amount: number;
    percentage: number | null;
    is_epf_eligible: boolean;
    is_etf_eligible: boolean;
    is_taxable: boolean;
    is_active: boolean;
    is_system_reserved: boolean;
    display_order: number;
    description: string | null;
    employee_pay_items_count?: number;
}

interface EmployeePayItem {
    id: string;
    employee_id: string;
    pay_item_id: string;
    amount: number;
    effective_from: string;
    effective_to: string | null;
    is_active: boolean;
    remarks: string | null;
    employee?: {
        id: string;
        emp_no: string;
        full_name: string;
        department?: { name: string } | null;
    };
    pay_item?: PayItem;
}

interface EmployeeOption {
    id: string;
    emp_no: string;
    full_name: string;
    department?: { name: string } | null;
}

interface Props {
    payItems: PayItem[];
    employeePayItems: EmployeePayItem[];
    employees: EmployeeOption[];
    metrics: {
        total_items: number;
        active_earnings: number;
        active_deductions: number;
        epf_eligible_count: number;
        assigned_staff_count: number;
    };
}

export default function PayItems({
    payItems,
    employeePayItems,
    employees,
    metrics,
}: Props) {
    const [activeTab, setActiveTab] = useState<'catalog' | 'allocations'>('catalog');
    const [searchQuery, setSearchQuery] = useState('');
    const [typeFilter, setTypeFilter] = useState<'all' | 'earning' | 'deduction'>('all');
    
    // Modals
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<PayItem | null>(null);
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);

    // Pay Item Form
    const payItemForm = useForm({
        code: '',
        name: '',
        item_type: 'earning',
        calculation_type: 'fixed',
        default_amount: 0,
        percentage: '',
        is_epf_eligible: false,
        is_etf_eligible: false,
        is_taxable: false,
        is_active: true,
        display_order: 10,
        description: '',
    });

    // Employee Assignment Form
    const assignForm = useForm({
        employee_id: employees[0]?.id ?? '',
        pay_item_id: payItems[0]?.id ?? '',
        amount: payItems[0]?.default_amount ?? 0,
        effective_from: new Date().toISOString().slice(0, 10),
        effective_to: '',
        is_active: true,
        remarks: '',
    });

    const formatLKR = (val: number) => {
        return new Intl.NumberFormat('en-LK', {
            style: 'currency',
            currency: 'LKR',
            minimumFractionDigits: 2,
        }).format(val);
    };

    const handleOpenCreateModal = () => {
        setEditingItem(null);
        payItemForm.reset();
        payItemForm.setData({
            code: '',
            name: '',
            item_type: 'earning',
            calculation_type: 'fixed',
            default_amount: 0,
            percentage: '',
            is_epf_eligible: false,
            is_etf_eligible: false,
            is_taxable: false,
            is_active: true,
            display_order: payItems.length + 1,
            description: '',
        });
        setIsCreateModalOpen(true);
    };

    const handleOpenEditModal = (item: PayItem) => {
        setEditingItem(item);
        payItemForm.setData({
            code: item.code,
            name: item.name,
            item_type: item.item_type,
            calculation_type: item.calculation_type,
            default_amount: item.default_amount,
            percentage: item.percentage !== null ? String(item.percentage) : '',
            is_epf_eligible: item.is_epf_eligible,
            is_etf_eligible: item.is_etf_eligible,
            is_taxable: item.is_taxable,
            is_active: item.is_active,
            display_order: item.display_order,
            description: item.description ?? '',
        });
        setIsCreateModalOpen(true);
    };

    const handleSavePayItem = (e: React.FormEvent) => {
        e.preventDefault();
        if (editingItem) {
            payItemForm.put(`/payroll/pay-items/${editingItem.id}`, {
                onSuccess: () => {
                    setIsCreateModalOpen(false);
                    setEditingItem(null);
                },
            });
        } else {
            payItemForm.post('/payroll/pay-items', {
                onSuccess: () => {
                    setIsCreateModalOpen(false);
                    payItemForm.reset();
                },
            });
        }
    };

    const handleDeletePayItem = (item: PayItem) => {
        if (item.is_system_reserved) return;
        if (confirm(`Are you sure you want to delete pay item '${item.code}'?`)) {
            router.delete(`/payroll/pay-items/${item.id}`);
        }
    };

    const handleSeedStatutory = () => {
        if (confirm('Sync Sri Lankan standard pay items (Basic, BRA 2005, BRA 2016, Incentives, Advances, Loans)?')) {
            router.post('/payroll/pay-items/seed-statutory');
        }
    };

    const handleAssignPayItemChange = (payItemId: string) => {
        const selected = payItems.find((p) => p.id === payItemId);
        assignForm.setData({
            ...assignForm.data,
            pay_item_id: payItemId,
            amount: selected?.default_amount ?? 0,
        });
    };

    const handleSaveAssignment = (e: React.FormEvent) => {
        e.preventDefault();
        assignForm.post('/payroll/pay-items/assign-employee', {
            onSuccess: () => {
                setIsAssignModalOpen(false);
                assignForm.reset();
            },
        });
    };

    const handleRemoveAssignment = (id: string) => {
        if (confirm('Remove this recurring pay item allocation?')) {
            router.delete(`/payroll/pay-items/employee-items/${id}`);
        }
    };

    const filteredCatalog = payItems.filter((item) => {
        const matchesSearch =
            item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (item.description ?? '').toLowerCase().includes(searchQuery.toLowerCase());
        const matchesType = typeFilter === 'all' || item.item_type === typeFilter;
        return matchesSearch && matchesType;
    });

    const filteredAllocations = employeePayItems.filter((alloc) => {
        const empName = alloc.employee?.full_name ?? '';
        const empNo = alloc.employee?.emp_no ?? '';
        const itemName = alloc.pay_item?.name ?? '';
        const itemCode = alloc.pay_item?.code ?? '';
        const q = searchQuery.toLowerCase();
        return (
            empName.toLowerCase().includes(q) ||
            empNo.toLowerCase().includes(q) ||
            itemName.toLowerCase().includes(q) ||
            itemCode.toLowerCase().includes(q)
        );
    });

    return (
        <AuthenticatedLayout>
            <Head title="Pay Items Master & Recurring Formulas" />

            <div className="space-y-6">
                {/* Header Banner */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 p-6 rounded-2xl shadow-xl border border-indigo-900/40 text-white">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                M04 Enterprise Suite
                            </span>
                            <span className="text-xs text-slate-400">Payroll Engine Master</span>
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight flex items-center gap-3">
                            <Receipt className="w-8 h-8 text-indigo-400" />
                            Pay Items Master & Formulas
                        </h1>
                        <p className="text-sm text-slate-300 mt-1 max-w-2xl">
                            Configure statutory wage components (BRA 2005/2016), fixed & percentage recurring allowances, and automated staff payroll deductions.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5">
                        <button
                            onClick={handleSeedStatutory}
                            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 border border-indigo-400/30 transition flex items-center gap-1.5 shadow"
                        >
                            <Sparkles className="w-4 h-4 text-indigo-300" />
                            Sync SL Statutory Items
                        </button>

                        <button
                            onClick={() => setIsAssignModalOpen(true)}
                            className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition flex items-center gap-1.5 shadow-lg shadow-emerald-600/20"
                        >
                            <UserCheck className="w-4 h-4" />
                            Assign to Staff
                        </button>

                        <button
                            onClick={handleOpenCreateModal}
                            className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition flex items-center gap-1.5 shadow-lg shadow-indigo-600/25"
                        >
                            <Plus className="w-4 h-4" />
                            New Pay Item
                        </button>
                    </div>
                </div>

                {/* KPI Metrics */}
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Catalog Items</span>
                            <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                                <Receipt className="w-4 h-4" />
                            </div>
                        </div>
                        <p className="text-2xl font-bold text-slate-900 dark:text-white mt-2">{metrics.total_items}</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Defined wage components</p>
                    </div>

                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Active Earnings</span>
                            <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                                <ArrowUpRight className="w-4 h-4" />
                            </div>
                        </div>
                        <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-2">{metrics.active_earnings}</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Allowances & Basic items</p>
                    </div>

                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Deductions</span>
                            <div className="w-7 h-7 rounded-lg bg-rose-50 dark:bg-rose-950/60 flex items-center justify-center text-rose-600 dark:text-rose-400">
                                <ArrowDownRight className="w-4 h-4" />
                            </div>
                        </div>
                        <p className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-2">{metrics.active_deductions}</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Welfare, advances & loans</p>
                    </div>

                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">EPF / ETF Eligible</span>
                            <div className="w-7 h-7 rounded-lg bg-sky-50 dark:bg-sky-950/60 flex items-center justify-center text-sky-600 dark:text-sky-400">
                                <ShieldCheck className="w-4 h-4" />
                            </div>
                        </div>
                        <p className="text-2xl font-bold text-sky-600 dark:text-sky-400 mt-2">{metrics.epf_eligible_count}</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Statutory base earnings</p>
                    </div>

                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm col-span-2 lg:col-span-1">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Staff Enrolled</span>
                            <div className="w-7 h-7 rounded-lg bg-purple-50 dark:bg-purple-950/60 flex items-center justify-center text-purple-600 dark:text-purple-400">
                                <Users className="w-4 h-4" />
                            </div>
                        </div>
                        <p className="text-2xl font-bold text-purple-600 dark:text-purple-400 mt-2">{metrics.assigned_staff_count}</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">With active recurring items</p>
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
                    {/* Tabs & Search Controls */}
                    <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
                        <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl w-full md:w-auto">
                            <button
                                onClick={() => setActiveTab('catalog')}
                                className={`px-4 py-2 rounded-lg text-xs font-semibold transition ${
                                    activeTab === 'catalog'
                                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                                }`}
                            >
                                Pay Items Catalog ({payItems.length})
                            </button>
                            <button
                                onClick={() => setActiveTab('allocations')}
                                className={`px-4 py-2 rounded-lg text-xs font-semibold transition ${
                                    activeTab === 'allocations'
                                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                                }`}
                            >
                                Recurring Staff Allocations ({employeePayItems.length})
                            </button>
                        </div>

                        <div className="flex items-center gap-3 w-full md:w-auto">
                            <div className="relative flex-1 sm:w-64">
                                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder={activeTab === 'catalog' ? 'Search pay items by code or name...' : 'Search staff allocations...'}
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-9 pr-3 py-1.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                />
                            </div>

                            {activeTab === 'catalog' && (
                                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                                    <button
                                        onClick={() => setTypeFilter('all')}
                                        className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition ${
                                            typeFilter === 'all'
                                                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                                                : 'text-slate-600 dark:text-slate-400'
                                        }`}
                                    >
                                        All
                                    </button>
                                    <button
                                        onClick={() => setTypeFilter('earning')}
                                        className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition ${
                                            typeFilter === 'earning'
                                                ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                                                : 'text-slate-600 dark:text-slate-400'
                                        }`}
                                    >
                                        Earnings
                                    </button>
                                    <button
                                        onClick={() => setTypeFilter('deduction')}
                                        className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition ${
                                            typeFilter === 'deduction'
                                                ? 'bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 shadow-xs'
                                                : 'text-slate-600 dark:text-slate-400'
                                        }`}
                                    >
                                        Deductions
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Tab 1: Pay Item Master Catalog */}
                    {activeTab === 'catalog' && (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
                                <thead className="bg-slate-50/75 dark:bg-slate-800/50 text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 font-semibold">
                                    <tr>
                                        <th className="py-3 px-4">Code & Name</th>
                                        <th className="py-3 px-3">Classification</th>
                                        <th className="py-3 px-3">Calculation Rule</th>
                                        <th className="py-3 px-3">Default Value</th>
                                        <th className="py-3 px-3">Statutory & Tax</th>
                                        <th className="py-3 px-3">Active Staff</th>
                                        <th className="py-3 px-3">Status</th>
                                        <th className="py-3 px-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                                    {filteredCatalog.length === 0 ? (
                                        <tr>
                                            <td colSpan={8} className="py-12 text-center text-slate-400">
                                                No pay items matching current filter criteria.
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredCatalog.map((item) => (
                                            <tr key={item.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                                                <td className="py-3.5 px-4">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-mono font-bold text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-[11px] border border-slate-200 dark:border-slate-700">
                                                            {item.code}
                                                        </span>
                                                        {item.is_system_reserved && (
                                                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 font-semibold">
                                                                Reserved
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-1">{item.name}</p>
                                                    {item.description && (
                                                        <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">{item.description}</p>
                                                    )}
                                                </td>

                                                <td className="py-3.5 px-3">
                                                    {item.item_type === 'earning' ? (
                                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                                            <ArrowUpRight className="w-3 h-3" />
                                                            Earning
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                                                            <ArrowDownRight className="w-3 h-3" />
                                                            Deduction
                                                        </span>
                                                    )}
                                                </td>

                                                <td className="py-3.5 px-3">
                                                    {item.calculation_type === 'fixed' && (
                                                        <span className="text-xs text-slate-700 dark:text-slate-300 font-semibold">Fixed Amount</span>
                                                    )}
                                                    {item.calculation_type === 'percentage_of_basic' && (
                                                        <span className="inline-flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 font-semibold">
                                                            <Percent className="w-3 h-3" />
                                                            {item.percentage}% of Basic
                                                        </span>
                                                    )}
                                                    {item.calculation_type === 'formula' && (
                                                        <span className="text-xs text-purple-600 dark:text-purple-400 font-semibold">Formula Rule</span>
                                                    )}
                                                </td>

                                                <td className="py-3.5 px-3 font-mono font-bold text-slate-900 dark:text-white">
                                                    {item.calculation_type === 'fixed'
                                                        ? formatLKR(Number(item.default_amount))
                                                        : `${item.percentage ?? 0}%`}
                                                </td>

                                                <td className="py-3.5 px-3">
                                                    <div className="flex flex-wrap gap-1">
                                                        {item.is_epf_eligible && (
                                                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
                                                                EPF
                                                            </span>
                                                        )}
                                                        {item.is_etf_eligible && (
                                                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
                                                                ETF
                                                            </span>
                                                        )}
                                                        {item.is_taxable ? (
                                                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                                                Taxable
                                                            </span>
                                                        ) : (
                                                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-500">
                                                                Non-Tax
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>

                                                <td className="py-3.5 px-3 font-semibold text-slate-700 dark:text-slate-300">
                                                    {item.employee_pay_items_count ?? 0} staff
                                                </td>

                                                <td className="py-3.5 px-3">
                                                    {item.is_active ? (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100/60 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400">
                                                            <CheckCircle2 className="w-3 h-3" />
                                                            Active
                                                        </span>
                                                    ) : (
                                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-400">
                                                            Inactive
                                                        </span>
                                                    )}
                                                </td>

                                                <td className="py-3.5 px-4 text-right">
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        <button
                                                            onClick={() => handleOpenEditModal(item)}
                                                            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-slate-800 transition"
                                                            title="Edit Pay Item"
                                                        >
                                                            <Edit2 className="w-3.5 h-3.5" />
                                                        </button>
                                                        {!item.is_system_reserved && (
                                                            <button
                                                                onClick={() => handleDeletePayItem(item)}
                                                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-slate-800 transition"
                                                                title="Delete Pay Item"
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
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
                    )}

                    {/* Tab 2: Recurring Staff Allocations */}
                    {activeTab === 'allocations' && (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
                                <thead className="bg-slate-50/75 dark:bg-slate-800/50 text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 font-semibold">
                                    <tr>
                                        <th className="py-3 px-4">Employee</th>
                                        <th className="py-3 px-3">Pay Item</th>
                                        <th className="py-3 px-3">Type</th>
                                        <th className="py-3 px-3">Recurring Amount</th>
                                        <th className="py-3 px-3">Effective Range</th>
                                        <th className="py-3 px-3">Remarks</th>
                                        <th className="py-3 px-3">Status</th>
                                        <th className="py-3 px-4 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                                    {filteredAllocations.length === 0 ? (
                                        <tr>
                                            <td colSpan={8} className="py-12 text-center text-slate-400">
                                                No recurring employee allocations found. Click "+ Assign to Staff" to allocate allowances or deductions.
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredAllocations.map((alloc) => (
                                            <tr key={alloc.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                                                <td className="py-3.5 px-4">
                                                    <span className="font-mono text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                                                        {alloc.employee?.emp_no}
                                                    </span>
                                                    <p className="text-xs font-bold text-slate-900 dark:text-white mt-0.5">
                                                        {alloc.employee?.full_name}
                                                    </p>
                                                    <p className="text-[11px] text-slate-400">{alloc.employee?.department?.name ?? 'General'}</p>
                                                </td>

                                                <td className="py-3.5 px-3">
                                                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                                                        {alloc.pay_item?.code}
                                                    </span>
                                                    <p className="text-[11px] text-slate-400">{alloc.pay_item?.name}</p>
                                                </td>

                                                <td className="py-3.5 px-3">
                                                    {alloc.pay_item?.item_type === 'earning' ? (
                                                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                                            Earning
                                                        </span>
                                                    ) : (
                                                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                                                            Deduction
                                                        </span>
                                                    )}
                                                </td>

                                                <td className="py-3.5 px-3 font-mono font-bold text-slate-900 dark:text-white text-sm">
                                                    {formatLKR(Number(alloc.amount))}
                                                </td>

                                                <td className="py-3.5 px-3 text-[11px]">
                                                    <span className="text-slate-700 dark:text-slate-300 font-semibold">{alloc.effective_from}</span>
                                                    <span className="text-slate-400 mx-1">→</span>
                                                    <span className="text-slate-500">{alloc.effective_to ? alloc.effective_to : 'Ongoing'}</span>
                                                </td>

                                                <td className="py-3.5 px-3 text-[11px] text-slate-400 max-w-xs truncate">
                                                    {alloc.remarks ?? '—'}
                                                </td>

                                                <td className="py-3.5 px-3">
                                                    {alloc.is_active ? (
                                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                                                            Active
                                                        </span>
                                                    ) : (
                                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-500">
                                                            Paused
                                                        </span>
                                                    )}
                                                </td>

                                                <td className="py-3.5 px-4 text-right">
                                                    <button
                                                        onClick={() => handleRemoveAssignment(alloc.id)}
                                                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-slate-800 transition"
                                                        title="Remove Allocation"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* Modal: New / Edit Pay Item */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <Receipt className="w-5 h-5 text-indigo-500" />
                                {editingItem ? `Edit Pay Item (${editingItem.code})` : 'Create Custom Pay Item'}
                            </h3>
                            <button
                                onClick={() => setIsCreateModalOpen(false)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSavePayItem} className="p-6 space-y-4 text-xs">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                        Unique Code <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        disabled={editingItem?.is_system_reserved || !!editingItem}
                                        value={payItemForm.data.code}
                                        onChange={(e) => payItemForm.setData('code', e.target.value.toUpperCase())}
                                        placeholder="e.g. MEAL_ALLOWANCE"
                                        className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-xs uppercase disabled:opacity-60 text-slate-900 dark:text-white"
                                        required
                                    />
                                    {payItemForm.errors.code && (
                                        <p className="text-rose-500 text-[11px] mt-1">{payItemForm.errors.code}</p>
                                    )}
                                </div>

                                <div>
                                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                        Display Name <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={payItemForm.data.name}
                                        onChange={(e) => payItemForm.setData('name', e.target.value)}
                                        placeholder="e.g. Monthly Meal Allowance"
                                        className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                        Classification
                                    </label>
                                    <select
                                        disabled={editingItem?.is_system_reserved}
                                        value={payItemForm.data.item_type}
                                        onChange={(e) => payItemForm.setData('item_type', e.target.value as any)}
                                        className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs disabled:opacity-60 text-slate-900 dark:text-white"
                                    >
                                        <option value="earning">Earning (Allowance / Add-on)</option>
                                        <option value="deduction">Deduction (Recovery / Fund)</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                        Calculation Mode
                                    </label>
                                    <select
                                        disabled={editingItem?.is_system_reserved}
                                        value={payItemForm.data.calculation_type}
                                        onChange={(e) => payItemForm.setData('calculation_type', e.target.value as any)}
                                        className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs disabled:opacity-60 text-slate-900 dark:text-white"
                                    >
                                        <option value="fixed">Fixed Monthly Amount (LKR)</option>
                                        <option value="percentage_of_basic">Percentage (%) of Basic Salary</option>
                                    </select>
                                </div>
                            </div>

                            {payItemForm.data.calculation_type === 'fixed' ? (
                                <div>
                                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                        Default Monthly Amount (LKR)
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={payItemForm.data.default_amount}
                                        onChange={(e) => payItemForm.setData('default_amount', parseFloat(e.target.value) || 0)}
                                        className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                                    />
                                </div>
                            ) : (
                                <div>
                                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                        Percentage of Basic (%)
                                    </label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        value={payItemForm.data.percentage}
                                        onChange={(e) => payItemForm.setData('percentage', e.target.value)}
                                        placeholder="e.g. 5.0"
                                        className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                                    />
                                </div>
                            )}

                            {/* Statutory & Tax Flags */}
                            <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl space-y-2 border border-slate-200 dark:border-slate-700">
                                <p className="font-semibold text-slate-700 dark:text-slate-200 text-xs flex items-center gap-1.5">
                                    <ShieldCheck className="w-4 h-4 text-indigo-500" />
                                    Statutory EPF / ETF & APIT Tax Flags
                                </p>
                                <div className="grid grid-cols-3 gap-2 pt-1">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={payItemForm.data.is_epf_eligible}
                                            onChange={(e) => payItemForm.setData('is_epf_eligible', e.target.checked)}
                                            className="rounded text-indigo-600 focus:ring-indigo-500"
                                        />
                                        <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300">EPF Eligible</span>
                                    </label>

                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={payItemForm.data.is_etf_eligible}
                                            onChange={(e) => payItemForm.setData('is_etf_eligible', e.target.checked)}
                                            className="rounded text-indigo-600 focus:ring-indigo-500"
                                        />
                                        <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300">ETF Eligible</span>
                                    </label>

                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={payItemForm.data.is_taxable}
                                            onChange={(e) => payItemForm.setData('is_taxable', e.target.checked)}
                                            className="rounded text-indigo-600 focus:ring-indigo-500"
                                        />
                                        <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300">APIT Taxable</span>
                                    </label>
                                </div>
                            </div>

                            <div>
                                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                    Description / Policy Notes
                                </label>
                                <textarea
                                    rows={2}
                                    value={payItemForm.data.description}
                                    onChange={(e) => payItemForm.setData('description', e.target.value)}
                                    placeholder="Add statutory reference or internal payroll policy guidelines..."
                                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                                />
                            </div>

                            <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={payItemForm.data.is_active}
                                        onChange={(e) => payItemForm.setData('is_active', e.target.checked)}
                                        className="rounded text-indigo-600 focus:ring-indigo-500"
                                    />
                                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Active in Catalog</span>
                                </label>

                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setIsCreateModalOpen(false)}
                                        className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={payItemForm.processing}
                                        className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-lg shadow-indigo-600/30 transition disabled:opacity-50"
                                    >
                                        {payItemForm.processing ? 'Saving...' : editingItem ? 'Update Pay Item' : 'Create Pay Item'}
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal: Assign to Staff */}
            {isAssignModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full shadow-2xl overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <UserCheck className="w-5 h-5 text-emerald-500" />
                                Allocate Recurring Pay Item
                            </h3>
                            <button
                                onClick={() => setIsAssignModalOpen(false)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSaveAssignment} className="p-6 space-y-4 text-xs">
                            <div>
                                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                    Target Employee <span className="text-rose-500">*</span>
                                </label>
                                <select
                                    value={assignForm.data.employee_id}
                                    onChange={(e) => assignForm.setData('employee_id', e.target.value)}
                                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                                    required
                                >
                                    {employees.map((emp) => (
                                        <option key={emp.id} value={emp.id}>
                                            {emp.emp_no} - {emp.full_name} ({emp.department?.name ?? 'General'})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                    Pay Item Component <span className="text-rose-500">*</span>
                                </label>
                                <select
                                    value={assignForm.data.pay_item_id}
                                    onChange={(e) => handleAssignPayItemChange(e.target.value)}
                                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                                    required
                                >
                                    {payItems.map((item) => (
                                        <option key={item.id} value={item.id}>
                                            [{item.code}] {item.name} ({item.item_type})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                    Monthly Allocated Amount (LKR) <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={assignForm.data.amount}
                                    onChange={(e) => assignForm.setData('amount', parseFloat(e.target.value) || 0)}
                                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono font-bold text-slate-900 dark:text-white"
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                        Effective From <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="date"
                                        value={assignForm.data.effective_from}
                                        onChange={(e) => assignForm.setData('effective_from', e.target.value)}
                                        className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                        Effective To (Optional)
                                    </label>
                                    <input
                                        type="date"
                                        value={assignForm.data.effective_to}
                                        onChange={(e) => assignForm.setData('effective_to', e.target.value)}
                                        className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                                    Allocation Remarks
                                </label>
                                <input
                                    type="text"
                                    value={assignForm.data.remarks}
                                    onChange={(e) => assignForm.setData('remarks', e.target.value)}
                                    placeholder="e.g. Approved per contract amendment letter"
                                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                                />
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                                <button
                                    type="button"
                                    onClick={() => setIsAssignModalOpen(false)}
                                    className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={assignForm.processing}
                                    className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-lg shadow-emerald-600/30 transition disabled:opacity-50"
                                >
                                    {assignForm.processing ? 'Saving...' : 'Confirm Allocation'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </AuthenticatedLayout>
    );
}
