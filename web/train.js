// Home, puzzles, lessons, vision trainer and endgame drills.
import { $, main, S, save, views, ctx, cleanups, viewId, goto, ic, pimg, esc, screen, stage, coach, coachHtml, freshBoard, iso, mini, sfx, moveSfx, toast,
  Chess, LESSONS, uciMove, toUci, side, level, addXp, checkAwards, puzzles, dailyPuzzle, today, BOTS } from './core.js';
import { COURSES } from './lessons.js';
import { Board } from './board.js';
import { think } from './engine.js';

const THEMES = { mateIn1: 'Mate in 1', mateIn2: 'Mate in 2', fork: 'Forks', pin: 'Pins', skewer: 'Skewers', discoveredAttack: 'Discovered attacks', hangingPiece: 'Hanging pieces', backRankMate: 'Back-rank mates', sacrifice: 'Sacrifices', deflection: 'Deflection', trappedPiece: 'Trapped pieces', promotion: 'Promotion', kingsideAttack: 'Kingside attacks', defensiveMove: 'Defence', endgame: 'Endgames', opening: 'Openings' };
const themeName = t => THEMES[t] || t.replace(/([A-Z0-9])/g, ' $1').toLowerCase();
const xpBar = () => `<div class="bar"><i style="width:${S.xp % 100}%"></i></div>`;

/* ---------- home ---------- */
views.home = async () => {
  const id = viewId, done = LESSONS.filter(l => S.lessons[l.id]).length, next = LESSONS.find(l => !S.lessons[l.id]);
  const bot = BOTS.reduce((a, b) => (Math.abs(b.r - S.gr) < Math.abs(a.r - S.gr) ? b : a));
  const L = S.last, lb = L && BOTS.find(b => b.id === L.bot);
  main.innerHTML = `<div class="wrap">
    <div class="top">
      <a class="me" href="#stats"><span class="avatar">${pimg('wP')}</span><span><b>${esc(S.name)}</b><small>Level ${level()}</small></span></a>
      <span class="grow"></span>
      <span class="streak" title="Day streak">${ic('flame')}${S.days}</span>
      <a class="ibtn" href="#awards" aria-label="Awards">${ic('star')}</a>
      <a class="ibtn" href="#prefs" aria-label="Preferences">${ic('gear')}</a>
    </div>
    <div class="scroller">
      <a class="feat fpz" href="#puzzles">
        <span class="lvl">${level()}</span><b class="ft">Puzzles</b>
        <span class="row"><span class="big-num">${S.pr}</span><span class="streak">${ic('flame')}${S.pstreak}</span></span>
        ${xpBar()}<span class="btn primary">Solve</span>
      </a>
      <a class="feat fday" href="#daily"><div id="dmini"></div><span><b class="ft">Daily puzzle</b><small>${S.daily === today() ? 'Solved today' : 'New today'}</small></span></a>
      <a class="feat frush" href="#rush">${ic('bolt')}<b class="ft">Puzzle Rush</b><small>3 minutes, 3 strikes</small><span class="big-num">${S.rush}</span><small>best score</small></a>
    </div>
    <h2>Recommended opponent</h2>
    <button class="bot" id="rec"><span class="avatar" style="background:${bot.col}">${pimg('w' + bot.pc)}</span>
      <span class="t"><span class="nm"><b>${bot.name}</b><span class="chip">${bot.r}</span></span><small>${bot.blurb}</small><em class="tagline">Similar skill</em></span><span class="btn primary sq">${ic('play')}</span></button>
    <div class="between"><h2>Ratings</h2><a href="#stats">View all</a></div>
    <div class="scroller tiles">
      <a class="tile" href="#puzzles">${ic('puzzle')}<b>${S.pr}</b><small>Puzzles</small></a>
      <a class="tile" href="#play">${ic('play')}<b>${S.gr}</b><small>Games</small></a>
      <a class="tile" href="#rush">${ic('bolt')}<b>${S.rush || '-'}</b><small>Rush</small></a>
      <a class="tile" href="#vision">${ic('target')}<b>${S.vision || '-'}</b><small>Vision</small></a>
    </div>
    <h2>Keep learning</h2>
    <a class="card rowcard" href="#learn"><span class="tileic">${ic(next ? next.icon : 'learn')}</span>
      <span class="t"><b>${next ? next.title : 'All lessons complete'}</b><small>${next ? next.desc : 'Replay any lesson to keep the ideas fresh.'}</small>
      <div class="bar"><i style="width:${100 * done / LESSONS.length}%"></i></div></span>${ic('next')}</a>
    ${L ? `<h2>Last game</h2><a class="card rowcard" href="#review"><span class="avatar" style="background:${lb.col}">${pimg('w' + lb.pc)}</span>
      <span class="t"><b>${L.res === 'w' ? 'Won' : L.res === 'l' ? 'Lost' : 'Drew'} against ${lb.name}</b><small>${Math.ceil(L.sans.length / 2)} moves. Tap for a move-by-move review.</small></span>${ic('next')}</a>` : ''}
    <div class="cta"><a class="btn primary big grow" href="#play">Play</a></div>
  </div>`;
  $('#rec').onclick = () => { ctx.game = { bot, color: 'r' }; goto('game'); };
  const all = await puzzles(); if (id !== viewId) return;
  const d = dailyPuzzle(all);
  $('#dmini').innerHTML = mini(d.fen, d.fen.split(' ')[1] === 'w' ? 'b' : 'w');
};

