import { $, views, cleanups, bump, setRouter, ic, pimg, applyLooks, touchDay, checkAwards } from './core.js';
import './train.js';
import './play.js';
import './more.js';

const TABS = [['home', 'Home', 'pawn'], ['puzzles', 'Puzzles', 'puzzle'], ['learn', 'Learn', 'learn'], ['watch', 'Watch', 'watch'], ['more', 'More', 'more']];
const PARENT = { rated: 'puzzles', daily: 'puzzles', rush: 'puzzles', lesson: 'learn', play: 'home', game: 'home', review: 'home', replay: 'watch' };

function route() {
  const v = views[location.hash.slice(1)] ? location.hash.slice(1) : 'home';
  bump();
  cleanups.splice(0).forEach(f => f());
  document.querySelectorAll('.sheet,.celebrate').forEach(e => e.remove());
  const tab = PARENT[v] || (TABS.some(t => t[0] === v) ? v : 'more');
  $('#nav').innerHTML = `<a class="brand" href="#home">${pimg('wN')}<span>Pawnwise</span></a>` +
    TABS.map(([id, label, i]) => `<a href="#${id}" class="${id === tab ? 'on' : ''}">${ic(i)}<span>${label}</span></a>`).join('') +
    `<a class="navplay" href="#play">${ic('play')}<span>Play</span></a>`;
  document.body.dataset.view = v;
  scrollTo(0, 0);
  views[v]();
}
applyLooks();
touchDay();
setRouter(route);
addEventListener('hashchange', route);
route();
checkAwards();
