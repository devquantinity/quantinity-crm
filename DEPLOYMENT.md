# Deploying Quantinity CRM

This is for whoever runs the servers. It assumes you have never seen this repo.

Read section 0 before you buy anything. Three decisions were already made and
they shape everything below.

---

## 0. What you are deploying, and the three things that are not solved

Quantinity CRM is a CRM for quotations, projects, milestones and invoices,
aimed at small Malaysian agencies and service businesses. It is sold as a
subscription.

It is built as an **app on top of the Twenty CRM engine**. Twenty is the
open-source engine underneath; Quantinity is the product. You will see the word
"Twenty" constantly - in the Docker image name, the environment variables, the
documentation you have to read. That is normal and it is not a mistake in this
guide.

**One server, one database, every customer.** Each customer is a *workspace*
inside a single installation. This was chosen to keep the cost down. It is the
cheapest option and it is the one with the least isolation: one bad upgrade,
one full disk, one corrupted database, and every customer is down at once.
Everything in the backup section exists because of this choice.

Three things are **not solved yet**. Do not promise a customer a date on any of
them until you have read these:

1. **Billing is not built.** Curlec will handle recurring payments; nothing is
   written yet. See `SUBSCRIPTIONS.md`. Until it exists, invoicing customers is
   a manual job.
2. **The product still says "Twenty" inside the app.** The login page, the
   browser tab, the sidebar logo. Twenty has no white-labelling support and its
   maintainers have said it is not a priority. Changing it means forking their
   frontend and maintaining that fork forever. Section 9 covers what you can
   change for free.
3. **The licence has conditions.** Twenty is AGPL-3.0. Running it unmodified as
   a service is fine. The moment you modify it - including forking the frontend
   to rebrand it - AGPL section 13 obliges you to offer your customers the
   source of your modified version. This is a real obligation, not a formality.
   Get it read by someone before you fork anything.

---

## 1. What to get before you start

| Thing | Why | Notes |
|---|---|---|
| A Linux server | Runs everything | See sizing below |
| A domain | `quantinity.com` or similar | Customers will see it |
| Object storage (S3 or compatible) | Uploaded files | Local disk loses files on container restart |
| A Google Cloud project | "Continue with Google" sign-in | Free |
| An SMTP sender | Invites, password resets | Postmark, Resend, SES - anything |
| A Curlec account | Subscriptions, later | Not needed on day one |

**Server sizing.** Start at 4 vCPU / 8 GB RAM / 80 GB SSD. Twenty is not light -
the server and worker containers together will use several GB before a single
customer signs up. Expect to move to 16 GB somewhere around 15-20 active
workspaces; watch memory rather than guessing. Put it in Singapore or Kuala
Lumpur, not the US, or every page load carries 200ms it does not need.

Take the managed Postgres if the host offers one. It costs more than a container
and it means backups, failover and point-in-time recovery are someone else's
job. Given that every customer shares this one database, that is money well
spent.

---

## 2. Deploy

Follow Twenty's own Docker Compose guide for the current release - it changes
between versions and a stale copy here would be worse than a link:

- Self-hosting guide: https://docs.twenty.com/developers/self-host
- Every environment variable: https://twenty.com/developers/section/self-hosting/self-hosting-var

You need four services: **server**, **worker**, **Postgres**, **Redis**. The
worker is not optional - without it, background jobs silently never run.

**Use `deploy/docker-compose.override.yml` beside Twenty's compose file.** The
stock file passes only a fixed list of variables into the containers, builds
its own `PG_DATABASE_URL` (so yours is ignored and the password stays
`postgres`), and publishes port 3000 to the internet around the proxy. The
override fixes all three and adds Caddy. See `deploy/README.md`.

The variables that matter most:

```env
# Where the app lives. Wrong value breaks OAuth and every emailed link.
SERVER_URL=https://crm.quantinity.com

PG_DATABASE_URL=postgres://user:password@host:5432/default
# Managed Postgres whose CA Node does not trust (DigitalOcean, most others):
# PG_SSL_ALLOW_SELF_SIGNED=true
REDIS_URL=redis://host:6379

# Encrypts secrets at rest. Generate once, back it up somewhere that is not
# this server, and never change it - you cannot decrypt without it.
ENCRYPTION_KEY=<long random string>

# Files. Local disk is the default and it is wrong for production.
STORAGE_TYPE=S_3
# ...plus STORAGE_S3_REGION, _NAME, _ENDPOINT, _ACCESS_KEY_ID, _SECRET_ACCESS_KEY

# Every customer is a workspace in this one installation.
IS_MULTIWORKSPACE_ENABLED=true
```

