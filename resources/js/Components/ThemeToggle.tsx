import React, { useEffect, useState } from 'react';
import { Sun, Moon, Laptop } from 'lucide-react';

type ThemeMode = 'light' | 'dark' | 'system';

export default function ThemeToggle() {
    const [theme, setTheme] = useState<ThemeMode>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('theme') as ThemeMode | null;
            if (saved === 'light' || saved === 'dark' || saved === 'system') {
                return saved;
            }
        }
        return 'system';
    });

    const [dropdownOpen, setDropdownOpen] = useState(false);

    useEffect(() => {
        const root = document.documentElement;

        const applyTheme = (mode: ThemeMode) => {
            if (mode === 'dark') {
                root.classList.add('dark');
            } else if (mode === 'light') {
                root.classList.remove('dark');
            } else {
                // system
                if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
                    root.classList.add('dark');
                } else {
                    root.classList.remove('dark');
                }
            }
        };

        applyTheme(theme);
        localStorage.setItem('theme', theme);

        // Listen for OS theme changes if in system mode
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handleChange = () => {
            if (theme === 'system') {
                applyTheme('system');
            }
        };

        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
    }, [theme]);

    return (
        <div className="relative">
            <button
                type="button"
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:border-slate-700 dark:hover:bg-slate-800/80 dark:hover:text-slate-200"
                title={`Theme: ${theme.charAt(0).toUpperCase() + theme.slice(1)}`}
                aria-label="Toggle Theme"
            >
                {theme === 'light' && <Sun className="h-4 w-4 text-amber-500" />}
                {theme === 'dark' && <Moon className="h-4 w-4 text-indigo-400" />}
                {theme === 'system' && <Laptop className="h-4 w-4 text-slate-500 dark:text-slate-400" />}
            </button>

            {dropdownOpen && (
                <div
                    onMouseLeave={() => setDropdownOpen(false)}
                    className="absolute right-0 mt-2 w-36 rounded-xl border border-slate-200 bg-white p-1 text-xs font-medium shadow-xl dark:border-slate-800 dark:bg-slate-900 z-50 animate-in fade-in zoom-in-95 duration-100"
                >
                    <button
                        type="button"
                        onClick={() => {
                            setTheme('light');
                            setDropdownOpen(false);
                        }}
                        className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 transition ${
                            theme === 'light'
                                ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 font-semibold'
                                : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                        }`}
                    >
                        <Sun className="h-3.5 w-3.5 text-amber-500" />
                        <span>Light</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => {
                            setTheme('dark');
                            setDropdownOpen(false);
                        }}
                        className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 transition ${
                            theme === 'dark'
                                ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 font-semibold'
                                : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                        }`}
                    >
                        <Moon className="h-3.5 w-3.5 text-indigo-400" />
                        <span>Dark</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => {
                            setTheme('system');
                            setDropdownOpen(false);
                        }}
                        className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 transition ${
                            theme === 'system'
                                ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 font-semibold'
                                : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                        }`}
                    >
                        <Laptop className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
                        <span>System</span>
                    </button>
                </div>
            )}
        </div>
    );
}
