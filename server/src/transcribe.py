from faster_whisper import WhisperModel
import sys
import json
import os

def transcribe(audio_path, model_name="base", language=None, initial_prompt=None, task="transcribe"):
    try:
        if not os.path.exists(audio_path):
            print(json.dumps({"error": f"File not found: {audio_path}"}))
            return

        # Use CPU
        model = WhisperModel(model_name, device="cpu", compute_type="int8")

        # Pass language if provided
        sys.stderr.write(f"DEBUG: Language: {language}, Prompt: {initial_prompt}, Task: {task}\n")
        
        # Enable VAD filter
        segments, info = model.transcribe(
            audio_path, 
            beam_size=5, 
            word_timestamps=True, 
            language=language, 
            vad_filter=True,
            initial_prompt=initial_prompt,
            task=task
        )
        
        sys.stderr.write(f"DEBUG: Detected language: {info.language} with probability {info.language_probability}\n")

        full_text = ""
        words = []
        for segment in segments:
            full_text += segment.text
            if segment.words:
                for word in segment.words:
                    words.append({
                        "word": word.word,
                        "start": word.start,
                        "end": word.end,
                        "confidence": word.probability
                    })

        output = {
            "text": full_text.strip(),
            "duration": info.duration,
            "words": words,
            "language": info.language 
        }

        print(json.dumps(output))

    except Exception as e:
        sys.stderr.write(f"Error: {str(e)}\n")
        print(json.dumps({"error": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: python transcribe.py <audio_path> [model_name] [language] [prompt] [task]"}))
        sys.exit(1)
    
    audio_file = sys.argv[1]
    model = sys.argv[2] if len(sys.argv) > 2 else "base"
    language = sys.argv[3] if len(sys.argv) > 3 else None
    prompt = sys.argv[4] if len(sys.argv) > 4 else None
    task = sys.argv[5] if len(sys.argv) > 5 else "transcribe"
    
    if language == "auto":
        language = None
        
    # Treat empty string prompt as None
    if prompt == "":
        prompt = None
    
    transcribe(audio_file, model, language, prompt, task)
