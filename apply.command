#!/bin/zsh -l
#
# Deploy your code changes to Quantinity. Double-click, wait, close.
#
# This is the everyday command. It builds, syncs once, and exits.
#
# You do NOT need the watcher running to USE Quantinity. `start-quantinity.command`
# runs `twenty dev`, which watches for file changes - that is a development tool,
# it leaks memory, and it dies of heap exhaustion after roughly an hour. The app
# itself lives inside the Twenty container and keeps working after this exits.

HERE="${0:A:h}"
LOG="$HERE/quantinity-apply.log"
cd "$HERE" || exit 1

exec > >(tee -a "$LOG") 2>&1
echo ""
echo "=== apply $(date) ==="

server_up() {
  curl -sf -o /dev/null --max-time 3 http://localhost:2020/healthz 2>/dev/null \
    || curl -sf -o /dev/null --max-time 3 http://localhost:2020 2>/dev/null
}

if ! server_up; then
  echo "Twenty is not answering on http://localhost:2020 - starting it."
  npm run quantinity -- docker:start
  for i in $(seq 1 60); do server_up && break; sleep 5; done
  server_up || { echo "FAIL: still not up. Is Docker Desktop running?"; read "?Press return."; exit 1; }
fi
echo "server is up"

# One-shot build and sync, then exit. No watcher, so nothing to leak.
#
# --no-delete on purpose. Without it, `apply` offers to delete any object or
# field that is no longer in the source - which is correct for a deliberate
# refactor and catastrophic for a button you double-click without reading. A
# deleted object takes its records with it. If you ever really do mean to remove
# something, run it by hand:
#     npm run quantinity -- apply --force
npm run quantinity -- apply --no-delete
STATUS=$?

echo ""
if [ $STATUS -eq 0 ]; then
  echo "✓ applied. Quantinity is running at http://localhost:2020"
else
  echo "✗ apply failed (exit $STATUS). The output above says why."
fi
read "?Press return to close."
