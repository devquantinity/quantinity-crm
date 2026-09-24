#!/usr/bin/env bash
#
# Quantinity web app - Vercel build command (project Root Directory: deploy/web).
#
# Builds the CRM engine's frontend (Twenty's twenty-front) at the version in
# deploy/TWENTY_VERSION - the same pin the API VM builds from, so the two can
# never drift apart - and leaves the static site in ./dist, which Vercel serves.
#
# No server URL is baked in. The app calls the API on its own origin
# (window.location.origin), and the proxy on the API VM routes API paths there.

set -euo pipefail

VERSION="$(tr -d '[:space:]' < ../TWENTY_VERSION)"
SRC=".twenty-src"

echo "Building web app for engine $VERSION ..."
rm -rf "$SRC" dist
# Only the packages the frontend needs, as the engine's Dockerfile copies them.
git clone --quiet --depth 1 --filter=blob:none --sparse --branch "twenty/$VERSION" https://github.com/twentyhq/twenty.git "$SRC"
git -C "$SRC" sparse-checkout set .yarn \
  packages/twenty-front packages/twenty-front-component-renderer packages/twenty-ui \
  packages/twenty-shared packages/twenty-sdk packages/twenty-client-sdk
cd "$SRC"

export NX_DAEMON=false NX_NO_CLOUD=true
yarn() { node "$PWD"/.yarn/releases/yarn-*.cjs "$@"; }

# Same steps as the engine's own Dockerfile (twenty-front-build stage).
yarn workspaces focus twenty twenty-front twenty-front-component-renderer twenty-ui twenty-shared twenty-sdk twenty-client-sdk
yarn nx run twenty-front:lingui:extract
yarn nx run twenty-front:lingui:compile
# Upstream uses 8192 in an unconstrained Docker build. Vercel's standard build
# machine has 8 GB in total, so leave the OS some room. If the build is killed
# for memory, move the project to an Enhanced build machine.
NODE_OPTIONS="--max-old-space-size=${WEB_BUILD_HEAP_MB:-6144}" yarn nx build twenty-front

cd ..
mv "$SRC/packages/twenty-front/build" dist
echo "Build complete: dist/"
