import React, { useState, useMemo } from 'react';
import { Head, router } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import {
    Shield,
    ShieldCheck,
    ShieldAlert,
    Users,
    Building2,
    Search,
    RefreshCw,
    Check,
    X,
    AlertTriangle,
    Sliders,
    RotateCcw,
    CheckCircle2,
    Lock,
    Unlock,
    Info,
    Sparkles,
    ChevronRight,
    KeyRound,
    Clock,
    DollarSign,
    Palmtree,
    Layers,
} from 'lucide-react';

interface Tenant {
    id: string;
    name: string;
    slug: string;
    is_active: boolean;
    is_ams_enabled: boolean;
    is_payroll_enabled: boolean;
    users_count: number;
}

interface UserAccount {
    id: number;
    name: string;
    email: string;
    is_super_admin: boolean;
    is_company_owner: boolean;
    roles: string[];
    primary_role: string;
    direct_permissions: string[];
    inherited_permissions: string[];
    effective_permissions: string[];
    has_custom_overrides: boolean;
    created_at: string;
}

interface PermissionItem {
    key: string;
    name: string;
    description: string;
    is_critical: boolean;
}

interface GroupedDomain {
    domain_key: string;
    name: string;
    description: string;
    icon: string;
    permissions: PermissionItem[];
}

interface Props {
    tenants: Tenant[];
    selectedTenant: Tenant | null;
    users: UserAccount[];
    selectedUserId: number | null;
    rolePermissionsMap: Record<string, string[]>;
    groupedPermissions: Record<string, GroupedDomain>;
    availableRoles: string[];
    filters: {
        tenant_id?: string;
        search?: string;
    };
}

