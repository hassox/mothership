#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
for mod in mods/*/; do
  herdr-app check "$mod"
done
bun test
