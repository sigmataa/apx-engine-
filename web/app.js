import { $, views, cleanups, bump, setRouter, ic, pimg, applyLooks, touchDay, checkAwards } from './core.js';
import './train.js';
import './play.js';
import './more.js';

const TABS = [['home', 'Home', 'pawn'], ['puzzles', 'Puzzles', 'puzzle'], ['learn', 'Learn', 'learn'], ['play', 'Play', 'play'], ['more', 'More', 'more']];
const PARENT = { rated: 'puzzles', daily: 'puzzles', rush: 'puzzles', lesson: 'learn', game: 'play', review: 'play' };

function route() {
  const v = views[location.hash.slice(1)] ? location.hash.slice(1) : 'home';
  bump();
  cleanups.splice(0).forEach(f => f());
  const tab = PARENT[v] || (TABS.some(t => t[0] === v) ? v : 'more');
  $('#nav').innerHTML = `<a class="brand" href="#home">${pimg('wN')}<span>Pawnwise</span></a>` +
    TABS.map(([id, label, i]) => `<a href="#${id}" class="${id === tab ? 'on' : ''}">${ic(i)}<span>${label}</span></a>`).join('');
  scrollTo(0, 0);
  views[v]();
}
applyLooks();
touchDay();
setRouter(route);
addEventListener('hashchange', route);
route();
checkAwards();
