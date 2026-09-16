import React, { useState } from 'react';
import { Head, router, useForm } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import {
    Users,
    Shield,
    KeyRound,
    UserPlus,
    Search,
    ShieldAlert,
    ShieldCheck,
    CheckCircle2,
    XCircle,
    UserCheck,
    Pencil,
    Trash2,
    X,
    Eye,
    EyeOff,
    Sparkles,
    Building2,
    User as UserIcon,
    RefreshCw,
} from 'lucide-react';

interface LinkedEmployee {
    id: string;
    emp_no: string;
    name: string;
}

interface UserAccount {
    id: number;
    name: string;
    email: string;
    is_super_admin: boolean;
    is_company_owner: boolean;
    roles: string[];
    primary_role: string;
    linked_employee: LinkedEmployee | null;
    created_at: string;
}

interface Metrics {
    total_users: number;
    admins_count: number;
    managers_count: number;
    staff_count: number;
}

interface Props {
    users: UserAccount[];
    metrics: Metrics;
    availableRoles: string[];
    filters: {
        search?: string;
        role?: string;
    };
    currentUserId: number;
    isSuperAdmin: boolean;
}

export default function UsersIndex({
    users,
    metrics,
    availableRoles,
    filters,
    currentUserId,
    isSuperAdmin,
}: Props) {
    const [search, setSearch] = useState(filters.search || '');
    const [roleFilter, setRoleFilter] = useState(filters.role || '');
    const [createModalOpen, setCreateModalOpen] = useState(false);
    const [editModalUser, setEditModalUser] = useState<UserAccount | null>(null);
    const [resetModalUser, setResetModalUser] = useState<UserAccount | null>(null);
    const [deleteModalUser, setDeleteModalUser] = useState<UserAccount | null>(null);
    const [showPassword, setShowPassword] = useState(false);

    // Create User Form
    const createForm = useForm({
        name: '',
        email: '',
        password: '',
        password_confirmation: '',
        role: 'Staff',
    });

    // Edit User Form
    const editForm = useForm({
        name: '',
        email: '',
        role: 'Staff',
    });

    // Reset Password Form
    const resetForm = useForm({
        password: '',
    });

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        router.get(
            '/users',
            { search: search || undefined, role: roleFilter || undefined },
            { preserveState: true, replace: true }
        );
    };

    const handleRoleFilterChange = (role: string) => {
        const nextRole = roleFilter === role ? '' : role;
        setRoleFilter(nextRole);
        router.get(
            '/users',
            { search: search || undefined, role: nextRole || undefined },
            { preserveState: true, replace: true }
        );
    };

    const generateRandomPassword = () => {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%^&*';
        let res = '';
        for (let i = 0; i < 12; i++) {
            res += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return res;
    };

    const handleCreateSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        createForm.post('/users', {
            onSuccess: () => {
                setCreateModalOpen(false);
                createForm.reset();
            },
        });
    };

    const openEditModal = (user: UserAccount) => {
        setEditModalUser(user);
        editForm.setData({
            name: user.name,
            email: user.email,
            role: user.roles[0] || 'Staff',
        });
    };

    const handleEditSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!editModalUser) return;
        editForm.put(`/users/${editModalUser.id}`, {
            onSuccess: () => {
                setEditModalUser(null);
                editForm.reset();
            },
        });
    };

    const openResetModal = (user: UserAccount) => {
        setResetModalUser(user);
        setShowPassword(true);
        resetForm.setData({
            password: generateRandomPassword(),
        });
    };

    const handleResetSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!resetModalUser) return;
        resetForm.post(`/users/${resetModalUser.id}/reset-password`, {
            onSuccess: () => {
                setResetModalUser(null);
                resetForm.reset();
            },
        });
    };

    const handleDeleteSubmit = () => {
        if (!deleteModalUser) return;
        router.delete(`/users/${deleteModalUser.id}`, {
            onSuccess: () => {
                setDeleteModalUser(null);
            },
        });
    };

    const getRoleBadge = (roleName: string) => {
        switch (roleName) {
            case 'Company Owner':
                return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
            case 'Company Admin':
                return 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40';
            case 'HR Manager':
            case 'HR Executive':
                return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
            case 'Supervisor':
                return 'bg-sky-500/20 text-sky-300 border-sky-500/40';
            case 'Staff':
            default:
                return 'bg-slate-800 text-slate-300 border-slate-700';
        }
    };

    return (
        <AuthenticatedLayout title="User Accounts & Access Management" backUrl="/dashboard">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                                M01 Security & Governance
                            </span>
                            <span className="text-xs text-slate-500">Dual-Company Multi-Tenant RBAC</span>
                        </div>
                        <h1 className="text-2xl font-bold text-white tracking-tight mt-1 flex items-center gap-2.5">
                            <UserCheck className="w-6 h-6 text-indigo-400" />
                            Company User Accounts
                        </h1>
                        <p className="text-xs text-slate-400 mt-0.5">
                            Manage user logins, RBAC role assignments, and reset user passwords securely.
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => {
                                createForm.reset();
                                setCreateModalOpen(true);
                            }}
                            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-indigo-600/30 transition active:scale-95"
                        >
                            <UserPlus className="w-4 h-4" />
                            <span>Add New User</span>
                        </button>
                    </div>
                </div>

                {/* Metrics Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur">
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-slate-400 font-medium">Total Accounts</span>
                            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                                <Users className="w-4 h-4" />
                            </div>
                        </div>
                        <h3 className="text-2xl font-bold text-white mt-2">{metrics.total_users}</h3>
                        <p className="text-[11px] text-slate-500 mt-1">Active users in workspace</p>
                    </div>

                    <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur">
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-slate-400 font-medium">Company Admins</span>
                            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
                                <Shield className="w-4 h-4" />
                            </div>
                        </div>
                        <h3 className="text-2xl font-bold text-amber-400 mt-2">{metrics.admins_count}</h3>
                        <p className="text-[11px] text-slate-500 mt-1">Owners & Admin authority</p>
                    </div>

                    <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur">
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-slate-400 font-medium">HR & Supervisors</span>
                            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                                <ShieldCheck className="w-4 h-4" />
                            </div>
                        </div>
                        <h3 className="text-2xl font-bold text-emerald-400 mt-2">{metrics.managers_count}</h3>
                        <p className="text-[11px] text-slate-500 mt-1">Operational managers</p>
                    </div>

                    <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur">
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-slate-400 font-medium">Staff Accounts</span>
                            <div className="w-8 h-8 rounded-lg bg-sky-500/10 text-sky-400 flex items-center justify-center">
                                <UserIcon className="w-4 h-4" />
                            </div>
                        </div>
                        <h3 className="text-2xl font-bold text-sky-400 mt-2">{metrics.staff_count}</h3>
                        <p className="text-[11px] text-slate-500 mt-1">Self-service personnel</p>
                    </div>
                </div>

                {/* Filters & Search */}
                <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800/80 backdrop-blur space-y-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        {/* Role Pills Filter */}
                        <div className="flex flex-wrap items-center gap-1.5">
                            <button
                                onClick={() => handleRoleFilterChange('')}
                                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                                    roleFilter === ''
                                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                                        : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                                }`}
                            >
                                All Users ({metrics.total_users})
                            </button>
                            {availableRoles.map((role) => (
                                <button
                                    key={role}
                                    onClick={() => handleRoleFilterChange(role)}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                                        roleFilter === role
                                            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                                            : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                                    }`}
                                >
                                    {role}
                                </button>
                            ))}
                        </div>

                        {/* Search Bar */}
                        <form onSubmit={handleSearch} className="relative">
                            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Search by name or email..."
                                className="pl-9 pr-4 py-2 rounded-xl bg-slate-950/80 border border-slate-800 focus:border-indigo-500 text-xs text-slate-100 placeholder:text-slate-600 w-64 transition"
                            />
                        </form>
                    </div>

                    {/* Users Table */}
                    <div className="overflow-x-auto rounded-2xl border border-slate-800/80">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[10px]">
                                <tr>
                                    <th className="px-5 py-3.5 font-semibold">User Account</th>
                                    <th className="px-5 py-3.5 font-semibold">Role / Permissions</th>
                                    <th className="px-5 py-3.5 font-semibold">Linked Employee</th>
                                    <th className="px-5 py-3.5 font-semibold">Created Date</th>
                                    <th className="px-5 py-3.5 font-semibold text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/60 bg-slate-900/30">
                                {users.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-5 py-12 text-center text-slate-500 text-xs">
                                            <div className="flex flex-col items-center justify-center gap-2">
                                                <Users className="w-8 h-8 text-slate-600 stroke-[1.5]" />
                                                <p className="font-semibold text-slate-400">No user accounts found</p>
                                                <p className="text-[11px] text-slate-600">
                                                    Try adjusting your search filter or create a new user account.
                                                </p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    users.map((user) => {
                                        const isCurrentUser = user.id === currentUserId;
                                        return (
                                            <tr key={user.id} className="hover:bg-slate-800/40 transition">
                                                <td className="px-5 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-slate-800 to-indigo-950 border border-slate-700/60 flex items-center justify-center font-bold text-xs text-indigo-300 flex-shrink-0">
                                                            {user.name.charAt(0).toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <p className="font-semibold text-white">{user.name}</p>
                                                                {isCurrentUser && (
                                                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                                                        You
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <p className="text-[11px] text-slate-400 font-mono">{user.email}</p>
                                                        </div>
                                                    </div>
                                                </td>

                                                <td className="px-5 py-4">
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {user.roles.length > 0 ? (
                                                            user.roles.map((r) => (
                                                                <span
                                                                    key={r}
                                                                    className={`px-2.5 py-1 rounded-full text-[10px] font-semibold border ${getRoleBadge(
                                                                        r
                                                                    )}`}
                                                                >
                                                                    {r}
                                                                </span>
                                                            ))
                                                        ) : (
                                                            <span className="text-[10px] text-slate-500 italic">
                                                                No role assigned
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>

                                                <td className="px-5 py-4">
                                                    {user.linked_employee ? (
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
                                                            <div>
                                                                <p className="font-medium text-slate-200">
                                                                    {user.linked_employee.name}
                                                                </p>
                                                                <p className="text-[10px] font-mono text-indigo-400">
                                                                    {user.linked_employee.emp_no}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <span className="text-slate-600 text-[11px] italic">
                                                            Not linked to employee
                                                        </span>
                                                    )}
                                                </td>

                                                <td className="px-5 py-4 text-slate-400 text-xs">
                                                    {user.created_at || '—'}
                                                </td>

                                                <td className="px-5 py-4 text-right">
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        {/* Reset Password Button */}
                                                        <button
                                                            onClick={() => openResetModal(user)}
                                                            className="px-2.5 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-xs font-semibold flex items-center gap-1.5 transition border border-amber-500/20 active:scale-95"
                                                            title="Reset User Password"
                                                        >
                                                            <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                                                            <span>Reset Password</span>
                                                        </button>

                                                        {/* Edit User Button */}
                                                        <button
                                                            onClick={() => openEditModal(user)}
                                                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition border border-slate-700 active:scale-95"
                                                            title="Edit User Details"
                                                        >
                                                            <Pencil className="w-3.5 h-3.5" />
                                                        </button>

                                                        {/* Delete Button */}
                                                        {(!user.is_company_owner || isSuperAdmin) && !isCurrentUser && (
                                                            <button
                                                                onClick={() => setDeleteModalUser(user)}
                                                                className="p-1.5 rounded-lg bg-red-950/30 hover:bg-red-950/60 text-red-400 transition border border-red-800/40 active:scale-95"
                                                                title="Delete User Account"
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Create User Modal */}
            {createModalOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 space-y-6 shadow-2xl">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
                                    <UserPlus className="w-4 h-4" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-white text-sm">Add Company User</h3>
                                    <p className="text-[11px] text-slate-400">Provision a new account with role assignment</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setCreateModalOpen(false)}
                                className="text-slate-500 hover:text-slate-300 p-1"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
                            <div>
                                <label className="block text-slate-300 font-semibold mb-1">Full Name</label>
                                <input
                                    type="text"
                                    required
                                    value={createForm.data.name}
                                    onChange={(e) => createForm.setData('name', e.target.value)}
                                    placeholder="e.g. Kasun Silva"
                                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 focus:border-indigo-500 text-slate-100 text-xs"
                                />
                                {createForm.errors.name && (
                                    <p className="text-red-400 mt-1">{createForm.errors.name}</p>
                                )}
                            </div>

                            <div>
                                <label className="block text-slate-300 font-semibold mb-1">Email Address</label>
                                <input
                                    type="email"
                                    required
                                    value={createForm.data.email}
                                    onChange={(e) => createForm.setData('email', e.target.value)}
                                    placeholder="e.g. kasun@company.com"
                                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 focus:border-indigo-500 text-slate-100 text-xs"
                                />
                                {createForm.errors.email && (
                                    <p className="text-red-400 mt-1">{createForm.errors.email}</p>
                                )}
                            </div>

                            <div>
                                <label className="block text-slate-300 font-semibold mb-1">Assign Role</label>
                                <select
                                    value={createForm.data.role}
                                    onChange={(e) => createForm.setData('role', e.target.value)}
                                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 focus:border-indigo-500 text-slate-100 text-xs"
                                >
                                    {availableRoles.map((role) => (
                                        <option key={role} value={role}>
                                            {role}
                                        </option>
                                    ))}
                                </select>
                                {createForm.errors.role && (
                                    <p className="text-red-400 mt-1">{createForm.errors.role}</p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <label className="block text-slate-300 font-semibold">Password</label>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const p = generateRandomPassword();
                                            createForm.setData('password', p);
                                            createForm.setData('password_confirmation', p);
                                        }}
                                        className="text-[10px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-semibold"
                                    >
                                        <Sparkles className="w-3 h-3" />
                                        Auto-generate
                                    </button>
                                </div>
                                <input
                                    type="text"
                                    required
                                    value={createForm.data.password}
                                    onChange={(e) => createForm.setData('password', e.target.value)}
                                    placeholder="Minimum 8 characters"
                                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 focus:border-indigo-500 text-slate-100 font-mono text-xs"
                                />
                                {createForm.errors.password && (
                                    <p className="text-red-400 mt-1">{createForm.errors.password}</p>
                                )}
                            </div>

                            <div>
                                <label className="block text-slate-300 font-semibold mb-1">Confirm Password</label>
                                <input
                                    type="text"
                                    required
                                    value={createForm.data.password_confirmation}
                                    onChange={(e) => createForm.setData('password_confirmation', e.target.value)}
                                    placeholder="Confirm password"
                                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 focus:border-indigo-500 text-slate-100 font-mono text-xs"
                                />
                            </div>

                            <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-800">
                                <button
                                    type="button"
                                    onClick={() => setCreateModalOpen(false)}
                                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={createForm.processing}
                                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold flex items-center gap-2 shadow-lg shadow-indigo-600/30 transition disabled:opacity-50"
                                >
                                    <UserPlus className="w-3.5 h-3.5" />
                                    {createForm.processing ? 'Creating...' : 'Create User Account'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit User Modal */}
            {editModalUser && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 space-y-6 shadow-2xl">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
                                    <Pencil className="w-4 h-4" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-white text-sm">Edit User Details</h3>
                                    <p className="text-[11px] text-slate-400">{editModalUser.name}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setEditModalUser(null)}
                                className="text-slate-500 hover:text-slate-300 p-1"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleEditSubmit} className="space-y-4 text-xs">
                            <div>
                                <label className="block text-slate-300 font-semibold mb-1">Full Name</label>
                                <input
                                    type="text"
                                    required
                                    value={editForm.data.name}
                                    onChange={(e) => editForm.setData('name', e.target.value)}
                                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 focus:border-indigo-500 text-slate-100 text-xs"
                                />
                                {editForm.errors.name && (
                                    <p className="text-red-400 mt-1">{editForm.errors.name}</p>
                                )}
                            </div>

                            <div>
                                <label className="block text-slate-300 font-semibold mb-1">Email Address</label>
                                <input
                                    type="email"
                                    required
                                    value={editForm.data.email}
                                    onChange={(e) => editForm.setData('email', e.target.value)}
                                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 focus:border-indigo-500 text-slate-100 text-xs"
                                />
                                {editForm.errors.email && (
                                    <p className="text-red-400 mt-1">{editForm.errors.email}</p>
                                )}
                            </div>

                            <div>
                                <label className="block text-slate-300 font-semibold mb-1">Role Assignment</label>
                                <select
                                    value={editForm.data.role}
                                    onChange={(e) => editForm.setData('role', e.target.value)}
                                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 focus:border-indigo-500 text-slate-100 text-xs"
                                >
                                    {availableRoles.map((role) => (
                                        <option key={role} value={role}>
                                            {role}
                                        </option>
                                    ))}
                                </select>
                                {editForm.errors.role && (
                                    <p className="text-red-400 mt-1">{editForm.errors.role}</p>
                                )}
                            </div>

                            <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-800">
                                <button
                                    type="button"
                                    onClick={() => setEditModalUser(null)}
                                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={editForm.processing}
                                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold flex items-center gap-2 shadow-lg shadow-indigo-600/30 transition disabled:opacity-50"
                                >
                                    {editForm.processing ? 'Saving...' : 'Save Changes'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Reset Password Modal */}
            {resetModalUser && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 space-y-6 shadow-2xl">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
                                    <KeyRound className="w-4 h-4" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-white text-sm">Reset User Password</h3>
                                    <p className="text-[11px] text-slate-400">Set a new password for this user</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setResetModalUser(null)}
                                className="text-slate-500 hover:text-slate-300 p-1"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center font-bold text-xs">
                                {resetModalUser.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="truncate">
                                <p className="font-semibold text-white text-xs truncate">{resetModalUser.name}</p>
                                <p className="text-[11px] font-mono text-slate-400 truncate">{resetModalUser.email}</p>
                            </div>
                        </div>

                        <form onSubmit={handleResetSubmit} className="space-y-4 text-xs">
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <label className="block text-slate-300 font-semibold">New Password</label>
                                    <button
                                        type="button"
                                        onClick={() => resetForm.setData('password', generateRandomPassword())}
                                        className="text-[10px] text-amber-400 hover:text-amber-300 flex items-center gap-1 font-semibold"
                                    >
                                        <Sparkles className="w-3 h-3" />
                                        Generate New
                                    </button>
                                </div>

                                <div className="relative">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        required
                                        value={resetForm.data.password}
                                        onChange={(e) => resetForm.setData('password', e.target.value)}
                                        placeholder="Minimum 8 characters"
                                        className="w-full px-3 py-2 pr-10 rounded-xl bg-slate-950 border border-slate-800 focus:border-amber-500 text-slate-100 font-mono text-xs"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                                    >
                                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                                {resetForm.errors.password && (
                                    <p className="text-red-400 mt-1">{resetForm.errors.password}</p>
                                )}
                            </div>

                            <p className="text-[11px] text-slate-500 leading-relaxed">
                                Once saved, the user must use this new password to authenticate into their workspace session.
                            </p>

                            <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-800">
                                <button
                                    type="button"
                                    onClick={() => setResetModalUser(null)}
                                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={resetForm.processing}
                                    className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold flex items-center gap-2 shadow-lg shadow-amber-500/20 transition disabled:opacity-50"
                                >
                                    <KeyRound className="w-3.5 h-3.5 text-slate-950" />
                                    {resetForm.processing ? 'Resetting...' : 'Reset Password'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {deleteModalUser && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-sm p-6 space-y-4 shadow-2xl">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-red-950/60 border border-red-800/60 text-red-400 flex items-center justify-center">
                                <Trash2 className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="font-bold text-white text-sm">Delete User Account</h3>
                                <p className="text-xs text-slate-400">This action cannot be undone.</p>
                            </div>
                        </div>

                        <p className="text-xs text-slate-300 leading-relaxed">
                            Are you sure you want to delete the user account for{' '}
                            <strong className="text-white">{deleteModalUser.name}</strong> (
                            {deleteModalUser.email})?
                        </p>

                        <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-800">
                            <button
                                onClick={() => setDeleteModalUser(null)}
                                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDeleteSubmit}
                                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold shadow-lg shadow-red-600/30 transition"
                            >
                                Confirm Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </AuthenticatedLayout>
    );
}
