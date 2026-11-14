// Minimal UCI match runner using the engine's own Board for rules.
// usage: match engA engB pairs concurrency base_ms inc_ms [seed]
#include "chess.hpp"
#include <atomic>
#include <cmath>
#include <cstdio>
#include <cstring>
#include <mutex>
#include <random>
#include <sstream>
#include <thread>
#include <unistd.h>
#include <sys/wait.h>
#include <signal.h>
#include <chrono>
using namespace forge;

struct Proc {
    pid_t pid; FILE* in; FILE* out;
    Proc(const char* spec){
        std::string s(spec),path=s.substr(0,s.find('?')),opts=s.find('?')==std::string::npos?"":s.substr(s.find('?')+1);
        int a[2],b[2];pipe(a);pipe(b);pid=fork();
        if(!pid){dup2(a[0],0);dup2(b[1],1);close(a[1]);close(b[0]);execl(path.c_str(),path.c_str(),(char*)0);_exit(1);}
        close(a[0]);close(b[1]);in=fdopen(a[1],"w");out=fdopen(b[0],"r");
        send("uci");wait("uciok");send("setoption name Threads value 1");send("setoption name Hash value 16");
        std::stringstream ss(opts);std::string kv;
        while(std::getline(ss,kv,'&')){auto e=kv.find('=');if(e==std::string::npos)continue;send("setoption name "+kv.substr(0,e)+" value "+kv.substr(e+1));}
        send("isready");wait("readyok");
    }
    ~Proc(){send("quit");fclose(in);fclose(out);waitpid(pid,nullptr,0);}
    void send(const std::string& s){fprintf(in,"%s\n",s.c_str());fflush(in);}
    std::string line(){char buf[8192];if(!fgets(buf,sizeof buf,out))return "";std::string s(buf);while(!s.empty()&&(s.back()=='\n'||s.back()=='\r'))s.pop_back();return s;}
    void wait(const std::string& w){for(;;){auto l=line();if(l.rfind(w,0)==0||l.empty())return;}}
};

std::mutex mu; int W=0,L=0,D=0; std::atomic<bool> sprtDone{false}; double sprtLo=-1e9; std::atomic<int> nextPair{0}; int pairs; std::array<int,5> penta{};
const char *A,*B; long long base,inc; unsigned seed;

