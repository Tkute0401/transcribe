'use client';

import Upload from '@/components/Upload';
import { useEffect, useState } from 'react';
import { UploadCloud, Mic2, Download, Globe, Layers, Zap, Sparkles, Film } from 'lucide-react';

const DEMO_WORDS = ['Upload', 'your', 'video', 'and', 'get', 'captions'];
const GRADIENTS = [
    'linear-gradient(135deg, #a78bfa 0%, #60a5fa 100%)',
    'linear-gradient(135deg, #f472b6 0%, #a78bfa 100%)',
    'linear-gradient(135deg, #34d399 0%, #60a5fa 100%)',
];

const HOW_IT_WORKS = [
    { num: '1', icon: <UploadCloud size={22} />, title: 'Upload', desc: 'Drop audio or video files — bulk supported' },
    { num: '2', icon: <Mic2 size={22} />, title: 'Transcribe', desc: 'AI generates word-level captions automatically' },
    { num: '3', icon: <Download size={22} />, title: 'Export', desc: 'Style, burn, and export in TXT, SRT, VTT or ASS' },
];

const FEATURE_CARDS = [
    {
        icon: <UploadCloud size={22} />,
        color: '#a78bfa',
        title: 'Bulk Upload',
        desc: 'Process multiple files at once with per-file progress tracking and status badges.',
    },
    {
        icon: <Sparkles size={22} />,
        color: '#60a5fa',
        title: 'AI-Powered',
        desc: 'OpenAI Whisper with 10+ languages, Hinglish support, and custom context hints.',
    },
    {
        icon: <Download size={22} />,
        color: '#34d399',
        title: 'Multi-format Export',
        desc: 'Download as TXT, SRT, VTT, or ASS — or burn subtitles directly into video.',
    },
    {
        icon: <Film size={22} />,
        color: '#fb923c',
        title: 'Custom Styles',
        desc: 'Pick from 6 presets or tune font, color, animation, and position to perfection.',
    },
];

