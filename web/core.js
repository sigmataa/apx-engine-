// Shared state, helpers and UI building blocks used by every screen.
import { Chess } from './vendor/chess.js';
import { cfg, pieceUrl } from './board.js';
import LESSONS from './lessons.js';
export { Chess, LESSONS, pieceUrl };

export const $ = (s, r = document) => r.querySelector(s);
export const main = $('#main');
export const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const sleep = ms => new Promise(r => setTimeout(r, ms));
export const uciMove = u => ({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
export const toUci = m => m.from + m.to + (m.promotion || '');
export const side = c => (c === 'w' ? 'White' : 'Black');
export const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

/* ---------- icons: inline SVG, filled unless prefixed with "s:" (stroked) ---------- */
const IC = {
  home: 'M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z',
  pawn: 'M12 2a3.5 3.5 0 00-2.2 6.2C8.6 9 8 9.7 8 10.5h1.6c-.3 3-1.6 5-3.1 6.5V19h11v-2c-1.5-1.5-2.8-3.5-3.1-6.5H16c0-.8-.6-1.5-1.8-2.3A3.5 3.5 0 0012 2zM5 20h14v2H5z',
  puzzle: 'M20.5 11H19V7a2 2 0 00-2-2h-4V3.5a2.5 2.5 0 00-5 0V5H4a2 2 0 00-2 2v3.8h1.5a2.7 2.7 0 010 5.4H2V20a2 2 0 002 2h3.8v-1.5a2.7 2.7 0 015.4 0V22H17a2 2 0 002-2v-4h1.5a2.5 2.5 0 000-5z',
  learn: 'M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82zM12 3L1 9l11 6 9-4.91V17h2V9L12 3z',
  play: 'M3 3h18v18H3zM5 5v7h7V5zM12 12v7h7v-7z',
  more: 'M3 5.5h18V8H3zM3 10.75h18v2.5H3zM3 16h18v2.5H3z',
  stats: 'M4 20V10h4v10zM10 20V4h4v16zM16 20v-7h4v7z',
  star: 'M12 2l3 6.5 7 .8-5.2 4.8 1.5 7L12 17.6 5.7 21.1l1.5-7L2 9.3l7-.8z',
  brush: 'M20.7 5.6l-2.3-2.3a1 1 0 00-1.4 0L8 12.3l3.7 3.7 9-9a1 1 0 000-1.4zM6.5 13.5A3.5 3.5 0 003 17c0 1.3-1.2 2-2 2 .9 1.2 2.5 2 4 2a4 4 0 004-4 3.5 3.5 0 00-2.5-3.5z',
  gear: 'M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 00.12-.61l-1.92-3.32a.49.49 0 00-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.48.48 0 00-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.48.48 0 00-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 00-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6A3.6 3.6 0 1112 8.4a3.6 3.6 0 010 7.2z',
  compass: 'M12 2a10 10 0 100 20 10 10 0 000-20zm3.5 6.5l-2 5-5 2 2-5z',
  crown: 'M5 17h14l1.5-9-4.5 3.5L12 5l-4 6.5L3.5 8zM5 18.5h14V21H5z',
  target: 'M12 2a10 10 0 100 20 10 10 0 000-20zm0 4a6 6 0 110 12 6 6 0 010-12zm0 4a2 2 0 100 4 2 2 0 000-4z',
  bulb: 'M9 21h6v-1.5H9zM12 2a7 7 0 00-4 12.7V18h8v-3.3A7 7 0 0012 2z',
  flame: 'M12 2c1 4.5 6 6 6 11.5a6 6 0 01-12 0c0-2.3 1.2-3.7 2.3-4.8 0 2.3 1 3.3 2 3.3.3-3.3-.8-5.5 1.7-10z',
  bolt: 'M13 2L4 14h6l-1 8 9-12h-6z',
  cal: 'M7 2v2H4v18h16V4h-3V2h-2v2H9V2zM6 9h12v11H6z',
  list: 'M4 5h2.5v2.5H4zM9 5h11v2.5H9zM4 10.75h2.5v2.5H4zM9 10.75h11v2.5H9zM4 16.5h2.5V19H4zM9 16.5h11V19H9z',
  sound: 'M4 9v6h4l5 4V5L8 9zM16 8a5.5 5.5 0 010 8l-1.2-1.3a3.6 3.6 0 000-5.4z',
  search: 's:M11 4a7 7 0 100 14 7 7 0 000-14zM20 20l-4-4',
  check: 's:M5 12l5 5 9-10', back: 's:M14 5l-7 7 7 7', next: 's:M9 5l7 7-7 7',
  first: 's:M17 5l-7 7 7 7M7 5v14', last: 's:M7 5l7 7-7 7M17 5v14',
  undo: 's:M8 6l-5 5 5 5M3 11h11a4.5 4.5 0 010 9h-3', flip: 's:M7 20V4M3 8l4-4 4 4M17 4v16M13 16l4 4 4-4',
  flag: 's:M5 21V4h11l-2 4 2 4H5', plus: 's:M12 5v14M5 12h14', x: 's:M6 6l12 12M18 6L6 18',
};
export const ic = n => {
  const d = IC[n] || IC.star, s = d.startsWith('s:');
  return `<svg class="ic${s ? ' st' : ''}" viewBox="0 0 24 24" aria-hidden="true"><path fill-rule="evenodd" d="${s ? d.slice(2) : d}"/></svg>`;
};
export const pimg = p => `<img src="${pieceUrl(p)}" alt="">`;

/* ---------- saved progress ---------- */
const DEF = { name: 'Player', pr: 1000, prh: [1000], gr: 800, grh: [800], solved: [], pstreak: 0, pbest: 0, xp: 0, lessons: {}, rec: { w: 0, d: 0, l: 0 }, bots: {}, rush: 0, vision: 0, endg: {}, acc: [], day: '', days: 0, daily: '', aw: [], skin: 'midnight', pieces: 'cburnett', sound: true, coords: true, last: null };
export let S = structuredClone(DEF);
try { S = { ...S, ...JSON.parse(localStorage.getItem('pawnwise2') || '{}') }; } catch {}
export const save = () => { try { localStorage.setItem('pawnwise2', JSON.stringify(S)); } catch {} };
export function resetAll() { S = structuredClone(DEF); save(); applyLooks(); }
export function applyLooks() {
  document.documentElement.dataset.skin = S.skin;
  cfg.pieces = S.pieces; cfg.coords = S.coords;
}
export const level = () => Math.floor(S.xp / 100) + 1;
export function addXp(n) {
  const before = level(); S.xp += n;
  if (level() > before) { toast(`${ic('star')}<span><b>Level ${level()}</b><br>Keep it going.</span>`); sfx('end'); }
}
export function touchDay() {
  const d = new Date(), today = d.toDateString();
  if (S.day === today) return;
  d.setDate(d.getDate() - 1);
  S.days = S.day === d.toDateString() ? S.days + 1 : 1;
  S.day = today; save();
}

/* ---------- navigation ---------- */
export const views = {}, ctx = {}, cleanups = [];
export let viewId = 0;
export const bump = () => ++viewId;
let router = () => {};
export const setRouter = f => { router = f; };
export const goto = name => { if (location.hash === '#' + name) router(); else location.hash = name; };

/* ---------- feedback ---------- */
export function toast(html) {
  const t = document.createElement('div');
  t.className = 'toast'; t.innerHTML = html;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3200);
}
let ac;
const SND = { move: [200], capture: [150, 110], check: [440, 330], good: [523, 659, 784], bad: [196, 147], end: [392, 523, 659, 784] };
export function sfx(k = 'move') {
  if (!S.sound) return;
  try {
    ac = ac || new (window.AudioContext || window.webkitAudioContext)();
    const t = ac.currentTime;
    SND[k].forEach((hz, i) => {
      const o = ac.createOscillator(), g = ac.createGain(), at = t + i * 0.07;
      o.type = k === 'move' || k === 'capture' ? 'triangle' : 'sine'; o.frequency.value = hz;
      g.gain.setValueAtTime(0.16, at); g.gain.exponentialRampToValueAtTime(0.001, at + 0.13);
      o.connect(g).connect(ac.destination); o.start(at); o.stop(at + 0.14);
    });
  } catch {}
}
export const moveSfx = (g, m) => sfx(g.isCheck() ? 'check' : m.captured ? 'capture' : 'move');

/* ---------- layout pieces ---------- */
export function screen(title, { back, right = '', body = '' } = {}) {
  main.innerHTML = `<div class="wrap"><div class="top">${back ? `<a class="ibtn" href="#${back}" aria-label="Back">${ic('back')}</a>` : ''}<h1>${title}</h1><span class="grow"></span>${right}</div>${body}</div>`;
}
export const coachHtml = (title = '', text = '') => `<div class="coach" id="coach"><span class="cav">${pimg('wN')}</span><div class="bub"><b id="ct">${title}</b><p id="cx">${text}</p></div></div>`;
export function coach(title, text = '', tone = '') {
  const c = $('#coach'); if (!c) return;
  c.className = 'coach ' + tone; $('#ct').textContent = title; $('#cx').innerHTML = text;
}
export const stage = (panel, { bars = false, pre = '' } = {}) => `<div class="stage"><div class="bcol">${coachHtml()}${pre}${bars ? '<div class="pbar" id="pt"></div>' : ''}<div id="board"></div>${bars ? '<div class="pbar" id="pb"></div>' : ''}</div><aside class="panel">${panel}</aside></div>`;
export function freshBoard() { const o = $('#board'), n = document.createElement('div'); n.id = 'board'; o.replaceWith(n); return n; }
export const iso = (cls, inner) => `<span class="iso ${cls}"><svg viewBox="-4 -4 108 84" aria-hidden="true"><path class="s1" d="M0 30 50 58V72L0 44z"/><path class="s2" d="M100 30 50 58V72l50-28z"/><path class="tp" d="M50 2 100 30 50 58 0 30z"/></svg><b>${inner}</b></span>`;
export function mini(fen, orient = 'w') {
  const cells = [];
  for (const row of fen.split(' ')[0].split('/')) for (const ch of row) {
    if (+ch) for (let k = 0; k < +ch; k++) cells.push('');
    else cells.push((ch === ch.toUpperCase() ? 'w' : 'b') + ch.toUpperCase());
  }
  if (orient === 'b') cells.reverse();
  return `<div class="miniboard">${cells.map((c, i) => `<i class="${((i >> 3) + i) % 2 ? 'd' : 'l'}">${c ? pimg(c) : ''}</i>`).join('')}</div>`;
}
export function moveList(sans, cur = -1, start = 0) {
  return sans.map((m, i) => (i % 2 === 0 ? `<span>${i / 2 + 1 + start}.</span>` : '') + `<a data-k="${i + 1}" class="${i + 1 === cur ? 'on' : ''}">${m}</a>`).join(' ') || '<span>No moves yet</span>';
}
export function spark(arr, w = 300, h = 70) {
  const a = arr.length > 1 ? arr : [arr[0], arr[0]], lo = Math.min(...a) - 20, hi = Math.max(...a) + 20;
  const pts = a.map((v, i) => `${(i / (a.length - 1) * w).toFixed(1)},${(h - (v - lo) / (hi - lo) * h).toFixed(1)}`).join(' ');
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><polygon points="0,${h} ${pts} ${w},${h}"/><polyline points="${pts}"/></svg>`;
}

/* ---------- lazy data ---------- */
let _pz, _bk;
export const puzzles = () => _pz || (_pz = import('./data/puzzles.js').then(m => m.default.split('\n').map(l => {
  const a = l.split('|'); return { id: a[0], fen: a[1] + ' 0 1', moves: a[2].split(' '), r: +a[3], th: a[4] ? a[4].split(' ') : [] };
})));
export const book = () => _bk || (_bk = import('./data/openings.js').then(m => {
  const root = { c: {} };
  for (const l of m.default.split('\n')) {
    const [name, mv] = l.split('|'); let n = root;
    for (const s of mv.split(' ')) n = n.c[s] || (n.c[s] = { c: {} });
    n.n = name;
  }
  return root;
}));
export function opening(root, sans) {
  let n = root, name = '', plies = 0;
  for (const s of sans) { const c = n.c[s]; if (!c) break; n = c; plies++; if (n.n) name = n.n; }
  return { name, plies, node: plies === sans.length ? n : null };
}
export const lines = n => n.k || (n.k = (n.n ? 1 : 0) + Object.values(n.c).reduce((s, c) => s + lines(c), 0));
export const dailyPuzzle = all => { const pool = all.filter(p => p.r >= 1100 && p.r < 1700); return pool[Math.floor(Date.now() / 864e5) % pool.length]; };
export const today = () => new Date().toDateString();

/* ---------- opponents ---------- */
export const BOTS = [
  { id: 'pip', name: 'Pip', r: 400, pc: 'P', col: '#6ea8d8', blurb: 'Just learned the rules and gives pieces away.', rnd: 0.5, skill: 0, depth: 1 },
  { id: 'mabel', name: 'Mabel', r: 700, pc: 'P', col: '#d8a657', blurb: 'Plays fast and misses simple tactics.', rnd: 0.28, skill: 0, depth: 1 },
  { id: 'otto', name: 'Otto', r: 1000, pc: 'N', col: '#7fb069', blurb: 'Knows the basics, blunders now and then.', rnd: 0.12, skill: 1, depth: 2 },
  { id: 'ines', name: 'Ines', r: 1300, pc: 'N', col: '#c97b84', blurb: 'A solid club beginner who punishes loose pieces.', rnd: 0, skill: 4, depth: 4 },
  { id: 'bram', name: 'Bram', r: 1600, pc: 'B', col: '#9a8fd1', blurb: 'Sees two-move tactics and rarely hangs anything.', rnd: 0, skill: 8, depth: 6 },
  { id: 'saoirse', name: 'Saoirse', r: 1900, pc: 'R', col: '#5fb3a6', blurb: 'Strong club player with sharp calculation.', rnd: 0, skill: 12, depth: 8 },
  { id: 'viktor', name: 'Viktor', r: 2200, pc: 'Q', col: '#d98555', blurb: 'Expert strength. Small mistakes get punished.', rnd: 0, skill: 16, depth: 10 },
  { id: 'apex', name: 'Apex', r: 2600, pc: 'K', col: '#b0b7c6', blurb: 'The engine at full strength.', rnd: 0, skill: 20, depth: 13 },
];
export function material(g) {
  const n = { w: {}, b: {} }, init = { q: 1, r: 2, b: 2, n: 2, p: 8 }, v = { p: 1, n: 3, b: 3, r: 5, q: 9 };
  for (const row of g.board()) for (const p of row) if (p) n[p.color][p.type] = (n[p.color][p.type] || 0) + 1;
  const lost = c => Object.keys(init).flatMap(t => Array(Math.max(0, init[t] - (n[c][t] || 0))).fill(t));
  const val = c => Object.keys(v).reduce((s, t) => s + (n[c][t] || 0) * v[t], 0);
  return { lost: { w: lost('w'), b: lost('b') }, diff: val('w') - val('b') };
}

/* ---------- awards ---------- */
export const AWARDS = [
  ['first', 'First solve', 'Solve a puzzle', 'puzzle', s => s.solved.length >= 1],
  ['p25', 'Getting sharp', 'Solve 25 puzzles', 'puzzle', s => s.solved.length >= 25],
  ['p100', 'Centurion', 'Solve 100 puzzles', 'puzzle', s => s.solved.length >= 100],
  ['st5', 'On a roll', 'Solve 5 puzzles in a row', 'flame', s => s.pbest >= 5],
  ['st10', 'Unstoppable', 'Solve 10 puzzles in a row', 'flame', s => s.pbest >= 10],
  ['r1200', 'Club player', 'Reach a 1200 puzzle rating', 'stats', s => s.pr >= 1200],
  ['r1500', 'Tactician', 'Reach a 1500 puzzle rating', 'stats', s => s.pr >= 1500],
  ['l1', 'Student', 'Finish a lesson', 'learn', s => Object.keys(s.lessons).length >= 1],
  ['lall', 'Graduate', 'Finish every lesson', 'learn', s => Object.keys(s.lessons).length >= LESSONS.length],
  ['win', 'First win', 'Beat a computer opponent', 'crown', s => s.rec.w >= 1],
  ['bots4', 'Giant killer', 'Beat 4 different opponents', 'crown', s => Object.keys(s.bots).length >= 4],
  ['acc90', 'Precision', 'Finish a game with 90+ accuracy', 'target', s => s.acc.some(a => a >= 90)],
  ['rush10', 'Quick hands', 'Score 10 in Puzzle Rush', 'bolt', s => s.rush >= 10],
  ['vis20', 'Eagle eye', 'Score 20 in Vision', 'compass', s => s.vision >= 20],
  ['end3', 'Technician', 'Complete 3 endgame drills', 'crown', s => Object.keys(s.endg).length >= 3],
  ['d3', 'Regular', 'Train 3 days in a row', 'cal', s => s.days >= 3],
  ['d7', 'Dedicated', 'Train 7 days in a row', 'cal', s => s.days >= 7],
];
export function checkAwards() {
  for (const a of AWARDS) if (!S.aw.includes(a[0]) && a[4](S)) { S.aw.push(a[0]); toast(`${ic(a[3])}<span><b>Award unlocked</b><br>${a[1]}</span>`); }
  save();
}
