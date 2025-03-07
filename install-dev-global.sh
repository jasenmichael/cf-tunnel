#! /bin/bash

pnpm uninstall -g cf-tunnel >/dev/null 2>&1
npm uninstall -g cf-tunnel >/dev/null 2>&1

version=$(jq -r '.version' package.json)

cd "$(dirname "$0")" &&
  pnpm test &&
  pnpm build &&
  npm pack &&
  npm install -g "cf-tunnel-${version}.tgz"

# check that cf-tunnel -V equals version
if ! cf-tunnel -V | grep -q "${version}"; then
  echo "cf-tunnel could not be installed"
  exit 1
fi

echo "cf-tunnel version: \"$(cf-tunnel --version)\" installed successfully"
