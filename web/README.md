# Pawnwise

A free, open-source chess training app that runs entirely in the browser. No account, no ads, no tracking,
no build step. Progress is stored in localStorage.

- **Puzzles**: 3,500 rated puzzles (400-2800) with levels, streaks, themes, a daily puzzle and Puzzle Rush
- **Learn**: 10 interactive lessons in four courses
- **Play**: eight computer opponents from 400 to 2600, rated games, hints and take-backs
- **Game review**: accuracy score and every move classified (best, excellent, inaccuracy, mistake, blunder, brilliant)
- **Analysis**: live Stockfish evaluation, best-move arrow, FEN and PGN import
- **Explorer**: 3,800 named opening lines
- **Endgames**, **Vision** trainer, stats, awards, board themes and piece sets

Run locally: `cd web && python3 -m http.server 8000`, then open http://localhost:8000.
To host it, serve this folder from any static host (GitHub Pages, Netlify, ...).

## Layout
- `app.js` router, `core.js` shared state and UI helpers, `board.js` the board, `engine.js` engine access
- `train.js` home, puzzles, lessons, vision, endgames; `play.js` games, review, analysis, explorer; `more.js` menu pages
- `lessons.js` lesson content (append to the array to add a lesson)
- `data/` puzzles and opening names, generated from the Lichess open databases

## Credits and licenses
- Site code: MIT (see `LICENSE`, applies to `web/` only)
- `vendor/stockfish.js`, `vendor/stockfish.wasm`: Stockfish 10 (stockfish.js build by Nathan Rugg), GPLv3. It runs as a
  separate worker; if it cannot load, a small built-in engine takes over
- `vendor/chess.js`: chess.js by Jeff Hlywa, BSD-2-Clause
- `pieces/cburnett`: Colin M.L. Burnett, GPLv2+; `pieces/merida`: Armando Hernandez Marroquin, GPLv2+
- `data/puzzles.js`: Lichess puzzle database, CC0; `data/openings.js`: lichess-org/chess-openings, CC0
