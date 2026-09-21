import React, { useState, useMemo, useEffect } from 'react';
import { Head, useForm, router, Link } from '@inertiajs/react';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import {
    Calendar as CalendarIcon,
    Plus,
    Edit2,
    Trash2,
    Sparkles,
    ChevronLeft,
    ChevronRight,
    Sun,
    Moon,
    CheckCircle2,
    AlertCircle,
    X,
    Clock,
    Landmark,
    Filter,
    Fingerprint,
    Search,
} from 'lucide-react';

interface PublicHoliday {
    id: string;
    tenant_id: string;
    holiday_date: string;
    name: string;
    type: 'statutory' | 'mercantile' | 'poya' | 'company' | 'special';
    description: string | null;
}

interface Props {
    holidays: PublicHoliday[];
    stats: {
        year: number;
        total_holidays: number;
        poya_days: number;
        statutory_days: number;
        mercantile_days: number;
    };
    currentYear: number;
}

export default function Index({ holidays, stats, currentYear }: Props) {
    const [selectedYear, setSelectedYear] = useState(currentYear);
    const [filterType, setFilterType] = useState<string>('all');
    const [isHolidayModalOpen, setIsHolidayModalOpen] = useState(false);
    const [editingHoliday, setEditingHoliday] = useState<PublicHoliday | null>(null);

    const holidayForm = useForm({
        name: '',
        holiday_date: `${currentYear}-01-01`,
        type: 'statutory' as 'statutory' | 'mercantile' | 'poya' | 'company' | 'special',
        description: '',
    });

    const openCreateModal = () => {
        setEditingHoliday(null);
        holidayForm.setData({
            name: '',
            holiday_date: `${selectedYear}-01-01`,
            type: 'statutory',
            description: '',
        });
        setIsHolidayModalOpen(true);
    };

    const openEditModal = (holiday: PublicHoliday) => {
        setEditingHoliday(holiday);
        holidayForm.setData({
            name: holiday.name,
            holiday_date: holiday.holiday_date.substring(0, 10),
            type: holiday.type,
            description: holiday.description || '',
        });
        setIsHolidayModalOpen(true);
    };

    const handleHolidaySubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (editingHoliday) {
            holidayForm.put(`/work-calendar/holidays/${editingHoliday.id}`, {
                preserveScroll: true,
                onSuccess: () => setIsHolidayModalOpen(false),
            });
        } else {
            holidayForm.post('/work-calendar/holidays', {
                preserveScroll: true,
                onSuccess: () => setIsHolidayModalOpen(false),
            });
        }
    };

    const handleDeleteHoliday = (holidayId: string, name: string) => {
        if (confirm(`Are you sure you want to delete holiday "${name}"?`)) {
            router.delete(`/work-calendar/holidays/${holidayId}`, {
                preserveScroll: true,
            });
        }
    };

    const handleYearChange = (delta: number) => {
        const nextYear = selectedYear + delta;
        setSelectedYear(nextYear);
        router.get(`/work-calendar?year=${nextYear}`, {}, { preserveState: true });
    };

    const handleSeedHolidays = () => {
        if (confirm(`Populate official Sri Lankan statutory, mercantile and Poya holidays for ${selectedYear}?`)) {
            router.post(
                '/work-calendar/seed-holidays',
                { year: selectedYear },
                {
                    preserveScroll: true,
                }
            );
        }
    };

    const [searchQuery, setSearchQuery] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const PAGE_SIZE = 10;

    useEffect(() => {
        setCurrentPage(1);
    }, [filterType, searchQuery, selectedYear]);

    const filteredHolidays = useMemo(() => {
        return holidays.filter((h) => {
            const matchesType = filterType === 'all' || h.type === filterType;
            const q = searchQuery.toLowerCase().trim();
            const matchesQuery =
                !q ||
                h.name.toLowerCase().includes(q) ||
                (h.description && h.description.toLowerCase().includes(q)) ||
                h.holiday_date.includes(q);
            return matchesType && matchesQuery;
        });
    }, [holidays, filterType, searchQuery]);

    const totalPages = Math.ceil(filteredHolidays.length / PAGE_SIZE) || 1;
    const paginatedHolidays = useMemo(() => {
        const start = (currentPage - 1) * PAGE_SIZE;
        return filteredHolidays.slice(start, start + PAGE_SIZE);
    }, [filteredHolidays, currentPage]);

    const parseDateParts = (dateStr: string) => {
        const cleanStr = dateStr.substring(0, 10);
        const [year, month, day] = cleanStr.split('-').map(Number);
        const dateObj = new Date(year, month - 1, day);
        const monthName = dateObj.toLocaleDateString('en-US', { month: 'short' });
        const weekday = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
        return { cleanStr, year, monthName, dayNum: day, weekday };
    };

    const getHolidayBadge = (type: string) => {
        switch (type) {
            case 'poya':
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/10 text-purple-300 border border-purple-500/20">
                        <Moon className="w-3 h-3 text-purple-400" /> Poya Holiday
                    </span>
                );
            case 'statutory':
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20">
                        <Landmark className="w-3 h-3 text-amber-400" /> Statutory Holiday
                    </span>
                );
            case 'mercantile':
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/10 text-sky-300 border border-sky-500/20">
                        <Sun className="w-3 h-3 text-sky-400" /> Mercantile Holiday
                    </span>
                );
            case 'company':
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                        <Sparkles className="w-3 h-3 text-emerald-400" /> Company Holiday
                    </span>
                );
            case 'special':
                return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-pink-500/10 text-pink-300 border border-pink-500/20">
                        <CalendarIcon className="w-3 h-3 text-pink-400" /> Special Holiday
                    </span>
                );
            default:
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700 capitalize">
                        {type}
                    </span>
                );
        }
    };

    return (
        <AuthenticatedLayout title="Work Calendar & Public Holidays" backUrl="/shifts">
            <div className="max-w-7xl mx-auto space-y-4">
                {/* Header Subnavigation Bar */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-2 border-b border-slate-800/80">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-600 via-indigo-600 to-sky-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                            <CalendarIcon className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-xl font-bold tracking-tight text-white">
                                    Work Calendar & Public Holidays
                                </h1>
                                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                                    Sri Lanka
                                </span>
                            </div>
                            <p className="text-xs text-slate-400">
                                Statutory gazetted holidays, Poya days, and mercantile overtime multiplier calendars
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <Link
                            href="/attendance/daily"
                            className="text-xs font-medium text-slate-300 hover:text-white px-3 py-1.5 rounded-lg border border-slate-800 hover:border-slate-700 bg-slate-900/60 transition flex items-center gap-1.5"
                        >
                            <Clock className="w-3.5 h-3.5 text-indigo-400" />
                            Daily Attendance Ledger
                        </Link>
                        <Link
                            href="/shifts"
                            className="text-xs font-medium text-slate-300 hover:text-white px-3 py-1.5 rounded-lg border border-slate-800 hover:border-slate-700 bg-slate-900/60 transition flex items-center gap-1.5"
                        >
                            <Clock className="w-3.5 h-3.5 text-sky-400" />
                            Shift Rosters
                        </Link>
                        <Link
                            href="/attendance/import"
                            className="text-xs font-medium text-slate-300 hover:text-white px-3 py-1.5 rounded-lg border border-slate-800 hover:border-slate-700 bg-slate-900/60 transition flex items-center gap-1.5"
                        >
                            <Fingerprint className="w-3.5 h-3.5 text-cyan-400" />
                            Biometric Import
                        </Link>
                        <button
                            type="button"
                            onClick={handleSeedHolidays}
                            className="text-xs font-medium text-amber-400 hover:text-amber-300 px-3 py-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 transition flex items-center gap-1.5"
                            title="Populate standard Sri Lankan holiday calendar"
                        >
                            <Sparkles className="w-3.5 h-3.5" />
                            Populate Sri Lanka Holidays
                        </button>
                        <button
                            type="button"
                            onClick={openCreateModal}
                            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-indigo-600/20 transition"
                        >
                            <Plus className="w-4 h-4" />
                            Add Holiday
                        </button>
                    </div>
                </div>
                {/* Year Selector & Summary KPIs */}
                <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded-2xl border border-slate-800">
                            <button
                                type="button"
                                onClick={() => handleYearChange(-1)}
                                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <span className="text-xl font-bold font-mono px-4 text-white">{selectedYear}</span>
                            <button
                                type="button"
                                onClick={() => handleYearChange(1)}
                                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-white">Annual Statutory Calendar</h2>
                            <p className="text-xs text-slate-400">
                                Work calendar drives overtime multipliers (2.0x on Poya/Statutory) and payroll day counts.
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-4 gap-3 text-center text-xs">
                        <div className="px-3.5 py-2 rounded-2xl bg-slate-950/60 border border-slate-800">
                            <span className="text-slate-400 block text-[10px]">Total</span>
                            <span className="text-base font-bold text-white">{stats.total_holidays}</span>
                        </div>
                        <div className="px-3.5 py-2 rounded-2xl bg-slate-950/60 border border-slate-800">
                            <span className="text-purple-400 block text-[10px]">Poya</span>
                            <span className="text-base font-bold text-purple-400">{stats.poya_days}</span>
                        </div>
                        <div className="px-3.5 py-2 rounded-2xl bg-slate-950/60 border border-slate-800">
                            <span className="text-amber-400 block text-[10px]">Statutory</span>
                            <span className="text-base font-bold text-amber-400">{stats.statutory_days}</span>
                        </div>
                        <div className="px-3.5 py-2 rounded-2xl bg-slate-950/60 border border-slate-800">
                            <span className="text-sky-400 block text-[10px]">Mercantile</span>
                            <span className="text-base font-bold text-sky-400">{stats.mercantile_days}</span>
                        </div>
                    </div>
                </div>

                {/* Toolbar: Search, Filters & Counter */}
                <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800/80 flex flex-col md:flex-row items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
                        {/* Search Box */}
                        <div className="relative flex-1 md:w-64">
                            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                            <input
                                type="text"
                                placeholder="Search by name, date..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                            />
                            {searchQuery && (
                                <button
                                    type="button"
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-2.5 top-2 text-slate-500 hover:text-slate-300 text-xs"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>

                        {/* Holiday Type Filter Pills */}
                        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
                            {(['all', 'poya', 'statutory', 'mercantile'] as const).map((type) => (
                                <button
                                    key={type}
                                    type="button"
                                    onClick={() => setFilterType(type)}
                                    className={`px-3 py-1 rounded-lg capitalize font-medium text-[11px] transition ${
                                        filterType === type
                                            ? 'bg-indigo-600 text-white'
                                            : 'text-slate-400 hover:text-slate-200'
                                    }`}
                                >
                                    {type === 'all' ? 'All Holidays' : `${type} Days`}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex items-center gap-3 self-end md:self-auto text-xs text-slate-400">
                        <span>
                            Showing <strong className="text-white">{filteredHolidays.length > 0 ? (currentPage - 1) * PAGE_SIZE + 1 : 0}</strong>–
                            <strong className="text-white">{Math.min(currentPage * PAGE_SIZE, filteredHolidays.length)}</strong> of{' '}
                            <strong className="text-white">{filteredHolidays.length}</strong> in {selectedYear}
                            {filteredHolidays.length !== holidays.length && ` (${holidays.length} total)`}
                        </span>
                    </div>
                </div>

                {/* Traditional Data Table View */}
                <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 overflow-hidden shadow-xl">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="border-b border-slate-800 bg-slate-950/70 text-slate-400 uppercase text-[10px] tracking-wider font-semibold">
                                <tr>
                                    <th className="py-3.5 px-4">Date</th>
                                    <th className="py-3.5 px-4">Day</th>
                                    <th className="py-3.5 px-4">Holiday Name</th>
                                    <th className="py-3.5 px-4">Classification</th>
                                    <th className="py-3.5 px-4">Overtime Multiplier</th>
                                    <th className="py-3.5 px-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/60">
                                {paginatedHolidays.map((holiday) => {
                                    const { cleanStr, monthName, dayNum, weekday } = parseDateParts(holiday.holiday_date);
                                    const isDoubleOt = ['poya', 'statutory', 'company'].includes(holiday.type);

                                    return (
                                        <tr key={holiday.id} className="hover:bg-slate-800/30 transition group">
                                            {/* Date */}
                                            <td className="py-3 px-4 whitespace-nowrap">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-xl bg-slate-950 border border-slate-800 flex flex-col items-center justify-center text-center flex-shrink-0">
                                                        <span className="text-[9px] uppercase font-bold text-indigo-400 leading-none">
                                                            {monthName}
                                                        </span>
                                                        <span className="text-sm font-extrabold text-white leading-tight font-mono">
                                                            {dayNum}
                                                        </span>
                                                    </div>
                                                    <span className="font-mono text-xs font-semibold text-slate-200">{cleanStr}</span>
                                                </div>
                                            </td>

                                            {/* Weekday */}
                                            <td className="py-3 px-4 whitespace-nowrap text-slate-300 font-medium">
                                                {weekday}
                                            </td>

                                            {/* Holiday Name & Description */}
                                            <td className="py-3 px-4">
                                                <div className="font-semibold text-white text-sm">
                                                    {holiday.name}
                                                </div>
                                                {holiday.description && (
                                                    <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1 max-w-md">
                                                        {holiday.description}
                                                    </p>
                                                )}
                                            </td>

                                            {/* Classification */}
                                            <td className="py-3 px-4 whitespace-nowrap">
                                                {getHolidayBadge(holiday.type)}
                                            </td>

                                            {/* Overtime Multiplier */}
                                            <td className="py-3 px-4 whitespace-nowrap">
                                                {isDoubleOt ? (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20 font-mono">
                                                        2.0x Double OT
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700 font-mono">
                                                        Standard Day
                                                    </span>
                                                )}
                                            </td>

                                            {/* Actions */}
                                            <td className="py-3 px-4 text-right whitespace-nowrap">
                                                <div className="flex items-center justify-end gap-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => openEditModal(holiday)}
                                                        title="Edit Holiday"
                                                        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                                                    >
                                                        <Edit2 className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDeleteHoliday(holiday.id, holiday.name)}
                                                        title="Delete Holiday"
                                                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}

                                {filteredHolidays.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="py-16 text-center text-slate-400">
                                            <CalendarIcon className="w-12 h-12 mx-auto text-slate-600 mb-3" />
                                            <h3 className="text-base font-semibold text-white">No Holidays Found for {selectedYear}</h3>
                                            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                                                {searchQuery || filterType !== 'all'
                                                    ? 'No holidays match your active filter or search criteria. Try clearing search filters.'
                                                    : 'No public holidays are registered for this year yet. Click below to populate standard gazetted holidays.'}
                                            </p>
                                            <div className="mt-4 flex items-center justify-center gap-3">
                                                <button
                                                    type="button"
                                                    onClick={handleSeedHolidays}
                                                    className="px-4 py-2 rounded-xl bg-amber-600/20 text-amber-300 border border-amber-500/30 text-xs font-semibold hover:bg-amber-600/30 transition"
                                                >
                                                    Populate Sri Lanka Holidays
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={openCreateModal}
                                                    className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-500 transition"
                                                >
                                                    Add Holiday
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination Bar (Max 10 records per page) */}
                    {filteredHolidays.length > 0 && (
                        <div className="p-3.5 border-t border-slate-800 bg-slate-950/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
                            <div>
                                Showing <span className="font-semibold text-white">{(currentPage - 1) * PAGE_SIZE + 1}</span> to{' '}
                                <span className="font-semibold text-white">{Math.min(currentPage * PAGE_SIZE, filteredHolidays.length)}</span> of{' '}
                                <span className="font-semibold text-white">{filteredHolidays.length}</span> holidays
                                {totalPages > 1 && (
                                    <span className="ml-1.5 text-slate-500">(Page {currentPage} of {totalPages})</span>
                                )}
                            </div>

                            {totalPages > 1 && (
                                <div className="flex items-center gap-1.5">
                                    <button
                                        type="button"
                                        disabled={currentPage === 1}
                                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                        className={`p-1.5 rounded-lg border border-slate-800 transition flex items-center justify-center ${
                                            currentPage === 1
                                                ? 'opacity-30 cursor-not-allowed text-slate-600'
                                                : 'text-slate-400 hover:text-white hover:bg-slate-800'
                                        }`}
                                        title="Previous Page"
                                    >
                                        <ChevronLeft className="w-4 h-4" />
                                    </button>

                                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                                        .filter((p) => {
                                            if (totalPages <= 7) return true;
                                            return p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1;
                                        })
                                        .reduce<(number | string)[]>((acc, p, idx, arr) => {
                                            if (idx > 0 && (p as number) - (arr[idx - 1] as number) > 1) {
                                                acc.push('...');
                                            }
                                            acc.push(p);
                                            return acc;
                                        }, [])
                                        .map((item, idx) =>
                                            item === '...' ? (
                                                <span key={`ellipsis-${idx}`} className="px-2 text-slate-600">...</span>
                                            ) : (
                                                <button
                                                    key={item}
                                                    type="button"
                                                    onClick={() => setCurrentPage(Number(item))}
                                                    className={`px-3 py-1 rounded-lg border text-xs font-semibold transition ${
                                                        currentPage === item
                                                            ? 'bg-indigo-600 border-indigo-500 text-white shadow-sm shadow-indigo-600/30'
                                                            : 'border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-white'
                                                    }`}
                                                >
                                                    {item}
                                                </button>
                                            )
                                        )}

                                    <button
                                        type="button"
                                        disabled={currentPage === totalPages}
                                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                                        className={`p-1.5 rounded-lg border border-slate-800 transition flex items-center justify-center ${
                                            currentPage === totalPages
                                                ? 'opacity-30 cursor-not-allowed text-slate-600'
                                                : 'text-slate-400 hover:text-white hover:bg-slate-800'
                                        }`}
                                        title="Next Page"
                                    >
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>

            {/* Holiday Modal */}
            {isHolidayModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
                    <div className="w-full max-w-md rounded-3xl bg-slate-900 border border-slate-800 p-6 shadow-2xl relative">
                        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                            <h3 className="text-base font-bold text-white flex items-center gap-2">
                                <CalendarIcon className="w-5 h-5 text-amber-400" />
                                {editingHoliday ? 'Edit Public Holiday' : 'Add Public Holiday'}
                            </h3>
                            <button
                                type="button"
                                onClick={() => setIsHolidayModalOpen(false)}
                                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleHolidaySubmit} className="mt-6 space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1">
                                    Holiday Name *
                                </label>
                                <input
                                    type="text"
                                    value={holidayForm.data.name}
                                    onChange={(e) => holidayForm.setData('name', e.target.value)}
                                    required
                                    placeholder="e.g. Vesak Full Moon Poya Day"
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                                        Holiday Date *
                                    </label>
                                    <input
                                        type="date"
                                        value={holidayForm.data.holiday_date}
                                        onChange={(e) => holidayForm.setData('holiday_date', e.target.value)}
                                        required
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                                        Statutory Type *
                                    </label>
                                    <select
                                        value={holidayForm.data.type}
                                        onChange={(e) =>
                                            holidayForm.setData(
                                                'type',
                                                e.target.value as 'statutory' | 'mercantile' | 'poya' | 'company' | 'special'
                                            )
                                        }
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                                    >
                                        <option value="poya">Poya Day (2.0x OT)</option>
                                        <option value="statutory">Statutory Holiday (2.0x OT)</option>
                                        <option value="mercantile">Mercantile Holiday (1.5x OT)</option>
                                        <option value="company">Special Company Holiday (2.0x OT)</option>
                                        <option value="special">Special Declared Holiday</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-300 mb-1">
                                    Description & Gazette Reference
                                </label>
                                <textarea
                                    value={holidayForm.data.description}
                                    onChange={(e) => holidayForm.setData('description', e.target.value)}
                                    rows={2}
                                    placeholder="Government gazette reference or operational notes..."
                                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                                />
                            </div>

                            <div className="pt-6 border-t border-slate-800 flex items-center justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsHolidayModalOpen(false)}
                                    className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={holidayForm.processing}
                                    className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/20 disabled:opacity-50"
                                >
                                    {holidayForm.processing ? 'Saving...' : editingHoliday ? 'Update Holiday' : 'Create Holiday'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            </div>
        </AuthenticatedLayout>
    );
}
