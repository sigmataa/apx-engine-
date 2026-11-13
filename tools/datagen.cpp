// Self-play data generator: datagen out_prefix threads seconds nodes seed
#include "search.hpp"
#include <cstdio>
#include <random>
#include <thread>
using namespace forge;

#pragma pack(push,1)
struct Rec {U64 occ;std::uint8_t pcs[16];std::int16_t score;std::uint8_t result,stm;};
#pragma pack(pop)

static void run(int id,const char* prefix,long long seconds,int nodes,unsigned seed){
    char name[256];snprintf(name,sizeof name,"%s.%d.bin",prefix,id);FILE* f=fopen(name,"wb");
    std::mt19937_64 rng(seed*1000003ULL+id);
    TranspositionTable tt(16);auto S=std::make_unique<Searcher>(tt,0);
    long long end=nowNs()+seconds*1000000000LL;long long total=0;
    while(nowNs()<end){
        Board b;std::string e;b.setFen(START_FEN,e);tt.clear();S->clear();
        int randomPlies=8+int(rng()%3);bool bad=false;
        for(int i=0;i<randomPlies;++i){auto l=b.legalMoves();if(!l.size){bad=true;break;}Undo u;b.make(l.moves[rng()%l.size],u);}
        if(bad||!b.legalMoves().size)continue;
        std::vector<Rec> recs;int result=-1,winStreak=0,drawStreak=0;
        for(int ply=0;ply<400&&result<0;++ply){
            auto legal=b.legalMoves();
            if(!legal.size){result=b.inCheck()?(b.side==WHITE?0:2):1;break;}
            if(b.insufficient()||b.halfmove>=100||b.repetition(b.history.size())){result=1;break;}
            Limits lim;lim.searchMoves.assign(legal.begin(),legal.end());
            Control c;c.started=nowNs();c.nodeLimit=U64(nodes);tt.newSearch();
            Result r=S->run(b,lim,c,[](const Result&,const Control&){});
            int white=b.side==WHITE?r.score:-r.score;
            if(!b.inCheck()&&!b.isCapture(r.best)&&!promotion(r.best)&&std::abs(r.score)<3000){
                Rec x{};x.occ=b.occupied();U64 o=x.occ;int k=0;
                while(o){int s=pop(o);int pc=b.squares[s];x.pcs[k/2]|=std::uint8_t(pc<<((k&1)*4));++k;}
                x.score=std::int16_t(white);x.stm=std::uint8_t(b.side);recs.push_back(x);
            }
            if(std::abs(white)>=2000){if(++winStreak>=4){result=white>0?2:0;break;}}else winStreak=0;
            if(ply>=120&&std::abs(white)<=8){if(++drawStreak>=12){result=1;break;}}else drawStreak=0;
            Undo u;if(!b.make(r.best,u))break;
        }
        if(result<0)result=1;
        for(auto& x:recs)x.result=std::uint8_t(result);
        fwrite(recs.data(),sizeof(Rec),recs.size(),f);fflush(f);total+=recs.size();
    }
    fclose(f);fprintf(stderr,"thread %d wrote %lld\n",id,total);
}
int main(int c,char** v){
    int threads=atoi(v[2]);long long sec=atoll(v[3]);int nodes=atoi(v[4]);unsigned seed=c>5?atoi(v[5]):1;
    std::vector<std::thread> t;for(int i=0;i<threads;++i)t.emplace_back(run,i,v[1],sec,nodes,seed);for(auto& x:t)x.join();
}
