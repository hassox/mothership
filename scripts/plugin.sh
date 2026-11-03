#!/bin/sh
set -eu
action=$1
repo=$(pwd)
plugin="$repo/plugins/hc-context"
market=hassox-mothership
id="hc-context@$market"

installed() {
  case $1 in
    claude) claude plugin list 2>/dev/null | grep -qF "$id" ;;
    codex) codex plugin list 2>/dev/null | grep -qE "^$id +installed" ;;
    grok) grok plugin list 2>/dev/null | grep -qF "[local: $plugin]" ;;
    agy) agy plugin list 2>/dev/null | grep -q '^- hc-context ' ;;
    pi) pi list 2>/dev/null | grep -qF "$plugin" ;;
  esac
}

add() {
  case $1 in
    claude) claude plugin marketplace add "$repo" && claude plugin install "$id" ;;
    codex) codex plugin marketplace add "$repo" && codex plugin add "$id" ;;
    grok) grok plugin install "$plugin" --trust ;;
    agy) agy plugin install "$plugin" ;;
    pi) pi install "$plugin" ;;
  esac
}

drop() {
  case $1 in
    claude) claude plugin uninstall "$id" && claude plugin marketplace remove "$market" ;;
    codex) codex plugin remove "$id" && codex plugin marketplace remove "$market" ;;
    grok) grok plugin uninstall hc-context ;;
    agy) agy plugin uninstall hc-context ;;
    pi) pi remove "$plugin" ;;
  esac
}

wanted() {
  [ -n "${HARNESSES+set}" ] || return 0
  case " $HARNESSES " in *" $1 "*) return 0 ;; esac
  echo "$1: not in HARNESSES, skipped"
  return 1
}

agreed() {
  if [ -n "${HARNESSES+set}" ] || [ ! -t 0 ]; then return 0; fi
  printf 'Install hc-context into %s? [Y/n] ' "$1"
  read -r answer || answer=n
  case $answer in
    [nN]*) echo "$1: skipped"; return 1 ;;
  esac
}

for h in claude codex grok agy pi; do
  command -v "$h" >/dev/null 2>&1 || { echo "$h: not on PATH, skipped"; continue; }
  wanted "$h" || continue
  if [ "$action" = install ]; then
    if installed "$h"; then echo "$h: hc-context is already installed"; continue; fi
    agreed "$h" || continue
    add "$h"
    echo "$h: installed hc-context"
  else
    if ! installed "$h"; then echo "$h: hc-context is not installed"; continue; fi
    drop "$h"
    echo "$h: uninstalled hc-context"
  fi
done
