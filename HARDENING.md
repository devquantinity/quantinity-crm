# Hardening pass

Running note, written as I go. The honest list of what is still missing is at
the bottom and is the most useful part of this file.

## Where things stand

| # | Item | State |
|---|------|-------|
| 1 | Backups | **Blocked** - script ready, needs one run on the Mac |
| 2 | Run it properly | in progress |
| 3 | Double-submit | not started |
| 4 | Route tests | not started |
| 5 | Unit test audit | not started |
| 6 | Docs | this file |

## 1. Backups - blocked

`backup-rehearsal.command` dumps Twenty's database, restores it into a
throwaway container, and prints row counts before and after so they can be
compared. It has not been run in its current form yet.

It cannot be run from here: the shell I get on the Mac is an isolated VM with
only the connected folders mounted. No Docker, no `psql`, and no route to
`localhost:2020`. So a human double-click is the only way this gets verified,
and until it is, **there is no working backup.**

### The first version dumped the wrong database

It picked its target by matching "postgres" in the container name, which on this
machine is `c360p-postgres-1` - an unrelated work project - not Twenty, whose
dev image bundles Postgres inside `twenty-app-dev`. It wrote a dump of that
database into this repo's folder before anyone noticed.

Nothing was modified: `pg_dump` and a `SELECT` against `information_schema` are
both read-only, and the restore went into a fresh throwaway container. The dump
was gitignored before it existed, never committed, never left the machine, and
has been deleted.

The rewrite matches on the `twentycrm/twenty` image, checks for `workspace%`
schemas, and dumps nothing at all if that check fails.

The lesson is the design, not the regex: a discovery step should report what it
found and stop. That one discovered and acted in the same breath, against a
machine it had never enumerated.