**Test `IS_MULTIWORKSPACE_ENABLED=true` on a throwaway install before you rely
on it.** There is a history of it breaking login on some versions. Turn it on,
create two workspaces, log out, log back into both. If that works, you are fine.
If it does not, you have found it early rather than in front of a customer.

Put a reverse proxy in front with real TLS - `deploy/Caddyfile`, which gets
and renews its own certificate. HTTPS is not optional: the auth cookies require it.

---

## 2b. Addresses: how a customer reaches their CRM

**The target is `crm.quantinity.com/<company-name>`.** That decision, what it
requires and the controls it obliges you to build are in
[ARCHITECTURE.md](ARCHITECTURE.md). Read it before you build anything that
depends on the URL shape.

**What you deploy today is not that yet.** The engine resolves the workspace
from the hostname, and moving that to the path is a fork of the engine that
does not exist. Until it does, this is what the server actually serves:

```
  crm.quantinity.com           <- API and OAuth callbacks (SERVER_URL)
  app.crm.quantinity.com       <- sign-in and workspace picker (DEFAULT_SUBDOMAIN)
  acme.crm.quantinity.com      <- Acme's workspace
  quantinity.com               <- marketing, pricing, signup
```

The sign-in entry point is already built: `app.crm.quantinity.com` is a
sign-in screen that finds the customer's workspace, lets them pick if they are in more
than one, and sends them to it. Deep links survive the round trip.

### Serve the path form today, with a redirect

One proxy rule (in `deploy/Caddyfile`) gives customers the address they were
promised while the fork is still a plan:

```
  crm.quantinity.com/acme  ──302──▶  acme.crm.quantinity.com
```

They type, bookmark and share the path form; the browser finishes on whatever
the engine serves. The rule is deleted the day the fork lands, and nothing that
was shared in the meantime breaks, because the redirect keeps working.

The slug rules in ARCHITECTURE.md section 3 apply from the first signup, not
from the fork. A slug handed out now is a slug you are stuck with.

### DNS and TLS

- A records: `crm.quantinity.com` and `*.crm.quantinity.com` → the server
- A Let's Encrypt wildcard for `*.crm.quantinity.com` over DNS-01. Caddy gets
  and renews it given a Cloudflare API token.
- Keep those records **DNS-only in Cloudflare** (grey cloud). The free proxied
  certificate covers `*.quantinity.com` only - one level - so a proxied
  fourth-level subdomain gets a certificate warning. Proxying them anyway means
  Advanced Certificate Manager, about $10 a month.

One record and one certificate, set up once. Nothing to touch when a customer
signs up.

### Custom domains, later

A workspace can be given its own domain - `crm.acmesdn.com` pointing at their
workspace - which is a good paid upgrade and sidesteps the URL argument
entirely for the customers who care about it. Be aware it currently insists on
a `CLOUDFLARE_API_KEY` even if you intend to set the DNS by hand; there is an
open issue and a PR for it. Do not sell it until you have made it work once.

---

## 3. Google sign-in

In Google Cloud Console → APIs & Services → Credentials → Create OAuth client ID
(type: Web application).

Then:

```env
AUTH_GOOGLE_ENABLED=true
AUTH_GOOGLE_CLIENT_ID=<from Google>
AUTH_GOOGLE_CLIENT_SECRET=<from Google>
AUTH_GOOGLE_CALLBACK_URL=https://crm.quantinity.com/auth/google/redirect
AUTH_GOOGLE_APIS_CALLBACK_URL=https://crm.quantinity.com/auth/google-apis/get-access-token
```

**The two callback URLs must be pasted verbatim into Google's "Authorised
redirect URIs" box.** They have to match character for character, including the
scheme and any trailing path. Take the authoritative paths from the variables
page linked above for your Twenty version.

If Google shows `redirect_uri_mismatch`, do not guess: the error page shows the
exact URI the server sent. Copy that string into Google Console and it will
work.

Keep password login on as well (`AUTH_PASSWORD_ENABLED=true`) unless you have
decided every customer will use Google. Someone will not have a Google account,
and it will be the customer who pays the most.

Leave `IS_WORKSPACE_CREATION_LIMITED_TO_SERVER_ADMINS=true` (Twenty's
default). Only server admins create workspaces and sign-up without an
invitation is refused, so nobody who finds the URL gets the product free. Until
billing exists, you create each customer's workspace and invite its owner.
(`IS_SIGN_UP_DISABLED`, which older guides mention, no longer exists.)

---

## 4. Install the Quantinity app into the server

The engine gives you contacts, companies and deals. Quotations, projects,
milestones, invoices and the WhatsApp inbox come from this repo.

