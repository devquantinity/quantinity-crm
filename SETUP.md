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

3. Start the watcher, which builds the app and syncs it into the server:

   ```bash
   npm run dev
   ```

   Leave it running while you work. It rebuilds on save.

4. Open [http://localhost:2020](http://localhost:2020) and log in with the
   default development credentials: `tim@apple.dev` / `tim@apple.dev`.

## Things that will bite you

- **The watcher runs out of memory.** After roughly half an hour of
  continuous rebuilding it dies with `JavaScript heap out of memory` and
  takes `.twenty/output/` with it — the symptom is that your edits silently
  stop reaching the app. `npm run dev` asks for an 8GB heap to push that
  further out, but the leak is inside the CLI, so if the app stops picking
  up changes, check that the watcher is still alive before doubting your
  code. Stop it when you are not actively editing.
- **The quotation and invoice sequences only move forward.** Issuing a
  document while testing burns a number permanently. That is deliberate —
  two documents must never share a number — but it means the counters drift
  during development.

## Verifying

- `npm run lint` — oxlint
- `npm run typecheck` — type-check
- `npm run test:unit` — unit tests, no server needed
- `npm test` — integration tests, needs the server up

## Reference

[Twenty app docs](https://docs.twenty.com/developers/extend/apps/getting-started/troubleshooting)
· [Discord](https://discord.gg/cx5n4Jzs57)
