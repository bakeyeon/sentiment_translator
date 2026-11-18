# Generates narration for the mobile demo from demo/mobile/script.json into demo/mobile/voice/.
# Usage: python demo/mobile/tts.py
import json, subprocess, pathlib, wave

base = pathlib.Path("demo/mobile")
cfg = json.load(open(base / "script.json", encoding="utf-8"))
out = base / "voice"; out.mkdir(parents=True, exist_ok=True)
dur = {}
for k, line in cfg["lines"].items():
    mp3, wav = out / f"{k}.mp3", out / f"{k}.wav"
    subprocess.run(["python", "-m", "edge_tts", "--voice", cfg["voice"], "--rate=-2%", "--text", line["say"], "--write-media", str(mp3)], check=True)
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(mp3), "-af",
                    "silenceremove=start_periods=1:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_threshold=-50dB,areverse",
                    "-ar", "44100", "-ac", "1", str(wav)], check=True)
    with wave.open(str(wav)) as w:
        dur[k] = round(w.getnframes() / w.getframerate(), 3)
    print(k, dur[k])
json.dump(dur, open(out / "durations.json", "w"), indent=1)
