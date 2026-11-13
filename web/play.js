// Play (computer or friend, with clocks), game review, watch famous games, analysis board and opening explorer.
import { $, main, S, save, views, ctx, cleanups, viewId, goto, ic, art, pimg, esc, screen, stage, coach, sfx, moveSfx, moveList, sleep, mini, confetti, celebrate, shake,
  Chess, uciMove, toUci, side, START, addXp, checkAwards, archive, book, opening, lines, BOTS, FRIEND, TCS, material } from './core.js';
import { Board, pieceUrl } from './board.js';
import { think, stop, eng, ready } from './engine.js';
import GAMES from './data/games.js';

const winPct = cp => 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
const evalText = r => (r.mate != null ? (r.mate === 0 ? '#' : (r.mate > 0 ? '+' : '-') + 'M' + Math.abs(r.mate)) : (r.cp > 0 ? '+' : '') + (r.cp / 100).toFixed(1));
const VAL = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 99 };
const evalBar = '<div class="evalbar"><i id="evw" style="width:50%"></i><b id="evt">0.0</b></div>';
function setEval(r) { const w = $('#evw'); if (!w || !r) return; w.style.width = winPct(r.cp) + '%'; $('#evt').textContent = evalText(r); }
const replay = (fen, sans, n = sans.length) => { const g = new Chess(fen); for (let k = 0; k < n; k++) g.move(sans[k]); return g; };
const fmt = ms => { const s = Math.max(0, Math.ceil(ms / 1000)); return s < 20 && ms < 20000 ? (Math.max(0, ms) / 1000).toFixed(1) : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const who = id => BOTS.find(b => b.id === id) || FRIEND;

/* ---------- play setup ---------- */
views.play = () => {
  let color = 'r';
  screen('Play', { back: 'home', body: `
    <div class="card setup">
      <div class="between"><b>Time control</b><div class="seg" id="tc">${Object.entries(TCS).map(([k, v]) => `<button data-v="${k}" class="${S.tc === k ? 'on' : ''}">${k === 'none' ? '' : ic('clock')}${v[0]}</button>`).join('')}</div></div>
      <div class="between"><b>Play as</b><div class="seg" id="col"><button data-v="w">${pimg('wK')}</button><button data-v="r" class="on">Random</button><button data-v="b">${pimg('bK')}</button></div></div>
    </div>
    <h2>Play the computer</h2>
    <div class="bots">${BOTS.map((b, i) => `<button class="bot" data-id="${b.id}" style="--d:${i}"><span class="avatar" style="background:${b.col}">${pimg('w' + b.pc)}</span>
      <span class="t"><span class="nm"><b>${b.name}</b><span class="chip">${b.r}</span></span><small>${b.blurb}</small></span>${S.bots[b.id] ? `<span class="donemark">${ic('check')}</span>` : ic('next')}</button>`).join('')}</div>
    <h2>Play a friend</h2>
    <button class="bot" data-id="friend">${art('friends', 'lg')}<span class="t"><b>Pass and play</b><small>Two players on this device. Unrated.</small></span>${ic('next')}</button>
    <p class="muted small">Engine: <span id="engn">loading</span>. Computer games are rated unless you use a hint or take a move back.</p>` });
  $('#tc').onclick = e => { const b = e.target.closest('button'); if (!b) return; S.tc = b.dataset.v; save(); $('#tc').querySelectorAll('button').forEach(k => k.classList.toggle('on', k === b)); };
  $('#col').onclick = e => { const b = e.target.closest('button'); if (!b) return; color = b.dataset.v; $('#col').querySelectorAll('button').forEach(k => k.classList.toggle('on', k === b)); };
  main.querySelectorAll('.bot').forEach(b => (b.onclick = () => { ctx.game = { bot: who(b.dataset.id), color, tc: S.tc }; goto('game'); }));
  ready.then(e => { const n = $('#engn'); if (n) n.textContent = e.name; });
};

/* ---------- a game ---------- */
views.game = () => {
  if (!ctx.game) return goto('play');
  const id = viewId, { bot } = ctx.game, friend = bot.id === 'friend', tc = TCS[ctx.game.tc || 'none'];
  const color = friend ? 'w' : ctx.game.color === 'r' ? (Math.random() < 0.5 ? 'w' : 'b') : ctx.game.color, opp = color === 'w' ? 'b' : 'w';
  const g = new Chess(); let over = false, assisted = friend, bk = null, lowWarned = { w: false, b: false };
  const clock = tc[1] ? { w: tc[1] * 1000, b: tc[1] * 1000, inc: tc[2] * 1000, t0: 0, on: false } : null;
  book().then(b => { bk = b; });
  screen(friend ? 'Pass and play' : `You vs ${bot.name}`, { back: 'play', body: stage(`<div class="small muted" id="opn">Starting position</div><div class="moves" id="moves"></div><div class="row" id="gact"></div>`, { bars: true }) });
  const used = c => (clock && clock.on && g.turn() === c && !over ? Date.now() - clock.t0 : 0);
  const left = c => clock[c] - used(c);
  const bar = (label, c) => {
    const m = material(g), diff = c === 'w' ? m.diff : -m.diff, taken = m.lost[c === 'w' ? 'b' : 'w'];
    return `${label}<span class="caps">${taken.map(t => pimg((c === 'w' ? 'b' : 'w') + t.toUpperCase())).join('')}${diff > 0 ? `<b>+${diff}</b>` : ''}</span>` +
      (clock ? `<span class="clock ${g.turn() === c && !over ? 'run' : ''} ${left(c) < 20000 ? 'low' : ''}" id="ck${c}">${fmt(left(c))}</span>` : '');
  };
  const me = `<span class="avatar sm">${pimg('wP')}</span><b>${esc(friend ? 'White' : S.name)}</b>${friend ? '' : `<span class="chip">${S.gr}</span>`}`;
  const them = friend ? `<span class="avatar sm" style="background:#555">${pimg('bP')}</span><b>Black</b>` : `<span class="avatar sm" style="background:${bot.col}">${pimg('w' + bot.pc)}</span><b>${bot.name}</b><span class="chip">${bot.r}</span>`;
  const bars = () => { $('#pt').innerHTML = bar(them, opp); $('#pb').innerHTML = bar(me, color); };
  const upd = () => {
    bars();
    const h = g.history(), mv = $('#moves'); mv.innerHTML = moveList(h, h.length); mv.scrollTop = mv.scrollHeight;
    if (bk) { const o = opening(bk, h); if (o.name) $('#opn').textContent = o.name; }
    board.render();
    if (over) return;
    if (g.isCheckmate()) return finish(g.turn() === color ? 'l' : 'w', 'Checkmate');
    if (g.isDraw()) return finish('d', g.isStalemate() ? 'Stalemate' : g.isThreefoldRepetition() ? 'Draw by repetition' : g.isInsufficientMaterial() ? 'Draw by insufficient material' : 'Draw by the 50-move rule');
    if (friend) return coach(`${side(g.turn())} to Move`, g.isCheck() ? 'Check!' : 'Pass the device to your friend.');
    coach(g.turn() === color ? 'Your move' : `${bot.name} is thinking…`, g.isCheck() ? 'Check!' : `You play ${side(color)}.`);
  };
  if (clock) {
    const tick = setInterval(() => {
      if (over || !clock.on) return;
      const c = g.turn(), l = left(c), el = $('#ck' + c);
      if (el) { el.textContent = fmt(l); el.classList.toggle('low', l < 20000); }
      if (l < 10000 && !lowWarned[c] && (friend || c === color)) { lowWarned[c] = true; sfx('low'); }
      if (l <= 0) { clock[c] = 0; finish(c === color ? 'l' : 'w', `${friend ? side(c) : c === color ? 'You' : bot.name} ran out of time`); }
    }, 100);
    cleanups.push(() => clearInterval(tick));
  }
  function pressClock(c) {
    if (!clock) return;
    if (clock.on) clock[c] = clock[c] - (Date.now() - clock.t0) + clock.inc;
    clock.on = g.history().length >= (friend ? 2 : 1) || clock.on; clock.t0 = Date.now();
  }
  const acts = () => {
    $('#gact').innerHTML = over
      ? `${friend ? '' : `<button class="btn primary big grow" id="rev">${art('search')} Game Review</button>`}<button class="btn grow" id="again">Rematch</button><a class="btn grow" href="#play">New game</a>`
      : `${friend ? `<button class="btn grow" id="flip">${ic('flip')} Flip</button>` : `<button class="btn grow" id="hint">${art('bulb')} Hint</button>`}<button class="btn grow" id="undo">${ic('undo')} Take back</button><button class="btn grow" id="res">${ic('flag')} ${friend ? 'End' : 'Resign'}</button>`;
    if (over) { if (!friend) $('#rev').onclick = () => { ctx.review = 0; goto('review'); }; $('#again').onclick = () => goto('game'); return; }
    $('#undo').onclick = () => {
      if (board.locked || !g.history().length) return;
      assisted = true; g.undo(); if (!friend && g.turn() !== color && g.history().length) g.undo();
      board.last = []; upd();
    };
    $('#res').onclick = () => { if (g.history().length) finish(friend ? 'd' : 'l', friend ? 'Game ended' : 'You resigned'); };
    if (friend) $('#flip').onclick = () => { board.orient = board.orient === 'w' ? 'b' : 'w'; board.render(); };
    else $('#hint').onclick = async () => {
      if (board.locked || g.turn() !== color) return;
      assisted = true; const r = await think(g.fen(), { depth: 12 }); if (id !== viewId || over || !r.best) return;
      board.arrows = [{ from: r.best.slice(0, 2), to: r.best.slice(2, 4) }]; board.render();
    };
  };
  function finish(res, why) {
    if (over) return;
    over = true; let d = 0;
    if (!assisted) { const exp = 1 / (1 + 10 ** ((bot.r - S.gr) / 400)); d = Math.round(32 * ({ w: 1, d: 0.5, l: 0 }[res] - exp)); S.gr = Math.max(100, S.gr + d); S.grh.push(S.gr); if (S.grh.length > 200) S.grh.shift(); }
    if (!friend) { S.rec[res]++; if (res === 'w') S.bots[bot.id] = 1; addXp(res === 'w' ? 20 : 8); }
    archive({ sans: g.history(), color, bot: bot.id, res, tc: ctx.game.tc || 'none', rated: !assisted });
    save(); bars();
    if (friend) { sfx('notify'); coach(res === 'd' ? 'Game over' : `${side(res === 'w' ? color : opp)} wins!`, `${why}.`, 'good'); }
    else {
      sfx(res === 'w' ? 'win' : res === 'l' ? 'lose' : 'draw');
      if (res === 'w') confetti(180);
      coach(res === 'w' ? 'You won!' : res === 'l' ? `${bot.name} won` : 'Draw', `${why}. ${assisted ? 'Unrated game.' : `Rating ${d >= 0 ? '+' : ''}${d}, now ${S.gr}.`}`, res === 'l' ? 'bad' : 'good done');
      showResult(res, why, d);
    }
    acts(); checkAwards(); board.render();
  }
  function showResult(res, why, d) {
    const o = document.createElement('div'); o.className = 'celebrate';
    o.innerHTML = `<div class="ccard result r-${res}"><div class="rhead">${res === 'w' ? art('trophy', 'huge') : res === 'l' ? `<span class="avatar xl" style="background:${bot.col}">${pimg('w' + bot.pc)}</span>` : art('watch', 'huge')}</div>
      <h2>${res === 'w' ? 'You Won!' : res === 'l' ? `${bot.name} Won` : 'Draw'}</h2><p>${why}</p>
      <div class="rstats"><div><small>Rating</small><b>${S.gr}</b>${assisted ? '<small>unrated</small>' : `<small class="${d >= 0 ? 'up' : 'down'}">${d >= 0 ? '+' : ''}${d}</small>`}</div><div><small>Moves</small><b>${Math.ceil(g.history().length / 2)}</b></div></div>
      <button class="btn primary big" id="crev">${art('search')} Game Review</button><button class="btn" id="cclose">Close</button></div>`;
    document.body.appendChild(o);
    const close = () => o.remove();
    o.onclick = e => { if (e.target === o) close(); };
    $('#cclose', o).onclick = close;
    $('#crev', o).onclick = () => { close(); ctx.review = 0; goto('review'); };
    cleanups.push(close);
  }
  async function botMove() {
    if (over || friend || g.turn() === color) return;
    board.locked = true; const t0 = Date.now(), ms = g.moves({ verbose: true }), h = g.history();
    let u = null;
    const o = bk && h.length < 12 && bot.r >= 1000 ? opening(bk, h).node : null, kids = o ? Object.keys(o.c) : [];
    if (kids.length) {
      let pick = Math.random() * kids.reduce((s, k) => s + lines(o.c[k]), 0);
      const san = kids.find(k => (pick -= lines(o.c[k])) <= 0) || kids[0];
      try { const m = g.move(san); u = toUci(m); g.undo(); } catch {}
    }
    if (!u && Math.random() < bot.rnd) u = toUci(ms[Math.random() * ms.length | 0]);
    if (!u) { const quick = clock && left(g.turn()) < 15000; u = (await think(g.fen(), { skill: bot.skill, depth: quick ? Math.min(bot.depth, 4) : bot.depth })).best; }
    await sleep(Math.max(0, (clock ? 300 : 500) + Math.random() * 400 - (Date.now() - t0)));
    if (id !== viewId || over) return;
    const m = g.move(uciMove(u)); pressClock(m.color); board.last = [m.from, m.to]; moveSfx(g, m); board.locked = false; upd();
  }
  const board = new Board($('#board'), g, { orient: color, movable: c => (friend || c === color) && !over, onMove(mv) {
    let r; try { r = g.move(mv); } catch { return board.render(); }
    pressClock(r.color); board.last = [r.from, r.to]; moveSfx(g, r); upd(); botMove();
  } });
  sfx('notify'); acts(); upd(); botMove();
};

/* ---------- game review ---------- */
const KIND = { brilliant: ['!!', 'Brilliant'], great: ['!', 'Great'], best: ['★', 'Best'], excellent: ['✓✓', 'Excellent'], good: ['✓', 'Good'], book: ['≡', 'Book'], inaccuracy: ['?!', 'Inaccuracy'], mistake: ['?', 'Mistake'], miss: ['✗', 'Miss'], blunder: ['??', 'Blunder'] };
const SAY = { brilliant: 'is brilliant', great: 'is a great move', best: 'is the best move', excellent: 'is excellent', good: 'is good', book: 'is a book move', inaccuracy: 'is an inaccuracy', mistake: 'is a mistake', miss: 'is a miss', blunder: 'is a blunder' };
const NOTE = { brilliant: 'A strong sacrifice that is also the best move.', great: 'The only good move in a critical position.', best: 'The strongest move in the position.', excellent: 'Almost as good as the best move.', good: 'A decent move.', book: 'A known opening move.', inaccuracy: 'There was something better.', mistake: 'This gives away part of the advantage.', miss: 'You missed a chance to win material or the game.', blunder: 'A serious error.' };
const BAD = ['inaccuracy', 'mistake', 'miss', 'blunder'];
views.review = async () => {
  const L = S.games[ctx.review || 0]; if (!L) return goto('play');
  const id = viewId, bot = who(L.bot), g0 = new Chess(), fens = [g0.fen()], moves = [];
  for (const s of L.sans) { moves.push(g0.move(s)); fens.push(g0.fen()); }
  const n = moves.length;
  screen('Game Review', { back: 'home', body: stage(`<div id="rv"><p class="muted small">Analysing ${n} moves with ${eng.name}…</p><div class="bar"><i id="rbar" style="width:0"></i></div></div>`, { pre: evalBar }) });
  const board = new Board($('#board'), new Chess(), { orient: L.color, movable: () => false });
  coach('Reviewing your game', 'Give me a moment to check every move.');
  const ev = [];
  for (let i = 0; i <= n; i++) {
    ev[i] = await think(fens[i], { depth: 11, multipv: 2 }); if (id !== viewId) return;
    $('#rbar').style.width = 100 * i / Math.max(1, n) + '%';
  }
  const bk = await book(); if (id !== viewId) return;
  const o = opening(bk, L.sans), kinds = [], acc = { w: [], b: [] }, count = { w: {}, b: {} };
  moves.forEach((m, i) => {
    const s = m.color === 'w' ? 1 : -1, before = winPct(s * ev[i].cp), after = winPct(s * ev[i + 1].cp), loss = Math.max(0, before - after);
    const second = ev[i].alt != null ? winPct(s * ev[i].alt) : before;
    let k;
    if (i < o.plies) k = 'book';
    else if (toUci(m) === ev[i].best) {
      const t = new Chess(fens[i + 1]), att = t.attackers(m.to, m.color === 'w' ? 'b' : 'w'), def = t.attackers(m.to, m.color);
      const sac = m.piece !== 'p' && att.length && (!def.length || att.some(a => VAL[t.get(a).type] < VAL[m.piece])) && !(m.captured && VAL[m.captured] >= VAL[m.piece]);
      k = sac && before < 97 && after > 45 ? 'brilliant' : before - second > 18 && after > 40 && after < 97 ? 'great' : 'best';
    } else if (loss < 2) k = 'excellent';
    else if (loss < 5) k = 'good';
    else if (before > 60 && loss >= 10 && after > 45 && ev[i].mate != null) k = 'miss';
    else k = loss < 10 ? 'inaccuracy' : loss < 20 ? 'mistake' : 'blunder';
    kinds.push(k); count[m.color][k] = (count[m.color][k] || 0) + 1;
    acc[m.color].push(Math.max(0, Math.min(100, 103.1668 * Math.exp(-0.04354 * loss) - 3.1669)));
  });
  const avg = a => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0), me = L.color, them = me === 'w' ? 'b' : 'w', myAcc = avg(acc[me]);
  if (!L.acc) { L.acc = Math.round(myAcc); S.acc.push(L.acc); if (S.acc.length > 50) S.acc.shift(); save(); checkAwards(); }
  const W = 300, H = 64, pts = ev.map((e, i) => `${(i / Math.max(1, n) * W).toFixed(1)},${(H - winPct(e.cp) / 100 * H).toFixed(1)}`).join(' ');
  const dots = kinds.map((k, i) => (['brilliant', 'great', 'blunder', 'mistake', 'miss'].includes(k) ? `<circle class="gd k-${k}" cx="${((i + 1) / Math.max(1, n) * W).toFixed(1)}" cy="${(H - winPct(ev[i + 1].cp) / 100 * H).toFixed(1)}" r="3.5"/>` : '')).join('');
  $('#rv').innerHTML = `
    <div class="accrow"><div><span class="avatar sm">${pimg('wP')}</span><small>${esc(S.name)}</small><b class="accn">${myAcc.toFixed(1)}</b><small>Accuracy</small></div><div><span class="avatar sm" style="background:${bot.col}">${pimg('w' + bot.pc)}</span><small>${bot.name}</small><b class="accn">${avg(acc[them]).toFixed(1)}</b><small>Accuracy</small></div></div>
    <svg class="graph" id="graph" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><rect width="${W}" height="${H}" class="gb"/><polygon class="gw" points="0,${H} ${pts} ${W},${H}"/><line class="gm" x1="0" x2="${W}" y1="${H / 2}" y2="${H / 2}"/>${dots}<line id="gl" y1="0" y2="${H}" x1="0" x2="0"/></svg>
    <table class="kinds">${Object.keys(KIND).map(k => `<tr><td>${count[me][k] || 0}</td><td><span class="badge static k-${k}">${KIND[k][0]}</span> ${KIND[k][1]}</td><td>${count[them][k] || 0}</td></tr>`).join('')}</table>
    <div class="moves" id="moves"></div>
    <div class="row navrow nowrap"><button class="btn grow" data-go="0">${ic('first')}</button><button class="btn grow" data-go="-">${ic('back')}</button><button class="btn grow" data-go="+">${ic('next')}</button><button class="btn grow" data-go="e">${ic('last')}</button><button class="btn grow" data-go="x" title="Next mistake">${ic('flag')}</button></div>
    <div class="row"><button class="btn grow" id="toan">${art('search')} Analysis</button><a class="btn primary grow" href="#play">New Game</a></div>`;
  let k = 0;
  const show = to => {
    k = Math.max(0, Math.min(n, to));
    board.game = new Chess(fens[k]); board.arrows = []; board.badge = null; board.last = [];
    setEval(ev[k]); $('#gl').setAttribute('x1', k / Math.max(1, n) * W); $('#gl').setAttribute('x2', k / Math.max(1, n) * W);
    const mv = $('#moves'); mv.innerHTML = moveList(L.sans, k, kinds); const on = mv.querySelector('.on'); if (on) mv.scrollTop = on.offsetTop - mv.offsetTop - 40;
    if (!k) { coach(`Accuracy ${myAcc.toFixed(1)}`, (o.name ? `Opening: ${o.name}. ` : '') + 'Step through the moves, or jump to your next mistake with the flag.'); return board.render(); }
    const m = moves[k - 1], kind = kinds[k - 1], best = ev[k - 1].best;
    board.last = [m.from, m.to]; board.badge = { sq: m.to, cls: 'k-' + kind, t: KIND[kind][0] };
    let extra = '';
    if (!['best', 'brilliant', 'great', 'book'].includes(kind) && best) {
      board.arrows = [{ from: best.slice(0, 2), to: best.slice(2, 4), color: 'var(--good)' }];
      try { extra = ` Best was <b>${new Chess(fens[k - 1]).move(uciMove(best)).san}</b>.`; } catch {}
    }
    coach(`${m.san} ${SAY[kind]}`, NOTE[kind] + extra + ` <span class="muted">Eval ${evalText(ev[k])}</span>`, BAD.includes(kind) ? 'bad' : 'good');
    board.render();
    if (kind === 'brilliant' && m.color === me) brilliantCard(m);
  };
  const nextBad = () => { for (let j = k; j < n; j++) if (moves[j].color === me && BAD.includes(kinds[j])) return j + 1; return k; };
  $('.navrow').onclick = e => { const b = e.target.closest('[data-go]'); if (!b) return; const v = b.dataset.go; show(v === '0' ? 0 : v === 'e' ? n : v === 'x' ? nextBad() : k + (v === '+' ? 1 : -1)); if (k) sfx(moves[k - 1].captured ? 'capture' : 'move'); };
  $('#moves').onclick = e => { const a = e.target.closest('[data-k]'); if (a) show(+a.dataset.k); };
  $('#graph').onclick = e => { const r = e.currentTarget.getBoundingClientRect(); show(Math.round((e.clientX - r.left) / r.width * n)); };
  $('#toan').onclick = () => { ctx.analysis = { sans: L.sans.slice(0, k), all: L.sans }; goto('analysis'); };
  const key = e => { if (e.key === 'ArrowRight') show(k + 1); if (e.key === 'ArrowLeft') show(k - 1); };
  addEventListener('keydown', key); cleanups.push(() => removeEventListener('keydown', key));
  show(0);
  const firstBrill = kinds.findIndex((x, i) => x === 'brilliant' && moves[i].color === me);
  if (firstBrill >= 0) setTimeout(() => { if (id === viewId) show(firstBrill + 1); }, 400);
};
function brilliantCard(m) {
  const o = document.createElement('div'); o.className = 'celebrate';
  o.innerHTML = `<div class="ccard brill"><span class="avatar xl">${pimg('wP')}</span><b>${esc(S.name)}</b>
    <div class="bmove"><span class="badge static k-brilliant big">!!</span><img src="${pieceUrl(m.color + m.piece.toUpperCase())}" alt=""><span>${m.san.replace(/^[KQRBN]/, '')}</span></div><h2>Brilliant Move!</h2><button class="btn primary">Nice</button></div>`;
  o.onclick = () => o.remove(); document.body.appendChild(o); confetti(140); sfx('level');
}

