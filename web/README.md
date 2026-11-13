# Pawnwise

A free, open-source chess training site: rated puzzles, interactive lessons, play against a built-in
computer opponent, and an analysis board. Static files only, no build step, no account, no tracking.
Progress is stored in the browser's localStorage.

Run locally: `cd web && python3 -m http.server 8000`, then open http://localhost:8000.
To host it, serve this folder from any static host (GitHub Pages, Netlify, ...).

- `app.js` views, board, and a small alpha-beta engine
- `lessons.js` lesson content (add a lesson by appending to the array)
- `puzzles.js` 340 puzzles from the Lichess puzzle database

## Credits and licenses
- Site code: MIT (see `LICENSE`, applies to `web/` only)
- `vendor/chess.js`: chess.js by Jeff Hlywa, BSD-2-Clause
- `pieces/`: "cburnett" set by Colin M.L. Burnett, GPLv2+ / BSD / GFDL
- Puzzles: Lichess puzzle database, CC0
