# Pawnwise

A free, open-source chess training app that runs entirely in the browser. No account, no ads, no tracking,
no build step. Progress is stored in localStorage.

- **Puzzles**: 24,000 rated puzzles (1,000 per 100 points from 400 to 2800) with levels, streaks, 21 themes, a daily puzzle and Puzzle Rush
- **Learn**: 10 interactive lessons in four courses on an illustrated path
- **Play**: eight computer opponents from 400 to 2800 (Stockfish 19), pass-and-play with a friend, clocks (1 min, 3|2, 10 min)
- **Game review**: accuracy, an evaluation graph and every move classified (brilliant, great, best, excellent, good, book, inaccuracy, mistake, miss, blunder)
- **Watch**: nine famous games with autoplay and engine evaluation
- **Analysis**: live Stockfish 19 evaluation, best-move arrow, FEN and PGN import
- **Explorer**: 3,800 named opening lines
- **Endgames**, **Vision** trainer, stats with insights and a game archive, 21 awards, board themes, piece sets, sounds and animations

Run locally: `cd web && python3 -m http.server 8000`, then open http://localhost:8000.
To host it, serve this folder from any static host (GitHub Pages, Netlify, ...).

## Layout
- `app.js` router, `core.js` shared state and UI helpers, `board.js` the board, `engine.js` engine access
- `train.js` home, puzzles, lessons, vision, endgames; `play.js` games, review, analysis, explorer; `more.js` menu pages
- `lessons.js` lesson content (append to the array to add a lesson)
- `data/` puzzles and opening names, generated from the Lichess open databases

## Credits and licenses
- Site code: MIT (see `LICENSE`, applies to `web/` only)
- `vendor/stockfish-19-lite-single.*`: Stockfish 19, lite single-threaded build of stockfish.js by Nathan Rugg, GPLv3.
  It runs as a separate worker; if it cannot load, a small built-in engine takes over
- `sounds/`: lichess.org sound sets ("standard" and "sfx" by Enigmahack), AGPLv3+
- `vendor/chess.js`: chess.js by Jeff Hlywa, BSD-2-Clause
- `pieces/cburnett`: Colin M.L. Burnett, GPLv2+; `pieces/merida`: Armando Hernandez Marroquin, GPLv2+
- `data/puzzles.js`: Lichess puzzle database, CC0; `data/openings.js`: lichess-org/chess-openings, CC0; `data/games.js`: public-domain game scores
