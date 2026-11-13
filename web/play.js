// Play against opponents, game review, analysis board and opening explorer.
import { $, main, S, save, views, ctx, cleanups, viewId, goto, ic, pimg, esc, screen, stage, coach, sfx, moveSfx, moveList, sleep,
  Chess, uciMove, toUci, side, START, addXp, checkAwards, book, opening, lines, BOTS, material } from './core.js';
import { Board } from './board.js';
import { think, stop, eng } from './engine.js';

const winPct = cp => 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
const evalText = r => (r.mate != null ? (r.mate === 0 ? '#' : (r.mate > 0 ? '+' : '-') + 'M' + Math.abs(r.mate)) : (r.cp > 0 ? '+' : '') + (r.cp / 100).toFixed(1));
const VAL = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 99 };
const evalBar = '<div class="evalbar"><i id="evw" style="width:50%"></i><b id="evt">0.0</b></div>';
function setEval(r) { const w = $('#evw'); if (!w) return; w.style.width = winPct(r.cp) + '%'; $('#evt').textContent = evalText(r); }
const replay = (fen, sans, n = sans.length) => { const g = new Chess(fen); for (let k = 0; k < n; k++) g.move(sans[k]); return g; };

/* ---------- choose an opponent ---------- */
views.play = () => {
  let color = 'r';
  screen('Play', { body: `<div class="between"><p class="muted">Your game rating <b>${S.gr}</b></p><div class="seg" id="col"><button data-v="w">White</button><button data-v="r" class="on">Random</button><button data-v="b">Black</button></div></div>
    <div class="bots">${BOTS.map(b => `<button class="bot" data-id="${b.id}"><span class="avatar" style="background:${b.col}">${pimg('w' + b.pc)}</span>
      <span class="t"><span class="nm"><b>${b.name}</b><span class="chip">${b.r}</span></span><small>${b.blurb}</small></span>${S.bots[b.id] ? `<span class="donemark">${ic('check')}</span>` : ic('next')}</button>`).join('')}</div>
    <p class="muted small">Engine: <span id="engn">loading</span>. Games are rated unless you use a hint or take a move back.</p>` });
  $('#col').onclick = e => { const b = e.target.closest('button'); if (!b) return; color = b.dataset.v; $('#col').querySelectorAll('button').forEach(k => k.classList.toggle('on', k === b)); };
  main.querySelectorAll('.bot').forEach(b => (b.onclick = () => { ctx.game = { bot: BOTS.find(x => x.id === b.dataset.id), color }; goto('game'); }));
  import('./engine.js').then(m => m.ready).then(e => { const n = $('#engn'); if (n) n.textContent = e.name; });
};

