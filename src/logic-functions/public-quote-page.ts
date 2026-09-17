import { defineLogicFunction } from 'twenty-sdk/define';
import { Response, type RoutePayload } from 'twenty-sdk/logic-function';
import { CoreApiClient } from 'twenty-client-sdk/core';

import { PUBLIC_QUOTE_PAGE_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import {
  lineAmountMicros,
  calculateTotals,
  formatMoney,
  lineLabel,
  type DiscountType,
} from 'src/lib/quote-math';
import type { QuoteIssuer } from 'src/lib/quote-settings';

/**
 * The page a client opens from the link you send them.
 *
 * Unauthenticated by design - the share token IS the credential, which is why
 * it is a uuid and why this route only ever looks a quote up BY that token.
 * There is no id parameter, so no way to walk the quote table by guessing.
 *
 * A DRAFT is never shown: an unissued quote has no number, no frozen issuer
 * details and totals that can still move, so there is nothing safe to display.
 */

const escapeHtml = (value: unknown) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const notFoundPage = () =>
  new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Quotation not found</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f6f7f8;
color:#15181c;font:15px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
div{text-align:center;padding:32px}h1{font-size:19px;margin:0 0 6px}
p{margin:0;color:#6b747f;font-size:14px}</style></head>
<body><div><h1>This quotation is not available</h1>
<p>The link may have expired, or the quotation may have been replaced by a newer version.<br>
Please ask your contact for an up-to-date link.</p></div></body></html>`,
    { status: 404, headers: { 'content-type': 'text/html; charset=utf-8' } },
  );

type StatusBanner = { text: string; background: string; color: string } | null;

const statusBanner = (status: string, validUntil?: string | null): StatusBanner => {
  if (status === 'ACCEPTED') {
    return { text: 'Accepted', background: '#e6f6ec', color: '#1a7a3e' };
  }
  if (status === 'DECLINED') {
    return { text: 'Declined', background: '#fdecec', color: '#b02525' };
  }
  if (status === 'WITHDRAWN') {
    return { text: 'Withdrawn', background: '#f0f2f4', color: '#6b747f' };
  }
  if (status === 'SUPERSEDED') {
    return {
      text: 'Replaced by a newer revision',
      background: '#f3edfa',
      color: '#6b3fa0',
    };
  }
  if (status === 'EXPIRED') {
    return { text: 'Expired', background: '#fdf3e7', color: '#9a5b12' };
  }
  if (validUntil && new Date(validUntil) < new Date()) {
    return {
      text: `Expired on ${new Date(validUntil).toISOString().slice(0, 10)}`,
      background: '#fdf3e7',
      color: '#9a5b12',
    };
  }
  return null;
};

/**
 * Note on the lookup: Twenty's singular finder THROWS "Record not found"
 * rather than returning null, so the `!quote` check below never fires and an
 * unknown token lands in the catch. Without that catch a client opening a
 * stale link got a raw 500 JSON with an internal error code - on a page that
 * exists to be sent to clients.
 */
const run = async (payload: RoutePayload) => {
  const token = payload.queryStringParameters?.token;

  if (!token) {
    return notFoundPage();
  }

  const client = new CoreApiClient();

  const { quote } = await client.query({
    quote: {
      __args: { filter: { shareToken: { eq: token } } },
      id: true,
      documentNumber: true,
      revision: true,
      status: true,
      issuedAt: true,
      validUntil: true,
      acceptedByName: true,
      acceptedAt: true,
      discountType: true,
      discountValue: true,
      taxLabel: true,
      taxRate: true,
      isTaxRegistered: true,
      terms: true,
      issuerSnapshot: true,
      billToSnapshot: true,
      total: { amountMicros: true, currencyCode: true },
      quoteItems: {
        edges: {
          node: {
            id: true,
            name: true,
            description: true,
            quantity: true,
            unit: true,
            isTaxable: true,
            lineOrder: true,
            unitPrice: { amountMicros: true, currencyCode: true },
          },
        },
      },
    },
  });

  if (!quote || quote.status === 'DRAFT') {
    return notFoundPage();
  }

  const issuer = (quote.issuerSnapshot ?? {}) as Partial<QuoteIssuer>;
  const billTo = (quote.billToSnapshot ?? {}) as {
    companyName?: string;
    contactName?: string;
    address?: string;
  };

  const currency = quote.total?.currencyCode ?? 'MYR';

  const items = (quote.quoteItems?.edges ?? [])
    .map((edge: any) => edge.node)
    .sort((a: any, b: any) => Number(a.lineOrder ?? 0) - Number(b.lineOrder ?? 0));

  const lines = items.map((item: any) => ({
    quantity: Number(item.quantity ?? 0),
    unitPriceMicros: Number(item.unitPrice?.amountMicros ?? 0),
    isTaxable: item.isTaxable !== false,
  }));

  // Recomputed from the frozen line items, never from today's settings - the
  // document must render the same next year as it did the day it was sent.
  const totals = calculateTotals({
    lines,
    discountType: (quote.discountType ?? 'NONE') as DiscountType,
    discountValue: Number(quote.discountValue ?? 0),
    taxRate: Number(quote.taxRate ?? 0),
    isTaxRegistered: quote.isTaxRegistered === true,
  });

  const rows = items
    .map((item: any, index: number) => {
      const amount = lineAmountMicros(lines[index]);
      // Print each line in the currency it was actually stored in. Issuing now
      // refuses mixed currencies, but a quote issued before that rule existed
      // should show what it really says rather than relabel it.
      const lineCurrency = item.unitPrice?.currencyCode || currency;

      return `<tr>
        <td>${escapeHtml(lineLabel(item))}</td>
        <td class="num">${escapeHtml(item.quantity)}</td>
        <td>${escapeHtml(item.unit)}</td>
        <td class="num">${formatMoney(lines[index].unitPriceMicros, lineCurrency)}</td>
        <td class="num">${formatMoney(amount, lineCurrency)}</td>
      </tr>`;
    })
    .join('');

  const banner = statusBanner(quote.status ?? '', quote.validUntil);
  const isOpen = quote.status === 'ISSUED' && banner === null;
  const label =
    Number(quote.revision ?? 1) > 1
      ? `${quote.documentNumber} Rev ${quote.revision}`
      : String(quote.documentNumber ?? '');

  const discountRow =
    totals.discountMicros > 0
      ? `<div><span>Discount${
          quote.discountType === 'PERCENT' ? ` (${quote.discountValue}%)` : ''
        }</span><span class="num">-${formatMoney(totals.discountMicros, currency)}</span></div>`
      : '';

  const taxRow = quote.isTaxRegistered
    ? `<div><span>${escapeHtml(quote.taxLabel)} (${escapeHtml(quote.taxRate)}%)</span><span class="num">${formatMoney(totals.taxMicros, currency)}</span></div>`
    : `<div class="muted"><span>${escapeHtml(quote.taxLabel ?? 'SST')} not applicable</span><span></span></div>`;

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(label)} — ${escapeHtml(billTo.companyName ?? 'Quotation')}</title>
<style>
  :root{--ink:#15181c;--muted:#6b747f;--line:#e0e4e8;--accent:#0c6e66}
  *{box-sizing:border-box}
  body{margin:0;background:#f6f7f8;color:var(--ink);
       font:14px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
  .sheet{max-width:820px;margin:32px auto;background:#fff;padding:48px;
         border:1px solid var(--line);border-radius:6px}
  .banner{max-width:820px;margin:0 auto 12px;padding:10px 16px;border-radius:6px;
          font-size:13px;font-weight:600;text-align:center}
  header{display:flex;justify-content:space-between;gap:32px;
         padding-bottom:24px;border-bottom:2px solid var(--accent)}
  h1{margin:0 0 4px;font-size:28px;letter-spacing:-.02em}
  .meta{text-align:right;font-size:13px;color:var(--muted)}
  .meta b{color:var(--ink)}
  .parties{display:flex;gap:48px;margin:28px 0;font-size:13px;flex-wrap:wrap}
  .parties h2{font-size:11px;letter-spacing:.1em;text-transform:uppercase;
              color:var(--muted);margin:0 0 6px}
  table{width:100%;border-collapse:collapse;margin-top:12px;font-size:13px}
  th{text-align:left;font-size:11px;letter-spacing:.08em;text-transform:uppercase;
     color:var(--muted);border-bottom:1px solid var(--line);padding:8px 10px}
  td{padding:10px;border-bottom:1px solid var(--line);vertical-align:top}
  .num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
  .totals{margin-left:auto;width:320px;margin-top:16px;font-size:13px}
  .totals div{display:flex;justify-content:space-between;padding:6px 10px}
  .totals .muted{color:var(--muted);font-size:12px}
  .totals .grand{border-top:2px solid var(--ink);margin-top:6px;padding-top:10px;
                 font-size:16px;font-weight:600}
  .terms{margin-top:32px;padding-top:20px;border-top:1px solid var(--line);
         font-size:12.5px;color:var(--muted)}
  .accept{margin-top:28px;padding:20px;background:#f2f8f7;border:1px solid #cfe6e3;
          border-radius:6px}
  .accept label{display:block;font-size:13px;margin-bottom:6px}
  .accept input[type=text]{width:100%;max-width:340px;padding:9px 11px;font-size:14px;
          border:1px solid #cfd8d6;border-radius:5px}
  .accept button{margin-top:14px;background:var(--accent);color:#fff;border:0;
          border-radius:5px;padding:10px 18px;font-size:14px;cursor:pointer}
  .accept button[disabled]{opacity:.5;cursor:not-allowed}
  .check{display:flex;gap:8px;align-items:flex-start;margin-top:12px;font-size:13px}
  @media print{body{background:#fff}.sheet{border:0;margin:0;padding:0}
               .accept{display:none}.banner{margin-bottom:24px}}
  @media (max-width:640px){.sheet{padding:24px;margin:16px}}
</style>
</head>
<body>
${banner ? `<div class="banner" style="background:${banner.background};color:${banner.color}">${escapeHtml(banner.text)}${quote.acceptedByName ? ` by ${escapeHtml(quote.acceptedByName)}` : ''}</div>` : ''}
<div class="sheet">
  <header>
    <div>
      <h1>Quotation</h1>
      <div style="color:var(--muted);font-size:13px">${escapeHtml(issuer.name)}</div>
      <div style="color:var(--muted);font-size:12px">${escapeHtml(issuer.registrationNo)}</div>
    </div>
    <div class="meta">
      <div><b>${escapeHtml(label)}</b></div>
      <div>Issued ${escapeHtml(String(quote.issuedAt ?? '').slice(0, 10))}</div>
      <div>Valid until ${escapeHtml(String(quote.validUntil ?? '').slice(0, 10))}</div>
    </div>
  </header>

  <div class="parties">
    <div>
      <h2>From</h2>
      ${escapeHtml(issuer.address)}<br>
      ${escapeHtml(issuer.email)}${issuer.phone ? ` · ${escapeHtml(issuer.phone)}` : ''}
    </div>
    <div>
      <h2>Bill to</h2>
      <b>${escapeHtml(billTo.companyName)}</b><br>
      ${billTo.contactName ? `${escapeHtml(billTo.contactName)}<br>` : ''}
      ${escapeHtml(billTo.address)}
    </div>
  </div>

  <table>
    <thead><tr>
      <th>Description</th><th class="num">Qty</th><th>Unit</th>
      <th class="num">Unit price</th><th class="num">Amount</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="totals">
    <div><span>Subtotal</span><span class="num">${formatMoney(totals.subtotalMicros, currency)}</span></div>
    ${discountRow}
    ${taxRow}
    <div class="grand"><span>Total</span><span class="num">${formatMoney(totals.totalMicros, currency)}</span></div>
  </div>

  ${quote.terms ? `<div class="terms"><b>Terms</b><br>${escapeHtml(quote.terms)}</div>` : ''}

  ${
    isOpen
      ? `<form class="accept" method="POST" action="/s/quote/accept">
    <input type="hidden" name="token" value="${escapeHtml(token)}">
    <div style="font-weight:600;margin-bottom:10px">Accept this quotation</div>
    <label for="acceptedByName">Your full name</label>
    <input type="text" id="acceptedByName" name="acceptedByName" required autocomplete="name">
    <div class="check">
      <input type="checkbox" id="agreed" name="agreed" required>
      <label for="agreed">I have read and agree to the terms above, and accept this quotation on behalf of ${escapeHtml(billTo.companyName ?? 'my company')}.</label>
    </div>
    <button type="submit">Accept ${formatMoney(totals.totalMicros, currency)}</button>
  </form>`
      : ''
  }
</div>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      // Never let a proxy cache a document addressed by a secret token.
      'cache-control': 'no-store, private',
    },
  });
};


const handler = async (payload: RoutePayload) => {
  try {
    return await run(payload);
  } catch {
    // A bad token, a deleted quotation, anything at all: the client sees the
    // same page. Never a stack trace, and never a hint about which it was.
    return notFoundPage();
  }
};

export default defineLogicFunction({
  universalIdentifier: PUBLIC_QUOTE_PAGE_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'public-quote-page',
  description:
    'Renders an issued quotation for the client, looked up by its share token. No authentication.',
  timeoutSeconds: 10,
  handler,
  httpRouteTriggerSettings: {
    path: '/quote',
    httpMethod: 'GET',
    isAuthRequired: false,
  },
});
