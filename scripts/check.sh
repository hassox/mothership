#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
for mod in mods/*/; do
  cp shared/*.js "$mod"
  herdr-app check "$mod"
done
bun test
