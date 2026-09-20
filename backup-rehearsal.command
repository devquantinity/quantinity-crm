#!/bin/zsh -l
#
# Backup rehearsal for Quantinity / Twenty. Double-click, leave it, close when done.
#
# It backs up ONLY the Twenty container. If it cannot find Twenty it stops -
# an earlier version fell back to "any container with postgres in the name" and
# dumped an unrelated database. It will never do that again.
#
# Your live database is only ever READ.

HERE="${0:A:h}"
LOG="$HERE/backup-rehearsal.log"
OUT="$HERE/backups"
STAMP=$(date +%Y%m%d-%H%M%S)

mkdir -p "$OUT"
exec > >(tee "$LOG") 2>&1
echo "=== backup rehearsal $(date) ==="

command -v docker >/dev/null || { echo "FAIL: no docker."; read "?Press return."; exit 1; }

# Twenty only. Matched on the image, not on a name containing "postgres".
APP=$(docker ps --format '{{.Names}}\t{{.Image}}' | grep -i 'twentycrm/twenty' | head -1 | cut -f1)
[ -z "$APP" ] && { echo "FAIL: no running twentycrm/twenty container. Start Quantinity first."; read "?Press return."; exit 1; }
echo "twenty container: $APP"

echo "--- where does Twenty keep its data? ---"
URL=$(docker exec "$APP" sh -c 'echo $PG_DATABASE_URL' 2>/dev/null)
echo "PG_DATABASE_URL present: $([ -n "$URL" ] && echo yes || echo no)"
docker exec "$APP" sh -c 'command -v pg_dump && command -v psql' 2>/dev/null || echo "(no pg client inside the container)"

# Parse postgres://user:pass@host:port/db
PGUSER=$(echo "$URL" | sed -n 's#.*://\([^:]*\):.*#\1#p')
PGPASS=$(echo "$URL" | sed -n 's#.*://[^:]*:\([^@]*\)@.*#\1#p')
PGHOST=$(echo "$URL" | sed -n 's#.*@\([^:/]*\).*#\1#p')
PGPORT=$(echo "$URL" | sed -n 's#.*@[^:]*:\([0-9]*\).*#\1#p')
PGDB=$(echo   "$URL" | sed -n 's#.*/\([^/?]*\)$#\1#p')
[ -z "$PGUSER" ] && PGUSER=postgres
[ -z "$PGHOST" ] && PGHOST=localhost
[ -z "$PGPORT" ] && PGPORT=5432
[ -z "$PGDB" ] && PGDB=default
echo "user=$PGUSER host=$PGHOST port=$PGPORT db=$PGDB"

echo "--- is this really Twenty? ---"
FOUND=$(docker exec -e PGPASSWORD="$PGPASS" "$APP" psql -U "$PGUSER" -h "$PGHOST" -p "$PGPORT" -d "$PGDB" -Atc \
  "select count(*) from information_schema.schemata where schema_name like 'workspace%';" 2>&1)
echo "workspace schemas found: $FOUND"

case "$FOUND" in
  ''|*[!0-9]*) echo "FAIL: could not query Twenty's database. Nothing was dumped."; echo "$FOUND"; read "?Press return."; exit 1;;
esac
[ "$FOUND" -lt 1 ] && { echo "FAIL: no workspace schemas - this is not Twenty's data. Nothing was dumped."; read "?Press return."; exit 1; }

echo "--- what is in there ---"
count_rows() {
  # $1 container, $2 password, $3 host, $4 port. Lists every non-empty table in
  # the workspace schema with its row count.
  #
  # The host and port are NOT optional. Without them psql goes to a unix socket,
  # which exists in the stock postgres image and does not in Twenty's - so the
  # scratch side worked, the live side errored, and the verdict compared an
  # error message against real numbers.
  docker exec -e PGPASSWORD="$2" "$1" psql -U "$PGUSER" -h "$3" -p "$4" -d "$PGDB" -Atc "
    select c.relname||' = '||
      (xpath('/row/c/text()', query_to_xml(
        format('select count(*) as c from %I.%I', n.nspname, c.relname),
        false, true, '')))[1]::text::int
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where c.relkind='r' and n.nspname like 'workspace%'
    order by 1;" 2>&1 | grep -v ' = 0$' | sort
}

count_rows "$APP" "$PGPASS" "$PGHOST" "$PGPORT" > "$HERE/.rows-before.txt"
echo "tables with rows, before: $(wc -l < "$HERE/.rows-before.txt" | tr -d ' ')"
head -20 "$HERE/.rows-before.txt"

echo "--- dumping ---"
DUMP="$OUT/quantinity-$STAMP.sql.gz"
docker exec -e PGPASSWORD="$PGPASS" "$APP" pg_dump -U "$PGUSER" -h "$PGHOST" -p "$PGPORT" -d "$PGDB" --clean --if-exists \
  | gzip > "$DUMP" || { echo "FAIL: dump failed"; rm -f "$DUMP"; read "?Press return."; exit 1; }
