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
    // Extended fields
    backgroundOpacity: number;   // 0-100
    backgroundStyle: string;     // 'none'|'box'|'pill'
    outlineColor: string;        // hex
    highlightColor: string;      // hex (karaoke active word)
    maxCharsPerLine: number;     // 20-80
    animationSpeed: string;      // 'slow'|'medium'|'fast'
    outputQuality: string;       // 'draft'|'standard'|'high'
    outputResolution: string;    // 'original'|'720p'|'1080p'
    letterSpacing: number;       // 0-8
    lineHeight: number;          // 1.0-2.5
    textAlign: string;           // 'left'|'center'|'right'
    glowColor: string;           // hex or '' for disabled
};

export type Preset = {
    name: string;
    emoji: string;
    colors: { text: string; bg: string };
    config: Partial<StyleConfig>;
};

export const DEFAULT_STYLE: StyleConfig = {
    fontSize: 'medium', color: '#FFFFFF', backgroundColor: '#000000',
    fontFamily: 'sans', animation: 'karaoke', position: 'bottom',
    bold: false, italic: false, uppercase: false, outline: 2, shadow: 2,
    backgroundOpacity: 70, backgroundStyle: 'box', outlineColor: '#000000',
    highlightColor: '#FFDD00', maxCharsPerLine: 45, animationSpeed: 'medium',
    outputQuality: 'standard', outputResolution: 'original',
    letterSpacing: 0, lineHeight: 1.4, textAlign: 'center', glowColor: '',
};

