import { defineLogicFunction } from 'twenty-sdk/define';
import { Response, type RoutePayload } from 'twenty-sdk/logic-function';
import { CoreApiClient } from 'twenty-client-sdk/core';

import { ADD_QUOTE_ITEMS_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/catalogue-identifiers';
import { getQuoteSettings } from 'src/lib/quote-settings';
import {
  linesFromProducts,
  highestLineOrder,
  unpricedProducts,
  type PickedProduct,
} from 'src/lib/catalogue';
import { formatMoney } from 'src/lib/quote-math';

/**
 * Put several catalogue items on a quotation in one go.
 *
 * This exists because adding lines one at a time through the table is the
 * slowest part of quoting - four separate interactions for one line. The whole
 * pick becomes one call.
 *
 * Every value the client will read is copied here and never looked up again.
 */

type AddItemsBody = { quoteId?: string; items?: PickedProduct[] };

const run = async (payload: RoutePayload<AddItemsBody>) => {
  const quoteId = payload.body?.quoteId;
  const picked = (payload.body?.items ?? []).filter((item) => item?.productId);

  if (!quoteId) {
    return new Response({ error: 'quoteId is required' }, { status: 400 });
  }

  if (picked.length === 0) {
    return new Response({ error: 'Pick at least one item' }, { status: 422 });
  }

  const client = new CoreApiClient();

  const { quote } = await client.query({
    quote: {
      __args: { filter: { id: { eq: quoteId } } },
      id: true,
      status: true,
      documentNumber: true,
      quoteItems: { edges: { node: { id: true, lineOrder: true } } },
    },
  });

  if (!quote) {
    return new Response({ error: 'Quotation not found' }, { status: 404 });
  }

  // An issued quotation is what the client is holding. Lines stop moving.
  if (quote.status !== 'DRAFT') {
    return new Response(
      {
        error: `${quote.documentNumber ?? 'This quotation'} is ${String(
          quote.status,
        ).toLowerCase()}. Revise it first if the lines need to change.`,
      },
      { status: 409 },
    );
  }

  const { products } = await client.query({
    products: {
      __args: { first: 200 },
      edges: {
        node: {
          id: true,
          name: true,
          description: true,
          unit: true,
          isTaxable: true,
          unitPrice: { amountMicros: true, currencyCode: true },
        },
      },
    },
  });

  const catalogue = (products?.edges ?? []).map((edge: any) => edge.node);
  const unpriced = unpricedProducts(picked, catalogue);

  if (unpriced.length > 0) {
    return new Response(
      {
        error: `${unpriced
          .map((product) => `"${product.name ?? 'Untitled'}"`)
          .join(', ')} ${
          unpriced.length === 1 ? 'has' : 'have'
        } no price in the catalogue. Set a price first rather than quoting zero.`,
      },
      { status: 422 },
    );
  }

  const settings = await getQuoteSettings();

  const lines = linesFromProducts({
    picked,
    products: catalogue,
    fallbackCurrencyCode: settings.currencyCode,
    startingOrder: highestLineOrder(
      (quote.quoteItems?.edges ?? []).map((edge: any) => edge.node),
    ),
  });

  if (lines.length === 0) {
    return new Response(
      { error: 'None of those items are in the catalogue any more' },
      { status: 422 },
    );
  }

  // No createMany in the client, so one at a time. A handful of lines is well
  // inside the timeout; a pick large enough to matter is not a real quotation.
  let added = 0;
  let totalMicros = 0;

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
            quoteId,
            productId: line.productId,
            unitPrice: line.unitPrice,
          },
        },
        id: true,
      },
    });

    if (createQuoteItem) {
      added += 1;
      totalMicros += Math.round(line.quantity * line.unitPrice.amountMicros);
    }
  }

  return {
    ok: true,
    added,
    total: formatMoney(totalMicros, settings.currencyCode),
  };
};

const handler = async (payload: RoutePayload<AddItemsBody>) => {
  try {
    return await run(payload);
  } catch (error) {
    return new Response(
      {
        error: `Could not add the items: ${
          error instanceof Error ? error.message : String(error)
        }`,
      },
      { status: 500 },
    );
  }
};

export default defineLogicFunction({
  universalIdentifier: ADD_QUOTE_ITEMS_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'add-quote-items',
  description: 'Copies catalogue items onto a draft quotation as lines',
  timeoutSeconds: 30,
  handler,
  httpRouteTriggerSettings: {
    path: '/quotes/add-items',
    httpMethod: 'POST',
    isAuthRequired: true,
  },
});
