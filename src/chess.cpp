// Apex Forge: original implementation; standard chess algorithms, no engine code imports.
#include "chess.hpp"
#include <algorithm>
#include <cassert>
#include <cctype>
#include <sstream>
#ifdef __BMI2__
#include <immintrin.h>
#endif

namespace forge {
namespace {
constexpr int rookDirs[4][2]={{1,0},{-1,0},{0,1},{0,-1}};
constexpr int bishopDirs[4][2]={{1,1},{1,-1},{-1,1},{-1,-1}};
bool inside(int f,int r){return f>=0&&f<8&&r>=0&&r<8;}
U64 ray(int sq,U64 occ,const int dirs[4][2]){
    U64 a=0;
    for(int d=0;d<4;++d){
        int f=file(sq)+dirs[d][0],r=rank(sq)+dirs[d][1];
        while(inside(f,r)){int s=r*8+f;a|=bit(s);if(occ&bit(s))break;f+=dirs[d][0];r+=dirs[d][1];}
    }
    return a;
}
U64 relevant(int sq,const int dirs[4][2]){
    U64 a=0;
    for(int d=0;d<4;++d){
        int f=file(sq)+dirs[d][0],r=rank(sq)+dirs[d][1];
        while(inside(f,r)){
            if(inside(f+dirs[d][0],r+dirs[d][1]))a|=bit(r*8+f);
            f+=dirs[d][0];r+=dirs[d][1];
        }
    }
    return a;
}
std::size_t compress(U64 occupied,U64 mask){
    std::size_t index=0,k=0;
    while(mask){int s=pop(mask);if(occupied&bit(s))index|=std::size_t(1)<<k;++k;}
    return index;
}
U64 random64(U64& s){s+=0x9e3779b97f4a7c15ULL;U64 z=s;z=(z^(z>>30))*0xbf58476d1ce4e5b9ULL;z=(z^(z>>27))*0x94d049bb133111ebULL;return z^(z>>31);}
constexpr int seeValue[7]={0,100,320,335,500,1000,20000};
}

Tables::Tables(){
    constexpr int nDelta[8][2]={{1,2},{2,1},{2,-1},{1,-2},{-1,-2},{-2,-1},{-2,1},{-1,2}};
    for(int s=0;s<64;++s){
        int f=file(s),r=rank(s);files[f]|=bit(s);squareColor[(f+r)&1]|=bit(s);castleMask[s]=15;
        for(int d=0;d<8;++d){
            const auto& step=d<4?rookDirs[d]:bishopDirs[d-4];
            int ff=f+step[0],rr=r+step[1];
            while(inside(ff,rr)){rays[d][s]|=bit(rr*8+ff);ff+=step[0];rr+=step[1];}
        }
        for(auto& d:nDelta)if(inside(f+d[0],r+d[1]))knight[s]|=bit((r+d[1])*8+f+d[0]);
        for(int df=-1;df<=1;++df)for(int dr=-1;dr<=1;++dr)
            if((df||dr)&&inside(f+df,r+dr))king[s]|=bit((r+dr)*8+f+df);
        for(int c=0;c<2;++c){
            int dr=c==WHITE?1:-1;
            for(int df:{-1,1})if(inside(f+df,r+dr))pawn[c][s]|=bit((r+dr)*8+f+df);
            for(int rr=r+dr;rr>=0&&rr<8;rr+=dr){
                front[c][s]|=bit(rr*8+f);
                for(int ff=std::max(0,f-1);ff<=std::min(7,f+1);++ff)passed[c][s]|=bit(rr*8+ff);
            }
        }
    }
    for(int f=0;f<8;++f){if(f)adjacent[f]|=files[f-1];if(f<7)adjacent[f]|=files[f+1];}
    castleMask[4]=12;castleMask[0]=13;castleMask[7]=14;
    castleMask[60]=3;castleMask[56]=7;castleMask[63]=11;
    std::size_t ro=0,bo=0;
    for(int s=0;s<64;++s){
        rookMask[s]=relevant(s,rookDirs);bishopMask[s]=relevant(s,bishopDirs);
        rookOffset[s]=ro;bishopOffset[s]=bo;
        ro+=std::size_t(1)<<count(rookMask[s]);bo+=std::size_t(1)<<count(bishopMask[s]);
    }
    rookTable.resize(ro);bishopTable.resize(bo);
    for(int s=0;s<64;++s){
        for(int kind=0;kind<2;++kind){
            U64 mask=kind?bishopMask[s]:rookMask[s],subset=0;
            do{
                auto index=compress(subset,mask);
                if(kind)bishopTable[bishopOffset[s]+index]=ray(s,subset,bishopDirs);
                else rookTable[rookOffset[s]+index]=ray(s,subset,rookDirs);
                subset=(subset-mask)&mask;
            }while(subset);
        }
    }
    U64 seed=0x41504558464f5247ULL;
    for(auto& row:zobrist)for(auto& v:row)v=random64(seed);
    for(auto& v:castles)v=random64(seed);
    for(auto& v:ep)v=random64(seed);
    side=random64(seed);
}
Tables T;

#ifndef __BMI2__
namespace {
// Direction indices alternate increasing and decreasing square numbers.
// Include the first blocker; remove exactly the ray extending beyond it.
U64 trimmedRay(int s,U64 occ,int direction){
    U64 attacks=T.rays[direction][s],blockers=attacks&occ;
    if(blockers){
        int nearest=(direction&1)?63-std::countl_zero(blockers):first(blockers);
        attacks^=T.rays[direction][nearest];
    }
    return attacks;
}
}
#endif
U64 rookAttacks(int s,U64 occ){
#ifdef __BMI2__
    return T.rookTable[T.rookOffset[s]+_pext_u64(occ,T.rookMask[s])];
#else
    return trimmedRay(s,occ,0)|trimmedRay(s,occ,1)|trimmedRay(s,occ,2)|trimmedRay(s,occ,3);
#endif
}
U64 bishopAttacks(int s,U64 occ){
#ifdef __BMI2__
    return T.bishopTable[T.bishopOffset[s]+_pext_u64(occ,T.bishopMask[s])];
#else
    return trimmedRay(s,occ,4)|trimmedRay(s,occ,5)|trimmedRay(s,occ,6)|trimmedRay(s,occ,7);
#endif
}
U64 attackersTo(int s,int by,U64 occ,const U64 p[2][7]){
    return (T.pawn[by^1][s]&p[by][PAWN]) | (T.knight[s]&p[by][KNIGHT])
         | (T.king[s]&p[by][KING]) | (bishopAttacks(s,occ)&(p[by][BISHOP]|p[by][QUEEN]))
         | (rookAttacks(s,occ)&(p[by][ROOK]|p[by][QUEEN]));
}
std::string squareName(int s){return std::string{char('a'+file(s)),char('1'+rank(s))};}
std::string moveName(Move m){if(!m)return "0000";std::string s=squareName(from(m))+squareName(to(m));if(promotion(m))s+=" nbrq"[promotion(m)];return s;}

void Board::add(int s,int pc){
    assert(pc&&s>=0&&s<64&&!squares[s]);
    squares[s]=pc;p[color(pc)][type(pc)]|=bit(s);occupancy[color(pc)]|=bit(s);key^=T.zobrist[pc][s];
    if(type(pc)==PAWN)pawnKey^=T.zobrist[pc][s];
}
void Board::remove(int s){
    int pc=squares[s];assert(pc);
    squares[s]=0;p[color(pc)][type(pc)]^=bit(s);occupancy[color(pc)]^=bit(s);key^=T.zobrist[pc][s];
    if(type(pc)==PAWN)pawnKey^=T.zobrist[pc][s];
}
bool Board::hashEp()const{
    if(ep<0)return false;
    U64 candidates=T.pawn[side^1][ep]&p[side][PAWN];
    if(!candidates)return false;
    int captured=ep+(side==WHITE?-8:8);
    if(squares[captured]!=piece(side^1,PAWN))return false;
    U64 local[2][7];for(int c=0;c<2;++c)std::copy_n(p[c],7,local[c]);
    local[side^1][PAWN]&=~bit(captured);
    while(candidates){
        int src=pop(candidates);U64 occ=(occupied()&~bit(src)&~bit(captured))|bit(ep);
        if(!attackersTo(kingSquare(side),side^1,occ,local))return true;
    }
    return false;
}
void Board::rebuild(){
    for(auto& row:p)std::fill(std::begin(row),std::end(row),0);
    occupancy[0]=occupancy[1]=0;key=pawnKey=0;
    for(int s=0;s<64;++s)if(int pc=squares[s]){
        p[color(pc)][type(pc)]|=bit(s);occupancy[color(pc)]|=bit(s);key^=T.zobrist[pc][s];
        if(type(pc)==PAWN)pawnKey^=T.zobrist[pc][s];
    }
    key^=T.castles[castle];if(side==BLACK)key^=T.side;if(hashEp())key^=T.ep[file(ep)];
}
bool Board::setFen(const std::string& text,std::string& error){
    Board b;std::istringstream in(text);std::string layout,turn,rights,eps,extra;
    if(!(in>>layout>>turn>>rights>>eps>>b.halfmove>>b.fullmove)||(in>>extra)){error="FEN needs six fields";return false;}
    int r=7,f=0;
    const std::string names=" PNBRQKpnbrqk";
    for(char ch:layout){
        if(ch=='/'){if(f!=8||r==0){error="Invalid FEN rank";return false;}--r;f=0;}
        else if(ch>='1'&&ch<='8')f+=ch-'0';
        else{
            auto pos=names.find(ch);
            if(pos==std::string::npos||!pos||f>=8||r<0){error="Invalid FEN piece";return false;}
            b.squares[r*8+f++]=int(pos);
        }
        if(f>8){error="Too many squares in FEN rank";return false;}
    }
    if(r!=0||f!=8||(turn!="w"&&turn!="b")||b.halfmove<0||b.halfmove>1000000||b.fullmove<1||b.fullmove>1000000000){error="Invalid FEN fields";return false;}
    b.side=turn=="w"?WHITE:BLACK;
    if(rights!="-")for(char ch:rights){
        auto k=std::string("KQkq").find(ch);
        if(k==std::string::npos||(b.castle&(1<<k))){error="Invalid castling rights";return false;}
        b.castle|=1<<k;
    }
    if(eps!="-"){
        if(eps.size()!=2||eps[0]<'a'||eps[0]>'h'||eps[1]!=(b.side==WHITE?'6':'3')){error="Invalid en-passant square";return false;}
        b.ep=(eps[1]-'1')*8+eps[0]-'a';
        int cap=b.ep+(b.side==WHITE?-8:8);
        if(b.squares[b.ep]||b.squares[cap]!=piece(b.side^1,PAWN)){error="Invalid en-passant state";return false;}
    }
    // Validate kings before hashing EP, which needs their squares.
    for(int c=0;c<2;++c){
        int kings=0,pawns=0,total=0;
        for(int s=0;s<64;++s)if(int pc=b.squares[s];pc&&color(pc)==c){
            ++total;kings+=type(pc)==KING;pawns+=type(pc)==PAWN;
            if(type(pc)==PAWN&&(rank(s)==0||rank(s)==7)){error="Pawn on promotion rank";return false;}
        }
        if(kings!=1||pawns>8||total>16){error="Invalid material or king count";return false;}
    }
    b.rebuild();
    if((T.king[b.kingSquare(WHITE)]&b.p[BLACK][KING])||b.attacked(b.kingSquare(b.side^1),b.side)){
        error="Illegal king state";return false;
    }
    for(int c=0;c<2;++c){
        int home=c==WHITE?0:56;
        if((b.castle&(3<<(2*c)))&&b.squares[home+4]!=piece(c,KING)){error="Castling king missing";return false;}
        if((b.castle&(1<<(2*c)))&&b.squares[home+7]!=piece(c,ROOK)){error="Castling rook missing";return false;}
        if((b.castle&(2<<(2*c)))&&b.squares[home]!=piece(c,ROOK)){error="Castling rook missing";return false;}
    }
    b.history.push_back(b.key);b.nn.clear();b.nn.emplace_back();*this=std::move(b);return true;
}
std::string Board::fen()const{
    const char* names=" PNBRQKpnbrqk";std::string out;
    for(int r=7;r>=0;--r){int empty=0;for(int f=0;f<8;++f){int pc=squares[r*8+f];if(!pc){++empty;continue;}if(empty){out+=char('0'+empty);empty=0;}out+=names[pc];}if(empty)out+=char('0'+empty);if(r)out+='/';}
    out+=side==WHITE?" w ":" b ";
    if(!castle)out+='-';else for(int i=0;i<4;++i)if(castle&(1<<i))out+="KQkq"[i];
    out+=' ';out+=ep<0?"-":squareName(ep);out+=' ';out+=std::to_string(halfmove);out+=' ';out+=std::to_string(fullmove);return out;
}
void Board::generate(MoveList& list,bool capturesOnly)const{
    list.size=0;int us=side,them=side^1;U64 all=occupied(),enemy=occupancy[them]&~p[them][KING];
    U64 pawns=p[us][PAWN];int dir=us==WHITE?8:-8;
    while(pawns){
        int s=pop(pawns),rr=us==WHITE?rank(s):7-rank(s),target=s+dir;
        if(target>=0&&target<64&&!squares[target]){
            if(rr==6){for(int pr=1;pr<=4;++pr)list.add(move(s,target,pr));}
            else if(!capturesOnly){list.add(move(s,target));if(rr==1&&!squares[target+dir])list.add(move(s,target+dir));}
        }
        U64 attacks=T.pawn[us][s]&enemy;
        while(attacks){int dst=pop(attacks);if(rr==6){for(int pr=1;pr<=4;++pr)list.add(move(s,dst,pr));}else list.add(move(s,dst));}
        if(ep>=0&&(T.pawn[us][s]&bit(ep))&&squares[ep-dir]==piece(them,PAWN))list.add(move(s,ep));
    }
    for(int pt=KNIGHT;pt<=KING;++pt){
        U64 pieces=p[us][pt];
        while(pieces){int s=pop(pieces);U64 a=0;
            switch(pt){case KNIGHT:a=T.knight[s];break;case BISHOP:a=bishopAttacks(s,all);break;case ROOK:a=rookAttacks(s,all);break;case QUEEN:a=queenAttacks(s,all);break;case KING:a=T.king[s];break;}
            a&=capturesOnly?enemy:~occupancy[us]&~p[them][KING];
            while(a)list.add(move(s,pop(a)));
        }
    }
    if(capturesOnly||inCheck())return;
    int home=us==WHITE?0:56;U64 withoutKing=all&~bit(home+4);
    if((castle&(1<<(us*2)))&&!squares[home+5]&&!squares[home+6]
       &&!attackersTo(home+5,them,withoutKing,p))list.add(move(home+4,home+6));
    if((castle&(2<<(us*2)))&&!squares[home+1]&&!squares[home+2]&&!squares[home+3]
       &&!attackersTo(home+3,them,withoutKing,p))list.add(move(home+4,home+2));
}
bool Board::isCapture(Move m)const{return squares[to(m)]||(type(squares[from(m)])==PAWN&&to(m)==ep&&file(from(m))!=file(to(m)));}
int Board::capturedType(Move m)const{return squares[to(m)]?type(squares[to(m)]):(isCapture(m)?PAWN:0);}
bool Board::make(Move m,Undo& u){
    int src=from(m),dst=to(m),pc=squares[src],us=side;
    assert(pc&&color(pc)==us);
    u={key,pawnKey,castle,ep,halfmove,fullmove,sinceNull,0,dst,pc};
    if(hashEp())key^=T.ep[file(ep)];
    key^=T.castles[castle];
    if(type(pc)==PAWN&&dst==ep&&!squares[dst]&&file(src)!=file(dst))u.capturedSquare=dst+(us==WHITE?-8:8);
    u.captured=squares[u.capturedSquare];
    NNFrame& fr=nn.emplace_back();fr.n=0;fr.computed=false;fr.kingMoved=type(pc)==KING;
    auto delta=[&fr](int p,int s,int sg){fr.pc[fr.n]=std::int8_t(p);fr.sq[fr.n]=std::int8_t(s);fr.sign[fr.n]=std::int8_t(sg);++fr.n;};
    if(u.captured){remove(u.capturedSquare);delta(u.captured,u.capturedSquare,-1);}
    int placed=promotion(m)?piece(us,promotionType(m)):pc;
    remove(src);add(dst,placed);delta(pc,src,-1);delta(placed,dst,1);
    if(type(pc)==KING&&std::abs(dst-src)==2){int rf=dst>src?src+3:src-4,rt=dst>src?src+1:src-1;int rook=squares[rf];remove(rf);add(rt,rook);delta(rook,rf,-1);delta(rook,rt,1);}
    castle&=T.castleMask[src]&T.castleMask[dst];ep=-1;
    if(type(pc)==PAWN&&std::abs(dst-src)==16)ep=(dst+src)/2;
    halfmove=(type(pc)==PAWN||u.captured)?0:halfmove+1;
    fullmove+=us==BLACK;sinceNull++;side^=1;key^=T.side;key^=T.castles[castle];if(hashEp())key^=T.ep[file(ep)];
    history.push_back(key);
    if(attacked(kingSquare(us),side)){unmake(m,u);return false;}
    return true;
}
void Board::unmake(Move m,const Undo& u){
    side^=1;int src=from(m),dst=to(m);remove(dst);add(src,u.mover);
    if(type(u.mover)==KING&&std::abs(dst-src)==2){int rf=dst>src?src+3:src-4,rt=dst>src?src+1:src-1;int rook=squares[rt];remove(rt);add(rf,rook);}
    if(u.captured)add(u.capturedSquare,u.captured);
    castle=u.castle;ep=u.ep;halfmove=u.halfmove;fullmove=u.fullmove;sinceNull=u.sinceNull;key=u.key;pawnKey=u.pawnKey;history.pop_back();nn.pop_back();
}
void Board::makeNull(Undo& u){
    u={key,pawnKey,castle,ep,halfmove,fullmove,sinceNull,0,-1,0};
    if(hashEp())key^=T.ep[file(ep)];
    ep=-1;side^=1;key^=T.side;sinceNull=0;history.push_back(key);
    NNFrame& fr=nn.emplace_back();fr.n=0;fr.computed=false;fr.kingMoved=false;
}
void Board::unmakeNull(const Undo& u){side^=1;ep=u.ep;key=u.key;pawnKey=u.pawnKey;sinceNull=u.sinceNull;history.pop_back();nn.pop_back();}
bool Board::hasLegalMove(){MoveList list;generate(list);for(Move m:list){Undo u;if(make(m,u)){unmake(m,u);return true;}}return false;}
MoveList Board::legalMoves(){MoveList pseudo,result;generate(pseudo);for(Move m:pseudo){Undo u;if(make(m,u)){unmake(m,u);result.add(m);}}return result;}
Move Board::parseMove(const std::string& text){for(Move m:legalMoves())if(moveName(m)==text)return m;return 0;}
bool Board::insufficient()const{
    if(p[0][PAWN]|p[1][PAWN]|p[0][ROOK]|p[1][ROOK]|p[0][QUEEN]|p[1][QUEEN])return false;
    U64 knights=p[0][KNIGHT]|p[1][KNIGHT],bishops=p[0][BISHOP]|p[1][BISHOP];
    if(count(knights|bishops)<=1)return true;
    return !knights&&(!(bishops&T.squareColor[0])||!(bishops&T.squareColor[1]));
}
bool Board::repetition(std::size_t rootHistory)const{
    int seen=0,last=int(history.size())-1,limit=last-std::min(halfmove,sinceNull);
    for(int i=last-2;i>=std::max(0,limit);i-=2)if(history[i]==key){
        if(++seen>=2||std::size_t(i)+1>=rootHistory)return true;
    }
    return false;
}
int Board::see(Move m)const{
    int src=from(m),dst=to(m),us=side,mover=type(squares[src]),victim=capturedType(m);
    U64 local[2][7];for(int c=0;c<2;++c)std::copy_n(p[c],7,local[c]);
    U64 occ=occupied();int gains[32]{},depth=0;
    gains[0]=seeValue[victim]+(promotion(m)?seeValue[promotionType(m)]-seeValue[PAWN]:0);
    local[us][mover]&=~bit(src);occ&=~bit(src);
    int capSquare=dst;
    if(mover==PAWN&&dst==ep&&!squares[dst])capSquare=dst+(us==WHITE?-8:8);
    if(victim){local[us^1][victim]&=~bit(capSquare);occ&=~bit(capSquare);}
    int occupant=promotion(m)?promotionType(m):mover,occupantSide=us;
    local[us][occupant]|=bit(dst);occ|=bit(dst);
    // Castling is never an exchange; avoid pretending the rook remains unmoved.
    if(mover==KING&&std::abs(dst-src)==2)return 0;
    int next=us^1;
    while(depth<30&&occupant!=KING){
        U64 attackers=attackersTo(dst,next,occ,local);bool found=false;
        for(int pt=PAWN;pt<=KING&&!found;++pt){
            U64 options=attackers&local[next][pt];
            while(options){
                int s=pop(options),prom=(pt==PAWN&&(rank(dst)==0||rank(dst)==7))?QUEEN:pt;
                U64 oldOcc=occ;
                local[next][pt]&=~bit(s);local[occupantSide][occupant]&=~bit(dst);local[next][prom]|=bit(dst);occ&=~bit(s);
                if(!attackersTo(first(local[next][KING]),next^1,occ,local)){
                    ++depth;gains[depth]=seeValue[occupant]+(prom!=pt?seeValue[prom]-seeValue[pt]:0)-gains[depth-1];
                    occupant=prom;occupantSide=next;next^=1;found=true;break;
                }
                local[next][prom]&=~bit(dst);local[occupantSide][occupant]|=bit(dst);local[next][pt]|=bit(s);occ=oldOcc;
            }
        }
        if(!found)break;
    }
    while(depth>0){gains[depth-1]=-std::max(-gains[depth-1],gains[depth]);--depth;}
    return gains[0];
}
bool Board::verify()const{
    Board copy=*this;copy.rebuild();bool piecesEqual=true;
    for(int c=0;c<2;++c)piecesEqual&=std::equal(p[c],p[c]+7,copy.p[c]);
    return copy.key==key&&copy.pawnKey==pawnKey&&copy.squares==squares&&piecesEqual&&copy.occupancy[0]==occupancy[0]&&copy.occupancy[1]==occupancy[1];
}
U64 perft(Board& b,int depth){if(depth==0)return 1;U64 n=0;MoveList list;b.generate(list);for(Move m:list){Undo u;if(b.make(m,u)){n+=perft(b,depth-1);b.unmake(m,u);}}return n;}
bool selfcheck(std::string& error){
    struct Case{const char* fen;int depth;U64 expected;};
    const Case cases[]={{START_FEN,4,197281},{"r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1",3,97862},
      {"8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1",4,43238},
      {"r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1",3,9467},
      {"rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8",3,62379}};
    for(auto& c:cases){Board b;if(!b.setFen(c.fen,error))return false;auto before=b.fen();U64 h=b.key;
        U64 got=perft(b,c.depth);if(got!=c.expected){error="perft mismatch: "+std::to_string(got)+" expected "+std::to_string(c.expected);return false;}
        if(!b.verify()||b.fen()!=before||b.key!=h){error="make/unmake corruption";return false;}
        for(Move m:b.legalMoves()){Undo u;b.make(m,u);if(!b.verify()){error="incremental hash mismatch";return false;}b.unmake(m,u);}
    }
    return true;
}
}
