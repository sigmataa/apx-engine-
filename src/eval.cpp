// Original tapered, handcrafted evaluation. No imported tables or network weights.
#include "eval.hpp"
#include "kpk.hpp"
#include <algorithm>
#include <cmath>
#include <cstdint>
#if defined(__AVX2__)
#include <immintrin.h>
#endif

namespace forge {
namespace {
#include "net.inc"
}
bool useNNUE=true;
// Original network trained on Apex Forge self-play (see train.cpp).
// Accumulators are refreshed per evaluation: at most 32 rows per perspective.
static_assert(NN_H<=NN_MAX_H,"network wider than accumulator frame");
// King-bucketed features: bucket from the perspective's own king square,
// mirrored so that king stands on files a-d (matches tools/train.cpp, KB=4).
struct KingView {int base,mirror;};
static inline int kingBucket(int relKing){int f=relKing&7,r=relKing>>3;if(f>=4)f^=7;return r==0?(f<=1?0:1):r<=2?2:3;}
static inline KingView kingView(const Board& b,int persp){
    int ks=b.kingSquare(persp),rel=persp==WHITE?ks:(ks^56);
    if(NN_KB==1)return {0,0};
    return {kingBucket(rel)*768,(rel&7)>=4?7:0};
}
static inline int nnIndex(int persp,const KingView& kv,int pc,int s){
    return kv.base+(color(pc)==persp?0:384)+(type(pc)-1)*64+((persp==WHITE?s:(s^56))^kv.mirror);
}
static void refresh(const Board& b,NNFrame& fr){
    for(int persp=0;persp<2;++persp){
        KingView kv=kingView(b,persp);
        std::int16_t* a=fr.acc[persp];for(int j=0;j<NN_H;++j)a[j]=NN_B1[j];
        U64 o=b.occupied();
        while(o){int s=pop(o);const std::int16_t* w=&NN_W1[nnIndex(persp,kv,b.squares[s],s)*NN_H];for(int j=0;j<NN_H;++j)a[j]+=w[j];}
    }
    fr.computed=true;
}
// Valid only when no king moved between parent and fr: king views then
// equal the current board's.
static void apply(const NNFrame& parent,NNFrame& fr,const KingView* kv){
    for(int persp=0;persp<2;++persp){
        std::int16_t* a=fr.acc[persp];const std::int16_t* pa=parent.acc[persp];
        const std::int16_t* add[8];const std::int16_t* sub[8];int na=0,ns=0;
        for(int k=0;k<fr.n;++k){
            const std::int16_t* w=&NN_W1[nnIndex(persp,kv[persp],fr.pc[k],fr.sq[k])*NN_H];
            if(fr.sign[k]>0)add[na++]=w;else sub[ns++]=w;
        }
        if(na==1&&ns==1){const std::int16_t*a0=add[0],*s0=sub[0];for(int j=0;j<NN_H;++j)a[j]=pa[j]+a0[j]-s0[j];}
        else if(na==1&&ns==2){const std::int16_t*a0=add[0],*s0=sub[0],*s1=sub[1];for(int j=0;j<NN_H;++j)a[j]=pa[j]+a0[j]-s0[j]-s1[j];}
        else{for(int j=0;j<NN_H;++j)a[j]=pa[j];
            for(int k=0;k<na;++k){const std::int16_t* w=add[k];for(int j=0;j<NN_H;++j)a[j]+=w[j];}
            for(int k=0;k<ns;++k){const std::int16_t* w=sub[k];for(int j=0;j<NN_H;++j)a[j]-=w[j];}}
    }
    fr.computed=true;
}
int nnueEvaluate(const Board& b){
    auto& frames=b.nn;int top=int(frames.size())-1,j=top;
    while(j>0&&!frames[j].computed&&top-j<16)--j;
    bool king=false;for(int k=j+1;k<=top;++k)king|=frames[k].kingMoved;
    if(!frames[j].computed||king)refresh(b,frames[top]);
    else{KingView kv[2]={kingView(b,WHITE),kingView(b,BLACK)};for(int k=j+1;k<=top;++k)apply(frames[k-1],frames[k],kv);}
    const std::int16_t (&acc)[2][NN_MAX_H]=frames[top].acc;
#ifdef NN_OUTBUCKETS
    // Output buckets by piece count (matches train_ob.py: bucket=(pieces-2)/4).
    const int ob=std::min(NN_OUTBUCKETS-1,std::max(0,(__builtin_popcountll(b.occupied())-2)/4));
    const std::int16_t* W2=NN_W2+ob*2*NN_H;const std::int16_t* W2T=NN_W2T+ob*2*NN_HT;int out=NN_B2[ob];
#else
    const std::int16_t* W2=NN_W2;const std::int16_t* W2T=NN_W2T;int out=NN_B2;
#endif
    const std::int16_t* us=acc[b.side];const std::int16_t* them=acc[b.side^1];
#if defined(__AVX2__)
    static_assert(NN_H%16==0,"AVX2 path needs NN_H multiple of 16");
    {   const __m256i zero=_mm256_setzero_si256(),hi=_mm256_set1_epi16(255);__m256i sum=_mm256_setzero_si256();
        for(int j=0;j<NN_H;j+=16){
            __m256i x=_mm256_min_epi16(_mm256_max_epi16(_mm256_load_si256((const __m256i*)(us+j)),zero),hi);
            sum=_mm256_add_epi32(sum,_mm256_madd_epi16(x,_mm256_loadu_si256((const __m256i*)(W2+j))));
            __m256i y=_mm256_min_epi16(_mm256_max_epi16(_mm256_load_si256((const __m256i*)(them+j)),zero),hi);
            sum=_mm256_add_epi32(sum,_mm256_madd_epi16(y,_mm256_loadu_si256((const __m256i*)(W2+NN_H+j))));
        }
        __m128i t=_mm_add_epi32(_mm256_castsi256_si128(sum),_mm256_extracti128_si256(sum,1));
        t=_mm_add_epi32(t,_mm_shuffle_epi32(t,0x4E));t=_mm_add_epi32(t,_mm_shuffle_epi32(t,0xB1));
        out+=_mm_cvtsi128_si32(t);
    }
#else
    for(int j=0;j<NN_H;++j)out+=std::clamp<int>(us[j],0,255)*W2[j];
    for(int j=0;j<NN_H;++j)out+=std::clamp<int>(them[j],0,255)*W2[NN_H+j];
#endif
    // Threat inputs (matches tools/train_threat.cpp): every attacked piece activates
    // (victim colour relative to perspective, victim type, cheapest attacker, square).
    {
        alignas(64) std::int16_t at[2][NN_HT];
        for(int q=0;q<2;++q)for(int j=0;j<NN_HT;++j)at[q][j]=NN_BT[j];
        U64 occ=b.occupied(),o=occ;
        U64 by[2][7]={},any[2]={};
        for(int c=0;c<2;++c){
            for(int pt=PAWN;pt<=KING;++pt){U64 ps=b.p[c][pt],m=0;
                while(ps){int q=pop(ps);
                    m|=pt==PAWN?T.pawn[c][q]:pt==KNIGHT?T.knight[q]:pt==BISHOP?bishopAttacks(q,occ):pt==ROOK?rookAttacks(q,occ):pt==QUEEN?queenAttacks(q,occ):T.king[q];}
                by[c][pt]=m;any[c]|=m;}
        }
        while(o){
            int s=pop(o),pc=b.squares[s],c=color(pc);U64 sb=bit(s);
            if(!(any[c^1]&sb))continue;
            int a=PAWN;while(!(by[c^1][a]&sb))++a;
            int def=(any[c]&sb)?1:0;
            for(int q=0;q<2;++q){
                int idx=((((c==q?0:1)*6+(type(pc)-1))*6+(a-1))*2+def)*64+(q==WHITE?s:(s^56));
                const std::int16_t* w=&NN_WT[idx*NN_HT];for(int j=0;j<NN_HT;++j)at[q][j]+=w[j];
            }
        }
        for(int j=0;j<NN_HT;++j)out+=std::clamp<int>(at[b.side][j],0,255)*W2T[j];
        for(int j=0;j<NN_HT;++j)out+=std::clamp<int>(at[b.side^1][j],0,255)*W2T[NN_HT+j];
    }
    int value=int(std::int64_t(out)*400/(255*64));
    value=value*(200-std::min(b.halfmove,100))/200;
    return std::clamp(value,-MATE_BOUND+200,MATE_BOUND-200);
}
}

