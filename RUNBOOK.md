# Runbook

What to do when you need to run Quantinity, back it up, or fix it. Written for
one person running this for their own client work.

Everything here is a double-click on a `.command` file in this folder, or one
line in Terminal from this folder.

---

## Daily use

**You do not need anything running to use Quantinity.** The app lives inside the
Twenty container, which starts with Docker. Open <http://localhost:2020>.

## After you change the code

```
./apply.command
```

Builds, syncs once, exits. Takes about thirty seconds.

It passes `--no-delete` on purpose: `apply` otherwise offers to delete any
object or field no longer in the source, and **a deleted object takes its
records with it**. If you genuinely mean to remove something:

```
npm run quantinity -- apply --force
```

and read what it lists before confirming.

## While you are actively developing

```
./start-quantinity.command
```

Runs the file watcher, so every save syncs automatically. Leave the window open.

**It will die roughly hourly** with `FATAL ERROR: Ineffective mark-compacts near
heap limit`. That is a memory leak in Twenty's CLI, not in this app. The script
restarts it by itself; you will see `watcher exited after NNNNs - restarting`.
If it dies three times in under thirty seconds it stops and says so, because
that is not a leak, it is something actually broken.

If your edits stop reaching the app, the watcher is dead. That is the symptom.

---

## Backups

### Take one, and prove it works

```
./backup-rehearsal.command
```

Dumps the database to `backups/`, restores that dump into a **throwaway**
container, prints row counts before and after, and deletes the throwaway. Your
live database is only ever read.

**Compare the two row counts.** If they do not match, you do not have a backup,
you have a file.

### Where they go, and what that does not protect you from

`quantinity-crm/backups/`, on this Mac.

That survives: a bad `docker volume rm`, a corrupted container, deleting
records by accident, a failed upgrade.

That does **not** survive: this laptop dying, being stolen, or the disk failing.
Everything is on one machine. If that matters to you, copy `backups/` somewhere
else — another drive, a cloud folder — on a schedule you will actually keep.

### Restore for real

The rehearsal restores into a scratch container. Restoring over your live
database is deliberately not a script, because it is not something to do by
accident. When you need it:

1. Stop using the app.
2. `docker ps` — find the `twentycrm/twenty` container.
3. Take a fresh dump first, even of the broken state. You can always throw it
   away; you cannot get back what you overwrote.
4. `gunzip -c backups/<file>.sql.gz | docker exec -i <container> psql -U <user> -d <db>`
5. Restart the container and check a quotation you recognise.

The user, database name and password come from `PG_DATABASE_URL` inside the
container — `backup-rehearsal.command` prints them when it runs.

---

## When something is wrong

**The app will not load.** Is Docker Desktop running? Then
`npm run quantinity -- docker:status` and `npm run quantinity -- docker:logs`.

**My code changes are not showing up.** Run `./apply.command`. If you were
relying on the watcher, it has died — see above.

**A quotation or invoice refuses to issue.** That is deliberate, and the message
says which reason. The common ones: the quote is not a DRAFT (it was already
issued); there is nobody to bill (no deal attached, or the deal has no company);
a line item has no description; you are marked tax-registered, which invoices
cannot handle yet.

**A client says their link shows an error.** Check `publicBaseUrl` in Billing
settings. Empty means links are built from the request, which is right locally
and wrong once this is behind a domain.

**Document numbering jumped.** Should not happen any more — a refused issue no
longer consumes a number. If it does, the number is in
`backup-rehearsal.command`'s output and the Billing screen lets you set the next
one forward.

**Nothing arrives on WhatsApp.** Expected. Meta cannot reach `localhost`. See
`HARDENING.md`.

---

## After a reboot

**Open Docker Desktop.** That is the whole procedure.

Quantinity's container is set to `restart unless-stopped`, so it comes back by
itself as soon as Docker is running — you do not need to find it in the list and
press play. Give it a few seconds, then open <http://localhost:2020>.

Docker Desktop is deliberately **not** set to start at login. It is heavy on RAM
and battery, and starting it automatically would also give every other project's
containers a chance to come back. The trade is one manual step after a reboot,
which is the right way round for a laptop.

If you ever change your mind: Docker Desktop → Settings → General → "Start
Docker Desktop when you sign in".

`make-durable.command` sets the restart policy and reports what it found. It has
been run, and the policy is in place.

### If localhost:2020 is dead

Nine times out of ten: Docker Desktop is not running. Open it, wait, try again.

---

## Before you trust this with real client work

- [ ] Run `backup-rehearsal.command` and compare the row counts
- [ ] Copy `backups/` somewhere off this laptop
- [ ] Run `make-durable.command`, reboot, confirm the app comes back
- [ ] Clear the test records (see HARDENING.md) before real ones mix in
- [ ] Decide where document numbering restarts, in Billing settings
- [ ] Run `npm test` and `npm run lint` yourself — see HARDENING.md for why
