// Apex Forge: original classical chess engine. GPL-3.0-or-later; see ../LICENSE.
#pragma once
#include <array>
#include <bit>
#include <cstdint>
#include <string>
#include <vector>

namespace forge {
using U64 = std::uint64_t;
using Move = std::uint16_t;
constexpr int WHITE=0, BLACK=1, PAWN=1, KNIGHT=2, BISHOP=3, ROOK=4, QUEEN=5, KING=6;
constexpr int MAX_PLY=128, INF=32000, MATE=30000, MATE_BOUND=MATE-MAX_PLY;
constexpr const char* START_FEN="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
inline U64 bit(int s){return U64(1)<<s;}
inline int file(int s){return s&7;}
inline int rank(int s){return s>>3;}
inline int count(U64 b){return std::popcount(b);}
inline int first(U64 b){return std::countr_zero(b);}
inline int pop(U64& b){int s=first(b);b&=b-1;return s;}
inline int color(int p){return (p-1)/6;}
inline int type(int p){return (p-1)%6+1;}
inline int piece(int c,int t){return c*6+t;}
inline Move move(int f,int t,int promotion=0){return Move(f|(t<<6)|(promotion<<12));}
inline int from(Move m){return m&63;}
inline int to(Move m){return (m>>6)&63;}
inline int promotion(Move m){return (m>>12)&7;}
inline int promotionType(Move m){return promotion(m)?promotion(m)+1:0;}
std::string squareName(int s);
std::string moveName(Move m);

struct Tables {
    U64 pawn[2][64]{}, knight[64]{}, king[64]{}, files[8]{}, adjacent[8]{};
    U64 passed[2][64]{}, front[2][64]{}, squareColor[2]{};
    U64 rookMask[64]{}, bishopMask[64]{};
    U64 rays[8][64]{};
    std::size_t rookOffset[64]{}, bishopOffset[64]{};
    std::vector<U64> rookTable,bishopTable;
    U64 zobrist[13][64]{}, castles[16]{}, ep[8]{}, side{};
    int castleMask[64]{};
    Tables();
};
extern Tables T;
U64 rookAttacks(int s,U64 occupied);
U64 bishopAttacks(int s,U64 occupied);
inline U64 queenAttacks(int s,U64 occupied){return rookAttacks(s,occupied)|bishopAttacks(s,occupied);}
U64 attackersTo(int square,int side,U64 occupied,const U64 p[2][7]);

struct MoveList {
    std::array<Move,256> moves{};
    int size=0;
    void add(Move m){moves[size++]=m;}
    Move* begin(){return moves.data();}
    Move* end(){return moves.data()+size;}
};
struct Undo {
    U64 key=0,pawnKey=0;
    int castle=0,ep=-1,halfmove=0,fullmove=1,sinceNull=0;
    int captured=0,capturedSquare=-1,mover=0;
};
// Lazily updated NNUE accumulator frame: one per ply, holding up to four
// piece additions/removals made by that move (castling or capture-promotion).
constexpr int NN_MAX_H=256;
struct NNFrame {
    std::uint8_t n=0;bool computed=false,kingMoved=false;
    std::int8_t pc[4]{},sq[4]{},sign[4]{};
    alignas(64) std::int16_t acc[2][NN_MAX_H];
};
struct Board {
    std::array<int,64> squares{};
    U64 p[2][7]{},occupancy[2]{};
    int side=WHITE,castle=0,ep=-1,halfmove=0,fullmove=1,sinceNull=10000;
    U64 key=0,pawnKey=0;
    std::vector<U64> history;
    mutable std::vector<NNFrame> nn;
    Board(){history.reserve(512);nn.reserve(160);nn.emplace_back();}
    U64 occupied()const{return occupancy[0]|occupancy[1];}
    int kingSquare(int c)const{return first(p[c][KING]);}
    bool attacked(int s,int by)const{return attackersTo(s,by,occupied(),p)!=0;}
    bool inCheck()const{return attacked(kingSquare(side),side^1);}
    bool setFen(const std::string& fen,std::string& error);
    std::string fen()const;
    void generate(MoveList& list,bool capturesOnly=false)const;
    bool make(Move m,Undo& u);
    void unmake(Move m,const Undo& u);
    void makeNull(Undo& u);
    void unmakeNull(const Undo& u);
    bool hasLegalMove();
    MoveList legalMoves();
    Move parseMove(const std::string& text);
    bool isCapture(Move m)const;
    int capturedType(Move m)const;
    bool insufficient()const;
    bool repetition(std::size_t rootHistory)const;
    int see(Move m)const;
    bool verify()const;
private:
    void add(int square,int pc);
    void remove(int square);
    bool hashEp()const;
    void rebuild();
};
U64 perft(Board& b,int depth);
bool selfcheck(std::string& error);
}
