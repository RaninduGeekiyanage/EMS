import React, { useState, useEffect } from 'react';
import {
    X,
    Cpu,
    Sparkles,
    CheckCircle2,
    AlertCircle,
    Play,
    Save,
    Trash2,
    Plus,
    FileText,
    HelpCircle,
    Layers,
    ArrowRight,
    Loader2,
} from 'lucide-react';

export interface BiometricDeviceProfile {
    id: string;
    tenant_id?: string;
    name: string;
    device_brand: string;
    model_name: string | null;
    file_extension: string;
    delimiter_type: string;
    custom_delimiter: string | null;
    skip_header_lines: number;
    date_mode: 'combined' | 'separate';
    date_format: string;
    time_format: string | null;
    columns_config: {
        biometric_id_col: number;
        datetime_col?: number | null;
        date_col?: number | null;
        time_col?: number | null;
        am_pm_col?: number | null;
        punch_type_col?: number | null;
        device_id_col?: number | null;
    };
    status_code_mapping: Record<string, string> | null;
    default_device_id: string | null;
    is_active: boolean;
}

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSaved: (profile: BiometricDeviceProfile) => void;
    editingProfile?: BiometricDeviceProfile | null;
}

const PRESETS = [
    {
        key: 'space_ampm_txt',
        label: 'Space-Delimited 12-Hour AM/PM (C/In, C/Out)',
        brand: 'other',
        name: 'Space-Delimited AM/PM Terminal Log',
        file_extension: 'txt',
        delimiter_type: 'space',
        skip_header_lines: 0,
        date_mode: 'separate',
        date_format: 'd/m/Y g:i A',
        sample: "40     40 28/08/2026 7:05 AM C/In OverTime In    FOT\n40     40 28/08/2026 2:59 PM C/Out OverTime Out  FOT\n40     40 31/08/2026 7:04 AM C/In OverTime In    FOT\n40     40 31/08/2026 3:01 PM C/Out OverTime Out  FOT\n",
        columns_config: {
            biometric_id_col: 0,
            date_col: 2,
            time_col: 3,
            am_pm_col: 4,
            punch_type_col: 5,
            device_id_col: null,
        },
        status_code_mapping: {
            'C/In': 'in',
            'C/Out': 'out',
            'in': 'in',
            'out': 'out',
        },
    },
    {
        key: 'zkteco_dat',
        label: 'ZKTeco Standard DAT',
        brand: 'zkteco',
        name: 'ZKTeco Terminal (attlog.dat)',
        file_extension: 'dat',
        delimiter_type: 'tab',
        skip_header_lines: 0,
        date_mode: 'combined',
        date_format: 'Y-m-d H:i:s',
        sample: "1001\t2026-03-01 08:30:15\t0\t1\t0\n1001\t2026-03-01 17:05:22\t1\t1\t0\n1002\t2026-03-01 08:45:00\t0\t1\t0\n",
        columns_config: {
            biometric_id_col: 0,
            datetime_col: 1,
            punch_type_col: 2,
            device_id_col: null,
        },
        status_code_mapping: {
            '0': 'in',
            '1': 'out',
            '2': 'out',
            '3': 'in',
            '4': 'in',
            '5': 'out',
        },
    },
    {
        key: 'hikvision_txt',
        label: 'Hikvision MinMoe (Event Export)',
        brand: 'hikvision',
        name: 'Hikvision Face/Fingerprint Terminal',
        file_extension: 'txt',
        delimiter_type: 'tab',
        skip_header_lines: 1,
        date_mode: 'combined',
        date_format: 'Y-m-d H:i:s',
        sample: "No.\tTime\tCard No.\tName\tDevice\tEvent\n1\t2026-03-01 08:30:00\t1001\tSunil Perera\tMain Turnstile\tCheck-In\n2\t2026-03-01 17:05:00\t1001\tSunil Perera\tMain Turnstile\tCheck-Out\n3\t2026-03-01 08:45:00\t1002\tKamal Silva\tMain Turnstile\tCheck-In\n",
        columns_config: {
            biometric_id_col: 2,
            datetime_col: 1,
            punch_type_col: 5,
            device_id_col: 4,
        },
        status_code_mapping: {
            'Check-In': 'in',
            'Check-Out': 'out',
            '1': 'in',
            '2': 'out',
        },
    },
    {
        key: 'realand_txt',
        label: 'Realand Bio-Office (Space Separated)',
        brand: 'realand',
        name: 'Realand Standalone Device',
        file_extension: 'txt',
        delimiter_type: 'space',
        skip_header_lines: 0,
        date_mode: 'separate',
        date_format: 'Y-m-d H:i:s',
        sample: "1001 2026-03-01 08:30:00 0 1\n1001 2026-03-01 17:05:00 1 1\n1002 2026-03-01 08:45:00 0 1\n",
        columns_config: {
            biometric_id_col: 0,
            date_col: 1,
            time_col: 2,
            punch_type_col: 3,
            device_id_col: null,
        },
        status_code_mapping: {
            '0': 'in',
            '1': 'out',
            'C/In': 'in',
            'C/Out': 'out',
        },
    },
    {
        key: 'generic_whitespace',
        label: 'Generic Space/Tab Raw Punch Log',
        brand: 'other',
        name: 'Generic Space-Delimited Log',
        file_extension: 'txt',
        delimiter_type: 'space',
        skip_header_lines: 0,
        date_mode: 'combined',
        date_format: 'auto',
        sample: "1001 2026-03-01 08:30:00 in\n1001 2026-03-01 17:05:00 out\n1002 2026-03-01 08:45:00 in\n",
        columns_config: {
            biometric_id_col: 0,
            datetime_col: 1,
            punch_type_col: 2,
            device_id_col: null,
        },
        status_code_mapping: {
            'in': 'in',
            'out': 'out',
        },
    },
];