/* ---------- puzzles hub ---------- */
views.puzzles = () => {
  const lv = level(), nodes = [lv + 3, lv + 2, lv + 1, lv, lv - 1].filter(n => n > 0), left = Math.ceil((100 - S.xp % 100) / 12);
  screen('Puzzles', { right: `<span class="lvl">${lv}</span>`, body: `
    <div class="scene">
      ${coachHtml(S.pstreak > 2 ? `${S.pstreak} in a row!` : 'Time to solve', `About ${left} clean solve${left === 1 ? '' : 's'} to reach level ${lv + 1}.`)}
      <div class="path">${nodes.map(n => `<div class="node">${n === lv ? `<span class="token">${pimg('wP')}</span>` : ''}${iso(n < lv ? 'done' : n === lv ? 'cur' : '', n < lv ? ic('check') : n)}</div>`).join('')}</div>
      <div class="scenefoot"><span class="big-num">${S.pr}</span><span class="streak">${ic('flame')}${S.pstreak}</span><span class="grow"></span><span class="muted small">${S.solved.length} solved</span></div>
      <div class="row">${xpBar()}<span class="lvl sm">${lv + 1}</span></div>
    </div>
    <div class="cta"><button class="btn primary big grow" id="solve">Solve puzzles</button></div>
    <h2>More ways to train</h2>
    <div class="grid2">
      <a class="card rowcard" href="#daily"><span class="tileic c2">${ic('cal')}</span><span class="t"><b>Daily puzzle</b><small>${S.daily === today() ? 'Solved today' : 'One new puzzle every day'}</small></span></a>
      <a class="card rowcard" href="#rush"><span class="tileic c3">${ic('bolt')}</span><span class="t"><b>Puzzle Rush</b><small>Best score ${S.rush}</small></span></a>
    </div>
    <h2>Practise a theme</h2>
    <div class="chips">${Object.keys(THEMES).map(t => `<button class="chipbtn" data-t="${t}">${THEMES[t]}</button>`).join('')}</div>` });
  $('#solve').onclick = () => { ctx.theme = null; goto('rated'); };
  $('.chips').onclick = e => { const b = e.target.closest('[data-t]'); if (b) { ctx.theme = b.dataset.t; goto('rated'); } };
};

