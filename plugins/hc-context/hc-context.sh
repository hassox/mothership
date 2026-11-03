#!/bin/sh
cat >/dev/null 2>&1 || true
[ -n "${HC_TERMINAL_ID:-}" ] || exit 0

[ -z "${HC_PROFILE:-}" ] || hc label "$HC_TERMINAL_ID" "org.profile=$HC_PROFILE" >/dev/null 2>&1 || true

message=$(sed 's/\\/\\\\/g; s/"/\\"/g' "$(dirname "$0")/hc-context.txt")

case "${1:-}" in
  agy) printf '{"injectSteps":[{"systemMessage":{"systemMessage":"%s"}}]}\n' "$message" ;;
  *) printf '{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"%s"}}\n' "$message" ;;
esac
