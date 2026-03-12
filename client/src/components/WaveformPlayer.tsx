'use client';

import { useEffect, useRef, useState } from 'react';

interface Props {
    audioSrc: string;
    currentTime: number;
    duration: number;
    subtitleChunks: { start: number; end: number }[];
    onSeek: (time: number) => void;
}

export default function WaveformPlayer({ audioSrc, currentTime, duration, subtitleChunks, onSeek }: Props) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [waveformData, setWaveformData] = useState<Float32Array | null>(null);

    // Decode audio and build amplitude data
    useEffect(() => {
        if (!audioSrc) return;
        let cancelled = false;
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();

        fetch(audioSrc)
            .then((r) => r.arrayBuffer())
            .then((buf) => ctx.decodeAudioData(buf))
            .then((decoded) => {
                if (cancelled) return;
                const raw = decoded.getChannelData(0);
                const samples = 400;
                const blockSize = Math.floor(raw.length / samples);
                const data = new Float32Array(samples);
                for (let i = 0; i < samples; i++) {
                    let sum = 0;
                    for (let j = 0; j < blockSize; j++) {
                        sum += Math.abs(raw[i * blockSize + j] || 0);
                    }
                    data[i] = sum / blockSize;
                }
                setWaveformData(data);
            })
            .catch(() => { /* silently ignore decode errors */ });

        return () => { cancelled = true; ctx.close().catch(() => {}); };
    }, [audioSrc]);

    // Draw waveform + subtitle markers + playhead
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !waveformData || !duration) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const W = canvas.width;
        const H = canvas.height;
        const mid = H / 2;

        ctx.clearRect(0, 0, W, H);

        // Subtitle segment markers (draw first, behind waveform)
        subtitleChunks.forEach((c) => {
            const x1 = (c.start / duration) * W;
            const x2 = (c.end / duration) * W;
            ctx.fillStyle = 'rgba(52,211,153,0.18)';
            ctx.fillRect(x1, 0, Math.max(x2 - x1, 1), H);
        });

        // Waveform bars
        let max = 0.0001;
        for (let i = 0; i < waveformData.length; i++) { if (waveformData[i] > max) max = waveformData[i]; }
        const barW = W / waveformData.length;
        waveformData.forEach((v, i) => {
            const x = i * barW;
            const h = (v / max) * mid * 0.85;
            ctx.fillStyle = 'rgba(124,58,237,0.55)';
            ctx.fillRect(x, mid - h, Math.max(barW - 1, 1), h * 2);
        });

        // Playhead
        if (duration > 0) {
            const px = (currentTime / duration) * W;
            ctx.strokeStyle = '#f87171';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(px, 0);
            ctx.lineTo(px, H);
            ctx.stroke();
        }
    }, [waveformData, currentTime, duration, subtitleChunks]);

    const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const ratio = (e.clientX - rect.left) / rect.width;
        onSeek(ratio * duration);
    };

    return (
        <div className="waveform-container" style={{ borderRadius: 12 }}>
            {!waveformData && (
                <div style={{
                    height: 64,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.75rem',
                    color: 'var(--text-muted)',
                }}>
                    Loading waveform…
                </div>
            )}
            <canvas
                ref={canvasRef}
                width={800}
                height={64}
                onClick={handleClick}
                style={{
                    width: '100%',
                    height: 64,
                    cursor: 'crosshair',
                    display: waveformData ? 'block' : 'none',
                }}
            />
        </div>
    );
}