/* ---------- solving ---------- */
async function puzzleRun(mode) {
  const id = viewId, all = await puzzles(); if (id !== viewId) return;
  const theme = mode === 'rated' ? ctx.theme : null;
  const rush = mode === 'rush' ? { score: 0, strikes: 0, t: 180, seen: new Set(), over: false } : null;
  screen(mode === 'rush' ? 'Puzzle Rush' : mode === 'daily' ? 'Daily puzzle' : theme ? THEMES[theme] : 'Puzzles',
    { back: 'puzzles', right: '<span class="chip lg" id="pinfo"></span>', body: stage('<div class="chips" id="pmeta"></div><div class="row" id="pact"></div>') });
  const info = () => {
    $('#pinfo').innerHTML = rush ? `${ic('bolt')}${rush.score} <span class="strikes">${'<i class="on"></i>'.repeat(rush.strikes)}${'<i></i>'.repeat(3 - rush.strikes)}</span> ${Math.floor(rush.t / 60)}:${String(rush.t % 60).padStart(2, '0')}` : `${ic('puzzle')}${S.pr}`;
  };
  function pick() {
    if (mode === 'daily') return dailyPuzzle(all);
    const target = rush ? 450 + rush.score * 45 : S.pr;
    let pool = all.filter(p => (rush ? !rush.seen.has(p.id) : !S.solved.includes(p.id)) && (!theme || p.th.includes(theme)));
    if (!pool.length) pool = all.filter(p => !theme || p.th.includes(theme));
    let near = [];
    for (let win = 60; near.length < 5 && win < 5000; win *= 2) near = pool.filter(p => Math.abs(p.r - target) <= win);
    return near[Math.floor(Math.random() * near.length)];
  }
  function endRush(title) {
    rush.over = true; clearInterval(rush.timer);
    const best = rush.score > S.rush; if (best) S.rush = rush.score;
    addXp(rush.score * 3); save(); checkAwards(); sfx('end');
    coach(title, `You solved ${rush.score}.${best ? ' New best score!' : ` Your best is ${S.rush}.`}`, 'good');
    $('#pact').innerHTML = '<button class="btn primary big grow" id="again">Play again</button>';
    $('#again').onclick = () => goto('rush');
  }
  if (rush) {
    rush.timer = setInterval(() => { if (--rush.t <= 0) { rush.t = 0; endRush("Time's up"); } info(); }, 1000);
    cleanups.push(() => clearInterval(rush.timer));
  }

  function load(p) {
    const g = new Chess(p.fen), me = g.turn() === 'w' ? 'b' : 'w', seenBefore = S.solved.includes(p.id);
    let idx = 1, clean = true, over = false, scored = false, delta = 0, hints = 0, startFen = '';
    if (rush) rush.seen.add(p.id);
    const board = new Board(freshBoard(), g, { orient: me, movable: c => c === me && !over && !(rush && rush.over), onMove });
    const play = u => { const m = g.move(uciMove(u)); board.last = [m.from, m.to]; moveSfx(g, m); };
    coach(`${side(me)} to move`, mode === 'daily' ? new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }) : 'Find the best move.');
    $('#pmeta').innerHTML = ''; info(); actions();
    board.locked = true;
    setTimeout(() => { if (id !== viewId) return; play(p.moves[0]); startFen = g.fen(); board.locked = false; board.render(); }, 550);

    function score(win) {
      if (scored || rush) return; scored = true;
      if (seenBefore) return;
      const exp = 1 / (1 + 10 ** ((p.r - S.pr) / 400));
      delta = Math.round(24 * ((win ? 1 : 0) - exp)) || (win ? 1 : -1);
      S.pr += delta; S.prh.push(S.pr); if (S.prh.length > 200) S.prh.shift();
      S.pstreak = win ? S.pstreak + 1 : 0; S.pbest = Math.max(S.pbest, S.pstreak);
      save(); info();
    }
    function actions() {
      if (rush) return void ($('#pact').innerHTML = '');
      $('#pact').innerHTML = over
        ? `<button class="btn" id="an">${ic('search')} Analyse</button><button class="btn primary big grow" id="nx">${mode === 'daily' ? 'More puzzles' : 'Next puzzle'}</button>`
        : `<button class="btn grow" id="hint">${ic('bulb')} Hint</button><button class="btn grow" id="sol">Show the move</button>`;
      if (over) {
        $('#an').onclick = () => { ctx.analysis = { fen: startFen }; goto('analysis'); };
        $('#nx').onclick = () => (mode === 'daily' ? goto('puzzles') : load(pick()));
      } else {
        $('#hint').onclick = () => {
          clean = false; const u = p.moves[idx];
          if (++hints > 1) board.arrows = [{ from: u.slice(0, 2), to: u.slice(2, 4) }]; else board.hint = u.slice(0, 2);
          board.render(); coach('Hint', hints > 1 ? 'Follow the arrow.' : 'Move the highlighted piece.');
        };
        $('#sol').onclick = () => { if (board.locked) return; clean = false; score(false); onMove(uciMove(p.moves[idx])); };
      }
    }
    function solved() {
      over = true;
      if (rush) { rush.score++; sfx('good'); info(); return setTimeout(() => { if (id === viewId && !rush.over) load(pick()); }, 450); }
      if (clean) score(true);
      if (!seenBefore) { S.solved.push(p.id); addXp(clean ? 12 : 4); }
      if (mode === 'daily') S.daily = today();
      save(); sfx('good');
      coach('Solved!', seenBefore ? 'You had solved this one before.' : clean ? `Rating +${delta}` : 'No rating gain after a miss or a hint.', 'good');
      $('#pmeta').innerHTML = `<span class="chip">Rated ${p.r}</span>` + p.th.map(t => `<span class="chip">${themeName(t)}</span>`).join('');
      actions(); checkAwards();
    }
    function onMove(m) {
      let ok = toUci(m) === p.moves[idx], r;
      try { r = g.move(m); } catch { return board.render(); }
      if (!ok && g.isCheckmate()) ok = true;
      if (!ok) {
        g.undo(); clean = false; sfx('bad');
        board.badge = { sq: m.to, cls: 'k-blunder', t: '✗' }; board.render();
        setTimeout(() => { if (id !== viewId) return; board.badge = null; board.render(); }, 700);
        if (rush) {
          over = true; rush.strikes++; info();
          return rush.strikes >= 3 ? endRush('Three strikes') : setTimeout(() => { if (id === viewId && !rush.over) load(pick()); }, 750);
        }
        score(false);
        return coach('Not the move', delta ? `Rating ${delta}. Try again or take a hint.` : 'Try again or take a hint.', 'bad');
      }
      board.last = [r.from, r.to]; moveSfx(g, r); idx++;
      if (idx >= p.moves.length || g.isCheckmate()) { board.badge = { sq: r.to, cls: 'k-best', t: '✓' }; board.render(); return solved(); }
      coach('Correct', 'Keep going.', 'good'); board.locked = true; board.render();
      setTimeout(() => { if (id !== viewId) return; play(p.moves[idx++]); board.locked = false; board.render(); }, 450);
    }
  }
  load(pick());
}
views.rated = () => puzzleRun('rated');
views.daily = () => puzzleRun('daily');
views.rush = () => puzzleRun('rush');

