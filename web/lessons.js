// Each step: fen, text, goal ('mate' | 'check' | list of accepted UCI moves), done (feedback after solving).
export default [
  { id: 'captures', title: 'How the pieces capture', desc: 'Rook, bishop, knight, queen and pawn in action.', steps: [
    { fen: '4k3/8/8/8/1R4p1/8/8/4K3 w - - 0 1', text: 'Rooks move in straight lines along ranks and files. Capture the pawn with your rook.', goal: ['b4g4'], done: 'A rook covers the whole rank and file it stands on.' },
    { fen: '4k3/6n1/8/8/8/2B5/8/4K3 w - - 0 1', text: 'Bishops move diagonally and never change square colour. Capture the knight.', goal: ['c3g7'], done: 'Long diagonals make bishops strong from far away.' },
    { fen: '4k3/8/8/3r4/8/4N3/8/4K3 w - - 0 1', text: 'Knights jump in an L shape: two squares one way, one square sideways. Capture the rook.', goal: ['e3d5'], done: 'The knight is the only piece that can jump over others.' },
    { fen: '4k3/8/8/7b/8/8/8/3QK3 w - - 0 1', text: 'The queen combines rook and bishop. Capture the bishop.', goal: ['d1h5'], done: 'It also gives check. The queen is your most powerful piece.' },
    { fen: '4k3/8/8/3n4/4P3/8/8/4K3 w - - 0 1', text: 'Pawns move straight ahead but capture one square diagonally. Take the knight.', goal: ['e4d5'], done: 'Pawns are the only pieces that capture differently from how they move.' },
  ]},
  { id: 'mate', title: 'Check and checkmate', desc: 'Attack the king, then leave it no escape.', steps: [
    { fen: '4k3/8/8/8/8/8/8/R3K3 w - - 0 1', text: 'A check is an attack on the king. Give check with your rook.', goal: 'check', done: 'The king must respond to every check.' },
    { fen: '6k1/5ppp/8/8/8/8/8/R3K3 w - - 0 1', text: 'The black king is boxed in by its own pawns. Deliver checkmate.', goal: 'mate', done: 'This is the back-rank mate. Watch for it in your own games.' },
    { fen: '7k/8/5K2/8/8/8/8/6Q1 w - - 0 1', text: 'Your king supports the queen. Find the mate in one.', goal: 'mate', done: 'The queen is protected by the king, so it cannot be captured.' },
    { fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4', text: 'Black just blundered. Queen and bishop both aim at f7. Finish the game.', goal: 'mate', done: "Scholar's Mate. Know it so it never happens to you." },
  ]},
  { id: 'tactics', title: 'Forks, pins and skewers', desc: 'The three tactics that win most games.', steps: [
    { fen: 'r3k3/8/8/3N4/8/8/8/4K3 w - - 0 1', text: 'A fork attacks two pieces at once. Find the knight move that hits both king and rook.', goal: ['d5c7'], done: 'The king must move, and then you take the rook.' },
    { fen: '4k3/4n3/8/8/8/8/8/R5K1 w - - 0 1', text: 'A pin freezes a piece because moving it would expose something more valuable. Pin the knight to the king.', goal: ['a1e1'], done: 'The knight cannot legally move while it shields the king.' },
    { fen: '4q3/8/8/4k3/8/8/8/R5K1 w - - 0 1', text: 'A skewer is a reversed pin: the valuable piece is in front. Skewer king and queen.', goal: ['a1e1'], done: 'The king steps aside and the queen behind it falls.' },
  ]},
  { id: 'opening', title: 'Opening principles', desc: 'Centre, development, king safety.', steps: [
    { fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', text: 'Start by claiming the centre with a pawn. Push the e-pawn or d-pawn two squares.', goal: ['e2e4', 'd2d4'], done: 'A centre pawn opens lines for your bishops and queen.' },
    { fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2', text: 'Develop knights before bishops. Bring the kingside knight out so it attacks the e5 pawn.', goal: ['g1f3'], done: 'Development with a threat gains time.' },
    { fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3', text: 'Now develop the bishop to an active square.', goal: ['f1c4', 'f1b5'], done: 'c4 is the Italian Game, b5 the Ruy Lopez. Both are excellent.' },
    { fen: 'r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4', text: 'Your kingside is clear. Castle to tuck the king away and activate the rook.', goal: ['e1g1'], done: 'Three principles in four moves: centre, development, king safety.' },
  ]},
  { id: 'tempo', title: 'Developing with tempo', desc: 'Make every developing move carry a threat.', steps: [
    { fen: 'rnb1kbnr/ppp1pppp/8/3q4/8/8/PPPP1PPP/RNBQKBNR w KQkq - 0 3', text: 'Black brought the queen out early. Develop a piece that attacks it.', goal: ['b1c3'], done: 'The queen must move again while you got a free developing move.' },
    { fen: 'r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 3 3', text: 'White threatens mate on f7. Stop it with a move that also attacks the queen.', goal: ['g7g6'], done: 'One move, two jobs: the mate is blocked and the queen has to retreat.' },
    { fen: 'r1bqkbnr/pppp1p1p/2n3p1/4p3/2B1P3/5Q2/PPPP1PPP/RNB1K1NR b KQkq - 1 4', text: 'White renews the threat on f7. Block it by developing a knight.', goal: ['g8f6'], done: 'You defended while developing. White has wasted time with the queen.' },
  ]},
  { id: 'endgame', title: 'Endgame essentials', desc: 'Promotion, the ladder mate and king power.', steps: [
    { fen: '8/4P1k1/8/8/8/8/8/4K3 w - - 0 1', text: 'A pawn that reaches the last rank becomes another piece. Promote to a queen.', goal: ['e7e8q'], done: 'Passed pawns decide most endgames.' },
    { fen: '7k/R7/8/8/8/8/1R6/6K1 w - - 0 1', text: 'One rook cuts off the seventh rank. Use the other to give mate.', goal: 'mate', done: 'The ladder mate: two rooks walk the king to the edge.' },
    { fen: '4k3/8/4K3/4P3/8/8/8/8 w - - 0 1', text: 'In pawn endgames the king leads. Step aside so your king controls the promotion path.', goal: ['e6d6', 'e6f6'], done: 'A king on the sixth rank in front of its pawn always wins.' },
  ]},
];
