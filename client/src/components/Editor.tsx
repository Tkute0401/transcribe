'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import {
    ArrowLeft, List, Type, Flame, Edit3, Check, FileText,
    Trash2, Loader2, Clipboard, ClipboardCheck, Scissors,
    GitMerge, Search, X, Sparkles, HelpCircle, ChevronDown,
} from 'lucide-react';
import Link from 'next/link';
import { useUndoRedo } from '@/hooks/useUndoRedo';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useToast } from '@/components/Toast';
import ExportDropdown from '@/components/ExportDropdown';
import PresetSelector, { STYLE_PRESETS, type StyleConfig } from '@/components/PresetSelector';
import WaveformPlayer from '@/components/WaveformPlayer';
import { chunkTranscript, buildSrt, buildVtt, buildAss, downloadFile } from '@/lib/transcript';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const GAP_THRESHOLD = 0.8;

const FONT_MAP: Record<string, string> = {
    sans: 'Inter, sans-serif',
    serif: 'Playfair Display, serif',
    mono: 'Space Mono, monospace',
    oswald: 'Oswald, sans-serif',
    roboto: 'Roboto, sans-serif',
};

const mockTranscript = [
    { start: 0, end: 1.5, word: 'Hello' },
    { start: 1.5, end: 3.0, word: 'welcome' },
    { start: 3.0, end: 4.5, word: 'to' },
    { start: 4.5, end: 6.0, word: 'the' },
    { start: 6.0, end: 8.0, word: 'transcription.' },
];

function formatTime(s: number) {
    const m = Math.floor(s / 60);
    const sec = (s % 60).toFixed(2).padStart(5, '0');
    return `${m}:${sec}`;
}

// ─── Confetti ────────────────────────────────────────────────────────────────

