// Original KPK retrograde knowledge. GPL-3.0-or-later.
#pragma once
#include "chess.hpp"
#include <iosfwd>
namespace forge::kpk {
struct Info {bool recognized=false,certified=false,win=false;int pawnSide=0,distance=0,score=0;};
struct Statistics {int states=196608,legal=0,wins=0,draws=0,passes=0,maxDistance=0;};
Info probe(const Board& board);
bool rootMove(Board& board,const std::vector<Move>& allowed,Move& best,int& score);
Statistics statistics();
void dump(std::ostream& output);
}
