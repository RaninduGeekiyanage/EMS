import React, { useState } from 'react';
import { Head, router, Link } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import {
    Users,
    UserPlus,
    Search,
    Filter,
    Building2,
    Briefcase,
    CreditCard,
    Edit2,
    Trash2,
    ChevronLeft,
    ChevronRight,
    MapPin,
    Fingerprint,
    CheckCircle2,
    XCircle,
    DollarSign,
} from 'lucide-react';
import { Employee, PaginatedData, DepartmentSummary, BranchSummary } from '../../Types/employee';

interface Props {
    employees: PaginatedData<Employee>;
    departments: DepartmentSummary[];
    branches: BranchSummary[];
    filters: {
        search?: string;
        department_id?: string;
        branch_id?: string;
        employment_status?: string;
    };
}

export default function Index({ employees, departments, branches, filters }: Props) {
    const [search, setSearch] = useState(filters.search || '');
    const [departmentId, setDepartmentId] = useState(filters.department_id || '');
    const [branchId, setBranchId] = useState(filters.branch_id || '');
    const [status, setStatus] = useState(filters.employment_status || '');

    const handleFilterSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        router.get(
            '/employees',
            {
                search: search || undefined,
                department_id: departmentId || undefined,
                branch_id: branchId || undefined,
                employment_status: status || undefined,
            },
            { preserveState: true, replace: true }
        );
    };

    const handleReset = () => {
        setSearch('');
        setDepartmentId('');
        setBranchId('');
        setStatus('');
        router.get('/employees', {}, { replace: true });
    };

    const handleDelete = (employeeId: string, name: string) => {
        if (confirm(`Are you sure you want to deactivate ${name}?`)) {
            router.delete(`/employees/${employeeId}`, {
                preserveScroll: true,
            });
        }
    };

    return (
        <AuthenticatedLayout title="Employee Directory" backUrl="/dashboard">
            <div className="max-w-7xl mx-auto space-y-8">
                {/* Header Subnavigation Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800/80">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-sky-400 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                            <Users className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-xl font-bold tracking-tight text-white">
                                    Employee Master
                                </h1>
                                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                                    Profiles & Payroll Specs
                                </span>
                            </div>
                            <p className="text-xs text-slate-400">
                                Unified profiles, designations, NIC encryption, and multi-tier compensation models
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <Link
                            href="/company/profile"
                            className="text-xs font-medium text-slate-400 hover:text-slate-200 px-3 py-1.5 rounded-lg border border-slate-800 hover:border-slate-700 transition"
                        >
                            Company Profile
                        </Link>
                        <Link
                            href="/employees/create"
                            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-indigo-600/20 transition"
                        >
                            <UserPlus className="w-4 h-4" />
                            Add Employee
                        </Link>
                    </div>
                </div>
                {/* Metric Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-8">
                    <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800">
                        <span className="text-xs text-slate-400 font-medium">Total Registered Staff</span>
                        <h3 className="text-2xl font-bold text-white mt-1">{employees.total}</h3>
                    </div>
                    <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800">
                        <span className="text-xs text-slate-400 font-medium">Active Headcount</span>
                        <h3 className="text-2xl font-bold text-emerald-400 mt-1">
                            {employees.data.filter((e) => e.employment_status === 'active').length}
                        </h3>
                    </div>
                    <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800">
                        <span className="text-xs text-slate-400 font-medium">Departments Covered</span>
                        <h3 className="text-2xl font-bold text-sky-400 mt-1">{departments.length}</h3>
                    </div>
                    <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800">
                        <span className="text-xs text-slate-400 font-medium">Physical Branches</span>
                        <h3 className="text-2xl font-bold text-indigo-400 mt-1">{branches.length}</h3>
                    </div>
                </div>

                {/* Filter and Search Bar */}
                <form
                    onSubmit={handleFilterSubmit}
                    className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 mb-6 flex flex-wrap items-center gap-4"
                >
                    <div className="flex-1 min-w-[220px] relative">
                        <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search by name, EMP ID, or email..."
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                        />
                    </div>

                    <div className="w-44">
                        <select
                            value={departmentId}
                            onChange={(e) => setDepartmentId(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                        >
                            <option value="">All Departments</option>
                            {departments.map((d) => (
                                <option key={d.id} value={d.id}>
                                    {d.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="w-44">
                        <select
                            value={branchId}
                            onChange={(e) => setBranchId(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                        >
                            <option value="">All Branches</option>
                            {branches.map((b) => (
                                <option key={b.id} value={b.id}>
                                    {b.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="w-36">
                        <select
                            value={status}
                            onChange={(e) => setStatus(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                        >
                            <option value="">All Statuses</option>
                            <option value="active">Active</option>
                            <option value="resigned">Resigned</option>
                            <option value="terminated">Terminated</option>
                            <option value="suspended">Suspended</option>
                        </select>
                    </div>

                    <button
                        type="submit"
                        className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold flex items-center gap-1.5 transition"
                    >
                        <Filter className="w-3.5 h-3.5" />
                        Apply
                    </button>

                    {(search || departmentId || branchId || status) && (
                        <button
                            type="button"
                            onClick={handleReset}
                            className="text-xs text-slate-400 hover:text-rose-400 underline transition"
                        >
                            Clear
                        </button>
                    )}
                </form>

                {/* Employees Table */}
                <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 overflow-hidden shadow-xl">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="border-b border-slate-800 bg-slate-950/60 text-slate-400 uppercase tracking-wider font-semibold">
                                <tr>
                                    <th className="py-3.5 px-6">Emp No</th>
                                    <th className="py-3.5 px-6">Employee Details</th>
                                    <th className="py-3.5 px-6">Department & Role</th>
                                    <th className="py-3.5 px-6">Branch</th>
                                    <th className="py-3.5 px-6">Payment Mode</th>
                                    <th className="py-3.5 px-6">Status</th>
                                    <th className="py-3.5 px-6 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/60">
                                {employees.data.map((emp) => (
                                    <tr key={emp.id} className="hover:bg-slate-800/30 transition">
                                        <td className="py-4 px-6 font-mono font-bold text-indigo-400 whitespace-nowrap">
                                            {emp.emp_no}
                                        </td>
                                        <td className="py-4 px-6">
                                            <div className="font-semibold text-white text-sm">
                                                {emp.full_name}
                                            </div>
                                            <div className="text-slate-400 text-[11px] mt-0.5">
                                                {emp.email || emp.phone || 'No direct contact info'}
                                            </div>
                                            {emp.biometric_device_id && (
                                                <div className="flex items-center gap-1 text-[10px] text-sky-400/80 mt-1 font-mono">
                                                    <Fingerprint className="w-3 h-3" />
                                                    Device ID: {emp.biometric_device_id}
                                                </div>
                                            )}
                                        </td>
                                        <td className="py-4 px-6">
                                            <div className="text-slate-200 font-medium">
                                                {emp.department?.name || 'Unassigned Dept'}
                                            </div>
                                            <div className="text-slate-400 text-[11px] mt-0.5">
                                                {emp.designation?.title || 'Unassigned Role'}
                                            </div>
                                        </td>
                                        <td className="py-4 px-6 text-slate-300">
                                            <div className="flex items-center gap-1.5">
                                                <MapPin className="w-3 h-3 text-slate-500" />
                                                <span>{emp.branch?.name || 'Main'}</span>
                                            </div>
                                        </td>
                                        <td className="py-4 px-6 whitespace-nowrap">
                                            <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold tracking-wide bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 uppercase">
                                                {emp.payment_info?.payment_mode || 'monthly'}
                                            </span>
                                        </td>
                                        <td className="py-4 px-6 whitespace-nowrap">
                                            <span
                                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                                    emp.employment_status === 'active'
                                                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                                        : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                                }`}
                                            >
                                                {emp.employment_status}
                                            </span>
                                        </td>
                                        <td className="py-4 px-6 text-right whitespace-nowrap">
                                            <div className="flex items-center justify-end gap-2">
                                                <Link
                                                    href={`/employees/${emp.id}/edit`}
                                                    className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition"
                                                    title="Edit Employee"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </Link>
                                                <button
                                                    type="button"
                                                    onClick={() => handleDelete(emp.id, emp.full_name)}
                                                    className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition"
                                                    title="Deactivate"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}

                                {employees.data.length === 0 && (
                                    <tr>
                                        <td colSpan={7} className="py-16 text-center text-slate-400">
                                            <Users className="w-12 h-12 mx-auto text-slate-600 mb-3" />
                                            <p className="text-sm">No employees match the specified criteria.</p>
                                            <Link
                                                href="/employees/create"
                                                className="inline-block mt-4 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-500 transition"
                                            >
                                                Add First Employee
                                            </Link>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {employees.total > employees.per_page && (
                        <div className="p-4 border-t border-slate-800 bg-slate-950/40 flex items-center justify-between text-xs text-slate-400">
                            <div>
                                Showing <span className="font-semibold text-white">{employees.from}</span> to{' '}
                                <span className="font-semibold text-white">{employees.to}</span> of{' '}
                                <span className="font-semibold text-white">{employees.total}</span> records
                            </div>
                            <div className="flex items-center gap-1.5">
                                {employees.links.map((link, idx) => (
                                    <Link
                                        key={idx}
                                        href={link.url || '#'}
                                        preserveScroll
                                        className={`px-3 py-1 rounded-lg border text-xs transition ${
                                            link.active
                                                ? 'bg-indigo-600 border-indigo-500 text-white font-semibold'
                                                : 'border-slate-800 text-slate-400 hover:bg-slate-800'
                                        } ${!link.url ? 'opacity-40 pointer-events-none' : ''}`}
                                        dangerouslySetInnerHTML={{ __html: link.label }}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
