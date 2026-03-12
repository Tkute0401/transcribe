'use client';

import { useState, useEffect, useRef } from 'react';
import { Download, Flame, Edit3, Check, FileText, Trash2, Loader2, ArrowLeft, List, Type } from 'lucide-react';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const mockTranscript = [
    { id: 1, start: 0, end: 1.5, word: 'Hello' },
    { id: 2, start: 1.5, end: 3.0, word: 'welcome' },
    { id: 3, start: 3.0, end: 4.5, word: 'to' },
    { id: 4, start: 4.5, end: 6.0, word: 'the' },
    { id: 5, start: 6.0, end: 8.0, word: 'transcription.' },
];

const MAX_CHARS = 45;
const MAX_DURATION = 5.0;
const GAP_THRESHOLD = 0.8;

function chunkTranscript(transcript: any[]) {
    const chunks: { start: number; end: number; words: any[]; text: string }[] = [];
    let current: any[] = [];
    let chunkStart = 0;

    transcript.forEach((word, i) => {
        if (current.length === 0) chunkStart = word.start;
        current.push(word);

        const currentLen = current.reduce((a, w) => a + (w.word || w.text || '').length + 1, 0);
        const currentDur = word.end - chunkStart;
        const gap = i < transcript.length - 1 ? transcript[i + 1].start - word.end : 0;
        const isLast = i === transcript.length - 1;

        if (gap > GAP_THRESHOLD || currentLen > MAX_CHARS || currentDur > MAX_DURATION || isLast) {
            chunks.push({ start: chunkStart, end: word.end, words: [...current], text: current.map(w => (w.word || w.text || '').trim()).join(' ') });
            current = [];
        }
    });
    return chunks;
}

function formatTime(s: number) {
    const m = Math.floor(s / 60);
    const sec = (s % 60).toFixed(2).padStart(5, '0');
    return `${m}:${sec}`;
}

