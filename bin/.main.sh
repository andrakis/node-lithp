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
args=
case $name in
	lithp)
        ;;
    repl)
        mod=repl.lithp
        ;;
	macro)
        args=-m
        ;;
    *)
        ;;
esac
pushd $dir/.. > /dev/null
./$app $mod $args $@
