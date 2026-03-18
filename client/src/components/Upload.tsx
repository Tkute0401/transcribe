'use client';

import { useState, useRef, useCallback } from 'react';
import axios from 'axios';
import { UploadCloud, FileVideo, X, ChevronDown, Loader2, LayoutDashboard } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/Toast';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const MODEL_ETA_FACTOR: Record<string, number> = {
    tiny: 0.1, base: 0.15, small: 0.3, medium: 0.6, 'large-v3': 1.2,
};

const QUICK_PRESETS = [
    { label: '⚡ Fast', model: 'tiny', lang: 'auto', desc: 'Tiny model, ~10% of duration' },
    { label: '⚖ Balanced', model: 'base', lang: 'auto', desc: 'Base model, ~15% of duration' },
    { label: '🎯 Accurate', model: 'small', lang: 'auto', desc: 'Small model, ~30% of duration' },
];

async function generateVideoThumbnail(file: File): Promise<string | null> {
    if (!file.type.startsWith('video/')) return null;
    return new Promise((resolve) => {
        const url = URL.createObjectURL(file);
        const video = document.createElement('video');
        video.src = url;
        video.currentTime = 0.5;
        const onSeeked = () => {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = 80;
                canvas.height = 45;
                canvas.getContext('2d')?.drawImage(video, 0, 0, 80, 45);
                resolve(canvas.toDataURL('image/jpeg', 0.7));
            } catch {
                resolve(null);
            } finally {
                URL.revokeObjectURL(url);
            }
        };
        video.addEventListener('seeked', onSeeked, { once: true });
        video.addEventListener('error', () => { URL.revokeObjectURL(url); resolve(null); }, { once: true });
        video.load();
    });
}