std::vector<std::string> opening(int idx){
    std::mt19937 rng(seed*7919+idx);
    for(;;){
        Board b;std::string e;b.setFen(START_FEN,e);std::vector<std::string> mv;bool ok=true;
        for(int i=0;i<8;++i){auto l=b.legalMoves();if(!l.size){ok=false;break;}
            Move m=l.moves[rng()%l.size];Undo u;b.make(m,u);mv.push_back(moveName(m));}
        if(!ok||!b.legalMoves().size)continue;
        // filter: quick check with engine A for balance
        Proc p(A);std::string pos="position startpos moves";for(auto&s:mv)pos+=" "+s;
        p.send(pos);p.send("go nodes 30000");int sc=99999;
        for(;;){auto l=p.line();if(l.empty())break;auto k=l.find("score cp ");if(k!=std::string::npos)sc=std::atoi(l.c_str()+k+9);if(l.rfind("bestmove",0)==0)break;}
        // UNBAL=1: unbalanced openings (one side ahead by 0.7-1.4 pawns), each played with both colours.
        // Fewer draws, so each game pair carries more information than with balanced openings.
        if(getenv("UNBAL")?(std::abs(sc)>=70&&std::abs(sc)<=140):(std::abs(sc)<=60))return mv;
    }
}
// returns score for white: 1, 0.5, 0
double play(const std::vector<std::string>& open,Proc& white,Proc& black){
    Board b;std::string e;b.setFen(START_FEN,e);std::string moves;
    for(auto&s:open){Move m=b.parseMove(s);Undo u;b.make(m,u);moves+=" "+s;}
    long long t[2]={base,base};int drawCount=0,ply=0;
    white.send("ucinewgame");black.send("ucinewgame");
    for(;;){
        if(!b.legalMoves().size)return b.inCheck()?(b.side==WHITE?0:1):0.5;
        if(b.insufficient()||b.halfmove>=100)return 0.5;
        {int c=0;for(auto k:b.history)if(k==b.key)++c;if(c>=3)return 0.5;}
        Proc& p=b.side==WHITE?white:black;
        p.send("position startpos moves"+moves);
        char go[200];if(base>0)snprintf(go,sizeof go,"go wtime %lld btime %lld winc %lld binc %lld",t[0],t[1],inc,inc);else snprintf(go,sizeof go,"go movetime %lld",inc);p.send(go);
        auto st=std::chrono::steady_clock::now();int sc=0;bool mate=false;std::string best;
        for(;;){auto l=p.line();if(l.empty())return b.side==WHITE?0:1;
            auto k=l.find("score cp ");if(k!=std::string::npos){sc=std::atoi(l.c_str()+k+9);mate=false;}
            k=l.find("score mate ");if(k!=std::string::npos){int mm=std::atoi(l.c_str()+k+11);sc=mm>0?30000:-30000;mate=true;}
            if(l.rfind("bestmove",0)==0){best=l.substr(9);best=best.substr(0,best.find(' '));break;}}
        long long el=std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::steady_clock::now()-st).count();
        if(base<=0)t[b.side]=el>inc+1000?-1:t[b.side];else t[b.side]-=el;if(t[b.side]<0){std::lock_guard g(mu);fprintf(stderr,"timeout %s\n",b.side==WHITE?"white":"black");return b.side==WHITE?0:1;}
        if(base>0)t[b.side]+=inc;
        Move m=b.parseMove(best);if(!m){fprintf(stderr,"illegal %s\n",best.c_str());return b.side==WHITE?0:1;}
        int wsc=b.side==WHITE?sc:-sc;(void)mate;
        // simple resign: score from white's view beyond 1000 for 8 consecutive plies
        static thread_local int rs=0,rsign=0;if(ply==0){rs=0;rsign=0;}
        int sg=wsc>=1000?1:wsc<=-1000?-1:0;if(sg&&sg==rsign)++rs;else{rs=sg?1:0;rsign=sg;}
        if(rs>=8)return rsign>0?1:0;
        if(ply>=80&&std::abs(sc)<=5)++drawCount;else drawCount=0;if(drawCount>=10)return 0.5;
        Undo u;b.make(m,u);moves+=" "+best;++ply;
    }
}
void worker(){
    Proc a(A),bb(B);
    for(;;){if(sprtDone)return;int i=nextPair++;if(i>=pairs)return;
        auto op=opening(i);
        double r1=play(op,a,bb);       // A white
        double r2=1-play(op,bb,a);     // A black
        std::lock_guard g(mu);
        for(double r:{r1,r2}){if(r==1)++W;else if(r==0)++L;else ++D;}
        penta[int((r1+r2)*2+0.01)]++;
        int n=W+L+D;double s=(W+0.5*D)/n;
        // pentanomial variance
        double pm=0,var=0;int np=0;for(int k=0;k<5;++k)np+=penta[k];
        for(int k=0;k<5;++k)pm+=penta[k]*(k/4.0);pm/=np;for(int k=0;k<5;++k)var+=penta[k]*std::pow(k/4.0-pm,2);var/=np;
        double se=std::sqrt(var/np);auto elo=[](double x){x=std::clamp(x,1e-4,1-1e-4);return -400*std::log10(1/x-1);};
        // SPRT (elo0=0, elo1=15, alpha=beta=0.05) on game pairs; only when SPRT env var is set.
        double llr=0;if(getenv("SPRT")&&np>=20&&var>0){auto sc=[](double e){return 1/(1+std::pow(10,-e/400));};double s0=sc(0),s1=sc(15);llr=np*(s1-s0)*(2*pm-s0-s1)/(2*var);}
        printf("%d games W%d L%d D%d  elo %.1f +- %.1f  penta[%d %d %d %d %d]%s\n",n,W,L,D,elo(s),(elo(s+1.96*se)-elo(s-1.96*se))/2,penta[0],penta[1],penta[2],penta[3],penta[4],
               getenv("SPRT")?(llr>=2.94?"  SPRT: H1 accepted (gain)":llr<=-2.94?"  SPRT: H0 accepted (no gain)":""):"");fflush(stdout);
        if(getenv("SPRT")&&(llr>=2.94||llr<=-2.94))sprtDone=true;
    }
}
int main(int c,char**v){
    signal(SIGPIPE,SIG_IGN);A=v[1];B=v[2];pairs=atoi(v[3]);int conc=atoi(v[4]);base=atoll(v[5]);inc=atoll(v[6]);seed=c>7?atoi(v[7]):1;
    std::vector<std::thread> th;for(int i=0;i<conc;++i)th.emplace_back(worker);for(auto&t:th)t.join();
}
