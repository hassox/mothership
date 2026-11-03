#!/bin/sh
set -eu
app=$1
layout=$2
export HERDR_APP_HOME="$app"
[ -e "$app/layouts/$layout.json" ] || herdr-app do layout.clone "{\"name\":\"main\",\"as\":\"$layout\"}" >/dev/null
cp "layouts/$layout.png" "$app/layouts/$layout.png"
python3 - "$app/layouts/$layout.json" "layouts/$layout.png" <<'PY'
import json, pathlib, sys
path = pathlib.Path(sys.argv[1])
tree = json.loads(path.read_text())
tree["preview"] = sys.argv[2]
path.write_text(json.dumps(tree, indent=2) + "\n")
PY