/* ---------- learn ---------- */
views.learn = () => {
  const nextI = LESSONS.findIndex(l => !S.lessons[l.id]), next = LESSONS[nextI], done = LESSONS.length - LESSONS.filter(l => !S.lessons[l.id]).length;
  screen('Learn', { right: `<span class="chip lg">${ic('learn')}${done}/${LESSONS.length}</span>`, body: `
    <div class="scene learn">
      ${coachHtml(next ? next.title : 'Course complete', next ? next.desc : 'Every lesson is done. Tap any tile to replay it.')}
      ${COURSES.map((c, ci) => `<h3 class="course">${c}</h3><div class="path">${LESSONS.map((l, i) => l.course !== ci ? '' : `<button class="node" data-i="${i}">
        ${i === nextI ? '<em class="tag">Next</em>' : ''}${iso(S.lessons[l.id] ? 'done' : i === nextI ? 'cur' : '', ic(S.lessons[l.id] ? 'check' : l.icon))}<span class="nlabel">${l.title}</span></button>`).join('')}</div>`).join('')}
    </div>
    <div class="cta"><button class="btn primary big grow" id="go">${next ? 'Next lesson' : 'Replay first lesson'}</button></div>` });
  const start = i => { ctx.lesson = { i, s: 0 }; goto('lesson'); };
  $('#go').onclick = () => start(Math.max(0, nextI));
  main.querySelectorAll('.node').forEach(b => (b.onclick = () => start(+b.dataset.i)));
};