`./apply.command` is **not** how this reaches production. `apply` is a
development sync into one workspace. Production is publish once, then install
per workspace. Run it from your laptop, not the server - the build takes an 8
GB heap.

```bash
npm install                     # Node 24. Not 23 - it breaks npm install.

# once
npm run quantinity -- remote:add --url https://crm.quantinity.com --as production

# every release: bump "version" in package.json first - the server refuses
# a version that is not strictly higher than the one deployed
npm run quantinity -- app:publish --private --remote production

# once, into the workspace the remote is logged into
npm run quantinity -- app:install --remote production
```

**Every customer workspace installs it separately.** There is no install into
all workspaces. In your own workspace: Settings → Applications →
Registrations → the app → Distribution → **Copy share link**, and open it in
the customer's workspace. Then turn on **auto-upgrade** in the app's General
tab there, or each later publish sits waiting in that workspace's settings.

Never remove an object or field from the source on a server with customers on
it without a plan: a deleted object takes every record in it.

The GitHub CD workflow cannot do this yet: Twenty's deploy and install actions
run `yarn install --immutable`, and this repo is npm-only.

After install, each customer's workspace needs its billing details set in
Settings → Billing. Those get frozen onto every quotation and invoice at the
moment it is issued, so they must be that customer's real company details, not
yours. Set **Public base URL** to that workspace's address
(`https://acme.crm.quantinity.com`), and open one client link in a private
window to prove it. Their WhatsApp webhook is
`https://acme.crm.quantinity.com/s/whatsapp/webhook`.

---

## 5. Backups

Every customer is in one database. This section is the whole business.

The repo has `backup-rehearsal.command`, which dumps the database, restores the
dump into a scratch container, and compares row counts table by table. It prints
PASS, FAIL or INCONCLUSIVE. It was written for the laptop; port it to the server
and run it nightly from cron.

Rules:

- **A backup nobody has restored is not a backup.** That script restores every
  time it runs, which is the point of it.
- Keep copies **off this server**. A backup on the machine that dies is not a
  backup. Off-site, different provider.
- Back up `ENCRYPTION_KEY` separately from the database. A dump you cannot
  decrypt is a file, not a recovery.
- Know your restore time before you need it. Restore into a scratch server,
  with a stopwatch, and write the number down. That number is what you can
  promise a customer.

---

## 6. Upgrades

Twenty ships frequently and migrations run on boot.

1. Back up. Prove the backup restores.
2. Read their release notes for breaking changes.
3. Upgrade a staging copy restored from last night's dump.
4. Publish and install the app on staging - the app can break on an engine
   upgrade, and you want to find that on staging.
5. Only then, production. Off-hours.

Never upgrade on a Friday.

---

## 7. When it breaks

| Symptom | Look at |
|---|---|
| Blank page, spinner forever | `SERVER_URL` wrong, or TLS not terminating |
| Login fails after enabling multi-workspace | Section 2 - test this before customers exist |
| `redirect_uri_mismatch` | Section 3 - copy the URI from Google's error page |
| Certificate warning on a customer's subdomain | Section 2b - Cloudflare's free proxied cert stops at one level; go DNS-only |
| A new workspace 404s | Wildcard DNS record missing, or the slug was reserved |
| Uploads vanish after a restart | Still on local storage; set `STORAGE_TYPE=S_3` |
| Background jobs never run | Worker container is not running |
| Quotation numbers jumped | Normal for a withdrawn quotation; the number stays spent |
| Everything is slow | Postgres before anything else |

`RUNBOOK.md` in this repo covers day-to-day operation and the document
lifecycle. `HARDENING.md` is an honest list of what is not production-grade yet
- read it once, fully, before selling anything.

---

## 8. Security, briefly

- Nothing but the reverse proxy on a public port. Postgres and Redis stay on the
  private network.
- Separate `ENCRYPTION_KEY` per environment. Never the staging one in production.
- Customer data lives in Malaysia or Singapore unless a customer agrees
  otherwise in writing.
- You are now holding other companies' client lists and pricing. Two-factor on
  the hosting account, the domain registrar and the Google Cloud project.

---

## 9. What you can call it today

Free, no fork, do it now:

- The domain, the marketing site, the emails, the invoices, the support address
- Each customer's workspace name and logo (Settings → General, per workspace)
- Everything this repo adds - the quotation and invoice documents customers
  actually send out already carry their own branding

Needs a frontend fork, and the AGPL obligation in section 0 comes with it:

- The login page, the browser tab title, the favicon, the sidebar logo

A fair reading: customers who sign in at `quantinity.com`, get documents
branded as their own, and are supported by you will not care much what the
sidebar logo says. Revisit it when there is revenue to pay for the fork.
