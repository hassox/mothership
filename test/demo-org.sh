#!/bin/sh
set -eu
F=$(cd "$(dirname "$0")" && pwd)/fake-agent.sh
for n in demo-review demo-ui demo-api demo-fix demo-notes; do hc kill "$n" >/dev/null 2>&1 || true; hc rm "$n" >/dev/null 2>&1 || true; done
[ "${1:-}" = "--clean" ] && exit 0
sp() { name=$1 app=$2 state=$3; shift 3; hc run --bg --json --no-notify --name "$name" "$@" -- "$F" "$app" "$state" | sed -n 's/.*"address":"\([^"]*\)".*/\1/p'; }
R=$(sp demo-review codex idle --label org.role=sub-lead --label org.profile=reviewer)
sp demo-ui pi working --parent "$R" --label org.role=worker --label org.profile=poteto >/dev/null
sp demo-api pi working --parent "$R" --label org.role=worker >/dev/null
sp demo-fix claude-code working --label org.role=worker --label org.profile=poteto >/dev/null
sp demo-notes claude-code idle >/dev/null
