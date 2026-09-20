# Quantinity CRM

A CRM for small agencies and service businesses that sell work by quotation:
quote it, win it, run it, bill it, get paid — in one place, with the document
numbering an accountant expects.

## What it does

- **Quotations** with a continuous number series, line items, a catalogue of
  reusable products, discounts and tax. Issuing freezes the totals and your
  business details onto the document and makes it read-only.
- **A client link** for every issued quotation and invoice. The client opens it
  in a browser and accepts it there; no login, no PDF attachment.
- **Revisions** rather than edits. A changed quotation supersedes the old one
  and keeps its number, so the history of what was sent stays true.
- **Projects and milestones** created from an accepted quotation, with its lines
  carried across as the things to deliver.
- **Invoices** raised from a milestone — deposit, progress or final — on their
  own number series, with payment terms and instructions.
- **A WhatsApp inbox** that matches incoming numbers to contacts and attaches a
  conversation to the deal it belongs to.

## How it is built

Quantinity is an application on the [Twenty](https://twenty.com) CRM engine.
Twenty supplies contacts, companies, deals and the interface; this repo supplies
everything above. The engine is not forked — the app talks to it through its
published APIs, which is what keeps upgrades survivable.

You will see the word "Twenty" throughout the tooling, the Docker image and the
documentation you need to read. The product is Quantinity CRM; Twenty is the
engine under it.

## Documentation

| File | For |
|---|---|
| [ARCHITECTURE.md](ARCHITECTURE.md) | How the pieces fit, and the tenancy decision |
| [SETUP.md](SETUP.md) | Getting it running on your own machine |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Running it as a service for paying customers |
| [RUNBOOK.md](RUNBOOK.md) | Day-to-day operation, backups, starting real use |
| [SUBSCRIPTIONS.md](SUBSCRIPTIONS.md) | The Curlec billing design — not built yet |
| [HARDENING.md](HARDENING.md) | An honest list of what is not production-grade |
| [CHANGELOG.md](CHANGELOG.md) | Notable changes |

New here and deploying it? Read DEPLOYMENT.md section 0 first.

## Development

```bash
npm install        # Node 24
npm test           # unit + integration
npm run lint
npm run typecheck
./apply.command    # build and sync into the running server
```

## Licence

This repo is MIT. The engine it runs on is AGPL-3.0, which carries obligations
if you modify it and run it as a network service — see DEPLOYMENT.md section 0.
