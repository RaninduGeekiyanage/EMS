import React, { useState } from 'react';
import { Head, useForm, router } from '@inertiajs/react';
import {
    Network,
    Plus,
    Edit2,
    Trash2,
    FolderTree,
    CornerDownRight,
    Building2,
    ChevronRight,
    Layers,
    X,
    Tag,
    DollarSign,
} from 'lucide-react';

interface Department {
    id: string;
    tenant_id: string;
    name: string;
    code: string | null;
    parent_id: string | null;
    cost_center: string | null;
    is_active: boolean;
    parent?: Department | null;
    children?: Department[];
}

interface Props {
    departmentTree: Department[];
    departments: Department[];
}

export default function Index({ departmentTree, departments }: Props) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);

    const form = useForm({
        name: '',
        code: '',
        parent_id: '' as string | null,
        cost_center: '',
        is_active: true,
    });

    const openCreateModal = (parentId: string | null = null) => {
        setEditingDepartment(null);
        form.setData({
            name: '',
            code: '',
            parent_id: parentId,
            cost_center: '',
            is_active: true,
        });
        setIsModalOpen(true);
    };

    const openEditModal = (dept: Department) => {
        setEditingDepartment(dept);
        form.setData({
            name: dept.name,
            code: dept.code || '',
            parent_id: dept.parent_id || '',
            cost_center: dept.cost_center || '',
            is_active: Boolean(dept.is_active),
        });
        setIsModalOpen(true);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const payload = {
            ...form.data,
            parent_id: form.data.parent_id || null,
        };

        if (editingDepartment) {
            form.put(`/departments/${editingDepartment.id}`, {
                preserveScroll: true,
                onSuccess: () => setIsModalOpen(false),
            });
        } else {
            form.post('/departments', {
                preserveScroll: true,
                onSuccess: () => setIsModalOpen(false),
            });
        }
    };

    const handleDelete = (departmentId: string) => {
        if (confirm('Are you sure you want to delete this department?')) {
            router.delete(`/departments/${departmentId}`, {
                preserveScroll: true,
            });
        }
    };

    const renderDepartmentNode = (dept: Department, level: number = 0) => {
        const hasChildren = dept.children && dept.children.length > 0;

        return (
            <div key={dept.id} className="relative">
                <div
                    className={`flex items-center justify-between p-4 rounded-2xl border transition-all duration-200 ${
                        level === 0
                            ? 'bg-slate-900/80 border-slate-800 hover:border-slate-700 shadow-md'
                            : 'bg-slate-900/40 border-slate-800/60 hover:border-indigo-500/40 ml-6 md:ml-10 my-2'
                    }`}
                >
                    <div className="flex items-center gap-3">
                        {level > 0 && (
                            <CornerDownRight className="w-4 h-4 text-indigo-400/70 flex-shrink-0" />
                        )}
                        <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                                level === 0
                                    ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                                    : 'bg-slate-800 text-slate-300 border border-slate-700/50'
                            }`}
                        >
                            {dept.name.charAt(0).toUpperCase()}
                        </div>

                        <div>
                            <div className="flex items-center gap-2">
                                <h4 className="text-sm font-semibold text-white tracking-tight">
                                    {dept.name}
                                </h4>
                                {dept.code && (
                                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                                        {dept.code}
                                    </span>
                                )}
                                {!dept.is_active && (
                                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                        Inactive
                                    </span>
                                )}
                            </div>

                            {dept.cost_center && (
                                <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
                                    <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                                    Cost Center: <span className="text-slate-300 font-mono">{dept.cost_center}</span>
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {hasChildren && (
                            <span className="text-xs text-slate-400 px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700 hidden sm:inline-block">
                                {dept.children?.length} sub-{dept.children?.length === 1 ? 'unit' : 'units'}
                            </span>
                        )}

                        <button
                            type="button"
                            onClick={() => openCreateModal(dept.id)}
                            title="Add Sub-Department"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-slate-800 transition"
                        >
                            <Plus className="w-4 h-4" />
                        </button>
                        <button
                            type="button"
                            onClick={() => openEditModal(dept)}
                            title="Edit Department"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
                        >
                            <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                            type="button"
                            onClick={() => handleDelete(dept.id)}
                            title="Delete Department"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {hasChildren && (
                    <div className="space-y-1 relative pl-2 border-l border-slate-800/80 ml-4">
                        {dept.children?.map((child) => renderDepartmentNode(child, level + 1))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-indigo-500 selection:text-white pb-24">
            <Head title="Departments Hierarchy — EMS" />

            {/* Top Navigation Bar */}
            <header className="border-b border-slate-800/80 bg-slate-950/70 backdrop-blur-md sticky top-0 z-40">
                <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-sky-400 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                            <Network className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <span className="text-lg font-bold tracking-tight text-white">
                                Departments & Cost Centers
                            </span>
                            <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                                Organization Tree
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <a
                            href="/company/profile"
                            className="text-xs font-medium text-slate-400 hover:text-slate-200 px-3 py-1.5 rounded-lg border border-slate-800 hover:border-slate-700 transition"
                        >
                            ← Company Profile
                        </a>
                        <button
                            type="button"
                            onClick={() => openCreateModal(null)}
                            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-indigo-600/20 transition"
                        >
                            <Plus className="w-4 h-4" />
                            Add Root Department
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-6 pt-10">
                {/* Intro summary card */}
                <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800/80 mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-lg font-bold text-white">Organizational Hierarchy</h2>
                        <p className="text-xs text-slate-400 mt-1">
                            Departments are linked to cost centers and employee reporting lines. Sub-departments inherit parent cost-allocations unless overridden.
                        </p>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-slate-400 bg-slate-950/60 px-4 py-2.5 rounded-2xl border border-slate-800">
                        <div>
                            <span className="text-slate-500">Total Units:</span>{' '}
                            <span className="font-bold text-white">{departments.length}</span>
                        </div>
                        <div className="w-px h-4 bg-slate-800" />
                        <div>
                            <span className="text-slate-500">Top-Level:</span>{' '}
                            <span className="font-bold text-white">{departmentTree.length}</span>
                        </div>
                    </div>
                </div>

                {/* Tree View Container */}
                <div className="space-y-4">
                    {departmentTree.map((rootDept) => renderDepartmentNode(rootDept, 0))}

                    {departmentTree.length === 0 && (
                        <div className="p-16 text-center rounded-3xl bg-slate-900/40 border border-slate-800/60 text-slate-400">
                            <FolderTree className="w-12 h-12 mx-auto text-slate-600 mb-3" />
                            <h3 className="text-base font-semibold text-white">No Departments Defined</h3>
                            <p className="text-xs text-slate-400 mt-1">
                                Begin building your organization structure by adding the first department.
                            </p>
                            <button
                                type="button"
                                onClick={() => openCreateModal(null)}
                                className="mt-4 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-500 transition"
                            >
                                Create First Department
                            </button>
                        </div>
                    )}
                </div>
            </main>

            {/* Department Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
                    <div className="w-full max-w-md rounded-3xl bg-slate-900 border border-slate-800 p-6 shadow-2xl relative">
                        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                            <h3 className="text-base font-bold text-white">
                                {editingDepartment ? 'Edit Department' : 'Create Department'}
                            </h3>
                            <button
                                type="button"
                                onClick={() => setIsModalOpen(false)}
                                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1">
                                    Department Name *
                                </label>
                                <input
                                    type="text"
                                    value={form.data.name}
                                    onChange={(e) => form.setData('name', e.target.value)}
                                    required
                                    placeholder="e.g. Operations, Finance, Human Resources"
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                                />
                                {form.errors.name && (
                                    <p className="text-xs text-rose-400 mt-1">{form.errors.name}</p>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                                        Department Code
                                    </label>
                                    <input
                                        type="text"
                                        value={form.data.code}
                                        onChange={(e) => form.setData('code', e.target.value)}
                                        placeholder="DEP-OPS"
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                                        Cost Center
                                    </label>
                                    <input
                                        type="text"
                                        value={form.data.cost_center}
                                        onChange={(e) => form.setData('cost_center', e.target.value)}
                                        placeholder="CC-101"
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1">
                                    Parent Department
                                </label>
                                <select
                                    value={form.data.parent_id || ''}
                                    onChange={(e) => form.setData('parent_id', e.target.value || null)}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                                >
                                    <option value="">None (Top Level Root Department)</option>
                                    {departments
                                        .filter((d) => !editingDepartment || d.id !== editingDepartment.id)
                                        .map((d) => (
                                            <option key={d.id} value={d.id}>
                                                {d.name} {d.code ? `(${d.code})` : ''}
                                            </option>
                                        ))}
                                </select>
                            </div>

                            <div className="pt-2">
                                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-300">
                                    <input
                                        type="checkbox"
                                        checked={form.data.is_active}
                                        onChange={(e) => form.setData('is_active', e.target.checked)}
                                        className="w-4 h-4 rounded border-slate-700 text-indigo-600 focus:ring-0 focus:ring-offset-0 bg-slate-950"
                                    />
                                    Active Department
                                </label>
                            </div>

                            <div className="pt-6 border-t border-slate-800 flex items-center justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={form.processing}
                                    className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/20 disabled:opacity-50"
                                >
                                    {form.processing ? 'Saving...' : editingDepartment ? 'Update Department' : 'Create Department'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
