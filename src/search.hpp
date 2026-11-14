#pragma once
#include "chess.hpp"
#include "eval.hpp"
#include <atomic>
#include <chrono>
#include <condition_variable>
#include <functional>
#include <memory>
#include <mutex>
#include <vector>

namespace forge {
long long nowNs();
// Search/time parameters exposed as UCI spin options for tuning.
struct Tunable {const char* name;int* value;int lo,hi;};
extern int T_RFP,T_RFPI,T_RAZOR,T_NMPB,T_NMPD,T_NMPE,T_LMPB,T_FUTM,T_FUTB,T_HISTP,T_SEEC,T_SING,T_ASP,T_LMRD,T_TMMOVES,T_TMINC,T_NEXTITER,T_PCM;
std::vector<Tunable>& tunables();
void rebuildReductions();
struct TTData {Move best=0;int score=0,eval=32767,depth=0,bound=0,age=0;bool found=false,qchecks=false,pv=false;};
enum Bound {NONE=0,UPPER=1,LOWER=2,EXACT=3};
class TranspositionTable {
    struct Entry {std::atomic<U64> checksum{0},data{0};};
    struct alignas(64) Bucket {Entry entry[4];};
    std::unique_ptr<Bucket[]> table;
    std::size_t buckets=0;
    int generation=0;
public:
    explicit TranspositionTable(int mb=64){resize(mb);}
    void resize(int mb);
    void clear();
    void newSearch(){generation=(generation+1)&15;}
    TTData probe(U64 key,int ply)const;
    void store(U64 key,int ply,int depth,int score,int eval,int bound,Move best,bool pv=false);
    void prefetch(U64 key)const;
    int hashfull()const;
};
struct Limits {
    int depth=96,mate=0;
    U64 nodes=0;
    long long wtime=-1,btime=-1,winc=0,binc=0,movetime=-1;
    int movesToGo=0;
    bool infinite=false,ponder=false,restricted=false;
    std::vector<Move> searchMoves;
};
struct Control {
    std::atomic<bool> stop{false},ponder{false};
    std::atomic<U64> nodes{0};
    std::atomic<long long> softDeadline{0},hardDeadline{0};
    long long started=0,softMs=0,hardMs=0;
    U64 nodeLimit=0;
    std::mutex mutex;
    std::condition_variable changed;
};
struct Result {Move best=0;int score=0,depth=0,seldepth=0;std::vector<Move> pv;};
using Reporter=std::function<void(const Result&,const Control&)>;
class Searcher {
    struct Context {Move current=0;int pc=0,staticEval=32767,cutoffs=0;bool inCheck=false;};
    struct Ranked {
        Move m;int order,see;bool capture;
        bool operator<(const Ranked& other)const{
            return order!=other.order?order<other.order:m>other.m;
        }
    };
    class MovePicker;
    TranspositionTable& tt;
    Evaluator evaluator;
    int id=0,selectiveDepth=0,rootDepth=0,searches=0,nullVerificationPly=-1;
    std::size_t rootHistory=0;
    Control* control=nullptr;
    std::vector<Move> allowed;
    bool rootRestricted=false;
    std::array<Context,MAX_PLY+4> stack{};
    std::array<Move,MAX_PLY+4> excluded{};
    std::array<std::array<Move,2>,MAX_PLY> killers{};
    std::array<std::array<Move,64>,13> counters{};
    std::array<std::array<std::array<std::int16_t,64>,64>,2> history{};
    std::array<std::array<std::array<std::int16_t,7>,64>,13> captureHistory{};
    std::vector<std::int16_t> continuation;
    U64 myNodes=0;
    std::array<U64,4096> rootNodes{};
    std::array<std::array<int,16384>,2> corrHist{};
    std::array<std::array<std::array<int,64>,13>,2> contCorr{};
    std::array<std::array<std::array<int,16384>,2>,2> npCorr{};  // [side to move][piece colour][non-pawn key]
    int curPly=0;
    int corrected(const Board& b,int raw)const;
    void updateCorrection(const Board& b,int depth,int diff);
    std::array<std::array<Move,MAX_PLY>,MAX_PLY> pv{};
    std::array<int,MAX_PLY> pvLength{};
    bool visit();
    bool draw(Board& b,int ply,bool checked);
    int search(Board& b,int depth,int alpha,int beta,int ply,bool pvNode,bool allowNull);
    int qsearch(Board& b,int alpha,int beta,int ply,int quietChecks);
    int rankMoves(Board& b,MoveList& list,std::array<Ranked,256>& ranked,Move ttMove,int ply,int stage,std::array<Ranked,256>& bad,int& nbad);
    int continuationScore(int ply,int pc,int dst)const;
    void rewardQuiet(int side,Move m,int pc,int ply,int bonus);
    void updatePv(int ply,Move m);
public:
    Searcher(TranspositionTable& table,int worker):tt(table),id(worker),continuation(13*64*13*64){}
    void clear();
    Result run(Board board,const Limits& limits,Control& shared,const Reporter& report);
};
}
