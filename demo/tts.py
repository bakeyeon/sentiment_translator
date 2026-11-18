# Generates the narration lines with edge-tts into demo/voice/<id>.wav and demo/voice/durations.json.
# Usage: python demo/tts.py
import json, subprocess, pathlib, wave

VOICE = "en-US-AvaNeural"
LINES = {
    "intro1": "Meet Sentiment Translator, a prototype from my research.",
    "intro2": "It translates a sentence, and checks whether its feeling survived the trip.",
    "thai": "First, Thai. The particle na adds a soft, caring touch to a question.",
    "nuance": "The Nuance Analysis explains what a literal translation would lose.",
    "map1": "Click the emoji in the corner to open the sentiment map.",
    "map2": "On the translation's map, the dashed line shows how far the feeling moved.",
    "german": "Next, German. Doch mal turns an invitation warm and casual.",
    "map1b": "Let's open the maps again.",
    "japanese": "Then Japanese. Chotto and ne soften a request into a friendly ask.",
    "map1c": "And one more look at the maps.",
    "korean1": "Now, switch the target language to Korean...",
    "korean2": "...and the whole analysis speaks Korean, too.",
    "map1d": "Even the map labels follow along.",
    "outro": "Built on two of my papers on modal particles and emoji. Thanks for watching!",
}
out = pathlib.Path("demo/voice"); out.mkdir(parents=True, exist_ok=True)
dur = {}
for k, text in LINES.items():
    mp3, wav = out / f"{k}.mp3", out / f"{k}.wav"
    subprocess.run(["python", "-m", "edge_tts", "--voice", VOICE, "--rate=-4%", "--text", text, "--write-media", str(mp3)], check=True)
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(mp3), "-af", "silenceremove=start_periods=1:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_threshold=-50dB,areverse",
                    "-ar", "44100", "-ac", "1", str(wav)], check=True)
    with wave.open(str(wav)) as w:
        dur[k] = round(w.getnframes() / w.getframerate(), 3)
    print(k, dur[k])
json.dump(dur, open(out / "durations.json", "w"), indent=1)
