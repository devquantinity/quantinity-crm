# Architecture

## The decision

**Every customer is reached at `crm.quantinity.com/<company-name>`.**

Decided by Irfan, September 2026, after being shown the subdomain alternative
twice. Written down here so that whoever picks this up in a year knows it was a
choice and knows what it costs, rather than discovering the consequences one at
a time.

What it costs is on this page. Section 4 is the part that is not optional.

---

## 1. Why this repo alone cannot do it

This repo is the **application**: quotations, projects, milestones, invoices,
the WhatsApp inbox. It talks to the CRM engine through published APIs and does
not modify it, which is what has kept upgrades cheap.

The engine decides which workspace a request belongs to by reading the **Origin
header**. Nothing in this repo sees a hostname or a path. There is no setting,
no environment variable and no plugin point that moves that decision to the URL
path.

So path-based tenancy is not a change to this repo. It is a fork of the engine.

### What the fork has to change

Subdomain routing went in as six merged upstream PRs, touching frontend
routing, frontend URL building, backend workspace resolution, the auth and SSO
controllers, cookie and token handling, the GraphQL resolvers, and a database
migration. Path routing is the same surface, in reverse:

| Layer | Change |
|---|---|
| Backend resolution | Workspace from the first path segment, not the Origin header |
| Auth controllers | Sign-in, OAuth and SSO callbacks all carry the segment |
| Cookies and tokens | Session must be bound to a workspace, and checked (section 4) |
| Frontend router | Mounted under a dynamic base path |
| Frontend URL building | Every generated link gains the segment |
| Reserved routes | The segment must not collide with the app's own routes (section 3) |

Budget for it as a fork you maintain, not a patch you apply. Every engine
upgrade is a merge, and the upstream files being changed are the ones upstream
touches most.

### The licence consequence

The engine is AGPL-3.0. Running it unmodified as a service carries no source
obligation. **Forking it does**: AGPL section 13 requires that the people using
your hosted service can get the source of your modified version. That is a real
obligation. Have someone read it before the fork ships, not after.

---

## 2. The shape

Four pieces. Only the first exists today.

```
  quantinity-crm        this repo - the application. Unchanged by any of this.
  quantinity-engine     fork of the CRM engine. Path routing lives here.
  quantinity-billing    Curlec subscriptions, provisioning, suspension.
  quantinity-web        marketing, pricing, signup.
```

```
                    crm.quantinity.com
                           │
                    ┌──────┴──────┐
                    │   proxy     │
                    └──────┬──────┘
                           │  /acme/*        /bolehtech/*
                           ▼
                    quantinity-engine  ── resolves tenant from path segment
                           │
                           │ objects, logic functions, front components
                           ▼
                    quantinity-crm (this repo, applied into the engine)

  quantinity.com   ──▶ quantinity-web ──▶ quantinity-billing ──▶ creates workspace
```

The billing service is the only thing allowed to create a workspace, which
makes it the owner of the path segment. It allocates the slug, it enforces the
reserved list, and it is the only writer of that field.

---

## 3. The slug is now a route

This is the problem path-based tenancy introduces that subdomains do not have,
and it is worth understanding before the first customer signs up.

On subdomains, `acme` and `settings` cannot collide - one is a hostname, the
other is a path. On paths they are the same namespace. A customer who registers
the slug `settings` shadows the application's own settings route, and depending
on match order either breaks their workspace or breaks everyone's.

So the reserved list is no longer a handful of DNS names. It is **every
top-level route the engine and the app serve**, present and future:

```
auth  api  graphql  rest  s  settings  objects  object  record  records
verify  invite  reset-password  sign-in  sign-up  welcome  onboarding
static  assets  files  health  healthz  metrics  webhooks  admin
billing  account  support  help  status  docs  www  app  crm  _next
```

Two rules that follow:

- **Enumerate it from the engine's route table, not from memory.** Generate the
  list at build time from the fork's routes and fail the build if a registered
  slug appears in it.
- **An engine upgrade can add a route that an existing customer already owns.**
  That is a real upgrade hazard with no equivalent on subdomains. Check new
  routes against live slugs as part of the upgrade checklist in
  `DEPLOYMENT.md` section 6.

Beyond that, the usual: lowercase, letters, digits and hyphens, 3-30
characters, no leading or trailing hyphen, a denylist for names that
impersonate a bank or a competitor, and a decision - written on the signup form
- about whether a slug can ever change.

---

## 4. One origin, every customer

Not optional. Read this section before writing the fork.

`crm.quantinity.com/acme` and `crm.quantinity.com/bolehtech` are the **same
browser origin**. They share one cookie jar, one `localStorage`, one script
context. The browser will not keep one customer's data away from another's -
that is now entirely your code's job, on every request, forever.

Subdomains get that separation from the browser for free. Having given it up,
these are what replace it:

**Authorise on every request, from the path.**
The session cookie proves *who* the user is. It must never prove *which
workspace* they may see. Every request resolves the workspace from the path
segment and re-checks that this user is a member of it. A session minted for
`acme` presented at `/bolehtech` is rejected, not silently accepted.

**Never trust a client-supplied workspace id.**
Not from a header, not from the body, not from a GraphQL variable. The path
segment, resolved server-side, is the only source.

**One place, not many.**
Tenant resolution lives in exactly one middleware. Any query that reaches the
database without a tenant filter fails loudly rather than returning everything.
Make that the default in the data layer, not a rule people remember.

**Assume XSS is fatal.**
On subdomains, a script injected into one workspace cannot read another's. Here
it can. So: a strict Content-Security-Policy, no third-party scripts on the app
origin at all, and **user-uploaded files served from a different origin** - a
customer who uploads an HTML attachment must not be able to get it executed on
the origin that holds everyone's session.

**Cache keys include the tenant.**
Any proxy or CDN caching in front of this must key on the path segment. A cache
that ignores it serves one customer another customer's page, and it will look
like a ghost rather than a breach.

**Log the tenant on every request.**
When something does go wrong, the question will be "whose data was returned",
and you will only be able to answer it from logs written before the incident.

---

## 5. Sequencing

Do not start with the fork.

1. **Run single-tenant first.** One workspace, real customers, no multi-tenancy
   at all. The product earns the right to the infrastructure.
2. **Build billing** (`SUBSCRIPTIONS.md`). It is independent of tenancy and it
   is what makes this a business rather than a deployment.
3. **Decide again, with revenue in front of you.** The fork is weeks of work
   plus permanent maintenance plus a licence obligation. If at that point the
   answer is still the path, fork it then - with paying customers to justify it
   and the section 4 controls written before the first line of routing.

A redirect at `crm.quantinity.com/<company-name>` gives the address to
customers today, with no fork, while the browser ends up on whatever the engine
actually serves. It is one proxy rule and it can be removed the day the fork
lands.
