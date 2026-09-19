# Hardening pass

Running note, written as I go. The honest list of what is still missing is at
the bottom and is the most useful part of this file.

## Where things stand

| # | Item | State |
|---|------|-------|
| 1 | Backups | **Blocked** - script ready, needs one run on the Mac |
| 2 | Run it properly | done, reboot unverified |
| 3 | Double-submit | code done, verifying |
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


## 2. Run it properly - done

The watcher was never how you run this. `twenty dev` watches files - a
development tool. The app lives in the Twenty container and keeps serving after
the watcher exits, so the OOM never had to matter for using Quantinity.

- `apply.command` - build, sync once, exit. Nothing left running to leak.
  Passes `--no-delete`, because `apply` otherwise offers to delete objects
  missing from source, and a deleted object takes its records with it.
- `make-durable.command` - sets the container to `restart unless-stopped` and
  reports what it found, including whether Docker Desktop starts at login.
- `start-quantinity.command` stays, for actually developing.

**Not verified:** I cannot reboot the machine or reach Docker from here.
"Survives a reboot" is reasoned, not observed. Run `make-durable.command`, then
reboot and open localhost:2020 to confirm it.

## 3. Double-submit

### A real bug, found on the way

`issue-quote` took the document number at line 162 and only checked there was
somebody to bill at line 199. A quotation with no client attached therefore
consumed a number and *then* refused - leaving a hole in the sequence with no
document to explain it. `issue-invoice` had the two the right way round.

The number is now taken last, after every check that can still refuse.

### What was already there

All four already refused a *sequential* second attempt: a quote that is ISSUED
is no longer DRAFT, and the guard returns 409. That part was never broken.

### What was missing

Nothing stopped a second attempt that arrived *while the first was still in the
air* - at that moment the record still reads DRAFT to both. Two layers added:

1. `src/lib/in-flight.ts` - one action, one record, one attempt at a time,
   before the request leaves the browser. Module scope, because a headless
   command remounts every time it runs. Released in a `finally`, so a failed
   issue stays retryable rather than wedging the button shut.
2. A re-read of the record immediately before the irreversible write, in
   `issue-quote`, `issue-invoice` and `create-project-from-opportunity`. Each
   does slow work between its first check and its write - the company is a
   separate round trip on purpose - and that is a long time to act on a stale
   snapshot.

`mark-invoice-paid` reads, checks and writes with nothing in between, so there
is no window worth a second round trip.

### What is still open

**This is not a lock.** Two requests that pass the re-check in the same instant
will both proceed. Closing that needs a conditional update - "set status to
ISSUED only if it is still DRAFT" - which the API does not offer. The honest
description is that the realistic window went from hundreds of milliseconds to
approximately none, not that it is zero.

For one person this is comfortably enough. If a second person ever issues
documents here, it needs a real claim: a token written to the record and read
back before proceeding, which costs two extra round trips and a field on each
object.
