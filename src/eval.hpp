#pragma once
#include "chess.hpp"
#include <algorithm>
#include <vector>
#include <array>
#include <cstdint>

namespace forge {
constexpr int MG_VALUE[7]={0,100,320,335,500,1000,0};
constexpr int EG_VALUE[7]={0,125,305,335,525,975,0};
int pieceSquareFormula(int pt,int c,int sq,bool ending);
extern const std::array<std::array<std::array<std::array<std::int16_t,64>,2>,7>,2> PST;
inline int pieceSquare(int pt,int c,int sq,bool ending=false){return PST[ending][pt][c][sq];}
extern bool useNNUE;
int nnueEvaluate(const Board& b);
class Evaluator {
    struct PawnEntry {U64 key=0;int mg=0,eg=0;bool valid=false;};
    std::vector<PawnEntry> pawnTable;
    std::pair<int,int> pawns(const Board& b);
public:
    Evaluator():pawnTable(16384){}
    int evaluate(const Board& b);
    void clear(){std::fill(pawnTable.begin(),pawnTable.end(),PawnEntry{});}
};
}