export const STYLE_PRESETS: Preset[] = [
    {
        name: 'Minimalist',
        emoji: '✦',
        colors: { text: '#FFFFFF', bg: 'transparent' },
        config: {
            color: '#FFFFFF', backgroundColor: '#000000', backgroundStyle: 'none',
            fontFamily: 'sans', fontSize: 'medium', bold: false, italic: false,
            outline: 0, shadow: 3, animation: 'fade', uppercase: false,
            backgroundOpacity: 0, outlineColor: '#000000', highlightColor: '#FFDD00',
            animationSpeed: 'medium', letterSpacing: 0, lineHeight: 1.4,
            textAlign: 'center', glowColor: '',
        },
    },
    {
        name: 'Bold Neon',
        emoji: '⚡',
        colors: { text: '#00FFFF', bg: '#CC00CC' },
        config: {
            color: '#00FFFF', backgroundColor: '#CC00CC', backgroundStyle: 'box',
            fontFamily: 'oswald', fontSize: 'large', bold: true, italic: false,
            outline: 3, shadow: 0, animation: 'pop', uppercase: true,
            backgroundOpacity: 90, outlineColor: '#000000', highlightColor: '#FFFFFF',
            animationSpeed: 'fast', letterSpacing: 2, lineHeight: 1.3,
            textAlign: 'center', glowColor: '',
        },
    },
    {
        name: 'Cinematic',
        emoji: '🎬',
        colors: { text: '#F5F0E0', bg: '#1a1a1a' },
        config: {
            color: '#F5F0E0', backgroundColor: '#1a1a1a', backgroundStyle: 'box',
            fontFamily: 'serif', fontSize: 'large', bold: false, italic: false,
            outline: 0, shadow: 4, animation: 'fade', uppercase: false,
            backgroundOpacity: 80, outlineColor: '#000000', highlightColor: '#FFD700',
            animationSpeed: 'slow', letterSpacing: 1, lineHeight: 1.5,
            textAlign: 'center', glowColor: '',
        },
    },
    {
        name: 'Captionly Pro',
        emoji: '🏆',
        colors: { text: '#FFD700', bg: '#000000' },
        config: {
            color: '#FFD700', backgroundColor: '#000000', backgroundStyle: 'box',
            fontFamily: 'sans', fontSize: 'large', bold: true, italic: false,
            outline: 2, shadow: 2, animation: 'pop', uppercase: false,
            backgroundOpacity: 85, outlineColor: '#000000', highlightColor: '#FFFFFF',
            animationSpeed: 'medium', letterSpacing: 0, lineHeight: 1.4,
            textAlign: 'center', glowColor: '',
        },
    },
    {
        name: 'TikTok',
        emoji: '📱',
        colors: { text: '#FFFFFF', bg: '#000000' },
        config: {
            color: '#FFFFFF', backgroundColor: '#000000', backgroundStyle: 'none',
            fontFamily: 'montserrat', fontSize: 'large', bold: true, italic: false,
            outline: 4, shadow: 0, animation: 'pop', uppercase: false, position: 'bottom',
            backgroundOpacity: 0, outlineColor: '#000000', highlightColor: '#FF0066',
            animationSpeed: 'fast', letterSpacing: 0, lineHeight: 1.3,
            textAlign: 'center', glowColor: '',
        },
    },
    {
        name: 'Podcast',
        emoji: '🎙️',
        colors: { text: '#FFFFFF', bg: '#333333' },
        config: {
            color: '#FFFFFF', backgroundColor: '#2a2a2a', backgroundStyle: 'box',
            fontFamily: 'roboto', fontSize: 'huge', bold: false, italic: false,
            outline: 0, shadow: 2, animation: 'fade', uppercase: true,
            backgroundOpacity: 80, outlineColor: '#000000', highlightColor: '#60a5fa',
            animationSpeed: 'slow', letterSpacing: 3, lineHeight: 1.4,
            textAlign: 'center', glowColor: '',
        },
    },
    {
        name: 'Neon Glow',
        emoji: '🌟',
        colors: { text: '#FF00FF', bg: 'transparent' },
        config: {
            color: '#FF00FF', backgroundColor: '#000000', backgroundStyle: 'none',
            fontFamily: 'oswald', fontSize: 'large', bold: true, italic: false,
            outline: 0, shadow: 0, animation: 'karaoke', uppercase: true,
            backgroundOpacity: 0, outlineColor: '#000000', highlightColor: '#00FFFF',
            animationSpeed: 'medium', letterSpacing: 2, lineHeight: 1.3,
            textAlign: 'center', glowColor: '#FF00FF',
        },
    },
    {
        name: 'Retro',
        emoji: '🕹️',
        colors: { text: '#FFD700', bg: '#1a0a00' },
        config: {
            color: '#FFD700', backgroundColor: '#1a0a00', backgroundStyle: 'pill',
            fontFamily: 'bebas', fontSize: 'large', bold: false, italic: false,
            outline: 2, shadow: 3, animation: 'pop', uppercase: true,
            backgroundOpacity: 90, outlineColor: '#5a2d00', highlightColor: '#FF8800',
            animationSpeed: 'fast', letterSpacing: 3, lineHeight: 1.3,
            textAlign: 'center', glowColor: '',
        },
    },
    {
        name: 'Pastel Soft',
        emoji: '🌸',
        colors: { text: '#2D1B69', bg: '#E8D5FF' },
        config: {
            color: '#2D1B69', backgroundColor: '#E8D5FF', backgroundStyle: 'pill',
            fontFamily: 'nunito', fontSize: 'medium', bold: false, italic: false,
            outline: 0, shadow: 1, animation: 'fade', uppercase: false,
            backgroundOpacity: 90, outlineColor: '#9333ea', highlightColor: '#7c3aed',
            animationSpeed: 'slow', letterSpacing: 0, lineHeight: 1.5,
            textAlign: 'center', glowColor: '',
        },
    },
    {
        name: 'Dark Drama',
        emoji: '🎭',
        colors: { text: '#FFFFFF', bg: '#0a0a0a' },
        config: {
            color: '#FFFFFF', backgroundColor: '#0a0a0a', backgroundStyle: 'box',
            fontFamily: 'bebas', fontSize: 'huge', bold: false, italic: false,
            outline: 0, shadow: 5, animation: 'slide', uppercase: true,
            backgroundOpacity: 95, outlineColor: '#000000', highlightColor: '#FF4444',
            animationSpeed: 'slow', letterSpacing: 5, lineHeight: 1.2,
            textAlign: 'center', glowColor: '',
        },
    },
    {
        name: 'Vlog',
        emoji: '🎥',
        colors: { text: '#FFFF00', bg: 'transparent' },
        config: {
            color: '#FFFFFF', backgroundColor: '#000000', backgroundStyle: 'none',
            fontFamily: 'poppins', fontSize: 'large', bold: true, italic: false,
            outline: 2, shadow: 2, animation: 'karaoke', uppercase: false, position: 'bottom',
            backgroundOpacity: 0, outlineColor: '#000000', highlightColor: '#FFFF00',
            animationSpeed: 'medium', letterSpacing: 0, lineHeight: 1.3,
            textAlign: 'center', glowColor: '',
        },
    },
    {
        name: 'News Ticker',
        emoji: '📰',
        colors: { text: '#FFFFFF', bg: '#CC0000' },
        config: {
            color: '#FFFFFF', backgroundColor: '#CC0000', backgroundStyle: 'box',
            fontFamily: 'roboto', fontSize: 'medium', bold: true, italic: false,
            outline: 0, shadow: 1, animation: 'slide', uppercase: true, position: 'bottom',
            backgroundOpacity: 95, outlineColor: '#000000', highlightColor: '#FFFF00',
            animationSpeed: 'fast', letterSpacing: 1, lineHeight: 1.3,
            textAlign: 'center', glowColor: '',
        },
    },
];