/* ---------- watch famous games ---------- */
views.watch = () => {
  screen('Watch', { body: `<p class="muted">Replay the most famous games in chess history, with Stockfish 19 commentary on the evaluation.</p>
    <div class="grid2">${GAMES.map((x, i) => `<button class="card wgame" data-i="${i}" style="--d:${i}">${mini(replay(START, x.pgn.split(' ')).fen())}
      <span class="t"><b>${x.title}</b><small>${x.white} vs ${x.black}</small><small>${x.event}, ${x.year} · ${x.res}</small>${S.watched[x.id] ? `<span class="chip">${ic('check')} Watched</span>` : ''}</span></button>`).join('')}</div>` });
  main.querySelectorAll('.wgame').forEach(b => (b.onclick = () => { ctx.watch = +b.dataset.i; goto('replay'); }));
};
views.replay = () => {
  const G = GAMES[ctx.watch || 0], id = viewId, sans = G.pgn.split(' '), n = sans.length;
  let k = 0, auto = null, tk = 0;
  screen(G.title, { back: 'watch', body: stage(`<div class="small muted">${G.white} vs ${G.black} · ${G.event}, ${G.year} · ${G.res}</div><div class="pv" id="pv"></div><div class="moves" id="moves"></div>
    <div class="row navrow nowrap"><button class="btn grow" data-go="0">${ic('first')}</button><button class="btn grow" data-go="-">${ic('back')}</button><button class="btn primary grow" id="auto">${ic('go')}</button><button class="btn grow" data-go="+">${ic('next')}</button><button class="btn grow" data-go="e">${ic('last')}</button></div>
    <button class="btn" id="toan">${art('search')} Open in analysis</button>`, { pre: evalBar, bars: true }) });
  const board = new Board($('#board'), new Chess(), { movable: () => false });
  $('#pt').innerHTML = `<span class="avatar sm" style="background:#555">${pimg('bK')}</span><b>${G.black}</b>`;
  $('#pb').innerHTML = `<span class="avatar sm">${pimg('wK')}</span><b>${G.white}</b>`;
  const show = to => {
    k = Math.max(0, Math.min(n, to));
    const g = replay(START, sans, k); board.game = g; const h = g.history({ verbose: true }), lm = h[h.length - 1];
    board.last = lm ? [lm.from, lm.to] : []; board.arrows = []; board.render();
    if (lm) moveSfx(g, lm);
    const mv = $('#moves'); mv.innerHTML = moveList(sans, k); const on = mv.querySelector('.on'); if (on) mv.scrollTop = on.offsetTop - mv.offsetTop - 40;
    if (k === n) { coach(G.res === '1-0' ? 'White wins' : G.res === '0-1' ? 'Black wins' : 'Draw', g.isCheckmate() ? 'Checkmate on the board.' : 'The loser resigned here.', 'good done'); if (!S.watched[G.id]) { S.watched[G.id] = 1; addXp(10); save(); checkAwards(); } stopAuto(); }
    else coach(k ? `${Math.ceil(k / 2)}${k % 2 ? '.' : '...'} ${sans[k - 1]}` : G.title, k ? 'Press play to keep watching, or step with the arrows.' : G.blurb);
    const my = ++tk, fen = g.fen(); stop();
    think(fen, { depth: 12, skip: () => my !== tk || id !== viewId }).then(r => {
      if (my !== tk || id !== viewId || !r) return; setEval(r);
      const t = new Chess(fen), out = []; for (const u of r.pv.slice(0, 5)) { try { out.push(t.move(uciMove(u)).san); } catch { break; } }
      $('#pv').innerHTML = r.best ? `<b>${evalText(r)}</b> Engine line: <span>${out.join(' ')}</span>` : '';
    });
  };
  const stopAuto = () => { clearInterval(auto); auto = null; const a = $('#auto'); if (a) a.innerHTML = ic('go'); };
  $('#auto').onclick = () => { if (auto) return stopAuto(); if (k >= n) show(0); auto = setInterval(() => show(k + 1), 1300); $('#auto').innerHTML = ic('pause'); };
  $('.navrow').onclick = e => { const b = e.target.closest('[data-go]'); if (!b) return; stopAuto(); const v = b.dataset.go; show(v === '0' ? 0 : v === 'e' ? n : k + (v === '+' ? 1 : -1)); };
  $('#moves').onclick = e => { const a = e.target.closest('[data-k]'); if (a) { stopAuto(); show(+a.dataset.k); } };
  $('#toan').onclick = () => { ctx.analysis = { sans: sans.slice(0, k), all: sans }; goto('analysis'); };
  cleanups.push(() => { clearInterval(auto); tk++; stop(); });
  show(0);
};