/* ---------- a game ---------- */
views.game = () => {
  if (!ctx.game) return goto('play');
  const id = viewId, { bot } = ctx.game, color = ctx.game.color === 'r' ? (Math.random() < 0.5 ? 'w' : 'b') : ctx.game.color, opp = color === 'w' ? 'b' : 'w';
  const g = new Chess(); let over = false, assisted = false, bk = null;
  book().then(b => { bk = b; });
  screen(`You vs ${bot.name}`, { back: 'play', body: stage('<div class="small muted" id="opn">Starting position</div><div class="moves" id="moves"></div><div class="row" id="gact"></div>', { bars: true }) });
  const bar = (who, c) => {
    const m = material(g), diff = c === 'w' ? m.diff : -m.diff, taken = m.lost[c === 'w' ? 'b' : 'w'];
    return `${who}<span class="caps">${taken.map(t => pimg((c === 'w' ? 'b' : 'w') + t.toUpperCase())).join('')}${diff > 0 ? `<b>+${diff}</b>` : ''}</span>`;
  };
  const upd = () => {
    $('#pt').innerHTML = bar(`<span class="avatar sm" style="background:${bot.col}">${pimg('w' + bot.pc)}</span><b>${bot.name}</b><span class="chip">${bot.r}</span>`, opp);
    $('#pb').innerHTML = bar(`<span class="avatar sm">${pimg('wP')}</span><b>${esc(S.name)}</b><span class="chip">${S.gr}</span>`, color);
    const h = g.history(), mv = $('#moves'); mv.innerHTML = moveList(h, h.length); mv.scrollTop = mv.scrollHeight;
    if (bk) { const o = opening(bk, h); if (o.name) $('#opn').textContent = o.name; }
    board.render();
    if (over) return;
    if (g.isCheckmate()) return finish(g.turn() === color ? 'l' : 'w', 'Checkmate');
    if (g.isDraw()) return finish('d', g.isStalemate() ? 'Stalemate' : g.isThreefoldRepetition() ? 'Draw by repetition' : g.isInsufficientMaterial() ? 'Draw by insufficient material' : 'Draw');
    coach(g.turn() === color ? 'Your move' : `${bot.name} is thinking`, g.isCheck() ? 'Check!' : `You play ${side(color)}.`);
  };
  const acts = () => {
    $('#gact').innerHTML = over
      ? `<button class="btn primary big grow" id="rev">${ic('search')} Game review</button><button class="btn grow" id="again">Rematch</button><a class="btn grow" href="#play">New opponent</a>`
      : `<button class="btn grow" id="hint">${ic('bulb')} Hint</button><button class="btn grow" id="undo">${ic('undo')} Take back</button><button class="btn grow" id="res">${ic('flag')} Resign</button>`;
    if (over) { $('#rev').onclick = () => goto('review'); $('#again').onclick = () => goto('game'); return; }
    $('#undo').onclick = () => { if (board.locked || g.turn() !== color || g.history().length < 2) return; assisted = true; g.undo(); g.undo(); board.last = []; upd(); };
    $('#res').onclick = () => { if (g.history().length) finish('l', 'You resigned'); };
    $('#hint').onclick = async () => {
      if (board.locked || g.turn() !== color) return;
      assisted = true; const r = await think(g.fen(), { depth: 10 }); if (id !== viewId || over || !r.best) return;
      board.arrows = [{ from: r.best.slice(0, 2), to: r.best.slice(2, 4) }]; board.render();
    };
  };
  function finish(res, why) {
    over = true; let d = 0;
    if (!assisted) { const exp = 1 / (1 + 10 ** ((bot.r - S.gr) / 400)); d = Math.round(32 * ({ w: 1, d: 0.5, l: 0 }[res] - exp)); S.gr = Math.max(100, S.gr + d); S.grh.push(S.gr); if (S.grh.length > 200) S.grh.shift(); }
    S.rec[res]++; if (res === 'w') S.bots[bot.id] = 1;
    S.last = { sans: g.history(), color, bot: bot.id, res };
    addXp(res === 'w' ? 20 : 8); save(); sfx('end');
    coach(res === 'w' ? 'You won!' : res === 'l' ? `${bot.name} won` : 'Draw', `${why}. ${assisted ? 'Unrated game.' : `Rating ${d >= 0 ? '+' : ''}${d}, now ${S.gr}.`}`, res === 'l' ? 'bad' : 'good');
    acts(); checkAwards(); upd();
  }
  async function botMove() {
    if (over || g.turn() === color) return;
    board.locked = true; const t0 = Date.now(), ms = g.moves({ verbose: true }), h = g.history();
    let u = null;
    const o = bk && h.length < 10 && bot.r >= 1000 ? opening(bk, h).node : null, kids = o ? Object.keys(o.c) : [];
    if (kids.length) {
      let pick = Math.random() * kids.reduce((s, k) => s + lines(o.c[k]), 0);
      const san = kids.find(k => (pick -= lines(o.c[k])) <= 0) || kids[0];
      try { const m = g.move(san); u = toUci(m); g.undo(); } catch {}
    }
    if (!u && Math.random() < bot.rnd) u = toUci(ms[Math.random() * ms.length | 0]);
    if (!u) u = (await think(g.fen(), { skill: bot.skill, depth: bot.depth })).best;
    await sleep(Math.max(0, 550 - (Date.now() - t0)));
    if (id !== viewId || over) return;
    const m = g.move(uciMove(u)); board.last = [m.from, m.to]; moveSfx(g, m); board.locked = false; upd();
  }
  const board = new Board($('#board'), g, { orient: color, movable: c => c === color && !over, onMove(mv) {
    let r; try { r = g.move(mv); } catch { return board.render(); }
    board.last = [r.from, r.to]; moveSfx(g, r); upd(); botMove();
  } });
  acts(); upd(); botMove();
};