interface Props {
    activePresetName: string | null;
    onSelect: (preset: Preset) => void;
}

const FONT_PREVIEW: Record<string, string> = {
    sans: 'Inter, sans-serif',
    roboto: 'Roboto, sans-serif',
    montserrat: 'Montserrat, sans-serif',
    poppins: 'Poppins, sans-serif',
    nunito: 'Nunito, sans-serif',
    oswald: 'Oswald, sans-serif',
    serif: 'Playfair Display, serif',
    bebas: '"Bebas Neue", sans-serif',
    lobster: 'Lobster, cursive',
    source: '"Source Sans 3", sans-serif',
    dancing: '"Dancing Script", cursive',
    mono: '"Space Mono", monospace',
};

export default function PresetSelector({ activePresetName, onSelect }: Props) {
    return (
        <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 8 }}>
            {STYLE_PRESETS.map((preset) => {
                const isActive = preset.name === activePresetName;
                const bgIsTransparent = preset.colors.bg === 'transparent';
                const fontKey = preset.config.fontFamily || 'sans';

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
                                borderRadius: 10,
                                border: isActive
                                    ? '2px solid var(--accent)'
                                    : '2px solid var(--border)',
                                background: bgIsTransparent
                                    ? 'linear-gradient(135deg, #111122, #1a1a2e)'
                                    : preset.colors.bg,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'border-color 0.15s, transform 0.15s, box-shadow 0.15s',
                                transform: isActive ? 'scale(1.05)' : 'scale(1)',
                                boxShadow: isActive ? '0 0 14px rgba(124,58,237,0.4)' : 'none',
                                overflow: 'hidden',
                                position: 'relative',
                            }}
                        >
                            {/* Emoji badge */}
                            <span style={{
                                position: 'absolute', top: 4, right: 5,
                                fontSize: 11, lineHeight: 1,
                            }}>{preset.emoji}</span>

                            {/* Caption preview */}
                            <div style={{
                                background: preset.config.backgroundStyle === 'none'
                                    ? 'transparent'
                                    : `${preset.colors.bg === 'transparent' ? '#00000080' : preset.colors.bg}cc`,
                                borderRadius: preset.config.backgroundStyle === 'pill' ? 999 : 4,
                                padding: '2px 7px',
                            }}>
                                <span
                                    style={{
                                        color: preset.colors.text,
                                        fontFamily: FONT_PREVIEW[fontKey] || 'sans-serif',
                                        fontWeight: preset.config.bold ? 700 : 400,
                                        fontStyle: preset.config.italic ? 'italic' : 'normal',
                                        fontSize: preset.config.fontSize === 'huge' ? 13
                                            : preset.config.fontSize === 'large' ? 11 : 10,
                                        textTransform: preset.config.uppercase ? 'uppercase' : 'none',
                                        letterSpacing: (preset.config.letterSpacing || 0) > 0
                                            ? `${Math.min(preset.config.letterSpacing || 0, 2)}px`
                                            : 'normal',
                                        textShadow: (preset.config.shadow || 0) > 0
                                            ? '1px 1px 3px rgba(0,0,0,0.8)' : 'none',
                                        WebkitTextStroke: (preset.config.outline || 0) > 0
                                            ? `${Math.min((preset.config.outline || 0) * 0.3, 0.8)}px ${preset.config.outlineColor || 'black'}`
                                            : undefined,
                                        filter: preset.config.glowColor
                                            ? `drop-shadow(0 0 4px ${preset.config.glowColor})`
                                            : undefined,
                                    } as React.CSSProperties}
                                >
                                    Caption
                                </span>
                            </div>
                        </div>

                        {/* Name */}
                        <span style={{
                            fontSize: '0.68rem',
                            fontWeight: 600,
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
