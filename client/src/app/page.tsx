import Upload from '@/components/Upload';

export default function Home() {
    return (
        <main className="min-h-screen flex flex-col items-center" style={{ background: 'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(124,58,237,0.15), transparent)' }}>
            {/* Hero */}
            <section className="w-full max-w-4xl mx-auto px-6 pt-20 pb-12 text-center animate-fade-up">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold mb-6"
                    style={{ background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.3)', color: '#a78bfa' }}>
                    ✨ Powered by OpenAI Whisper
                </div>
                <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight mb-5 leading-tight">
                    Transcribe videos{' '}
                    <span className="gradient-text">in seconds</span>
                </h1>
                <p className="text-lg max-w-xl mx-auto mb-12" style={{ color: 'var(--text-muted)' }}>
                    Upload your audio or video, get accurate word-level captions, then style and export — all in one place.
                </p>
            </section>

            {/* Upload Card */}
            <section className="w-full max-w-2xl mx-auto px-6 pb-24 animate-fade-up" style={{ animationDelay: '0.1s' }}>
                <Upload />
            </section>

            {/* Feature Pills */}
            <section className="w-full max-w-3xl mx-auto px-6 pb-24 flex flex-wrap justify-center gap-3 animate-fade-up" style={{ animationDelay: '0.2s' }}>
                {['Word-level timestamps', 'Bulk upload', 'SRT export', 'Hinglish & mixed languages', 'Burn into video', 'Auto language detect'].map((f) => (
                    <span key={f} className="px-4 py-2 rounded-full text-sm font-medium"
                        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                        {f}
                    </span>
                ))}
            </section>
        </main>
    );
}
