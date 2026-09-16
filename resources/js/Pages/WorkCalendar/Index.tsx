import React, { useState } from 'react';
import { Head, useForm, router } from '@inertiajs/react';
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
} from 'lucide-react';

interface PublicHoliday {
    id: string;
    tenant_id: string;
    holiday_date: string;
    name: string;
    type: 'statutory' | 'mercantile' | 'poya';
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
        type: 'statutory' as 'statutory' | 'mercantile' | 'poya',
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

    const filteredHolidays = holidays.filter((h) => {
        if (filterType === 'all') return true;
        return h.type === filterType;
    });

    const getHolidayBadge = (type: string) => {
        switch (type) {
            case 'poya':
                return (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center gap-1">
                        <Moon className="w-3 h-3" /> Poya Holiday (2.0x OT)
                    </span>
                );
            case 'statutory':
                return (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1">
                        <Landmark className="w-3 h-3" /> Statutory Holiday (2.0x OT)
                    </span>
                );
            case 'mercantile':
                return (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/10 text-sky-400 border border-sky-500/20 flex items-center gap-1">
                        <Sun className="w-3 h-3" /> Mercantile Holiday
                    </span>
                );
            default:
                return null;
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-indigo-500 selection:text-white pb-24">
            <Head title="Work Calendar & Public Holidays — EMS" />

            {/* Top Navigation Bar */}
            <header className="border-b border-slate-800/80 bg-slate-950/70 backdrop-blur-md sticky top-0 z-40">
                <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-600 via-indigo-600 to-sky-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                            <CalendarIcon className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <span className="text-lg font-bold tracking-tight text-white">
                                Work Calendar & Public Holidays
                            </span>
                            <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                                Sri Lanka
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <a
                            href="/shifts"
                            className="text-xs font-medium text-slate-300 hover:text-white px-3 py-1.5 rounded-lg border border-slate-800 hover:border-slate-700 bg-slate-900/60 transition flex items-center gap-1.5"
                        >
                            <Clock className="w-3.5 h-3.5 text-sky-400" />
                            ← Shift Rosters
                        </a>
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
            </header>

            <main className="max-w-7xl mx-auto px-6 pt-8">
                {/* Year Selector & Summary KPIs */}
                <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800/80 mb-8 flex flex-col md:flex-row items-center justify-between gap-6">
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

                {/* Filter Selector */}
                <div className="flex items-center gap-2 mb-6">
                    {(['all', 'poya', 'statutory', 'mercantile'] as const).map((type) => (
                        <button
                            key={type}
                            type="button"
                            onClick={() => setFilterType(type)}
                            className={`px-4 py-1.5 rounded-xl capitalize text-xs font-semibold transition border ${
                                filterType === type
                                    ? 'bg-indigo-600 border-indigo-500 text-white shadow-md shadow-indigo-600/20'
                                    : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200'
                            }`}
                        >
                            {type === 'all' ? 'All Holidays' : `${type} Days`}
                        </button>
                    ))}
                </div>

                {/* Holiday Cards List */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredHolidays.map((holiday) => {
                        const dateObj = new Date(holiday.holiday_date);
                        const monthName = dateObj.toLocaleDateString('en-US', { month: 'short' });
                        const dayNum = dateObj.getDate();
                        const weekday = dateObj.toLocaleDateString('en-US', { weekday: 'long' });

                        return (
                            <div
                                key={holiday.id}
                                className="p-5 rounded-3xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700/80 transition flex items-center justify-between gap-4"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col items-center justify-center text-center flex-shrink-0">
                                        <span className="text-[10px] uppercase font-bold text-indigo-400 leading-none">
                                            {monthName}
                                        </span>
                                        <span className="text-base font-extrabold text-white leading-tight font-mono">
                                            {dayNum}
                                        </span>
                                    </div>

                                    <div>
                                        <h4 className="text-sm font-bold text-white tracking-tight">
                                            {holiday.name}
                                        </h4>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-xs text-slate-400">{weekday}</span>
                                            {getHolidayBadge(holiday.type)}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-1 flex-shrink-0">
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
                            </div>
                        );
                    })}

                    {filteredHolidays.length === 0 && (
                        <div className="col-span-full p-16 text-center rounded-3xl bg-slate-900/40 border border-slate-800/60 text-slate-400">
                            <CalendarIcon className="w-12 h-12 mx-auto text-slate-600 mb-3" />
                            <h3 className="text-base font-semibold text-white">No Holidays Scheduled for {selectedYear}</h3>
                            <p className="text-xs text-slate-400 mt-1">
                                Click "Populate Sri Lanka Holidays" to generate the standard gazetted public holiday calendar.
                            </p>
                            <button
                                type="button"
                                onClick={handleSeedHolidays}
                                className="mt-4 px-4 py-2 rounded-xl bg-amber-600/20 text-amber-300 border border-amber-500/30 text-xs font-semibold hover:bg-amber-600/30 transition"
                            >
                                Populate Sri Lanka Holidays
                            </button>
                        </div>
                    )}
                </div>
            </main>

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
                                                e.target.value as 'statutory' | 'mercantile' | 'poya'
                                            )
                                        }
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                                    >
                                        <option value="poya">Poya Day (2.0x OT)</option>
                                        <option value="statutory">Statutory Holiday (2.0x OT)</option>
                                        <option value="mercantile">Mercantile Holiday (1.5x OT)</option>
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
    );
}