function ConfettiOverlay({ onDone }: { onDone: () => void }) {
    useEffect(() => { const t = setTimeout(onDone, 4000); return () => clearTimeout(t); }, [onDone]);
    const COLORS = ['#a78bfa', '#34d399', '#60a5fa', '#fb923c', '#f472b6', '#facc15'];
    return (
        <>
            {Array.from({ length: 24 }).map((_, i) => (
                <span
                    key={i}
                    className="confetti-piece"
                    style={{
                        left: `${Math.random() * 100}%`,
                        top: 0,
                        background: COLORS[i % COLORS.length],
                        animationDuration: `${2 + Math.random() * 2}s`,
                        animationDelay: `${Math.random() * 0.8}s`,
                        width: Math.random() > 0.5 ? 8 : 5,
                        height: Math.random() > 0.5 ? 8 : 12,
                    }}
                />
            ))}
        </>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Editor({ index }: { index?: number }) {
    // ── Transcript (undo/redo) ──────────────────────────────────────────────
    const { current: transcript, set: setTranscript, undo, redo, canUndo, canRedo } =
        useUndoRedo<any[]>(mockTranscript);
    const initializedRef = useRef(false);

    // ── UI state ────────────────────────────────────────────────────────────
    const [playedSeconds, setPlayedSeconds] = useState(0);
    const [filename, setFilename] = useState('transcript');
    const [serverFilename, setServerFilename] = useState<string | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [activeTab, setActiveTab] = useState<'transcript' | 'style'>('transcript');
    const [transcriptView, setTranscriptView] = useState<'words' | 'subtitles'>('words');

    // ── Style ────────────────────────────────────────────────────────────────
    const [styleConfig, setStyleConfig] = useState<StyleConfig>({
        fontSize: 'medium', color: '#FFFFFF', backgroundColor: '#000000',
        fontFamily: 'sans', animation: 'karaoke', position: 'bottom',
        bold: false, italic: false, uppercase: false, outline: 2, shadow: 2,
    });
    const [activePreset, setActivePreset] = useState<string | null>(null);

    // ── Burn ─────────────────────────────────────────────────────────────────
    const [isBurning, setIsBurning] = useState(false);
    const [burnProgress, setBurnProgress] = useState(0);
    const [burnComplete, setBurnComplete] = useState(false);
    const burnPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // ── Speaker labels ────────────────────────────────────────────────────────
    const [speakers, setSpeakers] = useState<Record<number, number>>({});

    // ── Copy to clipboard ─────────────────────────────────────────────────────
    const [isCopied, setIsCopied] = useState(false);

    // ── Find & Replace ────────────────────────────────────────────────────────
    const [findOpen, setFindOpen] = useState(false);
    const [findQuery, setFindQuery] = useState('');
    const [replaceQuery, setReplaceQuery] = useState('');

    // ── Keyboard shortcuts panel ──────────────────────────────────────────────
    const [showShortcuts, setShowShortcuts] = useState(false);

    // ── Preview frame ─────────────────────────────────────────────────────────
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [isCapturing, setIsCapturing] = useState(false);

    // ── AI Polish ─────────────────────────────────────────────────────────────
    const [aiOpen, setAiOpen] = useState(false);
    const [aiKey, setAiKey] = useState('');
    const [aiLoading, setAiLoading] = useState(false);
    const [aiDiff, setAiDiff] = useState<{ original: any[]; cleaned: string[] } | null>(null);

    const { addToast } = useToast();

    // ── Load from localStorage ────────────────────────────────────────────────
    useEffect(() => {
        if (typeof window === 'undefined' || initializedRef.current) return;
        initializedRef.current = true;

        let data: any = null;
        if (index !== undefined && !isNaN(index)) {
            const bulk = localStorage.getItem('transcription_bulk');
            if (bulk) {
                try { const arr = JSON.parse(bulk); if (arr[index]) data = arr[index]; } catch (_) {}
            }
        }
        if (!data) {
            const stored = localStorage.getItem('transcription');
            if (stored) try { data = JSON.parse(stored); } catch (_) {}
        }
        if (data) {
            if (data.words) setTranscript(data.words);
            if (data.originalFilename) setFilename(data.originalFilename.replace(/\.[^/.]+$/, ''));
            if (data.serverFilename) setServerFilename(data.serverFilename);
            if (data.styleConfig) setStyleConfig((prev) => ({ ...prev, ...data.styleConfig }));
            if (data.speakers) setSpeakers(data.speakers);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [index]);

    // ── Persist to localStorage ───────────────────────────────────────────────
    useEffect(() => {
        if (!initializedRef.current) return;
        const stored = localStorage.getItem('transcription');
        let base: any = {};
        if (stored) try { base = JSON.parse(stored); } catch (_) {}
        localStorage.setItem('transcription', JSON.stringify({ ...base, words: transcript, styleConfig, speakers }));
    }, [transcript, styleConfig, speakers]);

    // ── Derived ───────────────────────────────────────────────────────────────
    const subtitleChunks = useMemo(() => chunkTranscript(transcript), [transcript]);
    const currentChunk = subtitleChunks.find(
        (c) => playedSeconds >= c.start && playedSeconds < c.end
    );

    // ── Caption styling helpers ───────────────────────────────────────────────
    const getCaptionStyle = () => {
        const sizes: Record<string, string> = { small: '1.1rem', medium: '1.4rem', large: '2rem', huge: '2.8rem' };
        const s: React.CSSProperties = {
            color: styleConfig.color,
            fontFamily: FONT_MAP[styleConfig.fontFamily] || 'sans-serif',
            fontWeight: styleConfig.bold ? 'bold' : 'normal',
            fontStyle: styleConfig.italic ? 'italic' : 'normal',
            textTransform: styleConfig.uppercase ? 'uppercase' : 'none',
            fontSize: sizes[styleConfig.fontSize] || '1.4rem',
        };
        if (styleConfig.shadow > 0)
            s.textShadow = `${styleConfig.shadow * 2}px ${styleConfig.shadow * 2}px 4px rgba(0,0,0,0.85)`;
        if (styleConfig.outline > 0)
            (s as any).WebkitTextStroke = `${styleConfig.outline}px black`;
        return s;
    };

    const getPositionClass = () => {
        if (styleConfig.position === 'top') return 'top-4';
        if (styleConfig.position === 'middle') return 'top-1/2 -translate-y-1/2';
        return 'bottom-4';
    };

    const getAnimCls = () => {
        if (styleConfig.animation === 'fade') return 'animate-fade-in';
        if (styleConfig.animation === 'pop') return 'animate-pop-in';
        if (styleConfig.animation === 'slide') return 'animate-slide-up';
        return '';
    };

    // ── Word editing ──────────────────────────────────────────────────────────
    const updateWord = (i: number, field: string, val: string | number) => {
        const n = [...transcript];
        n[i] = { ...n[i], [field]: field === 'word' ? val : parseFloat(val as string) || 0 };
        setTranscript(n);
    };

    const deleteWord = (i: number) => {
        setTranscript(transcript.filter((_, idx) => idx !== i));
    };

    // ── Merge & Split ─────────────────────────────────────────────────────────
    const splitChunk = (chunkIndex: number) => {
        const chunk = subtitleChunks[chunkIndex];
        if (!chunk || chunk.words.length < 2) return;
        const mid = Math.floor(chunk.words.length / 2);
        // Find the global index of the mid word
        const midWord = chunk.words[mid - 1];
        const nextWord = chunk.words[mid];
        const globalMidIdx = transcript.findIndex(
            (w) => w.start === midWord.start && w.end === midWord.end
        );
        const globalNextIdx = transcript.findIndex(
            (w) => w.start === nextWord.start && w.end === nextWord.end
        );
        if (globalMidIdx < 0 || globalNextIdx < 0) return;
        const n = [...transcript];
        // Insert gap to force a chunk break
        n[globalNextIdx] = { ...n[globalNextIdx], start: n[globalMidIdx].end + GAP_THRESHOLD + 0.05 };
        setTranscript(n);
    };

    const mergeChunks = (chunkIndex: number) => {
        // Merge chunk[chunkIndex] and chunk[chunkIndex+1]
        if (chunkIndex >= subtitleChunks.length - 1) return;
        const lastWordOfFirst = subtitleChunks[chunkIndex].words.at(-1);
        const firstWordOfSecond = subtitleChunks[chunkIndex + 1].words[0];
        if (!lastWordOfFirst || !firstWordOfSecond) return;
        const globalIdx = transcript.findIndex(
            (w) => w.start === firstWordOfSecond.start && w.end === firstWordOfSecond.end
        );
        if (globalIdx < 0) return;
        const n = [...transcript];
        // Close gap between the two chunks
        n[globalIdx] = { ...n[globalIdx], start: lastWordOfFirst.end + 0.01 };
        setTranscript(n);
    };

    // ── Export ────────────────────────────────────────────────────────────────
    const handleExport = (format: 'txt' | 'srt' | 'vtt' | 'ass') => {
        switch (format) {
            case 'txt': {
                const text = transcript.map((w) => (w.word || w.text || '').trim()).join(' ');
                downloadFile(text, `${filename}.txt`, 'text/plain');
                break;
            }
            case 'srt':
                downloadFile(buildSrt(subtitleChunks, speakers), `${filename}.srt`, 'text/plain');
                break;
            case 'vtt':
                downloadFile(buildVtt(subtitleChunks, speakers), `${filename}.vtt`, 'text/vtt');
                break;
            case 'ass':
                downloadFile(buildAss(subtitleChunks, styleConfig), `${filename}.ass`, 'text/plain');
                break;
        }
    };

    // ── Copy to clipboard ─────────────────────────────────────────────────────
    const copyToClipboard = () => {
        const text = transcript.map((w) => (w.word || w.text || '').trim()).join(' ');
        navigator.clipboard.writeText(text).then(() => {
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 1500);
        });
    };

    // ── Find & Replace ────────────────────────────────────────────────────────
    const replaceAll = () => {
        if (!findQuery) return;
        const regex = new RegExp(findQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        setTranscript(transcript.map((w) => ({
            ...w,
            word: (w.word || w.text || '').replace(regex, replaceQuery),
        })));
        addToast(`Replaced "${findQuery}" → "${replaceQuery}"`, 'success');
    };

    // ── Burn ──────────────────────────────────────────────────────────────────
    const handleBurn = async () => {
        if (!serverFilename) return;
        setIsBurning(true);
        setBurnProgress(0);
        setBurnComplete(false);

        try {
            const res = await fetch(`${API_URL}/api/burn`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename: serverFilename, transcript, styleConfig }),
            });
            const { jobId, error } = await res.json();
            if (!jobId) throw new Error(error || 'No job ID returned');

            burnPollRef.current = setInterval(async () => {
                try {
                    const status = await fetch(`${API_URL}/api/burn-status/${jobId}`).then((r) => r.json());
                    setBurnProgress(status.progress || 0);

                    if (status.status === 'done') {
                        clearInterval(burnPollRef.current!);
                        setIsBurning(false);
                        setBurnProgress(100);
                        setBurnComplete(true);
                        const a = document.createElement('a');
                        a.href = `${API_URL}/uploads/${status.outputFile}`;
                        a.download = status.outputFile;
                        document.body.appendChild(a); a.click(); document.body.removeChild(a);
                        addToast('Burn complete! Video downloading…', 'success');
                        setTimeout(() => setBurnComplete(false), 5000);
                    } else if (status.status === 'error') {
                        clearInterval(burnPollRef.current!);
                        setIsBurning(false);
                        addToast(`Burn failed: ${status.error}`, 'error');
                    }
                } catch (_) {}
            }, 1500);
        } catch (e: any) {
            setIsBurning(false);
            addToast(`Failed to start burn: ${e.message}`, 'error');
        }
    };

    // ── Preview frame ─────────────────────────────────────────────────────────
    const capturePreview = async () => {
        if (!serverFilename) return;
        setIsCapturing(true);
        try {
            const res = await fetch(`${API_URL}/api/preview-frame`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename: serverFilename, styleConfig, timestamp: Math.max(1, playedSeconds) }),
            });
            const data = await res.json();
            if (data.image) setPreviewImage(data.image);
            else throw new Error(data.error || 'No image returned');
        } catch (e: any) {
            addToast(`Preview failed: ${e.message}`, 'error');
        } finally {
            setIsCapturing(false);
        }
    };

    // ── AI Polish ─────────────────────────────────────────────────────────────
    const runAiPolish = async () => {
        if (!aiKey || !transcript.length) return;
        setAiLoading(true);
        try {
            const words = transcript.map((w) => w.word || w.text || '');
            const res = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${aiKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'gpt-4o',
                    messages: [{
                        role: 'user',
                        content: `Fix grammar, punctuation, and remove filler words from this transcript. Return ONLY a JSON array of strings with the same number of elements as the input. Do not add or remove words. Input: ${JSON.stringify(words)}`,
                    }],
                    temperature: 0.3,
                }),
            });
            const data = await res.json();
            const content = data.choices?.[0]?.message?.content || '';
            const jsonMatch = content.match(/\[[\s\S]*\]/);
            if (!jsonMatch) throw new Error('Could not parse GPT response');
            const cleaned: string[] = JSON.parse(jsonMatch[0]);
            if (cleaned.length !== words.length) {
                addToast('Word count mismatch — could not map cleanup back to timestamps', 'warning');
                return;
            }
            setAiDiff({ original: transcript, cleaned });
        } catch (e: any) {
            addToast(`AI Polish failed: ${e.message}`, 'error');
        } finally {
            setAiLoading(false);
        }
    };

    const acceptAiDiff = () => {
        if (!aiDiff) return;
        setTranscript(aiDiff.original.map((w, i) => ({ ...w, word: aiDiff.cleaned[i] })));
        setAiDiff(null);
        setAiOpen(false);
        addToast('AI cleanup applied!', 'success');
    };

    // ── Keyboard shortcuts ────────────────────────────────────────────────────
    useKeyboardShortcuts({
        ' ': () => {
            const v = document.getElementById('main-video') as HTMLVideoElement;
            if (v) v.paused ? v.play() : v.pause();
        },
        'ArrowLeft': () => {
            const v = document.getElementById('main-video') as HTMLVideoElement;
            if (v) v.currentTime = Math.max(0, v.currentTime - 2);
        },
        'ArrowRight': () => {
            const v = document.getElementById('main-video') as HTMLVideoElement;
            if (v) v.currentTime = Math.min(v.duration || 0, v.currentTime + 2);
        },
        'ctrl+z': () => canUndo && undo(),
        'ctrl+y': () => canRedo && redo(),
        'ctrl+f': () => { setFindOpen(true); setActiveTab('transcript'); },
        'e': () => { setIsEditing((v) => !v); setEditingIndex(null); },
        '?': () => setShowShortcuts((v) => !v),
    });

    // ── Sub-components ────────────────────────────────────────────────────────
    const SC = ({ label, children }: { label: string; children: React.ReactNode }) => (
        <div>
            <label className="block text-xs font-semibold uppercase tracking-wide mb-2"
                style={{ color: 'var(--text-muted)' }}>{label}</label>
            {children}
        </div>
    );

    const InlineInput = ({ value, onChange, type = 'text', small = false }: any) => (
        <input
            autoFocus type={type} step={type === 'number' ? '0.01' : undefined}
            className="px-1.5 py-0.5 text-xs rounded-lg border outline-none"
            style={{ width: small ? '4rem' : '5rem', background: 'rgba(124,58,237,0.2)', borderColor: 'var(--accent)', color: 'var(--text)' }}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') setEditingIndex(null); }}
            onBlur={() => setEditingIndex(null)}
        />
    );

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
            {/* Confetti */}
            {burnComplete && <ConfettiOverlay onDone={() => setBurnComplete(false)} />}

            {/* Shortcuts help panel */}
            {showShortcuts && (
                <div className="fixed inset-0 z-50 flex items-center justify-center"
                    style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
                    onClick={() => setShowShortcuts(false)}>
                    <div className="glass p-6 rounded-2xl w-full max-w-md animate-pop-in" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-bold text-base" style={{ color: 'var(--text)' }}>Keyboard Shortcuts</h3>
                            <button onClick={() => setShowShortcuts(false)} style={{ color: 'var(--text-muted)' }}><X size={16} /></button>
                        </div>
                        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                            {[
                                ['Space', 'Play / Pause'],
                                ['← / →', 'Seek ±2s'],
                                ['Ctrl+Z', 'Undo'],
                                ['Ctrl+Y', 'Redo'],
                                ['Ctrl+F', 'Find & Replace'],
                                ['E', 'Toggle Edit Mode'],
                                ['?', 'This panel'],
                            ].map(([key, desc]) => (
                                <div key={key} className="flex items-center justify-between gap-2">
                                    <span className="kbd">{key}</span>
                                    <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{desc}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Preview modal */}
            {previewImage && (
                <div className="fixed inset-0 z-50 flex items-center justify-center"
                    style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
                    onClick={() => setPreviewImage(null)}>
                    <div className="glass p-4 rounded-2xl animate-pop-in max-w-2xl w-full mx-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-3">
                            <span className="font-semibold text-sm" style={{ color: 'var(--text)' }}>Caption Preview</span>
                            <div className="flex gap-2">
                                <a href={previewImage} download="caption-preview.jpg"
                                    className="btn-ghost text-xs py-1 px-3">Download</a>
                                <button onClick={() => setPreviewImage(null)} style={{ color: 'var(--text-muted)' }}><X size={16} /></button>
                            </div>
                        </div>
                        <img src={previewImage} alt="Caption preview" className="w-full rounded-xl" />
                    </div>
                </div>
            )}

            {/* AI Polish modal */}
            {aiOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center"
                    style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
                    onClick={() => { if (!aiLoading) { setAiOpen(false); setAiDiff(null); } }}>
                    <div className="glass p-6 rounded-2xl w-full max-w-2xl mx-4 animate-pop-in space-y-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Sparkles size={18} style={{ color: 'var(--accent-light)' }} />
                                <h3 className="font-bold" style={{ color: 'var(--text)' }}>AI Transcript Polish</h3>
                            </div>
                            {!aiLoading && <button onClick={() => { setAiOpen(false); setAiDiff(null); }} style={{ color: 'var(--text-muted)' }}><X size={16} /></button>}
                        </div>

                        {!aiDiff ? (
                            <>
                                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                                    Uses GPT-4o to fix grammar, punctuation, and remove filler words. Your API key is never stored.
                                </p>
                                <input
                                    type="password"
                                    className="input-base"
                                    placeholder="sk-... (OpenAI API key)"
                                    value={aiKey}
                                    onChange={(e) => setAiKey(e.target.value)}
                                    autoComplete="off"
                                />
                                <button
                                    onClick={runAiPolish}
                                    disabled={aiLoading || !aiKey}
                                    className="btn-primary w-full"
                                    style={{ opacity: (!aiKey || aiLoading) ? 0.5 : 1 }}
                                >
                                    {aiLoading ? <><Loader2 size={16} className="animate-spin" /> Cleaning…</> : <><Sparkles size={16} /> Clean Transcript</>}
                                </button>
                            </>
                        ) : (
                            <>
                                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                                    Changes highlighted in yellow. Review then accept or cancel.
                                </p>
                                <div className="rounded-xl p-3 overflow-y-auto flex flex-wrap gap-1.5" style={{ maxHeight: 280, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}>
                                    {aiDiff.original.map((w, i) => {
                                        const orig = (w.word || w.text || '').trim();
                                        const clean = aiDiff.cleaned[i]?.trim();
                                        const changed = orig !== clean;
                                        return (
                                            <span key={i} className="px-1.5 py-0.5 rounded text-sm"
                                                style={{
                                                    background: changed ? 'rgba(251,191,36,0.2)' : 'rgba(255,255,255,0.04)',
                                                    border: `1px solid ${changed ? 'rgba(251,191,36,0.4)' : 'transparent'}`,
                                                    color: changed ? '#fde68a' : 'var(--text)',
                                                }}>
                                                {changed ? clean : orig}
                                            </span>
                                        );
                                    })}
                                </div>
                                <div className="flex gap-3">
                                    <button onClick={acceptAiDiff} className="btn-primary flex-1">Accept All Changes</button>
                                    <button onClick={() => setAiDiff(null)} className="btn-ghost flex-1">Review Again</button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Page content */}
            <div className="max-w-7xl mx-auto px-6 py-4">
                <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm transition-colors"
                    style={{ color: 'var(--text-muted)' }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent-light)')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}>
                    <ArrowLeft size={15} /> Back to Dashboard
                </Link>
            </div>

            <div className="max-w-7xl mx-auto px-6 pb-4 flex items-center gap-4">
                <div>
                    <h1 className="text-xl font-bold truncate" style={{ color: 'var(--text)' }}>{filename}</h1>
                    <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        {transcript.length} words · {subtitleChunks.length} subtitle blocks
                    </p>
                </div>
                <button onClick={() => setShowShortcuts(true)}
                    className="ml-auto btn-ghost py-1.5 px-2.5 flex items-center gap-1.5 text-xs">
                    <HelpCircle size={13} /> Shortcuts
                </button>
            </div>

            <div className="max-w-7xl mx-auto px-6 pb-12 grid grid-cols-1 lg:grid-cols-5 gap-6">
                {/* Left: Video + Waveform + Export bar */}
                <div className="lg:col-span-3 space-y-4">
                    {/* Video */}
                    <div className="relative rounded-2xl overflow-hidden aspect-video" style={{ background: '#000' }}>
                        {serverFilename ? (
                            <>
                                <video
                                    id="main-video"
                                    src={`${API_URL}/uploads/${serverFilename}`}
                                    className="w-full h-full object-contain"
                                    controls crossOrigin="anonymous"
                                    onTimeUpdate={(e) => setPlayedSeconds(e.currentTarget.currentTime)}
                                />
                                {currentChunk && (
                                    <div key={currentChunk.text}
                                        className={`absolute left-0 right-0 text-center pointer-events-none px-6 ${getPositionClass()}`}>
                                        <div className={`inline-block px-4 py-1.5 rounded-lg ${getAnimCls()}`}
                                            style={{ backgroundColor: `${styleConfig.backgroundColor}b0`, ...getCaptionStyle() }}>
                                            {currentChunk.text}
                                        </div>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="absolute inset-0 flex items-center justify-center text-center p-8" style={{ color: 'var(--text-muted)' }}>
                                <div>
                                    <FileText size={40} className="mx-auto mb-3 opacity-40" />
                                    <p className="text-sm">No video available. Go back and upload a file.</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Waveform */}
                    {serverFilename && (
                        <WaveformPlayer
                            audioSrc={`${API_URL}/uploads/${serverFilename}`}
                            currentTime={playedSeconds}
                            duration={(document.getElementById('main-video') as HTMLVideoElement)?.duration || 0}
                            subtitleChunks={subtitleChunks}
                            onSeek={(t) => {
                                const v = document.getElementById('main-video') as HTMLVideoElement;
                                if (v) v.currentTime = t;
                            }}
                        />
                    )}

                    {/* Export bar */}
                    <div className="glass p-4 flex flex-wrap items-center gap-3">
                        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Export</span>
                        <ExportDropdown onExport={handleExport} />

                        {/* Copy to clipboard */}
                        <button onClick={copyToClipboard}
                            className="btn-ghost text-xs py-1.5 px-3 flex items-center gap-1.5">
                            {isCopied ? <><ClipboardCheck size={12} /> Copied!</> : <><Clipboard size={12} /> Copy Text</>}
                        </button>

                        {/* Undo / Redo */}
                        <div className="flex gap-1">
                            <button onClick={undo} disabled={!canUndo}
                                className="btn-ghost text-xs py-1.5 px-2.5"
                                style={{ opacity: canUndo ? 1 : 0.3 }} title="Undo (Ctrl+Z)">↩</button>
                            <button onClick={redo} disabled={!canRedo}
                                className="btn-ghost text-xs py-1.5 px-2.5"
                                style={{ opacity: canRedo ? 1 : 0.3 }} title="Redo (Ctrl+Y)">↪</button>
                        </div>

                        <div className="flex-1" />
                        <button
                            onClick={() => { setIsEditing((v) => !v); setEditingIndex(null); }}
                            className="flex items-center gap-2 text-xs py-1.5 px-3 rounded-lg font-medium transition-all"
                            style={{
                                background: isEditing ? 'rgba(52,211,153,0.15)' : 'rgba(255,255,255,0.05)',
                                border: `1px solid ${isEditing ? 'rgba(52,211,153,0.4)' : 'var(--border)'}`,
                                color: isEditing ? '#34d399' : 'var(--text-muted)',
                            }}>
                            {isEditing ? <Check size={13} /> : <Edit3 size={13} />}
                            {isEditing ? 'Done Editing' : 'Edit Mode'}
                        </button>
                    </div>
                </div>

                {/* Right: Panel */}
                <div className="lg:col-span-2 glass flex flex-col overflow-hidden" style={{ maxHeight: '90vh' }}>
                    {/* Tabs */}
                    <div className="flex border-b flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
                        {(['transcript', 'style'] as const).map((tab) => (
                            <button key={tab} onClick={() => setActiveTab(tab)}
                                className="flex-1 py-3.5 text-sm font-semibold capitalize transition-colors"
                                style={{
                                    color: activeTab === tab ? 'var(--accent-light)' : 'var(--text-muted)',
                                    borderBottom: activeTab === tab ? '2px solid var(--accent)' : '2px solid transparent',
                                }}>
                                {tab === 'style' ? 'Style & Burn' : 'Transcript'}
                            </button>
                        ))}
                    </div>

                    {/* Transcript sub-tabs + toolbar */}
                    {activeTab === 'transcript' && (
                        <div className="px-4 pt-3 pb-1 flex-shrink-0 space-y-2">
                            <div className="flex items-center gap-2">
                                {(['words', 'subtitles'] as const).map((v) => (
                                    <button key={v} onClick={() => setTranscriptView(v)}
                                        className="flex items-center gap-1.5 text-xs py-1 px-2.5 rounded-lg transition-all"
                                        style={{
                                            background: transcriptView === v ? 'rgba(124,58,237,0.2)' : 'transparent',
                                            color: transcriptView === v ? 'var(--accent-light)' : 'var(--text-muted)',
                                            border: `1px solid ${transcriptView === v ? 'rgba(124,58,237,0.4)' : 'transparent'}`,
                                        }}>
                                        {v === 'words' ? <Type size={11} /> : <List size={11} />}
                                        {v === 'words' ? 'Words' : 'Subtitles'}
                                    </button>
                                ))}
                                <button onClick={() => setFindOpen((v) => !v)}
                                    className="flex items-center gap-1.5 text-xs py-1 px-2.5 rounded-lg transition-all"
                                    style={{
                                        background: findOpen ? 'rgba(251,191,36,0.15)' : 'transparent',
                                        color: findOpen ? '#fde68a' : 'var(--text-muted)',
                                        border: `1px solid ${findOpen ? 'rgba(251,191,36,0.3)' : 'transparent'}`,
                                    }}>
                                    <Search size={11} /> Find
                                </button>
                                <button onClick={() => setAiOpen(true)}
                                    className="flex items-center gap-1.5 text-xs py-1 px-2.5 rounded-lg transition-all ml-auto"
                                    style={{ color: 'var(--text-muted)', border: '1px solid transparent' }}
                                    onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent-light)'; e.currentTarget.style.borderColor = 'rgba(124,58,237,0.4)'; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'transparent'; }}>
                                    <Sparkles size={11} /> AI Polish
                                </button>
                            </div>

                            {/* Find & Replace panel */}
                            {findOpen && (
                                <div className="rounded-xl p-3 space-y-2 animate-slide-up"
                                    style={{ background: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.2)' }}>
                                    <div className="flex gap-2 items-center">
                                        <input className="input-base text-xs h-8" placeholder="Find…"
                                            value={findQuery} onChange={(e) => setFindQuery(e.target.value)}
                                            style={{ flex: 1 }} />
                                        <button onClick={() => { setFindOpen(false); setFindQuery(''); }}
                                            style={{ color: 'var(--text-muted)', flexShrink: 0 }}><X size={14} /></button>
                                    </div>
                                    <div className="flex gap-2 items-center">
                                        <input className="input-base text-xs h-8" placeholder="Replace with…"
                                            value={replaceQuery} onChange={(e) => setReplaceQuery(e.target.value)}
                                            style={{ flex: 1 }} />
                                        <button onClick={replaceAll}
                                            disabled={!findQuery}
                                            className="btn-ghost text-xs py-1 px-3 flex-shrink-0"
                                            style={{ opacity: findQuery ? 1 : 0.4 }}>
                                            Replace All
                                        </button>
                                    </div>
                                </div>
                            )}

                            {isEditing && (
                                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                    Click word to edit · ✕ to delete
                                </span>
                            )}
                        </div>
                    )}

                    {/* Panel content */}
                    <div className="flex-1 overflow-y-auto p-4">
                        {activeTab === 'transcript' ? (
                            transcriptView === 'words' ? (
                                <div className="flex flex-wrap gap-1.5">
                                    {transcript.map((word, i) => {
                                        const isActive = playedSeconds >= word.start && playedSeconds < word.end;
                                        const wordText = word.word || word.text || '';
                                        const isMatch = !!findQuery && wordText.toLowerCase().includes(findQuery.toLowerCase());

                                        if (isEditing && editingIndex === i) {
                                            return (
                                                <div key={i} className="flex flex-col gap-1 p-2 rounded-xl"
                                                    style={{ background: 'rgba(124,58,237,0.15)', border: '1px solid var(--accent)' }}>
                                                    <InlineInput value={wordText} onChange={(v: string) => updateWord(i, 'word', v)} />
                                                    <div className="flex gap-1 items-center">
                                                        <InlineInput value={word.start} type="number" small onChange={(v: string) => updateWord(i, 'start', v)} />
                                                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>→</span>
                                                        <InlineInput value={word.end} type="number" small onChange={(v: string) => updateWord(i, 'end', v)} />
                                                    </div>
                                                </div>
                                            );
                                        }

                                        return (
                                            <div key={i} className="group relative flex items-center gap-0.5">
                                                <span
                                                    onClick={() => {
                                                        if (isEditing) setEditingIndex(i);
                                                        else {
                                                            const v = document.getElementById('main-video') as HTMLVideoElement;
                                                            if (v) v.currentTime = word.start;
                                                        }
                                                    }}
                                                    className="cursor-pointer px-2 py-1 rounded-lg text-sm transition-all duration-150"
                                                    style={{
                                                        background: isActive ? 'rgba(124,58,237,0.35)' : isMatch ? 'rgba(251,191,36,0.15)' : 'rgba(255,255,255,0.04)',
                                                        color: isActive ? 'var(--accent-light)' : 'var(--text)',
                                                        border: `1px solid ${isActive ? 'rgba(124,58,237,0.4)' : isMatch ? 'rgba(251,191,36,0.4)' : 'transparent'}`,
                                                        outline: isEditing ? '1px dashed rgba(52,211,153,0.3)' : 'none',
                                                    }}>
                                                    {wordText}
                                                </span>
                                                {isEditing && (
                                                    <button onClick={() => deleteWord(i)}
                                                        className="opacity-0 group-hover:opacity-100 p-0.5 rounded transition-opacity"
                                                        style={{ color: '#f87171' }}>
                                                        <Trash2 size={11} />
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                /* Subtitles view */
                                <div className="space-y-2">
                                    {subtitleChunks.map((chunk, i) => (
                                        <div key={i}>
                                            <div className="subtitle-chunk rounded-xl p-3"
                                                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)' }}>
                                                <div className="flex items-center gap-2 mb-1.5">
                                                    {/* Speaker dot */}
                                                    {speakers[i] ? (
                                                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                                            style={{ background: ['', '#a78bfa', '#34d399', '#60a5fa'][speakers[i]] }} />
                                                    ) : null}
                                                    <span className="text-xs font-bold rounded px-1.5 py-0.5"
                                                        style={{ background: 'rgba(124,58,237,0.2)', color: 'var(--accent-light)' }}>
                                                        #{i + 1}
                                                    </span>
                                                    <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                                                        {formatTime(chunk.start)} → {formatTime(chunk.end)}
                                                    </span>
                                                    <span className="ml-auto text-xs flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
                                                        {(chunk.end - chunk.start).toFixed(1)}s
                                                        {/* Split button */}
                                                        {chunk.words.length >= 2 && (
                                                            <button onClick={() => splitChunk(i)}
                                                                className="split-merge-btn p-0.5 rounded"
                                                                style={{ color: '#fb923c' }} title="Split chunk">
                                                                <Scissors size={11} />
                                                            </button>
                                                        )}
                                                    </span>
                                                </div>
                                                <p className="text-sm" style={{ color: 'var(--text)' }}>{chunk.text}</p>
                                                {/* Speaker select */}
                                                <select
                                                    value={speakers[i] || 0}
                                                    onChange={(e) => setSpeakers((prev) => ({ ...prev, [i]: +e.target.value }))}
                                                    className="mt-2 text-xs rounded-lg px-2 py-1"
                                                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', color: 'var(--text-muted)', width: 'auto' }}>
                                                    <option value={0}>No speaker</option>
                                                    <option value={1}>Speaker 1</option>
                                                    <option value={2}>Speaker 2</option>
                                                    <option value={3}>Speaker 3</option>
                                                </select>
                                            </div>

                                            {/* Merge button between chunks */}
                                            {i < subtitleChunks.length - 1 && (
                                                <div className="flex justify-center my-0.5">
                                                    <button onClick={() => mergeChunks(i)}
                                                        className="split-merge-btn flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
                                                        style={{ color: '#34d399', background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.3)' }}>
                                                        <GitMerge size={10} /> Merge
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )
                        ) : (
                            /* Style & Burn tab */
                            <div className="space-y-5">
                                {/* Presets */}
                                <div>
                                    <label className="block text-xs font-semibold uppercase tracking-wide mb-3"
                                        style={{ color: 'var(--text-muted)' }}>Style Presets</label>
                                    <PresetSelector
                                        activePresetName={activePreset}
                                        onSelect={(preset) => {
                                            setStyleConfig((prev) => ({ ...prev, ...preset.config }));
                                            setActivePreset(preset.name);
                                        }}
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <SC label="Font Size">
                                        <select value={styleConfig.fontSize}
                                            onChange={(e) => { setStyleConfig({ ...styleConfig, fontSize: e.target.value }); setActivePreset(null); }}
                                            className="input-base">
                                            <option value="small">Small</option>
                                            <option value="medium">Medium</option>
                                            <option value="large">Large</option>
                                            <option value="huge">Huge</option>
                                        </select>
                                    </SC>
                                    <SC label="Font">
                                        <select value={styleConfig.fontFamily}
                                            onChange={(e) => { setStyleConfig({ ...styleConfig, fontFamily: e.target.value }); setActivePreset(null); }}
                                            className="input-base">
                                            <option value="sans">Inter (Sans)</option>
                                            <option value="roboto">Roboto</option>
                                            <option value="oswald">Oswald</option>
                                            <option value="serif">Playfair (Serif)</option>
                                            <option value="mono">Space Mono</option>
                                        </select>
                                    </SC>
                                    <SC label="Text Color">
                                        <input type="color" value={styleConfig.color}
                                            onChange={(e) => { setStyleConfig({ ...styleConfig, color: e.target.value }); setActivePreset(null); }}
                                            className="w-full h-10 rounded-lg cursor-pointer"
                                            style={{ border: '1px solid var(--border)', padding: '2px', background: 'rgba(255,255,255,0.05)' }} />
                                    </SC>
                                    <SC label="Background">
                                        <input type="color" value={styleConfig.backgroundColor}
                                            onChange={(e) => { setStyleConfig({ ...styleConfig, backgroundColor: e.target.value }); setActivePreset(null); }}
                                            className="w-full h-10 rounded-lg cursor-pointer"
                                            style={{ border: '1px solid var(--border)', padding: '2px', background: 'rgba(255,255,255,0.05)' }} />
                                    </SC>
                                    <SC label="Animation">
                                        <select value={styleConfig.animation}
                                            onChange={(e) => { setStyleConfig({ ...styleConfig, animation: e.target.value }); setActivePreset(null); }}
                                            className="input-base">
                                            <option value="none">None</option>
                                            <option value="karaoke">Karaoke highlight</option>
                                            <option value="fade">Fade In</option>
                                            <option value="pop">Pop In</option>
                                            <option value="slide">Slide Up</option>
                                        </select>
                                    </SC>
                                    <SC label="Position">
                                        <div className="flex rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                                            {['top', 'middle', 'bottom'].map((pos) => (
                                                <button key={pos} onClick={() => { setStyleConfig({ ...styleConfig, position: pos }); setActivePreset(null); }}
                                                    className="flex-1 py-2 text-xs font-semibold capitalize transition-colors"
                                                    style={{
                                                        background: styleConfig.position === pos ? 'var(--accent)' : 'rgba(255,255,255,0.03)',
                                                        color: styleConfig.position === pos ? 'white' : 'var(--text-muted)',
                                                    }}>{pos}</button>
                                            ))}
                                        </div>
                                    </SC>
                                </div>

                                <SC label="Format">
                                    <div className="flex gap-2">
                                        {[{ k: 'bold', l: 'B', s: { fontWeight: 'bold' } }, { k: 'italic', l: 'I', s: { fontStyle: 'italic' } }, { k: 'uppercase', l: 'AA', s: {} }].map(({ k, l, s }) => (
                                            <button key={k}
                                                onClick={() => { setStyleConfig({ ...styleConfig, [k]: !(styleConfig as any)[k] }); setActivePreset(null); }}
                                                className="px-4 py-2 rounded-lg text-sm transition-colors"
                                                style={{
                                                    ...s,
                                                    background: (styleConfig as any)[k] ? 'rgba(124,58,237,0.3)' : 'rgba(255,255,255,0.05)',
                                                    border: `1px solid ${(styleConfig as any)[k] ? 'var(--accent)' : 'var(--border)'}`,
                                                    color: (styleConfig as any)[k] ? 'var(--accent-light)' : 'var(--text-muted)',
                                                }}>{l}</button>
                                        ))}
                                    </div>
                                </SC>

                                <SC label={`Outline — ${styleConfig.outline}`}>
                                    <input type="range" min={0} max={5} value={styleConfig.outline}
                                        onChange={(e) => { setStyleConfig({ ...styleConfig, outline: +e.target.value }); setActivePreset(null); }}
                                        className="w-full accent-purple-500" />
                                </SC>
                                <SC label={`Shadow — ${styleConfig.shadow}`}>
                                    <input type="range" min={0} max={5} value={styleConfig.shadow}
                                        onChange={(e) => { setStyleConfig({ ...styleConfig, shadow: +e.target.value }); setActivePreset(null); }}
                                        className="w-full accent-purple-500" />
                                </SC>

                                {/* Burn */}
                                <div className="pt-2 space-y-3" style={{ borderTop: '1px solid var(--border)' }}>
                                    <button
                                        onClick={handleBurn}
                                        disabled={isBurning || !serverFilename}
                                        className="w-full py-3 rounded-xl text-white font-bold flex items-center justify-center gap-2 transition-all"
                                        style={{
                                            background: 'linear-gradient(135deg, #dc2626, #ea580c)',
                                            opacity: (isBurning || !serverFilename) ? 0.5 : 1,
                                            cursor: (isBurning || !serverFilename) ? 'not-allowed' : 'pointer',
                                        }}>
                                        {isBurning ? <Loader2 size={18} className="animate-spin" /> : <Flame size={18} />}
                                        {isBurning ? 'Burning…' : 'Burn & Export Video'}
                                    </button>

                                    {/* Progress bar */}
                                    {isBurning && (
                                        <div className="space-y-1.5">
                                            <div className="flex justify-between text-xs" style={{ color: 'var(--text-muted)' }}>
                                                <span>Burning subtitles into video…</span>
                                                <span>{burnProgress}%</span>
                                            </div>
                                            <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                                                <div className="h-full rounded-full transition-all duration-700"
                                                    style={{ width: `${burnProgress}%`, background: 'linear-gradient(90deg, #dc2626, #ea580c)' }} />
                                            </div>
                                        </div>
                                    )}

                                    {/* Preview frame */}
                                    {serverFilename && (
                                        <button
                                            onClick={capturePreview}
                                            disabled={isCapturing}
                                            className="w-full btn-ghost text-xs py-2 flex items-center justify-center gap-2">
                                            {isCapturing ? <Loader2 size={13} className="animate-spin" /> : null}
                                            {isCapturing ? 'Capturing…' : '🎬 Capture Preview Frame'}
                                        </button>
                                    )}

                                    <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
                                        Subtitles are permanently embedded into a new video file.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
