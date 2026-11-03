#!/bin/sh
set -eu
app=$1
layout=$2
mod=$3
case $mod in
  mothership-*) ;;
  *) echo "not a mothership mod: $mod" >&2; exit 1 ;;
esac
target="$app/mods/$mod"
if [ -e "$target" ] && [ ! -e "$target/.mothership" ]; then
  echo "$target was not installed by this repo; left it" >&2
  exit 0
fi
[ ! -e "$app/layouts/$layout.json" ] || python3 scripts/swap-layout.py "$app/layouts/$layout.json" "mods/$mod" back
[ ! -e "$target/.mothership" ] || rm -r "$target"