/* ---------- game review ---------- */
const KIND = { brilliant: ['!!', 'Brilliant'], best: ['★', 'Best'], excellent: ['!', 'Excellent'], good: ['✓', 'Good'], book: ['≡', 'Book'], inaccuracy: ['?!', 'Inaccuracy'], mistake: ['?', 'Mistake'], blunder: ['??', 'Blunder'] };
const SAY = { brilliant: 'is brilliant', best: 'is the best move', excellent: 'is excellent', good: 'is good', book: 'is a book move', inaccuracy: 'is an inaccuracy', mistake: 'is a mistake', blunder: 'is a blunder' };
const NOTE = { brilliant: 'A sacrifice that is also the best move.', best: 'The strongest move in the position.', excellent: 'Almost as good as the best move.', good: 'A decent move.', book: 'A known opening move.', inaccuracy: 'There was something better.', mistake: 'This gives away part of the advantage.', blunder: 'A serious error.' };
views.review = async () => {
  const L = S.last; if (!L) return goto('play');
  const id = viewId, bot = BOTS.find(b => b.id === L.bot), g0 = new Chess(), fens = [g0.fen()], moves = [];
  for (const s of L.sans) { moves.push(g0.move(s)); fens.push(g0.fen()); }
  const n = moves.length;
  screen('Game review', { back: 'play', body: stage('<div id="rv"><div class="bar"><i id="rbar" style="width:0"></i></div></div>', { pre: evalBar }) });
  const board = new Board($('#board'), new Chess(), { orient: L.color, movable: () => false });
  coach('Reviewing your game', `Checking every move with ${eng.name}.`);
  const ev = [];
  for (let i = 0; i <= n; i++) {
    ev[i] = await think(fens[i], { depth: 10 }); if (id !== viewId) return;
    $('#rbar').style.width = 100 * i / n + '%';
  }
  const bk = await book(); if (id !== viewId) return;
  const o = opening(bk, L.sans), kinds = [], acc = { w: [], b: [] }, count = { w: {}, b: {} };
  moves.forEach((m, i) => {
    const s = m.color === 'w' ? 1 : -1, before = winPct(s * ev[i].cp), after = winPct(s * ev[i + 1].cp), loss = Math.max(0, before - after);
    let k;
    if (i < o.plies) k = 'book';
    else if (toUci(m) === ev[i].best) {
      const t = new Chess(fens[i + 1]), att = t.attackers(m.to, m.color === 'w' ? 'b' : 'w'), def = t.attackers(m.to, m.color);
      const sac = m.piece !== 'p' && att.length && (!def.length || att.some(a => VAL[t.get(a).type] < VAL[m.piece])) && !(m.captured && VAL[m.captured] >= VAL[m.piece]);
      k = sac && before < 97 && after > 45 ? 'brilliant' : 'best';
    } else k = loss < 2 ? 'excellent' : loss < 5 ? 'good' : loss < 10 ? 'inaccuracy' : loss < 20 ? 'mistake' : 'blunder';
    kinds.push(k); count[m.color][k] = (count[m.color][k] || 0) + 1;
    acc[m.color].push(Math.max(0, Math.min(100, 103.1668 * Math.exp(-0.04354 * loss) - 3.1669)));
  });
  const avg = a => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0), me = L.color, them = me === 'w' ? 'b' : 'w', myAcc = avg(acc[me]);
  S.acc.push(Math.round(myAcc)); if (S.acc.length > 50) S.acc.shift(); save(); checkAwards();
  const W = 300, H = 64, pts = ev.map((e, i) => `${(i / Math.max(1, n) * W).toFixed(1)},${(H - winPct(e.cp) / 100 * H).toFixed(1)}`).join(' ');
  $('#rv').innerHTML = `
    <div class="accrow"><div><small>${esc(S.name)}</small><b>${myAcc.toFixed(1)}</b><small>accuracy</small></div><div><small>${bot.name}</small><b>${avg(acc[them]).toFixed(1)}</b><small>accuracy</small></div></div>
    <svg class="graph" id="graph" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><rect width="${W}" height="${H}" class="gb"/><polygon class="gw" points="0,${H} ${pts} ${W},${H}"/><line id="gl" y1="0" y2="${H}" x1="0" x2="0"/></svg>
    <table class="kinds">${Object.keys(KIND).map(k => `<tr><td>${count[me][k] || 0}</td><td><span class="badge static k-${k}">${KIND[k][0]}</span> ${KIND[k][1]}</td><td>${count[them][k] || 0}</td></tr>`).join('')}</table>
    <div class="moves" id="moves"></div>
    <div class="row navrow"><button class="btn grow" data-go="0">${ic('first')}</button><button class="btn grow" data-go="-">${ic('back')}</button><button class="btn grow" data-go="+">${ic('next')}</button><button class="btn grow" data-go="e">${ic('last')}</button></div>
    <div class="row"><button class="btn grow" id="toan">${ic('search')} Analysis board</button><a class="btn primary grow" href="#play">New game</a></div>`;
  let k = 0;
  const show = to => {
    k = Math.max(0, Math.min(n, to));
    board.game = new Chess(fens[k]); board.arrows = []; board.badge = null; board.last = [];
    setEval(ev[k]); $('#gl').setAttribute('x1', k / Math.max(1, n) * W); $('#gl').setAttribute('x2', k / Math.max(1, n) * W);
    const mv = $('#moves'); mv.innerHTML = moveList(L.sans, k); const on = mv.querySelector('.on'); if (on) mv.scrollTop = on.offsetTop - mv.offsetTop - 40;
    if (!k) { coach(`Accuracy ${myAcc.toFixed(1)}`, o.name ? `Opening: ${o.name}. Step through the moves below.` : 'Step through the moves below.'); return board.render(); }
    const m = moves[k - 1], kind = kinds[k - 1], best = ev[k - 1].best;
    board.last = [m.from, m.to]; board.badge = { sq: m.to, cls: 'k-' + kind, t: KIND[kind][0] };
    let extra = '';
    if (!['best', 'brilliant', 'book'].includes(kind) && best) {
      board.arrows = [{ from: best.slice(0, 2), to: best.slice(2, 4), color: 'var(--good)' }];
      try { extra = ` Best was <b>${new Chess(fens[k - 1]).move(uciMove(best)).san}</b>.`; } catch {}
    }
    coach(`${Math.ceil(k / 2)}${m.color === 'w' ? '.' : '...'} ${m.san} ${SAY[kind]}`, NOTE[kind] + extra + ` <span class="muted">Eval ${evalText(ev[k])}</span>`, ['inaccuracy', 'mistake', 'blunder'].includes(kind) ? 'bad' : 'good');
    board.render();
  };
  $('.navrow').onclick = e => { const b = e.target.closest('[data-go]'); if (!b) return; const v = b.dataset.go; show(v === '0' ? 0 : v === 'e' ? n : k + (v === '+' ? 1 : -1)); if (k) sfx('move'); };
  $('#moves').onclick = e => { const a = e.target.closest('[data-k]'); if (a) show(+a.dataset.k); };
  $('#graph').onclick = e => { const r = e.currentTarget.getBoundingClientRect(); show(Math.round((e.clientX - r.left) / r.width * n)); };
  $('#toan').onclick = () => { ctx.analysis = { sans: L.sans.slice(0, k), all: L.sans }; goto('analysis'); };
  const key = e => { if (e.key === 'ArrowRight') show(k + 1); if (e.key === 'ArrowLeft') show(k - 1); };
  addEventListener('keydown', key); cleanups.push(() => removeEventListener('keydown', key));
  show(0);
};

