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
export const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- monochrome icons (nav, buttons) ---------- */
const IC = {
  pawn: 'M12 2a3.5 3.5 0 00-2.2 6.2C8.6 9 8 9.7 8 10.5h1.6c-.3 3-1.6 5-3.1 6.5V19h11v-2c-1.5-1.5-2.8-3.5-3.1-6.5H16c0-.8-.6-1.5-1.8-2.3A3.5 3.5 0 0012 2zM5 20h14v2H5z',
  puzzle: 'M20.5 11H19V7a2 2 0 00-2-2h-4V3.5a2.5 2.5 0 00-5 0V5H4a2 2 0 00-2 2v3.8h1.5a2.7 2.7 0 010 5.4H2V20a2 2 0 002 2h3.8v-1.5a2.7 2.7 0 015.4 0V22H17a2 2 0 002-2v-4h1.5a2.5 2.5 0 000-5z',
  learn: 'M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82zM12 3L1 9l11 6 9-4.91V17h2V9L12 3z',
  watch: 'M6.5 6A4.5 4.5 0 002 10.5v4a4.5 4.5 0 009 0V13h2v1.5a4.5 4.5 0 009 0v-4A4.5 4.5 0 0017.5 6c-1.6 0-3 .8-3.8 2h-3.4A4.5 4.5 0 006.5 6zm0 6a2.5 2.5 0 110 5 2.5 2.5 0 010-5zm11 0a2.5 2.5 0 110 5 2.5 2.5 0 010-5z',
  play: 'M3 3h18v18H3zM5 5v7h7V5zM12 12v7h7v-7z',
  more: 'M3 5.5h18V8H3zM3 10.75h18v2.5H3zM3 16h18v2.5H3z',
  flame: 'M12 2c1 4.5 6 6 6 11.5a6 6 0 01-12 0c0-2.3 1.2-3.7 2.3-4.8 0 2.3 1 3.3 2 3.3.3-3.3-.8-5.5 1.7-10z',
  bolt: 'M13 2L4 14h6l-1 8 9-12h-6z', star: 'M12 2l3 6.5 7 .8-5.2 4.8 1.5 7L12 17.6 5.7 21.1l1.5-7L2 9.3l7-.8z',
  bulb: 'M9 21h6v-1.5H9zM12 2a7 7 0 00-4 12.7V18h8v-3.3A7 7 0 0012 2z',
  crown: 'M5 17h14l1.5-9-4.5 3.5L12 5l-4 6.5L3.5 8zM5 18.5h14V21H5z',
  target: 'M12 2a10 10 0 100 20 10 10 0 000-20zm0 4a6 6 0 110 12 6 6 0 010-12zm0 4a2 2 0 100 4 2 2 0 000-4z',
  gear: 'M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 00.12-.61l-1.92-3.32a.49.49 0 00-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.48.48 0 00-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.48.48 0 00-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 00-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6A3.6 3.6 0 1112 8.4a3.6 3.6 0 010 7.2z',
  list: 'M3 4.5h3v3H3zM8 4.5h13v3H8zM3 10.5h3v3H3zM8 10.5h13v3H8zM3 16.5h3v3H3zM8 16.5h13v3H8z',
  pause: 'M6 4h4v16H6zM14 4h4v16h-4z', go: 'M7 4l13 8-13 8z',
  search: 's:M11 4a7 7 0 100 14 7 7 0 000-14zM20 20l-4-4', compass: 's:M12 3a9 9 0 100 18 9 9 0 000-18zM15.5 8.5l-2 5-5 2 2-5z',
  check: 's:M5 12l5 5 9-10', back: 's:M14 5l-7 7 7 7', next: 's:M9 5l7 7-7 7',
  first: 's:M17 5l-7 7 7 7M7 5v14', last: 's:M7 5l7 7-7 7M17 5v14',
  undo: 's:M8 6l-5 5 5 5M3 11h11a4.5 4.5 0 010 9h-3', flip: 's:M7 20V4M3 8l4-4 4 4M17 4v16M13 16l4 4 4-4',
  flag: 's:M5 21V4h11l-2 4 2 4H5', plus: 's:M12 5v14M5 12h14', x: 's:M6 6l12 12M18 6L6 18', clock: 's:M12 3a9 9 0 100 18 9 9 0 000-18zM12 7v5l3 2',
};
export const ic = n => {
  const d = IC[n] || IC.star, s = d.startsWith('s:');
  return `<svg class="ic${s ? ' st' : ''}" viewBox="0 0 24 24" aria-hidden="true"><path fill-rule="evenodd" d="${s ? d.slice(2) : d}"/></svg>`;
};