export default function Upload() {
    const [files, setFiles] = useState<File[]>([]);
    const [dragging, setDragging] = useState(false);
    const [dragCounter, setDragCounter] = useState(0);
    const [uploading, setUploading] = useState(false);
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [language, setLanguage] = useState('auto');
    const [prompt, setPrompt] = useState('');
    const [shouldTranslate, setShouldTranslate] = useState(false);
    const [model, setModel] = useState('base');
    const [shouldTransliterate, setShouldTransliterate] = useState(false);
    const [progresses, setProgresses] = useState<Record<string, number>>({});
    const [statuses, setStatuses] = useState<Record<string, string>>({});
    const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
    const [durations, setDurations] = useState<Record<string, number>>({});
    const [transcriptionComplete, setTranscriptionComplete] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const router = useRouter();
    const { addToast } = useToast();

    const addFiles = useCallback(async (newFiles: File[]) => {
        const audioVideo = newFiles.filter(
            (f) => f.type.startsWith('audio/') || f.type.startsWith('video/')
        );
        setFiles((prev) => {
            const existing = new Set(prev.map((f) => f.name));
            return [...prev, ...audioVideo.filter((f) => !existing.has(f.name))];
        });

        // Generate thumbnails for video files
        for (const f of audioVideo) {
            if (f.type.startsWith('video/')) {
                const thumb = await generateVideoThumbnail(f);
                if (thumb) setThumbnails((prev) => ({ ...prev, [f.name]: thumb }));
            }
        }
    }, []);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) addFiles(Array.from(e.target.files));
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragging(false);
        setDragCounter(0);
        addFiles(Array.from(e.dataTransfer.files));
    };

    const handleDragEnter = (e: React.DragEvent) => {
        e.preventDefault();
        setDragCounter((c) => c + 1);
        setDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setDragCounter((c) => {
            const next = c - 1;
            if (next <= 0) setDragging(false);
            return Math.max(0, next);
        });
    };

    const handleLanguageChange = (value: string) => {
        setLanguage(value);
        if (value === 'hinglish') setPrompt('This is a conversation mixing English and Hindi words.');
        else if (value === 'mr-en') setPrompt('This is a conversation mixing English and Marathi words.');
    };

    const applyQuickPreset = (preset: typeof QUICK_PRESETS[0]) => {
        setModel(preset.model);
        setLanguage(preset.lang);
    };

    const removeFile = (idx: number) => setFiles(files.filter((_, i) => i !== idx));

    const formatSize = (bytes: number) => {
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
        return (bytes / 1024 / 1024).toFixed(1) + ' MB';
    };

    const formatEta = (fileId: string, dur: number | undefined) => {
        if (!dur) return null;
        const factor = MODEL_ETA_FACTOR[model] || 0.15;
        const secs = Math.round(dur * factor);
        if (secs < 60) return `~${secs}s remaining`;
        return `~${Math.ceil(secs / 60)}m remaining`;
    };

    const handleUpload = async () => {
        if (files.length === 0) return;
        setUploading(true);
        setTranscriptionComplete(false);

        let actualLanguage = language;
        if (language === 'hinglish' || language === 'mr-en') actualLanguage = 'en';

        const completedTranscriptions: any[] = [];
        const existingData = localStorage.getItem('transcription_bulk');
        if (existingData) {
            try { completedTranscriptions.push(...JSON.parse(existingData)); } catch (_) {}
        }

        for (let i = 0; i < files.length; i++) {
            const currentFile = files[i];
            const fileId = currentFile.name;
            try {
                setStatuses((prev) => ({ ...prev, [fileId]: 'uploading' }));

                const formData = new FormData();
                formData.append('file', currentFile);

                const response = await axios.post(`${API_URL}/api/upload`, formData, {
                    onUploadProgress: (progressEvent) => {
                        if (progressEvent.total) {
                            const pct = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                            setProgresses((prev) => ({ ...prev, [fileId]: pct }));
                            if (pct >= 100) setStatuses((prev) => ({ ...prev, [fileId]: 'compressing' }));
                        }
                    },
                });

                setStatuses((prev) => ({ ...prev, [fileId]: 'transcribing' }));
                const transcribeResponse = await axios.post(`${API_URL}/api/transcribe`, {
                    filename: response.data.filename,
                    language: actualLanguage,
                    model,
                    prompt,
                    task: shouldTranslate ? 'translate' : 'transcribe',
                    transliterate: shouldTransliterate,
                });

                // Store duration for ETA display
                if (transcribeResponse.data.duration) {
                    setDurations((prev) => ({ ...prev, [fileId]: transcribeResponse.data.duration }));
                }

                setStatuses((prev) => ({ ...prev, [fileId]: 'done' }));
                completedTranscriptions.push({
                    ...transcribeResponse.data,
                    originalFilename: currentFile.name,
                    serverFilename: response.data.filename,
                    createdAt: new Date().toISOString(),
                });
            } catch (err) {
                console.error(`Error processing ${currentFile.name}:`, err);
                setStatuses((prev) => ({ ...prev, [fileId]: 'error' }));
                addToast(`Failed to process ${currentFile.name}`, 'error');
            }
        }

        localStorage.setItem('transcription_bulk', JSON.stringify(completedTranscriptions));
        setUploading(false);
        setTranscriptionComplete(true);
        addToast(`${files.length} file${files.length > 1 ? 's' : ''} transcribed successfully!`, 'success');
    };

    const getStatusLabel = (s: string) => {
        if (s === 'uploading')    return 'Uploading…';
        if (s === 'compressing')  return 'Compressing…';
        if (s === 'transcribing') return 'Transcribing…';
        if (s === 'done')         return 'Done';
        if (s === 'error')        return 'Failed';
        return 'Pending';
    };

    const getStatusColor = (s: string) => {
        if (s === 'done')   return '#34d399';
        if (s === 'error')  return '#f87171';
        if (s === 'compressing') return '#fb923c';
        if (s === 'uploading' || s === 'transcribing') return '#a78bfa';
        return 'var(--text-muted)';
    };

    return (
        <div className="glass p-6 space-y-5">
            {/* Drop Zone */}
            <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className="relative flex flex-col items-center justify-center gap-3 py-12 rounded-2xl cursor-pointer transition-all duration-300"
                style={{
                    border: `2px dashed ${dragging ? 'var(--accent)' : 'var(--border)'}`,
                    background: dragging ? 'rgba(124,58,237,0.08)' : 'rgba(255,255,255,0.02)',
                    boxShadow: dragging ? '0 0 40px rgba(124,58,237,0.15)' : 'none',
                }}
            >
                {/* Drag overlay */}
                {dragging && (
                    <div className="absolute inset-0 flex items-center justify-center rounded-2xl z-10"
                        style={{ background: 'rgba(124,58,237,0.18)', backdropFilter: 'blur(4px)' }}>
                        <span className="text-xl font-bold" style={{ color: 'var(--accent-light)' }}>
                            Drop files here
                        </span>
                    </div>
                )}
                <div className="p-4 rounded-full" style={{ background: 'rgba(124,58,237,0.15)' }}>
                    <UploadCloud size={28} style={{ color: 'var(--accent-light)' }} />
                </div>
                <div className="text-center">
                    <p className="font-semibold text-sm" style={{ color: 'var(--text)' }}>
                        Drop files here or <span style={{ color: 'var(--accent-light)' }}>browse</span>
                    </p>
                    <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Audio & video files · bulk upload</p>
                </div>
                <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange}
                    accept="audio/*,video/*" multiple />
            </div>

            {/* File List */}
            {files.length > 0 && (
                <div className="space-y-2">
                    {files.map((f, idx) => {
                        const s = statuses[f.name] || '';
                        const pct = progresses[f.name] || 0;
                        const thumb = thumbnails[f.name];
                        const dur = durations[f.name];

                        return (
                            <div key={idx} className="relative overflow-hidden rounded-xl px-4 py-3 flex items-center gap-3"
                                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)' }}>
                                {/* Progress fill */}
                                {s === 'uploading' && (
                                    <div className="absolute inset-0 transition-all duration-300"
                                        style={{ width: `${pct}%`, background: 'rgba(124,58,237,0.12)', borderRadius: 'inherit' }} />
                                )}
                                {s === 'transcribing' && (
                                    <div className="absolute inset-0" style={{ background: 'rgba(124,58,237,0.08)', borderRadius: 'inherit' }}>
                                        <div className="absolute inset-0 overflow-hidden rounded-xl">
                                            <div style={{ position: 'absolute', top: 0, bottom: 0, width: '40%', background: 'linear-gradient(90deg, transparent, rgba(124,58,237,0.18), transparent)', animation: 'shimmer 1.5s infinite' }} />
                                        </div>
                                    </div>
                                )}

                                {/* Thumbnail or icon */}
                                {thumb ? (
                                    <img src={thumb} alt="" className="rounded flex-shrink-0" style={{ width: 40, height: 23, objectFit: 'cover', position: 'relative' }} />
                                ) : (
                                    <FileVideo size={18} style={{ color: 'var(--text-muted)', flexShrink: 0, position: 'relative' }} />
                                )}

                                <div className="flex-1 min-w-0 relative">
                                    <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{f.name}</p>
                                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                        {formatSize(f.size)}
                                        {s === 'transcribing' && dur && (
                                            <span className="ml-2" style={{ color: '#a78bfa' }}>{formatEta(f.name, dur)}</span>
                                        )}
                                    </p>
                                </div>

                                <div className="relative flex items-center gap-2 flex-shrink-0">
                                    {s && (
                                        <span className="text-xs font-semibold" style={{ color: getStatusColor(s) }}>
                                            {(s === 'uploading' || s === 'compressing' || s === 'transcribing') && (
                                                <Loader2 size={12} className="inline mr-1 animate-spin" />
                                            )}
                                            {getStatusLabel(s)}
                                        </span>
                                    )}
                                    {!uploading && (
                                        <button onClick={() => removeFile(idx)} className="p-1 rounded-lg hover:bg-red-500/20 transition-colors">
                                            <X size={14} style={{ color: 'var(--text-muted)' }} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Quick presets */}
            <div className="flex gap-2">
                {QUICK_PRESETS.map((preset) => (
                    <button
                        key={preset.model}
                        onClick={() => applyQuickPreset(preset)}
                        className="flex-1 text-xs py-2 px-3 rounded-xl transition-all"
                        style={{
                            background: model === preset.model ? 'rgba(124,58,237,0.2)' : 'rgba(255,255,255,0.04)',
                            border: `1px solid ${model === preset.model ? 'rgba(124,58,237,0.5)' : 'var(--border)'}`,
                            color: model === preset.model ? 'var(--accent-light)' : 'var(--text-muted)',
                        }}
                        title={preset.desc}
                    >
                        {preset.label}
                    </button>
                ))}
            </div>

            {/* Advanced Settings */}
            <button
                onClick={() => setShowAdvanced((v) => !v)}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-colors"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
            >
                <span>Advanced Settings</span>
                <ChevronDown size={16} style={{ transform: showAdvanced ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
            </button>

            {showAdvanced && (
                <div className="space-y-4 animate-fade-up">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Language</label>
                            <select value={language} onChange={(e) => handleLanguageChange(e.target.value)} className="input-base">
                                <option value="auto">Auto Detect</option>
                                <option value="en">English</option>
                                <option value="hinglish">🔥 Hinglish</option>
                                <option value="mr-en">🔥 Marathi + English</option>
                                <option disabled>──────────</option>
                                <option value="hi">Hindi</option>
                                <option value="mr">Marathi</option>
                                <option value="es">Spanish</option>
                                <option value="fr">French</option>
                                <option value="de">German</option>
                                <option value="ja">Japanese</option>
                                <option value="zh">Chinese</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Model Size</label>
                            <select value={model} onChange={(e) => setModel(e.target.value)} className="input-base">
                                <option value="tiny">Tiny — Fastest</option>
                                <option value="base">Base — Balanced</option>
                                <option value="small">Small — Better</option>
                                <option value="medium">Medium — Accurate</option>
                                <option value="large-v3">Large — Best</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Context Hint (Optional)</label>
                        <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)}
                            placeholder="e.g. 'A podcast about technology mixing English and Hindi'"
                            className="input-base resize-none h-20" />
                    </div>

                    <label className="flex items-center gap-3 cursor-pointer">
                        <div onClick={() => setShouldTranslate((v) => !v)}
                            className="relative w-10 h-5 rounded-full transition-colors flex-shrink-0"
                            style={{ background: shouldTranslate ? 'var(--accent)' : 'rgba(255,255,255,0.1)', cursor: 'pointer' }}>
                            <div className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform shadow"
                                style={{ transform: shouldTranslate ? 'translateX(1.25rem)' : 'translateX(2px)' }} />
                        </div>
                        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Translate everything to English</span>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer">
                        <div onClick={() => setShouldTransliterate((v) => !v)}
                            className="relative w-10 h-5 rounded-full transition-colors flex-shrink-0"
                            style={{ background: shouldTransliterate ? 'var(--accent)' : 'rgba(255,255,255,0.1)', cursor: 'pointer' }}>
                            <div className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform shadow"
                                style={{ transform: shouldTransliterate ? 'translateX(1.25rem)' : 'translateX(2px)' }} />
                        </div>
                        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Output in Latin script (e.g. Hinglish)</span>
                    </label>
                </div>
            )}

            {/* Actions */}
            {transcriptionComplete ? (
                <div className="space-y-3 animate-fade-up">
                    <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm"
                        style={{ background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.3)', color: '#6ee7b7' }}>
                        ✓ All files transcribed successfully!
                    </div>
                    <div className="flex gap-3">
                        <Link href="/dashboard" className="btn-primary flex-1 flex items-center justify-center gap-2">
                            <LayoutDashboard size={16} /> View on Dashboard
                        </Link>
                        <button onClick={() => { setFiles([]); setStatuses({}); setProgresses({}); setThumbnails({}); setTranscriptionComplete(false); }}
                            className="btn-ghost flex-1">
                            Upload More
                        </button>
                    </div>
                </div>
            ) : (
                <button onClick={handleUpload} disabled={files.length === 0 || uploading}
                    className="btn-primary w-full" style={{ padding: '0.875rem' }}>
                    {uploading ? (
                        <><Loader2 size={18} className="animate-spin" /> Processing {files.length} file{files.length > 1 ? 's' : ''}…</>
                    ) : (
                        <><UploadCloud size={18} /> Start Transcription{files.length > 1 ? ` (${files.length} files)` : ''}</>
                    )}
                </button>
            )}
        </div>
    );
}
