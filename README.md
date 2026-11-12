# Apx (Apex Forge) chess engine

Copyright (c) 2026 sigmataa. All rights reserved. See LICENSE. Not open source.

UCI chess engine in C++20 with an NNUE evaluation (768x4 king buckets -> 256, plus threat inputs).

Build: `cd src && g++ -std=c++20 -O3 -march=native -DNDEBUG -pthread *.cpp -o apx`

## Parallel match testing
Edit `queue.txt` (candidate folder, shards, pairs per shard, time control) and push it. The `match` workflow runs one
shard per runner, merges the game-pair results and commits `results/<candidate>_run<N>.txt` (Elo +- 95% and SPRT LLR).
A candidate folder holds only the files that differ from `src/` (for example a new `net.inc`).
