# Lays narration, sound effects and ducked background music onto the existing demo video.
# Timings come from caption, map and Translate-button detection in that video (see detect.py, detect_maps.py).
# Usage: python demo/mix.py  -> demo/sentiment-translator-demo-voice.mp4
import json, wave, subprocess
import numpy as np
from scipy import signal

SR = 44100
VIDEO = "demo/sentiment-translator-demo.mp4"
LEN = float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", VIDEO]))
N = int(LEN * SR)

def read(path):
    with wave.open(path) as w:
        a = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) / 32768
        if w.getnchannels() == 2: a = a.reshape(-1, 2)
        else: a = np.repeat(a[:, None], 2, axis=1)
    return a

def add(buf, clip, t, gain=1.0):
    i = int(t * SR)
    if i >= len(buf): return
    j = min(len(buf), i + len(clip))
    buf[i:j] += clip[: j - i] * gain

# ---------- timings detected in the video ----------
caption_on = [0.57, 4.57, 8.03, 23.87, 29.47, 36.33, 42.07, 62.3, 69.13, 74.97, 89.87, 96.83, 102.5, 114.33, 120.23, 127.03, 133.43]
voice_ids  = ["intro1", "intro2", "thai", "nuance", "map1", "map2", "german", "map1b", None, "japanese", "map1c", None, "korean1", "korean2", "map1d", None, "outro"]
maps = [(30.57, 34.9), (35.17, 40.0), (63.43, 67.73), (68.07, 72.9), (91.07, 95.33), (95.67, 100.47), (121.3, 125.6), (125.87, 130.63)]
translate_click = [13.3, 48.7, 80.13, 106.3]
result = [21.7, 55.17, 82.7, 112.07]

# ---------- sound effects (synthesised) ----------
rng = np.random.default_rng(3)
def stereo(m, pan=0.5): return np.stack([m * (1 - pan) * 1.4, m * pan * 1.4], axis=1)

def click_sfx():
    L = int(0.05 * SR); t = np.arange(L) / SR
    tick = np.sin(2 * np.pi * 2600 * t) * np.exp(-t * 140) * 0.6
    n = rng.standard_normal(L) * np.exp(-t * 400) * 0.35
    n = signal.sosfilt(signal.butter(2, 1800, "hp", fs=SR, output="sos"), n)
    return stereo(tick + n)

def whoosh_sfx(d=0.55, f0=500, f1=3200):
    L = int(d * SR); t = np.arange(L) / SR
    noise = rng.standard_normal(L)
    f, tt, Z = signal.stft(noise, SR, nperseg=1024)
    centre = f0 * (f1 / f0) ** (tt / d)
    Z *= np.exp(-0.5 * ((f[:, None] - centre[None, :]) / (0.35 * centre[None, :])) ** 2)
    _, x = signal.istft(Z, SR, nperseg=1024)
    x = x[:L]
    env = np.sin(np.pi * np.clip(t / d, 0, 1)) ** 1.5
    x = x * env
    x /= np.abs(x).max() + 1e-9
    pan = np.linspace(0.3, 0.7, L)
    return np.stack([x * (1 - pan) * 1.4, x * pan * 1.4], axis=1)

def ding_sfx():
    L = int(1.1 * SR); t = np.arange(L) / SR
    def bell(fq, start):
        s = np.clip(t - start, 0, None)
        on = (t >= start).astype(float)
        return on * (np.sin(2 * np.pi * fq * s) + 0.3 * np.sin(2 * np.pi * 2.76 * fq * s) * np.exp(-s * 6)) * np.exp(-s * 4.5)
    x = bell(1568, 0) + 0.9 * bell(1175, 0.12)
    x[: int(0.003 * SR)] *= np.linspace(0, 1, int(0.003 * SR))
    return stereo(x / np.abs(x).max())

CLICK, WHOOSH, DING = click_sfx(), whoosh_sfx(), ding_sfx()
sfx = np.zeros((N, 2), np.float32)
for c in translate_click: add(sfx, CLICK, c - 0.02, 0.22)
for a, b in maps:
    add(sfx, CLICK, a - 0.12, 0.22)
    add(sfx, WHOOSH, a - 0.1, 0.16)
for k, (a, b) in enumerate(maps):
    if k % 2 == 1: add(sfx, CLICK, b - 0.02, 0.16)   # click away closes the maps
for r in result: add(sfx, DING, r, 0.13)

# ---------- narration, scheduled one after another ----------
dur = json.load(open("demo/voice/durations.json"))
voice = np.zeros((N, 2), np.float32)
speaking = np.zeros(N, bool)
prev_end = 0.0
plan = []
for on, vid in zip(caption_on, voice_ids):
    if not vid: continue
    start = max(on + 0.15, prev_end + 0.3)
    clip = read(f"demo/voice/{vid}.wav")
    clip = clip / (np.abs(clip).max() + 1e-9)
    add(voice, clip, start, 0.62)
    i, j = int(start * SR), min(N, int((start + dur[vid]) * SR))
    speaking[i:j] = True
    prev_end = start + dur[vid]
    plan.append((vid, round(on, 2), round(start, 2), round(prev_end, 2)))

# ---------- music, ducked under the voice ----------
music = read("demo/music.wav")[:N]
if len(music) < N: music = np.pad(music, ((0, N - len(music)), (0, 0)))
duck = np.where(speaking, 0.38, 1.0)
k = int(0.25 * SR)
duck = np.convolve(duck, np.ones(k) / k, mode="same")
music = music * duck[:, None] * 0.75

mix = music + voice + sfx
peak = np.abs(mix).max()
if peak > 0.98: mix *= 0.98 / peak
pcm = (mix * 32767).astype(np.int16)
with wave.open("demo/mix.wav", "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
for row in plan: print(row)
subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", VIDEO, "-i", "demo/mix.wav", "-map", "0:v", "-map", "1:a", "-c:v", "copy",
                "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", "demo/sentiment-translator-demo-voice.mp4"], check=True)
print("wrote demo/sentiment-translator-demo-voice.mp4")
