// Engine access. Uses Stockfish (WebAssembly, in a worker) when it loads, otherwise a small built-in search.
import { Chess } from './vendor/chess.js';

let w = null, onLine = null, q = Promise.resolve();
export const eng = { name: 'Built-in (basic)', sf: false };

export const ready = new Promise(res => {
  let done = false;
  const fin = ok => {
    if (done) return; done = true;
    if (ok) { eng.sf = true; eng.name = 'Stockfish 10'; }
    else { try { w && w.terminate(); } catch {} w = null; }
    res(eng);
  };
  try {
    w = new Worker('vendor/stockfish.js');
    w.onerror = () => fin(false);
    w.onmessage = e => { const l = String(e.data); if (l === 'uciok') fin(true); else if (onLine) onLine(l); };
    w.postMessage('uci');
    setTimeout(() => fin(false), 6000);
  } catch { fin(false); }
});

/** Analyse a position. Resolves {best, cp, mate, pv, depth}; cp and mate are from White's point of view. */
export function think(fen, o = {}) {
  const job = q.then(() => ready).then(() => run(fen, o));
  q = job.catch(() => {});
  return job;
}
export const stop = () => { if (w) w.postMessage('stop'); };

function run(fen, { depth = 10, skill = 20, onInfo, skip } = {}) {
  if (skip && skip()) return null;
  const g = new Chess(fen), flip = g.turn() === 'w' ? 1 : -1;
  if (g.isGameOver()) return { best: null, cp: g.isCheckmate() ? -flip * 100000 : 0, mate: g.isCheckmate() ? 0 : null, pv: [], depth: 0 };
  if (!w) return new Promise(r => setTimeout(() => r(jsThink(g, flip, skill, depth)), 20));
  return new Promise(res => {
    let info = { cp: 0, mate: null, pv: [], depth: 0 };
    onLine = l => {
      if (l.startsWith('info') && l.includes(' pv ') && !/bound/.test(l)) {
        const d = / depth (\d+)/.exec(l), c = / score cp (-?\d+)/.exec(l), m = / score mate (-?\d+)/.exec(l);
        if (!c && !m) return;
        info = {
          depth: d ? +d[1] : 0, mate: m ? flip * +m[1] : null,
          cp: m ? flip * Math.sign(+m[1]) * (100000 - Math.abs(+m[1]) * 100) : flip * +c[1],
          pv: l.split(' pv ')[1].trim().split(' '),
        };
        if (onInfo) onInfo(info);
      } else if (l.startsWith('bestmove')) { onLine = null; res({ ...info, best: l.split(' ')[1] }); }
    };
    w.postMessage('setoption name Skill Level value ' + skill);
    w.postMessage('position fen ' + fen);
    w.postMessage('go depth ' + depth);
  });
}

/* ---- fallback: alpha-beta over chess.js ---- */
const VAL = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
function evaluate(g) {
  let s = 0; const b = g.board();
  for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
    const p = b[r][f]; if (!p) continue;
    const cd = 3.5 - Math.max(Math.abs(f - 3.5), Math.abs(r - 3.5));
    let v = VAL[p.type];
    if (p.type === 'n' || p.type === 'b') v += cd * 10;
    else if (p.type === 'p') v += (p.color === 'w' ? 6 - r : r - 1) * 2 + (cd > 2 ? 24 : 0);
    else if (p.type === 'k') v -= cd * 8;
    s += p.color === 'w' ? v : -v;
  }
  return g.turn() === 'w' ? s : -s;
}
function search(g, d, a, b) {
  if (d === 0) return evaluate(g);
  const ms = g.moves({ verbose: true });
  if (!ms.length) return g.isCheck() ? -99000 - d : 0;
  ms.sort((x, y) => (VAL[y.captured] || 0) - (VAL[x.captured] || 0));
  for (const m of ms) {
    g.move(m); const v = -search(g, d - 1, -b, -a); g.undo();
    if (v > a) a = v;
    if (a >= b) break;
  }
  return a;
}
function jsThink(g, flip, skill, depth) {
  const d = Math.min(depth, skill < 5 ? 1 : skill < 12 ? 2 : 3);
  let best = null, bs = -Infinity;
  for (const m of g.moves({ verbose: true })) {
    g.move(m);
    const v = (g.isDraw() ? 0 : -search(g, d - 1, -Infinity, -bs + 1)) + Math.random() * 4;
    g.undo();
    if (v > bs) { bs = v; best = m; }
  }
  const u = best.from + best.to + (best.promotion || '');
  return { best: u, cp: flip * Math.round(bs), mate: null, pv: [u], depth: d };
}
