// More menu, stats, awards, themes and preferences.
import { $, main, S, save, views, goto, ic, pimg, esc, screen, spark, toast, sfx, level, resetAll, applyLooks, AWARDS, LESSONS, BOTS } from './core.js';
import { ready } from './engine.js';

const row = (href, icon, c, title, sub) => `<a class="mrow" href="#${href}"><span class="tileic ${c}">${ic(icon)}</span><span class="t"><b>${title}</b><small>${sub}</small></span>${ic('next')}</a>`;
views.more = () => {
  screen('More', { body: `
    <h2>You</h2><div class="mlist">
      ${row('stats', 'stats', 'c2', 'Stats', 'Ratings, results and accuracy')}
      ${row('awards', 'star', 'c1', 'Awards', `${S.aw.length} of ${AWARDS.length} unlocked`)}
      ${row('looks', 'brush', 'c4', 'Themes', 'Board colours and piece style')}
      ${row('prefs', 'gear', 'c0', 'Preferences', 'Name, sound, coordinates')}
    </div>
    <h2>Train</h2><div class="mlist">
      ${row('analysis', 'search', 'c2', 'Analysis', 'Engine evaluation for any position or game')}
      ${row('explorer', 'compass', 'c3', 'Explorer', '3,800 named opening lines')}
      ${row('endgames', 'crown', 'c5', 'Endgames', 'Win key positions against the engine')}
      ${row('vision', 'target', 'c3', 'Vision', 'Learn the board coordinates')}
      ${row('rush', 'bolt', 'c1', 'Puzzle Rush', 'As many as you can in three minutes')}
      ${row('daily', 'cal', 'c5', 'Daily puzzle', 'One new puzzle every day')}
    </div>
    <h2>About</h2>
    <p class="muted small">Pawnwise is free and open source. No account, no ads, no tracking. Your progress is stored only in this browser.
    Puzzles and opening names come from the Lichess open databases (CC0). Engine: Stockfish (GPLv3). Pieces by Colin M.L. Burnett and Armando Hernandez Marroquin. Rules by chess.js.</p>` });
};

views.stats = () => {
  const g = S.rec.w + S.rec.d + S.rec.l, pct = n => (g ? 100 * n / g : 0), acc = S.acc.length ? (S.acc.reduce((a, b) => a + b, 0) / S.acc.length).toFixed(1) : '-';
  screen('Stats', { back: 'more', body: `
    <div class="grid2">
      <div class="card"><div class="between"><span class="muted">Puzzle rating</span><b class="big-num">${S.pr}</b></div>${spark(S.prh)}</div>
      <div class="card"><div class="between"><span class="muted">Game rating</span><b class="big-num">${S.gr}</b></div>${spark(S.grh)}</div>
    </div>
    <div class="card"><div class="between"><b>Games vs computer</b><span class="muted">${g} played</span></div>
      <div class="wdl"><i class="w" style="width:${pct(S.rec.w)}%"></i><i class="d" style="width:${pct(S.rec.d)}%"></i><i class="l" style="width:${pct(S.rec.l)}%"></i></div>
      <div class="between small muted"><span>${S.rec.w} won</span><span>${S.rec.d} drawn</span><span>${S.rec.l} lost</span></div></div>
    <div class="grid3">
      ${[['Level', level()], ['Puzzles solved', S.solved.length], ['Best streak', S.pbest], ['Average accuracy', acc], ['Rush best', S.rush], ['Vision best', S.vision], ['Lessons', `${Object.keys(S.lessons).length}/${LESSONS.length}`], ['Opponents beaten', `${Object.keys(S.bots).length}/${BOTS.length}`], ['Day streak', S.days]]
        .map(([k, v]) => `<div class="tile"><b>${v}</b><small>${k}</small></div>`).join('')}
    </div>` });
};

views.awards = () => {
  screen('Awards', { back: 'more', right: `<span class="chip lg">${ic('star')}${S.aw.length}/${AWARDS.length}</span>`, body: `<div class="grid3">${AWARDS.map(a => `<div class="card award ${S.aw.includes(a[0]) ? 'got' : ''}"><span class="tileic big">${ic(a[3])}</span><b>${a[1]}</b><small>${a[2]}</small></div>`).join('')}</div>` });
};

const SKINS = { midnight: 'Midnight', meadow: 'Meadow', walnut: 'Walnut', violet: 'Violet', glacier: 'Glacier' };
const SETS = { cburnett: 'Classic', merida: 'Merida' };
views.looks = () => {
  screen('Themes', { back: 'more', body: `
    <h2>Board and colours</h2><div class="grid3" id="skins">${Object.keys(SKINS).map(k => `<button class="card pick ${S.skin === k ? 'on' : ''}" data-k="${k}"><span class="swatch" data-skin="${k}">${'<i></i>'.repeat(8)}</span><b>${SKINS[k]}</b></button>`).join('')}</div>
    <h2>Pieces</h2><div class="grid3" id="sets">${Object.keys(SETS).map(k => `<button class="card pick ${S.pieces === k ? 'on' : ''}" data-k="${k}"><span class="setprev">${['wK', 'bQ', 'wN', 'bP'].map(p => `<img src="pieces/${k}/${p}.svg" alt="">`).join('')}</span><b>${SETS[k]}</b></button>`).join('')}</div>` });
  $('#skins').onclick = e => { const b = e.target.closest('[data-k]'); if (!b) return; S.skin = b.dataset.k; save(); applyLooks(); views.looks(); };
  $('#sets').onclick = e => { const b = e.target.closest('[data-k]'); if (!b) return; S.pieces = b.dataset.k; save(); applyLooks(); views.looks(); };
};

views.prefs = () => {
  screen('Preferences', { back: 'more', body: `
    <div class="card"><label for="pname"><b>Display name</b></label><input class="fen" id="pname" maxlength="20" autocomplete="off" value="${esc(S.name)}"></div>
    <div class="mlist">
      <button class="mrow" id="tsound"><span class="tileic c2">${ic('sound')}</span><span class="t"><b>Sound</b><small>Move and result sounds</small></span><span class="switch ${S.sound ? 'on' : ''}"></span></button>
      <button class="mrow" id="tcoords"><span class="tileic c3">${ic('play')}</span><span class="t"><b>Coordinates</b><small>Show a-h and 1-8 on the board</small></span><span class="switch ${S.coords ? 'on' : ''}"></span></button>
      <div class="mrow"><span class="tileic c5">${ic('bolt')}</span><span class="t"><b>Engine</b><small id="engn">Loading</small></span></div>
    </div>
    <div class="card"><b>Reset progress</b><small class="muted">Clears ratings, solved puzzles, lessons and awards stored in this browser.</small>
      <div class="row"><button class="btn" id="reset">Reset everything</button><button class="btn danger" id="really" hidden>Yes, delete my progress</button></div></div>` });
  $('#pname').oninput = e => { S.name = e.target.value.trim() || 'Player'; save(); };
  $('#tsound').onclick = () => { S.sound = !S.sound; save(); sfx('good'); views.prefs(); };
  $('#tcoords').onclick = () => { S.coords = !S.coords; save(); applyLooks(); views.prefs(); };
  $('#reset').onclick = () => { $('#really').hidden = false; };
  $('#really').onclick = () => { resetAll(); toast(`${ic('check')}<span><b>Progress reset</b></span>`); goto('home'); };
  ready.then(e => { const n = $('#engn'); if (n) n.textContent = e.sf ? `${e.name}, running in your browser` : 'Built-in basic engine (Stockfish could not load here)'; });
};
