#!/bin/sh
printf '\033]7501;state=%s:app=%s\007' "${2:-idle}" "${1:-fake}"
exec sleep "${3:-3600}"
