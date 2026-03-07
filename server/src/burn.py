import sys
import json
import os
import subprocess

def hex_to_ass_color(hex_color):
    # Hex is #RRGGBB. ASS expects &HBBGGRR (no alpha here, or &H00BBGGRR)
    # If alpha is needed: &HAABBGGRR. We will assume opacity is handled separately or full opacity.
    hex_color = hex_color.lstrip('#')
    if len(hex_color) == 6:
        r, g, b = hex_color[0:2], hex_color[2:4], hex_color[4:6]
        return f"&H00{b}{g}{r}"
    return "&H00FFFFFF"

def get_font_name(family):
    if family == 'serif': return "Times New Roman"
    if family == 'mono': return "Courier New"
    return "Arial"

def get_font_size(size):
    if size == 'small': return 30
    if size == 'medium': return 50
    if size == 'large': return 80
    if size == 'huge': return 120
    return 50

def generate_ass(transcript, style_config, output_ass_path):
    # 1. Script Info
    ass_lines = [
        "[Script Info]",
        "ScriptType: v4.00+",
        "PlayResX: 1920",
        "PlayResY: 1080",
        "WrapStyle: 0",
        "",
        "[V4+ Styles]",
        "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
    ]

    # 2. Define Style
    font_name = get_font_name(style_config.get('fontFamily', 'sans'))
    font_size = get_font_size(style_config.get('fontSize', 'medium'))
    primary_color = hex_to_ass_color(style_config.get('color', '#FFFFFF'))
    back_color = hex_to_ass_color(style_config.get('backgroundColor', '#000000'))
    
    # ASS BackColor handling
    back_color = back_color.replace("&H00", "&H80") # 50% opacity

    # Style props
    bold = -1 if style_config.get('bold') else 0
    italic = -1 if style_config.get('italic') else 0
    outline = style_config.get('outline', 2)
    shadow = style_config.get('shadow', 2)
    
    # Position -> Alignment
    # 2=Bottom, 5=Middle, 8=Top
    pos = style_config.get('position', 'bottom')
    alignment = 2
    if pos == 'top': alignment = 8
    if pos == 'middle': alignment = 5

    style_line = f"Style: Default,{font_name},{font_size},{primary_color},&H000000FF,&H00000000,{back_color},{bold},{italic},0,0,100,100,0,0,1,{outline},{shadow},{alignment},50,50,50,1"
    ass_lines.append(style_line)
    ass_lines.append("")
    
    # 3. Events
    ass_lines.append("[Events]")
    ass_lines.append("Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text")

    anim = style_config.get('animation', 'none')
    is_karaoke = anim == 'karaoke'
    is_uppercase = style_config.get('uppercase', False)

    # Process transcript into lines/chunks
    current_line_words = []
    line_start = 0.0
    
    for i, word in enumerate(transcript):
        if not current_line_words:
            line_start = word['start']
        
        current_line_words.append(word)

        gap = 0
        if i < len(transcript) - 1:
            gap = transcript[i+1]['start'] - word['end']
        
        current_text_len = sum(len(w.get('word', w.get('text', ''))) + 1 for w in current_line_words)
        
        if gap > 1.0 or current_text_len > 50 or i == len(transcript) - 1:
            line_end = current_line_words[-1]['end']
            
            def format_time(seconds):
                h = int(seconds // 3600)
                m = int((seconds % 3600) // 60)
                s = int(seconds % 60)
                cs = int((seconds * 100) % 100)
                return f"{h}:{m:02d}:{s:02d}.{cs:02d}"

            start_str = format_time(line_start)
            end_str = format_time(line_end)
            
            # Construct Text
            text_content = ""
            
            # Animation Tags
            tags = ""
            if anim == 'fade':
                # Fade in 300ms, fade out 300ms (or 0)
                tags += r"{\fad(300,0)}"
            elif anim == 'pop':
                # Pop In: Scale from 50% to 100% over 200ms
                tags += r"{\fscx50\fscy50\t(0,200,\fscx100\fscy100)}"
            elif anim == 'slide':
                # Slide Up: Use \move. Needs coords.
                # Center X = 960.
                center_x = 960
                # Y depends on alignment/margin.
                # Top (8): MarginV=50 -> Y=50 (approx anchor)
                # Bot (2): MarginV=50 -> Y=1030
                # Mid (5): Y=540
                
                start_y = 1030
                end_y = 1030
                
                if alignment == 8: # Top
                    end_y = 50
                    start_y = 100 # From lower
                elif alignment == 5: # Mid
                    end_y = 540
                    start_y = 590 # From lower
                else: # Bot
                    end_y = 1030
                    start_y = 1080 # From offscreen/lower
                    
                tags += f"{{\\move({center_x},{start_y},{center_x},{end_y},0,300)}}"

            if is_karaoke:
                cursor = line_start
                for w in current_line_words:
                    pre_gap = w['start'] - cursor
                    if pre_gap > 0.01:
                       dur_cs = int(pre_gap * 100)
                       if dur_cs > 0: text_content += f"{{\k{dur_cs}}} "
                    
                    cursor = w['start']
                    dur = w['end'] - w['start']
                    dur_cs = int(dur * 100)
                    word_text = w.get('word', w.get('text', '')).strip()
                    if is_uppercase: word_text = word_text.upper()
                    text_content += f"{{\k{dur_cs}}}{word_text} "
                    cursor = w['end']
            else:
                raw_text = " ".join([w.get('word', w.get('text', '')).strip() for w in current_line_words])
                if is_uppercase: raw_text = raw_text.upper()
                text_content = tags + raw_text

            ass_lines.append(f"Dialogue: 0,{start_str},{end_str},Default,,0,0,0,,{text_content.strip()}")
            current_line_words = []

    with open(output_ass_path, 'w', encoding='utf-8') as f:
        f.write("\n".join(ass_lines))

def main():
    try:
        # Args: input_json_path, uploads_dir
        if len(sys.argv) < 3:
            print(json.dumps({"error": "Missing arguments"}))
            sys.exit(1)

        input_json_path = sys.argv[1]
        uploads_dir = sys.argv[2]

        with open(input_json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        filename = data.get('filename')
        transcript = data.get('transcript')
        style_config = data.get('styleConfig', {})

        if not filename or not transcript:
            print(json.dumps({"error": "Invalid input data"}))
            sys.exit(1)

        input_video_path = os.path.join(uploads_dir, filename)
        ass_filename = f"{os.path.splitext(filename)[0]}.ass"
        ass_path = os.path.join(uploads_dir, ass_filename)
        
        output_filename = f"burned_{filename}"
        output_video_path = os.path.join(uploads_dir, output_filename)

        # 1. Generate ASS
        generate_ass(transcript, style_config, ass_path)

        # 2. Run FFmpeg
        # Limit threads to avoid freezing
        cmd = [
            'ffmpeg', '-y', 
            '-i', input_video_path,
            '-vf', f"ass={ass_path.replace(os.sep, '/')}", # FFmpeg filter expects forward slashes often
            '-c:a', 'copy', # Copy audio
            output_video_path
        ]

        # Use utf-8 encoding for filename handling involved in command
        # Note: on Windows, special characters in path for ASS filter can be tricky.
        # We try to use relative path if CWD is set correctly.
        
        # We need to escape the path for the filter correctly. 
        # Safest is to change directory to uploads_dir and run commands with relative paths.
        
        cwd = uploads_dir
        rel_input = filename
        rel_ass = ass_filename
        rel_output = output_filename
        
        cmd = [
            'ffmpeg', '-y',
            '-i', rel_input,
            '-vf', f"ass={rel_ass}", 
            '-c:a', 'copy',
            rel_output
        ]
        
        # Run
        result = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True)
        
        if result.returncode != 0:
            print(json.dumps({"error": "FFmpeg failed", "details": result.stderr}))
            sys.exit(1)

        print(json.dumps({"outputFile": output_filename}))

    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    main()
