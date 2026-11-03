#!/bin/sh
set -eu
app=$1
layout=$2
mod=$3
target="$app/mods/$mod"
export HERDR_APP_HOME="$app"
if [ -e "$target" ] && [ ! -L "$target" ] && [ ! -e "$target/.mothership" ]; then
  echo "$target is a folder this repo did not install; move it away first" >&2
  exit 1
fi
[ ! -L "$target" ] || rm "$target"
mkdir -p "$target"
rsync -a --delete --exclude .mothership --exclude '*.d.ts' --exclude jsconfig.json "mods/$mod/" "$target/"
touch "$target/.mothership"
herdr-app check "$target"
python3 scripts/swap-layout.py "$app/layouts/$layout.json" "mods/$mod"
herdr-app do layout.switch "{\"name\":\"$layout\"}" >/dev/null
