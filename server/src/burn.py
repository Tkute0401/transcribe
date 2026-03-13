import sys
import json
import os
import subprocess

def hex_to_ass_color(hex_color):
    """Convert #RRGGBB to ASS &H00BBGGRR format."""
    hex_color = hex_color.lstrip('#')
    if len(hex_color) == 6:
        r, g, b = hex_color[0:2], hex_color[2:4], hex_color[4:6]
        return f"&H00{b}{g}{r}"
    return "&H00FFFFFF"

def hex_to_ass_color_with_alpha(hex_color, opacity_pct):
    """Convert #RRGGBB + opacity (0-100) to ASS &HAARRGGBB format (AA=0 is opaque in ASS)."""
    hex_color = hex_color.lstrip('#')
    if len(hex_color) == 6:
        r, g, b = hex_color[0:2], hex_color[2:4], hex_color[4:6]
        # ASS alpha: 0=opaque, 255=transparent
        alpha = int((100 - opacity_pct) * 2.55)
        alpha = max(0, min(255, alpha))
        return f"&H{alpha:02X}{b}{g}{r}"
    return "&H80000000"

def get_font_name(family):
    font_map = {
        'sans':      'Arial',
        'roboto':    'Roboto',
        'montserrat':'Montserrat',
        'poppins':   'Poppins',
        'nunito':    'Nunito',
        'oswald':    'Oswald',
        'serif':     'Times New Roman',
        'bebas':     'Bebas Neue',
        'lobster':   'Lobster',
        'source':    'Source Sans 3',
        'dancing':   'Dancing Script',
        'mono':      'Courier New',
    }
    return font_map.get(family, 'Arial')

def get_font_size(size):
    if size == 'small':  return 32
    if size == 'medium': return 52
    if size == 'large':  return 80
    if size == 'huge':   return 120
    return 52