export default function Editor({ index }: { index?: number }) {
    const [transcript, setTranscript] = useState<any[]>(mockTranscript);
    const [playedSeconds, setPlayedSeconds] = useState(0);
    const [filename, setFilename] = useState('transcript');
    const [serverFilename, setServerFilename] = useState<string | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [editingField, setEditingField] = useState<'word' | 'start' | 'end'>('word');
    const [activeTab, setActiveTab] = useState<'transcript' | 'style'>('transcript');
    const [transcriptView, setTranscriptView] = useState<'words' | 'table'>('words');
    const [isBurning, setIsBurning] = useState(false);
    const [burnStatus, setBurnStatus] = useState<string | null>(null);
    const [styleConfig, setStyleConfig] = useState({
        fontSize: 'medium',
        color: '#FFFFFF',
        backgroundColor: '#000000',
        fontFamily: 'sans',
        animation: 'karaoke',
        position: 'bottom',
        bold: false,
        italic: false,
        uppercase: false,
        outline: 2,
        shadow: 2,
    });

    useEffect(() => {
        if (typeof window !== 'undefined') {
            let data: any = null;
            if (index !== undefined && !isNaN(index)) {
                const storedBulk = localStorage.getItem('transcription_bulk');
                if (storedBulk) {
                    const bulkArray = JSON.parse(storedBulk);
                    if (bulkArray[index]) data = bulkArray[index];
                }
            }
            if (!data) {
                const stored = localStorage.getItem('transcription');
                if (stored) data = JSON.parse(stored);
            }
            if (data) {
                if (data.words) setTranscript(data.words);
                if (data.originalFilename) setFilename(data.originalFilename.replace(/\.[^/.]+$/, ''));
                if (data.serverFilename) setServerFilename(data.serverFilename);
                if (data.styleConfig) setStyleConfig(prev => ({ ...prev, ...data.styleConfig }));
            }
        }
    }, [index]);

    useEffect(() => {
        if (typeof window !== 'undefined' && transcript !== mockTranscript) {
            const stored = localStorage.getItem('transcription');
            let base = {};
            if (stored) base = JSON.parse(stored);
            localStorage.setItem('transcription', JSON.stringify({ ...base, words: transcript, styleConfig }));
        }
    }, [transcript, styleConfig]);

    const subtitleChunks = chunkTranscript(transcript);
    const currentChunk = subtitleChunks.find(c => playedSeconds >= c.start && playedSeconds < c.end);

    const getCaptionStyle = () => {
        const s: any = {
            color: styleConfig.color,
            fontFamily: styleConfig.fontFamily === 'serif' ? 'serif' : styleConfig.fontFamily === 'mono' ? 'monospace' : 'sans-serif',
            fontWeight: styleConfig.bold ? 'bold' : 'normal',
            fontStyle: styleConfig.italic ? 'italic' : 'normal',
            textTransform: styleConfig.uppercase ? 'uppercase' : 'none',
        };
        const sizes: any = { small: '1.1rem', medium: '1.4rem', large: '2rem', huge: '2.8rem' };
        s.fontSize = sizes[styleConfig.fontSize] || '1.4rem';
        if (styleConfig.shadow > 0) s.textShadow = `${styleConfig.shadow * 2}px ${styleConfig.shadow * 2}px 4px rgba(0,0,0,0.85)`;
        if (styleConfig.outline > 0) s.WebkitTextStroke = `${styleConfig.outline}px black`;
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

    const updateWord = (i: number, field: string, val: string | number) => {
        const n = [...transcript];
        n[i] = { ...n[i], [field]: field === 'word' ? val : parseFloat(val as string) || 0 };
        setTranscript(n);
    };

    const deleteWord = (i: number) => {
        setTranscript(transcript.filter((_, idx) => idx !== i));
    };

    const downloadFile = (content: string, name: string, type: string) => {
        const blob = new Blob([content], { type });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = name;
        document.body.appendChild(a); a.click();
        document.body.removeChild(a); URL.revokeObjectURL(url);
    };

    const exportTxt = () => {
        const text = transcript.map(w => (w.word || w.text || '').trim()).join(' ');
        downloadFile(text, `${filename}.txt`, 'text/plain');
    };

    const fmtSrt = (s: number) => {
        const d = new Date(s * 1000);
        return d.toISOString().substr(11, 12).replace('.', ',');
    };

    const exportSrt = () => {
        let srt = '';
        subtitleChunks.forEach((chunk, i) => {
            srt += `${i + 1}\n${fmtSrt(chunk.start)} --> ${fmtSrt(chunk.end)}\n${chunk.text.trim()}\n\n`;
        });
        downloadFile(srt, `${filename}.srt`, 'text/plain');
    };

    const handleBurn = async () => {
        if (!serverFilename) return;
        setIsBurning(true);
        setBurnStatus('Generating subtitle file...');
        try {
            setBurnStatus('Sending to server — burning subtitles into video...');
            const res = await fetch(`${API_URL}/api/burn`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename: serverFilename, transcript, styleConfig }),
            });
            const data = await res.json();
            if (data.outputFile) {
                setBurnStatus('Done! Downloading...');
                const a = document.createElement('a');
                a.href = `${API_URL}/uploads/${data.outputFile}`;
                a.download = data.outputFile;
                document.body.appendChild(a); a.click(); document.body.removeChild(a);
                setBurnStatus(null);
            } else {
                setBurnStatus(null);
                alert('Burn failed: ' + (data.error || 'Unknown error'));
            }
        } catch (e) {
            setBurnStatus(null);
            alert('Failed to connect to server.');
        } finally {
            setIsBurning(false);
        }
    };

    const SC = ({ label, children }: { label: string; children: React.ReactNode }) => (
        <div>
            <label className="block text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--text-muted)' }}>{label}</label>
            {children}
        </div>
    );

    // Inline edit input component
    const InlineInput = ({ value, onChange, type = 'text', small = false }: any) => (
        <input
            autoFocus
            type={type}
            step={type === 'number' ? '0.01' : undefined}
            className="px-1.5 py-0.5 text-xs rounded-lg border outline-none"
            style={{
                width: small ? '4rem' : '5rem',
                background: 'rgba(124,58,237,0.2)',
                borderColor: 'var(--accent)',
                color: 'var(--text)',
            }}
            value={value}
            onChange={e => onChange(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') setEditingIndex(null); }}
            onBlur={() => setEditingIndex(null)}
        />
    );

    return (
        <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
            <div className="max-w-7xl mx-auto px-6 py-4">
                <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm transition-colors"
                    style={{ color: 'var(--text-muted)' }}
                    onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent-light)')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}>
                    <ArrowLeft size={15} /> Back to Dashboard
                </Link>
            </div>

            <div className="max-w-7xl mx-auto px-6 pb-4">
                <h1 className="text-xl font-bold truncate" style={{ color: 'var(--text)' }}>{filename}</h1>
                <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>{transcript.length} words · {subtitleChunks.length} subtitle blocks</p>
            </div>

            <div className="max-w-7xl mx-auto px-6 pb-12 grid grid-cols-1 lg:grid-cols-5 gap-6">
                {/* Left: Video + Export bar */}
                <div className="lg:col-span-3 space-y-4">
                    <div className="relative rounded-2xl overflow-hidden aspect-video" style={{ background: '#000' }}>
                        {serverFilename ? (
                            <>
                                <video
                                    id="main-video"
                                    src={`${API_URL}/uploads/${serverFilename}`}
                                    className="w-full h-full object-contain"
                                    controls
                                    onTimeUpdate={(e) => setPlayedSeconds(e.currentTarget.currentTime)}
                                />
                                {currentChunk && (
                                    <div key={currentChunk.text} className={`absolute left-0 right-0 text-center pointer-events-none px-6 ${getPositionClass()}`}>
                                        <div
                                            className={`inline-block px-4 py-1.5 rounded-lg ${getAnimCls()}`}
                                            style={{ backgroundColor: `${styleConfig.backgroundColor}b0`, ...getCaptionStyle() }}
                                        >
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

                    {/* Export bar */}
                    <div className="glass p-4 flex flex-wrap items-center gap-3">
                        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Export</span>
                        <button onClick={exportTxt} className="btn-ghost text-xs py-1.5 px-3 flex items-center gap-1.5">
                            <FileText size={12} /> TXT
                        </button>
                        <button onClick={exportSrt} className="btn-ghost text-xs py-1.5 px-3 flex items-center gap-1.5">
                            <Download size={12} /> SRT
                        </button>
                        <div className="flex-1" />
                        <button
                            onClick={() => { setIsEditing(v => !v); setEditingIndex(null); }}
                            className="flex items-center gap-2 text-xs py-1.5 px-3 rounded-lg font-medium transition-all"
                            style={{
                                background: isEditing ? 'rgba(52,211,153,0.15)' : 'rgba(255,255,255,0.05)',
                                border: `1px solid ${isEditing ? 'rgba(52,211,153,0.4)' : 'var(--border)'}`,
                                color: isEditing ? '#34d399' : 'var(--text-muted)',
                            }}
                        >
                            {isEditing ? <Check size={13} /> : <Edit3 size={13} />}
                            {isEditing ? 'Done Editing' : 'Edit Mode'}
                        </button>
                    </div>
                </div>

                {/* Right: Panel */}
                <div className="lg:col-span-2 glass flex flex-col overflow-hidden" style={{ maxHeight: '82vh' }}>
                    {/* Tabs */}
                    <div className="flex border-b flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
                        {(['transcript', 'style'] as const).map(tab => (
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

                    {/* Transcript sub-tabs */}
                    {activeTab === 'transcript' && (
                        <div className="flex items-center gap-2 px-4 pt-3 pb-1 flex-shrink-0">
                            {(['words', 'table'] as const).map(v => (
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
                            {isEditing && (
                                <span className="ml-auto text-xs" style={{ color: 'var(--text-muted)' }}>
                                    Click word to edit · ✕ to delete
                                </span>
                            )}
                        </div>
                    )}

                    {/* Panel content */}
                    <div className="flex-1 overflow-y-auto p-4">
                        {activeTab === 'transcript' ? (
                            transcriptView === 'words' ? (
                                /* Word pills view */
                                <div className="flex flex-wrap gap-1.5">
                                    {transcript.map((word, i) => {
                                        const isActive = playedSeconds >= word.start && playedSeconds < word.end;
                                        const wordText = word.word || word.text || '';

                                        if (isEditing && editingIndex === i) {
                                            return (
                                                <div key={i} className="flex flex-col gap-1 p-2 rounded-xl" style={{ background: 'rgba(124,58,237,0.15)', border: '1px solid var(--accent)' }}>
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
                                                        if (isEditing) { setEditingIndex(i); }
                                                        else {
                                                            const v = document.getElementById('main-video') as HTMLVideoElement;
                                                            if (v) v.currentTime = word.start;
                                                        }
                                                    }}
                                                    className="cursor-pointer px-2 py-1 rounded-lg text-sm transition-all duration-150"
                                                    style={{
                                                        background: isActive ? 'rgba(124,58,237,0.35)' : 'rgba(255,255,255,0.04)',
                                                        color: isActive ? 'var(--accent-light)' : 'var(--text)',
                                                        border: `1px solid ${isActive ? 'rgba(124,58,237,0.4)' : 'transparent'}`,
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
                                /* Subtitle chunks table view */
                                <div className="space-y-2">
                                    {subtitleChunks.map((chunk, i) => (
                                        <div key={i} className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)' }}>
                                            <div className="flex items-center gap-2 mb-1.5">
                                                <span className="text-xs font-bold rounded px-1.5 py-0.5"
                                                    style={{ background: 'rgba(124,58,237,0.2)', color: 'var(--accent-light)' }}>
                                                    #{i + 1}
                                                </span>
                                                <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                                                    {formatTime(chunk.start)} → {formatTime(chunk.end)}
                                                </span>
                                                <span className="ml-auto text-xs" style={{ color: 'var(--text-muted)' }}>
                                                    {(chunk.end - chunk.start).toFixed(1)}s
                                                </span>
                                            </div>
                                            <p className="text-sm" style={{ color: 'var(--text)' }}>{chunk.text}</p>
                                        </div>
                                    ))}
                                </div>
                            )
                        ) : (
                            /* Style & Burn tab */
                            <div className="space-y-5">
                                <div className="grid grid-cols-2 gap-4">
                                    <SC label="Font Size">
                                        <select value={styleConfig.fontSize} onChange={e => setStyleConfig({ ...styleConfig, fontSize: e.target.value })} className="input-base">
                                            <option value="small">Small</option><option value="medium">Medium</option>
                                            <option value="large">Large</option><option value="huge">Huge</option>
                                        </select>
                                    </SC>
                                    <SC label="Font">
                                        <select value={styleConfig.fontFamily} onChange={e => setStyleConfig({ ...styleConfig, fontFamily: e.target.value })} className="input-base">
                                            <option value="sans">Sans-Serif</option><option value="serif">Serif</option><option value="mono">Monospace</option>
                                        </select>
                                    </SC>
                                    <SC label="Text Color">
                                        <input type="color" value={styleConfig.color} onChange={e => setStyleConfig({ ...styleConfig, color: e.target.value })}
                                            className="w-full h-10 rounded-lg cursor-pointer"
                                            style={{ border: '1px solid var(--border)', padding: '2px', background: 'rgba(255,255,255,0.05)' }} />
                                    </SC>
                                    <SC label="Background">
                                        <input type="color" value={styleConfig.backgroundColor} onChange={e => setStyleConfig({ ...styleConfig, backgroundColor: e.target.value })}
                                            className="w-full h-10 rounded-lg cursor-pointer"
                                            style={{ border: '1px solid var(--border)', padding: '2px', background: 'rgba(255,255,255,0.05)' }} />
                                    </SC>
                                    <SC label="Animation">
                                        <select value={styleConfig.animation} onChange={e => setStyleConfig({ ...styleConfig, animation: e.target.value })} className="input-base">
                                            <option value="none">None</option><option value="karaoke">Karaoke highlight</option>
                                            <option value="fade">Fade In</option><option value="pop">Pop In</option><option value="slide">Slide Up</option>
                                        </select>
                                    </SC>
                                    <SC label="Position">
                                        <div className="flex rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                                            {['top', 'middle', 'bottom'].map(pos => (
                                                <button key={pos} onClick={() => setStyleConfig({ ...styleConfig, position: pos })}
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
                                            <button key={k} onClick={() => setStyleConfig({ ...styleConfig, [k]: !(styleConfig as any)[k] })}
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
                                        onChange={e => setStyleConfig({ ...styleConfig, outline: +e.target.value })}
                                        className="w-full accent-purple-500" />
                                </SC>
                                <SC label={`Shadow — ${styleConfig.shadow}`}>
                                    <input type="range" min={0} max={5} value={styleConfig.shadow}
                                        onChange={e => setStyleConfig({ ...styleConfig, shadow: +e.target.value })}
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
                                        {isBurning ? 'Burning...' : 'Burn & Export Video'}
                                    </button>

                                    {burnStatus && (
                                        <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs"
                                            style={{ background: 'rgba(234,88,12,0.12)', border: '1px solid rgba(234,88,12,0.3)', color: '#fdba74' }}>
                                            <Loader2 size={12} className="animate-spin flex-shrink-0" />
                                            {burnStatus}
                                        </div>
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