/* ---------- analysis board ---------- */
views.analysis = () => {
  const id = viewId, init = ctx.analysis || {}; ctx.analysis = null;
  let start = init.fen || START, sans = [...(init.all || init.sans || [])], ply = (init.sans || []).length, g, tk = 0, bk = null;
  screen('Analysis', { back: 'more', body: stage(`
    <div class="small muted" id="opn"></div><div class="pv" id="pv">Engine starting</div><div class="moves" id="moves"></div>
    <div class="row navrow"><button class="btn grow" data-go="0">${ic('first')}</button><button class="btn grow" data-go="-">${ic('back')}</button><button class="btn grow" data-go="+">${ic('next')}</button><button class="btn grow" data-go="e">${ic('last')}</button></div>
    <div class="row"><button class="btn grow" id="flip">${ic('flip')} Flip</button><button class="btn grow" id="reset">${ic('plus')} New</button><button class="btn grow" id="toex">${ic('compass')} Explorer</button></div>
    <label class="small muted" for="fen">Paste a FEN position or a PGN game</label>
    <textarea class="fen" id="fen" rows="2" spellcheck="false" autocomplete="off"></textarea><button class="btn" id="load">Load</button>`, { pre: evalBar }) });
  const board = new Board($('#board'), new Chess(), { onMove(m) {
    let r; try { r = g.move(m); } catch { return board.render(); }
    sans = sans.slice(0, ply); sans.push(r.san); ply++; moveSfx(g, r); refresh();
  } });
  book().then(b => { bk = b; if (id === viewId) names(); });
  const names = () => { if (!bk || start !== START) return; const o = opening(bk, sans.slice(0, ply)); $('#opn').textContent = o.name; };
  function refresh() {
    g = replay(start, sans, ply); board.game = g; board.arrows = [];
    const h = g.history({ verbose: true }), lm = h[h.length - 1]; board.last = lm ? [lm.from, lm.to] : [];
    board.render(); names();
    const mv = $('#moves'); mv.innerHTML = moveList(sans, ply);
    $('#fen').value = g.fen();
    coach(g.isCheckmate() ? 'Checkmate' : g.isDraw() ? 'Draw' : `${side(g.turn())} to move`, g.isCheck() && !g.isCheckmate() ? 'Check.' : 'Move the pieces freely. The engine follows along.');
    const my = ++tk, fen = g.fen(); stop();
    const showInfo = r => {
      if (my !== tk || id !== viewId || !r) return;
      setEval(r);
      const t = new Chess(fen), out = [];
      for (const u of r.pv.slice(0, 6)) { try { out.push(t.move(uciMove(u)).san); } catch { break; } }
      $('#pv').innerHTML = r.best === null ? 'Game over' : `<b>${evalText(r)}</b> depth ${r.depth} <span>${out.join(' ')}</span>`;
      if (r.pv[0]) { board.arrows = [{ from: r.pv[0].slice(0, 2), to: r.pv[0].slice(2, 4), color: 'var(--good)' }]; board.render(); }
    };
    think(fen, { depth: 15, onInfo: showInfo, skip: () => my !== tk || id !== viewId }).then(showInfo);
  }
  $('.navrow').onclick = e => { const b = e.target.closest('[data-go]'); if (!b) return; const v = b.dataset.go; ply = Math.max(0, Math.min(sans.length, v === '0' ? 0 : v === 'e' ? sans.length : ply + (v === '+' ? 1 : -1))); refresh(); };
  $('#moves').onclick = e => { const a = e.target.closest('[data-k]'); if (a) { ply = +a.dataset.k; refresh(); } };
  $('#flip').onclick = () => { board.orient = board.orient === 'w' ? 'b' : 'w'; board.render(); };
  $('#reset').onclick = () => { start = START; sans = []; ply = 0; refresh(); };
  $('#toex').onclick = () => { ctx.explorer = start === START ? sans.slice(0, ply) : []; goto('explorer'); };
  $('#load').onclick = () => {
    const t = $('#fen').value.trim();
    try {
      if (/^\S+\/\S+\/\S+/.test(t) && !/\d\./.test(t)) { new Chess(t); start = t; sans = []; ply = 0; }
      else { const p = new Chess(); p.loadPgn(t); start = START; sans = p.history(); ply = sans.length; }
      refresh();
    } catch { coach('Could not read that', 'Paste a full FEN position or a PGN move list.', 'bad'); }
  };
  const key = e => { if (e.target.tagName === 'TEXTAREA') return; if (e.key === 'ArrowRight' && ply < sans.length) { ply++; refresh(); } if (e.key === 'ArrowLeft' && ply) { ply--; refresh(); } };
  addEventListener('keydown', key); cleanups.push(() => { removeEventListener('keydown', key); tk++; stop(); });
  refresh();
};

