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

def get_font_name(family):
    if family == 'serif': return "Times New Roman"
    if family == 'mono':  return "Courier New"
    return "Arial"

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

def chunk_transcript(transcript):
    """
    Group word-level transcript into subtitle chunks.
    Rules:
     - Break if gap between words > 0.8s
     - Break if accumulated chars > 45
     - Break if chunk duration > 5s  (NEW: prevents long-lingering subtitles)
    Always returns at least one chunk.
    """
    chunks = []
    current = []
    chunk_start = None
    MAX_CHARS    = 45
    MAX_DURATION = 5.0
    GAP_THRESHOLD = 0.8

    for i, word in enumerate(transcript):
        if not current:
            chunk_start = word['start']

        current.append(word)
        current_text_len = sum(len(w.get('word', w.get('text', ''))) + 1 for w in current)
        current_duration = word['end'] - chunk_start

        # Determine if we should flush this chunk
        gap = 0.0
        if i < len(transcript) - 1:
            gap = transcript[i + 1]['start'] - word['end']

        is_last = (i == len(transcript) - 1)
        should_break = (
            gap > GAP_THRESHOLD or
            current_text_len > MAX_CHARS or
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

    font_name     = get_font_name(style_config.get('fontFamily', 'sans'))
    font_size     = get_font_size(style_config.get('fontSize', 'medium'))
    primary_color = hex_to_ass_color(style_config.get('color', '#FFFFFF'))
    back_color    = hex_to_ass_color(style_config.get('backgroundColor', '#000000'))
    back_color    = back_color.replace("&H00", "&H80")  # 50% opacity box

    bold      = -1 if style_config.get('bold')   else 0
    italic    = -1 if style_config.get('italic') else 0
    outline   = style_config.get('outline', 2)
    shadow    = style_config.get('shadow', 2)
    pos       = style_config.get('position', 'bottom')
    alignment = 2  # bottom-center default
    if pos == 'top':    alignment = 8
    if pos == 'middle': alignment = 5

    style_line = (
        f"Style: Default,{font_name},{font_size},{primary_color},&H000000FF,"
        f"&H00000000,{back_color},{bold},{italic},0,0,100,100,0,0,1,"
        f"{outline},{shadow},{alignment},50,50,50,1"
    )
    ass_lines.append(style_line)
    ass_lines.append("")
    ass_lines.append("[Events]")
    ass_lines.append("Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text")

    anim         = style_config.get('animation', 'none')
    is_karaoke   = (anim == 'karaoke')
    is_uppercase = style_config.get('uppercase', False)

    chunks = chunk_transcript(transcript)

    for chunk in chunks:
        start_str = format_time(chunk['start'])
        end_str   = format_time(chunk['end'])
        words     = chunk['words']

        # --- Animation prefix tags ---
        tags = ""
        if anim == 'fade':
            tags = r"{\fad(250,0)}"
        elif anim == 'pop':
            tags = r"{\fscx50\fscy50\t(0,200,\fscx100\fscy100)}"
        elif anim == 'slide':
            center_x = 960
            if alignment == 8:   start_y, end_y = 100,  50
            elif alignment == 5: start_y, end_y = 590, 540
            else:                start_y, end_y = 1080, 1030
            tags = f"{{\\move({center_x},{start_y},{center_x},{end_y},0,300)}}"

        # --- Build text content ---
        if is_karaoke:
            text_content = ""
            cursor = chunk['start']
            for w in words:
                # Gap before this word (silence/pause)
                pre_gap = w['start'] - cursor
                if pre_gap > 0.01:
                    gap_cs = max(1, int(round(pre_gap * 100)))
                    text_content += f"{{\\k{gap_cs}}}"

                dur_cs   = max(1, int(round((w['end'] - w['start']) * 100)))
                word_text = w.get('word', w.get('text', '')).strip()
                if is_uppercase:
                    word_text = word_text.upper()
                text_content += f"{{\\kf{dur_cs}}}{word_text} "
                cursor = w['end']
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

        # Work relative to uploads dir for cross-platform path safety
        generate_ass(transcript, style_config, os.path.join(uploads_dir, ass_filename))

        cmd = [
            'ffmpeg', '-y',
            '-i',  filename,
            '-vf', f"ass={ass_filename}",
            '-c:v', 'libx264', '-preset', 'fast', '-crf', '23',
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
