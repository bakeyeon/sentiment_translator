# Turns the screencast frames into a constant-30fps phone video with exact timing.
# Each output tick shows the latest screencast frame at or before that moment (times from raw/frames/list.txt).
# Usage: python demo/mobile/frames_to_video.py
import json, pathlib, subprocess

raw = pathlib.Path("demo/mobile/raw")
events = json.load(open(raw / "events.json", encoding="utf-8"))
end = events[-1]["t"]
lines = (raw / "frames" / "list.txt").read_text().splitlines()
frames, t = [], 0.0
for i in range(0, len(lines) - 1, 2):
    name, d = lines[i].split("'")[1], float(lines[i + 1].split()[1])
    frames.append((t, raw / "frames" / name))
    t += d
FPS = 30
out = "demo/mobile/build/phone.mp4"
p = subprocess.Popen(["ffmpeg", "-y", "-v", "error", "-f", "image2pipe", "-framerate", str(FPS), "-c:v", "mjpeg", "-i", "-",
                      "-vf", "format=yuv420p", "-c:v", "libx264", "-preset", "medium", "-crf", "14", out], stdin=subprocess.PIPE)
k, cache_path, cache = 0, None, b""
for n in range(int(end * FPS) + 1):
    now = n / FPS
    while k + 1 < len(frames) and frames[k + 1][0] <= now:
        k += 1
    if frames[k][1] != cache_path:
        cache_path, cache = frames[k][1], frames[k][1].read_bytes()
    p.stdin.write(cache)
p.stdin.close(); p.wait()
print("wrote", out, round(end, 2), "s")
