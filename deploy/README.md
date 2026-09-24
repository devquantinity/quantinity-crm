# deploy/

Bare VMs, no containers. Three places:

```
                     *.crm.quantinity.com  (DNS-only, one wildcard record)
                                │
  ┌─────────────────────────────▼───────────────────────────────┐
  │ API VM                                                      │
  │   Caddy :443  ── engine API paths ──▶  127.0.0.1:3000       │
  │     │                                  quantinity-api       │
  │     │                                  (server + worker,    │
  │     │                                   one build.sh)       │
  │     │                                  Redis 127.0.0.1:6379 │
  │     └── everything else ──▶ Vercel ──────────────┐          │
  └──────────────────────────────┬───────────────────│──────────┘
                   private net   │                   │
            ┌────────────────────┴───┐     ┌─────────▼────────┐
            │ Postgres VM            │     │ Vercel           │
            └────────────────────────┘     │ deploy/web       │
                                           └──────────────────┘
```

| Path | What | Where it goes |
|---|---|---|
| `TWENTY_VERSION` | The engine version, for API **and** web | read by both build scripts - one pin, cannot drift |
| `env.example` | API environment | `/etc/quantinity/api.env` on the API VM |
| `api/build.sh` | Pull, build, migrate, run server + worker | systemd `ExecStart` |
| `api/quantinity-api.service` | The unit | `/etc/systemd/system/` |
| `api/logrotate` | Keeps the log from growing forever | `/etc/logrotate.d/quantinity-api` |
| `proxy/Caddyfile` | TLS, path split API/web, `/<slug>` redirect | `/etc/caddy/Caddyfile` on the API VM |
| `data/postgres.md` | Postgres VM setup | |
| `data/redis.md` | Redis setup, on the API VM (localhost only) | |
| `web/` | The web app build | Vercel project on this repo, Root Directory `deploy/web` |

## Why the web app is behind the API VM's proxy

The web app is built and hosted by Vercel, but customers never hit a Vercel
hostname. `*.crm.quantinity.com` points at the API VM, and Caddy sends the
engine's API paths to the API and everything else to Vercel. The browser sees
one origin per workspace.

Pointing the wildcard at Vercel directly does not work with this engine:

- **Sign-in.** The session cookie is accepted only from the API's own origin
  or an exact allow-list (`AUTH_COOKIE_ALLOWED_ORIGINS`, no wildcards). Every
  workspace subdomain is its own origin, so every new customer would need a
  config change before they could log in.
- **Webhooks.** `/s/...` routes (the WhatsApp webhook) find the workspace from
  the `Host` header. Vercel's proxy rewrites `Host`, so Meta's calls would
  never reach the right workspace.

This is also how the engine's own cloud is split: an ingress routes the
`ApiPath` prefixes to the server and the rest to the frontend. The list in
`proxy/Caddyfile` is that enum. Re-check it on every engine upgrade.

## API VM, once

Ubuntu 24.04, 2 vCPU / 8 GB. The build alone wants ~4 GB; the server and
worker together use several GB at runtime. Add 4 GB of swap if you start
smaller.

```bash
# Node 24 (>= 24.18 - the engine pins 24.19), psql for the startup schema check
curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
apt install -y nodejs git postgresql-client

cd /root
git clone https://github.com/devquantinity/quantinity-crm.git
# private repo: build.sh runs `git pull` unattended on every start, so the
# clone needs credentials that do not prompt - a read-only deploy key (clone
# over SSH) or a fine-grained token with contents:read.
# build.sh pulls whatever branch this checkout is on: `git checkout <branch>`
# here to deploy something other than main.

install -d -m 700 /etc/quantinity
install -m 600 /root/quantinity-crm/deploy/env.example /etc/quantinity/api.env
# ... fill it in

cp /root/quantinity-crm/deploy/api/quantinity-api.service /etc/systemd/system/
cp /root/quantinity-crm/deploy/api/logrotate /etc/logrotate.d/quantinity-api
systemctl daemon-reload
systemctl enable --now quantinity-api
tail -f /var/log/quantinity-api.log     # first start builds: 5-10 minutes
```

Caddy, with the Cloudflare DNS module for the wildcard certificate:

```bash
apt install -y caddy                      # from Caddy's apt repo, see caddyserver.com/docs/install
caddy add-package github.com/caddy-dns/cloudflare
apt-mark hold caddy                       # an apt upgrade would replace the custom binary

cp /root/quantinity-crm/deploy/proxy/Caddyfile /etc/caddy/Caddyfile
cat > /etc/caddy/env <<'EOF'
CF_API_TOKEN=...
WEB_UPSTREAM=quantinity-crm.vercel.app     # the Vercel project's production hostname
EOF
chmod 600 /etc/caddy/env && chown caddy /etc/caddy/env
systemctl edit caddy        # [Service]  EnvironmentFile=/etc/caddy/env
systemctl restart caddy
```

Firewall: only 22, 80 and 443 open. Port 3000 stays closed - there is no
Docker here to punch around ufw, so ufw's word is final.

```bash
ufw allow OpenSSH && ufw allow 80,443/tcp && ufw enable
```

## Deploying

| Change | Do |
|---|---|
| This repo's deploy scripts | push, then `systemctl restart quantinity-api` |
| Engine upgrade | DEPLOYMENT.md section 6 first. Bump `TWENTY_VERSION`, push - Vercel starts building the web app. Then `systemctl restart quantinity-api` straight away (builds, migrates) |
| The Quantinity app (objects, logic, UI) | Not a server deploy at all - `app:publish`, DEPLOYMENT.md section 4. Vercel skips the build for these pushes |
| Roll back a failed engine build | Nothing to do: `build.sh` keeps running the previous build and says so in the log. Revert the pin and restart when ready |

Builds live in `/root/quantinity-crm/.build/releases/<version>`, with `current`
pointing at the one running. Old releases can be deleted by hand once the new
one has run for a while; they are what makes a rollback instant.

A rollback across a version whose migrations already ran is **not** safe.
Migrations go forward only. That is what the backup before an upgrade is for.
