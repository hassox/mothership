#!/bin/sh
set -eu
app=$1
layout=$2
export HERDR_APP_HOME="$app"
herdr-app do layout.switch '{"name":"main"}' >/dev/null
rm -f "$app/layouts/$layout.json" "$app/layouts/$layout.png"
