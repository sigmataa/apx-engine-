// A step: fen, text, goal ('mate' | 'check' | list of accepted UCI moves), done (feedback once solved).
export const COURSES = ['Fundamentals', 'Tactics', 'Openings', 'Endgames'];
export default [
  { id: 'captures', course: 0, icon: 'pawn', title: 'How the pieces capture', desc: 'Rook, bishop, knight, queen and pawn in action.', steps: [
    { fen: '4k3/8/8/8/1R4p1/8/8/4K3 w - - 0 1', text: 'Rooks move in straight lines along ranks and files. Capture the pawn with your rook.', goal: ['b4g4'], done: 'A rook covers the whole rank and file it stands on.' },
    { fen: '4k3/6n1/8/8/8/2B5/8/4K3 w - - 0 1', text: 'Bishops move diagonally and never change square colour. Capture the knight.', goal: ['c3g7'], done: 'Long diagonals make bishops strong from far away.' },
    { fen: '4k3/8/8/3r4/8/4N3/8/4K3 w - - 0 1', text: 'Knights jump in an L shape: two squares one way, one square sideways. Capture the rook.', goal: ['e3d5'], done: 'The knight is the only piece that can jump over others.' },
    { fen: '4k3/8/8/7b/8/8/8/3QK3 w - - 0 1', text: 'The queen combines rook and bishop. Capture the bishop.', goal: ['d1h5'], done: 'It also gives check. The queen is your most powerful piece.' },
    { fen: '4k3/8/8/3n4/4P3/8/8/4K3 w - - 0 1', text: 'Pawns move straight ahead but capture one square diagonally. Take the knight.', goal: ['e4d5'], done: 'Pawns are the only pieces that capture differently from how they move.' },
  ]},
  { id: 'mate', course: 0, icon: 'crown', title: 'Check and checkmate', desc: 'Attack the king, then leave it no escape.', steps: [
    { fen: '4k3/8/8/8/8/8/8/R3K3 w - - 0 1', text: 'A check is an attack on the king. Give check with your rook.', goal: 'check', done: 'The king must respond to every check.' },
    { fen: '6k1/5ppp/8/8/8/8/8/R3K3 w - - 0 1', text: 'The black king is boxed in by its own pawns. Deliver checkmate.', goal: 'mate', done: 'This is the back-rank mate. Watch for it in your own games.' },
    { fen: '7k/8/5K2/8/8/8/8/6Q1 w - - 0 1', text: 'Your king supports the queen. Find the mate in one.', goal: 'mate', done: 'The queen is protected by the king, so it cannot be captured.' },
    { fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4', text: 'Black just blundered. Queen and bishop both aim at f7. Finish the game.', goal: 'mate', done: "Scholar's Mate. Know it so it never happens to you." },
  ]},
  { id: 'special', course: 0, icon: 'star', title: 'Special moves and piece values', desc: 'Castling, en passant and what each piece is worth.', steps: [
    { fen: 'r3k2r/pppq1ppp/2npbn2/2b1p3/2B1P3/2NPBN2/PPPQ1PPP/R3K2R w KQkq - 0 1', text: 'Castling moves the king two squares toward a rook, and the rook jumps over. Castle on either side.', goal: ['e1g1', 'e1c1'], done: 'You can only castle if neither piece has moved and the king does not pass through check.' },
    { fen: '4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1', text: 'Black just pushed a pawn two squares, landing beside yours. Capture it en passant, as if it had moved one square.', goal: ['e5d6'], done: 'En passant is only allowed on the very next move.' },
    { fen: '4k3/8/2r3p1/4N3/8/8/8/4K3 w - - 0 1', text: 'Pawn 1, knight 3, bishop 3, rook 5, queen 9. Your knight attacks two things. Take the more valuable one.', goal: ['e5c6'], done: 'A rook is worth five pawns. Always count before you capture.' },
  ]},
  { id: 'tactics', course: 1, icon: 'bolt', title: 'Forks, pins and skewers', desc: 'The three tactics that win most games.', steps: [
    { fen: 'r3k3/8/8/3N4/8/8/8/4K3 w - - 0 1', text: 'A fork attacks two pieces at once. Find the knight move that hits both king and rook.', goal: ['d5c7'], done: 'The king must move, and then you take the rook.' },
    { fen: '4k3/8/8/8/7n/8/8/3QK3 w - - 0 1', text: 'Queens fork too. Give a check that also attacks the knight.', goal: ['d1a4', 'd1h5'], done: 'Black cannot save both the king and the knight.' },
    { fen: '4k3/4n3/8/8/8/8/8/R5K1 w - - 0 1', text: 'A pin freezes a piece because moving it would expose something more valuable. Pin the knight to the king.', goal: ['a1e1'], done: 'The knight cannot legally move while it shields the king.' },
    { fen: '4q3/8/8/4k3/8/8/8/R5K1 w - - 0 1', text: 'A skewer is a reversed pin: the valuable piece is in front. Skewer king and queen.', goal: ['a1e1'], done: 'The king steps aside and the queen behind it falls.' },
  ]},
  { id: 'discovered', course: 1, icon: 'search', title: 'Discovered attacks', desc: 'Move one piece to unleash another.', steps: [
    { fen: '1q2k3/8/8/4N3/8/8/8/4R1K1 w - - 0 1', text: 'Your knight blocks the rook. Move the knight so the rook gives check, and pick a square where the knight attacks the queen.', goal: ['e5c6'], done: 'Black must answer the check, so the queen is lost.' },
    { fen: '3q2k1/5ppp/8/8/8/3B4/8/3R2K1 w - - 0 1', text: 'The bishop stands between your rook and the black queen. Move it away with check.', goal: ['d3h7'], done: 'After the king takes the bishop, your rook takes the queen.' },
    { fen: '4k3/4q3/8/8/4B3/8/8/4R1K1 w - - 0 1', text: 'The queen is lined up with its king. Move the bishop with check to uncover the rook.', goal: ['e4c6', 'e4g6'], done: 'The king has to move and the pinned queen is yours.' },
  ]},
  { id: 'patterns', course: 1, icon: 'target', title: 'Checkmate patterns', desc: 'Three finishing blows worth memorising.', steps: [
    { fen: '6rk/6pp/8/6N1/8/8/8/6K1 w - - 0 1', text: "The black king is walled in by its own pieces. Only a knight can reach it.", goal: 'mate', done: 'The smothered mate.' },
    { fen: '7k/8/5N2/8/8/8/8/6RK w - - 0 1', text: 'The knight covers the escape squares. Bring the rook to finish.', goal: 'mate', done: 'The Arabian mate: rook and knight working together in the corner.' },
    { fen: '6k1/5p1p/5PpQ/8/8/8/8/6K1 w - - 0 1', text: 'Your pawn on f6 guards a key square. Use it.', goal: 'mate', done: 'A far-advanced pawn is a perfect helper for the queen.' },
  ]},
  { id: 'opening', course: 2, icon: 'play', title: 'Opening principles', desc: 'Centre, development, king safety.', steps: [
    { fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', text: 'Start by claiming the centre with a pawn. Push the e-pawn or d-pawn two squares.', goal: ['e2e4', 'd2d4'], done: 'A centre pawn opens lines for your bishops and queen.' },
    { fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2', text: 'Develop knights before bishops. Bring the kingside knight out so it attacks the e5 pawn.', goal: ['g1f3'], done: 'Development with a threat gains time.' },
    { fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3', text: 'Now develop the bishop to an active square.', goal: ['f1c4', 'f1b5'], done: 'c4 is the Italian Game, b5 the Ruy Lopez. Both are excellent.' },
    { fen: 'r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4', text: 'Your kingside is clear. Castle to tuck the king away and activate the rook.', goal: ['e1g1'], done: 'Three principles in four moves: centre, development, king safety.' },
  ]},
  { id: 'tempo', course: 2, icon: 'flame', title: 'Developing with tempo', desc: 'Make every developing move carry a threat.', steps: [
    { fen: 'rnb1kbnr/ppp1pppp/8/3q4/8/8/PPPP1PPP/RNBQKBNR w KQkq - 0 3', text: 'Black brought the queen out early. Develop a piece that attacks it.', goal: ['b1c3'], done: 'The queen must move again while you got a free developing move.' },
    { fen: 'r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 3 3', text: 'White threatens mate on f7. Stop it with a move that also attacks the queen.', goal: ['g7g6'], done: 'One move, two jobs: the mate is blocked and the queen has to retreat.' },
    { fen: 'r1bqkbnr/pppp1p1p/2n3p1/4p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR b KQkq - 1 4', text: 'White renews the threat on f7. Block it by developing a knight.', goal: ['g8f6'], done: 'You defended while developing. White has wasted time with the queen.' },
  ]},
  { id: 'traps', course: 2, icon: 'bulb', title: 'Opening traps', desc: 'Punish the most common early mistakes.', steps: [
    { fen: 'rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq - 0 2', text: 'White has opened the diagonal to their own king. Punish it at once.', goal: 'mate', done: "Fool's Mate, the fastest checkmate in chess." },
    { fen: 'rnbq1bnr/ppppkppp/8/4p2Q/4P3/8/PPPP1PPP/RNB1KBNR w KQ - 2 3', text: 'Black walked the king into the centre. Find the mate.', goal: 'mate', done: 'A king in the centre with no defenders is in real danger.' },
    { fen: 'rnbqkbnr/pppp2pp/8/4p3/4P3/8/PPPP1PPP/RNBQKB1R w KQkq - 0 4', text: "Black's f-pawn is gone, so the diagonal to the king is open. Punish it with a queen check.", goal: ['d1h5'], done: 'Blocking with the g-pawn loses the rook in the corner, and moving the king is even worse.' },
  ]},
  { id: 'endgame', course: 3, icon: 'crown', title: 'Endgame essentials', desc: 'Promotion, the ladder mate and king power.', steps: [
    { fen: '8/4P1k1/8/8/8/8/8/4K3 w - - 0 1', text: 'A pawn that reaches the last rank becomes another piece. Promote to a queen.', goal: ['e7e8q'], done: 'Passed pawns decide most endgames.' },
    { fen: '7k/R7/8/8/8/8/1R6/6K1 w - - 0 1', text: 'One rook cuts off the seventh rank. Use the other to give mate.', goal: 'mate', done: 'The ladder mate: two rooks walk the king to the edge.' },
    { fen: '4k3/8/4K3/4P3/8/8/8/8 w - - 0 1', text: 'In pawn endgames the king leads. Step aside so your king controls the promotion path.', goal: ['e6d6', 'e6f6'], done: 'A king on the sixth rank in front of its pawn always wins.' },
  ]},
];
