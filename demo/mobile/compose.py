# Composes the mobile demo: background, phone video in a frame, feature cards with live map zooms,
# captions, and audio (narration, tap / whoosh / ding effects, ducked music).
# Usage: python demo/mobile/compose.py   (after record.mjs, assets.mjs; music from demo/music.py)
import json, subprocess, wave, pathlib
import numpy as np
from scipy import signal

B = pathlib.Path("demo/mobile/build")
T = json.load(open(B / "timeline.json", encoding="utf-8"))
L, END, items, events = T["L"], T["end"], T["items"], T["events"]
S, BZ, C, Z, CAP = L["screen"], L["bezel"], L["card"], L["zoom"], L["caption"]
FPS = 30

# ---------------- video ----------------
inputs = ["-loop", "1", "-framerate", str(FPS), "-t", f"{END:.3f}", "-i", str(B / "bg.png"),
          "-i", str(B / "phone.mp4"),
          "-loop", "1", "-framerate", str(FPS), "-t", f"{END:.3f}", "-i", str(B / "frame.png")]
maps = [it for it in items if it["kind"] == "card" and it.get("rect")]
f = []
f.append(f"[1:v]split={1 + len(maps)}[ph]" + "".join(f"[z{k}]" for k in range(len(maps))))
f.append(f"[ph]scale={S['w']}:{S['h']}:flags=lanczos[phs]")
f.append(f"[0:v][phs]overlay={S['x']}:{S['y']}:eof_action=repeat[v0]")
f.append(f"[v0][2:v]overlay={S['x'] - BZ}:{S['y'] - BZ}[v1]")
cur, idx = "v1", 3
for it in items:
    d = it["end"] - it["start"]
    if d <= 0.2: continue
    inputs += ["-loop", "1", "-framerate", str(FPS), "-t", f"{d:.3f}", "-i", str(B / it["file"])]
    fo = max(0.0, d - 0.3)
    f.append(f"[{idx}:v]format=rgba,fade=in:st=0:d=0.35:alpha=1,fade=out:st={fo:.3f}:d=0.3:alpha=1,setpts=PTS+{it['start']:.3f}/TB[i{idx}]")
    if it["kind"] == "card":
        x, y0 = C["x"], C["y"]
        rise = f"{y0}+28*max(0\\,1-(t-{it['start']:.3f})/0.35)"
        f.append(f"[{cur}][i{idx}]overlay=x={x}:y='{rise}':eval=frame:eof_action=pass[c{idx}]")
    else:
        f.append(f"[{cur}][i{idx}]overlay={CAP['x']}:{CAP['y']}:eof_action=pass[c{idx}]")
    cur = f"c{idx}"
    idx += 1
# live zooms of the open map, cropped from the sharp phone video
for k, it in enumerate(maps):
    r = it["rect"]
    pad = 0
    cx, cy = max(0, round((r["x"] - pad) * 2)), max(0, round((r["y"] - pad) * 2))
    cw, ch = round((r["w"] + 2 * pad) * 2), round((r["h"] + 2 * pad) * 2)
    sc = min(Z["w"] / cw, Z["h"] / ch)
    ow, oh = int(cw * sc) // 2 * 2, int(ch * sc) // 2 * 2
    ox, oy = C["x"] + Z["x"] + (Z["w"] - ow) // 2, C["y"] + Z["y"] + (Z["h"] - oh) // 2
    a, b = it.get("zoomStart", it["start"]) + 0.35, it["end"]
    f.append(f"[z{k}]crop={cw}:{ch}:{cx}:{cy},scale={ow}:{oh}:flags=lanczos,format=rgba,"
             f"fade=in:st={a:.3f}:d=0.3:alpha=1,fade=out:st={max(a, b - 0.3):.3f}:d=0.3:alpha=1[zz{k}]")
    f.append(f"[{cur}][zz{k}]overlay={ox}:{oy}:enable='between(t,{a:.3f},{b:.3f})'[m{k}]")
    cur = f"m{k}"
f.append(f"[{cur}]format=yuv420p[vout]")
(B / "filter.txt").write_text(";\n".join(f), encoding="utf-8")

