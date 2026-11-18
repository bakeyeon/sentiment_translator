# Finds caption changes, cursor clicks and Translate-button state changes in the demo video.
# Usage: python demo/detect.py demo/sentiment-translator-demo.mp4  -> demo/events.json
import sys, json, subprocess
import numpy as np
from scipy import ndimage

src = sys.argv[1]
W, H, FPS = 960, 600, 30
cmd = ["ffmpeg", "-v", "error", "-i", src, "-vf", f"scale={W}:{H},fps={FPS}", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]
p = subprocess.Popen(cmd, stdout=subprocess.PIPE)
fs = W * H * 3
CUR = np.array([103, 232, 249])     # cursor while pressed (#67e8f9)
BTN = np.array([34, 211, 238])      # Translate button, enabled (#22d3ee)
GRAY = np.array([75, 85, 99])       # Translate button, disabled (#4b5563)
cap_sig, blobs, btn = [], [], []
prev = None
i = 0
while True:
    b = p.stdout.read(fs)
    if len(b) < fs: break
    f = np.frombuffer(b, np.uint8).reshape(H, W, 3).astype(np.int16)
    # caption strip: centre of the caption box
    strip = f[545:573, 380:580].mean(axis=2)
    cap_sig.append(float((strip > 200).mean()))
    # small cyan blobs = pressed cursor
    m = (np.abs(f - CUR).sum(axis=2) < 60)
    lab, n = ndimage.label(m)
    small = []
    if n:
        sizes = ndimage.sum(m, lab, range(1, n + 1))
        for k, s in enumerate(sizes, 1):
            if 40 <= s <= 260:
                ys, xs = np.nonzero(lab == k)
                h, w = np.ptp(ys) + 1, np.ptp(xs) + 1
                if 0.6 < h / w < 1.6 and max(h, w) < 22:
                    small.append((int(xs.mean()), int(ys.mean()), int(s)))
    blobs.append(small)
    # big enabled-cyan vs disabled-gray regions (Translate button)
    btn.append((int((np.abs(f - BTN).sum(axis=2) < 40).sum()), int((np.abs(f - GRAY).sum(axis=2) < 18).sum())))
    i += 1
p.wait()

t = lambda k: round(k / FPS, 2)
# clicks: runs of frames with a small pressed-cursor blob
clicks, k = [], 0
while k < len(blobs):
    if blobs[k]:
        j = k
        while j + 1 < len(blobs) and blobs[j + 1]: j += 1
        x, y, _ = blobs[k][0]
        clicks.append({"t": t(k), "x": x, "y": y, "frames": j - k + 1})
        k = j + 1
    else:
        k += 1
# translate state: gray (disabled) big region appearing / disappearing
busy = [g > 3000 for _, g in btn]
starts = [t(k) for k in range(1, len(busy)) if busy[k] and not busy[k - 1]]
ends = [t(k) for k in range(1, len(busy)) if not busy[k] and busy[k - 1]]
# caption: smoothed on/off from strip text density, then changes
s = np.convolve(np.array(cap_sig), np.ones(5) / 5, mode="same")
json.dump({"frames": i, "clicks": clicks, "busy_start": starts, "busy_end": ends, "cap": [round(v, 4) for v in s.tolist()]},
          open("demo/events.json", "w"))
print("frames", i)
print("clicks", len(clicks), [(c["t"], c["x"], c["y"]) for c in clicks])
print("busy start", starts)
print("busy end", ends)
