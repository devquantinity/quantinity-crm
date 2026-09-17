import { defineLogicFunction } from 'twenty-sdk/define';
import { Response, type RoutePayload } from 'twenty-sdk/logic-function';
import { CoreApiClient } from 'twenty-client-sdk/core';

import { PUBLIC_INVOICE_PAGE_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/invoice-identifiers';
import { formatMoney } from 'src/lib/quote-math';
import type { QuoteIssuer } from 'src/lib/quote-settings';

/**
 * The invoice the client opens from the link you send.
 *
 * Unauthenticated, looked up by share token only - same reasoning as the quote
 * page. A DRAFT is never shown: it has no number, no frozen details, and a
 * figure that can still move.
 *
 * There is no button on this page. An invoice asks for money; it does not ask
 * for a click.
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
<title>Invoice not available</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f6f7f8;
color:#15181c;font:15px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
div{text-align:center;padding:32px;max-width:420px}h1{font-size:19px;margin:0 0 6px}
p{margin:0;color:#6b747f;font-size:14px}</style></head>
<body><div><h1>This invoice is not available</h1>
<p>The link may have expired or been replaced. Please ask your contact for a current one.</p>
</div></body></html>`,
    { status: 404, headers: { 'content-type': 'text/html; charset=utf-8' } },
  );

const run = async (payload: RoutePayload) => {
  const token = payload.queryStringParameters?.token;

  if (!token) {
    return notFoundPage();
  }

  const client = new CoreApiClient();

  const { invoice } = await client.query({
    invoice: {
      __args: { filter: { shareToken: { eq: token } } },
      id: true,
      documentNumber: true,
      kind: true,
      status: true,
      issuedAt: true,
      dueDate: true,
      paidAt: true,
      notes: true,
      amount: { amountMicros: true, currencyCode: true },
      issuerSnapshot: true,
      billToSnapshot: true,
      project: { id: true, name: true },
      milestone: { id: true, name: true },
    },
  });

  if (!invoice || invoice.status === 'DRAFT') {
    return notFoundPage();
  }

  const issuer = (invoice.issuerSnapshot ?? {}) as Partial<QuoteIssuer> & {
    paymentInstructions?: string;
  };
  const billTo = (invoice.billToSnapshot ?? {}) as {
    companyName?: string;
    address?: string;
  };

  const currency = invoice.amount?.currencyCode ?? 'MYR';
  const amountMicros = Number(invoice.amount?.amountMicros ?? 0);
  const overdue =
    invoice.status === 'ISSUED' &&
    invoice.dueDate &&
    new Date(invoice.dueDate) < new Date();

  const banner =
    invoice.status === 'PAID'
      ? { text: `Paid${invoice.paidAt ? ` on ${String(invoice.paidAt).slice(0, 10)}` : ''}`, bg: '#e6f6ec', fg: '#1a7a3e' }
      : invoice.status === 'VOID'
        ? { text: 'Void', bg: '#f0f2f4', fg: '#6b747f' }
        : overdue
          ? { text: `Overdue since ${String(invoice.dueDate).slice(0, 10)}`, bg: '#fdecec', fg: '#b02525' }
          : null;

  const kindLabel =
    invoice.kind === 'DEPOSIT'
      ? 'Deposit'
      : invoice.kind === 'FINAL'
        ? 'Final payment'
        : 'Progress payment';

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(invoice.documentNumber)} — ${escapeHtml(billTo.companyName ?? 'Invoice')}</title>
<style>
  :root{--ink:#15181c;--muted:#6b747f;--line:#e0e4e8;--accent:#0c6e66}
  *{box-sizing:border-box}
  body{margin:0;background:#f6f7f8;color:var(--ink);
       font:14px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
  .banner{max-width:760px;margin:32px auto 12px;padding:10px 16px;border-radius:6px;
          font-size:13px;font-weight:600;text-align:center}
  .sheet{max-width:760px;margin:32px auto;background:#fff;padding:48px;
         border:1px solid var(--line);border-radius:6px}
  .banner + .sheet{margin-top:0}
  header{display:flex;justify-content:space-between;gap:32px;
         padding-bottom:24px;border-bottom:2px solid var(--accent);flex-wrap:wrap}
  h1{margin:0 0 4px;font-size:28px;letter-spacing:-.02em}
  .meta{text-align:right;font-size:13px;color:var(--muted)}
  .meta b{color:var(--ink)}
  .parties{display:flex;gap:48px;margin:28px 0;font-size:13px;flex-wrap:wrap}
  .parties h2{font-size:11px;letter-spacing:.1em;text-transform:uppercase;
              color:var(--muted);margin:0 0 6px}
  table{width:100%;border-collapse:collapse;margin-top:12px;font-size:13px}
  th{text-align:left;font-size:11px;letter-spacing:.08em;text-transform:uppercase;
     color:var(--muted);border-bottom:1px solid var(--line);padding:8px 10px}
  td{padding:12px 10px;border-bottom:1px solid var(--line)}
  .num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
  .total{display:flex;justify-content:space-between;align-items:baseline;
         margin-top:18px;padding-top:14px;border-top:2px solid var(--ink)}
  .total .label{font-size:15px;font-weight:600}
  .total .value{font-size:22px;font-weight:600;font-variant-numeric:tabular-nums}
  .due{margin-top:22px;padding:14px 16px;background:#f2f8f7;border:1px solid #cfe6e3;
       border-radius:6px;font-size:13px}
  .pay{margin-top:22px;padding:14px 16px;border:1px solid var(--line);
       border-radius:6px;font-size:13px;white-space:pre-wrap}
  .pay h2{font-size:11px;letter-spacing:.1em;text-transform:uppercase;
          color:var(--muted);margin:0 0 6px}
  .notes{margin-top:24px;padding-top:18px;border-top:1px solid var(--line);
         font-size:12.5px;color:var(--muted);white-space:pre-wrap}
  @media print{body{background:#fff}.sheet{border:0;margin:0;padding:0}}
  @media (max-width:640px){.sheet{padding:24px;margin:16px}}
</style>
</head>
<body>
${banner ? `<div class="banner" style="background:${banner.bg};color:${banner.fg}">${escapeHtml(banner.text)}</div>` : ''}
<div class="sheet">
  <header>
    <div>
      <h1>Invoice</h1>
      <div style="color:var(--muted);font-size:13px">${escapeHtml(issuer.name)}</div>
      <div style="color:var(--muted);font-size:12px">${escapeHtml(issuer.registrationNo)}</div>
    </div>
    <div class="meta">
      <div><b>${escapeHtml(invoice.documentNumber)}</b></div>
      <div>Issued ${escapeHtml(String(invoice.issuedAt ?? '').slice(0, 10))}</div>
      <div>Due ${escapeHtml(String(invoice.dueDate ?? '').slice(0, 10))}</div>
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
      ${escapeHtml(billTo.address)}
    </div>
  </div>

  <table>
    <thead><tr><th>Description</th><th class="num">Amount</th></tr></thead>
    <tbody>
      <tr>
        <td>
          <b>${escapeHtml(kindLabel)}</b><br>
          <span style="color:var(--muted)">${escapeHtml(invoice.project?.name)}${
            invoice.milestone?.name ? ` — ${escapeHtml(invoice.milestone.name)}` : ''
          }</span>
        </td>
        <td class="num">${formatMoney(amountMicros, currency)}</td>
      </tr>
    </tbody>
  </table>

  <div class="total">
    <span class="label">${invoice.status === 'PAID' ? 'Paid' : 'Amount due'}</span>
    <span class="value">${formatMoney(amountMicros, currency)}</span>
  </div>

  ${
    invoice.status !== 'PAID' && invoice.status !== 'VOID'
      ? `<div class="due">Payable by <b>${escapeHtml(String(invoice.dueDate ?? '').slice(0, 10))}</b>. Please quote <b>${escapeHtml(invoice.documentNumber)}</b> as your payment reference.</div>`
      : ''
  }

  ${
    issuer.paymentInstructions && invoice.status !== 'PAID' && invoice.status !== 'VOID'
      ? `<div class="pay"><h2>How to pay</h2>${escapeHtml(issuer.paymentInstructions)}</div>`
      : ''
  }

  ${invoice.notes ? `<div class="notes">${escapeHtml(invoice.notes)}</div>` : ''}
</div>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store, private',
    },
  });
};

const handler = async (payload: RoutePayload) => {
  try {
    return await run(payload);
  } catch {
    // A client should never see a stack trace on a document about money.
    return notFoundPage();
  }
};

export default defineLogicFunction({
  universalIdentifier: PUBLIC_INVOICE_PAGE_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'public-invoice-page',
  description: 'Renders an issued invoice for the client, looked up by share token',
  timeoutSeconds: 10,
  handler,
  httpRouteTriggerSettings: {
    path: '/invoice',
    httpMethod: 'GET',
    isAuthRequired: false,
  },
});