def format_time(seconds):
    """Format seconds to ASS h:mm:ss.cs"""
    h  = int(seconds // 3600)
    m  = int((seconds % 3600) // 60)
    s  = int(seconds % 60)
    cs = int(round((seconds - int(seconds)) * 100))
    return f"{h}:{m:02d}:{s:02d}.{cs:02d}"

def chunk_transcript(transcript, max_chars=45):
    """
    Group word-level transcript into subtitle chunks.
    Rules:
     - Break if gap between words > 0.8s
     - Break if accumulated chars > max_chars
     - Break if chunk duration > 5s
    """
    chunks = []
    current = []
    chunk_start = None
    MAX_DURATION = 5.0
    GAP_THRESHOLD = 0.8

    for i, word in enumerate(transcript):
        if not current:
            chunk_start = word['start']

        current.append(word)
        current_text_len = sum(len(w.get('word', w.get('text', ''))) + 1 for w in current)
        current_duration = word['end'] - chunk_start

        gap = 0.0
        if i < len(transcript) - 1:
            gap = transcript[i + 1]['start'] - word['end']

        is_last = (i == len(transcript) - 1)
        should_break = (
            gap > GAP_THRESHOLD or
            current_text_len > max_chars or
            current_duration > MAX_DURATION or
            is_last
        )

        if should_break and current:
            chunks.append({
                'start': chunk_start,
                'end':   word['end'],
                'words': list(current)
            })
            current = []
            chunk_start = None

    return chunks


def generate_ass(transcript, style_config, output_ass_path):
    ass_lines = [
        "[Script Info]",
        "ScriptType: v4.00+",
        "PlayResX: 1920",
        "PlayResY: 1080",
        "WrapStyle: 0",
        "ScaledBorderAndShadow: yes",
        "",
        "[V4+ Styles]",
        "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
    ]

    # ── Typography ──────────────────────────────────────────────────────────────
    font_name     = get_font_name(style_config.get('fontFamily', 'sans'))
    font_size     = get_font_size(style_config.get('fontSize', 'medium'))
    primary_color = hex_to_ass_color(style_config.get('color', '#FFFFFF'))
    bold          = -1 if style_config.get('bold')   else 0
    italic        = -1 if style_config.get('italic') else 0
    outline       = style_config.get('outline', 2)
    shadow        = style_config.get('shadow', 2)
    letter_spacing = style_config.get('letterSpacing', 0)

    # ── Outline color ────────────────────────────────────────────────────────────
    outline_color = hex_to_ass_color(style_config.get('outlineColor', '#000000'))

    # ── Background ───────────────────────────────────────────────────────────────
    bg_style = style_config.get('backgroundStyle', 'box')
    if bg_style == 'none':
        back_color   = "&H00000000"
        border_style = 1  # outline only, no box
    else:
        bg_opacity   = style_config.get('backgroundOpacity', 70)
        back_color   = hex_to_ass_color_with_alpha(style_config.get('backgroundColor', '#000000'), bg_opacity)
        border_style = 3  # opaque box

    # ── Position / alignment ─────────────────────────────────────────────────────
    pos        = style_config.get('position', 'bottom')
    text_align = style_config.get('textAlign', 'center')
    align_col  = {'left': 0, 'center': 1, 'right': 2}.get(text_align, 1)
    base_align = {'bottom': 1, 'middle': 4, 'top': 7}.get(pos, 1)
    alignment  = base_align + align_col

    style_line = (
        f"Style: Default,{font_name},{font_size},{primary_color},&H000000FF,"
        f"{outline_color},{back_color},{bold},{italic},0,0,100,100,{letter_spacing},0,{border_style},"
        f"{outline},{shadow},{alignment},50,50,50,1"
    )
    ass_lines.append(style_line)
    ass_lines.append("")
    ass_lines.append("[Events]")
    ass_lines.append("Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text")

    # ── Animation parameters ─────────────────────────────────────────────────────
    anim         = style_config.get('animation', 'none')
    speed_mult   = {'slow': 2.0, 'medium': 1.0, 'fast': 0.5}.get(style_config.get('animationSpeed', 'medium'), 1.0)
    is_karaoke   = (anim == 'karaoke')
    is_typewriter = (anim == 'typewriter')
    is_uppercase = style_config.get('uppercase', False)

    # Karaoke highlight color
    highlight_color = hex_to_ass_color(style_config.get('highlightColor', '#FFDD00'))

    # ── Chunk transcript ─────────────────────────────────────────────────────────
    max_chars = style_config.get('maxCharsPerLine', 45)
    chunks = chunk_transcript(transcript, max_chars=max_chars)

    for chunk in chunks:
        start_str = format_time(chunk['start'])
        end_str   = format_time(chunk['end'])
        words     = chunk['words']

        # ── Animation prefix tags ──────────────────────────────────────────────
        tags = ""
        if anim == 'fade':
            fade_ms = int(250 * speed_mult)
            tags = f"{{\\fad({fade_ms},0)}}"
        elif anim == 'pop':
            pop_ms = int(200 * speed_mult)
            tags = f"{{\\fscx50\\fscy50\\t(0,{pop_ms},\\fscx100\\fscy100)}}"
        elif anim == 'slide':
            slide_ms = int(300 * speed_mult)
            center_x = 960
            if alignment >= 7:   start_y, end_y = 100,  50
            elif alignment >= 4: start_y, end_y = 590, 540
            else:                start_y, end_y = 1080, 1030
            tags = f"{{\\move({center_x},{start_y},{center_x},{end_y},0,{slide_ms})}}"

        # ── Build text content ─────────────────────────────────────────────────
        if is_karaoke:
            text_content = f"{{\\1c{primary_color}\\2c{highlight_color}}}"
            cursor = chunk['start']
            for w in words:
                pre_gap = w['start'] - cursor
                if pre_gap > 0.01:
                    gap_cs = max(1, int(round(pre_gap * 100)))
                    text_content += f"{{\\k{gap_cs}}}"
                dur_cs    = max(1, int(round((w['end'] - w['start']) * 100)))
                word_text = w.get('word', w.get('text', '')).strip()
                if is_uppercase:
                    word_text = word_text.upper()
                text_content += f"{{\\kf{dur_cs}}}{word_text} "
                cursor = w['end']

        elif is_typewriter:
            text_content = tags
            for w in words:
                word_text = w.get('word', w.get('text', '')).strip()
                if is_uppercase:
                    word_text = word_text.upper()
                dur_cs   = max(1, int(round((w['end'] - w['start']) * 100)))
                char_cnt = max(1, len(word_text))
                char_dur = max(1, dur_cs // char_cnt)
                for ch in word_text:
                    text_content += f"{{\\k{char_dur}}}{ch}"
                text_content += " "

        else:
            raw_text = " ".join(w.get('word', w.get('text', '')).strip() for w in words)
            if is_uppercase:
                raw_text = raw_text.upper()
            text_content = tags + raw_text

        ass_lines.append(
            f"Dialogue: 0,{start_str},{end_str},Default,,0,0,0,,{text_content.strip()}"
        )

    with open(output_ass_path, 'w', encoding='utf-8') as f:
        f.write("\n".join(ass_lines))


def main():
    try:
        if len(sys.argv) < 3:
            print(json.dumps({"error": "Missing arguments: input_json_path uploads_dir"}))
            sys.exit(1)

        input_json_path = sys.argv[1]
        uploads_dir     = sys.argv[2]

        with open(input_json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        filename     = data.get('filename')
        transcript   = data.get('transcript')
        style_config = data.get('styleConfig', {})

        if not filename or not transcript:
            print(json.dumps({"error": "Invalid input data — missing filename or transcript"}))
            sys.exit(1)

        ass_filename    = f"{os.path.splitext(filename)[0]}.ass"
        output_filename = f"burned_{filename}"

        generate_ass(transcript, style_config, os.path.join(uploads_dir, ass_filename))

        # ── Output quality ──────────────────────────────────────────────────────
        crf = {'draft': 28, 'standard': 23, 'high': 18}.get(
            style_config.get('outputQuality', 'standard'), 23
        )

        # ── Output resolution ────────────────────────────────────────────────────
        vf_filter = f"ass={ass_filename}"
        resolution = style_config.get('outputResolution', 'original')
        if resolution == '720p':
            vf_filter = f"scale=-2:720,{vf_filter}"
        elif resolution == '1080p':
            vf_filter = f"scale=-2:1080,{vf_filter}"

        cmd = [
            'ffmpeg', '-y',
            '-i',  filename,
            '-vf', vf_filter,
            '-c:v', 'libx264', '-preset', 'fast', '-crf', str(crf),
            '-c:a', 'aac', '-b:a', '192k',
            output_filename
        ]

        result = subprocess.run(cmd, cwd=uploads_dir, capture_output=True, text=True)

        if result.returncode != 0:
            stderr_tail = result.stderr[-2000:] if result.stderr else ""
            print(json.dumps({"error": "FFmpeg failed", "details": stderr_tail}))
            sys.exit(1)

        print(json.dumps({"outputFile": output_filename}))

    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)


if __name__ == "__main__":
    main()
