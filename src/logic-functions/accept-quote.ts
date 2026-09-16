import { defineLogicFunction } from 'twenty-sdk/define';
import { Response, type RoutePayload } from 'twenty-sdk/logic-function';
import { CoreApiClient } from 'twenty-client-sdk/core';

import { ACCEPT_QUOTE_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/quote-identifiers';

/**
 * The client pressing Accept on the public quote page.
 *
 * Unauthenticated, like the page itself - the share token is the credential.
 * Everything here is written defensively because this endpoint is reachable by
 * anyone who has the link:
 *
 *   - the quote is found BY token, never by id, so the table cannot be walked
 *   - only an ISSUED quote can be accepted, so a double submit is a no-op
 *   - an expired quote is refused rather than quietly accepted late
 *   - the total is NOT taken from the request; only the name is
 */

type AcceptBody = { token?: string; acceptedByName?: string; agreed?: string };

const resultPage = (title: string, message: string, ok: boolean) =>
  new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f6f7f8;
color:#15181c;font:15px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
div{text-align:center;padding:32px;max-width:420px}
h1{font-size:19px;margin:0 0 8px;color:${ok ? '#1a7a3e' : '#b02525'}}
p{margin:0;color:#6b747f;font-size:14px}</style></head>
<body><div><h1>${title}</h1><p>${message}</p></div></body></html>`,
    {
      status: ok ? 200 : 409,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    },
  );

const handler = async (payload: RoutePayload<AcceptBody>) => {
  // The page posts a normal HTML form, so the body may arrive urlencoded.
  const body = payload.body ?? {};
  const raw = payload.rawBody ?? '';
  const form = new URLSearchParams(raw);

  const token = body.token ?? form.get('token') ?? undefined;
  const acceptedByName = (
    body.acceptedByName ??
    form.get('acceptedByName') ??
    ''
  ).trim();
  const agreed = body.agreed ?? form.get('agreed');

  if (!token) {
    return resultPage('Something went wrong', 'This link is not valid.', false);
  }

  if (acceptedByName.length < 2) {
    return resultPage(
      'Please enter your name',
      'We need the name of the person accepting this quotation.',
      false,
    );
  }

  if (!agreed) {
    return resultPage(
      'Please confirm the terms',
      'Tick the box to confirm you agree to the terms before accepting.',
      false,
    );
  }

  const client = new CoreApiClient();

  const { quote } = await client.query({
    quote: {
      __args: { filter: { shareToken: { eq: token } } },
      id: true,
      documentNumber: true,
      status: true,
      validUntil: true,
      total: { amountMicros: true, currencyCode: true },
      opportunity: { id: true },
    },
  });

  if (!quote) {
    return resultPage(
      'Quotation not found',
      'This link may have expired or been replaced. Please ask your contact for a current link.',
      false,
    );
  }

  if (quote.status === 'ACCEPTED') {
    return resultPage(
      'Already accepted',
      `Quotation ${quote.documentNumber} has already been accepted. Nothing further is needed.`,
      true,
    );
  }

  if (quote.status !== 'ISSUED') {
    return resultPage(
      'This quotation is closed',
      `Quotation ${quote.documentNumber} is ${String(quote.status).toLowerCase()} and can no longer be accepted.`,
      false,
    );
  }

  if (quote.validUntil && new Date(quote.validUntil) < new Date()) {
    return resultPage(
      'This quotation has expired',
      `Quotation ${quote.documentNumber} expired on ${String(quote.validUntil).slice(0, 10)}. Please ask your contact to extend or reissue it.`,
      false,
    );
  }

  await client.mutation({
    updateQuote: {
      __args: {
        id: quote.id,
        data: {
          status: 'ACCEPTED',
          acceptedAt: new Date().toISOString(),
          acceptedByName,
          acceptedVia: 'LINK',
        },
      },
      id: true,
    },
  });

  // Gotka syncs the accepted total onto the deal, which is what the leaderboard
  // and any commission then read. Deliberately the quote's own frozen total,
  // never a number from the request.
  if (quote.opportunity?.id && quote.total?.amountMicros != null) {
    await client.mutation({
      updateOpportunity: {
        __args: {
          id: quote.opportunity.id,
          data: {
            amount: {
              amountMicros: quote.total.amountMicros,
              currencyCode: quote.total.currencyCode ?? 'MYR',
            },
          },
        },
        id: true,
      },
    });
  }

  return resultPage(
    'Thank you, accepted',
    `Quotation ${quote.documentNumber} has been accepted. Your contact has been notified and will be in touch about next steps.`,
    true,
  );
};

export default defineLogicFunction({
  universalIdentifier: ACCEPT_QUOTE_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'accept-quote',
  description:
    'Records a client accepting a quotation from its share link, and syncs the total onto the deal.',
  timeoutSeconds: 10,
  handler,
  httpRouteTriggerSettings: {
    path: '/quote/accept',
    httpMethod: 'POST',
    isAuthRequired: false,
  },
});
