#!/bin/sh
set -eu

REPO=$(cd "$(dirname "$0")" && pwd)
APP=${HERDR_APP_HOME:-$HOME/.config/herdr-app}
LAYOUT=nested

for mod in "$REPO"/mods/*/; do
  target="$APP/mods/$(basename "$mod")"
  if [ -e "$target" ] && [ ! -L "$target" ] && [ ! -e "$target/.herdr-configs" ]; then
    echo "skip $target: a folder this script did not install is there" >&2
    continue
  fi
  cp "$REPO"/shared/*.js "$mod"
  [ ! -L "$target" ] || rm "$target"
  mkdir -p "$target"
  rsync -a --delete --exclude .herdr-configs --exclude '*.d.ts' --exclude jsconfig.json "$mod" "$target/"
  touch "$target/.herdr-configs"
  herdr-app check "$target"
done

mkdir -p "$APP/layouts"
cp "$REPO/layouts/$LAYOUT.png" "$APP/layouts/"
[ -e "$APP/layouts/$LAYOUT.json" ] || cp "$REPO/layouts/$LAYOUT.json" "$APP/layouts/"

herdr-app do layout.switch "{\"name\":\"$LAYOUT\"}" >/dev/null

mkdir -p "$HOME/.local/bin"
ln -sfn "$REPO/bin/herdr-org-launch" "$HOME/.local/bin/herdr-org-launch"

plugin="$REPO/plugins/hc-context"
marketplace=hassox-herdr-configs
has() { command -v "$1" >/dev/null 2>&1; }

if has claude; then
  claude plugin marketplace add "$REPO"
  claude plugin install "hc-context@$marketplace"
fi

if has codex; then
  codex plugin marketplace add "$REPO"
  codex plugin add "hc-context@$marketplace"
fi

if has grok; then
  grok plugin list | grep -qF "[local: $plugin]" || grok plugin install "$plugin" --trust
fi

if has agy; then
  agy plugin install "$plugin"
fi

if has pi; then
  pi install "$plugin"
fi
