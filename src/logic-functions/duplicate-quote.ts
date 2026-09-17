import { defineLogicFunction } from 'twenty-sdk/define';
import { Response, type RoutePayload } from 'twenty-sdk/logic-function';
import { CoreApiClient } from 'twenty-client-sdk/core';

import { DUPLICATE_QUOTE_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/quote-identifiers';
import {
  draftFromQuote,
  linesFromQuote,
  type SourceLine,
} from 'src/lib/quote-duplicate';

/**
 * Copy a quotation - or a template - into a new draft.
 *
 * This is how templates work: there is no separate template object and no
 * second editor. You build a quotation once, tick Template on it, and
 * duplicate it whenever the same job comes round. One data model, one place to
 * learn.
 *
 * Revise and Duplicate are different tools. Revise keeps the number and the
 * deal - the same quotation, a new version of it. Duplicate keeps neither.
 */

type DuplicateBody = { quoteId?: string };

const run = async (payload: RoutePayload<DuplicateBody>) => {
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
      status: true,
      isTemplate: true,
      discountType: true,
      discountValue: true,
      terms: true,
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
            product: { id: true },
            unitPrice: { amountMicros: true, currencyCode: true },
          },
        },
      },
    },
  });

  if (!quote) {
    return new Response({ error: 'Quotation not found' }, { status: 404 });
  }

  const { createQuote } = await client.mutation({
    createQuote: {
      __args: { data: draftFromQuote(quote) },
      id: true,
      name: true,
    },
  });

  if (!createQuote) {
    return new Response(
      { error: 'Could not create the copy' },
      { status: 500 },
    );
  }

  const lines = linesFromQuote(
    (quote.quoteItems?.edges ?? []).map((edge: any) => edge.node as SourceLine),
  );

  let copied = 0;

  for (const line of lines) {
    const { createQuoteItem } = await client.mutation({
      createQuoteItem: {
        __args: {
          data: {
            name: line.name,
            description: line.description,
            quantity: line.quantity,
            unit: line.unit,
            isTaxable: line.isTaxable,
            lineOrder: line.lineOrder,
            quoteId: createQuote.id,
            ...(line.productId ? { productId: line.productId } : {}),
            ...(line.unitPrice.currencyCode
              ? {
                  unitPrice: {
                    amountMicros: line.unitPrice.amountMicros,
                    currencyCode: line.unitPrice.currencyCode,
                  },
                }
              : {}),
          },
        },
        id: true,
      },
    });

    if (createQuoteItem) copied += 1;
  }

  return {
    ok: true,
    quoteId: createQuote.id,
    name: createQuote.name,
    lines: copied,
    fromTemplate: quote.isTemplate === true,
  };
};

const handler = async (payload: RoutePayload<DuplicateBody>) => {
  try {
    return await run(payload);
  } catch (error) {
    return new Response(
      {
        error: `Could not duplicate the quotation: ${
          error instanceof Error ? error.message : String(error)
        }`,
      },
      { status: 500 },
    );
  }
};

export default defineLogicFunction({
  universalIdentifier: DUPLICATE_QUOTE_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'duplicate-quote',
  description: 'Copies a quotation or template into a new draft, lines and all',
  timeoutSeconds: 30,
  handler,
  httpRouteTriggerSettings: {
    path: '/quotes/duplicate',
    httpMethod: 'POST',
    isAuthRequired: true,
  },
});
