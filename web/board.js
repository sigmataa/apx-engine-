// Interactive board: animated pieces, tap or drag to move, arrows, badges, promotion picker.
const F = 'abcdefgh';
export const cfg = { pieces: 'cburnett', coords: true };
export const pieceUrl = p => `pieces/${cfg.pieces}/${p}.svg`;

export class Board {
  constructor(el, game, o = {}) {
    Object.assign(this, { el, game, orient: 'w', onMove() {}, movable: () => true, sel: null, targets: [], last: [], hint: null, arrows: [], badge: null, promo: null, locked: false, drag: null }, o);
    el.className = 'board';
    el.innerHTML = '<div class="sqs"></div><div class="pcs"></div><svg class="arr" viewBox="0 0 8 8"></svg><div class="top"></div>';
    [this.sqs, this.pcs, this.arr, this.top] = el.children;
    el.onpointerdown = e => this.down(e);
    el.onpointermove = e => this.move(e);
    el.onpointerup = e => this.up(e);
    el.onpointercancel = () => { this.drag = null; this.render(); };
    this.top.onclick = e => {
      const mv = this.promo; if (!mv) return;
      const b = e.target.closest('[data-promo]');
      this.promo = null; this.render();
      if (b) this.onMove({ ...mv, promotion: b.dataset.promo });
    };
    this.render();
  }
  xy(sq) { const f = F.indexOf(sq[0]), r = 8 - +sq[1]; return this.orient === 'w' ? [f, r] : [7 - f, 7 - r]; }
  at(e) {
    const b = this.el.getBoundingClientRect();
    let x = Math.floor((e.clientX - b.left) / b.width * 8), y = Math.floor((e.clientY - b.top) / b.height * 8);
    if (x < 0 || x > 7 || y < 0 || y > 7) return null;
    if (this.orient === 'b') { x = 7 - x; y = 7 - y; }
    return F[x] + (8 - y);
  }
  render() {
    const g = this.game, turn = g.turn(), want = {};
    let chk = null;
    for (const row of g.board()) for (const p of row) if (p) {
      want[p.square] = p.color + p.type.toUpperCase();
      if (p.type === 'k' && p.color === turn && g.isCheck()) chk = p.square;
    }
    let h = '';
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      const fx = this.orient === 'w' ? x : 7 - x, ry = this.orient === 'w' ? y : 7 - y, sq = F[fx] + (8 - ry);
      let c = 'sq ' + ((x + y) % 2 ? 'd' : 'l');
      if (this.last.includes(sq)) c += ' last';
      if (this.sel === sq) c += ' sel';
      if (this.hint === sq) c += ' hint';
      if (chk === sq) c += ' chk';
      if (this.targets.includes(sq)) c += want[sq] ? ' cap' : ' dot';
      h += `<div class="${c}">` + (cfg.coords && x === 0 ? `<em class="rk">${8 - ry}</em>` : '') + (cfg.coords && y === 7 ? `<em class="fl">${F[fx]}</em>` : '') + '</div>';
    }
    this.sqs.innerHTML = h;

    // pieces: reuse elements so moves animate
    const keep = {}, free = [];
    for (const el of [...this.pcs.children]) {
      if (want[el.dataset.sq] === el.dataset.p && !keep[el.dataset.sq]) keep[el.dataset.sq] = el; else free.push(el);
    }
    for (const sq in want) {
      let el = keep[sq];
      if (!el) {
        const i = free.findIndex(f => f.dataset.p === want[sq]);
        if (i >= 0) el = free.splice(i, 1)[0];
        else { el = document.createElement('div'); this.pcs.appendChild(el); }
        el.dataset.p = want[sq]; el.dataset.sq = sq;
        el.className = 'pc'; el.style.backgroundImage = `url(${pieceUrl(want[sq])})`;
      }
      el.classList.remove('drag');
      const [x, y] = this.xy(sq);
      el.style.transform = `translate(${x * 100}%,${y * 100}%)`;
    }
    free.forEach(f => f.remove());

    this.arr.innerHTML = this.arrows.map(a => {
      const [x1, y1] = this.xy(a.from).map(v => v + .5), [x2, y2] = this.xy(a.to).map(v => v + .5);
      const L = Math.hypot(x2 - x1, y2 - y1) || 1, ux = (x2 - x1) / L, uy = (y2 - y1) / L, ex = x2 - ux * .32, ey = y2 - uy * .32;
      const col = a.color || 'var(--accent)';
      return `<line x1="${x1 + ux * .3}" y1="${y1 + uy * .3}" x2="${ex}" y2="${ey}" stroke="${col}" stroke-width=".2" stroke-linecap="round"/>` +
        `<polygon points="${x2},${y2} ${ex - uy * .26},${ey + ux * .26} ${ex + uy * .26},${ey - ux * .26}" fill="${col}"/>`;
    }).join('');

    let t = '';
    if (this.badge) { const [x, y] = this.xy(this.badge.sq); t += `<span class="badge ${this.badge.cls}" style="left:${(x + 1) * 12.5}%;top:${y * 12.5}%">${this.badge.t}</span>`; }
    if (this.promo) t += '<div class="promo">' + ['Q', 'R', 'B', 'N'].map(p => `<button data-promo="${p.toLowerCase()}" aria-label="Promote to ${p}"><img src="${pieceUrl(turn + p)}" alt=""></button>`).join('') + '</div>';
    this.top.innerHTML = t;
    this.top.classList.toggle('on', !!this.promo);
  }
  clear() { this.sel = null; this.targets = []; }
  down(e) {
    if (this.promo || this.locked) return;
    const sq = this.at(e); if (!sq) return;
    if (this.sel && this.targets.includes(sq)) return this.attempt(this.sel, sq);
    const p = this.game.get(sq);
    if (p && p.color === this.game.turn() && this.movable(p.color)) {
      const was = this.sel === sq;
      this.sel = sq; this.targets = this.game.moves({ square: sq, verbose: true }).map(m => m.to);
      this.render();
      this.drag = { sq, x: e.clientX, y: e.clientY, el: [...this.pcs.children].find(c => c.dataset.sq === sq), on: false, was };
      try { this.el.setPointerCapture(e.pointerId); } catch {}
    } else { this.clear(); this.render(); }
  }
  move(e) {
    const d = this.drag; if (!d || !d.el) return;
    if (!d.on && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 6) return;
    d.on = true;
    const b = this.el.getBoundingClientRect(), s = b.width / 8;
    d.el.classList.add('drag');
    d.el.style.transform = `translate(${e.clientX - b.left - s / 2}px,${e.clientY - b.top - s / 2}px)`;
  }
  up(e) {
    const d = this.drag; if (!d) return;
    this.drag = null;
    if (!d.on) { if (d.was) { this.clear(); this.render(); } return; }
    const sq = this.at(e);
    if (sq && this.targets.includes(sq)) this.attempt(d.sq, sq); else this.render();
  }
  attempt(from, to) {
    const promo = this.game.moves({ square: from, verbose: true }).some(m => m.to === to && m.promotion);
    this.clear(); this.hint = null; this.arrows = [];
    if (promo) { this.promo = { from, to }; this.render(); } else this.onMove({ from, to });
  }
}
