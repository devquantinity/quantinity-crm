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

The variables that matter most:

```env
# Where the app lives. Wrong value breaks OAuth and every emailed link.
SERVER_URL=https://quantinity.com

PG_DATABASE_URL=postgres://user:password@host:5432/default
REDIS_URL=redis://host:6379

# Encrypts secrets at rest. Generate once, back it up somewhere that is not
# this server, and never change it - you cannot decrypt without it.
ENCRYPTION_KEY=<long random string>

# Files. Local disk is the default and it is wrong for production.
STORAGE_TYPE=S_3
# ...plus the STORAGE_S3_* values for your bucket

# Every customer is a workspace in this one installation.
IS_MULTIWORKSPACE_ENABLED=true
```

**Test `IS_MULTIWORKSPACE_ENABLED=true` on a throwaway install before you rely
on it.** There is a history of it breaking login on some versions. Turn it on,
create two workspaces, log out, log back into both. If that works, you are fine.
If it does not, you have found it early rather than in front of a customer.

Put a reverse proxy in front with real TLS - Caddy is the least work, nginx if
you already know it. HTTPS is not optional: the auth cookies require it.

---

## 2b. Addresses: how a customer reaches their CRM

**The engine routes workspaces by subdomain, not by path.**

`crm.quantinity.com/company-name` is not something it does. The frontend is a
single-page app served at the root, and the workspace is worked out from the
hostname. Making a path prefix work means rewriting the frontend's routing and
every place the backend builds a URL - the fork this project is trying not to
own.

So a customer's CRM lives at a subdomain of whatever you make the default
domain. Two sensible layouts are below; pick one before you buy a certificate.

### The sign-in entry point is already built

You do not have to build a "find my workspace" page. The engine's **default
domain** is a sign-in screen: the customer signs in there with a password,
Google or SSO, picks their workspace if they belong to more than one, and gets
sent to its subdomain. Deep links survive the round trip, so a link into a
specific record still lands on that record after sign-in.

So the customer only ever has to remember one address. Which one it is depends
on the layout you pick below - the default domain **is** the sign-in page.

### Two layouts, both fine

Workspace subdomains are built by prefixing the default domain. So the default
domain decides everything else.

**A - the app owns the apex**

```
  quantinity.com               <- default domain: sign-in, workspace picker
  acme.quantinity.com          <- Acme's workspace
  www.quantinity.com           <- marketing, pricing, signup
```

Third-level subdomains, so Cloudflare's free proxied certificate
(`*.quantinity.com`) covers them and you can leave the orange cloud on. The
cost is that marketing cannot have the apex - it lives on `www.` or on a
separate domain.

**B - everything under crm. (recommended if you want the marketing site on the
apex)**

```
  crm.quantinity.com           <- default domain: sign-in, workspace picker
  acme.crm.quantinity.com      <- Acme's workspace
  quantinity.com               <- marketing, pricing, signup
```

Cleaner separation: the marketing site keeps the main domain, and `crm.` is
obviously the product. The workspaces are fourth-level subdomains, which
Cloudflare's **free proxied** certificate does not cover - `*.quantinity.com`
is one level only.

That is a Cloudflare-proxy limit, not a limit on nesting. It costs nothing to
work around:

- Let Caddy get a **Let's Encrypt wildcard for `*.crm.quantinity.com`** over
  DNS-01, with an API token for your DNS provider. Free, renews itself.
- Keep those records **DNS-only in Cloudflare** (grey cloud, not orange), so
  the browser gets Caddy's certificate rather than Cloudflare's edge one.

Only if you insist on proxying them through Cloudflare do you need Advanced
Certificate Manager at about $10 a month.

### What DNS and TLS need

For layout A: a wildcard A record `*.quantinity.com` and a wildcard certificate
for the same.

For layout B: a wildcard A record `*.crm.quantinity.com` and a Let's Encrypt
wildcard for the same, over DNS-01, DNS-only in Cloudflare.

Either way it is one record and one certificate, set up once. Nothing to touch
when a customer signs up.

### Choose the slug rules now

The slug is in the URL, it is public, and changing it later breaks every link
and bookmark a customer has.

- **Reserve the obvious names** before anyone can take them: `www`, `app`,
  `api`, `admin`, `mail`, `crm`, `static`, `status`, `help`, `support`,
  `billing`. A customer who registers `api` can make your own service
  unreachable.
- **Block names that impersonate.** Somebody will try to register a bank's name
  or a competitor's. Keep a denylist and a manual review for anything close.
- **Decide whether a slug can change.** If yes, keep the old one redirecting
  forever. If no, say so on the signup form, before they type it.
- Lowercase, letters, digits and hyphens. No leading or trailing hyphen, 3-30
  characters.

### Custom domains, later

A workspace can be given its own domain - `crm.acmesdn.com` pointing at their
workspace - which is a good paid upgrade. Be aware it currently insists on a
`CLOUDFLARE_API_KEY` even if you intend to set the DNS by hand; there is an open
issue and a PR for it. Do not sell it until you have made it work once.

---

## 3. Google sign-in

In Google Cloud Console → APIs & Services → Credentials → Create OAuth client ID
(type: Web application).

Then:

```env
AUTH_GOOGLE_ENABLED=true
AUTH_GOOGLE_CLIENT_ID=<from Google>
AUTH_GOOGLE_CLIENT_SECRET=<from Google>
AUTH_GOOGLE_CALLBACK_URL=https://quantinity.com/auth/google/redirect
AUTH_GOOGLE_APIS_CALLBACK_URL=https://quantinity.com/auth/google-apis/get-access-token
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

Also decide on `IS_SIGN_UP_DISABLED`. Leaving sign-up open means anyone who
finds the URL can create a workspace and use the product for free. Once billing
exists, only the billing service should be creating workspaces.

---

## 4. Install the Quantinity app into the server

The engine gives you contacts, companies and deals. Quotations, projects,
milestones, invoices and the WhatsApp inbox come from this repo.

```bash
npm install          # Node 24. Not 23 - it breaks npm install.
./apply.command      # builds and syncs into the running server
```

`apply.command` points at `http://localhost:2020` by default. For a real server
you will authenticate the CLI against your deployment first; run
`npm run quantinity -- --help` and use the login command for your version.

Two things about `apply`:

- It runs with `--no-delete` on purpose. Without that flag it offers to delete
  any object no longer in the source - and a deleted object takes every record
  in it. Never remove that flag on a server with customers on it.
- Run it against a copy first. An app sync touches every workspace.

After the first apply, each customer's workspace needs its billing details set
in Settings → Billing. Those get frozen onto every quotation and invoice at the
moment it is issued, so they must be that customer's real company details, not
yours.

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
4. Run `./apply.command` against staging - the app can break on an engine
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
