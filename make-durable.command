#!/bin/zsh -l
#
# Run this ONCE. It makes Quantinity come back by itself after a crash or a
# reboot, then reports what it actually found so the result can be checked
# rather than assumed.

HERE="${0:A:h}"
LOG="$HERE/make-durable.log"
exec > >(tee "$LOG") 2>&1
echo "=== make durable $(date) ==="

command -v docker >/dev/null || { echo "FAIL: no docker."; read "?Press return."; exit 1; }

APP=$(docker ps -a --format '{{.Names}}\t{{.Image}}' | grep -i 'twentycrm/twenty' | head -1 | cut -f1)
[ -z "$APP" ] && { echo "FAIL: no twentycrm/twenty container found."; read "?Press return."; exit 1; }
echo "twenty container: $APP"

echo ""
echo "--- before ---"
echo "restart policy: $(docker inspect --format '{{.HostConfig.RestartPolicy.Name}}' "$APP")"

# unless-stopped, not always: if you deliberately stop it, it stays stopped.
docker update --restart unless-stopped "$APP" >/dev/null 2>&1 \
  && echo "set restart policy to unless-stopped" \
  || echo "WARN: could not set the restart policy"

echo ""
echo "--- after ---"
echo "restart policy: $(docker inspect --format '{{.HostConfig.RestartPolicy.Name}}' "$APP")"
echo "running: $(docker inspect --format '{{.State.Running}}' "$APP")"

echo ""
echo "--- does Docker itself start at login? ---"
SETTINGS="$HOME/Library/Group Containers/group.com.docker/settings-store.json"
if [ -f "$SETTINGS" ]; then
  AUTO=$(grep -o '"OpenUIOnStartupDisabled"[^,]*\|"AutoStart"[^,]*\|"StartOnLogin"[^,]*' "$SETTINGS" 2>/dev/null | head -3)
  echo "${AUTO:-(no autostart key found in Docker settings)}"
else
  echo "(Docker settings file not found at the expected path)"
fi
echo ""
echo "If Docker Desktop does not start at login, the container cannot come back"
echo "after a reboot no matter what its restart policy says. Turn it on in:"
echo "  Docker Desktop > Settings > General > 'Start Docker Desktop when you sign in'"
echo ""
echo "=== done. To verify properly: reboot, then open http://localhost:2020 ==="
read "?Press return to close."
