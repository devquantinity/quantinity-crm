# Subscriptions (Curlec)

Nothing here is built yet. This is the design, the rules that are not
negotiable, and the list of things I need from Irfan before writing code.

---

## Where it lives

**Outside the CRM, as its own small service.** Not inside this repo.

Reasons, in order of how much they matter:

1. The CRM engine stays unmodified, which keeps the AGPL obligation at arm's
   length (see `DEPLOYMENT.md` section 0).
2. Billing must keep working when the CRM is down. That is the hour you most
   need to know who has paid.
3. A CRM that can bill its own owner is a strange object, and every customer's
   workspace would carry code that only concerns you.

So: `quantinity.com` (marketing, pricing, signup, billing portal) is one
service; the CRM is another. The billing service is the only thing allowed to
create a workspace - which also makes it the **owner of the slug**.

That is a bigger job than it sounds, because the target URL is
`crm.quantinity.com/<company-name>`: the slug is a path segment, so it shares a
namespace with the application's own routes. A customer who takes `settings`
shadows a real page. The billing service must enforce the reserved list in
[ARCHITECTURE.md](ARCHITECTURE.md) section 3, generated from the route table
rather than typed from memory, and it must do so from the first signup - a slug
handed out today is one you are stuck with.

---

## The flow

```
  signup page          Curlec                billing service         CRM
  ──────────           ──────                ───────────────         ───
  pick a plan   ──▶    create subscription
  authorise     ──▶    mandate / card
                       │
                       └── webhook ────────▶ verify signature
                                             record event id
                                             mark paid_until
                                             ─────────────────────▶ create workspace
                                                                    invite the owner

  every month          charge attempt
                       ├── success ────────▶ extend paid_until
                       └── failure ────────▶ grace period
                                             then suspend ────────▶ block access
```

### Rules that are not negotiable

- **Provision on the webhook, never on the redirect.** The browser coming back
  to a "payment successful" page proves nothing - it can be typed into the
  address bar. A signature-verified webhook is the only thing that may create a
  workspace or extend a subscription.
- **Verify the webhook signature on the raw body.** Parsing and re-serialising
  JSON changes bytes and breaks the signature. This repo already does it that
  way for WhatsApp in `src/lib/webhook-signature.ts` - same shape, same reason.
- **Every webhook is idempotent.** Gateways retry. Store the event id, and make
  a repeat a no-op. A retried charge event that extends the subscription twice
  is a customer getting a free month.
- **Money in integer cents.** Never a float. The CRM already does this - see
  `amountMicros` in the quotation code.
- **Suspend, never delete.** Non-payment blocks access. It does not destroy
  data. Publish a schedule - suspended at day 0, exportable until day 30,
  deleted at day 90 - and follow it exactly.
- **A grace period before suspension.** Direct debit failures at month-end are
  routine in Malaysia and usually mean a timing problem, not a customer who has
  left. Suspending on the first failure will cost you customers who intended to
  pay.

---

## What the billing service stores

Its own database. Small.

| Table | Holds |
|---|---|
| `account` | email, company, plan, status, `paid_until`, workspace id |
| `curlec` | customer id, subscription id, plan id, mandate status |
| `event` | every webhook received, by gateway event id, for idempotency and for arguments |

`status` is one of: `trialing`, `active`, `past_due`, `suspended`, `cancelled`.
One field, one source of truth. Do not infer a customer's status by asking
Curlec at page load - they will be down one day and everyone will look unpaid.

---

## Open question: how do you actually suspend a workspace?

One installation, every customer a workspace. Suspension has to block one
workspace without touching the others, and it has to be reversible the instant
payment clears.

Candidates, none verified yet:

- Deactivate the workspace members, so nobody can sign in
- A flag the billing service owns, checked by a reverse-proxy rule on the
  workspace subdomain
- Whatever the engine offers natively, if anything

**This needs testing on a throwaway install before the pricing page goes live.**
Selling a subscription you cannot stop is worse than not selling one.

---

## What I need from Irfan

Send these and I can write it.

1. **Which Curlec product.** Payment Gateway and Direct Debit are two different
   things with different APIs and different onboarding. Which one is the
   account?
2. **Test-mode credentials, and the docs they gave you.** Test keys only, in a
   file - not live keys, and not pasted into chat. Live keys belong in the
   server's environment and nowhere else.
3. **Payment methods for recurring.** FPX direct debit mandate, card, or both.
   This changes the signup flow: a mandate takes days to activate, a card is
   instant. If it is mandates, the first month usually has to be a one-off
   payment while the mandate sets up.
4. **The plans.** Name, price per month, what is included, and whether there is
   an annual price. Also whether pricing is per workspace or per user - that
   decision is easy now and expensive later.
5. **Trial.** Length, and whether it needs a card up front. No card means more
   signups and more junk workspaces.
6. **SST.** Whether Quantinity Sdn Bhd is SST-registered, and whether the plan
   prices are inclusive or exclusive. The CRM's own invoicing already refuses to
   issue when tax is switched on and unconfigured, on purpose - the same care
   applies to your own billing.
7. **Who is the merchant of record.** The entity on the customer's bank
   statement, and the one their receipt comes from.

---

## Sources

- Curlec Subscriptions: https://curlec.com/subscriptions/
- Curlec subscriptions integration guide: https://curlec.com/docs/payments/subscriptions/integration-guide/