echo "wrote $DUMP ($(du -h "$DUMP" | cut -f1))"

echo "--- restoring into a THROWAWAY container (live db untouched) ---"
SCRATCH="quantinity-restore-test-$$"
PGVER=$(docker exec -e PGPASSWORD="$PGPASS" "$APP" psql -U "$PGUSER" -h "$PGHOST" -p "$PGPORT" -d "$PGDB" -Atc "show server_version_num;" 2>/dev/null)
# server_version_num is major*10000 + minor: 180006 is Postgres 18.
# The first version of this used a >= threshold and put an 18 dump into a 17
# container. It happened to work. Restoring a newer dump into an older server
# is not something to leave to luck - newer pg_dump emits syntax the older psql
# does not know, and the failure is partial and quiet.
PGMAJOR=$(( ${PGVER:-0} / 10000 ))
[ "$PGMAJOR" -lt 13 ] && PGMAJOR=16
IMG="postgres:${PGMAJOR}-alpine"
echo "scratch image: $IMG (live server_version_num=${PGVER:-unknown}, major $PGMAJOR)"

docker run -d --name "$SCRATCH" -e POSTGRES_PASSWORD=rehearsal -e POSTGRES_USER="$PGUSER" \
  -e POSTGRES_DB="$PGDB" "$IMG" || { echo "FAIL: could not start the scratch container."; read "?Press return."; exit 1; }

echo -n "waiting for it to accept connections"
READY=no
for i in $(seq 1 60); do
  if docker exec "$SCRATCH" pg_isready -U "$PGUSER" >/dev/null 2>&1; then READY=yes; break; fi
  echo -n "."
  sleep 2
done
echo ""
if [ "$READY" != "yes" ]; then
  echo "FAIL: the scratch container never came up, so nothing was restored and nothing was verified."
  docker logs --tail 20 "$SCRATCH"
  docker rm -f "$SCRATCH" >/dev/null 2>&1
  read "?Press return."; exit 1
fi

echo "restoring (errors below, if any)..."
gunzip -c "$DUMP" | docker exec -i -e PGPASSWORD=rehearsal "$SCRATCH" \
  psql -U "$PGUSER" -d "$PGDB" -v ON_ERROR_STOP=0 2>&1 \
  | grep -iE '^ERROR|^FATAL' | sort | uniq -c | sort -rn | head -10
echo "(role/ownership errors are expected and harmless - the scratch container has different roles)"

echo ""
echo "--- did it come back? ---"
count_rows "$SCRATCH" rehearsal localhost 5432 > "$HERE/.rows-after.txt"
echo "tables with rows, after:  $(wc -l < "$HERE/.rows-after.txt" | tr -d ' ')"
head -20 "$HERE/.rows-after.txt"

docker rm -f "$SCRATCH" >/dev/null 2>&1

echo ""
echo "=================== VERDICT ==================="
if grep -qiE '^psql: error|could not connect|is the server running' "$HERE/.rows-before.txt"; then
  echo "INCONCLUSIVE: could not read the live database, so there was nothing to"
  echo "compare against. This says nothing about the backup either way."
  cat "$HERE/.rows-before.txt"
elif [ ! -s "$HERE/.rows-before.txt" ]; then
  echo "INCONCLUSIVE: the live database reported no tables with rows."
  echo "Nothing was compared. Do not rely on this backup."
elif diff -q "$HERE/.rows-before.txt" "$HERE/.rows-after.txt" >/dev/null 2>&1; then
  echo "PASS - every table came back with exactly the same number of rows."
  echo "This backup restores. $(wc -l < "$HERE/.rows-before.txt" | tr -d ' ') tables checked."
else
  echo "FAIL - the restore does not match the original. Differences:"
  diff "$HERE/.rows-before.txt" "$HERE/.rows-after.txt" | head -25
  echo ""
  echo "Do not rely on this backup until this matches."
fi
echo "==============================================="
# Keep the last 30. At ~1.3MB each that is under 40MB, and a folder that only
# ever grows is a folder someone eventually clears out in a hurry, on the day
# they most need what was in it.
KEPT=$(ls -1t "$OUT"/quantinity-*.sql.gz 2>/dev/null | wc -l | tr -d ' ')
if [ "$KEPT" -gt 30 ]; then
  ls -1t "$OUT"/quantinity-*.sql.gz | tail -n +31 | while read -r old; do
    rm -f "$old" && echo "removed old backup: $(basename "$old")"
  done
fi
echo "backups kept: $(ls -1 "$OUT"/quantinity-*.sql.gz 2>/dev/null | wc -l | tr -d ' ')"

echo ""
echo "Backup: $DUMP"
echo "Log:    $LOG"
read "?Press return to close."
