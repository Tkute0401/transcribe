// Shared transcript utilities — used by Editor and Dashboard

export const MAX_CHARS = 45;
export const MAX_DURATION = 5.0;
export const GAP_THRESHOLD = 0.8;

export type Word = {
  word?: string;
  text?: string;
  start: number;
  end: number;
  confidence?: number;
  id?: number;
  [key: string]: any;
};

export type Chunk = {
  start: number;
  end: number;
  words: Word[];
  text: string;
};

export function chunkTranscript(
  transcript: Word[],
  maxChars = MAX_CHARS,
  maxDuration = MAX_DURATION,
  gapThreshold = GAP_THRESHOLD
): Chunk[] {
  const chunks: Chunk[] = [];
  let current: Word[] = [];
  let chunkStart = 0;

  transcript.forEach((word, i) => {
    if (current.length === 0) chunkStart = word.start;
    current.push(word);

    const currentLen = current.reduce(
      (a, w) => a + (w.word || w.text || '').length + 1,
      0
    );
    const currentDur = word.end - chunkStart;
    const gap =
      i < transcript.length - 1 ? transcript[i + 1].start - word.end : 0;
    const isLast = i === transcript.length - 1;

    if (
      gap > gapThreshold ||
      currentLen > maxChars ||
      currentDur > maxDuration ||
      isLast
    ) {
      chunks.push({
        start: chunkStart,
        end: word.end,
        words: [...current],
        text: current.map((w) => (w.word || w.text || '').trim()).join(' '),
      });
      current = [];
    }
  });
  return chunks;
}

/** Format seconds to SRT timecode: HH:MM:SS,mmm */
export function fmtSrt(s: number): string {
  const d = new Date(s * 1000);
  return d.toISOString().substr(11, 12).replace('.', ',');
}

/** Format seconds to VTT timecode: HH:MM:SS.mmm */
export function fmtVtt(s: number): string {
  const d = new Date(s * 1000);
  return d.toISOString().substr(11, 12); // already uses '.'
}

/** Trigger browser download of a text file */
export function downloadFile(
  content: string,
  filename: string,
  mimeType = 'text/plain'
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Generate SRT string from chunks (with optional speaker prefixes) */
export function buildSrt(
  chunks: Chunk[],
  speakers?: Record<number, number>
): string {
  let srt = '';
  chunks.forEach((chunk, i) => {
    const speakerPrefix =
      speakers && speakers[i] ? `Speaker ${speakers[i]}: ` : '';
    srt += `${i + 1}\n${fmtSrt(chunk.start)} --> ${fmtSrt(chunk.end)}\n${speakerPrefix}${chunk.text.trim()}\n\n`;
  });
  return srt;
}

/** Generate VTT string from chunks (with optional speaker prefixes) */
export function buildVtt(
  chunks: Chunk[],
  speakers?: Record<number, number>
): string {
  let vtt = 'WEBVTT\n\n';
  chunks.forEach((chunk, i) => {
    const speakerPrefix =
      speakers && speakers[i] ? `Speaker ${speakers[i]}: ` : '';
    vtt += `${i + 1}\n${fmtVtt(chunk.start)} --> ${fmtVtt(chunk.end)}\n${speakerPrefix}${chunk.text.trim()}\n\n`;
  });
  return vtt;
}

// ─── ASS Color helpers ────────────────────────────────────────────────────────

function hexToAss(hex: string): string {
  const h = hex.replace('#', '');
  if (h.length !== 6) return '&H00FFFFFF';
  const r = h.slice(0, 2);
  const g = h.slice(2, 4);
  const b = h.slice(4, 6);
  return `&H00${b}${g}${r}`.toUpperCase();
}

function fmtAssTime(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  const cs = Math.round(((s - Math.floor(s)) * 100));
  return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

type StyleConfig = {
  fontFamily?: string;
  fontSize?: string;
  color?: string;
  backgroundColor?: string;
  bold?: boolean;
  italic?: boolean;
  uppercase?: boolean;
  outline?: number;
  shadow?: number;
  position?: string;
  animation?: string;
};

/** Generate a full ASS subtitle file string (static, no karaoke) */
export function buildAss(chunks: Chunk[], styleConfig: StyleConfig = {}): string {
  const fontMap: Record<string, string> = {
    sans: 'Arial',
    serif: 'Times New Roman',
    mono: 'Courier New',
    oswald: 'Oswald',
    roboto: 'Roboto',
  };
  const sizeMap: Record<string, number> = {
    small: 32,
    medium: 52,
    large: 80,
    huge: 120,
  };

  const fontName = fontMap[styleConfig.fontFamily || 'sans'] || 'Arial';
  const fontSize = sizeMap[styleConfig.fontSize || 'medium'] || 52;
  const primaryColor = hexToAss(styleConfig.color || '#FFFFFF');
  let backColor = hexToAss(styleConfig.backgroundColor || '#000000');
  backColor = backColor.replace('&H00', '&H80');
  const bold = styleConfig.bold ? -1 : 0;
  const italic = styleConfig.italic ? -1 : 0;
  const outline = styleConfig.outline ?? 2;
  const shadow = styleConfig.shadow ?? 2;
  const pos = styleConfig.position || 'bottom';
  const alignment = pos === 'top' ? 8 : pos === 'middle' ? 5 : 2;

  const header = [
    '[Script Info]',
    'ScriptType: v4.00+',
    'PlayResX: 1920',
    'PlayResY: 1080',
    'WrapStyle: 0',
    'ScaledBorderAndShadow: yes',
    '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    `Style: Default,${fontName},${fontSize},${primaryColor},&H000000FF,&H00000000,${backColor},${bold},${italic},0,0,100,100,0,0,1,${outline},${shadow},${alignment},50,50,50,1`,
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
  ].join('\n');

  const anim = styleConfig.animation || 'none';
  const isUppercase = styleConfig.uppercase || false;

  const events = chunks
    .map((chunk) => {
      let text = chunk.text.trim();
      if (isUppercase) text = text.toUpperCase();

      let tags = '';
      if (anim === 'fade') tags = '{\\fad(250,0)}';
      else if (anim === 'pop') tags = '{\\fscx50\\fscy50\\t(0,200,\\fscx100\\fscy100)}';

      return `Dialogue: 0,${fmtAssTime(chunk.start)},${fmtAssTime(chunk.end)},Default,,0,0,0,,${tags}${text}`;
    })
    .join('\n');

  return `${header}\n${events}\n`;
}
