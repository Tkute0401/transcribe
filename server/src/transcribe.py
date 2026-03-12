from faster_whisper import WhisperModel
import sys
import json
import os

def transcribe(audio_path, model_name="base", language=None, initial_prompt=None, task="transcribe"):
    try:
        if not os.path.exists(audio_path):
            print(json.dumps({"error": f"File not found: {audio_path}"}))
            return

        model = WhisperModel(model_name, device="cpu", compute_type="int8")

        sys.stderr.write(f"DEBUG: Language: {language}, Prompt: {initial_prompt}, Task: {task}\n")

        # NOTE: vad_filter=False — we intentionally disable Silero VAD because it
        # aggressively skips quiet/background speech, causing large transcript gaps.
        # To prevent the "repetition loop" bug reported (repeating lines at the end):
        #   - condition_on_previous_text=False  (CRITICAL: disables context loops)
        #   - compression_ratio_threshold=2.2  (stricter check for repetitive output)
        segments, info = model.transcribe(
            audio_path,
            beam_size=5,
            word_timestamps=True,
            language=language,
            initial_prompt=initial_prompt,
            task=task,
            vad_filter=False,
            no_speech_threshold=0.6,
            compression_ratio_threshold=2.2,
            log_prob_threshold=-1.0,
            condition_on_previous_text=False,
            temperature=0,
        )

        sys.stderr.write(f"DEBUG: Detected language: {info.language} (prob={info.language_probability:.2f})\n")

        full_text = ""
        words = []

        for segment in segments:
            sys.stderr.write(f"DEBUG: Segment [{segment.start:.2f}-{segment.end:.2f}] no_speech_prob={segment.no_speech_prob:.2f}: {segment.text[:60]}\n")
            full_text += segment.text

            if segment.words:
                for word in segment.words:
                    words.append({
                        "word": word.word,
                        "start": round(word.start, 3),
                        "end": round(word.end, 3),
                        "confidence": round(word.probability, 3)
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
        print(json.dumps({"error": "Usage: python transcribe.py <audio_path> [model] [language] [prompt] [task]"}))
        sys.exit(1)

    audio_file = sys.argv[1]
    model      = sys.argv[2] if len(sys.argv) > 2 else "base"
    language   = sys.argv[3] if len(sys.argv) > 3 else None
    prompt     = sys.argv[4] if len(sys.argv) > 4 else None
    task       = sys.argv[5] if len(sys.argv) > 5 else "transcribe"

    if language == "auto":
        language = None

    if not prompt or prompt.strip() == "":
        prompt = None

    transcribe(audio_file, model, language, prompt, task)
