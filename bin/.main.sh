#!/usr/bin/env bash
prg=`readlink -f $0`
if [ ! -e "$prg" ]; then
  case $prg in
    (*/*) exit 1;;
    (*) prg=$(command -v -- "$prg") || exit;;
  esac
fi
dir=$(
  cd -P -- "$(dirname -- "$prg")" && pwd -P
) || exit
name=$(basename -- "$prg")

app=run.js
mod=
case $name in
	lithp)
        ;;
    repl)
        mod=repl.lithp
        ;;
    *)
        ;;
esac
$dir/../$app $mod $@