/* ---------- colour illustrations for tiles and menus ---------- */
const ART = {
  flame: '<path d="M16 3c2 6 9 8 9 16a9 9 0 01-18 0c0-4 2-6 4-8 0 3 1.5 5 3 5 0-5-1-8 2-13z" fill="#f47d2c"/><path d="M16 14c1 3 4.5 4 4.5 7.5a4.5 4.5 0 01-9 0c0-2.5 2-3.5 3-5 .5 1.5 1.5 2 1.5 2 0-2 0-3 0-4.5z" fill="#ffd34d"/>',
  puzzle: '<path d="M27 15h-2v-5a2 2 0 00-2-2h-5V6a3 3 0 00-6 0v2H7a2 2 0 00-2 2v5h2a3 3 0 010 6H5v5a2 2 0 002 2h5v-2a3 3 0 016 0v2h5a2 2 0 002-2v-5h2a3 3 0 000-6z" fill="#7fb34d"/><path d="M5 21h2a3 3 0 000-6H5v-5a2 2 0 012-2h5V6a3 3 0 013-3c-1 3 0 4 0 5v18h-3v-2a3 3 0 00-6 0v2H7a2 2 0 01-2-2z" fill="#9ccc6a"/>',
  cap: '<path d="M16 5L2 12l14 7 11-5.5V22h2.5V12z" fill="#3d8fd6"/><path d="M8 16.5V22c3 3 13 3 16 0v-5.5L16 21z" fill="#2a6fae"/><path d="M27 13.5V23" stroke="#f2c230" stroke-width="2"/><circle cx="27" cy="24.5" r="2.2" fill="#f2c230"/>',
  bolt: '<path d="M18 2L5 19h9l-2 11 14-18h-9z" fill="#f6c443"/><path d="M18 2L5 19h6z" fill="#ffe07a"/>',
  target: '<circle cx="16" cy="16" r="13" fill="#e2493f"/><circle cx="16" cy="16" r="9" fill="#fff"/><circle cx="16" cy="16" r="5" fill="#e2493f"/><path d="M16 16L28 4" stroke="#6a4b2a" stroke-width="2.4"/><path d="M26 3l3 0 0 3-2 1-2-2z" fill="#3d8fd6"/>',
  sun: '<g fill="#f6c443"><circle cx="16" cy="16" r="7"/><path d="M16 1l2 5h-4zM16 31l-2-5h4zM1 16l5-2v4zM31 16l-5 2v-4zM5.4 5.4l5 2-2.8 2.8zM26.6 26.6l-5-2 2.8-2.8zM26.6 5.4l-2 5-2.8-2.8zM5.4 26.6l2-5 2.8 2.8z"/></g><circle cx="16" cy="16" r="4.5" fill="#fff3b8"/>',
  watch: '<circle cx="16" cy="18" r="11" fill="#e8e6e1"/><circle cx="16" cy="18" r="8.5" fill="#fff"/><path d="M16 18V11.5" stroke="#3a3833" stroke-width="2.4" stroke-linecap="round"/><rect x="13" y="2.5" width="6" height="4" rx="1.5" fill="#7fb34d"/><path d="M24 8l2.5-2.5" stroke="#7fb34d" stroke-width="2.4" stroke-linecap="round"/>',
  bars: '<rect x="3" y="17" width="7" height="12" rx="1.5" fill="#3d8fd6"/><rect x="12.5" y="10" width="7" height="19" rx="1.5" fill="#4ea4ee"/><rect x="22" y="3" width="7" height="26" rx="1.5" fill="#6bb8ff"/>',
  trophy: '<path d="M9 3h14v8a7 7 0 01-14 0z" fill="#f6c443"/><path d="M9 6H4c0 5 2 7 5 7.5M23 6h5c0 5-2 7-5 7.5" stroke="#f6c443" stroke-width="2.4" fill="none"/><rect x="14" y="17" width="4" height="6" fill="#d9a521"/><rect x="9" y="23" width="14" height="5" rx="1.5" fill="#8a5a2b"/>',
  star: '<rect x="2" y="2" width="28" height="28" rx="6" fill="#f2b32e"/><rect x="4" y="4" width="24" height="24" rx="4" fill="#ffd257"/><path d="M16 7l2.7 5.6 6.1.8-4.5 4.2 1.2 6-5.5-3-5.5 3 1.2-6-4.5-4.2 6.1-.8z" fill="#fff6c8"/>',
  brush: '<rect x="3" y="3" width="26" height="26" rx="4" fill="#ecebe5"/><path d="M3 16h13V3h9a4 4 0 014 4v9H16v13H7a4 4 0 01-4-4z" fill="#7fb34d"/><path d="M27 4L15 18l3 3L29 8z" fill="#3d8fd6"/><path d="M13 19c-3 0-4 2-4 4 0 1.5-1 2.5-2 3 4 1 9 0 9-4z" fill="#8a5a2b"/>',
  gear: '<path d="M16 2l3 3.5 4.5-1 1 4.5L29 10l-2 4 2 4-4.5 1-1 4.5-4.5-1L16 26l-3-3.5-4.5 1-1-4.5L3 18l2-4-2-4 4.5-1 1-4.5 4.5 1z" fill="#9b9893" transform="translate(0 2)"/><circle cx="16" cy="16" r="5.5" fill="#3a3833"/><circle cx="16" cy="16" r="3" fill="#cfcdc7"/>',
  compass: '<circle cx="16" cy="16" r="13" fill="#cfd3da"/><circle cx="16" cy="16" r="10.5" fill="#fff"/><path d="M22 10l-4.5 7.5L10 22l4.5-7.5z" fill="#9aa1ad"/><path d="M22 10l-7.5 4.5 3 3z" fill="#e2493f"/>',
  crown: '<path d="M4 24h24l2-14-7 5-7-10-7 10-7-5z" fill="#f6c443"/><rect x="4" y="24" width="24" height="5" rx="1.5" fill="#d9a521"/><circle cx="16" cy="17" r="2.5" fill="#e2493f"/>',
  search: '<circle cx="13" cy="13" r="10" fill="#cfd3da"/><circle cx="13" cy="13" r="7.5" fill="#3d8fd6"/><path d="M13 5.5a7.5 7.5 0 017.5 7.5H13z" fill="#fff" opacity=".85"/><path d="M5.5 13H13v7.5a7.5 7.5 0 01-7.5-7.5z" fill="#fff" opacity=".85"/><path d="M20 20l8 8" stroke="#6b6863" stroke-width="4" stroke-linecap="round"/>',
  bulb: '<path d="M16 3a9 9 0 00-5 16.5V23h10v-3.5A9 9 0 0016 3z" fill="#f6c443"/><path d="M12 9a5 5 0 014-2" stroke="#fff3b8" stroke-width="2" stroke-linecap="round"/><rect x="11.5" y="24" width="9" height="2.5" rx="1" fill="#9b9893"/><rect x="12.5" y="27.5" width="7" height="2.5" rx="1" fill="#9b9893"/>',
  cal: '<rect x="3" y="5" width="26" height="24" rx="3" fill="#ecebe5"/><rect x="3" y="5" width="26" height="7" rx="3" fill="#7fb34d"/><rect x="8" y="2" width="3" height="6" rx="1.5" fill="#4c7a2c"/><rect x="21" y="2" width="3" height="6" rx="1.5" fill="#4c7a2c"/><path d="M11 16h4v-1a2 2 0 014 0v1h3v9H11z" fill="#7fb34d"/>',
  friends: '<circle cx="11" cy="10" r="5" fill="#8a5a3c"/><path d="M2 27c0-6 4-9 9-9s9 3 9 9z" fill="#3d8fd6"/><circle cx="22" cy="11" r="4.5" fill="#f0c08a"/><path d="M15 27c0-5 3-8 7-8s8 3 8 8z" fill="#9b9893"/>',
  book: '<path d="M4 6c4-2 8-2 12 1v21c-4-3-8-3-12-1z" fill="#c9884a"/><path d="M28 6c-4-2-8-2-12 1v21c4-3 8-3 12-1z" fill="#e3a865"/><path d="M16 7v21" stroke="#8a5a2b" stroke-width="1.5"/>',
  sword: '<path d="M25 3l4 0 0 4-14 14-4-4z" fill="#cfd3da"/><path d="M8 18l6 6-2 2-2-2-4 4-2-2 4-4-2-2z" fill="#8a5a2b"/><path d="M9 15l8 8" stroke="#f6c443" stroke-width="2.5"/>',
};
export const art = (n, cls = '') => `<svg class="art ${cls}" viewBox="0 0 32 32" aria-hidden="true">${ART[n] || ART.star}</svg>`;
export const pimg = p => `<img src="${pieceUrl(p)}" alt="">`;

