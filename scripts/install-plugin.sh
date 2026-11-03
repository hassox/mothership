#!/bin/sh
set -eu

plugin="$(pwd)/plugins/hc-context"
marketplace=hassox-mothership
has() { command -v "$1" >/dev/null 2>&1; }

if has claude; then
  claude plugin marketplace add "$(pwd)"
  claude plugin install "hc-context@$marketplace"
fi

if has codex; then
  codex plugin marketplace add "$(pwd)"
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
