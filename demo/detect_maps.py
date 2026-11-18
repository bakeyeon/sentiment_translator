# Finds when a sentiment map is open (its red-to-green bar is visible) in the demo video.
# Usage: python demo/detect_maps.py demo/sentiment-translator-demo.mp4
import sys, subprocess, json
import numpy as np

W, H, FPS = 960, 600, 30
p = subprocess.Popen(["ffmpeg", "-v", "error", "-i", sys.argv[1], "-vf", f"scale={W}:{H},fps={FPS}", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], stdout=subprocess.PIPE)
fs = W * H * 3
vis = []
while True:
    b = p.stdout.read(fs)
    if len(b) < fs: break
    f = np.frombuffer(b, np.uint8).reshape(H, W, 3).astype(np.int16)
    r, g, bl = f[..., 0], f[..., 1], f[..., 2]
    red = (r > 190) & (g < 110) & (bl < 110)
    grn = (g > 160) & (r < 120) & (bl < 130)
    yel = (r > 200) & (g > 170) & (bl < 80)
    rows = np.nonzero(red.any(1) & grn.any(1) & yel.any(1))[0]
    hit = False
    for y in rows:
        xr, xg, xy = np.nonzero(red[y])[0], np.nonzero(grn[y])[0], np.nonzero(yel[y])[0]
        if xr.min() < xy.mean() < xg.max() and 60 < xg.max() - xr.min() < 220:
            hit = True; break
    vis.append(hit)
p.wait()
v = np.array(vis)
# smooth single-frame dropouts
v = np.convolve(v.astype(float), np.ones(5) / 5, mode="same") > 0.4
runs, k = [], 0
while k < len(v):
    if v[k]:
        j = k
        while j + 1 < len(v) and v[j + 1]: j += 1
        runs.append((round(k / FPS, 2), round(j / FPS, 2)))
        k = j + 1
    else:
        k += 1
print(len(runs), runs)
json.dump(runs, open("demo/map_runs.json", "w"))