views.lesson = function lesson() {
  if (!ctx.lesson) return goto('learn');
  const { i, s } = ctx.lesson, L = LESSONS[i], st = L.steps[s], n = L.steps.length, g = new Chess(st.fen), me = g.turn();
  let solved = false;
  screen(L.title, { back: 'learn', body: stage(`
    <div class="chal"><b>Challenge ${s + 1}/${n}</b><div class="row"><div class="bar"><i id="lbar" style="width:${100 * s / n}%"></i></div><span class="tileic sm">${ic(L.icon)}</span></div></div>
    <div class="row"><button class="btn" id="hint">${ic('bulb')} Hint</button><button class="btn primary big grow" id="next" disabled>${s + 1 < n ? 'Next' : 'Finish lesson'}</button></div>`) });
  coach(`${side(me)} to move`, st.text);
  const hit = () => g.moves({ verbose: true }).find(m => {
    if (Array.isArray(st.goal)) return toUci(m) === st.goal[0];
    g.move(m); const ok = st.goal === 'mate' ? g.isCheckmate() : g.isCheck(); g.undo(); return ok;
  });
  const board = new Board($('#board'), g, { orient: me, movable: () => !solved, onMove(mv) {
    let r; try { r = g.move(mv); } catch { return board.render(); }
    const ok = st.goal === 'mate' ? g.isCheckmate() : st.goal === 'check' ? g.isCheck() : st.goal.includes(toUci(mv));
    if (!ok) { g.undo(); sfx('bad'); coach('Not quite', st.text, 'bad'); return board.render(); }
    solved = true; board.last = [r.from, r.to]; board.badge = { sq: r.to, cls: 'k-best', t: '✓' }; board.render();
    moveSfx(g, r); sfx('good'); coach('Correct!', st.done, 'good');
    $('#lbar').style.width = 100 * (s + 1) / n + '%'; $('#next').disabled = false; $('#hint').disabled = true;
  } });
  $('#hint').onclick = () => { const m = hit(); if (m) { board.arrows = [{ from: m.from, to: m.to }]; board.render(); } };
  $('#next').onclick = () => {
    if (s + 1 < n) { ctx.lesson.s++; return lesson(); }
    if (!S.lessons[L.id]) { S.lessons[L.id] = 1; addXp(30); }
    save(); toast(`${ic('learn')}<span><b>Lesson complete</b><br>${L.title}</span>`); checkAwards(); goto('learn');
  };
};

/* ---------- vision ---------- */
views.vision = () => {
  let orient = 'w', score = 0, t = 0, target = '', timer = null;
  screen('Vision', { back: 'more', body: `<div class="stage"><div class="bcol">${coachHtml('Find the square', 'Tap the named square as fast as you can. 30 seconds.')}<div id="board" class="board vis"></div></div>
    <aside class="panel"><div class="between"><div><div class="big-num" id="vs">0</div><small class="muted">Best ${S.vision}</small></div><div class="seg" id="vo"><button data-v="w" class="on">White</button><button data-v="b">Black</button></div></div>
    <div class="bar"><i id="vt" style="width:100%"></i></div><button class="btn primary big" id="vgo">Start</button></aside></div>` });
  const b = $('#board');
  const draw = () => {
    let h = '';
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      const f = orient === 'w' ? x : 7 - x, r = orient === 'w' ? 8 - y : y + 1;
      h += `<div class="sq ${(x + y) % 2 ? 'd' : 'l'}" data-sq="${'abcdefgh'[f]}${r}"></div>`;
    }
    b.innerHTML = `<div class="sqs">${h}</div>`;
  };
  const ask = () => { target = 'abcdefgh'[Math.random() * 8 | 0] + (1 + (Math.random() * 8 | 0)); coach(target, 'Tap this square.'); };
  const end = () => {
    clearInterval(timer); timer = null; target = '';
    const best = score > S.vision; if (best) S.vision = score;
    addXp(score); save(); checkAwards(); sfx('end');
    coach(`Score ${score}`, best ? 'New best!' : `Your best is ${S.vision}.`, 'good'); $('#vgo').disabled = false;
  };
  draw();
  $('#vo').onclick = e => { const x = e.target.closest('button'); if (!x || timer) return; orient = x.dataset.v; $('#vo').querySelectorAll('button').forEach(k => k.classList.toggle('on', k === x)); draw(); };
  $('#vgo').onclick = () => {
    score = 0; t = 300; $('#vs').textContent = 0; $('#vgo').disabled = true; ask();
    timer = setInterval(() => { t--; $('#vt').style.width = t / 3 + '%'; if (t <= 0) end(); }, 100);
  };
  b.onclick = e => {
    const q = e.target.closest('[data-sq]'); if (!q || !target) return;
    const ok = q.dataset.sq === target;
    q.classList.add(ok ? 'hint' : 'chk'); setTimeout(() => q.classList.remove('hint', 'chk'), 250);
    sfx(ok ? 'move' : 'bad');
    if (ok) { $('#vs').textContent = ++score; ask(); }
  };
  cleanups.push(() => clearInterval(timer));
};