/* the coach: an original cartoon rook */
export const MASCOT = `<svg class="mascot" viewBox="0 0 64 64" aria-hidden="true">
  <path d="M14 8h7v6h6V8h10v6h6V8h7v14l-5 4v22H19V26l-5-4z" fill="#efe9dc" stroke="#3b342b" stroke-width="2.5" stroke-linejoin="round"/>
  <rect x="11" y="48" width="42" height="9" rx="3" fill="#7fb34d" stroke="#3b342b" stroke-width="2.5"/>
  <g class="eyes"><ellipse cx="26" cy="33" rx="3.4" ry="4.2" fill="#2b2620"/><ellipse cx="38" cy="33" rx="3.4" ry="4.2" fill="#2b2620"/><circle cx="27.2" cy="31.6" r="1.2" fill="#fff"/><circle cx="39.2" cy="31.6" r="1.2" fill="#fff"/></g>
  <path d="M27 41q5 4 10 0" stroke="#2b2620" stroke-width="2.4" fill="none" stroke-linecap="round"/>
  <circle cx="21" cy="39" r="2.6" fill="#f2a08a" opacity=".8"/><circle cx="43" cy="39" r="2.6" fill="#f2a08a" opacity=".8"/>
  <path d="M21 25.5q5-3 9 0M34 25.5q5-3 9 0" stroke="#3b342b" stroke-width="2" fill="none" stroke-linecap="round"/></svg>`;

