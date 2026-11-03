#!/bin/sh
set -eu

REPO=$(cd "$(dirname "$0")" && pwd)
APP=${HERDR_APP_HOME:-$HOME/.config/herdr-app}
LAYOUT=nested

for mod in "$REPO"/mods/*/; do
  target="$APP/mods/$(basename "$mod")"
  if [ -e "$target" ] && [ ! -L "$target" ]; then
    echo "skip $target: a folder that is not a link is there" >&2
    continue
  fi
  cp "$REPO"/shared/*.js "$mod"
  ln -sfn "${mod%/}" "$target"
  herdr-app check "$target"
done

if [ ! -e "$APP/layouts/$LAYOUT.json" ]; then
  herdr-app do layout.clone "{\"name\":\"main\",\"as\":\"$LAYOUT\"}" >/dev/null
fi

python3 - "$APP/layouts/$LAYOUT.json" "$REPO/mods" <<'PY'
import json, pathlib, sys

layout, mods = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2])
swap = {}
for meta in mods.glob("*/mod.json"):
    source = json.loads(meta.read_text()).get("cloned_from", {}).get("name")
    if source:
        swap[source] = meta.parent.name

def walk(node):
    if isinstance(node, dict):
        if node.get("mod") in swap:
            node["mod"] = swap[node["mod"]]
        for value in node.values():
            walk(value)
    elif isinstance(node, list):
        for value in node:
            walk(value)

tree = json.loads(layout.read_text())
walk(tree)
layout.write_text(json.dumps(tree, indent=2) + "\n")
print("layout", layout.name, "uses", ", ".join(f"{a} -> {b}" for a, b in swap.items()))
PY

herdr-app do layout.switch "{\"name\":\"main\"}" >/dev/null
herdr-app do layout.switch "{\"name\":\"$LAYOUT\"}" >/dev/null