/* ---------- endgame drills ---------- */
const DRILLS = [
  { id: 'kq', title: 'Queen checkmate', desc: 'King and queen against a lone king.', fen: '8/8/8/4k3/8/8/8/Q3K3 w - - 0 1', goal: 'mate' },
  { id: 'kr', title: 'Rook checkmate', desc: 'Push the king to the edge with rook and king.', fen: '8/8/8/4k3/8/8/8/R3K3 w - - 0 1', goal: 'mate' },
  { id: 'krr', title: 'Ladder mate', desc: 'Two rooks take turns cutting off ranks.', fen: '8/8/8/4k3/8/8/8/R3K2R w - - 0 1', goal: 'mate' },
  { id: 'kp', title: 'King and pawn', desc: 'Lead with the king and promote the pawn.', fen: '8/8/4k3/8/4K3/8/4P3/8 w - - 0 1', goal: 'promote' },
  { id: 'luc', title: 'Lucena position', desc: 'Build a bridge with the rook to promote. Hard.', fen: '1K6/1P1k4/8/8/8/8/r7/2R5 w - - 0 1', goal: 'promote' },
  { id: 'kbb', title: 'Two bishops', desc: 'Drive the king into a corner with the bishop pair. Hard.', fen: '8/8/8/4k3/8/8/8/2B1KB2 w - - 0 1', goal: 'mate' },
];
views.endgames = () => {
  screen('Endgames', { back: 'more', body: `<p class="muted">Win each position against the engine. It defends as well as it can.</p><div class="grid3">${DRILLS.map((d, i) => `<button class="card drill" data-i="${i}">
    ${mini(d.fen)}<b>${d.title}</b><small>${d.desc}</small>${S.endg[d.id] ? `<span class="donemark">${ic('check')}</span>` : ''}</button>`).join('')}</div>` });
  main.querySelectorAll('.drill').forEach(b => (b.onclick = () => { ctx.drill = +b.dataset.i; goto('drill'); }));
};
views.drill = function drill() {
  if (ctx.drill == null) return goto('endgames');
  const id = viewId, d = DRILLS[ctx.drill], g = new Chess(d.fen);
  let over = false, promoted = false;
  screen(d.title, { back: 'endgames', body: stage(`<p class="muted">${d.desc}</p><div class="row"><button class="btn grow" id="hint">${ic('bulb')} Hint</button><button class="btn grow" id="re">${ic('undo')} Restart</button></div>`) });
  const goalText = d.goal === 'mate' ? 'Deliver checkmate.' : 'Promote the pawn and keep the new queen.';
  coach('White to move', goalText);
  const end = (win, text) => {
    over = true; sfx(win ? 'end' : 'bad');
    if (win && !S.endg[d.id]) { S.endg[d.id] = 1; addXp(25); }
    save(); checkAwards(); coach(win ? 'Drill complete' : 'Not this time', text, win ? 'good' : 'bad'); board.render();
  };
  const board = new Board($('#board'), g, { movable: c => c === 'w' && !over, async onMove(mv) {
    let r; try { r = g.move(mv); } catch { return board.render(); }
    board.last = [r.from, r.to]; moveSfx(g, r); board.locked = true; board.render();
    if (r.promotion) promoted = true;
    if (g.isCheckmate()) return end(true, 'Checkmate. Clean technique.');
    if (g.isDraw()) return end(false, g.isStalemate() ? 'Stalemate. Leave the king a square unless it is mate.' : 'The game is drawn. Restart and try again.');
    const res = await think(g.fen(), { depth: 12 }); if (id !== viewId) return;
    const m = g.move(uciMove(res.best)); board.last = [m.from, m.to]; moveSfx(g, m); board.locked = false; board.render();
    const wq = g.board().flat().some(p => p && p.color === 'w' && p.type === 'q'), wp = g.board().flat().some(p => p && p.color === 'w' && p.type === 'p');
    if (g.isDraw()) return end(false, 'The game is drawn. Restart and try again.');
    if (d.goal === 'promote' && promoted && wq) return end(true, 'The pawn is a queen and it is safe. The rest is the queen checkmate.');
    if (d.goal === 'promote' && !wp && !wq) return end(false, 'The pawn was lost. Restart and try again.');
    coach('White to move', goalText);
  } });
  $('#re').onclick = () => drill();
  $('#hint').onclick = async () => {
    if (over || board.locked) return;
    const res = await think(g.fen(), { depth: 12 }); if (id !== viewId || !res.best) return;
    board.arrows = [{ from: res.best.slice(0, 2), to: res.best.slice(2, 4) }]; board.render();
  };
};