/* ---------- saved progress ---------- */
const DEF = { v: 3, name: 'Player', pr: 1000, prh: [1000], gr: 800, grh: [800], solved: [], pstreak: 0, pbest: 0, xp: 0, lessons: {}, rec: { w: 0, d: 0, l: 0 },
  bots: {}, rush: 0, vision: 0, endg: {}, acc: [], day: '', days: 0, daily: '', aw: [], skin: 'classic', pieces: 'cburnett', sound: true, coords: true,
  games: [], th: {}, tc: 'none', watched: {} };
export let S = structuredClone(DEF);
try { S = { ...S, ...JSON.parse(localStorage.getItem('pawnwise2') || '{}') }; } catch {}
if (S.v !== 3) { S.v = 3; S.skin = 'classic'; if (S.last && !S.games.length) S.games = [{ ...S.last, date: Date.now(), tc: 'none' }]; }
export const save = () => { try { localStorage.setItem('pawnwise2', JSON.stringify(S)); } catch {} };
export function resetAll() { S = structuredClone(DEF); save(); applyLooks(); }
export function applyLooks() { document.documentElement.dataset.skin = S.skin; cfg.pieces = S.pieces; cfg.coords = S.coords; }
export const level = () => Math.floor(S.xp / 100) + 1;
export function addXp(n) {
  const before = level(); S.xp += n; save();
  if (level() > before) setTimeout(() => celebrate(`<span class="lvl huge">${level()}</span>`, `Level ${level()}!`, 'You levelled up. Keep the streak going.'), 900);
}
export function touchDay() {
  const d = new Date(), today = d.toDateString();
  if (S.day === today) return;
  d.setDate(d.getDate() - 1);
  S.days = S.day === d.toDateString() ? S.days + 1 : 1;
  S.day = today; save();
}
export function archive(g) { S.games.unshift({ ...g, date: Date.now() }); if (S.games.length > 40) S.games.length = 40; save(); }
export function themeResult(themes, ok) { for (const t of themes) { const r = S.th[t] || (S.th[t] = [0, 0]); r[1]++; if (ok) r[0]++; } }

/* ---------- navigation ---------- */
export const views = {}, ctx = {}, cleanups = [];
export let viewId = 0;
export const bump = () => ++viewId;
let router = () => {};
export const setRouter = f => { router = f; };
export const goto = name => { if (location.hash === '#' + name) router(); else location.hash = name; };

/* ---------- sound (Lichess sound sets, see README) ---------- */
const SND = { move: 'Move', capture: 'Capture', check: 'sfx_Check', good: 'Confirmation', bad: 'Error', win: 'sfx_Victory', lose: 'sfx_Defeat', draw: 'sfx_Draw', notify: 'GenericNotify', level: 'sfx_Notify', low: 'LowTime' };
const bank = {};
export function sfx(k = 'move') {
  if (!S.sound || !SND[k]) return;
  try {
    const a = bank[k] || (bank[k] = new Audio(`sounds/${SND[k]}.mp3`));
    const p = a.paused ? a : a.cloneNode();
    p.volume = k === 'move' || k === 'capture' ? 0.9 : 0.7; p.currentTime = 0;
    p.play().catch(() => {});
  } catch {}
}
export const moveSfx = (g, m) => sfx(g.isCheck() ? 'check' : m.captured ? 'capture' : 'move');

