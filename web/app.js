import { Chess } from './vendor/chess.js';
import PUZZLES from './puzzles.js';
import LESSONS from './lessons.js';

const $ = (s, r = document) => r.querySelector(s);
const main = $('#main'), nav = $('#nav');

/* ---------- icons (inline SVG) ---------- */
const IC = {
  home: 'M3 11l9-8 9 8M5 10v10h14V10',
  puzzle: 'M9 4h6v3a2 2 0 104 0h1v6h-2a2 2 0 100 4h2v3H4v-3h2a2 2 0 100-4H4V7h1a2 2 0 104 0z',
  learn: 'M2 9l10-5 10 5-10 5zM6 11.5V16c2 2.5 10 2.5 12 0v-4.5M22 9v6',
  play: 'M12 3a9 9 0 100 18 9 9 0 000-18zM10 8l6 4-6 4z',
  analysis: 'M11 4a7 7 0 100 14 7 7 0 000-14zM20 20l-4-4',
  flame: 'M12 3c1 4 5 5 5 10a5 5 0 01-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-9z',
  check: 'M5 12l5 5 9-10', bulb: 'M9 18h6M10 21h4M12 3a6 6 0 00-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0012 3z',
  undo: 'M9 7l-5 5 5 5M4 12h11a5 5 0 010 10h-3', flip: 'M7 20V4M3 8l4-4 4 4M17 4v16M13 16l4 4 4-4',
  next: 'M9 5l7 7-7 7', flag: 'M5 21V4h11l-2 4 2 4H5', plus: 'M12 5v14M5 12h14',
};
const ic = n => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="${IC[n]}"/></svg>`;

/* ---------- saved progress ---------- */
const DEF = { rating: 1200, solved: [], pstreak: 0, lessons: {}, rec: { w: 0, d: 0, l: 0 }, day: '', days: 0 };
let S = { ...DEF };
try { S = { ...DEF, ...JSON.parse(localStorage.getItem('pawnwise') || '{}') }; } catch {}
const save = () => { try { localStorage.setItem('pawnwise', JSON.stringify(S)); } catch {} };
function touchDay() {
  const d = new Date(), today = d.toDateString();
  if (S.day === today) return;
  d.setDate(d.getDate() - 1);
  S.days = S.day === d.toDateString() ? S.days + 1 : 1;
  S.day = today; save();
}

/* ---------- board ---------- */
class Board {
  constructor(el, game, { orient = 'w', onMove, movable = () => true } = {}) {
    Object.assign(this, { el, game, orient, onMove, movable, sel: null, targets: [], last: [], hint: null, promo: null, locked: false });
    el.className = 'board';
    el.addEventListener('click', e => this.click(e));
    this.render();
  }
  render() {
    const g = this.game, b = g.board(), turn = g.turn();
    let html = '';
    for (let i = 0; i < 64; i++) {
      const r = Math.floor(i / 8), f = i % 8;
      const rr = this.orient === 'w' ? r : 7 - r, ff = this.orient === 'w' ? f : 7 - f;
      const sq = 'abcdefgh'[ff] + (8 - rr), p = b[rr][ff];
      let c = 'sq ' + ((rr + ff) % 2 ? 'd' : 'l');
      if (this.last.includes(sq)) c += ' last';
      if (this.sel === sq) c += ' sel';
      if (this.hint === sq) c += ' hint';
      if (p && p.type === 'k' && p.color === turn && g.isCheck()) c += ' chk';
      if (this.targets.includes(sq)) c += p ? ' cap' : ' dot';
      html += `<div class="${c}" data-sq="${sq}">` +
        (f === 0 ? `<em class="rk">${8 - rr}</em>` : '') + (r === 7 ? `<em class="fl">${'abcdefgh'[ff]}</em>` : '') +
        (p ? `<img src="pieces/${p.color}${p.type.toUpperCase()}.svg" alt="${p.color}${p.type}">` : '') + '</div>';
    }
    if (this.promo) html += '<div class="promo">' + ['q', 'r', 'b', 'n'].map(t =>
      `<button data-promo="${t}" aria-label="Promote to ${t}"><img src="pieces/${turn}${t.toUpperCase()}.svg" alt=""></button>`).join('') + '</div>';
    this.el.innerHTML = html;
  }
  click(e) {
    const pb = e.target.closest('[data-promo]');
    if (this.promo) {
      const mv = this.promo; this.promo = null; this.render();
      if (pb) this.onMove({ ...mv, promotion: pb.dataset.promo });
      return;
    }
    const t = e.target.closest('[data-sq]');
    if (!t || this.locked) return;
    const sq = t.dataset.sq, g = this.game;
    if (this.sel && this.targets.includes(sq)) {
      const from = this.sel;
      const isPromo = g.moves({ square: from, verbose: true }).some(m => m.to === sq && m.promotion);
      this.sel = null; this.targets = []; this.hint = null;
      if (isPromo) { this.promo = { from, to: sq }; this.render(); }
      else { this.render(); this.onMove({ from, to: sq }); }
      return;
    }
    const p = g.get(sq);
    if (p && p.color === g.turn() && this.movable(p.color)) {
      this.sel = sq; this.targets = g.moves({ square: sq, verbose: true }).map(m => m.to);
    } else { this.sel = null; this.targets = []; }
    this.render();
  }
}
const uciMove = u => ({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] });
const toUci = m => m.from + m.to + (m.promotion || '');
const sideName = c => (c === 'w' ? 'White' : 'Black');

/* ---------- small built-in engine (alpha-beta) ---------- */
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
  if (!ms.length) return g.isCheck() ? -100000 - d : 0;
  ms.sort((x, y) => (VAL[y.captured] || 0) - (VAL[x.captured] || 0));
  for (const m of ms) {
    g.move(m);
    const v = -search(g, d - 1, -b, -a);
    g.undo();
    if (v > a) a = v;
    if (a >= b) break;
  }
  return a;
}
function bestMove(g, depth) {
  const ms = g.moves({ verbose: true });
  let best = null, bs = -Infinity;
  for (const m of ms) {
    g.move(m);
    const v = (g.isDraw() ? 0 : -search(g, depth - 1, -Infinity, -bs + 1)) + Math.random() * 4;
    g.undo();
    if (v > bs) { bs = v; best = m; }
  }
  return { move: best, score: bs };
}

/* ---------- shared view helpers ---------- */
function stage(title, sub, panel) {
  main.innerHTML = `<div class="wrap"><header><h1>${title}</h1><p class="muted">${sub}</p></header>
    <div class="stage"><div id="board"></div><aside class="panel">${panel}</aside></div></div>`;
}
function moveList(g) {
  const h = g.history();
  return h.map((m, i) => (i % 2 ? '' : `<span>${i / 2 + 1}.</span>`) + m).join(' ') || '<span>No moves yet</span>';
}
function setMsg(text, cls = '') { const m = $('#msg'); if (m) { m.textContent = text; m.className = 'msg ' + cls; } }

/* ---------- views ---------- */
const views = {
  home() {
    const done = LESSONS.filter(l => S.lessons[l.id]).length;
    const next = LESSONS.find(l => !S.lessons[l.id]);
    main.innerHTML = `<div class="wrap">
      <header class="row" style="justify-content:space-between">
        <div><h1>Train your chess</h1><p class="muted">Free and open source. No account, no ads, progress saved in your browser.</p></div>
        <span class="streak" title="Day streak">${ic('flame')} ${S.days} day${S.days === 1 ? '' : 's'}</span>
      </header>
      <section class="hero">
        <div class="card feature">
          <span class="muted small">Puzzle rating</span>
          <div class="row"><span class="big-num">${Math.round(S.rating)}</span><span class="streak">${ic('flame')} ${S.pstreak} in a row</span></div>
          <p class="muted">${S.solved.length} of ${PUZZLES.length} puzzles solved</p>
          <div class="bar"><i style="width:${100 * S.solved.length / PUZZLES.length}%"></i></div>
          <div class="row"><a class="btn primary big" href="#puzzles">${ic('puzzle')} Solve puzzles</a></div>
        </div>
        <div class="card">
          <span class="muted small">${next ? 'Next lesson' : 'All lessons complete'}</span>
          <h2>${next ? next.title : 'Well done'}</h2>
          <p class="muted">${next ? next.desc : 'Replay any lesson to keep the ideas fresh.'}</p>
          <div class="bar"><i style="width:${100 * done / LESSONS.length}%"></i></div>
          <div class="row"><a class="btn" href="#learn">${ic('learn')} ${next ? 'Continue learning' : 'Review lessons'}</a></div>
        </div>
      </section>
      <section class="tiles">
        <div class="tile"><b>${done}/${LESSONS.length}</b><span class="muted small">Lessons</span></div>
        <div class="tile"><b>${S.rec.w}-${S.rec.d}-${S.rec.l}</b><span class="muted small">W-D-L vs computer</span></div>
        <div class="tile"><b>${S.solved.length}</b><span class="muted small">Puzzles solved</span></div>
      </section>
      <div class="row"><a class="btn primary big" href="#play">${ic('play')} Play the computer</a><a class="btn big" href="#analysis">${ic('analysis')} Analysis board</a></div>
      <p class="muted small">Puzzles come from the Lichess puzzle database (CC0). Piece graphics by Colin M.L. Burnett. Rules by chess.js.</p>
    </div>`;
  },

  puzzles() {
    let pool = PUZZLES.filter(p => !S.solved.includes(p[0]));
    if (!pool.length) { S.solved = []; save(); pool = PUZZLES; }
    pool = [...pool].sort((a, b) => Math.abs(a[3] - S.rating) - Math.abs(b[3] - S.rating)).slice(0, 6);
    const [id, fen, sol, prating, themes, last] = pool[Math.floor(Math.random() * pool.length)];
    const moves = sol.split(' '), g = new Chess(fen), me = g.turn();
    let idx = 0, scored = false, clean = true, over = false;
    stage('Puzzles', `Your rating <b>${Math.round(S.rating)}</b>`, `
      <h2>${sideName(me)} to move</h2>
      <div id="msg" class="msg">Find the best move.</div>
      <div id="info" class="row"></div>
      <div class="row">
        <button class="btn" id="hint">${ic('bulb')} Hint</button>
        <button class="btn primary" id="next">${ic('next')} Skip</button>
      </div>`);
    const score = win => {
      if (scored) return; scored = true;
      const exp = 1 / (1 + 10 ** ((prating - S.rating) / 400));
      S.rating += 24 * ((win ? 1 : 0) - exp);
      S.pstreak = win ? S.pstreak + 1 : 0; save();
      $('header p', main).innerHTML = `Your rating <b>${Math.round(S.rating)}</b>`;
    };
    const finish = () => {
      over = true;
      if (clean) score(true);
      if (!S.solved.includes(id)) S.solved.push(id);
      save();
      setMsg(clean ? 'Solved!' : 'Solved. No rating gain after a miss or hint.', 'good');
      $('#info').innerHTML = `<span class="tag">Rated ${prating}</span>` + themes.split(' ').filter(Boolean).map(t => `<span class="tag">${t.replace(/([A-Z0-9])/g, ' $1').toLowerCase()}</span>`).join('');
      $('#next').innerHTML = ic('next') + ' Next puzzle'; $('#hint').disabled = true;
    };
    const board = new Board($('#board'), g, { orient: me, movable: c => c === me && !over, onMove(mv) {
      let ok = toUci(mv) === moves[idx];
      try { g.move(mv); } catch { return board.render(); }
      if (!ok && g.isCheckmate()) ok = true;
      if (!ok) { g.undo(); clean = false; score(false); setMsg('Not the best move. Try again.', 'bad'); return board.render(); }
      board.last = [mv.from, mv.to]; idx++;
      if (idx >= moves.length || g.isCheckmate()) { board.render(); return finish(); }
      setMsg('Correct. Keep going.', 'good'); board.locked = true; board.render();
      setTimeout(() => { const r = uciMove(moves[idx++]); g.move(r); board.last = [r.from, r.to]; board.locked = false; board.render(); }, 450);
    }});
    board.last = [last.slice(0, 2), last.slice(2, 4)]; board.render();
    $('#hint').onclick = () => { clean = false; board.hint = moves[idx].slice(0, 2); board.render(); setMsg('Move the highlighted piece.'); };
    $('#next').onclick = () => { if (!over) score(false); views.puzzles(); };
  },

  learn() {
    main.innerHTML = `<div class="wrap"><header><h1>Learn</h1><p class="muted">Short interactive lessons. Every step is a move you play on the board.</p></header>
      <div class="path">${LESSONS.map((l, i) => `<button class="lesson ${S.lessons[l.id] ? 'done' : ''}" data-i="${i}">
        <span class="n">${S.lessons[l.id] ? ic('check') : i + 1}</span>
        <span class="t"><h3>${l.title}</h3><span class="muted small">${l.desc}</span></span>${ic('next')}</button>`).join('')}</div></div>`;
    main.querySelectorAll('.lesson').forEach(b => b.onclick = () => lesson(+b.dataset.i, 0));
  },

  play() {
    let level = 2, color = 'w', g, board, over;
    stage('Play the computer', 'Runs entirely in your browser.', `
      <div class="row"><span class="muted small">Level</span><div class="seg" id="lvl">${['Easy', 'Medium', 'Hard'].map((n, i) => `<button data-v="${i + 1}">${n}</button>`).join('')}</div></div>
      <div class="row"><span class="muted small">Play as</span><div class="seg" id="col"><button data-v="w">White</button><button data-v="b">Black</button></div></div>
      <div id="msg" class="msg"></div>
      <div class="moves" id="moves"></div>
      <div class="row">
        <button class="btn primary" id="new">${ic('plus')} New game</button>
        <button class="btn" id="undo">${ic('undo')} Undo</button>
        <button class="btn" id="resign">${ic('flag')} Resign</button>
      </div>`);
    const segs = () => { for (const [sel, v] of [['#lvl', level], ['#col', color]]) $(sel).querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v == v)); };
    const end = res => { over = true; S.rec[res]++; save(); };
    const status = () => {
      $('#moves').innerHTML = moveList(g);
      if (over) return;
      if (g.isCheckmate()) { const won = g.turn() !== color; end(won ? 'w' : 'l'); setMsg(won ? 'Checkmate. You win!' : 'Checkmate. The computer wins.', won ? 'good' : 'bad'); }
      else if (g.isDraw()) { end('d'); setMsg('Draw.'); }
      else setMsg(g.turn() === color ? 'Your move.' : 'Computer is thinking…');
    };
    const reply = () => {
      if (over || g.turn() === color) return;
      board.locked = true;
      setTimeout(() => {
        const ms = g.moves({ verbose: true });
        const m = level === 1 && Math.random() < 0.35 ? ms[Math.floor(Math.random() * ms.length)] : bestMove(g, level).move;
        g.move(m); board.last = [m.from, m.to]; board.locked = false; board.render(); status();
      }, 250);
    };
    const start = () => {
      g = new Chess(); over = false; segs();
      $('#board').replaceWith(Object.assign(document.createElement('div'), { id: 'board' }));
      board = new Board($('#board'), g, { orient: color, movable: c => c === color && !over, onMove(mv) {
        try { g.move(mv); } catch { return board.render(); }
        board.last = [mv.from, mv.to]; board.render(); status(); reply();
      }});
      status(); reply();
    };
    $('#lvl').onclick = e => { const b = e.target.closest('button'); if (b) { level = +b.dataset.v; segs(); } };
    $('#col').onclick = e => { const b = e.target.closest('button'); if (b) { color = b.dataset.v; start(); } };
    $('#new').onclick = start;
    $('#undo').onclick = () => { if (over || board.locked || g.history().length < 2 || g.turn() !== color) return; g.undo(); g.undo(); board.last = []; board.render(); status(); };
    $('#resign').onclick = () => { if (over || !g.history().length) return; end('l'); setMsg('You resigned.', 'bad'); };
    start();
  },

  analysis() {
    const g = new Chess();
    stage('Analysis board', 'Move both sides freely, or paste a position.', `
      <div id="msg" class="msg">White to move.</div>
      <div class="moves" id="moves"></div>
      <div class="row">
        <button class="btn primary" id="best">${ic('bulb')} Best move</button>
        <button class="btn" id="undo">${ic('undo')} Undo</button>
        <button class="btn" id="flip">${ic('flip')} Flip</button>
        <button class="btn" id="reset">${ic('plus')} Reset</button>
      </div>
      <label class="small muted" for="fen">Position (FEN)</label>
      <input class="fen" id="fen" spellcheck="false" autocomplete="off">
      <button class="btn" id="load">Load position</button>`);
    const upd = () => {
      $('#moves').innerHTML = moveList(g); $('#fen').value = g.fen();
      setMsg(g.isCheckmate() ? `Checkmate. ${sideName(g.turn() === 'w' ? 'b' : 'w')} wins.` : g.isDraw() ? 'Draw.' : `${sideName(g.turn())} to move${g.isCheck() ? ', in check' : ''}.`);
      board.render();
    };
    const board = new Board($('#board'), g, { onMove(mv) { try { g.move(mv); board.last = [mv.from, mv.to]; } catch {} upd(); } });
    $('#undo').onclick = () => { g.undo(); board.last = []; upd(); };
    $('#flip').onclick = () => { board.orient = board.orient === 'w' ? 'b' : 'w'; board.render(); };
    $('#reset').onclick = () => { g.reset(); board.last = []; upd(); };
    $('#load').onclick = () => { try { g.load($('#fen').value.trim()); board.last = []; upd(); } catch { setMsg('That FEN is not a valid position.', 'bad'); } };
    $('#best').onclick = () => {
      if (g.isGameOver()) return;
      setMsg('Thinking…');
      setTimeout(() => {
        const { move, score } = bestMove(g, 3);
        const white = (g.turn() === 'w' ? score : -score) / 100;
        board.hint = move.from; board.last = [move.to]; board.render();
        setMsg(`Suggested: ${move.san}  (${Math.abs(score) > 90000 ? 'forced mate' : (white > 0 ? '+' : '') + white.toFixed(1)})`, 'good');
      }, 30);
    };
    upd();
  },
};

function lesson(li, si) {
  const L = LESSONS[li], st = L.steps[si], g = new Chess(st.fen), me = g.turn();
  let solved = false;
  stage(L.title, `Step ${si + 1} of ${L.steps.length}`, `
    <div class="dots">${L.steps.map((_, i) => `<i class="${i <= si ? 'on' : ''}"></i>`).join('')}</div>
    <p>${st.text}</p>
    <div id="msg" class="msg">${sideName(me)} to move.</div>
    <div class="row">
      <button class="btn" id="back">All lessons</button>
      <button class="btn primary" id="next" disabled>${si + 1 < L.steps.length ? 'Next step' : 'Finish lesson'} ${ic('next')}</button>
    </div>`);
  const board = new Board($('#board'), g, { orient: me, movable: () => !solved, onMove(mv) {
    try { g.move(mv); } catch { return board.render(); }
    const ok = st.goal === 'mate' ? g.isCheckmate() : st.goal === 'check' ? g.isCheck() : st.goal.includes(toUci(mv));
    if (!ok) { g.undo(); setMsg('Not quite. Read the hint above and try again.', 'bad'); return board.render(); }
    solved = true; board.last = [mv.from, mv.to]; board.render();
    setMsg(st.done, 'good'); $('#next').disabled = false;
  }});
  $('#back').onclick = () => views.learn();
  $('#next').onclick = () => {
    if (si + 1 < L.steps.length) return lesson(li, si + 1);
    S.lessons[L.id] = 1; save(); views.learn();
  };
}

/* ---------- navigation ---------- */
const TABS = [['home', 'Home', 'home'], ['puzzles', 'Puzzles', 'puzzle'], ['learn', 'Learn', 'learn'], ['play', 'Play', 'play'], ['analysis', 'Analysis', 'analysis']];
function route() {
  const v = views[location.hash.slice(1)] ? location.hash.slice(1) : 'home';
  nav.innerHTML = `<div class="brand"><img src="pieces/wN.svg" alt="">Pawnwise</div>` +
    TABS.map(([id, label, i]) => `<a href="#${id}" class="${id === v ? 'on' : ''}">${ic(i)}<span>${label}</span></a>`).join('');
  views[v]();
  scrollTo(0, 0);
}
addEventListener('hashchange', route);
touchDay();
route();
