# gauntlet_fit.py DIR : combine per-opponent results into one rating anchored to the CCRL-listed opponent ratings.
import glob, math, os, re, subprocess, sys
LIST = {"lynx": 3319, "laser": 3338, "weiss": 3380, "leorik": 3403, "stash": 3437, "willow": 3444}
num = den = 0; rows = []
for o, r in LIST.items():
    fs = glob.glob(f"{sys.argv[1]}/g2-{o}-*/*.txt")
    if not fs: continue
    os.makedirs(f"by/{o}", exist_ok=True)
    for f in fs: subprocess.run(["cp", f, f"by/{o}/"])
    out = subprocess.run(["python3", "tools/merge.py", f"by/{o}"], capture_output=True, text=True).stdout
    g = re.search(r"games (\d+)", out); m = re.search(r"elo ([+-][\d.]+) \+- ([\d.]+)", out)
    if not m: continue
    d, e = float(m[1]), float(m[2]); se = e / 1.96; w = 1 / se ** 2
    num += (r + d) * w; den += w; rows.append(f"{o:7s} list {r}  Apx {d:+6.1f} +- {e:4.1f}  -> {r + d:.0f}  ({g[1]} games)")
print("\n".join(rows))
if den: print(f"\nApx combined: {num/den:.0f} +- {1.96/math.sqrt(den):.0f} (95%), anchored to the listed ratings (single-thread, 10s+0.1s)")
