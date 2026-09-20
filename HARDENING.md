# Hardening pass

Running note, written as I go. The honest list of what is still missing is at
the bottom and is the most useful part of this file.

## Where things stand

| # | Item | State |
|---|------|-------|
| 1 | Backups | **done - PASS, restore verified** |
| 2 | Run it properly | done - policy set, autostart off by choice |
| 3 | Double-submit | **done, verified in the app** |
| 4 | Route tests | done |
| 5 | Unit test audit | done |
| 6 | Docs | done |

## 1. Backups - done, and proven

`backup-rehearsal.command` dumps Twenty's database, restores it into a
throwaway container, and prints row counts before and after so they can be
compared. It has not been run in its current form yet.

It cannot be run from here: the shell I get on the Mac is an isolated VM with
only the connected folders mounted. No Docker, no `psql`, and no route to
`localhost:2020`. So a human double-click is the only way this gets verified.

### Run 2 (20 Sep): the dump is real, the check was broken

It found Twenty correctly this time - `twenty-app-dev`, `user=twenty db=default`,
one workspace schema - and wrote a 1.3 MB dump. Reading that file directly
confirms it holds the actual records: 6 quotes, 3 invoices, 2 conversations, and
the document numbers Q-0001 through Q-0052 and INV-0001 through INV-0004, across
113 `COPY` blocks.

But both row-count sections printed **nothing**, and the whole run finished in
five seconds - too fast for a Postgres container to boot and take a restore.

Two faults, and the first is the more dangerous:

1. **The count query filtered on guessed table names.** Twenty prefixes custom
   objects with an underscore: `_quote`, `_invoice`, `_chatMessage`. The query
   looked for `quote`, `invoice`, matched nothing, and printed nothing - which
   is indistinguishable from a clean pass. A check that cannot fail loudly is
   not a check. It now lists every non-empty table in the workspace schema and
   guesses at no names.
2. **The restore was silent.** `docker run` and the restore both sent output to
   `/dev/null`, so a scratch container that never started looked the same as one
   that restored perfectly. It now waits for `pg_isready`, fails loudly if the
   container does not come up, prints any restore errors, and matches the
   Postgres major version against the live server.

It ends with a **VERDICT** line now - PASS, FAIL with a diff, or INCONCLUSIVE -
rather than leaving two lists to be eyeballed.

### Run 3 (20 Sep): PASS

```
=================== VERDICT ===================
PASS - every table came back with exactly the same number of rows.
This backup restores. 34 tables checked.
===============================================
```

34 tables, identical counts on both sides, restored into a Postgres 18 container
matching the live server. `_quote = 6`, `_invoice = 3`, `_quoteItem = 15`,
`_conversation = 2`, `_milestone = 5` - the records, not just the schema.

Run 2 had failed on two more faults, both mine. `count_rows` dropped `-h` and
`-p`, so psql went to a unix socket that the stock postgres image has and
Twenty's does not: the scratch side found one, the live side did not, and the
verdict diffed an error message against real numbers. And the scratch image was
picked by a `>= 170000` threshold, which put an 18 dump into a 17 container -
it worked, which was luck.

It took three runs to get a backup, and every failure was in the checking rather
than the backing up. That is the part worth remembering: the dump was fine on
run 2, and the script said FAIL.

**This is now a real backup.** It rotates at 30 files (~40MB).

### What it still does not cover

Everything is on one laptop - see the list at the end of this file. Restoring
over the live database is deliberately manual; `RUNBOOK.md` has the steps.

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

### Run (20 Sep): the restart policy alone would not have been enough

```
restart policy: no  ->  unless-stopped
running: true
"AutoStart": false
```

The container now restarts unless deliberately stopped. But **Docker Desktop
does not start at login**, and a restart policy is only honoured by a running
Docker daemon - so after a reboot nothing would have come back, and the policy
would have looked correct the whole time.

This is why the script reports what it found instead of printing "done". The
setting is a checkbox: Docker Desktop > Settings > General > "Start Docker
Desktop when you sign in".

### The decision: autostart stays off

Deliberately left off. Docker Desktop is heavy on RAM and battery, and starting
it at login would also give every other project on this machine a chance to
bring its containers back.

So the procedure after a reboot is: open Docker Desktop. The `unless-stopped`
policy then brings Quantinity back without anything else being touched - one
manual step, not two, and the policy still earns its place.

**Not verified:** I cannot reboot the machine. The first reboot is the test:
open Docker Desktop, wait a few seconds, then open localhost:2020 without
pressing play on anything.

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

### Verified in the running app, not reasoned about