export default function SuperAdminAccessControl({
    tenants,
    selectedTenant,
    users,
    selectedUserId,
    rolePermissionsMap,
    groupedPermissions,
    availableRoles,
    filters,
}: Props) {
    // Current user selection
    const [activeUserId, setActiveUserId] = useState<number | null>(() => {
        if (selectedUserId && users.some((u) => u.id === selectedUserId)) {
            return selectedUserId;
        }
        return users[0]?.id ?? null;
    });

    const activeUser = useMemo(() => {
        return users.find((u) => u.id === activeUserId) ?? null;
    }, [users, activeUserId]);

    // Role state for the active user
    const [selectedRole, setSelectedRole] = useState<string>(() => {
        return activeUser?.primary_role ?? availableRoles[0] ?? 'Staff';
    });

    // Direct permissions state (checkboxes)
    const [directPerms, setDirectPerms] = useState<string[]>(() => {
        return activeUser?.direct_permissions ?? [];
    });

    // When active user changes, synchronize form state
    const handleSelectUser = (user: UserAccount) => {
        setActiveUserId(user.id);
        setSelectedRole(user.primary_role);
        setDirectPerms(user.direct_permissions);
    };

    // Filter states
    const [userSearch, setUserSearch] = useState('');
    const [permSearch, setPermSearch] = useState('');
    const [activeDomainTab, setActiveDomainTab] = useState<string>('all');
    const [confirmModalOpen, setConfirmModalOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isResetting, setIsResetting] = useState(false);

    // Tenant switcher handler
    const handleTenantChange = (tenantId: string) => {
        router.get('/admin/access-control', { tenant_id: tenantId }, { preserveState: false });
    };

    // Filtered users list
    const filteredUsers = useMemo(() => {
        if (!userSearch.trim()) return users;
        const q = userSearch.toLowerCase();
        return users.filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
    }, [users, userSearch]);

    // Permissions inherited from selected role
    const currentRoleInheritedPerms = useMemo(() => {
        return rolePermissionsMap[selectedRole] ?? [];
    }, [rolePermissionsMap, selectedRole]);

    // Check if a permission is effectively granted
    const isPermissionGranted = (permKey: string) => {
        return currentRoleInheritedPerms.includes(permKey) || directPerms.includes(permKey);
    };

    const isDirectlyGranted = (permKey: string) => {
        return directPerms.includes(permKey) && !currentRoleInheritedPerms.includes(permKey);
    };

    // Toggle direct permission
    const togglePermission = (permKey: string) => {
        const isInherited = currentRoleInheritedPerms.includes(permKey);

        if (isInherited) {
            // Already provided by role baseline
            return;
        }

        if (directPerms.includes(permKey)) {
            setDirectPerms((prev) => prev.filter((k) => k !== permKey));
        } else {
            setDirectPerms((prev) => [...prev, permKey]);
        }
    };

    // Batch domain actions
    const handleGrantAllInDomain = (domainPerms: PermissionItem[]) => {
        const keysToAdd = domainPerms
            .map((p) => p.key)
            .filter((k) => !currentRoleInheritedPerms.includes(k) && !directPerms.includes(k));
        setDirectPerms((prev) => [...prev, ...keysToAdd]);
    };

    const handleRevokeAllInDomain = (domainPerms: PermissionItem[]) => {
        const keysToRemove = domainPerms.map((p) => p.key);
        setDirectPerms((prev) => prev.filter((k) => !keysToRemove.includes(k)));
    };

    // Check dirty state
    const isDirty = useMemo(() => {
        if (!activeUser) return false;
        if (selectedRole !== activeUser.primary_role) return true;
        const initial = [...activeUser.direct_permissions].sort();
        const current = [...directPerms].sort();
        return JSON.stringify(initial) !== JSON.stringify(current);
    }, [activeUser, selectedRole, directPerms]);

    // Save access configuration
    const handleSave = () => {
        if (!selectedTenant || !activeUser) return;

        setIsSaving(true);
        router.put(
            `/admin/access-control/${selectedTenant.id}/users/${activeUser.id}`,
            {
                role: selectedRole,
                direct_permissions: directPerms,
            },
            {
                onSuccess: () => {
                    setIsSaving(false);
                    setConfirmModalOpen(false);
                },
                onError: () => {
                    setIsSaving(false);
                },
            }
        );
    };

    // Reset to role defaults
    const handleResetToRole = () => {
        if (!selectedTenant || !activeUser) return;
        if (!confirm(`Reset ${activeUser.name}'s permissions strictly to the default '${activeUser.primary_role}' baseline? All custom overrides will be removed.`)) {
            return;
        }

        setIsResetting(true);
        router.post(
            `/admin/access-control/${selectedTenant.id}/users/${activeUser.id}/reset`,
            {},
            {
                onSuccess: () => {
                    setIsResetting(false);
                    setDirectPerms([]);
                },
                onError: () => {
                    setIsResetting(false);
                },
            }
        );
    };

    // Render domain icon helper
    const renderDomainIcon = (iconName: string) => {
        switch (iconName) {
            case 'Shield':
                return <Shield className="w-5 h-5 text-indigo-400" />;
            case 'Globe':
                return <Building2 className="w-5 h-5 text-amber-400" />;
            case 'Building2':
                return <Building2 className="w-5 h-5 text-sky-400" />;
            case 'Users':
                return <Users className="w-5 h-5 text-emerald-400" />;
            case 'Clock':
                return <Clock className="w-5 h-5 text-violet-400" />;
            case 'Palmtree':
                return <Palmtree className="w-5 h-5 text-teal-400" />;
            case 'DollarSign':
                return <DollarSign className="w-5 h-5 text-amber-300" />;
            default:
                return <Layers className="w-5 h-5 text-slate-400" />;
        }
    };

    return (
        <AuthenticatedLayout title="Global Access Control & Permissions">
            <Head title="Global Access Control — Super Admin" />

            <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
                {/* Page Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                Super Admin Platform Hub
                            </span>
                            <span className="text-xs text-slate-500 font-mono">Domain RBAC Engine</span>
                        </div>
                        <h1 className="text-2xl font-bold text-white tracking-tight mt-1 flex items-center gap-2.5">
                            <KeyRound className="w-6 h-6 text-indigo-400" />
                            Enterprise Access Control & Permissions
                        </h1>
                        <p className="text-xs text-slate-400 mt-1">
                            Manage organization boundary roles, granular direct permission grants, and dual-layer security policies.
                        </p>
                    </div>

                    {/* Company Selector Dropdown Card */}
                    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-2.5 flex items-center gap-3 shadow-lg min-w-[280px]">
                        <Building2 className="w-5 h-5 text-indigo-400 flex-shrink-0 ml-1.5" />
                        <div className="flex-1">
                            <label htmlFor="company-select" className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                                Target Company
                            </label>
                            <select
                                id="company-select"
                                value={selectedTenant?.id ?? ''}
                                onChange={(e) => handleTenantChange(e.target.value)}
                                className="w-full bg-transparent border-none p-0 text-sm font-semibold text-white focus:ring-0 cursor-pointer"
                            >
                                {tenants.map((t) => (
                                    <option key={t.id} value={t.id} className="bg-slate-900 text-white">
                                        {t.name} ({t.users_count} users) {t.is_active ? '' : '— [Inactive]'}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                {/* Tenant Quick Info Strip */}
                {selectedTenant && (
                    <div className="bg-gradient-to-r from-slate-900 via-slate-900/95 to-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold">
                                {selectedTenant.name.charAt(0)}
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h2 className="text-sm font-bold text-white">{selectedTenant.name}</h2>
                                    <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                                        slug: {selectedTenant.slug}
                                    </span>
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${selectedTenant.is_active ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                                        {selectedTenant.is_active ? 'Active Company' : 'Inactive'}
                                    </span>
                                </div>
                                <p className="text-xs text-slate-400 mt-0.5">
                                    Total Users: <strong className="text-slate-200">{users.length}</strong> | AMS Module: <strong className={selectedTenant.is_ams_enabled ? 'text-emerald-400' : 'text-slate-500'}>{selectedTenant.is_ams_enabled ? 'Enabled' : 'Disabled'}</strong> | Payroll: <strong className={selectedTenant.is_payroll_enabled ? 'text-emerald-400' : 'text-slate-500'}>{selectedTenant.is_payroll_enabled ? 'Enabled' : 'Disabled'}</strong>
                                </p>
                            </div>
                        </div>

                        {/* Quick Stats Pill */}
                        <div className="flex items-center gap-2">
                            <div className="px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700 text-xs text-slate-300">
                                <span className="text-indigo-400 font-bold">{users.filter((u) => u.has_custom_overrides).length}</span> users with custom overrides
                            </div>
                        </div>
                    </div>
                )}

                {/* Master-Detail Content Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Left Column: User Directory */}
                    <div className="lg:col-span-4 space-y-4">
                        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl">
                            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
                                <div className="flex items-center gap-2">
                                    <Users className="w-4 h-4 text-indigo-400" />
                                    <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                                        Company Accounts ({filteredUsers.length})
                                    </h2>
                                </div>
                            </div>

                            {/* Search */}
                            <div className="relative mb-3">
                                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                                <input
                                    type="text"
                                    placeholder="Search users by name or email..."
                                    value={userSearch}
                                    onChange={(e) => setUserSearch(e.target.value)}
                                    className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                                />
                            </div>

                            {/* User List */}
                            <div className="space-y-1.5 max-h-[560px] overflow-y-auto pr-1">
                                {filteredUsers.length === 0 ? (
                                    <div className="py-8 text-center text-xs text-slate-500">
                                        No users found for this company.
                                    </div>
                                ) : (
                                    filteredUsers.map((u) => {
                                        const isSelected = activeUser?.id === u.id;
                                        return (
                                            <button
                                                key={u.id}
                                                type="button"
                                                onClick={() => handleSelectUser(u)}
                                                className={`w-full text-left p-3 rounded-xl border transition flex items-center justify-between group ${
                                                    isSelected
                                                        ? 'bg-indigo-600/15 border-indigo-500/50 shadow-md shadow-indigo-500/10'
                                                        : 'bg-slate-950/60 border-slate-800/80 hover:bg-slate-800/50 hover:border-slate-700'
                                                }`}
                                            >
                                                <div className="flex items-center gap-2.5 min-w-0">
                                                    <div
                                                        className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs flex-shrink-0 ${
                                                            isSelected
                                                                ? 'bg-indigo-600 text-white shadow'
                                                                : 'bg-slate-800 text-slate-300'
                                                        }`}
                                                    >
                                                        {u.name.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div className="min-w-0 truncate">
                                                        <div className="flex items-center gap-1.5">
                                                            <p className={`text-xs font-semibold truncate ${isSelected ? 'text-white' : 'text-slate-200'}`}>
                                                                {u.name}
                                                            </p>
                                                            {u.is_company_owner && (
                                                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                                                                    Owner
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-[10px] text-slate-400 truncate">{u.email}</p>
                                                    </div>
                                                </div>

                                                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800/90 text-slate-300 font-medium border border-slate-700">
                                                        {u.primary_role}
                                                    </span>
                                                    {u.has_custom_overrides && (
                                                        <span className="text-[9px] text-indigo-400 font-bold flex items-center gap-0.5">
                                                            <Sparkles className="w-2.5 h-2.5" />
                                                            +{u.direct_permissions.length} overrides
                                                        </span>
                                                    )}
                                                </div>
                                            </button>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Access Control Inspector */}
                    <div className="lg:col-span-8 space-y-4">
                        {activeUser ? (
                            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-5">
                                {/* Inspector Header */}
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 gap-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-indigo-600 to-sky-500 flex items-center justify-center text-white font-bold text-base shadow-lg shadow-indigo-500/20">
                                            {activeUser.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h3 className="text-base font-bold text-white">{activeUser.name}</h3>
                                                {activeUser.is_super_admin && (
                                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                                                        Super Admin
                                                    </span>
                                                )}
                                                {activeUser.is_company_owner && (
                                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-bold border border-indigo-500/30">
                                                        Company Owner
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-slate-400">{activeUser.email}</p>
                                        </div>
                                    </div>

                                    {/* Quick Actions */}
                                    <div className="flex items-center gap-2">
                                        {activeUser.has_custom_overrides && (
                                            <button
                                                type="button"
                                                onClick={handleResetToRole}
                                                disabled={isResetting}
                                                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition border border-slate-700 flex items-center gap-1.5"
                                                title="Revert all direct custom permissions back to the role defaults"
                                            >
                                                <RotateCcw className={`w-3.5 h-3.5 ${isResetting ? 'animate-spin' : ''}`} />
                                                Reset to Role Defaults
                                            </button>
                                        )}

                                        <button
                                            type="button"
                                            onClick={() => setConfirmModalOpen(true)}
                                            disabled={!isDirty || isSaving}
                                            className={`px-4 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-lg ${
                                                isDirty
                                                    ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30 animate-pulse'
                                                    : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                                            }`}
                                        >
                                            <Check className="w-4 h-4" />
                                            {isSaving ? 'Saving Changes...' : isDirty ? 'Save Access Changes' : 'Access Up to Date'}
                                        </button>
                                    </div>
                                </div>

                                {/* Primary Role Selection Banner */}
                                <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-950/40 via-slate-900 to-slate-900 border border-indigo-500/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div>
                                        <label htmlFor="role-select" className="text-xs font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                                            <Shield className="w-4 h-4 text-indigo-400" />
                                            Primary Organization Role
                                        </label>
                                        <p className="text-xs text-slate-400 mt-0.5">
                                            Sets the baseline permissions bundle. Direct permissions below allow granting extra capabilities.
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <select
                                            id="role-select"
                                            value={selectedRole}
                                            onChange={(e) => setSelectedRole(e.target.value)}
                                            className="bg-slate-950 border border-indigo-500/40 text-white text-xs font-semibold rounded-xl px-3 py-2 focus:ring-1 focus:ring-indigo-500"
                                        >
                                            {availableRoles.map((roleName) => (
                                                <option key={roleName} value={roleName}>
                                                    {roleName} ({rolePermissionsMap[roleName]?.length ?? 0} baseline perms)
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {/* Permission Matrix Filtering Header */}
                                <div className="space-y-3 pt-2">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                        <div className="flex items-center gap-2">
                                            <Sliders className="w-4 h-4 text-slate-400" />
                                            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                                                Granular Permission Matrix (44 Standard Capabilities)
                                            </h4>
                                        </div>

                                        {/* Permission Search */}
                                        <div className="relative min-w-[220px]">
                                            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
                                            <input
                                                type="text"
                                                placeholder="Filter permissions..."
                                                value={permSearch}
                                                onChange={(e) => setPermSearch(e.target.value)}
                                                className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:border-indigo-500"
                                            />
                                        </div>
                                    </div>

                                    {/* Domain Tabs */}
                                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                                        <button
                                            type="button"
                                            onClick={() => setActiveDomainTab('all')}
                                            className={`px-3 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                                                activeDomainTab === 'all'
                                                    ? 'bg-indigo-600 text-white shadow'
                                                    : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                                            }`}
                                        >
                                            All Domains
                                        </button>
                                        {Object.entries(groupedPermissions).map(([dKey, dVal]) => (
                                            <button
                                                key={dKey}
                                                type="button"
                                                onClick={() => setActiveDomainTab(dKey)}
                                                className={`px-3 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition flex items-center gap-1.5 ${
                                                    activeDomainTab === dKey
                                                        ? 'bg-indigo-600 text-white shadow'
                                                        : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                                                }`}
                                            >
                                                {dVal.name.split('(')[0].trim()}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Domain Permission Cards */}
                                <div className="space-y-4 max-h-[520px] overflow-y-auto pr-1">
                                    {Object.entries(groupedPermissions)
                                        .filter(([dKey]) => activeDomainTab === 'all' || activeDomainTab === dKey)
                                        .map(([dKey, dVal]) => {
                                            const matchingPerms = dVal.permissions.filter((p) => {
                                                if (!permSearch.trim()) return true;
                                                const q = permSearch.toLowerCase();
                                                return p.name.toLowerCase().includes(q) || p.key.toLowerCase().includes(q) || p.description.toLowerCase().includes(q);
                                            });

                                            if (matchingPerms.length === 0) return null;

                                            return (
                                                <div key={dKey} className="bg-slate-950/70 border border-slate-800/90 rounded-2xl p-4 space-y-3">
                                                    {/* Domain Card Header */}
                                                    <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                                                        <div className="flex items-center gap-2.5">
                                                            {renderDomainIcon(dVal.icon)}
                                                            <div>
                                                                <h5 className="text-xs font-bold text-white">{dVal.name}</h5>
                                                                <p className="text-[10px] text-slate-400">{dVal.description}</p>
                                                            </div>
                                                        </div>

                                                        {/* Batch Actions for Domain */}
                                                        <div className="flex items-center gap-1.5">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleGrantAllInDomain(dVal.permissions)}
                                                                className="px-2 py-0.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 text-[10px] font-semibold border border-indigo-500/30 transition"
                                                            >
                                                                Grant All
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleRevokeAllInDomain(dVal.permissions)}
                                                                className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 text-[10px] font-semibold border border-slate-700 transition"
                                                            >
                                                                Revoke Direct
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {/* Permission Switches Grid */}
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                                                        {matchingPerms.map((perm) => {
                                                            const isInherited = currentRoleInheritedPerms.includes(perm.key);
                                                            const isDirect = isDirectlyGranted(perm.key);
                                                            const isGranted = isInherited || isDirect;

                                                            return (
                                                                <div
                                                                    key={perm.key}
                                                                    onClick={() => togglePermission(perm.key)}
                                                                    className={`p-2.5 rounded-xl border transition cursor-pointer flex items-start justify-between gap-2.5 group ${
                                                                        isInherited
                                                                            ? 'bg-emerald-950/15 border-emerald-500/30 cursor-default'
                                                                            : isDirect
                                                                            ? 'bg-indigo-950/30 border-indigo-500/40 shadow-sm'
                                                                            : 'bg-slate-900/50 border-slate-800/80 hover:bg-slate-800/50 hover:border-slate-700'
                                                                    }`}
                                                                >
                                                                    <div className="min-w-0 flex-1">
                                                                        <div className="flex items-center gap-1.5 flex-wrap">
                                                                            <span className={`text-xs font-semibold ${isGranted ? 'text-white' : 'text-slate-300'}`}>
                                                                                {perm.name}
                                                                            </span>
                                                                            {perm.is_critical && (
                                                                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-red-500/10 text-red-400 font-bold border border-red-500/20">
                                                                                    High Privilege
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                        <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-2">{perm.description}</p>
                                                                        <p className="font-mono text-[9px] text-slate-500 mt-1">{perm.key}</p>
                                                                    </div>

                                                                    {/* Status Pill & Switch */}
                                                                    <div className="flex flex-col items-end gap-1 flex-shrink-0 pt-0.5">
                                                                        {isInherited ? (
                                                                            <span className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30 flex items-center gap-1">
                                                                                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                                                                Role Inherited
                                                                            </span>
                                                                        ) : isDirect ? (
                                                                            <span className="text-[9px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-bold border border-indigo-500/30 flex items-center gap-1">
                                                                                <Sparkles className="w-3 h-3 text-indigo-400" />
                                                                                Direct Grant
                                                                            </span>
                                                                        ) : (
                                                                            <span className="text-[9px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-500 font-medium border border-slate-700">
                                                                                Disabled
                                                                            </span>
                                                                        )}

                                                                        {/* Toggle Indicator */}
                                                                        <div
                                                                            className={`w-8 h-4 rounded-full p-0.5 transition-colors duration-200 ease-in-out ${
                                                                                isGranted ? 'bg-indigo-600' : 'bg-slate-800'
                                                                            }`}
                                                                        >
                                                                            <div
                                                                                className={`w-3 h-3 rounded-full bg-white transition-transform duration-200 ease-in-out ${
                                                                                    isGranted ? 'translate-x-4' : 'translate-x-0'
                                                                                }`}
                                                                            />
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                </div>
                            </div>
                        ) : (
                            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-12 text-center text-slate-400 space-y-3">
                                <Users className="w-12 h-12 mx-auto text-slate-600 animate-pulse" />
                                <h3 className="text-sm font-bold text-slate-300">No User Selected</h3>
                                <p className="text-xs text-slate-500">
                                    Please select a user from the directory on the left to inspect and configure access control policies.
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Confirmation Diff Modal */}
                {confirmModalOpen && activeUser && selectedTenant && (
                    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
                            <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
                                <div className="w-10 h-10 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
                                    <ShieldAlert className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-white">Confirm Access Control Changes</h3>
                                    <p className="text-xs text-slate-400">Review modifications for {activeUser.name}</p>
                                </div>
                            </div>

                            <div className="space-y-3 text-xs">
                                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
                                    <div className="flex justify-between items-center">
                                        <span className="text-slate-400">Target User:</span>
                                        <strong className="text-white">{activeUser.name} ({activeUser.email})</strong>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-slate-400">Company Scope:</span>
                                        <strong className="text-indigo-400">{selectedTenant.name}</strong>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-slate-400">Assigned Role:</span>
                                        <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-bold border border-indigo-500/30">
                                            {selectedRole}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-slate-400">Direct Overrides:</span>
                                        <strong className="text-white">{directPerms.length} custom grants</strong>
                                    </div>
                                </div>

                                <p className="text-[11px] text-slate-400">
                                    These permission changes will take effect immediately for the user's active session across all devices.
                                </p>
                            </div>

                            <div className="flex items-center justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setConfirmModalOpen(false)}
                                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSave}
                                    disabled={isSaving}
                                    className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 transition shadow-lg shadow-indigo-600/30 flex items-center gap-1.5"
                                >
                                    <Check className="w-4 h-4" />
                                    {isSaving ? 'Applying...' : 'Confirm & Save Access'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </AuthenticatedLayout>
    );
}
