'use client';

import Link from 'next/link';
import { FileText, ArrowRight, Play, Plus, Trash2, Clock, Type } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function Dashboard() {
    const [transcriptions, setTranscriptions] = useState<any[]>([]);

    useEffect(() => {
        const existingData = localStorage.getItem('transcription_bulk');
        if (existingData) {
            try { setTranscriptions(JSON.parse(existingData)); } catch (_) { /* ignore */ }
        }
    }, []);

    const clearAll = () => {
        if (confirm('Clear all transcriptions? This cannot be undone.')) {
            localStorage.removeItem('transcription_bulk');
            setTranscriptions([]);
        }
    };

    const formatDuration = (seconds: number) => {
        if (!seconds) return '—';
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const wordCount = (t: any) => {
        return t.words?.length || t.text?.split(' ').length || 0;
    };

    return (
        <div className="max-w-5xl mx-auto px-6 py-12">
            {/* Header */}
            <div className="flex items-center justify-between mb-10">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight" style={{ color: 'var(--text)' }}>Your Transcriptions</h1>
                    <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                        {transcriptions.length} file{transcriptions.length !== 1 ? 's' : ''} transcribed
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {transcriptions.length > 0 && (
                        <button onClick={clearAll} className="btn-ghost flex items-center gap-2 text-sm">
                            <Trash2 size={14} /> Clear All
                        </button>
                    )}
                    <Link href="/" className="btn-primary text-sm py-2 px-4 flex items-center gap-2">
                        <Plus size={16} /> New Upload
                    </Link>
                </div>
            </div>

            {transcriptions.length === 0 ? (
                <div className="glass p-16 text-center">
                    <div className="w-16 h-16 rounded-2xl mx-auto mb-5 flex items-center justify-center"
                        style={{ background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.2)' }}>
                        <FileText size={28} style={{ color: 'var(--accent-light)' }} />
                    </div>
                    <h3 className="text-xl font-semibold mb-2" style={{ color: 'var(--text)' }}>No transcriptions yet</h3>
                    <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>Upload your first audio or video file to get started.</p>
                    <Link href="/" className="btn-primary inline-flex text-sm py-2.5 px-5">
                        Go to Upload
                    </Link>
                </div>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {transcriptions.map((t, i) => (
                        <div key={i} className="glass group hover:scale-[1.01] transition-all duration-200 flex flex-col overflow-hidden"
                            style={{ cursor: 'default' }}>
                            {/* Card top */}
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
                                    <h3 className="font-semibold text-sm leading-snug truncate" style={{ color: 'var(--text)' }} title={t.originalFilename}>
                                        {t.originalFilename}
                                    </h3>
                                    <div className="flex items-center gap-3 mt-2">
                                        {t.duration && (
                                            <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                                                <Clock size={11} /> {formatDuration(t.duration)}
                                            </span>
                                        )}
                                        <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                                            <Type size={11} /> {wordCount(t)} words
                                        </span>
                                        {t.language && (
                                            <span className="text-xs uppercase font-semibold px-1.5 py-0.5 rounded"
                                                style={{ background: 'rgba(167,139,250,0.12)', color: 'var(--accent-light)' }}>
                                                {t.language}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {t.text && (
                                    <p className="text-xs leading-relaxed line-clamp-3 italic"
                                        style={{ color: 'var(--text-muted)' }}>
                                        &ldquo;{t.text}&rdquo;
                                    </p>
                                )}
                            </div>

                            {/* Card footer */}
                            <div className="px-5 py-3" style={{ borderTop: '1px solid var(--border)' }}>
                                <Link
                                    href={`/editor?id=${i}`}
                                    className="flex items-center justify-between text-sm font-medium transition-colors group"
                                    style={{ color: 'var(--accent-light)' }}
                                >
                                    <span>Open Editor</span>
                                    <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" />
                                </Link>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
