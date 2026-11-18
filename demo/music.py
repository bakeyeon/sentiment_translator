# Generates a soft, original ambient loop (pads + gentle bells) as demo/music.wav.
# Usage: python demo/music.py <seconds>
import sys, wave
import numpy as np

SR = 44100
dur = float(sys.argv[1]) if len(sys.argv) > 1 else 120
bpm = 72
beat = 60 / bpm
bar = 4 * beat
n = int(dur * SR)
t = np.arange(n) / SR
out = np.zeros((n, 2))

def hz(m): return 440 * 2 ** ((m - 69) / 12)

# I – vi – IV – V in C, voiced softly (MIDI notes)
chords = [[48, 55, 64, 67], [45, 52, 60, 64], [41, 48, 57, 60], [43, 50, 59, 62]]

def env(length, a, r):
    e = np.ones(length)
    ai, ri = int(a * SR), int(r * SR)
    e[:ai] = np.linspace(0, 1, ai) ** 2
    e[-ri:] *= np.linspace(1, 0, ri) ** 2
    return e

rng = np.random.default_rng(7)
k = 0
start = 0.0
while start < dur:
    ch = chords[k % 4]
    length = 2 * bar + 1.5
    i0 = int(start * SR); i1 = min(n, i0 + int(length * SR))
    seg = np.arange(i1 - i0) / SR
    e = env(int(length * SR), 1.6, 1.8)[: i1 - i0]
    for j, m in enumerate(ch):
        f = hz(m)
        v = (np.sin(2 * np.pi * f * seg) + 0.35 * np.sin(2 * np.pi * 2 * f * seg + 0.3)
             + 0.6 * np.sin(2 * np.pi * f * 1.004 * seg)) * e * 0.045
        pan = 0.35 + 0.1 * j
        out[i0:i1, 0] += v * (1 - pan); out[i0:i1, 1] += v * pan
    # bells: a sparse arpeggio over the chord, one octave up
    for b in range(8):
        if rng.random() < 0.55:
            m = ch[rng.integers(1, 4)] + 12 + (12 if rng.random() < 0.25 else 0)
            s = start + b * beat
            j0 = int(s * SR)
            if j0 >= n: break
            L = min(n - j0, int(2.4 * SR))
            st = np.arange(L) / SR
            f = hz(m)
            bell = (np.sin(2 * np.pi * f * st) + 0.25 * np.sin(2 * np.pi * 3.01 * f * st)) * np.exp(-st * 2.2) * 0.05
            bell[: int(0.004 * SR)] *= np.linspace(0, 1, int(0.004 * SR))
            p = rng.uniform(0.25, 0.75)
            out[j0:j0 + L, 0] += bell * (1 - p); out[j0:j0 + L, 1] += bell * p
    # soft low root on each bar
    for b in range(2):
        s = start + b * bar; j0 = int(s * SR)
        if j0 >= n: break
        L = min(n - j0, int(bar * SR)); st = np.arange(L) / SR
        bass = np.sin(2 * np.pi * hz(ch[0] - 12) * st) * np.exp(-st * 0.9) * 0.06 * env(L, 0.05, 0.4)
        out[j0:j0 + L] += bass[:, None] * 0.5
    start += 2 * bar
    k += 1

# simple stereo echo for space
d = int(beat * 0.75 * SR)
wet = np.zeros_like(out); wet[d:, 0] = out[:-d, 1]; wet[d:, 1] = out[:-d, 0]
out = out + 0.28 * wet
# fades and normalise
fi, fo = int(2.5 * SR), int(4 * SR)
out[:fi] *= np.linspace(0, 1, fi)[:, None]
out[-fo:] *= np.linspace(1, 0, fo)[:, None]
out *= 0.5 / np.max(np.abs(out))
pcm = (out * 32767).astype(np.int16)
with wave.open("demo/music.wav", "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print("wrote demo/music.wav", round(dur, 1), "s")