| Fired | Against | Result |
|-------|---------|--------|
| Issue quotation | a draft with no deal attached | 422, and **Q-0053 was still Q-0053 afterwards** |
| Issue quotation | Q-0051, already issued | `POST /s/quotes/issue` returned **409**, one request, not two |
| Issue invoice | INV-0003, already issued | "This invoice is issued, only a draft can be issued." |
| Mark paid | INV-0004, already paid | "INV-0004 is already marked paid" |
| Start project | a deal that already has one | no second project - All Projects still 3 |

The first row is the bug fix: before it, that refusal would have consumed Q-0053
on its way to failing.

### Re-checked after the refactors

Moving refusals out of four handlers and into shared guards is exactly the kind
of change that quietly breaks one of them, so the same records were fired at
again afterwards:

| After the refactor | Result |
|---|---|
| Issue INV-0003 (already issued) | still refuses, record untouched |
| Mark INV-0004 paid (already paid) | still refuses, `Paid at` still 17 Sep 21:23 |
| Withdraw Q-0052 (accepted) | still refuses, still Accepted, no new timeline entry |
| Open Q-0051's client link | renders correctly after the escapeHtml change |


## 4. Route tests - done

The handlers import `CoreApiClient` directly, so testing them as they stood
meant mocking a module, which my runner cannot do, or standing up a database
and putting a record into exactly the wrong state - which is why none of this
had ever been tested.

So the refusals moved out instead, into `src/lib/route-guards.ts` and
`src/lib/webhook-signature.ts`, and the handlers now call them. The refusals
are the part worth testing: a happy path announces itself the first time you
use the app, while a refusal that stops working is silent, and what it stops is
a client receiving a quotation addressed to nobody, or a second invoice for the
same money.

Covered: quote not found / not a draft / no lines / blank line descriptions;
invoice not found / not a draft / zero amount / **tax-registered underbilling**;
paid twice / paid before issued / paid after void; a deal getting a second
project; a required id missing. Plus the webhook signature - tampered body,
wrong secret, no secret, no raw body, malformed and truncated headers.

One test failed on the first run and it was the test's fault: I reimplemented
`lineLabel` in the test file rather than importing it, and my copy used `??`
where the real one trims and falls through. The test now imports the real
function. A reimplemented helper drifts from the thing it stands in for, and
then the test passes while the route does something else.

### What this does NOT cover

These are handler-level tests of the decisions, not HTTP tests of the routes.
Nothing here proves the route is wired to the right path, that auth is
required where it should be, or that the response shape is what the front
component expects. That needs a test runner that can reach the server, which
from my sandbox is not possible - no route to localhost:2020.


## 5. Unit test audit

Done by listing every export in `src/lib` and checking whether any test file
mentions it, rather than by reading the code and forming an impression.

### Written this pass, in order of what they protect

| Now covered | Why it mattered |
|---|---|
| `escapeHtml` | The XSS boundary on two **public, unauthenticated** client-facing pages |
| `commandErrorMessage` | Without it every refusal reads "failed with status 422" and the real explanation is discarded |
| `formatDocumentNumber` | Produces Q-0053. Padding is not cosmetic when an accountant reconciles |
| `formatMoney` | The number a client pays from |
| `lineAmountMicros` / `fromMicros` | Money arithmetic; floating-point dust is a cent that will not reconcile |
| `addDays` | Quotation validity across month, year and leap boundaries |
| route guards, webhook signature, in-flight | See sections 3 and 4 |

### A second escapeHtml, found while doing this

`public-quote-page.ts` carried its own inline copy, identical to the one in
`invoice-document.ts`. That is how a security fix gets applied to one page and
not the other, and nobody notices until the forgotten page is the one that
matters. Both now use `src/lib/html.ts`, which additionally escapes the single
quote - nothing puts a value inside a single-quoted attribute today, which is
exactly why it is cheap now and expensive later.

### Deliberately not covered, and why

- **Constants** (`MICROS`, `GRAPH_API_BASE`, `SERVICE_WINDOW_MS`): a test would
  restate the value.
- **`quote-settings.*`**: every function touches `kv`. Testing needs a mock the
  runner cannot provide. The sequence logic inside them is the risk, and it is
  documented as a known limitation rather than tested.
- **`whatsapp-config`, `transport`, `whatsapp-transport`**: read `process.env`
  and call `fetch`. The pure decisions they rely on - payload shapes, error
  extraction, status ordering - are covered in `whatsapp-cloud.test.ts`.
- **Display helpers** (`dayKey`, `timeLabel`, `dayLabel`, `displayHandle`):
  wrong output is visible immediately, on the screen, to the person using it.

### Still inline, ranked by what goes wrong

Thirteen routes held their refusals inline. The top three on the list are now
done:

- ~~`create-invoice-from-milestone`~~ - extracted and covered, including
  "already fully billed", which is what stops a client being billed twice for
  the same stage
- ~~`revise-quote`, `withdraw-quote`~~ - extracted and covered, including the
  refusal to silently withdraw a quotation a client has accepted

Remaining, in the order I would do them:

