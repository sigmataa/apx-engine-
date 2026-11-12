# Merge match2 shard outputs: sum pentanomial pair counts, report Elo +- 95% and SPRT LLR (elo0=0, elo1=15, bounds +-2.94).
import glob, math, re, sys
pen = [0] * 5; W = L = D = 0; shards = 0
for f in sorted(glob.glob(sys.argv[1] + "/**/*.txt", recursive=True)):
    last = [l for l in open(f) if "penta[" in l]
    if not last: continue
    m = re.search(r"W(\d+) L(\d+) D(\d+).*penta\[(\d+) (\d+) (\d+) (\d+) (\d+)\]", last[-1]); shards += 1
    W += int(m[1]); L += int(m[2]); D += int(m[3])
    for i in range(5): pen[i] += int(m[4 + i])
n = sum(pen); out = [f"shards {shards}  games {W+L+D}  W{W} L{L} D{D}  penta{pen}"]
if n:
    sc = [0, .25, .5, .75, 1]; pm = sum(p * s for p, s in zip(pen, sc)) / n
    var = sum(p * (s - pm) ** 2 for p, s in zip(pen, sc)) / n
    elo = lambda x: -400 * math.log10(1 / min(max(x, 1e-4), 1 - 1e-4) - 1)
    se = math.sqrt(var / n); out.append(f"elo {elo(pm):+.1f} +- {(elo(pm + 1.96 * se) - elo(pm - 1.96 * se)) / 2:.1f}")
    s0, s1 = 0.5, 1 / (1 + 10 ** (-15 / 400))
    llr = n * (s1 - s0) * (2 * pm - s0 - s1) / (2 * var) if var > 0 else 0
    out.append(f"LLR {llr:.2f} (H1 at +2.94 = gain, H0 at -2.94 = no gain)" + ("  -> H1 ACCEPTED" if llr >= 2.94 else "  -> H0 ACCEPTED" if llr <= -2.94 else "  -> inconclusive"))
print("\n".join(out))
