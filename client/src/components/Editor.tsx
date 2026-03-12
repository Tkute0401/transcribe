'use client';

import { useState, useEffect } from 'react';
import { Download, Flame, Edit3, Check, FileText, Wand2, Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const mockTranscript = [
    { id: 1, start: 0, end: 1.5, text: 'Hello' },
    { id: 2, start: 1.5, end: 3.0, text: 'welcome' },
    { id: 3, start: 3.0, end: 4.5, text: 'to' },
    { id: 4, start: 4.5, end: 6.0, text: 'the' },
    { id: 5, start: 6.0, end: 8.0, text: 'transcription.' },
];

export default function Editor({ index }: { index?: number }) {
    const [transcript, setTranscript] = useState<any[]>(mockTranscript);
    const [playedSeconds, setPlayedSeconds] = useState(0);
    const [isClient, setIsClient] = useState(false);
    const [filename, setFilename] = useState('transcript');
    const [serverFilename, setServerFilename] = useState<string | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [activeTab, setActiveTab] = useState<'transcript' | 'style'>('transcript');
    const [isBurning, setIsBurning] = useState(false);
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
        setIsClient(true);
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
            let baseData = {};
            if (stored) baseData = JSON.parse(stored);
            localStorage.setItem('transcription', JSON.stringify({ ...baseData, words: transcript, styleConfig }));
        }
    }, [transcript, styleConfig]);

    const getSubtitleChunks = () => {
        const chunks: { start: number; end: number; text: string }[] = [];
        let currentWords: any[] = [];
        let currentLength = 0;
        let chunkStart = 0;
        transcript.forEach((word, i) => {
            if (currentWords.length === 0) chunkStart = word.start;
            const gap = i > 0 ? word.start - transcript[i - 1].end : 0;
            const wordText = (word.word || word.text || '').toString();
            if (currentWords.length > 0 && (currentLength + wordText.length > 50 || gap > 1.0)) {
                chunks.push({ start: chunkStart, end: transcript[i - 1].end, text: currentWords.map(w => (w.word || w.text || '').toString().trim()).join(' ') });
                currentWords = []; currentLength = 0; chunkStart = word.start;
            }
            currentWords.push(word);
            currentLength += wordText.length + 1;
        });
        if (currentWords.length > 0) chunks.push({ start: chunkStart, end: currentWords[currentWords.length - 1].end, text: currentWords.map(w => (w.word || w.text || '').toString().trim()).join(' ') });
        return chunks;
    };

    const subtitleChunks = getSubtitleChunks();
    const currentChunk = subtitleChunks.find(c => playedSeconds >= c.start && playedSeconds < c.end);
    const currentCaptionText = currentChunk?.text || '';

    const getCaptionStyle = () => {
        const s: any = {
            color: styleConfig.color,
            fontFamily: styleConfig.fontFamily === 'serif' ? 'serif' : styleConfig.fontFamily === 'mono' ? 'monospace' : 'sans-serif',
            fontWeight: styleConfig.bold ? 'bold' : 'normal',
            fontStyle: styleConfig.italic ? 'italic' : 'normal',
            textTransform: styleConfig.uppercase ? 'uppercase' : 'none',
        };
        if (styleConfig.fontSize === 'small') s.fontSize = '1.1rem';
        if (styleConfig.fontSize === 'medium') s.fontSize = '1.4rem';
        if (styleConfig.fontSize === 'large') s.fontSize = '2rem';
        if (styleConfig.fontSize === 'huge') s.fontSize = '2.8rem';
        if (styleConfig.shadow > 0) s.textShadow = `${styleConfig.shadow * 2}px ${styleConfig.shadow * 2}px 4px rgba(0,0,0,0.8)`;
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

    const handleWordChange = (i: number, val: string) => {
        const n = [...transcript];
        if (n[i].word !== undefined) n[i].word = val; else n[i].text = val;
        setTranscript(n);
    };

    const downloadFile = (content: string, name: string, type: string) => {
        const blob = new Blob([content], { type });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = name;
        document.body.appendChild(a); a.click();
        document.body.removeChild(a); URL.revokeObjectURL(url);
    };

    const exportTxt = () => downloadFile(transcript.map(w => (w.word || w.text || '').toString().trim()).join(' '), `${filename}.txt`, 'text/plain');

    const formatTime = (s: number) => new Date(s * 1000).toISOString().substr(11, 12).replace('.', ',');

    const exportSrt = () => {
        let srt = ''; let counter = 1; let cur: any[] = []; let st = transcript[0]?.start || 0;
        transcript.forEach((w, i) => {
            cur.push(w);
            if (w.end - st > 5 || cur.length > 10 || i === transcript.length - 1) {
                srt += `${counter}\n${formatTime(st)} --> ${formatTime(w.end)}\n${cur.map(x => (x.word || x.text || '').toString().trim()).join(' ').trim()}\n\n`;
                counter++; cur = [];
                if (i < transcript.length - 1) st = transcript[i + 1].start;
            }
        });
        downloadFile(srt, `${filename}.srt`, 'text/plain');
    };

    const handleBurn = async () => {
        if (!serverFilename) return;
        setIsBurning(true);
        try {
            const res = await fetch(`${API_URL}/api/burn`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename: serverFilename, transcript, styleConfig }),
            });
            const data = await res.json();
            if (data.outputFile) {
                const a = document.createElement('a');
                a.href = `${API_URL}/uploads/${data.outputFile}`;
                a.download = data.outputFile;
                document.body.appendChild(a); a.click(); document.body.removeChild(a);
            } else {
                alert('Burn failed: ' + (data.error || 'Unknown error'));
            }
        } catch (e) {
            alert('Failed to connect to server.');
        } finally {
            setIsBurning(false);
        }
    };

    const SC = (p: { label: string; children: React.ReactNode }) => (
        <div>
            <label className="block text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--text-muted)' }}>{p.label}</label>
            {p.children}
        </div>
    );

    return (
        <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
            {/* Back link */}
            <div className="max-w-7xl mx-auto px-6 py-4">
                <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm transition-colors"
                    style={{ color: 'var(--text-muted)' }}
                    onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent-light)')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}>
                    <ArrowLeft size={15} /> Back to Dashboard
                </Link>
            </div>

            {/* Title */}
            <div className="max-w-7xl mx-auto px-6 pb-4">
                <h1 className="text-xl font-bold truncate" style={{ color: 'var(--text)' }} title={filename}>{filename}</h1>
            </div>

            {/* Two-column layout */}
            <div className="max-w-7xl mx-auto px-6 pb-12 grid grid-cols-1 lg:grid-cols-5 gap-6">
                {/* Left: Video */}
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
                                {currentCaptionText && (
                                    <div className={`absolute left-0 right-0 text-center pointer-events-none px-6 ${getPositionClass()}`}>
                                        <div
                                            key={currentCaptionText}
                                            className={`inline-block px-4 py-1.5 rounded-lg ${getAnimCls()}`}
                                            style={{ backgroundColor: `${styleConfig.backgroundColor}b0`, ...getCaptionStyle() }}
                                        >
                                            {currentCaptionText}
                                        </div>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="absolute inset-0 flex items-center justify-center text-center p-8" style={{ color: 'var(--text-muted)' }}>
                                <div>
                                    <FileText size={40} className="mx-auto mb-3 opacity-40" />
                                    <p className="text-sm">No video available. Upload a file from the home page.</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Export Actions */}
                    <div className="glass p-4 flex flex-wrap items-center gap-3">
                        <span className="text-xs font-semibold uppercase tracking-wide mr-2" style={{ color: 'var(--text-muted)' }}>Export</span>
                        <button onClick={exportTxt} className="btn-ghost text-xs py-1.5 px-3 flex items-center gap-1.5">
                            <FileText size={12} /> TXT
                        </button>
                        <button onClick={exportSrt} className="btn-ghost text-xs py-1.5 px-3 flex items-center gap-1.5">
                            <Download size={12} /> SRT
                        </button>
                        <div className="flex-1" />
                        <button
                            onClick={() => setIsEditing(v => !v)}
                            className="flex items-center gap-2 text-xs py-1.5 px-3 rounded-lg font-medium transition-all"
                            style={{
                                background: isEditing ? 'rgba(52,211,153,0.15)' : 'rgba(255,255,255,0.05)',
                                border: `1px solid ${isEditing ? 'rgba(52,211,153,0.4)' : 'var(--border)'}`,
                                color: isEditing ? '#34d399' : 'var(--text-muted)',
                            }}
                        >
                            {isEditing ? <Check size={13} /> : <Edit3 size={13} />}
                            {isEditing ? 'Done Editing' : 'Edit Text'}
                        </button>
                    </div>
                </div>

                {/* Right: Panel */}
                <div className="lg:col-span-2 glass flex flex-col overflow-hidden" style={{ maxHeight: '80vh' }}>
                    {/* Tabs */}
                    <div className="flex border-b flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
                        {(['transcript', 'style'] as const).map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className="flex-1 py-3.5 text-sm font-semibold capitalize transition-colors"
                                style={{
                                    color: activeTab === tab ? 'var(--accent-light)' : 'var(--text-muted)',
                                    borderBottom: activeTab === tab ? '2px solid var(--accent)' : '2px solid transparent',
                                }}
                            >
                                {tab === 'style' ? 'Style & Burn' : 'Transcript'}
                            </button>
                        ))}
                    </div>

                    {/* Panel content */}
                    <div className="flex-1 overflow-y-auto p-5">
                        {activeTab === 'transcript' ? (
                            <div className="flex flex-wrap gap-1.5">
                                {transcript.map((word, i) =>
                                    isEditing && editingIndex === i ? (
                                        <input
                                            key={i} autoFocus type="text"
                                            className="w-20 px-1.5 py-0.5 text-sm rounded-lg border outline-none"
                                            style={{ background: 'rgba(124,58,237,0.2)', borderColor: 'var(--accent)', color: 'var(--text)' }}
                                            value={word.word || word.text || ''}
                                            onChange={(e) => handleWordChange(i, e.target.value)}
                                            onKeyDown={(e) => { if (e.key === 'Enter') setEditingIndex(null); }}
                                            onBlur={() => setEditingIndex(null)}
                                        />
                                    ) : (
                                        <span
                                            key={i}
                                            onClick={() => {
                                                if (isEditing) { setEditingIndex(i); }
                                                else {
                                                    const v = document.getElementById('main-video') as HTMLVideoElement;
                                                    if (v) v.currentTime = word.start;
                                                }
                                            }}
                                            className={`cursor-pointer px-2 py-1 rounded-lg text-sm transition-all duration-150 ${isEditing ? 'hover:ring-1 ring-green-400' : ''}`}
                                            style={{
                                                background: playedSeconds >= word.start && playedSeconds < word.end
                                                    ? 'rgba(124,58,237,0.35)' : 'rgba(255,255,255,0.04)',
                                                color: playedSeconds >= word.start && playedSeconds < word.end
                                                    ? 'var(--accent-light)' : 'var(--text)',
                                                border: '1px solid',
                                                borderColor: playedSeconds >= word.start && playedSeconds < word.end
                                                    ? 'rgba(124,58,237,0.4)' : 'transparent',
                                            }}
                                        >
                                            {word.word || word.text}
                                        </span>
                                    )
                                )}
                            </div>
                        ) : (
                            <div className="space-y-5">
                                <div className="grid grid-cols-2 gap-4">
                                    <SC label="Font Size">
                                        <select value={styleConfig.fontSize} onChange={e => setStyleConfig({ ...styleConfig, fontSize: e.target.value })} className="input-base">
                                            <option value="small">Small</option>
                                            <option value="medium">Medium</option>
                                            <option value="large">Large</option>
                                            <option value="huge">Huge</option>
                                        </select>
                                    </SC>
                                    <SC label="Font">
                                        <select value={styleConfig.fontFamily} onChange={e => setStyleConfig({ ...styleConfig, fontFamily: e.target.value })} className="input-base">
                                            <option value="sans">Sans-Serif</option>
                                            <option value="serif">Serif</option>
                                            <option value="mono">Monospace</option>
                                        </select>
                                    </SC>
                                    <SC label="Text Color">
                                        <input type="color" value={styleConfig.color} onChange={e => setStyleConfig({ ...styleConfig, color: e.target.value })}
                                            className="w-full h-10 rounded-lg cursor-pointer" style={{ border: '1px solid var(--border)', padding: '2px', background: 'rgba(255,255,255,0.05)' }} />
                                    </SC>
                                    <SC label="Background">
                                        <input type="color" value={styleConfig.backgroundColor} onChange={e => setStyleConfig({ ...styleConfig, backgroundColor: e.target.value })}
                                            className="w-full h-10 rounded-lg cursor-pointer" style={{ border: '1px solid var(--border)', padding: '2px', background: 'rgba(255,255,255,0.05)' }} />
                                    </SC>
                                    <SC label="Animation">
                                        <select value={styleConfig.animation} onChange={e => setStyleConfig({ ...styleConfig, animation: e.target.value })} className="input-base">
                                            <option value="none">None</option>
                                            <option value="karaoke">Karaoke</option>
                                            <option value="fade">Fade In</option>
                                            <option value="pop">Pop In</option>
                                            <option value="slide">Slide Up</option>
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
                                                    }}>
                                                    {pos}
                                                </button>
                                            ))}
                                        </div>
                                    </SC>
                                </div>

                                {/* Format toggles */}
                                <SC label="Format">
                                    <div className="flex gap-2">
                                        {[
                                            { key: 'bold', label: 'B', style: { fontWeight: 'bold' } },
                                            { key: 'italic', label: 'I', style: { fontStyle: 'italic' } },
                                            { key: 'uppercase', label: 'AA', style: {} },
                                        ].map(({ key, label, style }) => (
                                            <button key={key}
                                                onClick={() => setStyleConfig({ ...styleConfig, [key]: !(styleConfig as any)[key] })}
                                                className="px-4 py-2 rounded-lg text-sm transition-colors"
                                                style={{
                                                    ...style,
                                                    background: (styleConfig as any)[key] ? 'rgba(124,58,237,0.3)' : 'rgba(255,255,255,0.05)',
                                                    border: `1px solid ${(styleConfig as any)[key] ? 'var(--accent)' : 'var(--border)'}`,
                                                    color: (styleConfig as any)[key] ? 'var(--accent-light)' : 'var(--text-muted)',
                                                }}>
                                                {label}
                                            </button>
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
                                <div className="pt-2" style={{ borderTop: '1px solid var(--border)' }}>
                                    <button
                                        onClick={handleBurn}
                                        disabled={isBurning || !serverFilename}
                                        className="w-full py-3 rounded-xl text-white font-bold flex items-center justify-center gap-2 transition-all"
                                        style={{
                                            background: 'linear-gradient(135deg, #dc2626, #ea580c)',
                                            opacity: (isBurning || !serverFilename) ? 0.5 : 1,
                                            cursor: (isBurning || !serverFilename) ? 'not-allowed' : 'pointer',
                                        }}
                                    >
                                        {isBurning ? <Loader2 size={18} className="animate-spin" /> : <Flame size={18} />}
                                        {isBurning ? 'Burning...' : 'Burn & Export Video'}
                                    </button>
                                    <p className="text-xs text-center mt-2" style={{ color: 'var(--text-muted)' }}>
                                        Creates a new video with subtitles permanently embedded.
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
