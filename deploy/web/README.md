# deploy/web - the web app on Vercel

Vercel builds the CRM engine's frontend from this folder of this repo
(`devquantinity/quantinity-crm`). There is no source of ours in it yet: it
clones the engine at the version in `deploy/TWENTY_VERSION`, the same pin the
API VM builds from, so frontend and server are always the same version. The
day the frontend is forked (rebranding, path tenancy), the fork replaces the
clone in `build.sh`. Read ARCHITECTURE.md and the AGPL note in DEPLOYMENT.md
section 0 before that day.

## Vercel project

- Import `devquantinity/quantinity-crm`.
- **Root Directory: `deploy/web`.** Leave "Include files outside the root
  directory in the Build Step" **on** - `build.sh` reads `../TWENTY_VERSION`.
- Framework preset: **Other**. `vercel.json` sets the build command, output
  and SPA fallback.
- Node.js version: **24.x** (Settings → Build and Deployment).
- Environment variables: none. The app calls the API on its own origin.
- Domains: none. Keep only the default `<project>.vercel.app`; that hostname
  goes into `WEB_UPSTREAM` for Caddy on the API VM. Customers reach the app
  through `*.crm.quantinity.com`, which points at the API VM, never at Vercel.
- Deployment Protection: **off for production**, or Caddy gets Vercel's login
  page instead of the app.
- If the build is killed for memory, switch the project to an Enhanced build
  machine, or lower `WEB_BUILD_HEAP_MB` and redeploy.

Pushes that touch neither this folder nor `deploy/TWENTY_VERSION` - changes to
the app in `src/`, docs, the API scripts - skip the build (`ignoreCommand`),
so a normal commit does not cost a ten-minute frontend build.

## Upgrading

One commit bumps `deploy/TWENTY_VERSION`; it drives both sides. Vercel starts
building on push. Restart the API straight away so it migrates first:

```bash
systemctl restart quantinity-api      # on the API VM
```

Vercel's build takes longer than the API's, so the new frontend normally goes
live after the new server is up. Do it off-hours; for those few minutes the
two may be on different versions.
