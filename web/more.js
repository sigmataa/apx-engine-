// More menu, stats and insights, awards, themes and preferences.
import { $, main, S, save, views, ctx, goto, ic, art, pimg, esc, screen, spark, toast, sfx, level, resetAll, applyLooks, AWARDS, LESSONS, BOTS, FRIEND, TCS } from './core.js';
import { ready } from './engine.js';
import { themeName } from './train.js';

const row = (href, a, title, sub) => `<a class="mrow" href="#${href}">${art(a, 'lg')}<span class="t"><b>${title}</b><small>${sub}</small></span>${ic('next')}</a>`;
views.more = () => {
  screen('More', { body: `
    <div class="brandbar"><span class="cav big">${pimg('wN')}</span><span><b>Pawnwise</b><small>Free and open source chess training</small></span></div>
    <h2>Account</h2><div class="mlist">
      ${row('stats', 'bars', 'Stats', 'Ratings, results, insights and past games')}
      ${row('looks', 'brush', 'Theme', 'Board colours and piece style')}
      ${row('awards', 'star', 'Awards', `${S.aw.length} of ${AWARDS.length} unlocked`)}
      ${row('prefs', 'gear', 'Settings', 'Name, sound, coordinates, engine')}
    </div>
    <h2>Play</h2><div class="mlist">
      ${row('play', 'sword', 'Play', 'Eight computer opponents or a friend, with clocks')}
      ${row('watch', 'watch', 'Watch', 'Famous games with engine evaluation')}
    </div>
    <h2>Learn</h2><div class="mlist">
      ${row('analysis', 'search', 'Analysis', 'Stockfish 19 evaluation for any position or game')}
      ${row('explorer', 'compass', 'Explorer', '3,800 named opening lines')}
      ${row('endgames', 'crown', 'Endgames', 'Win key positions against the engine')}
      ${row('rush', 'bolt', 'Puzzle Rush', 'As many puzzles as you can in three minutes')}
      ${row('stats', 'bulb', 'Insights', 'Your strongest and weakest puzzle themes')}
      ${row('vision', 'target', 'Vision', 'Learn the board coordinates')}
    </div>
    <h2>About</h2>
    <p class="muted small">No account, no ads, no tracking. Your progress is stored only in this browser.
    Puzzles and opening names: Lichess open databases (CC0). Engine: Stockfish 19 via stockfish.js (GPLv3). Sounds: lichess.org (AGPLv3+).
    Pieces: Colin M.L. Burnett and Armando Hernandez Marroquin (GPLv2+). Rules: chess.js (BSD).</p>` });
};

views.stats = () => {
  const g = S.rec.w + S.rec.d + S.rec.l, pct = n => (g ? 100 * n / g : 0), acc = S.acc.length ? (S.acc.reduce((a, b) => a + b, 0) / S.acc.length).toFixed(1) : '-';
  const th = Object.entries(S.th).filter(([, r]) => r[1] >= 3).map(([t, r]) => [t, r[0] / r[1], r[1]]).sort((a, b) => b[1] - a[1]);
  const tbar = ([t, p, n]) => `<div class="tbar"><span>${themeName(t)}</span><div class="bar"><i style="width:${p * 100}%;background:${p >= .7 ? 'var(--good)' : p >= .45 ? 'var(--accent2)' : 'var(--bad)'}"></i></div><b>${Math.round(p * 100)}%</b><small>${n}</small></div>`;
  screen('Stats', { back: 'more', body: `
    <div class="grid2">
      <div class="card">${art('puzzle', 'lg')}<div class="between"><span class="muted">Puzzle rating</span><b class="big-num">${S.pr}</b></div>${spark(S.prh)}</div>
      <div class="card">${art('watch', 'lg')}<div class="between"><span class="muted">Game rating</span><b class="big-num">${S.gr}</b></div>${spark(S.grh)}</div>
    </div>
    <div class="card"><div class="between"><b>Games vs computer</b><span class="muted">${g} played</span></div>
      <div class="wdl"><i class="w" style="width:${pct(S.rec.w)}%"></i><i class="d" style="width:${pct(S.rec.d)}%"></i><i class="l" style="width:${pct(S.rec.l)}%"></i></div>
      <div class="between small muted"><span>${S.rec.w} won</span><span>${S.rec.d} drawn</span><span>${S.rec.l} lost</span></div></div>
    <div class="grid3">
      ${[['Level', level()], ['Puzzles solved', S.solved.length], ['Best streak', S.pbest], ['Average accuracy', acc], ['Rush best', S.rush], ['Vision best', S.vision], ['Lessons', `${Object.keys(S.lessons).length}/${LESSONS.length}`], ['Opponents beaten', `${Object.keys(S.bots).length}/${BOTS.length}`], ['Day streak', S.days]]
        .map(([k, v], i) => `<div class="tile" style="--d:${i}"><b>${v}</b><small>${k}</small></div>`).join('')}
    </div>
    <h2>${art('bulb')} Insights</h2>
    ${th.length ? `<div class="card"><b>Strongest themes</b>${th.slice(0, 4).map(tbar).join('')}<b>Needs work</b>${th.slice(-4).reverse().map(tbar).join('')}</div>` : '<p class="muted">Solve a few more puzzles and your strongest and weakest themes will show here.</p>'}
    <h2>Recent games</h2>
    ${S.games.length ? `<div class="mlist">${S.games.map((x, i) => { const b = BOTS.find(k => k.id === x.bot) || FRIEND; return `<button class="mrow" data-i="${i}"><span class="avatar sm" style="background:${b.col}">${pimg('w' + b.pc)}</span>
      <span class="t"><b>${x.bot === 'friend' ? 'Pass and play' : `vs ${b.name}`}</b><small>${new Date(x.date).toLocaleDateString()} · ${TCS[x.tc || 'none'][0]} · ${Math.ceil(x.sans.length / 2)} moves${x.acc ? ` · accuracy ${x.acc}` : ''}</small></span>
      <span class="res r-${x.res}">${x.res === 'w' ? 'Won' : x.res === 'l' ? 'Lost' : 'Draw'}</span></button>`; }).join('')}</div>` : '<p class="muted">Games you finish are saved here for review.</p>'}` });
  main.querySelectorAll('[data-i]').forEach(b => (b.onclick = () => {
    const x = S.games[+b.dataset.i];
    if (x.bot === 'friend') { ctx.analysis = { sans: x.sans, all: x.sans }; goto('analysis'); } else { ctx.review = +b.dataset.i; goto('review'); }
  }));
};