/* ---------- analysis board ---------- */
views.analysis = () => {
  const id = viewId, init = ctx.analysis || {}; ctx.analysis = null;
  let start = init.fen || START, sans = [...(init.all || init.sans || [])], ply = (init.sans || []).length, g, tk = 0, bk = null;
  screen('Analysis', { back: 'more', body: stage(`
    <div class="small muted" id="opn"></div><div class="pv" id="pv">Engine starting</div><div class="moves" id="moves"></div>
    <div class="row navrow nowrap"><button class="btn grow" data-go="0">${ic('first')}</button><button class="btn grow" data-go="-">${ic('back')}</button><button class="btn grow" data-go="+">${ic('next')}</button><button class="btn grow" data-go="e">${ic('last')}</button></div>
    <div class="row"><button class="btn grow" id="flip">${ic('flip')} Flip</button><button class="btn grow" id="reset">${ic('plus')} New</button><button class="btn grow" id="toex">${art('compass')} Explorer</button></div>
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
    $('#moves').innerHTML = moveList(sans, ply);
    $('#fen').value = g.fen();
    coach(g.isCheckmate() ? 'Checkmate' : g.isDraw() ? 'Draw' : `${side(g.turn())} to Move`, g.isCheck() && !g.isCheckmate() ? 'Check.' : 'Move the pieces freely. Stockfish follows along.');
    const my = ++tk, fen = g.fen(); stop();
    const showInfo = r => {
      if (my !== tk || id !== viewId || !r) return;
      setEval(r);
      const t = new Chess(fen), out = [];
      for (const u of r.pv.slice(0, 6)) { try { out.push(t.move(uciMove(u)).san); } catch { break; } }
      $('#pv').innerHTML = r.best === null ? 'Game over' : `<b>${evalText(r)}</b> depth ${r.depth} <span>${out.join(' ')}</span>`;
      if (r.pv[0]) { board.arrows = [{ from: r.pv[0].slice(0, 2), to: r.pv[0].slice(2, 4), color: 'var(--good)' }]; board.render(); }
    };
    think(fen, { depth: 18, onInfo: showInfo, skip: () => my !== tk || id !== viewId }).then(showInfo);
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
    } catch { coach('Could not read that', 'Paste a full FEN position or a PGN move list.', 'bad'); shake(board.el); }
  };
  const key = e => { if (e.target.tagName === 'TEXTAREA') return; if (e.key === 'ArrowRight' && ply < sans.length) { ply++; refresh(); } if (e.key === 'ArrowLeft' && ply) { ply--; refresh(); } };
  addEventListener('keydown', key); cleanups.push(() => { removeEventListener('keydown', key); tk++; stop(); });
  refresh();
};

/* ---------- opening explorer ---------- */
views.explorer = async () => {
  const id = viewId; let sans = ctx.explorer || []; ctx.explorer = null;
  screen('Opening Explorer', { back: 'more', body: stage(`<div id="exl" class="exl"></div>
    <div class="row nowrap"><button class="btn grow" id="bk1">${ic('back')} Back</button><button class="btn grow" id="rs">${ic('first')} Start</button><button class="btn grow" id="an">${art('search')} Analyse</button></div>`) });
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
    const tot = kids.reduce((s, x) => s + lines(o.node.c[x]), 0) || 1;
    $('#exl').innerHTML = kids.map(s => `<button class="orow" data-s="${s}"><b>${n % 2 ? Math.ceil(n / 2) + '...' : n / 2 + 1 + '.'} ${s}</b><span>${esc(first(o.node.c[s]))}</span><small>${lines(o.node.c[s]).toLocaleString()}</small><i style="width:${100 * lines(o.node.c[s]) / tot}%"></i></button>`).join('') || '<p class="muted">No book moves from this position.</p>';
  }
  $('#exl').onclick = e => { const b = e.target.closest('[data-s]'); if (!b) return; sans.push(b.dataset.s); sfx('move'); refresh(); };
  $('#bk1').onclick = () => { sans.pop(); refresh(); };
  $('#rs').onclick = () => { sans = []; refresh(); };
  $('#an').onclick = () => { ctx.analysis = { sans: [...sans] }; goto('analysis'); };
  refresh();
};