/* ---------- celebrations ---------- */
export function confetti(n = 120) {
  if (reduced()) return;
  const c = document.createElement('canvas'), x = c.getContext('2d'), W = (c.width = innerWidth), H = (c.height = innerHeight);
  c.className = 'confetti'; document.body.appendChild(c);
  const cols = ['#7fb34d', '#f6c443', '#3d8fd6', '#e2493f', '#9b7be0', '#fff'];
  const ps = Array.from({ length: n }, () => ({ x: W / 2 + (Math.random() - .5) * W * .3, y: H * .45, vx: (Math.random() - .5) * 16, vy: -Math.random() * 15 - 5, r: Math.random() * 6 + 4, a: Math.random() * 6, va: (Math.random() - .5) * .4, c: cols[Math.random() * cols.length | 0] }));
  let t = 0;
  (function f() {
    x.clearRect(0, 0, W, H);
    for (const p of ps) { p.vy += .45; p.vx *= .985; p.x += p.vx; p.y += p.vy; p.a += p.va; x.save(); x.translate(p.x, p.y); x.rotate(p.a); x.fillStyle = p.c; x.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2); x.restore(); }
    if (++t < 110) requestAnimationFrame(f); else c.remove();
  })();
}
export function celebrate(visual, title, text) {
  const o = document.createElement('div');
  o.className = 'celebrate';
  o.innerHTML = `<div class="ccard">${visual}<h2>${title}</h2><p>${text}</p><button class="btn primary big">Continue</button></div>`;
  o.onclick = () => o.remove();
  document.body.appendChild(o); confetti(160); sfx('level');
}
export function toast(html) {
  const t = document.createElement('div');
  t.className = 'toast'; t.innerHTML = html;
  document.body.appendChild(t);
  setTimeout(() => t.classList.add('out'), 2800);
  setTimeout(() => t.remove(), 3200);
}
export function countUp(el, to, ms = 700) {
  if (!el) return;
  if (reduced()) { el.textContent = to; return; }
  const from = Math.max(0, to - Math.min(300, Math.abs(to))), t0 = performance.now();
  (function f(t) { const k = Math.min(1, (t - t0) / ms), e = 1 - (1 - k) ** 3; el.textContent = Math.round(from + (to - from) * e); if (k < 1) requestAnimationFrame(f); })(t0);
}
export function floatDelta(el, d) {
  if (!el || !d) return;
  const s = document.createElement('span'); s.className = 'delta ' + (d > 0 ? 'up' : 'down'); s.textContent = (d > 0 ? '+' : '') + d;
  el.appendChild(s); setTimeout(() => s.remove(), 1400);
}
export function shake(el) { if (!el) return; el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); }

