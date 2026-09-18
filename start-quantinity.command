#!/bin/zsh -l
#
# Quantinity CRM dev. Double-click once and leave the window open.
#
# Starts the Twenty server if it is down, then the app watcher - and brings
# the watcher back up on its own when it dies. The watcher leaks memory and
# crashes with "JavaScript heap out of memory" after a while; the symptom is
# that your edits silently stop reaching the app. This loop turns that from
# something you notice an hour later into a few seconds of downtime.
#
# Ctrl+C twice stops everything. Delete this file whenever you like.

# Works out where it lives, so the repo can be moved or cloned anywhere.
APP_DIR="${0:A:h}"
LOG="$APP_DIR/quantinity-dev.log"

find_watcher() {
  ps ax -o pid=,command= | awk -v dir="$APP_DIR" '
    index($0, dir "/node_modules") && /twenty/ && / dev( |$)/ \
    && !/Cursor/ && !/Code Helper/ && !/Electron/ && !/Helper/ && !/[a]wk/ {print $1}'
}

server_up() {
  curl -sf -o /dev/null --max-time 3 http://localhost:2020/healthz 2>/dev/null \
    || curl -sf -o /dev/null --max-time 3 http://localhost:2020 2>/dev/null
}

say() { echo "$@"; echo "[$(date '+%H:%M:%S')] $@" >> "$LOG"; }

cd "$APP_DIR" || { echo "cannot cd to $APP_DIR"; read "?Press return to close."; exit 1; }

echo "=============== $(date) ===============" >> "$LOG"
say "node $(node -v 2>&1), npm $(npm -v 2>&1)"
say "repo $APP_DIR"

PIDS=$(find_watcher)
if [ -n "$PIDS" ]; then
  say "stopping an existing watcher ($PIDS)"
  kill $PIDS 2>>"$LOG"; sleep 3
  STILL=$(find_watcher); [ -n "$STILL" ] && { kill -9 $STILL 2>>"$LOG"; sleep 1; }
fi

if server_up; then
  say "Twenty server is up"
else
  say "Twenty server is down - starting it, this can take a minute"
  npm run quantinity -- docker:start 2>&1 | tee -a "$LOG"
  for i in $(seq 1 60); do server_up && break; sleep 5; done
  if server_up; then
    say "server is up"
  else
    say "server still not answering on http://localhost:2020"
    echo ""
    echo "Check Docker Desktop is running, then:"
    echo "  npm run quantinity -- docker:status"
    echo "  npm run quantinity -- docker:logs"
    echo ""
    read "?Press return to close."
    exit 1
  fi
fi

echo ""
say "starting the watcher - it will be restarted automatically if it dies"
echo ""

quick_failures=0
while true; do
  started=$(date +%s)
  npm run dev 2>&1 | tee -a "$LOG"
  ran=$(( $(date +%s) - started ))

  if [ "$ran" -lt 30 ]; then
    quick_failures=$(( quick_failures + 1 ))
  else
    quick_failures=0
  fi

  if [ "$quick_failures" -ge 3 ]; then
    echo ""
    say "the watcher exited three times in under 30 seconds - not a crash, something is wrong"
    echo "The last of it is above, and in:"
    echo "  $LOG"
    echo ""
    read "?Press return to close."
    exit 1
  fi

  echo ""
  say "watcher exited after ${ran}s - restarting in 3s (Ctrl+C now to stop for good)"
  echo ""
  sleep 3
done