views.awards = () => {
  screen('Awards', { back: 'more', right: `<span class="chip lg">${art('star')}<b>${S.aw.length}/${AWARDS.length}</b></span>`, body: `<div class="grid3">${AWARDS.map((a, i) => `<div class="card award ${S.aw.includes(a[0]) ? 'got' : ''}" style="--d:${i}"><span class="medal">${art(a[3], 'xl')}</span><b>${a[1]}</b><small>${a[2]}</small></div>`).join('')}</div>` });
};

const SKINS = { classic: 'Classic Green', midnight: 'Midnight', walnut: 'Walnut', violet: 'Violet', glacier: 'Glacier (light)' };
const SETS = { cburnett: 'Classic', merida: 'Merida' };
views.looks = () => {
  screen('Theme', { back: 'more', body: `
    <h2>Board and colours</h2><div class="grid3" id="skins">${Object.keys(SKINS).map(k => `<button class="card pick ${S.skin === k ? 'on' : ''}" data-k="${k}"><span class="swatch" data-skin="${k}">${'<i></i>'.repeat(8)}</span><b>${SKINS[k]}</b></button>`).join('')}</div>
    <h2>Pieces</h2><div class="grid3" id="sets">${Object.keys(SETS).map(k => `<button class="card pick ${S.pieces === k ? 'on' : ''}" data-k="${k}"><span class="setprev">${['wK', 'bQ', 'wN', 'bP'].map(p => `<img src="pieces/${k}/${p}.svg" alt="">`).join('')}</span><b>${SETS[k]}</b></button>`).join('')}</div>` });
  $('#skins').onclick = e => { const b = e.target.closest('[data-k]'); if (!b) return; S.skin = b.dataset.k; save(); applyLooks(); sfx('move'); views.looks(); };
  $('#sets').onclick = e => { const b = e.target.closest('[data-k]'); if (!b) return; S.pieces = b.dataset.k; save(); applyLooks(); sfx('move'); views.looks(); };
};

views.prefs = () => {
  screen('Settings', { back: 'more', body: `
    <div class="card"><label for="pname"><b>Display name</b></label><input class="fen" id="pname" maxlength="20" autocomplete="off" value="${esc(S.name)}"></div>
    <div class="mlist">
      <button class="mrow" id="tsound">${art('bulb', 'lg')}<span class="t"><b>Sound</b><small>Move, capture, check and result sounds</small></span><span class="switch ${S.sound ? 'on' : ''}"></span></button>
      <button class="mrow" id="tcoords">${art('target', 'lg')}<span class="t"><b>Coordinates</b><small>Show a-h and 1-8 on the board</small></span><span class="switch ${S.coords ? 'on' : ''}"></span></button>
      <div class="mrow">${art('gear', 'lg')}<span class="t"><b>Engine</b><small id="engn">Loading</small></span></div>
    </div>
    <div class="card"><b>Reset progress</b><small>Clears ratings, solved puzzles, lessons, games and awards stored in this browser.</small>
      <div class="row"><button class="btn" id="reset">Reset everything</button><button class="btn danger" id="really" hidden>Yes, delete my progress</button></div></div>` });
  $('#pname').oninput = e => { S.name = e.target.value.trim() || 'Player'; save(); };
  $('#tsound').onclick = () => { S.sound = !S.sound; save(); sfx('good'); views.prefs(); };
  $('#tcoords').onclick = () => { S.coords = !S.coords; save(); applyLooks(); views.prefs(); };
  $('#reset').onclick = () => { $('#really').hidden = false; };
  $('#really').onclick = () => { resetAll(); toast(`${ic('check')}<span><b>Progress reset</b></span>`); goto('home'); };
  ready.then(e => { const n = $('#engn'); if (n) n.textContent = e.sf ? `${e.name} (lite NNUE), running in your browser` : 'Built-in basic engine (Stockfish could not load here)'; });
};
