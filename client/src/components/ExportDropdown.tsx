'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, FileText, Download, Globe, Flame } from 'lucide-react';

export type ExportFormat = 'txt' | 'srt' | 'vtt' | 'ass';

interface Props {
    onExport: (format: ExportFormat) => void;
}

const OPTIONS: { format: ExportFormat; label: string; desc: string; icon: React.ReactNode }[] = [
    { format: 'txt', label: 'TXT', desc: 'Plain text', icon: <FileText size={14} /> },
    { format: 'srt', label: 'SRT', desc: 'SubRip subtitles', icon: <Download size={14} /> },
    { format: 'vtt', label: 'VTT', desc: 'WebVTT format', icon: <Globe size={14} /> },
    { format: 'ass', label: 'ASS', desc: 'Styled subtitles', icon: <Flame size={14} /> },
];

export default function ExportDropdown({ onExport }: Props) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    return (
        <div ref={ref} style={{ position: 'relative' }}>
            <button
                onClick={() => setOpen(v => !v)}
                className="btn-ghost text-xs py-1.5 px-3 flex items-center gap-1.5"
            >
                <Download size={12} />
                Export
                <ChevronDown size={11} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
            </button>

            {open && (
                <div className="dropdown-menu" style={{ bottom: '110%', left: 0 }}>
                    {OPTIONS.map(({ format, label, desc, icon }) => (
                        <button
                            key={format}
                            className="dropdown-menu-item"
                            onClick={() => { onExport(format); setOpen(false); }}
                        >
                            {icon}
                            <span style={{ fontWeight: 600 }}>{label}</span>
                            <span style={{ marginLeft: 'auto', fontSize: '0.75rem', opacity: 0.6 }}>{desc}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
