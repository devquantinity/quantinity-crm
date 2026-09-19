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
docker exec -e PGPASSWORD="$PGPASS" "$APP" psql -U "$PGUSER" -h "$PGHOST" -p "$PGPORT" -d "$PGDB" -Atc "
  select n.nspname||'.'||c.relname||' rows='||
    (xpath('/row/c/text()', query_to_xml('select count(*) as c from '||
      quote_ident(n.nspname)||'.'||quote_ident(c.relname), false, true, '')))[1]::text::int
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where c.relkind='r' and n.nspname like 'workspace%'
    and c.relname in ('quote','quoteItem','invoice','project','milestone','product','conversation','chatMessage')
  order by 1;"

echo "--- dumping ---"
DUMP="$OUT/quantinity-$STAMP.sql.gz"
docker exec -e PGPASSWORD="$PGPASS" "$APP" pg_dump -U "$PGUSER" -h "$PGHOST" -p "$PGPORT" -d "$PGDB" --clean --if-exists \
  | gzip > "$DUMP" || { echo "FAIL: dump failed"; rm -f "$DUMP"; read "?Press return."; exit 1; }
echo "wrote $DUMP ($(du -h "$DUMP" | cut -f1))"

echo "--- restoring into a THROWAWAY container (live db untouched) ---"
SCRATCH="quantinity-restore-test-$$"
docker run -d --name "$SCRATCH" -e POSTGRES_PASSWORD=rehearsal -e POSTGRES_USER="$PGUSER" \
  -e POSTGRES_DB="$PGDB" postgres:16-alpine >/dev/null
for i in $(seq 1 45); do docker exec "$SCRATCH" pg_isready -U "$PGUSER" >/dev/null 2>&1 && break; sleep 2; done
gunzip -c "$DUMP" | docker exec -i -e PGPASSWORD=rehearsal "$SCRATCH" psql -U "$PGUSER" -d "$PGDB" -v ON_ERROR_STOP=0 >/dev/null 2>&1

echo "--- did it come back? ---"
docker exec -e PGPASSWORD=rehearsal "$SCRATCH" psql -U "$PGUSER" -d "$PGDB" -Atc "
  select n.nspname||'.'||c.relname||' rows='||
    (xpath('/row/c/text()', query_to_xml('select count(*) as c from '||
      quote_ident(n.nspname)||'.'||quote_ident(c.relname), false, true, '')))[1]::text::int
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where c.relkind='r' and n.nspname like 'workspace%'
    and c.relname in ('quote','quoteItem','invoice','project','milestone','product','conversation','chatMessage')
  order by 1;"

docker rm -f "$SCRATCH" >/dev/null 2>&1
echo "=== done $(date) ==="
echo "Compare the two row counts above. They should match."
read "?Press return to close."
