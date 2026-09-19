import { defineLogicFunction } from 'twenty-sdk/define';
import { Response, type RoutePayload } from 'twenty-sdk/logic-function';
import { CoreApiClient } from 'twenty-client-sdk/core';

import { withdrawQuoteRefusal } from 'src/lib/route-guards';

import { WITHDRAW_QUOTE_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/quote-identifiers';

/**
 * Withdraw an issued quote.
 *
 * Closes the offer without deleting it. The number stays spent - a gap in a
 * numbered series is a question somebody eventually has to answer, and
 * "withdrawn" is a much better answer than a missing document. The client's
 * link keeps working and shows the quote as withdrawn rather than 404ing, so
 * nobody is left wondering whether they lost the email.
 *
 * An accepted quote cannot be withdrawn: that is a cancellation, which is a
 * conversation and probably a credit note, not a status change.
 */

type WithdrawBody = { quoteId?: string };

const handler = async (payload: RoutePayload<WithdrawBody>) => {
  const quoteId = payload.body?.quoteId;

  if (!quoteId) {
    return new Response({ error: 'quoteId is required' }, { status: 400 });
  }

  const client = new CoreApiClient();

  const { quote } = await client.query({
    quote: {
      __args: { filter: { id: { eq: quoteId } } },
      id: true,
      documentNumber: true,
      status: true,
    },
  });

  if (!quote) {
    return new Response({ error: 'Quote not found' }, { status: 404 });
  }

  const refusal = withdrawQuoteRefusal({ quote });

  if (refusal) {
    return new Response({ error: refusal.error }, { status: refusal.status });
  }

  await client.mutation({
    updateQuote: {
      __args: { id: quote.id, data: { status: 'WITHDRAWN' } },
      id: true,
    },
  });

  return { ok: true, documentNumber: quote.documentNumber, status: 'WITHDRAWN' };
};

export default defineLogicFunction({
  universalIdentifier: WITHDRAW_QUOTE_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'withdraw-quote',
  description: 'Closes an issued quotation without deleting its document number',
  timeoutSeconds: 10,
  handler,
  httpRouteTriggerSettings: {
    path: '/quotes/withdraw',
    httpMethod: 'POST',
    isAuthRequired: true,
  },
});
