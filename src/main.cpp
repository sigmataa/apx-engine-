// UCI transport and search lifecycle. All position/search/evaluation code is local.
#include "search.hpp"
#include <algorithm>
#include <cctype>
#include <fstream>
#include <iostream>
#include <sstream>
#include <thread>

namespace forge {
namespace {
std::mutex outputMutex;
void emit(const std::string& text){std::lock_guard<std::mutex> lock(outputMutex);std::cout<<text<<std::endl;}
std::string lower(std::string s){for(char& c:s)c=char(std::tolower(static_cast<unsigned char>(c)));return s;}
int defaultThreads(){
    int n=int(std::max(1u,std::thread::hardware_concurrency()));
    std::ifstream file("/sys/fs/cgroup/cpu.max");std::string quota;long long period;
    if(file>>quota>>period&&quota!="max"&&period>0){try{n=std::min(n,std::max(1,int(std::stoll(quota)/period)));}catch(...) {}}
    return std::clamp(n,1,2);
}
long long number(const std::string& s){std::size_t used=0;long long value=std::stoll(s,&used);if(used!=s.size()||value<0)throw std::invalid_argument("invalid number");return value;}
bool keyword(const std::string& s){return s=="wtime"||s=="btime"||s=="winc"||s=="binc"||s=="movetime"||s=="movestogo"||s=="depth"||s=="nodes"||s=="mate"||s=="infinite"||s=="ponder"||s=="searchmoves";}
}

class Engine {
    Board board;
    TranspositionTable tt;
    int threads=defaultThreads(),hashMB=64,overhead=20;
    bool ponderOption=false;
    std::vector<std::unique_ptr<Searcher>> workers;
    std::shared_ptr<Control> current;
    std::thread manager;
    void rebuildWorkers(int number){
        std::vector<std::unique_ptr<Searcher>> replacement;
        for(int i=0;i<number;++i)replacement.push_back(std::make_unique<Searcher>(tt,i));
        workers=std::move(replacement);threads=number;
    }
    void info(const Result& result,const Control& control){
        long long ms=std::max(1LL,(nowNs()-control.started)/1000000);U64 nodes=control.nodes.load(std::memory_order_relaxed);
        std::ostringstream out;out<<"info depth "<<result.depth<<" seldepth "<<result.seldepth<<" score ";
        if(std::abs(result.score)>=MATE_BOUND){int moves=(MATE-std::abs(result.score)+1)/2;out<<"mate "<<(result.score<0?-moves:moves);}
        else out<<"cp "<<result.score;
        out<<" nodes "<<nodes<<" nps "<<(nodes*1000/U64(ms))<<" hashfull "<<tt.hashfull()<<" time "<<ms<<" pv";
        for(Move m:result.pv)out<<' '<<moveName(m);
        emit(out.str());
    }
public:
    Engine(){std::string error;board.setFen(START_FEN,error);rebuildWorkers(threads);}
    ~Engine(){stop();}
    void stop(){
        if(current){current->stop.store(true,std::memory_order_relaxed);current->changed.notify_all();}
        if(manager.joinable())manager.join();
        current.reset();
    }
    void identify(){
        emit("id name Apex Forge 1.0");emit("id author Apex Chess project");
        emit("option name Hash type spin default 64 min 1 max 4096");
        emit("option name Threads type spin default "+std::to_string(defaultThreads())+" min 1 max 16");
        emit("option name Move Overhead type spin default 20 min 0 max 5000");
        emit("option name Ponder type check default false");emit("option name UseNNUE type check default true");
        for(auto& t:tunables())emit("option name "+std::string(t.name)+" type spin default "+std::to_string(*t.value)+" min "+std::to_string(t.lo)+" max "+std::to_string(t.hi));emit("option name Clear Hash type button");emit("uciok");
    }
    void setOption(const std::string& line){
        std::istringstream in(line);std::string token,name,value;in>>token;
        if(!(in>>token)||token!="name"){emit("info string Invalid setoption");return;}
        while(in>>token&&token!="value"){if(!name.empty())name+=' ';name+=token;}
        std::getline(in,value);
        while(!value.empty()&&std::isspace(static_cast<unsigned char>(value.back())))value.pop_back();
        value.erase(0,value.find_first_not_of(" \t\r\n"));
        name=lower(name);stop();
        try{
            if(name=="hash"){int n=int(std::clamp(number(value),1LL,4096LL));if(n!=hashMB)tt.resize(n);hashMB=n;}
            else if(name=="threads"){int n=int(std::clamp(number(value),1LL,16LL));if(n!=threads)rebuildWorkers(n);}
            else if(name=="move overhead")overhead=int(std::clamp(number(value),0LL,5000LL));
            else if(name=="ponder"){
                if(lower(value)!="true"&&lower(value)!="false")throw std::invalid_argument("check value");
                ponderOption=lower(value)=="true";
            }else if(name=="usennue"){
                if(lower(value)!="true"&&lower(value)!="false")throw std::invalid_argument("check value");
                useNNUE=lower(value)=="true";for(auto& w:workers)w->clear();
            }else if(name=="clear hash")tt.clear();
            else if(auto it=std::find_if(tunables().begin(),tunables().end(),[&](const Tunable& t){return lower(t.name)==name;});it!=tunables().end()){
                *it->value=int(std::clamp(number(value),(long long)it->lo,(long long)it->hi));rebuildReductions();
            }
            else emit("info string Unsupported option: "+name);
        }catch(const std::exception& e){emit(std::string("info string Option rejected: ")+e.what());}
    }
    void newGame(){stop();tt.clear();for(auto& w:workers)w->clear();}
    void position(const std::string& line){
        stop();std::istringstream in(line);std::string command,token,fen,error;in>>command>>token;Board replacement;
        if(token=="startpos")fen=START_FEN;
        else if(token=="fen"){
            for(int i=0;i<6;++i){if(!(in>>token)){emit("info string Incomplete FEN");return;}if(i)fen+=' ';fen+=token;}
        }else{emit("info string Expected startpos or fen");return;}
        if(!replacement.setFen(fen,error)){emit("info string Position rejected: "+error);return;}
        if(in>>token){
            if(token!="moves"){emit("info string Expected moves after position");return;}
            while(in>>token){Move m=replacement.parseMove(token);if(!m){emit("info string Illegal move: "+token);return;}Undo u;replacement.make(m,u);}
        }
        board=std::move(replacement);
    }
    void go(const std::string& line){
        stop();std::istringstream input(line);std::vector<std::string> args;std::string token;input>>token;while(input>>token)args.push_back(token);
        if(args.size()>=2&&args[0]=="perft"){
            try{
                int depth=int(std::clamp(number(args[1]),0LL,8LL));auto start=nowNs();U64 total=0;
                if(!depth)total=1;
                else for(Move m:board.legalMoves()){Undo u;board.make(m,u);U64 n=perft(board,depth-1);board.unmake(m,u);total+=n;emit(moveName(m)+": "+std::to_string(n));}
                emit("Nodes searched: "+std::to_string(total));emit("info string perft time "+std::to_string((nowNs()-start)/1000000)+" ms");
            }catch(...){emit("info string Invalid perft depth");}return;
        }
        Limits limits;
        try{
            for(std::size_t i=0;i<args.size();++i){
                std::string key=args[i];
                if(key=="infinite")limits.infinite=true;
                else if(key=="ponder")limits.ponder=true;
                else if(key=="searchmoves"){
                    limits.restricted=true;
                    while(i+1<args.size()&&!keyword(args[i+1])){
                        Move m=board.parseMove(args[++i]);if(!m)throw std::invalid_argument("illegal searchmove");limits.searchMoves.push_back(m);
                    }
                }else{
                    if(i+1>=args.size())throw std::invalid_argument("missing go value");
                    long long value=number(args[++i]);
                    if(key=="wtime")limits.wtime=std::min(value,86400000LL);
                    else if(key=="btime")limits.btime=std::min(value,86400000LL);
                    else if(key=="winc")limits.winc=std::min(value,3600000LL);
                    else if(key=="binc")limits.binc=std::min(value,3600000LL);
                    else if(key=="movetime")limits.movetime=std::min(value,86400000LL);
                    else if(key=="movestogo")limits.movesToGo=int(std::clamp(value,1LL,1000LL));
                    else if(key=="depth")limits.depth=int(std::clamp(value,1LL,96LL));
                    else if(key=="nodes")limits.nodes=std::max(1LL,value);
                    else if(key=="mate"){limits.mate=int(std::clamp(value,1LL,48LL));limits.depth=std::min(limits.depth,limits.mate*2+2);}
                    else throw std::invalid_argument("unknown go parameter");
                }
            }
        }catch(const std::exception& e){emit(std::string("info string Search rejected: ")+e.what());return;}
        auto legal=board.legalMoves();
        if(!limits.restricted)limits.searchMoves.assign(legal.begin(),legal.end());
        if(limits.searchMoves.empty()){emit("info depth 0 score "+std::string(board.inCheck()?"mate 0":"cp 0"));emit("bestmove 0000");return;}
        auto control=std::make_shared<Control>();control->started=nowNs();control->nodeLimit=limits.nodes;control->ponder=limits.ponder;
        long long remaining=board.side==WHITE?limits.wtime:limits.btime,increment=board.side==WHITE?limits.winc:limits.binc;
        if(limits.movetime>=0){control->hardMs=std::max(1LL,limits.movetime-overhead);control->softMs=control->hardMs;}
        else if(remaining>=0){
            long long margin=std::max<long long>(overhead,std::min(50LL,remaining/20));
            long long usable=std::max(1LL,remaining-margin);
            int moves=limits.movesToGo?limits.movesToGo:T_TMMOVES;
            long long target=usable/(moves+1)+increment*T_TMINC/100;
            control->softMs=std::clamp(target,1LL,std::max(1LL,usable*35/100));
            control->hardMs=std::clamp(std::max(control->softMs*4,usable/8),1LL,usable);
        }
        if(!limits.infinite&&!limits.ponder){
            if(control->softMs)control->softDeadline=control->started+control->softMs*1000000;
            if(control->hardMs)control->hardDeadline=control->started+control->hardMs*1000000;
        }
        current=control;tt.newSearch();Board root=board;bool outputPonder=ponderOption;
        manager=std::thread([this,root=std::move(root),limits,control,outputPonder]()mutable{
            std::vector<std::thread> helpers;
            try{
                for(int i=1;i<threads;++i)helpers.emplace_back([&,i]{try{workers[i]->run(root,limits,*control,[](const Result&,const Control&){});}catch(...){control->stop=true;}});
                Result result=workers[0]->run(root,limits,*control,[this](const Result& r,const Control& c){info(r,c);});
                if(!control->stop.load()&&(limits.infinite||control->ponder.load())){
                    std::unique_lock<std::mutex> lock(control->mutex);
                    control->changed.wait(lock,[&]{return control->stop.load()||(!limits.infinite&&!control->ponder.load());});
                }
                control->stop=true;control->changed.notify_all();for(auto& helper:helpers)helper.join();
                if(result.depth)info(result,*control);
                std::string best="bestmove "+moveName(result.best);
                if(outputPonder&&result.pv.size()>1)best+=" ponder "+moveName(result.pv[1]);
                emit(best);
            }catch(const std::exception& e){
                control->stop=true;for(auto& helper:helpers)if(helper.joinable())helper.join();
                emit(std::string("info string Search failed: ")+e.what());emit("bestmove "+moveName(limits.searchMoves[0]));
            }
        });
    }
    void ponderHit(){
        if(!current||!current->ponder.load())return;
        long long now=nowNs();
        if(current->softMs)current->softDeadline=now+current->softMs*1000000;
        if(current->hardMs)current->hardDeadline=now+current->hardMs*1000000;
        current->ponder=false;current->changed.notify_all();
    }
    void display(){stop();emit("info string FEN "+board.fen());}
    void eval(){stop();Evaluator evaluator;emit("info string Evaluation "+std::to_string(evaluator.evaluate(board))+" cp for side to move");}
    void loop(){
        std::string line;
        while(std::getline(std::cin,line)){
            std::istringstream in(line);std::string command;in>>command;
            if(command=="uci")identify();else if(command=="isready")emit("readyok");
            else if(command=="setoption")setOption(line);else if(command=="ucinewgame")newGame();
            else if(command=="position")position(line);else if(command=="go")go(line);
            else if(command=="stop")stop();else if(command=="ponderhit")ponderHit();
            else if(command=="d")display();else if(command=="eval")eval();
            else if(command=="quit"){stop();break;}
        }
        stop();
    }
};
}

int main(int argc,char** argv){
    using namespace forge;
    try{
        if(argc>1&&std::string(argv[1])=="--selfcheck"){
            std::string error;if(!selfcheck(error)){std::cerr<<"Self-check failed: "<<error<<'\n';return 1;}
            std::cout<<"Move generation, castling, en passant, promotions and incremental state checks passed.\n";return 0;
        }
        if(argc>1&&std::string(argv[1])=="--version"){std::cout<<"Apex Forge 1.0 — original classical UCI engine\n";return 0;}
        Engine engine;engine.loop();return 0;
    }catch(const std::exception& e){std::cerr<<"Apex Forge: "<<e.what()<<'\n';return 1;}
}
