#include "search.hpp"
#include "kpk.hpp"
#include <algorithm>
#include <cmath>
#include <cstring>
#include <limits>

namespace forge {
std::array<std::array<std::uint8_t,257>,MAX_PLY+1> reductionTable{};
int T_RFP=58,T_RFPI=28,T_RAZOR=167,T_NMPB=2,T_NMPD=3,T_NMPE=199,T_LMPB=4,T_FUTM=88,T_FUTB=64,T_HISTP=1563,T_SEEC=79,T_SING=4,T_ASP=25,T_LMRD=191,T_TMMOVES=23,T_TMINC=79,T_NEXTITER=65,T_PCM=205;
std::vector<Tunable>& tunables(){
    static std::vector<Tunable> list={{"RFPMargin",&T_RFP,30,150},{"RFPImproving",&T_RFPI,0,80},{"RazorMargin",&T_RAZOR,80,400},
        {"NMPBase",&T_NMPB,1,4},{"NMPDepthDiv",&T_NMPD,2,8},{"NMPEvalDiv",&T_NMPE,80,400},{"LMPBase",&T_LMPB,1,8},
        {"FutilityMul",&T_FUTM,40,180},{"FutilityBase",&T_FUTB,0,150},{"HistPrune",&T_HISTP,500,4000},{"SEECapture",&T_SEEC,30,160},
        {"SingularMul",&T_SING,1,8},{"AspWindow",&T_ASP,8,60},{"LMRDiv",&T_LMRD,150,320},{"TMMoves",&T_TMMOVES,12,50},
        {"TMIncPct",&T_TMINC,30,100},{"TMNextIter",&T_NEXTITER,40,100},{"ProbCutMargin",&T_PCM,80,400}};
    return list;
}
// LMR table: 1 + ln(depth) * ln(move number) / (LMRDiv / 100).
void rebuildReductions(){
    for(int depth=1;depth<=MAX_PLY;++depth)
        for(int ordinal=1;ordinal<=256;++ordinal)
            reductionTable[depth][ordinal]=std::uint8_t(1+int(std::log(double(depth))*std::log(double(ordinal))/(T_LMRD/100.0)));
}
static const bool reductionsReady=(rebuildReductions(),true);
long long nowNs(){return std::chrono::duration_cast<std::chrono::nanoseconds>(std::chrono::steady_clock::now().time_since_epoch()).count();}
namespace {
constexpr int NO_EVAL=32767;
// The existing LMR formula, prepared once instead of evaluating logarithms at
// every late quiet move. Tables cover the entire search and move-list bounds.

int encodeMate(int score,int ply){return score>=MATE_BOUND?score+ply:score<=-MATE_BOUND?score-ply:score;}
int decodeMate(int score,int ply){return score>=MATE_BOUND?score-ply:score<=-MATE_BOUND?score+ply:score;}
U64 pack(Move m,int score,int eval,int depth,int bound,int age){
    // 255 tags quiescence with a remaining quiet-check budget. It is not a
    // full-search depth, so ordinary depth-one searches cannot reuse it.
    int encodedDepth=depth<0?255:std::clamp(depth,0,254);
    return U64(m)|(U64(std::uint16_t(std::int16_t(score)))<<16)
      |(U64(std::uint16_t(std::int16_t(eval)))<<32)|(U64(encodedDepth)<<48)
      |(U64(bound)<<56)|(U64(age&31)<<58)|(U64(1)<<63);
}
TTData unpack(U64 v,int ply){
    TTData d;d.found=(v>>63)!=0;d.best=Move(v&0xffff);d.score=decodeMate(std::int16_t((v>>16)&0xffff),ply);
    d.eval=std::int16_t((v>>32)&0xffff);int depth=int((v>>48)&255);d.qchecks=depth==255;d.depth=d.qchecks?0:depth;
    d.bound=int((v>>56)&3);d.age=int((v>>58)&31);return d;
}
void adjust(std::int16_t& h,int bonus){bonus=std::clamp(bonus,-4000,4000);int value=h;value+=bonus-value*std::abs(bonus)/16384;h=std::int16_t(std::clamp(value,-16384,16384));}
U64 discoveredCheckSources(const Board& b){
    U64 occupied=b.occupied(),sources=0;int king=b.kingSquare(b.side^1);
    for(int direction=0;direction<8;++direction){
        U64 blockers=T.rays[direction][king]&occupied;if(!blockers)continue;
        int source=(direction&1)?63-std::countl_zero(blockers):first(blockers);
        if(!(b.occupancy[b.side]&bit(source)))continue;
        U64 beyond=T.rays[direction][source]&occupied;if(!beyond)continue;
        int checker=(direction&1)?63-std::countl_zero(beyond):first(beyond);
        U64 sliders=b.p[b.side][QUEEN]|b.p[b.side][direction<4?ROOK:BISHOP];
        if(sliders&bit(checker))sources|=bit(source);
    }
    return sources;
}
}
void TranspositionTable::resize(int mb){
    std::size_t requested=std::size_t(std::max(1,mb))*1024*1024/sizeof(Bucket),n=1;
    while(n<=requested/2)n*=2;
    auto replacement=std::make_unique<Bucket[]>(n);table=std::move(replacement);buckets=n;generation=0;
}
void TranspositionTable::clear(){for(std::size_t i=0;i<buckets;++i)for(auto& e:table[i].entry){e.checksum.store(0,std::memory_order_relaxed);e.data.store(0,std::memory_order_relaxed);}generation=0;}
TTData TranspositionTable::probe(U64 key,int ply)const{
    for(auto& e:table[key&(buckets-1)].entry){
        U64 checksum=e.checksum.load(std::memory_order_acquire),data=e.data.load(std::memory_order_relaxed);
        if((data>>63)&&checksum==(key^data)&&checksum==e.checksum.load(std::memory_order_acquire))return unpack(data,ply);
    }
    return {};
}
void TranspositionTable::store(U64 key,int ply,int depth,int score,int eval,int bound,Move best){
    auto& bucket=table[key&(buckets-1)];Entry* selected=nullptr;int quality=std::numeric_limits<int>::max();
    for(auto& e:bucket.entry){
        U64 c=e.checksum.load(std::memory_order_acquire),v=e.data.load(std::memory_order_relaxed);
        if(!(v>>63)){selected=&e;break;}
        auto old=unpack(v,ply);
        if(c==(key^v)){
            if(!best)best=old.best;
            if(depth<old.depth-3&&bound!=EXACT&&old.age==generation)return;
            selected=&e;break;
        }
        int q=old.depth-6*((generation-old.age)&31)+(old.bound==EXACT?4:0);
        if(q<quality){quality=q;selected=&e;}
    }
    U64 data=pack(best,encodeMate(score,ply),eval,depth,bound,generation);
    selected->data.store(data,std::memory_order_relaxed);selected->checksum.store(key^data,std::memory_order_release);
}
void TranspositionTable::prefetch(U64 key)const{
#if defined(__GNUC__) || defined(__clang__)
    __builtin_prefetch(&table[key&(buckets-1)],0,1);
#else
    (void)key;
#endif
}
int TranspositionTable::hashfull()const{
    int n=0,total=0;
    for(std::size_t i=0;i<std::min<std::size_t>(250,buckets);++i)for(auto& e:table[i].entry){U64 v=e.data.load(std::memory_order_relaxed);++total;if((v>>63)&&int((v>>58)&31)==generation)++n;}
    return total?n*1000/total:0;
}
void Searcher::clear(){
    history={};captureHistory={};counters={};killers={};corrHist={};contCorr={};
    std::fill(continuation.begin(),continuation.end(),0);evaluator.clear();searches=0;nullVerificationPly=-1;
}
bool Searcher::visit(){
    if(control->stop.load(std::memory_order_relaxed))return false;
    ++myNodes;
    U64 n=control->nodes.fetch_add(1,std::memory_order_relaxed)+1;
    if(control->nodeLimit&&n>=control->nodeLimit){control->stop.store(true,std::memory_order_relaxed);return false;}
    if((n&511)==0||n==1){
        auto deadline=control->hardDeadline.load(std::memory_order_relaxed);
        if(deadline&&nowNs()>=deadline){control->stop.store(true,std::memory_order_relaxed);return false;}
    }
    return true;
}
bool Searcher::draw(Board& b,int ply,bool checked){
    if(b.insufficient()||b.repetition(rootHistory))return true;
    if(b.halfmove>=100){
        if(checked&&!b.hasLegalMove())return false; // Checkmate takes precedence.
        return true;
    }
    (void)ply;return false;
}
int Searcher::continuationScore(int ply,int pc,int dst)const{
    int result=0;
    for(int back:{1,2})if(ply>=back&&stack[ply-back].current&&stack[ply-back].pc){
        const auto& prev=stack[ply-back];
        std::size_t index=(std::size_t(prev.pc)*64+to(prev.current))*(13*64)+pc*64+dst;
        result+=continuation[index]/back;
    }
    return result;
}
void Searcher::rewardQuiet(int side,Move m,int pc,int ply,int bonus){
    adjust(history[side][from(m)][to(m)],bonus);
    for(int back:{1,2})if(ply>=back&&stack[ply-back].current&&stack[ply-back].pc){
        const auto& prev=stack[ply-back];
        auto index=(std::size_t(prev.pc)*64+to(prev.current))*(13*64)+pc*64+to(m);
        adjust(continuation[index],bonus/back);
    }
}
// Stage 0 ranks only winning/equal tactical moves and parks losing ones in
// `bad`; stage 1 ranks quiets plus the parked moves. Score classes do not
// overlap (good tactics > 900000 > quiets > -170000 > bad tactics), so the
// resulting order is identical to ranking everything at once.
int Searcher::rankMoves(Board& b,MoveList& list,std::array<Ranked,256>& ranked,Move ttMove,int ply,int stage,std::array<Ranked,256>& bad,int& nbad){
    int enemyKing=b.kingSquare(b.side^1);U64 occupied=b.occupied(),bishopChecks=0,rookChecks=0;
    int size=0;
    for(int i=0;i<list.size;++i){
        Move m=list.moves[i];if(m==ttMove)continue;
        int pc=b.squares[from(m)],pt=type(pc),score=0;
        bool capture=b.isCapture(m),tactical=capture||promotion(m);
        if(tactical!=(stage==0))continue;
        int see=tactical?b.see(m):0;
        if(tactical){
            score=(see>=0?1000000:-200000)+16*MG_VALUE[b.capturedType(m)]-MG_VALUE[pt]
                 +captureHistory[pc][to(m)][b.capturedType(m)]+(promotion(m)?MG_VALUE[promotionType(m)]:0);
            if(see<0){bad[nbad++]={m,score,see,capture};continue;}
        }else if(m==killers[ply][0])score=90000;
        else if(m==killers[ply][1])score=80000;
        else{
            score=history[b.side][from(m)][to(m)]+continuationScore(ply,pc,to(m));
            if(ply&&stack[ply-1].current&&m==counters[stack[ply-1].pc][to(stack[ply-1].current)])score+=70000;
            score+=pieceSquare(pt,b.side,to(m))-pieceSquare(pt,b.side,from(m));
            // A cheap direct-check ordering bonus; discovered checks are found by search.
            U64 targets=0;
            if(pt==KNIGHT)targets=T.knight[enemyKing];
            else if(pt==PAWN)targets=T.pawn[b.side^1][enemyKing];
            else if(pt>=BISHOP&&pt<=QUEEN){
                // The previous mover's king cannot currently be in check.
                // Thus a sliding mover cannot uncover its own attack ray to
                // that king: masks from the king can be shared by all moves.
                if(pt!=ROOK){if(!bishopChecks)bishopChecks=bishopAttacks(enemyKing,occupied);targets|=bishopChecks;}
                if(pt!=BISHOP){if(!rookChecks)rookChecks=rookAttacks(enemyKing,occupied);targets|=rookChecks;}
            }
            if(targets&bit(to(m)))score+=10000;
            if(ply==0&&id)score+=int((U64(m)*0x9e3779b97f4a7c15ULL+id*131)&31);
        }
        ranked[size++]={m,score,see,capture};
    }
    if(stage==1)for(int i=0;i<nbad;++i)ranked[size++]=bad[i];
    std::make_heap(ranked.begin(),ranked.begin()+size);
    return size;
}
// Membership in the generated list is required before a hash move can be
// tried. A stale/colliding TT move must never bypass move generation.
// Rank the remaining moves only if search actually needs another alternative.
// Their history scores include feedback learned while searching the hash move.
class Searcher::MovePicker {
    Searcher& searcher;
    Board& board;
    MoveList& moves;
    // Only the prepared prefix is initialized. A hash cutoff need not clear
    // or score a full 256-entry scratch array at every visited node.
    std::array<Ranked,256> ranked,bad;
    Move hashMove=0;
    int ply=0,remaining=0,stage=0,nbad=0;
    bool hashPending=false;
public:
    MovePicker(Searcher& owner,Board& position,MoveList& generated,Move preferred,int height)
        :searcher(owner),board(position),moves(generated),ply(height){
        for(Move m:moves)if(m==preferred){hashMove=m;hashPending=true;break;}
    }
    Ranked next(){
        if(hashPending){
            hashPending=false;
            bool capture=board.isCapture(hashMove);
            int see=capture||promotion(hashMove)?board.see(hashMove):0;
            return {hashMove,4000000,see,capture};
        }
        while(!remaining){
            if(stage>=2)return {};
            remaining=searcher.rankMoves(board,moves,ranked,hashMove,ply,stage,bad,nbad);++stage;
        }
        std::pop_heap(ranked.begin(),ranked.begin()+remaining);
        return ranked[--remaining];
    }
};
void Searcher::updatePv(int ply,Move m){
    pv[ply][0]=m;int child=ply+1<MAX_PLY?pvLength[ply+1]:0;
    child=std::min(child,MAX_PLY-ply-1);
    for(int i=0;i<child;++i)pv[ply][i+1]=pv[ply+1][i];
    pvLength[ply]=child+1;
}
// Pawn-structure correction history: learns the average error of the static eval per pawn structure.
constexpr int CORR_GRAIN=256,CORR_WSCALE=1024,CORR_MAX=CORR_GRAIN*48;
int Searcher::corrected(const Board& b,int raw)const{
    int v=raw+corrHist[b.side][b.pawnKey&16383]/CORR_GRAIN;
    if(curPly>0&&stack[curPly-1].current)v+=contCorr[b.side][stack[curPly-1].pc][to(stack[curPly-1].current)]/(2*CORR_GRAIN);
    return std::clamp(v,-MATE_BOUND+1,MATE_BOUND-1);
}
void Searcher::updateCorrection(const Board& b,int depth,int diff){
    int& e=corrHist[b.side][b.pawnKey&16383];int w=std::min(depth*depth+2*depth+1,128);
    e=std::clamp((e*(CORR_WSCALE-w)+diff*CORR_GRAIN*w)/CORR_WSCALE,-CORR_MAX,CORR_MAX);
    if(curPly>0&&stack[curPly-1].current){int& c=contCorr[b.side][stack[curPly-1].pc][to(stack[curPly-1].current)];
        c=std::clamp((c*(CORR_WSCALE-w)+diff*CORR_GRAIN*w)/CORR_WSCALE,-CORR_MAX,CORR_MAX);}
}
int Searcher::qsearch(Board& b,int alpha,int beta,int ply,int quietChecks){
    pvLength[ply]=0;selectiveDepth=std::max(selectiveDepth,ply);
    if(!visit())return 0;
    bool checked=b.inCheck();
    if(draw(b,ply,checked))return 0;
    if(ply>=MAX_PLY-2){if(!b.hasLegalMove())return checked?-MATE+ply:0;return evaluator.evaluate(b);}
    auto hit=tt.probe(b.key,ply);bool pvNode=beta-alpha>1;
    bool compatible=hit.depth>0||hit.qchecks==(quietChecks>0);
    if(compatible&&!pvNode&&b.halfmove<90&&hit.found&&(hit.bound==EXACT||(hit.bound==LOWER&&hit.score>=beta)||(hit.bound==UPPER&&hit.score<=alpha)))return hit.score;
    int qdepth=quietChecks?-1:0;
    int originalAlpha=alpha,rawEval=checked?NO_EVAL:(hit.found&&hit.eval!=NO_EVAL?hit.eval:evaluator.evaluate(b));
    curPly=ply;int staticEval=checked?NO_EVAL:corrected(b,rawEval);
    int best=checked?-INF:staticEval;Move bestMove=0;
    if(!checked){
        if(best>=beta){tt.store(b.key,ply,qdepth,best,rawEval,LOWER,0);return best;}
        alpha=std::max(alpha,best);
    }
    stack[ply].inCheck=checked;stack[ply].staticEval=staticEval;
    MoveList moves;b.generate(moves,!checked&&!quietChecks);
    if(!checked&&quietChecks){
        int king=b.kingSquare(b.side^1);U64 occupied=b.occupied();
        U64 diagonal=bishopAttacks(king,occupied),straight=rookAttacks(king,occupied);
        std::array<U64,7> targets{};targets[PAWN]=T.pawn[b.side^1][king];targets[KNIGHT]=T.knight[king];
        targets[BISHOP]=diagonal;targets[ROOK]=straight;targets[QUEEN]=diagonal|straight;targets[KING]=T.king[king];
        U64 discovered=discoveredCheckSources(b);int kept=0;
        // Legal positions cannot already check the previous mover's king.
        // Direct target rays therefore remain valid when the mover leaves its
        // source. Discovered sources and castling are conservatively included;
        // make/inCheck below still decide legality and actual check delivery.
        for(Move m:moves){
            int pt=type(b.squares[from(m)]);
            if(b.isCapture(m)||promotion(m)||(targets[pt]&bit(to(m)))
               ||(discovered&bit(from(m)))||(pt==KING&&std::abs(to(m)-from(m))==2))moves.moves[kept++]=m;
        }
        moves.size=kept;
    }
    MovePicker picker(*this,b,moves,hit.best,ply);
    int legal=0;
    for(;;){
        auto item=picker.next();if(!item.m)break;
        Move m=item.m;int pc=b.squares[from(m)],victim=b.capturedType(m);
        bool tactical=item.capture||promotion(m);
        Undo undo;if(!b.make(m,undo))continue;++legal;
        bool givesCheck=b.inCheck();
        if(!checked&&!tactical){
            if(!quietChecks||!givesCheck){b.unmake(m,undo);continue;}
            // Bound the extra tactical work to nonlosing quiet checks. SEE
            // needs the original position; restore it before consulting SEE.
            b.unmake(m,undo);
            if(b.see(m)<0)continue;
            if(!b.make(m,undo))continue;
        }
        if(!checked&&!givesCheck&&!promotion(m)){
            if(item.see < -75){b.unmake(m,undo);continue;}
            if(staticEval+MG_VALUE[victim]+150<alpha){b.unmake(m,undo);continue;}
        }
        stack[ply].current=m;stack[ply].pc=pc;tt.prefetch(b.key);
        int nextChecks=quietChecks-(!tactical&&givesCheck&&quietChecks>0?1:0);
        int score=-qsearch(b,-beta,-alpha,ply+1,nextChecks);b.unmake(m,undo);
        if(control->stop.load(std::memory_order_relaxed))return 0;
        if(score>best){best=score;bestMove=m;if(score>alpha){alpha=score;updatePv(ply,m);if(score>=beta)break;}}
    }
    if(checked&&!legal)return -MATE+ply;
    tt.store(b.key,ply,qdepth,best,rawEval,best>=beta?LOWER:best>originalAlpha?EXACT:UPPER,bestMove);
    return best;
}
int Searcher::search(Board& b,int depth,int alpha,int beta,int ply,bool pvNode,bool allowNull){
    if(depth<=0)return qsearch(b,alpha,beta,ply,0);
    pvLength[ply]=0;selectiveDepth=std::max(selectiveDepth,ply);
    if(!visit())return 0;
    bool checked=b.inCheck();
    if(ply&&draw(b,ply,checked))return 0;
    if(ply>=MAX_PLY-2){if(!b.hasLegalMove())return checked?-MATE+ply:0;return evaluator.evaluate(b);}
    if(ply){alpha=std::max(alpha,-MATE+ply);beta=std::min(beta,MATE-ply-1);if(alpha>=beta)return alpha;}
    Move excludedMove=excluded[ply];
    auto hit=tt.probe(b.key,ply);
    if(!excludedMove&&ply!=nullVerificationPly&&ply&&!pvNode&&b.halfmove<90&&hit.found&&hit.depth>=depth
       &&(hit.bound==EXACT||(hit.bound==LOWER&&hit.score>=beta)||(hit.bound==UPPER&&hit.score<=alpha)))return hit.score;
    if(checked&&depth>=2&&ply<rootDepth*2)++depth;
    depth=std::min(depth,MAX_PLY-ply-2);
    int rawEval=checked?NO_EVAL:(hit.found&&hit.eval!=NO_EVAL?hit.eval:evaluator.evaluate(b));
    curPly=ply;int staticEval=checked?NO_EVAL:corrected(b,rawEval);
    stack[ply].inCheck=checked;stack[ply].staticEval=staticEval;stack[ply+2].cutoffs=0;
    // improving: compare with 2 plies ago, or 4 plies ago when that position was in check (no static eval).
    int prevEval=ply>=2?stack[ply-2].staticEval:NO_EVAL;if(prevEval==NO_EVAL&&ply>=4)prevEval=stack[ply-4].staticEval;
    bool improving=!checked&&prevEval!=NO_EVAL&&staticEval>prevEval;
    // Verification must examine real moves instead of returning the same
    // static-evaluation or null-move shortcut it is intended to challenge.
    int eval=staticEval;
    if(!checked&&hit.found&&std::abs(hit.score)<MATE_BOUND&&(hit.bound==EXACT||(hit.bound==LOWER&&hit.score>eval)||(hit.bound==UPPER&&hit.score<eval)))eval=hit.score;
    if(ply&&!pvNode&&!checked&&!excludedMove&&nullVerificationPly<0&&std::abs(beta)<MATE_BOUND){
        if(depth<=6&&eval-(T_RFP*depth+(improving?0:T_RFPI))>=beta)return (eval+beta)/2;
        if(depth<=2&&eval+T_RAZOR*depth<alpha){int value=qsearch(b,alpha,beta,ply,0);if(value<=alpha)return value;}
        U64 ownNonPawns=b.p[b.side][KNIGHT]|b.p[b.side][BISHOP]|b.p[b.side][ROOK]|b.p[b.side][QUEEN];
        if(allowNull&&depth>=3&&eval>=beta&&ownNonPawns&&b.halfmove<80){
            Undo undo;b.makeNull(undo);stack[ply].current=0;stack[ply].pc=0;
            int reduction=T_NMPB+depth/T_NMPD+std::min(3,std::max(0,(eval-beta)/T_NMPE));
            int value=-search(b,depth-1-reduction,-beta,-beta+1,ply+1,false,false);b.unmakeNull(undo);
            if(control->stop.load(std::memory_order_relaxed))return 0;
            if(value>=beta){
                U64 enemyNonPawns=b.p[b.side^1][KNIGHT]|b.p[b.side^1][BISHOP]|b.p[b.side^1][ROOK]|b.p[b.side^1][QUEEN];
                bool sparse=count(ownNonPawns)<=1||count(ownNonPawns|enemyNonPawns)<=4;
                if(depth<10&&!sparse)return std::min(value,MATE_BOUND-1);
                // A pass is not legal chess. Challenge fragile/deep fail-highs
                // with a reduced-depth legal search and no speculative static
                // or null pruning anywhere in that verification subtree.
                Context saved=stack[ply];nullVerificationPly=ply;
                int verified=search(b,std::max(1,depth-reduction),beta-1,beta,ply,false,false);
                nullVerificationPly=-1;stack[ply]=saved;pvLength[ply]=0;
                if(control->stop.load(std::memory_order_relaxed))return 0;
                if(verified>=beta)return std::min(verified,MATE_BOUND-1);
            }
        }
        // ProbCut: a capture that beats beta by a clear margin at reduced depth
        // is assumed to fail high at full depth too.
        int pcBeta=beta+T_PCM;
        if(depth>=5&&std::abs(beta)<MATE_BOUND-256&&!(hit.found&&hit.depth>=depth-3&&hit.score<pcBeta)){
            MoveList caps;b.generate(caps,true);
            for(Move m:caps){
                if(!b.isCapture(m)&&!promotion(m))continue;
                if(b.see(m)<pcBeta-staticEval)continue;
                int pc=b.squares[from(m)];Undo undo;if(!b.make(m,undo))continue;
                stack[ply].current=m;stack[ply].pc=pc;
                int value=-qsearch(b,-pcBeta,-pcBeta+1,ply+1,0);
                if(value>=pcBeta)value=-search(b,depth-4,-pcBeta,-pcBeta+1,ply+1,false,true);
                b.unmake(m,undo);
                if(control->stop.load(std::memory_order_relaxed))return 0;
                if(value>=pcBeta){tt.store(b.key,ply,depth-3,value,rawEval,LOWER,m);return value;}
            }
        }
        if(depth>=5&&!hit.best)--depth;
    }
    if(depth>=4&&!hit.best&&!excludedMove)--depth;  // internal iterative reduction: no hash move, search shallower first
    int originalAlpha=alpha,best=-INF,legal=0,quietCount=0,us=b.side;
    Move bestMove=0;std::array<Move,256> quiets{},captures{};int nq=0,nc=0;
    MoveList moves;b.generate(moves);MovePicker picker(*this,b,moves,hit.best,ply);
    bool ttCapture=hit.best&&b.capturedType(hit.best);
    for(;;){
        auto item=picker.next();if(!item.m)break;Move m=item.m;
        if(!ply&&std::find(allowed.begin(),allowed.end(),m)==allowed.end())continue;
        if(m==excludedMove)continue;
        int extension=0;
        if(ply&&m==hit.best&&!excludedMove&&depth>=8&&hit.depth>=depth-3&&(hit.bound&LOWER)
           &&std::abs(hit.score)<MATE_BOUND&&ply<rootDepth*2&&nullVerificationPly<0){
            int singularBeta=hit.score-T_SING*depth;
            Context saved=stack[ply];excluded[ply]=m;
            int value=search(b,(depth-1)/2,singularBeta-1,singularBeta,ply,false,false);
            excluded[ply]=0;stack[ply]=saved;pvLength[ply]=0;
            if(control->stop.load(std::memory_order_relaxed))return 0;
            if(value<singularBeta)extension=1;
            else if(singularBeta>=beta)return singularBeta;
            else if(hit.score>=beta)extension=-1;  // negative extension: the TT move is probably not singular and we are already failing high
        }
        int pc=b.squares[from(m)],captured=b.capturedType(m),hist=history[us][from(m)][to(m)]+continuationScore(ply,pc,to(m));
        bool quiet=!item.capture&&!promotion(m),advancedPawn=type(pc)==PAWN&&(us==WHITE?rank(to(m))>=5:rank(to(m))<=2);
        U64 rootN0=myNodes;
        Undo undo;if(!b.make(m,undo))continue;++legal;if(quiet)++quietCount;
        bool givesCheck=b.inCheck();
        if(ply&&legal>1&&!pvNode&&!checked&&!givesCheck&&!advancedPawn&&nullVerificationPly<0&&std::abs(alpha)<MATE_BOUND){
            if(quiet&&((depth<=5&&quietCount>T_LMPB+depth*depth+(improving?2:0))||(depth<=6&&hist<4000&&staticEval+T_FUTM*depth+T_FUTB<=alpha)||(depth<=3&&hist< -T_HISTP*depth))){b.unmake(m,undo);continue;}
            if(item.capture&&depth<=4&&item.see < -T_SEEC*depth*depth){b.unmake(m,undo);continue;}
        }
        stack[ply].current=m;stack[ply].pc=pc;tt.prefetch(b.key);
        int newDepth=depth-1+extension,reduction=0,score;
        if(depth>=3&&legal>2+pvNode&&quiet&&!checked&&!givesCheck&&!advancedPawn){
            reduction=reductionTable[depth][legal];
            reduction-=pvNode;reduction-=improving;reduction-=hist/6000;reduction+=ttCapture;
            reduction-=m==killers[ply][0]||m==killers[ply][1];reduction+=stack[ply+1].cutoffs>3;reduction=std::clamp(reduction,0,std::max(0,newDepth-1));
        }else if(depth>=3&&legal>2+pvNode&&item.capture&&item.see<0&&!checked&&!givesCheck&&!pvNode){
            reduction=std::clamp(reductionTable[depth][legal]/2,1,std::max(0,newDepth-1));
        }
        if(legal==1)score=-search(b,newDepth,-beta,-alpha,ply+1,pvNode,true);
        else{
            score=-search(b,newDepth-reduction,-alpha-1,-alpha,ply+1,false,true);
            if(score>alpha&&reduction){newDepth+=score>best+60+2*newDepth;score=-search(b,newDepth,-alpha-1,-alpha,ply+1,false,true);}
            if(pvNode&&score>alpha&&score<beta)score=-search(b,newDepth,-beta,-alpha,ply+1,true,true);
        }
        b.unmake(m,undo);
        if(!ply)rootNodes[(from(m)<<6)|to(m)]+=myNodes-rootN0;
        if(control->stop.load(std::memory_order_relaxed))return 0;
        if(score>best){best=score;bestMove=m;}
        if(score>alpha){alpha=score;updatePv(ply,m);}
        if(score>=beta){
            ++stack[ply].cutoffs;
            int bonus=std::min(1800,depth*depth*28+depth*20);
            if(quiet){
                if(killers[ply][0]!=m){killers[ply][1]=killers[ply][0];killers[ply][0]=m;}
                rewardQuiet(us,m,pc,ply,bonus);
                for(int q=0;q<nq;++q)rewardQuiet(us,quiets[q],b.squares[from(quiets[q])],ply,-bonus/2);
                if(ply&&stack[ply-1].current)counters[stack[ply-1].pc][to(stack[ply-1].current)]=m;
            }else{
                adjust(captureHistory[pc][to(m)][captured],bonus);
                for(int c=0;c<nc;++c){Move earlier=captures[c];adjust(captureHistory[b.squares[from(earlier)]][to(earlier)][b.capturedType(earlier)],-bonus/2);}
            }
            break;
        }
        if(quiet)quiets[nq++]=m;else captures[nc++]=m;
    }
    if(!legal)return excludedMove?alpha:checked?-MATE+ply:0;
    // A bound over a user-restricted root subset is not a full-position bound.
    if(!checked&&!excludedMove&&std::abs(best)<MATE_BOUND&&(!bestMove||!b.capturedType(bestMove))
       &&!(best>=beta&&best<=staticEval)&&!(best<=originalAlpha&&best>=staticEval)){curPly=ply;updateCorrection(b,depth,best-staticEval);}
    if(!excludedMove&&(ply||!rootRestricted))tt.store(b.key,ply,depth,best,rawEval,best>=beta?LOWER:best>originalAlpha?EXACT:UPPER,bestMove);
    return best;
}
Result Searcher::run(Board board,const Limits& limits,Control& shared,const Reporter& report){
    myNodes=0;rootNodes={};
    control=&shared;rootHistory=board.history.size();rootRestricted=limits.restricted;nullVerificationPly=-1;stack={};killers={};pvLength={};selectiveDepth=0;
    if((++searches&7)==0){
        for(auto& side:history)for(auto& row:side)for(auto& v:row)v/=2;
        for(auto& pc:captureHistory)for(auto& row:pc)for(auto& v:row)v/=2;
        for(auto& v:continuation)v/=2;
    }
    allowed=limits.searchMoves;
    Result result;
    if(allowed.empty())return result;
    result.best=allowed[0];result.pv={result.best};
    if(draw(board,0,board.inCheck())){result.score=0;result.depth=1;if(!id)report(result,shared);return result;}
    Move exactMove=0;int exactScore=0;
    if(kpk::rootMove(board,allowed,exactMove,exactScore)){
        result.best=exactMove;result.score=exactScore;result.depth=1;result.seldepth=1;result.pv={exactMove};
        shared.nodes.fetch_add(1,std::memory_order_relaxed);if(!id)report(result,shared);return result;
    }
    int previous=0,stable=0;
    for(int iteration=1;iteration<=limits.depth&&!shared.stop.load(std::memory_order_relaxed);++iteration){
        int depth=std::min(limits.depth,iteration+(id?1:0));rootDepth=depth;
        int window=iteration>=5?T_ASP:INF,alpha=iteration>=5?std::max(-INF,previous-window):-INF,beta=iteration>=5?std::min(INF,previous+window):INF;
        int score=0;
        while(!shared.stop.load(std::memory_order_relaxed)){
            score=search(board,depth,alpha,beta,0,true,true);
            if(shared.stop.load(std::memory_order_relaxed))break;
            if(score>alpha&&score<beta)break;
            window=std::min(INF,window*2);
            if(score<=alpha)alpha=std::max(-INF,score-window);
            if(score>=beta)beta=std::min(INF,score+window);
            if(window>=2000){alpha=-INF;beta=INF;}
        }
        if(shared.stop.load(std::memory_order_relaxed))break;
        Move best=pvLength[0]?pv[0][0]:result.best;
        stable=best==result.best?stable+1:0;
        result.best=best;result.score=score;result.depth=depth;result.seldepth=selectiveDepth;
        result.pv.assign(pv[0].begin(),pv[0].begin()+pvLength[0]);if(result.pv.empty())result.pv={best};
        int drop=iteration>1?previous-score:0;
        previous=score;
        if(!id){
            report(result,shared);
            auto soft=shared.softDeadline.load(std::memory_order_relaxed);
            if(soft){
                long long budget=shared.softMs*1000000;
                double factor=stable>=3?0.85:stable==0?1.35:1.0;
                if(drop>=30)factor*=drop>=80?1.5:1.25;
                // Node fraction: little effort outside the best move -> stop sooner; spread effort -> think longer.
                if(iteration>=6&&myNodes>0){double frac=double(rootNodes[(from(best)<<6)|to(best)])/double(myNodes);
                    factor*=std::clamp((1.6-frac)*1.15,0.6,1.5);}
                factor=std::clamp(factor,0.45,2.2);
                // TMNextIter < 100 skips an iteration that is unlikely to finish in time.
                if(nowNs()>=shared.started+static_cast<long long>(budget*factor*T_NEXTITER/100.0))break;
            }
        }
        if(std::abs(score)>=MATE_BOUND&&MATE-std::abs(score)<=depth&&!limits.infinite&&!shared.ponder.load())break;
    }
    result.seldepth=selectiveDepth;
    return result;
}
}
