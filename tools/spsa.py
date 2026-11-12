# SPSA tuner for Apx search parameters (UCI spin options), driven by GitHub Actions.
#   spsa.py perturb SHARD SEED  -> prints "PLUS_SPEC MINUS_SPEC" for match2 and writes delta_SHARD.json
#   spsa.py update DIR          -> reads DIR/**/result_*.json, updates spsa/params.json (iter+1)
import glob, json, math, random, re, sys
P = "spsa/params.json"
def load(): return json.load(open(P))
def spec(binary, vals): return binary + "?" + "&".join(f"{k}={v}" for k, v in vals.items())
def clampi(x, lo, hi): return int(max(lo, min(hi, round(x))))
if sys.argv[1] == "perturb":
    shard, seed = int(sys.argv[2]), int(sys.argv[3]); s = load(); rng = random.Random(seed * 1000 + shard)
    k = s["iter"] + 1; ck = 1.0 / k ** 0.101   # standard SPSA c_k decay (gamma = 0.101)
    d = {n: rng.choice((-1, 1)) for n in s["params"]}
    plus = {n: clampi(q["v"] + ck * q["c"] * d[n], q["min"], q["max"]) for n, q in s["params"].items()}
    minus = {n: clampi(q["v"] - ck * q["c"] * d[n], q["min"], q["max"]) for n, q in s["params"].items()}
    json.dump({"delta": d, "ck": ck}, open(f"delta_{shard}.json", "w"))
    print(spec("./base", plus), spec("./base", minus))
elif sys.argv[1] == "update":
    s = load(); k = s["iter"] + 1; ak = s["R"] / (1 + 0.0 * k) ** 0.602
    grad = {n: 0.0 for n in s["params"]}; games = 0; net = 0
    for f in glob.glob(sys.argv[2] + "/**/result_*.json", recursive=True):
        r = json.load(open(f)); res = r["W"] - r["L"]; games += r["W"] + r["L"] + r["D"]; net += res
        for n, dv in r["delta"].items():
            if n in grad: grad[n] += res * dv
    for n, q in s["params"].items():   # theta += R * c * sum(result * delta)  (Fishtest-style, per game result)
        q["v"] = min(q["max"], max(q["min"], q["v"] + ak * q["c"] * grad[n]))
    s["iter"] = k
    s["history"].append({"iter": k, "games": games, "plus_minus_net": net, "v": {n: round(q["v"], 2) for n, q in s["params"].items()}})
    s["history"] = s["history"][-60:]
    json.dump(s, open(P, "w"), indent=1)
    print(f"iter {k}: {games} games, net {net:+d}; " + " ".join(f"{n}={q['v']:.1f}" for n, q in s["params"].items()))
