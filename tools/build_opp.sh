#!/bin/bash
# build_opp.sh NAME -> builds the listed CCRL version of an opponent engine into ./oppbin (exact release tag)
set -e; N=$1; rm -rf opp
case $N in
  lynx)   git clone -q --depth 1 -b v1.11.0 https://github.com/lynx-chess/Lynx opp; (cd opp && dotnet publish src/Lynx.Cli/Lynx.Cli.csproj -c Release -o out -v q >/dev/null); B=$(ls opp/out/Lynx.Cli opp/out/Lynx 2>/dev/null | head -1) ;;
  laser)  git clone -q --depth 1 -b v1.7 https://github.com/jeffreyan11/uci-chess-engine opp; (cd opp/src && make -s -j4 >/dev/null 2>&1 || make -s); B=$(find opp -maxdepth 2 -type f -name 'laser*' -perm -u+x | head -1) ;;
  weiss)  git clone -q --depth 1 -b v2.0 https://github.com/TerjeKir/weiss opp; (cd opp/src && { sed -i "s/-Werror//g" makefile Makefile 2>/dev/null || true; }; make -s >/dev/null); B=$(find opp -maxdepth 2 -type f -name 'weiss*' -perm -u+x | head -1) ;;
  stash)  git clone -q --depth 1 -b v37.0 https://github.com/mhouppin/stash-bot opp; (cd opp/src && make -s >/dev/null); B=$(find opp -maxdepth 2 -type f -name 'stash*' -perm -u+x | head -1) ;;
  leorik) git clone -q --depth 1 -b 3.2 https://github.com/lithander/Leorik opp; P=$(find opp -name 'Leorik.Engine.csproj' | head -1); dotnet publish "$P" -c Release -o opp/out -v q >/dev/null; B=$(ls opp/out/Leorik.Engine opp/out/Leorik 2>/dev/null | head -1) ;;
  willow) git clone -q --depth 1 -b 4.0.0.1 https://github.com/Adam-Kulju/Willow opp; (cd opp && (make -s >/dev/null 2>&1 || (cd src && make -s))); B=$(find opp -maxdepth 2 -type f -iname 'willow*' -perm -u+x | head -1) ;;
esac
[ -n "$B" ] && cp "$B" oppbin && chmod +x oppbin
# C# engines need their sidecar files (nets, dlls) next to the binary: run them in place via a wrapper
if [ "$N" = lynx ] || [ "$N" = leorik ]; then D=$(dirname "$(readlink -f "$B")"); printf '#!/bin/bash\ncd %s && exec ./%s\n' "$D" "$(basename "$B")" > oppbin; chmod +x oppbin; fi
printf 'uci\nquit\n' | timeout 20 ./oppbin | grep -m1 'id name'