/* ---------- opening explorer ---------- */
views.explorer = async () => {
  const id = viewId; let sans = ctx.explorer || []; ctx.explorer = null;
  screen('Opening explorer', { back: 'more', body: stage(`<div id="exl" class="exl"></div>
    <div class="row"><button class="btn grow" id="bk1">${ic('back')} Back</button><button class="btn grow" id="rs">${ic('first')} Start</button><button class="btn grow" id="an">${ic('search')} Analyse</button></div>`) });
  coach('Loading the opening book', '');
  const bk = await book(); if (id !== viewId) return;
  const first = n => n.n || Object.values(n.c).map(first).find(Boolean) || '';
  let g;
  const board = new Board($('#board'), new Chess(), { onMove(m) { let r; try { r = g.move(m); } catch { return board.render(); } sans.push(r.san); moveSfx(g, r); refresh(); } });
  function refresh() {
    g = replay(START, sans); board.game = g;
    const h = g.history({ verbose: true }), lm = h[h.length - 1]; board.last = lm ? [lm.from, lm.to] : []; board.render();
    const o = opening(bk, sans), n = sans.length;
    coach(o.name || 'Starting position', o.node ? `${lines(o.node).toLocaleString()} named lines from here. Pick a move or play one on the board.` : 'You have left the opening book.', o.node ? '' : 'bad');
    const kids = o.node ? Object.keys(o.node.c).sort((a, b) => lines(o.node.c[b]) - lines(o.node.c[a])) : [];
    $('#exl').innerHTML = kids.map(s => `<button class="orow" data-s="${s}"><b>${n % 2 ? Math.ceil(n / 2) + '...' : n / 2 + 1 + '.'} ${s}</b><span>${esc(first(o.node.c[s]))}</span><small>${lines(o.node.c[s]).toLocaleString()}</small></button>`).join('') || '<p class="muted">No book moves from this position.</p>';
  }
  $('#exl').onclick = e => { const b = e.target.closest('[data-s]'); if (!b) return; sans.push(b.dataset.s); sfx('move'); refresh(); };
  $('#bk1').onclick = () => { sans.pop(); refresh(); };
  $('#rs').onclick = () => { sans = []; refresh(); };
  $('#an').onclick = () => { ctx.analysis = { sans: [...sans] }; goto('analysis'); };
  refresh();
};