export default function BiometricProfileModal({
    isOpen,
    onClose,
    onSaved,
    editingProfile,
}: Props) {
    if (!isOpen) return null;

    const [name, setName] = useState(editingProfile?.name || '');
    const [deviceBrand, setDeviceBrand] = useState(editingProfile?.device_brand || 'hikvision');
    const [modelName, setModelName] = useState(editingProfile?.model_name || '');
    const [fileExtension, setFileExtension] = useState(editingProfile?.file_extension || 'txt');
    const [delimiterType, setDelimiterType] = useState(editingProfile?.delimiter_type || 'tab');
    const [customDelimiter, setCustomDelimiter] = useState(editingProfile?.custom_delimiter || '');
    const [skipHeaderLines, setSkipHeaderLines] = useState<number>(editingProfile?.skip_header_lines ?? 0);
    const [dateMode, setDateMode] = useState<'combined' | 'separate'>(editingProfile?.date_mode || 'combined');
    const [dateFormat, setDateFormat] = useState(editingProfile?.date_format || 'Y-m-d H:i:s');
    const [defaultDeviceId, setDefaultDeviceId] = useState(editingProfile?.default_device_id || '');

    // Column mapping indices
    const [bioIdCol, setBioIdCol] = useState<number>(editingProfile?.columns_config?.biometric_id_col ?? 0);
    const [datetimeCol, setDatetimeCol] = useState<number>(editingProfile?.columns_config?.datetime_col ?? 1);
    const [dateCol, setDateCol] = useState<number>(editingProfile?.columns_config?.date_col ?? 1);
    const [timeCol, setTimeCol] = useState<number>(editingProfile?.columns_config?.time_col ?? 2);
    const [amPmCol, setAmPmCol] = useState<string>(
        editingProfile?.columns_config?.am_pm_col !== undefined && editingProfile?.columns_config?.am_pm_col !== null
            ? String(editingProfile.columns_config.am_pm_col)
            : 'none'
    );
    const [punchTypeCol, setPunchTypeCol] = useState<string>(
        editingProfile?.columns_config?.punch_type_col !== undefined && editingProfile?.columns_config?.punch_type_col !== null
            ? String(editingProfile.columns_config.punch_type_col)
            : 'none'
    );
    const [deviceIdCol, setDeviceIdCol] = useState<string>(
        editingProfile?.columns_config?.device_id_col !== undefined && editingProfile?.columns_config?.device_id_col !== null
            ? String(editingProfile.columns_config.device_id_col)
            : 'none'
    );

    // Status code mappings key-value pairs
    const [statusMappings, setStatusMappings] = useState<Array<{ key: string; val: string }>>(() => {
        if (editingProfile?.status_code_mapping) {
            return Object.entries(editingProfile.status_code_mapping).map(([k, v]) => ({ key: k, val: v }));
        }
        return [
            { key: '0', val: 'in' },
            { key: '1', val: 'out' },
            { key: 'Check-In', val: 'in' },
            { key: 'Check-Out', val: 'out' },
        ];
    });

    // Sample snippet state
    const [sampleText, setSampleText] = useState<string>(PRESETS[1].sample);
    const [tokenizedRows, setTokenizedRows] = useState<Array<{ line: number; is_header: boolean; tokens: string[] }>>([]);
    const [maxTokens, setMaxTokens] = useState<number>(0);

    // Testing state
    const [isTesting, setIsTesting] = useState(false);
    const [testResult, setTestResult] = useState<any>(null);
    const [testError, setTestError] = useState<string | null>(null);

    // Saving state
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);

    const getCsrfToken = () => {
        const meta = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
        if (meta) return meta;
        const match = document.cookie.match(/XSRF-TOKEN=([^;]+)/);
        return match ? decodeURIComponent(match[1]) : '';
    };

    // Client-side quick tokenizer for live visual grid
    useEffect(() => {
        if (!sampleText.trim()) {
            setTokenizedRows([]);
            setMaxTokens(0);
            return;
        }

        const lines = sampleText.split(/\r?\n/).filter((l) => l.trim().length > 0);
        let maxCols = 0;
        const rows = lines.slice(0, 10).map((line, idx) => {
            const lineNum = idx + 1;
            let tokens: string[] = [];

            if (delimiterType === 'tab') {
                tokens = line.split(/\t+/).filter((t) => t.length > 0);
            } else if (delimiterType === 'space' || delimiterType === 'regex_whitespace') {
                tokens = line.trim().split(/\s+/).filter((t) => t.length > 0);
            } else if (delimiterType === 'comma') {
                tokens = line.split(',');
            } else if (delimiterType === 'semicolon') {
                tokens = line.split(';');
            } else if (delimiterType === 'pipe') {
                tokens = line.split('|');
            } else if (delimiterType === 'custom' && customDelimiter) {
                tokens = line.split(customDelimiter);
            } else {
                tokens = line.trim().split(/\s+/);
            }

            tokens = tokens.map((t) => t.trim());
            if (tokens.length > maxCols) maxCols = tokens.length;

            return {
                line: lineNum,
                is_header: lineNum <= skipHeaderLines,
                tokens,
            };
        });

        setTokenizedRows(rows);
        setMaxTokens(maxCols);
    }, [sampleText, delimiterType, customDelimiter, skipHeaderLines]);

    const handleApplyPreset = (preset: typeof PRESETS[0]) => {
        setName(preset.name);
        setDeviceBrand(preset.brand);
        setFileExtension(preset.file_extension);
        setDelimiterType(preset.delimiter_type);
        setSkipHeaderLines(preset.skip_header_lines);
        setDateMode(preset.date_mode as any);
        setDateFormat(preset.date_format);
        setSampleText(preset.sample);

        setBioIdCol(preset.columns_config.biometric_id_col);
        if (preset.date_mode === 'separate') {
            setDateCol(preset.columns_config.date_col ?? 1);
            setTimeCol(preset.columns_config.time_col ?? 2);
            setAmPmCol(preset.columns_config.am_pm_col !== undefined && preset.columns_config.am_pm_col !== null ? String(preset.columns_config.am_pm_col) : 'none');
        } else {
            setDatetimeCol(preset.columns_config.datetime_col ?? 1);
            setAmPmCol('none');
        }
        setPunchTypeCol(preset.columns_config.punch_type_col !== null ? String(preset.columns_config.punch_type_col) : 'none');
        setDeviceIdCol(preset.columns_config.device_id_col !== null ? String(preset.columns_config.device_id_col) : 'none');

        const mapArr = Object.entries(preset.status_code_mapping).map(([k, v]) => ({ key: k, val: v }));
        setStatusMappings(mapArr);
        setTestResult(null);
        setTestError(null);
    };

    const handleRunTest = async () => {
        setIsTesting(true);
        setTestError(null);
        setTestResult(null);

        const statusMapObj: Record<string, string> = {};
        statusMappings.forEach((m) => {
            if (m.key.trim()) {
                statusMapObj[m.key.trim()] = m.val;
            }
        });

        const columnsConfig: any = {
            biometric_id_col: bioIdCol,
        };

        if (dateMode === 'separate') {
            columnsConfig.date_col = dateCol;
            columnsConfig.time_col = timeCol;
            if (amPmCol !== 'none') {
                columnsConfig.am_pm_col = parseInt(amPmCol, 10);
            }
        } else {
            columnsConfig.datetime_col = datetimeCol;
        }

        if (punchTypeCol !== 'none') {
            columnsConfig.punch_type_col = parseInt(punchTypeCol, 10);
        }
        if (deviceIdCol !== 'none') {
            columnsConfig.device_id_col = parseInt(deviceIdCol, 10);
        }

        const payload = {
            raw_content: sampleText,
            delimiter_type: delimiterType,
            custom_delimiter: customDelimiter,
            skip_header_lines: skipHeaderLines,
            date_mode: dateMode,
            date_format: dateFormat,
            columns_config: columnsConfig,
            status_code_mapping: statusMapObj,
            default_device_id: defaultDeviceId,
        };

        try {
            const csrfToken = getCsrfToken();
            const res = await fetch('/biometric-devices/test-parse', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': csrfToken,
                    'X-XSRF-TOKEN': csrfToken,
                    'Accept': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            const json = await res.json();
            if (res.ok && json.success) {
                setTestResult(json.data);
            } else {
                setTestError(json.message || 'Parser test failed. Check delimiter or column mapping.');
            }
        } catch (e: any) {
            setTestError(e.message || 'Network error while testing configuration.');
        } finally {
            setIsTesting(false);
        }
    };

    const handleSaveProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) {
            setSaveError('Please enter a descriptive device profile name.');
            return;
        }

        setIsSaving(true);
        setSaveError(null);

        const statusMapObj: Record<string, string> = {};
        statusMappings.forEach((m) => {
            if (m.key.trim()) {
                statusMapObj[m.key.trim()] = m.val;
            }
        });

        const columnsConfig: any = {
            biometric_id_col: bioIdCol,
        };

        if (dateMode === 'separate') {
            columnsConfig.date_col = dateCol;
            columnsConfig.time_col = timeCol;
            if (amPmCol !== 'none') {
                columnsConfig.am_pm_col = parseInt(amPmCol, 10);
            }
        } else {
            columnsConfig.datetime_col = datetimeCol;
        }

        if (punchTypeCol !== 'none') {
            columnsConfig.punch_type_col = parseInt(punchTypeCol, 10);
        }
        if (deviceIdCol !== 'none') {
            columnsConfig.device_id_col = parseInt(deviceIdCol, 10);
        }

        const payload = {
            name: name.trim(),
            device_brand: deviceBrand,
            model_name: modelName.trim() || null,
            file_extension: fileExtension,
            delimiter_type: delimiterType,
            custom_delimiter: customDelimiter || null,
            skip_header_lines: skipHeaderLines,
            date_mode: dateMode,
            date_format: dateFormat,
            columns_config: columnsConfig,
            status_code_mapping: statusMapObj,
            default_device_id: defaultDeviceId.trim() || null,
            is_active: true,
        };

        const csrfToken = getCsrfToken();
        const url = editingProfile ? `/biometric-devices/${editingProfile.id}` : '/biometric-devices';
        const method = editingProfile ? 'PUT' : 'POST';

        try {
            const res = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': csrfToken,
                    'X-XSRF-TOKEN': csrfToken,
                    'Accept': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            const json = await res.json();
            if (res.ok && json.success) {
                onSaved(json.data);
                onClose();
            } else {
                setSaveError(json.message || 'Failed to save biometric profile.');
            }
        } catch (e: any) {
            setSaveError(e.message || 'Error occurred while saving profile.');
        } finally {
            setIsSaving(false);
        }
    };

    const addStatusRow = () => {
        setStatusMappings([...statusMappings, { key: '', val: 'in' }]);
    };

    const removeStatusRow = (idx: number) => {
        setStatusMappings(statusMappings.filter((_, i) => i !== idx));
    };

    const columnOptions = Array.from({ length: Math.max(maxTokens, 6) }, (_, i) => ({
        index: i,
        label: `Column ${i}`,
    }));

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6 bg-slate-950/75 backdrop-blur-sm animate-fade-in overflow-y-auto">
            <div className="relative w-full max-w-5xl my-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
                {/* Header */}
                <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/90 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-500/20 dark:border-blue-500/30">
                            <Cpu className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                {editingProfile ? 'Edit Biometric Device Profile' : 'Configure Biometric Device Profile'}
                                <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-medium border border-blue-200/60 dark:border-blue-700/40">
                                    Universal Parser
                                </span>
                            </h2>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                Configure, inspect, and test raw terminal punch logs (.txt, .dat) for Hikvision, ZKTeco, Realand, Anviz, etc.
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl hover:bg-slate-200/60 dark:hover:bg-slate-800 transition"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body - Scrollable */}
                <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
                    {/* Sri Lankan 1-Click Presets */}
                    <div>
                        <div className="flex items-center justify-between mb-2.5">
                            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                                1-Click Sri Lankan Hardware Presets
                            </label>
                            <span className="text-[11px] text-slate-500 dark:text-slate-400">Loads standard layout instantly</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                            {PRESETS.map((p) => (
                                <button
                                    key={p.key}
                                    type="button"
                                    onClick={() => handleApplyPreset(p)}
                                    className="p-3 text-left rounded-xl border transition group cursor-pointer bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/80 hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-slate-800 shadow-sm"
                                >
                                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 line-clamp-1">
                                        {p.label}
                                    </span>
                                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-1">
                                        .{p.file_extension} &bull; {p.delimiter_type.toUpperCase()}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Step 1: Device Brand & Name */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                        <div>
                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                                Profile Name *
                            </label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="e.g. Colombo HQ - Hikvision MinMoe"
                                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 outline-none transition placeholder:text-slate-400 dark:placeholder:text-slate-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                                Device Brand
                            </label>
                            <select
                                value={deviceBrand}
                                onChange={(e) => setDeviceBrand(e.target.value)}
                                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 outline-none transition"
                            >
                                <option value="hikvision">Hikvision (MinMoe / Turnstile)</option>
                                <option value="zkteco">ZKTeco (K40, IN01, uFace, MB20)</option>
                                <option value="realand">Realand (A-C071, ZD2F20, Bio-Office)</option>
                                <option value="anviz">Anviz</option>
                                <option value="fingertec">FingerTec</option>
                                <option value="other">Generic / Other Terminal</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                                Model / Note (Optional)
                            </label>
                            <input
                                type="text"
                                value={modelName}
                                onChange={(e) => setModelName(e.target.value)}
                                placeholder="e.g. DS-K1T341AMF, Main Gate"
                                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 outline-none transition placeholder:text-slate-400 dark:placeholder:text-slate-500"
                            />
                        </div>
                    </div>

                    {/* Step 2: Delimiter & Raw Sample */}
                    <div className="space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                                <Layers className="w-3.5 h-3.5 text-blue-500" />
                                File Delimiter & Sample Preview
                            </label>
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-slate-600 dark:text-slate-400">Skip Header Rows:</span>
                                <input
                                    type="number"
                                    min={0}
                                    max={20}
                                    value={skipHeaderLines}
                                    onChange={(e) => setSkipHeaderLines(Math.max(0, parseInt(e.target.value, 10) || 0))}
                                    className="w-16 px-2 py-1 text-xs text-center rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-semibold"
                                />
                            </div>
                        </div>

                        {/* Delimiter Buttons */}
                        <div className="flex flex-wrap items-center gap-2">
                            {[
                                { key: 'tab', label: 'Tab (\\t)' },
                                { key: 'space', label: 'Space / Whitespace (\\s+)' },
                                { key: 'comma', label: 'Comma (,)' },
                                { key: 'semicolon', label: 'Semicolon (;)' },
                                { key: 'pipe', label: 'Pipe (|)' },
                                { key: 'custom', label: 'Custom' },
                            ].map((d) => (
                                <button
                                    key={d.key}
                                    type="button"
                                    onClick={() => setDelimiterType(d.key)}
                                    className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition ${
                                        delimiterType === d.key
                                            ? 'bg-blue-600 text-white border-blue-600 shadow-sm font-semibold'
                                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-blue-400 dark:hover:border-slate-600'
                                    }`}
                                >
                                    {d.label}
                                </button>
                            ))}
                            {delimiterType === 'custom' && (
                                <input
                                    type="text"
                                    maxLength={5}
                                    value={customDelimiter}
                                    onChange={(e) => setCustomDelimiter(e.target.value)}
                                    placeholder="char"
                                    className="w-16 px-2 py-1 text-xs text-center rounded-lg border border-blue-400 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-mono"
                                />
                            )}
                        </div>

                        {/* Raw sample textarea */}
                        <div>
                            <textarea
                                rows={3}
                                value={sampleText}
                                onChange={(e) => setSampleText(e.target.value)}
                                placeholder="Paste 3 to 5 lines of raw punch log file here..."
                                className="w-full px-3 py-2.5 text-xs font-mono rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-900 text-emerald-400 dark:bg-slate-950 focus:ring-2 focus:ring-blue-500 outline-none resize-y shadow-inner"
                            />
                        </div>

                        {/* Visual Token Table */}
                        {tokenizedRows.length > 0 && (
                            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 max-h-48 overflow-y-auto bg-white dark:bg-slate-900">
                                <table className="w-full text-left text-xs font-mono">
                                    <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 sticky top-0 border-b border-slate-200 dark:border-slate-700">
                                        <tr>
                                            <th className="px-3 py-2 w-16 text-center text-slate-500 dark:text-slate-400">Row</th>
                                            {Array.from({ length: maxTokens }, (_, i) => (
                                                <th key={i} className="px-3 py-2 font-semibold">
                                                    <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300 text-[11px]">
                                                        Col {i}
                                                    </span>
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                                        {tokenizedRows.map((r) => (
                                            <tr
                                                key={r.line}
                                                className={
                                                    r.is_header
                                                        ? 'bg-amber-500/10 text-amber-900 dark:text-amber-300 font-medium'
                                                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-800 dark:text-slate-200'
                                                }
                                            >
                                                <td className="px-3 py-1.5 text-center text-[11px] text-slate-400">
                                                    {r.is_header ? (
                                                        <span className="text-[10px] text-amber-700 dark:text-amber-400 font-sans font-semibold">
                                                            Hdr #{r.line}
                                                        </span>
                                                    ) : (
                                                        `#${r.line}`
                                                    )}
                                                </td>
                                                {Array.from({ length: maxTokens }, (_, i) => (
                                                    <td key={i} className="px-3 py-1.5 whitespace-nowrap">
                                                        {r.tokens[i] !== undefined ? (
                                                            <span className="font-semibold text-slate-900 dark:text-slate-100">
                                                                {r.tokens[i]}
                                                            </span>
                                                        ) : (
                                                            <span className="text-slate-400 dark:text-slate-600 text-[10px]">
                                                                -
                                                            </span>
                                                        )}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* Step 3: Column Mapping & Datetime Format */}
                    <div className="p-4 md:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                            <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                                Column Mapping & Datetime Interpretation
                            </h3>
                            <span className="text-[11px] text-slate-500 dark:text-slate-400">
                                Unmapped columns (e.g. Col 6, 8) are ignored automatically
                            </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                            {/* Biometric ID */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                                    Biometric / Employee ID *
                                </label>
                                <select
                                    value={bioIdCol}
                                    onChange={(e) => setBioIdCol(parseInt(e.target.value, 10))}
                                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                                >
                                    {columnOptions.map((opt) => (
                                        <option key={opt.index} value={opt.index}>
                                            {opt.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Date Mode */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                                    Date & Time Layout
                                </label>
                                <select
                                    value={dateMode}
                                    onChange={(e) => setDateMode(e.target.value as any)}
                                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 outline-none"
                                >
                                    <option value="combined">Combined in 1 Column</option>
                                    <option value="separate">Separate Date & Time Columns</option>
                                </select>
                            </div>

                            {/* Date Format */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                                    Date Format
                                </label>
                                <select
                                    value={dateFormat}
                                    onChange={(e) => setDateFormat(e.target.value)}
                                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                                >
                                    <option value="auto">Auto-detect (Recommended)</option>
                                    <option value="d/m/Y g:i A">DD/MM/YYYY hh:mm AM/PM (12-Hour SL)</option>
                                    <option value="d/m/Y H:i:s">DD/MM/YYYY HH:mm:ss (24-Hour SL/UK)</option>
                                    <option value="Y-m-d H:i:s">YYYY-MM-DD HH:mm:ss (24-Hour)</option>
                                    <option value="d-m-Y H:i:s">DD-MM-YYYY HH:mm:ss (24-Hour)</option>
                                    <option value="m/d/Y H:i:s">MM/DD/YYYY HH:mm:ss (US)</option>
                                </select>
                            </div>
                        </div>

                        {/* Date & Time Column pickers */}
                        {dateMode === 'combined' ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 pt-1">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                                        Date & Time Column *
                                    </label>
                                    <select
                                        value={datetimeCol}
                                        onChange={(e) => setDatetimeCol(parseInt(e.target.value, 10))}
                                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                                    >
                                        {columnOptions.map((opt) => (
                                            <option key={opt.index} value={opt.index}>
                                                {opt.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 pt-1">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                                        Date Column *
                                    </label>
                                    <select
                                        value={dateCol}
                                        onChange={(e) => setDateCol(parseInt(e.target.value, 10))}
                                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                                    >
                                        {columnOptions.map((opt) => (
                                            <option key={opt.index} value={opt.index}>
                                                {opt.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                                        Time Column *
                                    </label>
                                    <select
                                        value={timeCol}
                                        onChange={(e) => setTimeCol(parseInt(e.target.value, 10))}
                                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                                    >
                                        {columnOptions.map((opt) => (
                                            <option key={opt.index} value={opt.index}>
                                                {opt.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                                        AM / PM Column (Optional)
                                    </label>
                                    <select
                                        value={amPmCol}
                                        onChange={(e) => setAmPmCol(e.target.value)}
                                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                                    >
                                        <option value="none">None / 24-Hour Time</option>
                                        {columnOptions.map((opt) => (
                                            <option key={opt.index} value={String(opt.index)}>
                                                {opt.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-2">
                            {/* Punch Direction Column */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                                    Punch Direction / Status Col
                                </label>
                                <select
                                    value={punchTypeCol}
                                    onChange={(e) => setPunchTypeCol(e.target.value)}
                                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                                >
                                    <option value="none">None (Auto First-in / Last-out)</option>
                                    {columnOptions.map((opt) => (
                                        <option key={opt.index} value={String(opt.index)}>
                                            {opt.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Device ID Column */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                                    Device ID Column (Optional)
                                </label>
                                <select
                                    value={deviceIdCol}
                                    onChange={(e) => setDeviceIdCol(e.target.value)}
                                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                                >
                                    <option value="none">None</option>
                                    {columnOptions.map((opt) => (
                                        <option key={opt.index} value={String(opt.index)}>
                                            {opt.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Default Device ID */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                                    Default Device / Terminal Name
                                </label>
                                <input
                                    type="text"
                                    value={defaultDeviceId}
                                    onChange={(e) => setDefaultDeviceId(e.target.value)}
                                    placeholder="e.g. MAIN-GATE-01"
                                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 outline-none transition placeholder:text-slate-400 dark:placeholder:text-slate-500"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Step 4: Status Code Mapping */}
                    {punchTypeCol !== 'none' && (
                        <div className="p-4 md:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 space-y-3">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                                    Status Code &rarr; Direction Translation
                                </label>
                                <button
                                    type="button"
                                    onClick={addStatusRow}
                                    className="text-xs text-blue-600 dark:text-blue-400 font-semibold hover:underline flex items-center gap-1"
                                >
                                    <Plus className="w-3.5 h-3.5" /> Add Rule
                                </button>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                                {statusMappings.map((item, idx) => (
                                    <div
                                        key={idx}
                                        className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                                    >
                                        <input
                                            type="text"
                                            value={item.key}
                                            onChange={(e) => {
                                                const updated = [...statusMappings];
                                                updated[idx].key = e.target.value;
                                                setStatusMappings(updated);
                                            }}
                                            placeholder="File value (e.g. 0)"
                                            className="w-24 px-2 py-1 text-xs font-mono rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100"
                                        />
                                        <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                                        <select
                                            value={item.val}
                                            onChange={(e) => {
                                                const updated = [...statusMappings];
                                                updated[idx].val = e.target.value;
                                                setStatusMappings(updated);
                                            }}
                                            className="flex-1 px-2 py-1 text-xs rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-semibold"
                                        >
                                            <option value="in">Check-In</option>
                                            <option value="out">Check-Out</option>
                                            <option value="auto">Auto</option>
                                        </select>
                                        <button
                                            type="button"
                                            onClick={() => removeStatusRow(idx)}
                                            className="text-slate-400 hover:text-red-500 p-1 rounded-lg transition"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Step 5: Live Test Result Display */}
                    {testResult && (
                        <div className="p-4 rounded-2xl border border-emerald-300 dark:border-emerald-800/80 bg-emerald-50 dark:bg-emerald-950/30 space-y-2.5">
                            <div className="flex items-center justify-between text-xs font-bold text-emerald-800 dark:text-emerald-300">
                                <span className="flex items-center gap-1.5">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                    Test Parse Succeeded: {testResult.valid_count} valid records parsed!
                                </span>
                                <span className="text-[11px] font-normal text-emerald-700 dark:text-emerald-400">
                                    {testResult.total_parsed} total rows evaluated
                                </span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mt-2">
                                {testResult.valid_samples.slice(0, 6).map((rec: any, idx: number) => (
                                    <div
                                        key={idx}
                                        className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800/60 text-xs font-mono space-y-0.5 shadow-sm"
                                    >
                                        <div className="flex items-center justify-between text-slate-800 dark:text-slate-200 font-bold">
                                            <span>ID: {rec.biometric_id}</span>
                                            <span
                                                className={`text-[10px] px-1.5 py-0.5 rounded font-sans uppercase font-bold ${
                                                    rec.punch_type === 'in'
                                                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300'
                                                        : rec.punch_type === 'out'
                                                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300'
                                                        : 'bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300'
                                                }`}
                                            >
                                                {rec.punch_type}
                                            </span>
                                        </div>
                                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                            {rec.punch_datetime}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {testError && (
                        <div className="p-3.5 rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                            <span>{testError}</span>
                        </div>
                    )}

                    {saveError && (
                        <div className="p-3.5 rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                            <span>{saveError}</span>
                        </div>
                    )}
                </div>

                {/* Footer Controls */}
                <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90 flex items-center justify-between">
                    <button
                        type="button"
                        onClick={handleRunTest}
                        disabled={isTesting}
                        className="px-4 py-2 text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 border border-blue-200 dark:border-blue-800 rounded-xl transition flex items-center gap-2"
                    >
                        {isTesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                        Test Configuration
                    </button>

                    <div className="flex items-center gap-2.5">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 rounded-xl hover:bg-slate-200/60 dark:hover:bg-slate-800 transition"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleSaveProfile}
                            disabled={isSaving}
                            className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-lg shadow-blue-500/25 transition flex items-center gap-2"
                        >
                            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                            {editingProfile ? 'Update Device Profile' : 'Save Device Profile'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
