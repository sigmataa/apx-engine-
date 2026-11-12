// Original KPK retrograde solver. GPL-3.0-or-later.
#include "kpk.hpp"
#include <algorithm>
#include <array>
#include <cstdlib>
#include <ostream>
#include <stdexcept>

namespace forge::kpk {
namespace {
constexpr int SIZE=24*64*64*2;
enum State:std::uint8_t {INVALID,UNKNOWN,DRAW,WIN};
int index(int pawn,int own,int enemy,int turn){return (((rank(pawn)-1)*4+file(pawn))*64+own)*128+enemy*2+turn;}
bool adjacent(int a,int b){return std::max(std::abs(file(a)-file(b)),std::abs(rank(a)-rank(b)))<=1;}
bool pawnAttack(int pawn,int square){return rank(square)==rank(pawn)+1&&std::abs(file(square)-file(pawn))==1;}
bool sliderAttack(int pt,int source,int target,int blocker){
    int df=file(target)-file(source),dr=rank(target)-rank(source);
    if(!(df==0||dr==0||(pt==QUEEN&&std::abs(df)==std::abs(dr))))return false;
    int sf=(df>0)-(df<0),sr=(dr>0)-(dr<0),f=file(source)+sf,r=rank(source)+sr;
    while(f!=file(target)||r!=rank(target)){if(r*8+f==blocker)return false;f+=sf;r+=sr;}
    return true;
}
class Table {
    std::array<std::uint8_t,SIZE> state{};
    std::array<std::uint16_t,SIZE> distance{};
    std::array<U64,64> kings{};
    Statistics stats;
    bool promotionWin(int own,int enemy,int square,int pt)const{
        if(adjacent(enemy,square)&&!adjacent(own,square))return false;
        bool checked=sliderAttack(pt,square,enemy,own);U64 moves=kings[enemy];
        while(moves){int dst=pop(moves);if(dst==own||adjacent(dst,own)||dst==square)continue;
            if(!sliderAttack(pt,square,dst,own))return true;}
        return checked; // Checkmate wins; stalemate draws.
    }
    struct Edges {
        int count=0,unknown=0,wins=0,draws=0,minDistance=65535,maxDistance=0;
        void add(int outcome,int d){++count;
            if(outcome==INVALID)throw std::logic_error("KPK transition into an illegal state");
            if(outcome==UNKNOWN)++unknown;
            else if(outcome==DRAW)++draws;
            else {++wins;minDistance=std::min(minDistance,d);maxDistance=std::max(maxDistance,d);}}
    };
    Edges edges(int pawn,int own,int enemy,int turn)const{
        Edges out;
        auto child=[&](int p,int w,int b,int side){int i=index(p,w,b,side);out.add(state[i],distance[i]);};
        if(!turn){
            U64 moves=kings[own];while(moves){int dst=pop(moves);
                if(dst==pawn||dst==enemy||adjacent(dst,enemy))continue;
                child(pawn,dst,enemy,1);}
            int push=pawn+8;
            if(push!=own&&push!=enemy){
                if(rank(pawn)==6)out.add(promotionWin(own,enemy,push,QUEEN)||promotionWin(own,enemy,push,ROOK)?WIN:DRAW,0);
                else {child(push,own,enemy,1);
                    if(rank(pawn)==1&&pawn+16!=own&&pawn+16!=enemy)child(pawn+16,own,enemy,1);}
            }
        }else{
            U64 moves=kings[enemy];while(moves){int dst=pop(moves);
                if(dst==own||adjacent(dst,own))continue;
                if(dst==pawn)out.add(DRAW,0);
                else if(!pawnAttack(pawn,dst))child(pawn,own,dst,0);
            }
        }
        return out;
    }
public:
    Table(){
        // Build independent geometry; static initialization need not depend on T.
        for(int s=0;s<64;++s)for(int f=std::max(0,file(s)-1);f<=std::min(7,file(s)+1);++f)
            for(int r=std::max(0,rank(s)-1);r<=std::min(7,rank(s)+1);++r)if(r*8+f!=s)kings[s]|=bit(r*8+f);
        for(int p=0;p<24;++p){int pawn=(p/4+1)*8+p%4;
            for(int w=0;w<64;++w)for(int b=0;b<64;++b)for(int side=0;side<2;++side){
                int i=index(pawn,w,b,side);
                if(w!=pawn&&b!=pawn&&!adjacent(w,b)&&(side||!pawnAttack(pawn,b))){state[i]=UNKNOWN;++stats.legal;}
            }}
        bool changed;
        do{
            changed=false;++stats.passes;
            for(int p=0;p<24;++p){int pawn=(p/4+1)*8+p%4;
                for(int w=0;w<64;++w)for(int b=0;b<64;++b)for(int side=0;side<2;++side){
                    int i=index(pawn,w,b,side);if(state[i]!=UNKNOWN)continue;
                    Edges e=edges(pawn,w,b,side);int result=UNKNOWN,d=0;
                    if(!e.count)result=side&&pawnAttack(pawn,b)?WIN:DRAW;
                    else if(!side){if(e.wins){result=WIN;d=e.minDistance+1;}else if(!e.unknown)result=DRAW;}
                    else {if(e.draws)result=DRAW;else if(!e.unknown){result=WIN;d=e.maxDistance+1;}}
                    if(result!=UNKNOWN){if(d>=65535)throw std::logic_error("KPK conversion rank overflow");
                        state[i]=std::uint8_t(result);distance[i]=std::uint16_t(d);changed=true;}
                }}
        }while(changed);
        for(int i=0;i<SIZE;++i){if(state[i]==UNKNOWN)state[i]=DRAW;
            if(state[i]==WIN){++stats.wins;stats.maxDistance=std::max<int>(stats.maxDistance,distance[i]);}
            else if(state[i]==DRAW)++stats.draws;}
        // This ranking proves a finite conversion strategy, not optimal DTM.
        for(int p=0;p<24;++p){int pawn=(p/4+1)*8+p%4;
            for(int w=0;w<64;++w)for(int b=0;b<64;++b)for(int side=0;side<2;++side){
                int i=index(pawn,w,b,side);if(state[i]!=WIN)continue;Edges e=edges(pawn,w,b,side);
                if(!e.count)continue;
                if((!side&&(!e.wins||e.minDistance>=distance[i]))
                   ||(side&&(e.draws||e.unknown||e.maxDistance>=distance[i])))throw std::logic_error("KPK progress invariant failed");
            }}
    }
    Info probe(const Board& board)const{
        Info out;if(count(board.occupied())!=3)return out;
        U64 pawns=board.p[WHITE][PAWN]|board.p[BLACK][PAWN];if(count(pawns)!=1)return out;
        int color=board.p[WHITE][PAWN]?WHITE:BLACK,pawn=first(pawns),own=board.kingSquare(color),enemy=board.kingSquare(color^1);
        if(color==BLACK){pawn^=56;own^=56;enemy^=56;}
        if(file(pawn)>=4){pawn^=7;own^=7;enemy^=7;}
        if(rank(pawn)<1||rank(pawn)>6)return out;
        int i=index(pawn,own,enemy,board.side==color?0:1);if(state[i]==INVALID)return out;
        out.recognized=true;out.pawnSide=color;out.win=state[i]==WIN;out.distance=distance[i];
        out.certified=!out.win||board.halfmove+out.distance<100;
        if(out.win)out.score=(board.side==color?1:-1)*(400-out.distance);
        return out;
    }
    Statistics statistics()const{return stats;}
    void dump(std::ostream& out)const{
        for(int i=0;i<SIZE;++i){out.put(char(state[i]));out.put(char(distance[i]&255));out.put(char(distance[i]>>8));}
    }
};
const Table table;
}
Info probe(const Board& board){return table.probe(board);}
Statistics statistics(){return table.statistics();}
void dump(std::ostream& out){table.dump(out);}
bool rootMove(Board& board,const std::vector<Move>& allowed,Move& best,int& score){
    Info root=probe(board);if(!root.certified)return false;
    int us=board.side,bestScore=-INF;Move chosen=0;std::size_t history=board.history.size();
    for(Move m:allowed){Undo undo;if(!board.make(m,undo))continue;
        // Historical repetition can improve the defender's actual outcome;
        // ordinary search already handles that context and takes precedence.
        if(board.repetition(history)){board.unmake(m,undo);return false;}
        bool known=false,win=false;int rank=0,value=0;
        if(count(board.occupied())==2)known=true;
        else if(promotion(m)){
            int pt=promotionType(m);known=true;
            if(pt==ROOK||pt==QUEEN){
                auto legal=board.legalMoves();win=true;
                if(!legal.size){win=board.inCheck();if(win)value=MATE-1;}
                else for(Move reply:legal)if(to(reply)==to(m)){win=false;break;}
                if(win&&!value)value=pt==QUEEN?900:500;
            }
        }else{
            Info child=probe(board);known=child.certified;win=child.win;rank=child.distance;
            if(win)value=rank?400-rank:MATE-1;
        }
        board.unmake(m,undo);
        if(!known||win!=root.win||(win&&!promotion(m)&&rank>=root.distance))continue;
        int candidate=us==root.pawnSide?value:-value;
        if(!chosen||candidate>bestScore){chosen=m;bestScore=candidate;}
    }
    if(!chosen)return false;
    best=chosen;score=bestScore;return true;
}
}
