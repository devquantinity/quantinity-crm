#!/usr/bin/env bash
#
# Quantinity API - pull, build, migrate, run.
#
# This is systemd's ExecStart (see quantinity-api.service), in the same shape
# as any other service on these VMs: pull the latest, build, then run in the
# foreground so systemd owns the process. To deploy: push, then
#
#   systemctl restart quantinity-api
#
# One build, two processes: the API server and the background-job worker.
# They run from the same build and live and die together - if either exits,
# both stop and systemd restarts the unit. The worker is not optional:
# without it, background jobs silently never run.
#
# The code being built is the CRM engine (Twenty), at the version pinned in
# deploy/TWENTY_VERSION, not this repo. This repo only supplies the pin and
# this script. Each version builds once into .build/releases/<version>; a
# restart with an unchanged pin skips straight to running. Bumping the pin is
# an engine upgrade, and database migrations run on the next start - read
# DEPLOYMENT.md section 6 before pushing one.
#
# Secrets come from $QUANTINITY_ENV_FILE (default /etc/quantinity/api.env),
# never from the repo. Template: deploy/env.example.

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"
ENV_FILE="${QUANTINITY_ENV_FILE:-/etc/quantinity/api.env}"
RELEASES="$REPO/.build/releases"
TWENTY_GIT="https://github.com/twentyhq/twenty.git"

log() { echo "[$(date -u +%FT%TZ)] $*"; }

# --- pull -------------------------------------------------------------------

# Whatever branch the server's checkout is on.
log "Pulling latest changes ..."
cd "$REPO"
before="$(git rev-parse HEAD)"
git pull || log "WARNING: git pull failed, continuing with the checkout on disk"

# bash keeps running the copy of this script it started with, so a pull that
# changed it would otherwise only take effect on the next restart.
if [ "$(git rev-parse HEAD)" != "$before" ] && [ -z "${QUANTINITY_REEXEC:-}" ]; then
  log "New commits pulled, restarting with the updated script"
  QUANTINITY_REEXEC=1 exec bash "$HERE/build.sh"
fi

# --- environment ------------------------------------------------------------

if [ ! -r "$ENV_FILE" ]; then
  log "ERROR: $ENV_FILE is missing or unreadable. Copy deploy/env.example there and fill it in."
  exit 1
fi
set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a

VERSION="$(tr -d '[:space:]' < "$REPO/deploy/TWENTY_VERSION")"
export APP_VERSION="${VERSION#v}"
export NODE_ENV=production
export NX_DAEMON=false NX_NO_CLOUD=true NX_SKIP_NX_CACHE=true

RELEASE="$RELEASES/$VERSION"
CURRENT="$RELEASES/current"

# Yarn comes from the engine's own checkout (.yarnrc.yml yarnPath), so the
# VM needs Node and nothing else.
yarn() { node "$PWD"/.yarn/releases/yarn-*.cjs "$@"; }

# --- build ------------------------------------------------------------------

build_release() {
  local tmp="$RELEASE.partial"

  log "Building engine $VERSION ..."
  rm -rf "$tmp"
  # Only the packages the server needs, as the engine's Dockerfile copies
  # them. With the whole monorepo checked out, nx also builds the frontend
  # packages, whose dependencies the focused install below never installs.
  git clone --quiet --depth 1 --filter=blob:none --sparse --branch "twenty/$VERSION" "$TWENTY_GIT" "$tmp"
  git -C "$tmp" sparse-checkout set .yarn \
    packages/twenty-server packages/twenty-emails packages/twenty-shared packages/twenty-client-sdk

  (
    # Wherever yarn is called from, $PWD must be the checkout root.
    cd "$tmp"

    # Same steps as the engine's own Dockerfile (twenty-server target):
    # server only, no frontend - that is built and hosted on Vercel.
    yarn workspaces focus twenty twenty-server twenty-emails twenty-shared twenty-client-sdk
    yarn nx run twenty-server:lingui:extract
    yarn nx run twenty-server:lingui:compile
    yarn nx run twenty-emails:lingui:extract
    yarn nx run twenty-emails:lingui:compile
    NODE_OPTIONS="--max-old-space-size=4096" yarn nx run twenty-server:build
    rm -rf packages/twenty-server/dist/packages/twenty-server/test
  )

  rm -rf "$RELEASE"
  mv "$tmp" "$RELEASE"
  touch "$RELEASE/.built"
  ln -sfn "$RELEASE" "$CURRENT.new"
  mv -T "$CURRENT.new" "$CURRENT"
  log "Build complete: $VERSION"
}

mkdir -p "$RELEASES"
if [ -f "$RELEASE/.built" ]; then
  log "Engine $VERSION already built, skipping build"
  ln -sfn "$RELEASE" "$CURRENT.new" && mv -T "$CURRENT.new" "$CURRENT"
else
  # Subshell outside any if/||: bash ignores errexit in functions called from
  # a condition, which would mark a half-failed build as done.
  set +e
  ( set -e; build_release )
  build_status=$?
  set -e
fi

if [ "${build_status:-0}" -ne 0 ]; then
  if [ -e "$CURRENT/.built" ]; then
    log "ERROR: build of $VERSION FAILED. Still running the previous build: $(readlink "$CURRENT")"
  else
    log "ERROR: build of $VERSION FAILED and there is no previous build to run. Retrying in 5 minutes."
    # Without this, systemd restarts straight away into another full clone.
    sleep 300
    exit 1
  fi
fi

cd "$CURRENT"
log "Running engine $(basename "$(readlink "$CURRENT")") from $(readlink "$CURRENT")"

# --- migrate ----------------------------------------------------------------
#
# Mirrors the engine's container entrypoint: initialise an empty database,
# flush the cache, run upgrade commands, register cron jobs. Runs on every
# start, as it does upstream.

cd packages/twenty-server

if [ "${DISABLE_DB_MIGRATIONS:-}" = "true" ]; then
  log "Database migrations disabled, skipping"
else
  has_schema="$(psql -tAc "SELECT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'core')" "$PG_DATABASE_URL")"
  if [ "$has_schema" = "f" ]; then
    log "Database is empty, initialising ..."
    # = yarn database:init:prod
    node dist/database/scripts/setup-db.js
    node dist/command/command run-instance-commands --force --include-slow
  fi
  node dist/command/command cache:flush || log "WARNING: cache flush before upgrade failed, continuing"
  node dist/command/command upgrade || log "WARNING: upgrade finished with errors; some workspaces may not be fully migrated. Check the log above."
  node dist/command/command cache:flush || log "WARNING: cache flush after upgrade failed, continuing"
fi

if [ "${DISABLE_CRON_JOBS_REGISTRATION:-}" = "true" ]; then
  log "Cron job registration disabled, skipping"
else
  node dist/command/command cron:register:all || log "WARNING: cron job registration failed, continuing"
fi

# --- run --------------------------------------------------------------------

log "Starting worker and server ..."
node dist/queue-worker/queue-worker &
WORKER=$!
node dist/main &
SERVER=$!

stop_all() {
  kill -TERM "$WORKER" "$SERVER" 2>/dev/null || true
  wait "$WORKER" "$SERVER" 2>/dev/null || true
}
trap 'log "Stopping ..."; stop_all; exit 0' TERM INT

# Whichever exits first takes the other down with it; systemd restarts both.
set +e
wait -n "$WORKER" "$SERVER"
code=$?
set -e
if kill -0 "$SERVER" 2>/dev/null; then who=worker; else who=server; fi
log "ERROR: $who exited with code $code, stopping the other"
stop_all
exit "$(( code == 0 ? 1 : code ))"