1. `public-quote-page`, `public-invoice-page` - client-facing, and the
   500-on-a-stale-link bug lived here once already
2. `save-quote-settings` - can corrupt the numbering for every future document
3. the rest - messaging and catalogue, where a bad refusal is an annoyance
   rather than a wrong number on an invoice


## 6. Docs - done

- `RUNBOOK.md` - run it, back it up, restore it, and what to do when something
  is wrong. Written for one person, as double-clicks.
- `SETUP.md` - updated. The watcher is no longer presented as how you run this.
- This file.

---

# What is still NOT production ready

Ordered by what would hurt most. The first three are not code.

### 1. There is still no working backup

The rehearsal script is written and its first version is deleted, but **it has
not been run in its fixed form**, so nothing has been dumped and nothing has
been restored. Until `backup-rehearsal.command` runs and its two row counts
match, a container problem loses every quotation and invoice.

I cannot run it: my shell on the Mac is an isolated VM with only the connected
folders mounted - no Docker, no `psql`, no route to localhost:2020.

### 2. Everything is on one laptop

Even once backups work, `backups/` sits on the same disk as the database. That
covers a bad `docker volume rm`; it does not cover the laptop dying or being
stolen. No off-machine copy was set up because the destination was never
decided.

### 3. This is running on a development image

The container is `twentycrm/twenty-app-dev:latest`. Two things follow: it is a
*dev* image, and `:latest` means the version underneath can change the next time
it is pulled. Neither is dangerous today; both are the kind of thing that is
obvious in hindsight after an upgrade eats an afternoon.

### 4. Reboot survival is written, not observed

`make-durable.command` sets the restart policy and reports what it found. I
could not reboot the machine, so "survives a reboot" is reasoning. Reboot and
open localhost:2020 to actually know.

### 5. WhatsApp cannot receive anything

Meta cannot reach `localhost`. Sending is wired and refuses honestly; inbound
needs a public HTTPS URL and the Meta credentials, both of which are yours.
Twenty's app settings already offer a custom domain for the `/s` routes.

### 6. Document numbers are not atomic

`kv` has no atomic increment, so two people issuing in the same instant could
read the same sequence. Irrelevant while you are the only person issuing.
Before anyone else does, this needs a real counter.

### 7. The issue path narrows the race, it does not close it

Two requests passing the pre-write re-check in the same instant both proceed.
Closing it needs a conditional update the API does not offer. See section 3.

### 8. SST is refused, not implemented

Ticking "tax registered" makes invoices refuse to issue (501) rather than
underbill. That is the safe behaviour and it is not a feature. Your decision.

### 9. Test records are mixed in with real ones

Quotes Q-0001, Q-0050, Q-0051, Q-0052 and a template copy; invoices INV-0002
to INV-0004; three projects with milestones; two products; two conversations
(one now attached to a real contact, Kathy Mcclain, by a test). Clear these
before real client data joins them. I cannot delete records.

### 10. Tests were verified by my runner, not by vitest

`npm test` and `npm run lint` use binaries built for macOS and do not run in my
sandbox. I ran every assertion through a minimal runner I wrote, and checked it
genuinely fails on a wrong expectation. That is honest but it is not the same
thing.

**And `npm test` did not run them either.** It was wired to `vitest.config.ts`,
which includes only `*.integration-test.ts` - so it ran 2 integration tests,
skipped all 230 unit tests, and reported a clean pass. Telling you to "run
`npm test` to verify" was advice that verified almost nothing.

`npm test` now runs both. `npm run test:unit` is the fast one that needs no
server; `npm run test:integration` needs the server **and redeploys the app as
a side effect**, which is worth knowing before running it mid-edit.

### Confirmed (20 Sep)

```
Test Files  14 passed (14)
     Tests  231 passed (231)      <- unit, real vitest
     Tests  2 passed (2)          <- integration
Found 0 warnings and 0 errors.    <- oxlint
```

**Vitest agrees with my runner on every test.** My testbed counted 230 and
vitest counts 231 - the extra is `application-config.test.ts`, which imports
from `constants/` rather than `lib/` and so was never copied into my testbed.
No disagreement about any test's result, which was the open question.

This item is closed.

### 11. No HTTP-level tests, and thirteen routes still untested

The tests cover decisions, not routes. Nothing proves a route is on the right
path, that auth is required where it should be, or that the response shape
matches what the front component expects. Thirteen routes still hold refusals
inline; section 5 ranks them.

### 12. Nothing watches it

If the container stops, you find out by opening the app. There is no alerting,
no uptime check, no log aggregation. For one person that is a reasonable
trade; it is worth knowing it is a trade.

### 13. The public pages have no rate limiting

`/s/quote` and `/s/invoice` are unauthenticated by design. The tokens are UUIDs,
so guessing one is not realistic, but nothing throttles attempts and nothing
logs them.
