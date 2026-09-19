import { defineLogicFunction } from 'twenty-sdk/define';
import { Response, type RoutePayload } from 'twenty-sdk/logic-function';
import { CoreApiClient } from 'twenty-client-sdk/core';

import { reviseQuoteRefusal } from 'src/lib/route-guards';

import { REVISE_QUOTE_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/quote-identifiers';

/**
 * Revise an issued quote.
 *
 * An issued document never changes. When the client asks for a different price
 * or an extra line, the answer is a new document that keeps the same number and
 * increments the revision - Q-0001 Rev 2 - so both sides can still talk about
 * "quote Q-0001" and the history of what was offered stays intact.
 *
 * The revision starts life as a DRAFT so it can be edited freely. The original
 * is left alone until the revision is actually issued; only then is it
 * superseded. A revision abandoned halfway must not invalidate a quote the
 * client is still considering.
 */

type ReviseBody = { quoteId?: string };

const handler = async (payload: RoutePayload<ReviseBody>) => {
  const quoteId = payload.body?.quoteId;

  if (!quoteId) {
    return new Response({ error: 'quoteId is required' }, { status: 400 });
  }

  const client = new CoreApiClient();

  const { quote } = await client.query({
    quote: {
      __args: { filter: { id: { eq: quoteId } } },
      id: true,
      name: true,
      documentNumber: true,
      revision: true,
      status: true,
      discountType: true,
      discountValue: true,
      terms: true,
      opportunity: { id: true },
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

  if (!quote) {
    return new Response({ error: 'Quote not found' }, { status: 404 });
  }

  const refusal = reviseQuoteRefusal({ quote });

  if (refusal) {
    return new Response({ error: refusal.error }, { status: refusal.status });
  }

  const nextRevision = Number(quote.revision ?? 1) + 1;

  const { createQuote } = await client.mutation({
    createQuote: {
      __args: {
        data: {
          name: `${quote.documentNumber} Rev ${nextRevision}`,
          documentNumber: quote.documentNumber,
          revision: nextRevision,
          status: 'DRAFT',
          discountType: quote.discountType,
          discountValue: quote.discountValue,
          terms: quote.terms,
          ...(quote.opportunity?.id
            ? { opportunityId: quote.opportunity.id }
            : {}),
        },
      },
      id: true,
      name: true,
      documentNumber: true,
      revision: true,
    },
  });

  if (!createQuote) {
    return new Response(
      { error: 'Could not create the revision' },
      { status: 500 },
    );
  }

  const items = (quote.quoteItems?.edges ?? []).map((edge: any) => edge.node);

  // Copy the lines across. The revision is a starting point for the new offer,
  // not an empty page - most revisions change one number.
  for (const item of items) {
    await client.mutation({
      createQuoteItem: {
        __args: {
          data: {
            name: item.name,
            description: item.description,
            quantity: item.quantity,
            unit: item.unit,
            isTaxable: item.isTaxable,
            lineOrder: item.lineOrder,
            ...(item.unitPrice
              ? {
                  unitPrice: {
                    amountMicros: item.unitPrice.amountMicros,
                    currencyCode: item.unitPrice.currencyCode,
                  },
                }
              : {}),
            quoteId: createQuote.id,
          },
        },
        id: true,
      },
    });
  }

  return {
    ok: true,
    quoteId: createQuote.id,
    name: createQuote.name,
    revision: createQuote.revision,
    copiedLineItems: items.length,
  };
};

export default defineLogicFunction({
  universalIdentifier: REVISE_QUOTE_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'revise-quote',
  description:
    'Clones an issued quote as a new draft revision keeping the same document number',
  timeoutSeconds: 20,
  handler,
  httpRouteTriggerSettings: {
    path: '/quotes/revise',
    httpMethod: 'POST',
    isAuthRequired: true,
  },
});