namespace forge {
namespace {
int relativeRank(int c,int s){return c==WHITE?rank(s):7-rank(s);}
int distance(int a,int b){return std::max(std::abs(file(a)-file(b)),std::abs(rank(a)-rank(b)));}
int manhattan(int a,int b){return std::abs(file(a)-file(b))+std::abs(rank(a)-rank(b));}
constexpr int passedMG[8]={0,3,7,14,25,45,75,0};
constexpr int passedEG[8]={0,6,14,28,50,85,140,0};
U64 pawnAttacks(int c,U64 pawns){U64 a=0;while(pawns)a|=T.pawn[c][pop(pawns)];return a;}

// Evaluation geometry, not a replacement for Board's legal-move rules. Raw
// control is retained separately: even an absolutely pinned piece attacks
// squares for king-movement purposes. Active control estimates usable attacks.
struct AttackProfile {
    U64 raw[2]{},active[2]{},twice[2]{};
    U64 rawType[2][7]{},activeType[2][7]{};
    U64 pieceAttacks[64]{},pinLine[64]{};
    explicit AttackProfile(const Board& b){
        U64 occupied=b.occupied();
        for(int c=0;c<2;++c){
            int king=b.kingSquare(c);
            for(int direction=0;direction<8;++direction){
                U64 blockers=T.rays[direction][king]&occupied;
                if(!blockers)continue;
                int candidate=(direction&1)?63-std::countl_zero(blockers):first(blockers);
                if(!(b.occupancy[c]&bit(candidate)))continue;
                U64 beyond=T.rays[direction][candidate]&occupied;
                if(!beyond)continue;
                int pinner=(direction&1)?63-std::countl_zero(beyond):first(beyond);
                U64 sliders=b.p[c^1][QUEEN]|b.p[c^1][direction<4?ROOK:BISHOP];
                if(sliders&bit(pinner))pinLine[candidate]=(T.rays[direction][king]^T.rays[direction][pinner])|bit(king);
            }
        }
        for(int c=0;c<2;++c)for(int pt=PAWN;pt<=KING;++pt){
            U64 pieces=b.p[c][pt];
            while(pieces){
                int s=pop(pieces);U64 control=0;
                switch(pt){
                case PAWN:control=T.pawn[c][s];break;
                case KNIGHT:control=T.knight[s];break;
                case BISHOP:control=bishopAttacks(s,occupied);break;
                case ROOK:control=rookAttacks(s,occupied);break;
                case QUEEN:control=queenAttacks(s,occupied);break;
                case KING:control=T.king[s];break;
                }
                raw[c]|=control;rawType[c][pt]|=control;
                if(pinLine[s])control&=pinLine[s];
                pieceAttacks[s]=control;
                twice[c]|=active[c]&control;active[c]|=control;activeType[c][pt]|=control;
            }
        }
    }
};
}

int pieceSquareFormula(int pt,int c,int s,bool ending){
    int f=file(s),r=relativeRank(c,s),center=14-std::abs(2*f-7)-std::abs(2*r-7);
    switch(pt){
    case PAWN:return ending?r*12-std::abs(2*f-7):r*7-std::abs(2*f-7)*2;
    case KNIGHT:return center*(ending?3:4)-(r==0?12:0)-(f==0||f==7?8:0);
    case BISHOP:return center*3+r*2;
    case ROOK:return r*(ending?3:2)+(f==3||f==4?3:0);
    case QUEEN:return center*(ending?3:1)-(ending?0:std::max(0,r-2)*5);
    case KING:
        if(ending)return center*6;
        return -center*5-r*8+((r<=1&&(f<=2||f>=6))?24:0);
    default:return 0;
    }
}
std::pair<int,int> Evaluator::pawns(const Board& b){
    auto& entry=pawnTable[b.pawnKey&(pawnTable.size()-1)];
    if(entry.valid&&entry.key==b.pawnKey)return {entry.mg,entry.eg};
    int mg=0,eg=0;
    for(int c=0;c<2;++c){
        int sign=c==WHITE?1:-1;U64 own=b.p[c][PAWN],enemy=b.p[c^1][PAWN];
        U64 enemyAttacks=pawnAttacks(c^1,enemy);
        for(int f=0;f<8;++f){int n=count(own&T.files[f]);if(n>1){mg-=sign*(n-1)*18;eg-=sign*(n-1)*25;}}
        U64 remaining=own;
        while(remaining){
            int s=pop(remaining),r=relativeRank(c,s),f=file(s);
            bool isolated=!(own&T.adjacent[f]),supported=(T.pawn[c^1][s]&own)!=0;
            if(isolated){mg-=sign*12;eg-=sign*16;}
            if(supported){mg+=sign*6;eg+=sign*10;}
            U64 sameRank=T.adjacent[f]&(U64(0xff)<<(rank(s)*8));
            if(own&sameRank){mg+=sign*5;eg+=sign*8;}
            if(!(T.passed[c][s]&enemy)&&!(T.front[c][s]&own)){mg+=sign*passedMG[r];eg+=sign*passedEG[r];}
            int push=s+(c==WHITE?8:-8);
            if(!isolated&&!supported&&push>=0&&push<64&&(enemyAttacks&bit(push))){mg-=sign*7;eg-=sign*8;}
        }
    }
    entry={b.pawnKey,mg,eg,true};return {mg,eg};
}
int Evaluator::evaluate(const Board& b){
    if(auto ending=kpk::probe(b);ending.certified)return ending.score;
    if(useNNUE){
        // Bare-king endings keep the handcrafted mating guidance below.
        bool bare=(count(b.occupancy[WHITE])==1||count(b.occupancy[BLACK])==1);
        if(!bare)return nnueEvaluate(b);
    }
    auto [mg,eg]=pawns(b);int phase=0;
    constexpr int phaseWeight[7]={0,0,1,1,2,4,0};
    constexpr int mobilityMG[7]={0,0,4,4,2,1,0};
    constexpr int mobilityEG[7]={0,0,3,4,4,2,0};
    constexpr int mobilityBase[7]={0,0,4,7,7,14,0};
    constexpr int attackWeight[7]={0,1,2,2,3,5,0};
    const AttackProfile profile(b);
    U64 all=b.occupied(),pawnControl[2]={profile.rawType[0][PAWN],profile.rawType[1][PAWN]};
    U64 attacks[2]={profile.active[0],profile.active[1]};
    int pressure[2]{},attackers[2]{};
    for(int c=0;c<2;++c){
        int sign=c==WHITE?1:-1,enemy=c^1;
        U64 kingRing=T.king[b.kingSquare(enemy)]|b.p[enemy][KING];
        if(count(b.p[c][BISHOP])>=2){mg+=sign*30;eg+=sign*45;}
        for(int pt=PAWN;pt<=KING;++pt){
            U64 pieces=b.p[c][pt];
            while(pieces){
                int s=pop(pieces),rr=relativeRank(c,s);
                mg+=sign*(MG_VALUE[pt]+pieceSquare(pt,c,s));eg+=sign*(EG_VALUE[pt]+pieceSquare(pt,c,s,true));
                phase+=phaseWeight[pt];
                U64 a=profile.pieceAttacks[s];
                if(pt>=KNIGHT&&pt<=QUEEN){
                    U64 unsafe=pawnControl[enemy];
                    if(pt==ROOK||pt==QUEEN)unsafe|=profile.activeType[enemy][KNIGHT]|profile.activeType[enemy][BISHOP];
                    if(pt==QUEEN)unsafe|=profile.activeType[enemy][ROOK];
                    int mobility=count(a&~b.occupancy[c]&~unsafe)-mobilityBase[pt];
                    mg+=sign*mobility*mobilityMG[pt];eg+=sign*mobility*mobilityEG[pt];
                    int hits=count(a&kingRing);
                    if(hits){pressure[c]+=hits*attackWeight[pt];++attackers[c];}
                }
                if(pt==KNIGHT&&rr>=3&&rr<=5&&(profile.activeType[c][PAWN]&bit(s))
                   &&!(T.passed[c][s]&T.adjacent[file(s)]&b.p[enemy][PAWN])){mg+=sign*16;eg+=sign*10;}
                if(pt==BISHOP){int same=count(b.p[c][PAWN]&T.squareColor[(file(s)+rank(s))&1]);mg-=sign*same*2;}
                if(pt==ROOK){
                    if(!(b.p[c][PAWN]&T.files[file(s)])){
                        mg+=sign*12;eg+=sign*10;
                        if(!(b.p[enemy][PAWN]&T.files[file(s)])){mg+=sign*12;eg+=sign*12;}
                    }
                    if(rr==6){mg+=sign*15;eg+=sign*20;}
                }
                if(pt==PAWN&&!(T.passed[c][s]&b.p[enemy][PAWN])&&!(T.front[c][s]&b.p[c][PAWN])){
                    int push=s+(c==WHITE?8:-8);
                    if(push>=0&&push<64){
                        if(b.squares[push]){mg-=sign*passedMG[rr]/2;eg-=sign*passedEG[rr]/3;}
                        if(rr>=3)eg+=sign*rr*3*(distance(b.kingSquare(enemy),push)-distance(b.kingSquare(c),push));
                        if(b.p[c][ROOK]&&(rookAttacks(s,all)&T.front[enemy][s]&b.p[c][ROOK]))eg+=sign*12;
                        if(rr>=3&&(!profile.pinLine[s]||(profile.pinLine[s]&bit(push)))){
                            U64 path=T.front[c][s],uncovered=profile.active[enemy]&~profile.active[c];
                            if(!(all&bit(push))){
                                eg+=sign*rr*rr;
                                if(!(uncovered&bit(push)))eg+=sign*rr*2;
                            }
                            if(!(path&(all|uncovered)))eg+=sign*rr*rr*2;
                        }
                    }
                }
            }
        }
    }
    for(int c=0;c<2;++c){
        int sign=c==WHITE?1:-1,enemy=c^1,ks=b.kingSquare(c),kr=relativeRank(c,ks);
        if(b.p[enemy][QUEEN]&&attackers[enemy]>=2)mg-=sign*std::min(300,pressure[enemy]*pressure[enemy]/7);
        else if(b.p[enemy][ROOK]&&attackers[enemy]>=2)mg-=sign*std::min(100,pressure[enemy]*pressure[enemy]/14);
        U64 enemyNonPawns=b.p[enemy][KNIGHT]|b.p[enemy][BISHOP]|b.p[enemy][ROOK]|b.p[enemy][QUEEN];
        if(b.p[enemy][QUEEN]||count(enemyNonPawns)>=2){
            U64 ring=T.king[ks],weak=profile.active[enemy]&~profile.twice[c]
                &(~profile.active[c]|profile.activeType[c][KING]|profile.activeType[c][QUEEN]);
            U64 safe=~b.occupancy[enemy]&(~profile.raw[c]|(weak&profile.twice[enemy]));
            U64 diagonal=bishopAttacks(ks,all),straight=rookAttacks(ks,all);
            int checks=8*std::min(2,count(T.knight[ks]&profile.activeType[enemy][KNIGHT]&safe))
                +6*std::min(2,count(diagonal&profile.activeType[enemy][BISHOP]&safe))
                +10*std::min(2,count(straight&profile.activeType[enemy][ROOK]&safe))
                +14*std::min(2,count((diagonal|straight)&profile.activeType[enemy][QUEEN]&safe));
            int holes=count(ring&weak),coordination=count(ring&weak&profile.twice[enemy]);
            mg-=sign*std::min(180,checks+holes*4+coordination*6);
        }
        if(kr<=2&&(b.p[enemy][QUEEN]|b.p[enemy][ROOK])){
            for(int f=std::max(0,file(ks)-1);f<=std::min(7,file(ks)+1);++f){
                U64 shield=0;
                for(int d=1;d<=2;++d){int rr=rank(ks)+(c==WHITE?d:-d);if(rr>=0&&rr<8)shield|=bit(rr*8+f);}
                if(!(shield&b.p[c][PAWN]))mg-=sign*12;
                if(!(b.p[c][PAWN]&T.files[f]))mg-=sign*8;
            }
        }
        for(int pt=KNIGHT;pt<=QUEEN;++pt){
            U64 loose=b.p[enemy][pt]&attacks[c]&~attacks[enemy];
            int bonus=pt==QUEEN?30:pt==ROOK?20:12;
            mg+=sign*count(loose)*bonus;eg+=sign*count(loose)*bonus;
            U64 pawnThreats=b.p[enemy][pt]&profile.activeType[c][PAWN];mg+=sign*count(pawnThreats)*15;eg+=sign*count(pawnThreats)*12;
            // Value pressure on defended, more expensive pieces separately
            // from the existing undefended-piece and pawn-attack terms.
            U64 defended=b.p[enemy][pt]&attacks[enemy];
            if(pt==ROOK||pt==QUEEN){
                U64 minors=profile.activeType[c][KNIGHT]|profile.activeType[c][BISHOP];
                int minorBonus=pt==QUEEN?24:14;mg+=sign*count(defended&minors)*minorBonus;eg+=sign*count(defended&minors)*minorBonus;
            }
            if(pt==QUEEN){int n=count(defended&profile.activeType[c][ROOK]);mg+=sign*n*18;eg+=sign*n*18;}
            U64 overloaded=defended&profile.twice[c]&~profile.twice[enemy]&~pawnControl[enemy];
            mg+=sign*count(overloaded)*8;eg+=sign*count(overloaded)*6;
        }
        U64 pushers=b.p[c][PAWN];
        while(pushers){
            int s=pop(pushers),push=s+(c==WHITE?8:-8);
            if(push<0||push>=64||b.squares[push])continue;
            // A vertically pinned pawn may push, but remains unable to play
            // either diagonal capture afterward. Do not invent a fork threat.
            if(profile.pinLine[s])continue;
            if((pawnControl[enemy]&bit(push))||((attacks[enemy]&bit(push))&&!(attacks[c]&bit(push))))continue;
            U64 targets=T.pawn[c][push]&(b.p[enemy][KNIGHT]|b.p[enemy][BISHOP]|b.p[enemy][ROOK]|b.p[enemy][QUEEN]);
            int n=count(targets);if(n){mg+=sign*(n>=2?20:8);eg+=sign*(n>=2?12:4);}
        }
        if(!b.p[enemy][PAWN]&&count(b.occupancy[enemy])==1&&!b.p[c][PAWN]){
            bool enough=b.p[c][ROOK]||b.p[c][QUEEN]||count(b.p[c][BISHOP])>=2||(b.p[c][BISHOP]&&b.p[c][KNIGHT]);
            if(enough){
                int target=b.kingSquare(enemy),edge=std::min({file(target),7-file(target),rank(target),7-rank(target)});
                eg+=sign*(40*(3-edge)+10*(14-manhattan(ks,target)));
                if(!b.p[c][ROOK]&&!b.p[c][QUEEN]&&count(b.p[c][BISHOP])==1&&count(b.p[c][KNIGHT])==1){
                    int bishop=first(b.p[c][BISHOP]);bool light=(file(bishop)+rank(bishop))&1;
                    int nearest=light?std::min(distance(target,7),distance(target,56)):std::min(distance(target,0),distance(target,63));
                    eg+=sign*(7-nearest)*12;
                }
            }
        }
    }
    phase=std::min(24,phase);
    int value=(mg*phase+eg*(24-phase))/24;
    if(!(b.p[0][PAWN]|b.p[1][PAWN])&&!(b.p[0][ROOK]|b.p[1][ROOK]|b.p[0][QUEEN]|b.p[1][QUEEN])
       &&std::abs(value)<400)value=value*3/4;
    value=std::clamp(value,-26000,26000);
    return (b.side==WHITE?value:-value)+10;
}
const std::array<std::array<std::array<std::array<std::int16_t,64>,2>,7>,2> PST=[]{
    std::array<std::array<std::array<std::array<std::int16_t,64>,2>,7>,2> t{};
    for(int ending=0;ending<2;++ending)for(int pt=0;pt<7;++pt)for(int c=0;c<2;++c)for(int s=0;s<64;++s)
        t[ending][pt][c][s]=std::int16_t(pieceSquareFormula(pt,c,s,ending));
    return t;
}();
}