export default function Home() {
    const [gradientIdx, setGradientIdx] = useState(0);
    const [activeWord, setActiveWord] = useState(0);

    // Cycle headline gradient every 3s
    useEffect(() => {
        const t = setInterval(() => setGradientIdx((i) => (i + 1) % GRADIENTS.length), 3000);
        return () => clearInterval(t);
    }, []);

    // Animate demo caption words
    useEffect(() => {
        const t = setInterval(() => setActiveWord((i) => (i + 1) % DEMO_WORDS.length), 600);
        return () => clearInterval(t);
    }, []);

    return (
        <main
            className="min-h-screen flex flex-col items-center"
            style={{ background: 'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(124,58,237,0.15), transparent)' }}
        >
            {/* ── Hero ──────────────────────────────────────────────────── */}
            <section className="w-full max-w-4xl mx-auto px-6 pt-20 pb-12 text-center animate-fade-up">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold mb-6"
                    style={{ background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.3)', color: '#a78bfa' }}>
                    ✨ Powered by OpenAI Whisper
                </div>

                <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight mb-5 leading-tight">
                    Transcribe videos{' '}
                    <span
                        style={{
                            background: GRADIENTS[gradientIdx],
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            backgroundClip: 'text',
                            transition: 'background 0.8s ease',
                            display: 'inline-block',
                        }}
                    >
                        in seconds
                    </span>
                </h1>

                <p className="text-lg max-w-xl mx-auto mb-8" style={{ color: 'var(--text-muted)' }}>
                    Upload your audio or video, get accurate word-level captions, then style and export — all in one place.
                </p>

                {/* Animated caption demo */}
                <div className="inline-flex items-center gap-1.5 px-5 py-3 rounded-2xl mb-12"
                    style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(8px)' }}>
                    {DEMO_WORDS.map((w, i) => (
                        <span key={w}
                            className="px-2 py-0.5 rounded-lg text-sm font-medium transition-all duration-200"
                            style={{
                                background: i === activeWord ? 'rgba(124,58,237,0.4)' : 'transparent',
                                color: i === activeWord ? '#c4b5fd' : 'rgba(255,255,255,0.4)',
                                border: `1px solid ${i === activeWord ? 'rgba(124,58,237,0.5)' : 'transparent'}`,
                                transform: i === activeWord ? 'scale(1.08)' : 'scale(1)',
                            }}>
                            {w}
                        </span>
                    ))}
                </div>
            </section>

            {/* ── Upload Card ───────────────────────────────────────────── */}
            <section className="w-full max-w-2xl mx-auto px-6 pb-16 animate-fade-up" style={{ animationDelay: '0.1s' }}>
                <Upload />
            </section>

            {/* ── Stats Row ─────────────────────────────────────────────── */}
            <section className="w-full max-w-3xl mx-auto px-6 pb-20 animate-fade-up" style={{ animationDelay: '0.15s' }}>
                <div className="flex flex-wrap justify-center gap-4">
                    {[
                        { icon: <Globe size={18} />, label: '10+ Languages' },
                        { icon: <Layers size={18} />, label: '6 Export Formats' },
                        { icon: <Zap size={18} />, label: 'Word-level Accuracy' },
                    ].map(({ icon, label }) => (
                        <div key={label} className="glass flex items-center gap-2.5 px-5 py-3 rounded-2xl">
                            <span style={{ color: 'var(--accent-light)' }}>{icon}</span>
                            <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{label}</span>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── How It Works ──────────────────────────────────────────── */}
            <section className="w-full max-w-3xl mx-auto px-6 pb-20 animate-fade-up" style={{ animationDelay: '0.2s' }}>
                <h2 className="text-2xl font-bold text-center mb-10" style={{ color: 'var(--text)' }}>
                    How it works
                </h2>
                <div className="flex flex-col sm:flex-row items-start gap-0">
                    {HOW_IT_WORKS.map((step, i) => (
                        <div key={step.num} className="flex sm:flex-col flex-row items-start sm:items-center sm:flex-1 gap-4 sm:gap-0">
                            {/* Step content */}
                            <div className="flex sm:flex-col items-center sm:items-center gap-4 sm:gap-3 flex-1">
                                {/* Numbered circle with icon */}
                                <div className="relative flex-shrink-0">
                                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
                                        style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.3), rgba(59,130,246,0.2))', border: '1px solid rgba(124,58,237,0.3)' }}>
                                        <span style={{ color: 'var(--accent-light)' }}>{step.icon}</span>
                                    </div>
                                    <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center"
                                        style={{ background: 'var(--accent)', color: 'white' }}>
                                        {step.num}
                                    </span>
                                </div>
                                <div className="sm:text-center">
                                    <p className="font-semibold text-sm" style={{ color: 'var(--text)' }}>{step.title}</p>
                                    <p className="text-xs mt-1 max-w-[140px]" style={{ color: 'var(--text-muted)' }}>{step.desc}</p>
                                </div>
                            </div>

                            {/* Connector line (between steps) */}
                            {i < HOW_IT_WORKS.length - 1 && (
                                <div className="hidden sm:block flex-1 h-px mx-4 self-start mt-7"
                                    style={{ background: 'var(--border)' }} />
                            )}
                        </div>
                    ))}
                </div>
            </section>

            {/* ── Feature Cards ─────────────────────────────────────────── */}
            <section className="w-full max-w-3xl mx-auto px-6 pb-24 animate-fade-up" style={{ animationDelay: '0.25s' }}>
                <h2 className="text-2xl font-bold text-center mb-8" style={{ color: 'var(--text)' }}>
                    Everything you need
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {FEATURE_CARDS.map(({ icon, color, title, desc }) => (
                        <div key={title}
                            className="glass p-5 hover:scale-[1.02] transition-all duration-200 rounded-2xl"
                            style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.07), rgba(59,130,246,0.04))' }}>
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
                                style={{ background: `${color}18`, border: `1px solid ${color}30` }}>
                                <span style={{ color }}>{icon}</span>
                            </div>
                            <h3 className="font-bold text-sm mb-1" style={{ color: 'var(--text)' }}>{title}</h3>
                            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>{desc}</p>
                        </div>
                    ))}
                </div>
            </section>
        </main>
    );
}
