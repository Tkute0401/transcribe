'use client';

import Link from 'next/link';
import { FileText, ArrowRight, Play, Plus, Trash2, Clock, Type, Search, Grid3X3, List, FileDown, BarChart2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { chunkTranscript, buildSrt, downloadFile } from '@/lib/transcript';

type SortOrder = 'newest' | 'oldest' | 'alpha' | 'duration';
type ViewMode = 'grid' | 'list';

function CheckIcon() {
    return (
        <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" style={{ color: 'white' }}>
            <polyline points="20 6 9 17 4 12" />
        </svg>
    );
}

function timeAgo(iso: string): string {
    if (!iso) return '';
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
}

function formatDuration(seconds: number): string {
    if (!seconds) return '—';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatTotalDuration(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
}

function wordCount(t: any): number {
    return t.words?.length || t.text?.split(' ').length || 0;
}

function SkeletonCard() {
    return (
        <div className="glass p-5 space-y-4">
            <div className="flex items-start justify-between">
                <div className="skeleton-pulse w-10 h-10 rounded-xl" />
                <div className="skeleton-pulse w-16 h-6 rounded-full" />
            </div>
            <div className="space-y-2">
                <div className="skeleton-pulse h-4 w-3/4 rounded" />
                <div className="skeleton-pulse h-3 w-1/2 rounded" />
            </div>
            <div className="skeleton-pulse h-10 rounded-lg" />
        </div>
    );
}

export default function Dashboard() {
    const [transcriptions, setTranscriptions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortOrder, setSortOrder] = useState<SortOrder>('newest');
    const [viewMode, setViewMode] = useState<ViewMode>('grid');
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

    useEffect(() => {
        const t = setTimeout(() => {
            const data = localStorage.getItem('transcription_bulk');
            if (data) { try { setTranscriptions(JSON.parse(data)); } catch (_) {} }
            setLoading(false);
        }, 60);
        return () => clearTimeout(t);
    }, []);

    const clearAll = () => {
        if (!confirm('Clear all transcriptions? This cannot be undone.')) return;
        localStorage.removeItem('transcription_bulk');
        setTranscriptions([]);
        setSelectedIds(new Set());
    };

    const deleteSelected = () => {
        const remaining = transcriptions.filter((_, i) => !selectedIds.has(i));
        localStorage.setItem('transcription_bulk', JSON.stringify(remaining));
        setTranscriptions(remaining);
        setSelectedIds(new Set());
    };

    const deleteOne = (idx: number) => {
        const remaining = transcriptions.filter((_, i) => i !== idx);
        localStorage.setItem('transcription_bulk', JSON.stringify(remaining));
        setTranscriptions(remaining);
        setSelectedIds((prev) => { const n = new Set(prev); n.delete(idx); return n; });
    };

    const toggleSelect = (idx: number) => {
        setSelectedIds((prev) => {
            const n = new Set(prev);
            n.has(idx) ? n.delete(idx) : n.add(idx);
            return n;
        });
    };

    const quickExportSrt = (t: any, name: string) => {
        const chunks = chunkTranscript(t.words || []);
        downloadFile(buildSrt(chunks), `${name.replace(/\.[^/.]+$/, '')}.srt`, 'text/plain');
    };

    const totalWords = transcriptions.reduce((s, t) => s + wordCount(t), 0);
    const totalDuration = transcriptions.reduce((s, t) => s + (t.duration || 0), 0);
    const anySelected = selectedIds.size > 0;

    const filtered = useMemo(() => {
        let list = transcriptions.map((t, i) => ({ ...t, _idx: i }));
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            list = list.filter((t) => (t.originalFilename || '').toLowerCase().includes(q));
        }
        switch (sortOrder) {
            case 'newest':   list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()); break;
            case 'oldest':   list.sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()); break;
            case 'alpha':    list.sort((a, b) => (a.originalFilename || '').localeCompare(b.originalFilename || '')); break;
            case 'duration': list.sort((a, b) => (b.duration || 0) - (a.duration || 0)); break;
        }
        return list;
    }, [transcriptions, searchQuery, sortOrder]);

    return (
        <div className="max-w-5xl mx-auto px-6 py-12">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight" style={{ color: 'var(--text)' }}>Your Transcriptions</h1>
                    <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                        {transcriptions.length} file{transcriptions.length !== 1 ? 's' : ''} transcribed
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {anySelected && (
                        <button onClick={deleteSelected}
                            className="flex items-center gap-2 text-sm px-4 py-2 rounded-xl font-medium"
                            style={{ background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.3)', color: '#fca5a5' }}>
                            <Trash2 size={14} /> Delete {selectedIds.size}
                        </button>
                    )}
                    {!anySelected && transcriptions.length > 0 && (
                        <button onClick={clearAll} className="btn-ghost flex items-center gap-2 text-sm">
                            <Trash2 size={14} /> Clear All
                        </button>
                    )}
                    <Link href="/" className="btn-primary text-sm py-2 px-4 flex items-center gap-2">
                        <Plus size={16} /> New Upload
                    </Link>
                </div>
            </div>

            {/* Stats banner */}
            {transcriptions.length > 0 && (
                <div className="glass p-4 flex flex-wrap gap-6 mb-6 animate-fade-up">
                    {[
                        { icon: <BarChart2 size={15} />, val: transcriptions.length, label: 'transcriptions' },
                        { icon: <Type size={15} />, val: totalWords.toLocaleString(), label: 'words' },
                        { icon: <Clock size={15} />, val: formatTotalDuration(totalDuration), label: 'total' },
                    ].map(({ icon, val, label }) => (
                        <div key={label} className="flex items-center gap-2">
                            <span style={{ color: 'var(--accent-light)' }}>{icon}</span>
                            <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{val}</span>
                            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{label}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* Toolbar */}
            {transcriptions.length > 0 && (
                <div className="flex gap-3 mb-6 flex-wrap items-center">
                    <div className="relative flex-1 min-w-48">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                        <input className="input-base pl-9" placeholder="Search by filename…"
                            value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                    </div>
                    <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value as SortOrder)}
                        className="input-base" style={{ width: 'auto' }}>
                        <option value="newest">Newest first</option>
                        <option value="oldest">Oldest first</option>
                        <option value="alpha">A → Z</option>
                        <option value="duration">Longest first</option>
                    </select>
                    <div className="flex rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                        {(['grid', 'list'] as const).map((v) => (
                            <button key={v} onClick={() => setViewMode(v)} className="p-2.5 transition-colors"
                                style={{ background: viewMode === v ? 'var(--accent)' : 'rgba(255,255,255,0.03)', color: viewMode === v ? 'white' : 'var(--text-muted)' }}>
                                {v === 'grid' ? <Grid3X3 size={15} /> : <List size={15} />}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Empty state */}
            {!loading && transcriptions.length === 0 && (
                <div className="glass p-16 text-center">
                    <div className="w-16 h-16 rounded-2xl mx-auto mb-5 flex items-center justify-center"
                        style={{ background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.2)' }}>
                        <FileText size={28} style={{ color: 'var(--accent-light)' }} />
                    </div>
                    <h3 className="text-xl font-semibold mb-2" style={{ color: 'var(--text)' }}>No transcriptions yet</h3>
                    <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>Upload your first audio or video file to get started.</p>
                    <Link href="/" className="btn-primary inline-flex text-sm py-2.5 px-5">Go to Upload</Link>
                </div>
            )}

            {/* Skeleton */}
            {loading && (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {[1, 2, 3].map((k) => <SkeletonCard key={k} />)}
                </div>
            )}

            {/* Grid view */}
            {!loading && filtered.length > 0 && viewMode === 'grid' && (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {filtered.map((t) => {
                        const i = t._idx;
                        const isSelected = selectedIds.has(i);
                        return (
                            <div key={i} className="glass group hover:scale-[1.01] transition-all duration-200 flex flex-col overflow-hidden relative"
                                style={{ outline: isSelected ? '2px solid var(--accent)' : 'none' }}>
                                <button onClick={() => toggleSelect(i)}
                                    className="absolute top-3 right-3 z-10 w-5 h-5 rounded-md flex items-center justify-center transition-all"
                                    style={{
                                        background: isSelected ? 'var(--accent)' : 'rgba(255,255,255,0.08)',
                                        border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                                        opacity: isSelected || anySelected ? 1 : 0,
                                    }}>
                                    {isSelected && <CheckIcon />}
                                </button>
                                <div className="p-5 flex-1 space-y-4">
                                    <div className="flex items-start justify-between">
                                        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                                            style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.3), rgba(59,130,246,0.2))', border: '1px solid rgba(124,58,237,0.3)' }}>
                                            <Play size={16} style={{ color: 'var(--accent-light)' }} />
                                        </div>
                                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold"
                                            style={{ background: 'rgba(52,211,153,0.12)', color: '#34d399', border: '1px solid rgba(52,211,153,0.2)' }}>
                                            ✓ Done
                                        </span>
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-sm leading-snug truncate pr-6" style={{ color: 'var(--text)' }} title={t.originalFilename}>
                                            {t.originalFilename}
                                        </h3>
                                        <div className="flex flex-wrap items-center gap-3 mt-2">
                                            {t.duration && <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}><Clock size={11} />{formatDuration(t.duration)}</span>}
                                            <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}><Type size={11} />{wordCount(t)} words</span>
                                            {t.language && <span className="text-xs uppercase font-semibold px-1.5 py-0.5 rounded" style={{ background: 'rgba(167,139,250,0.12)', color: 'var(--accent-light)' }}>{t.language}</span>}
                                            {t.createdAt && <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}><Clock size={10} />{timeAgo(t.createdAt)}</span>}
                                        </div>
                                    </div>
                                    {t.text && (
                                        <p className="text-xs leading-relaxed line-clamp-3 italic" style={{ color: 'var(--text-muted)' }}>
                                            &ldquo;{t.text}&rdquo;
                                        </p>
                                    )}
                                </div>
                                <div className="px-5 py-3 flex items-center gap-3" style={{ borderTop: '1px solid var(--border)' }}>
                                    <Link href={`/editor?id=${i}`}
                                        className="flex items-center justify-between text-sm font-medium transition-colors group flex-1"
                                        style={{ color: 'var(--accent-light)' }}>
                                        <span>Open Editor</span>
                                        <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" />
                                    </Link>
                                    <button onClick={() => quickExportSrt(t, t.originalFilename || 'transcript')}
                                        className="p-1.5 rounded-lg transition-colors" title="Quick export SRT"
                                        style={{ color: 'var(--text-muted)' }}
                                        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent-light)')}
                                        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}>
                                        <FileDown size={14} />
                                    </button>
                                    <button onClick={() => deleteOne(i)} className="p-1.5 rounded-lg transition-colors" title="Delete"
                                        style={{ color: 'var(--text-muted)' }}
                                        onMouseEnter={(e) => (e.currentTarget.style.color = '#f87171')}
                                        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}>
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* List view */}
            {!loading && filtered.length > 0 && viewMode === 'list' && (
                <div className="space-y-2">
                    {filtered.map((t) => {
                        const i = t._idx;
                        const isSelected = selectedIds.has(i);
                        return (
                            <div key={i} className="glass flex items-center gap-4 px-5 py-4 hover:scale-[1.005] transition-all"
                                style={{ outline: isSelected ? '2px solid var(--accent)' : 'none' }}>
                                <button onClick={() => toggleSelect(i)}
                                    className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 transition-all"
                                    style={{ background: isSelected ? 'var(--accent)' : 'rgba(255,255,255,0.08)', border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}` }}>
                                    {isSelected && <CheckIcon />}
                                </button>
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium text-sm truncate" style={{ color: 'var(--text)' }}>{t.originalFilename}</p>
                                    <div className="flex flex-wrap items-center gap-3 mt-1">
                                        {t.duration && <span className="text-xs flex items-center gap-1" style={{ color: 'var(--text-muted)' }}><Clock size={10} />{formatDuration(t.duration)}</span>}
                                        <span className="text-xs flex items-center gap-1" style={{ color: 'var(--text-muted)' }}><Type size={10} />{wordCount(t)} words</span>
                                        {t.language && <span className="text-xs uppercase font-semibold px-1.5 py-0.5 rounded" style={{ background: 'rgba(167,139,250,0.12)', color: 'var(--accent-light)' }}>{t.language}</span>}
                                        {t.createdAt && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{timeAgo(t.createdAt)}</span>}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                    <button onClick={() => quickExportSrt(t, t.originalFilename || 'transcript')}
                                        className="btn-ghost text-xs py-1.5 px-3 flex items-center gap-1.5">
                                        <FileDown size={12} /> SRT
                                    </button>
                                    <Link href={`/editor?id=${i}`} className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5">
                                        Open <ArrowRight size={12} />
                                    </Link>
                                    <button onClick={() => deleteOne(i)} className="p-1.5 rounded-lg transition-colors"
                                        style={{ color: 'var(--text-muted)' }}
                                        onMouseEnter={(e) => (e.currentTarget.style.color = '#f87171')}
                                        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}>
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* No results */}
            {!loading && transcriptions.length > 0 && filtered.length === 0 && (
                <div className="glass p-12 text-center">
                    <Search size={32} className="mx-auto mb-3 opacity-30" style={{ color: 'var(--text-muted)' }} />
                    <p className="font-semibold" style={{ color: 'var(--text)' }}>No results for &ldquo;{searchQuery}&rdquo;</p>
                    <button onClick={() => setSearchQuery('')} className="btn-ghost text-sm mt-4 px-4 py-2">Clear search</button>
                </div>
            )}
        </div>
    );
}
