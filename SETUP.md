# Setup

Quantinity CRM is a Twenty app: Twenty supplies the CRM, this repo supplies
quotations, projects, milestones and invoices on top of it.

## Prerequisites

- **Node 24.** Not 23 — that release breaks `npm install` with a
  `Cannot read properties of null (reading 'edgesOut')` error.
  `brew install node@24 && brew link --overwrite node@24`.
- npm (this project uses npm, not Yarn — there is no `packageManager` field
  and there should not be one, or Corepack will force Yarn 1 on you).
- Docker Desktop, running. The Twenty server runs in it.

## Steps

1. Install dependencies:

   ```bash
   npm install
   ```

   If esbuild's postinstall is blocked:
   `npm install-scripts approve esbuild && npm rebuild esbuild`.

2. Start the local Twenty server:

   ```bash
   npm run quantinity -- docker:start
   ```

   `docker:status` and `docker:logs` are the ones to reach for when it will
   not come up.

3. Build the app and sync it into the server:

   ```bash
   ./apply.command
   ```

   One shot, then it exits. This is all you need to USE Quantinity - the app
   lives in the container afterwards and keeps working.

   While you are actively editing, run the watcher instead, which rebuilds on
   every save:

   ```bash
   ./start-quantinity.command
   ```

4. Open [http://localhost:2020](http://localhost:2020) and log in with the
   default development credentials: `tim@apple.dev` / `tim@apple.dev`.

5. Make it survive a reboot, once:

   ```bash
   ./make-durable.command
   ```

6. Take a backup and prove it restores, before any real client work:

   ```bash
   ./backup-rehearsal.command
   ```

   See [RUNBOOK.md](RUNBOOK.md) for both of these.

## Things that will bite you

- **The watcher runs out of memory.** After roughly half an hour to an hour of
  continuous rebuilding it dies with `JavaScript heap out of memory` — the
  symptom is that your edits silently stop reaching the app. The leak is inside
  Twenty's CLI, not this app, so if changes stop appearing, check the watcher is
  alive before doubting your code. `start-quantinity.command` restarts it
  automatically and gives it an 8GB heap.

  The better answer is not to run it: `./apply.command` does a one-shot sync and
  exits, and there is nothing left running to leak.
- **The quotation and invoice sequences only move forward.** Issuing a document
  while testing burns a number permanently. That is deliberate — two documents
  must never share a number — but it means the counters drift during
  development. A *refused* issue no longer consumes one; that was a bug, and it
  is fixed. Set the next number in Settings → Billing before real client work.

- **`npm test` and `npm run lint` need macOS.** Both pull in native binaries
  built for darwin-arm64, so they do not run inside a Linux sandbox. Run them
  here.

## Verifying

- `npm run lint` — oxlint
- `npm run typecheck` — type-check
- `npm run test:unit` — unit tests, no server needed
- `npm test` — integration tests, needs the server up

## Operating it

[RUNBOOK.md](RUNBOOK.md) — backups, restores, what breaks and what to do.
[HARDENING.md](HARDENING.md) — what has been verified, and what has not.

## Reference

[Twenty app docs](https://docs.twenty.com/developers/extend/apps/getting-started/troubleshooting)
· [Discord](https://discord.gg/cx5n4Jzs57)
