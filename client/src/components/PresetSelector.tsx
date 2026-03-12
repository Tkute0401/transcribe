'use client';

export type StyleConfig = {
    fontSize: string;
    color: string;
    backgroundColor: string;
    fontFamily: string;
    animation: string;
    position: string;
    bold: boolean;
    italic: boolean;
    uppercase: boolean;
    outline: number;
    shadow: number;
};

export type Preset = {
    name: string;
    colors: { text: string; bg: string };
    config: Partial<StyleConfig>;
};

export const STYLE_PRESETS: Preset[] = [
    {
        name: 'Minimalist',
        colors: { text: '#FFFFFF', bg: 'transparent' },
        config: { color: '#FFFFFF', backgroundColor: '#000000', fontFamily: 'sans', fontSize: 'medium', bold: false, italic: false, outline: 0, shadow: 3, animation: 'fade', uppercase: false },
    },
    {
        name: 'Bold Neon',
        colors: { text: '#00FFFF', bg: '#CC00CC' },
        config: { color: '#00FFFF', backgroundColor: '#CC00CC', fontFamily: 'sans', fontSize: 'large', bold: true, italic: false, outline: 3, shadow: 0, animation: 'pop', uppercase: true },
    },
    {
        name: 'Cinematic',
        colors: { text: '#F5F0E0', bg: '#1a1a1a' },
        config: { color: '#F5F0E0', backgroundColor: '#1a1a1a', fontFamily: 'serif', fontSize: 'large', bold: false, italic: false, outline: 0, shadow: 4, animation: 'fade', uppercase: false },
    },
    {
        name: 'Captionly Pro',
        colors: { text: '#FFD700', bg: '#000000' },
        config: { color: '#FFD700', backgroundColor: '#000000', fontFamily: 'sans', fontSize: 'large', bold: true, italic: false, outline: 2, shadow: 2, animation: 'pop', uppercase: false },
    },
    {
        name: 'TikTok',
        colors: { text: '#FFFFFF', bg: '#000000' },
        config: { color: '#FFFFFF', backgroundColor: '#000000', fontFamily: 'sans', fontSize: 'large', bold: true, italic: false, outline: 4, shadow: 0, animation: 'pop', uppercase: false, position: 'bottom' },
    },
    {
        name: 'Podcast',
        colors: { text: '#FFFFFF', bg: '#333333' },
        config: { color: '#FFFFFF', backgroundColor: '#333333', fontFamily: 'sans', fontSize: 'huge', bold: false, italic: false, outline: 0, shadow: 2, animation: 'fade', uppercase: true },
    },
];

interface Props {
    activePresetName: string | null;
    onSelect: (preset: Preset) => void;
}

export default function PresetSelector({ activePresetName, onSelect }: Props) {
    return (
        <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 8 }}>
            {STYLE_PRESETS.map((preset) => {
                const isActive = preset.name === activePresetName;
                const bgIsTransparent = preset.colors.bg === 'transparent';

                return (
                    <button
                        key={preset.name}
                        onClick={() => onSelect(preset)}
                        style={{
                            flexShrink: 0,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: 6,
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            padding: 0,
                        }}
                    >
                        {/* Thumbnail */}
                        <div
                            style={{
                                width: 120,
                                height: 68,
                                borderRadius: 8,
                                border: isActive
                                    ? '2px solid var(--accent)'
                                    : '2px solid var(--border)',
                                background: bgIsTransparent
                                    ? 'linear-gradient(135deg, #111122, #1a1a2e)'
                                    : preset.colors.bg,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'border-color 0.15s, transform 0.15s',
                                transform: isActive ? 'scale(1.04)' : 'scale(1)',
                                boxShadow: isActive ? '0 0 12px rgba(124,58,237,0.35)' : 'none',
                                overflow: 'hidden',
                                position: 'relative',
                            }}
                        >
                            <span
                                style={{
                                    color: preset.colors.text,
                                    fontWeight: preset.config.bold ? 700 : 400,
                                    fontStyle: preset.config.italic ? 'italic' : 'normal',
                                    fontSize: preset.config.fontSize === 'huge' ? 13
                                        : preset.config.fontSize === 'large' ? 11
                                            : 10,
                                    textTransform: preset.config.uppercase ? 'uppercase' : 'none',
                                    letterSpacing: preset.config.uppercase ? '0.05em' : 'normal',
                                    textShadow: (preset.config.shadow || 0) > 0
                                        ? `1px 1px 3px rgba(0,0,0,0.8)`
                                        : 'none',
                                    WebkitTextStroke: (preset.config.outline || 0) > 0
                                        ? `${Math.min(preset.config.outline || 0, 1)}px black`
                                        : 'none',
                                    padding: '2px 8px',
                                    borderRadius: 4,
                                    background: bgIsTransparent ? 'transparent' : 'transparent',
                                    zIndex: 1,
                                    position: 'relative',
                                } as React.CSSProperties}
                            >
                                Caption
                            </span>
                        </div>
                        {/* Name */}
                        <span style={{
                            fontSize: '0.7rem',
                            fontWeight: 500,
                            color: isActive ? 'var(--accent-light)' : 'var(--text-muted)',
                            whiteSpace: 'nowrap',
                        }}>
                            {preset.name}
                        </span>
                    </button>
                );
            })}
        </div>
    );
}