/* ---------- layout pieces ---------- */
export function screen(title, { back, right = '', body = '', cls = '' } = {}) {
  main.innerHTML = `<div class="wrap ${cls}"><div class="top">${back ? `<a class="ibtn" href="#${back}" aria-label="Back">${ic('back')}</a>` : ''}<h1>${title}</h1><span class="grow"></span>${right}</div>${body}</div>`;
}
export const coachHtml = (title = '', text = '') => `<div class="coach" id="coach"><span class="cav">${MASCOT}</span><div class="bub"><b id="ct"><i class="tick"></i><span>${title}</span></b><p id="cx">${text}</p></div></div>`;
export function coach(title, text = '', tone = '') {
  const c = $('#coach'); if (!c) return;
  c.className = 'coach ' + tone; void c.offsetWidth; c.classList.add('pop');
  $('#ct span').textContent = title; $('#cx').innerHTML = text;
}
export const stage = (panel, { bars = false, pre = '' } = {}) => `<div class="stage"><div class="bcol">${coachHtml()}${pre}${bars ? '<div class="pbar" id="pt"></div>' : ''}<div id="board"></div>${bars ? '<div class="pbar" id="pb"></div>' : ''}</div><aside class="panel">${panel}</aside></div>`;
export function freshBoard() { const o = $('#board'), n = document.createElement('div'); n.id = 'board'; o.replaceWith(n); return n; }
export const iso = (cls, inner) => `<span class="iso ${cls}"><svg viewBox="-4 -4 108 84" aria-hidden="true"><path class="s1" d="M0 30 50 58V72L0 44z"/><path class="s2" d="M100 30 50 58V72l50-28z"/><path class="tp" d="M50 2 100 30 50 58 0 30z"/><g class="rings"><ellipse cx="50" cy="30" rx="34" ry="19"/><ellipse cx="50" cy="30" rx="22" ry="12"/><ellipse cx="50" cy="30" rx="10" ry="5.5"/></g></svg><b>${inner}</b></span>`;
export function mini(fen, orient = 'w') {
  const cells = [];
  for (const row of fen.split(' ')[0].split('/')) for (const ch of row) {
    if (+ch) for (let k = 0; k < +ch; k++) cells.push('');
    else cells.push((ch === ch.toUpperCase() ? 'w' : 'b') + ch.toUpperCase());
  }
  if (orient === 'b') cells.reverse();
  return `<div class="miniboard">${cells.map((c, i) => `<i class="${((i >> 3) + i) % 2 ? 'd' : 'l'}">${c ? pimg(c) : ''}</i>`).join('')}</div>`;
}
export function moveList(sans, cur = -1, kinds = []) {
  return sans.map((m, i) => (i % 2 === 0 ? `<span>${i / 2 + 1}.</span>` : '') + `<a data-k="${i + 1}" class="${i + 1 === cur ? 'on' : ''} ${kinds[i] ? 'q-' + kinds[i] : ''}">${m}</a>`).join(' ') || '<span>No moves yet</span>';
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
  { id: 'apex', name: 'Apex', r: 2800, pc: 'K', col: '#b0b7c6', blurb: 'Stockfish 19 at full strength.', rnd: 0, skill: 20, depth: 14 },
];
export const FRIEND = { id: 'friend', name: 'Friend', r: 0, pc: 'P', col: '#9b9893', blurb: 'Pass the device between moves.' };
export const TCS = { none: ['Unlimited', 0, 0], bullet: ['1 min', 60, 0], blitz: ['3 | 2', 180, 2], rapid: ['10 min', 600, 0] };
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
  ['p500', 'Puzzle machine', 'Solve 500 puzzles', 'puzzle', s => s.solved.length >= 500],
  ['st5', 'On a roll', 'Solve 5 puzzles in a row', 'flame', s => s.pbest >= 5],
  ['st10', 'Unstoppable', 'Solve 10 puzzles in a row', 'flame', s => s.pbest >= 10],
  ['r1200', 'Club player', 'Reach a 1200 puzzle rating', 'bars', s => s.pr >= 1200],
  ['r1500', 'Tactician', 'Reach a 1500 puzzle rating', 'bars', s => s.pr >= 1500],
  ['r2000', 'Master tactician', 'Reach a 2000 puzzle rating', 'bars', s => s.pr >= 2000],
  ['l1', 'Student', 'Finish a lesson', 'cap', s => Object.keys(s.lessons).length >= 1],
  ['lall', 'Graduate', 'Finish every lesson', 'cap', s => Object.keys(s.lessons).length >= LESSONS.length],
  ['win', 'First win', 'Beat a computer opponent', 'trophy', s => s.rec.w >= 1],
  ['bots4', 'Giant killer', 'Beat 4 different opponents', 'crown', s => Object.keys(s.bots).length >= 4],
  ['acc90', 'Precision', 'Finish a game with 90+ accuracy', 'target', s => s.acc.some(a => a >= 90)],
  ['rush10', 'Quick hands', 'Score 10 in Puzzle Rush', 'bolt', s => s.rush >= 10],
  ['rush25', 'Lightning', 'Score 25 in Puzzle Rush', 'bolt', s => s.rush >= 25],
  ['vis20', 'Eagle eye', 'Score 20 in Vision', 'target', s => s.vision >= 20],
  ['end3', 'Technician', 'Complete 3 endgame drills', 'crown', s => Object.keys(s.endg).length >= 3],
  ['watch3', 'Historian', 'Watch 3 famous games to the end', 'watch', s => Object.keys(s.watched).length >= 3],
  ['d3', 'Regular', 'Train 3 days in a row', 'cal', s => s.days >= 3],
  ['d7', 'Dedicated', 'Train 7 days in a row', 'cal', s => s.days >= 7],
];
export function checkAwards() {
  for (const a of AWARDS) if (!S.aw.includes(a[0]) && a[4](S)) { S.aw.push(a[0]); setTimeout(() => { toast(`${art(a[3])}<span><b>Award unlocked</b><br>${a[1]}</span>`); sfx('notify'); }, 600); }
  save();
}