# ---------------- audio ----------------
SR = 44100
N = int(END * SR) + SR
def read(path):
    with wave.open(str(path)) as w:
        a = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float32) / 32768
        return a.reshape(-1, 2) if w.getnchannels() == 2 else np.repeat(a[:, None], 2, axis=1)
def add(buf, clip, t, gain):
    i = int(t * SR)
    if 0 <= i < len(buf):
        j = min(len(buf), i + len(clip)); buf[i:j] += clip[: j - i] * gain
rng = np.random.default_rng(5)
def stereo(m): return np.stack([m, m], axis=1)
def click():
    t = np.arange(int(0.05 * SR)) / SR
    n = signal.sosfilt(signal.butter(2, 1800, "hp", fs=SR, output="sos"), rng.standard_normal(len(t)) * np.exp(-t * 400) * 0.35)
    return stereo(np.sin(2 * np.pi * 2600 * t) * np.exp(-t * 140) * 0.6 + n)
def whoosh(d=0.55, f0=500, f1=3200):
    L_ = int(d * SR); t = np.arange(L_) / SR
    fr, tt, Zs = signal.stft(rng.standard_normal(L_), SR, nperseg=1024)
    c = f0 * (f1 / f0) ** (tt / d)
    Zs *= np.exp(-0.5 * ((fr[:, None] - c[None, :]) / (0.35 * c[None, :])) ** 2)
    x = signal.istft(Zs, SR, nperseg=1024)[1][:L_] * np.sin(np.pi * np.clip(t / d, 0, 1)) ** 1.5
    return stereo(x / (np.abs(x).max() + 1e-9))
def ding():
    t = np.arange(int(1.1 * SR)) / SR
    def bell(fq, s0):
        s = np.clip(t - s0, 0, None); on = (t >= s0).astype(float)
        return on * (np.sin(2 * np.pi * fq * s) + 0.3 * np.sin(2 * np.pi * 2.76 * fq * s) * np.exp(-s * 6)) * np.exp(-s * 4.5)
    x = bell(1568, 0) + 0.9 * bell(1175, 0.12)
    return stereo(x / np.abs(x).max())
CL, WH, DG = click(), whoosh(), ding()
sfx = np.zeros((N, 2), np.float32)
for e in events:
    if e["type"] in ("tap", "translate"): add(sfx, CL, e["t"], 0.2)
    elif e["type"] == "map": add(sfx, CL, e["t"], 0.2); add(sfx, WH, e["t"] + 0.05, 0.15)
    elif e["type"] == "result": add(sfx, DG, e["t"], 0.12)
dur = json.load(open("demo/mobile/voice/durations.json"))
voice = np.zeros((N, 2), np.float32); speaking = np.zeros(N, bool)
for e in events:
    if e["type"] != "voice": continue
    clip = read(f"demo/mobile/voice/{e['id']}.wav"); clip /= np.abs(clip).max() + 1e-9
    add(voice, clip, e["t"], 0.62)
    speaking[int(e["t"] * SR): int((e["t"] + dur[e["id"]]) * SR)] = True
subprocess.run(["python", "demo/music.py", f"{END + 1:.2f}"], check=True)
music = read("demo/music.wav")[:N]
music = np.pad(music, ((0, max(0, N - len(music))), (0, 0)))
duck = np.convolve(np.where(speaking, 0.38, 1.0), np.ones(int(0.25 * SR)) / int(0.25 * SR), mode="same")
mix = music * duck[:, None] * 0.75 + voice + sfx
mix *= min(1.0, 0.98 / np.abs(mix).max())
with wave.open(str(B / "mix.wav"), "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((mix * 32767).astype(np.int16).tobytes())

# ---------------- render ----------------
out = "demo/mobile/sentiment-translator-mobile-demo.mp4"
cmd = ["ffmpeg", "-y", "-v", "error", *inputs, "-i", str(B / "mix.wav"),
       "-/filter_complex", str(B / "filter.txt"), "-map", "[vout]", "-map", f"{idx}:a",
       "-r", str(FPS), "-ss", f"{T.get('start', 0):.3f}", "-t", f"{END - T.get('start', 0):.3f}", "-c:v", "libx264", "-preset", "medium", "-crf", "18",
       "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", out]
subprocess.run(cmd, check=True)
print("wrote", out, "length", round(END - T.get("start", 0), 1), "s")
