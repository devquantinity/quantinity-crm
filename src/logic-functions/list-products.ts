import { defineLogicFunction } from 'twenty-sdk/define';
import { Response, type RoutePayload } from 'twenty-sdk/logic-function';
import { CoreApiClient } from 'twenty-client-sdk/core';

import { LIST_PRODUCTS_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/catalogue-identifiers';
import { getQuoteSettings } from 'src/lib/quote-settings';

/**
 * The catalogue, for the Add items panel.
 *
 * A front component runs in a sandboxed worker and cannot query the core API
 * itself, so the panel asks this instead. Retired products are left out - the
 * point of untickng Active is to stop it appearing here without deleting the
 * quotations that used it.
 */

const run = async (_payload: RoutePayload) => {
  const client = new CoreApiClient();
  const settings = await getQuoteSettings();

  const { products } = await client.query({
    products: {
      __args: { first: 200 },
      edges: {
        node: {
          id: true,
          name: true,
          code: true,
          description: true,
          unit: true,
          category: true,
          isTaxable: true,
          isActive: true,
          unitPrice: { amountMicros: true, currencyCode: true },
        },
      },
    },
  });

  const rows = (products?.edges ?? [])
    .map((edge: any) => edge.node)
    .filter((product: any) => product?.isActive !== false);

  return {
    currencyCode: settings.currencyCode,
    products: rows,
  };
};

const handler = async (payload: RoutePayload) => {
  try {
    return await run(payload);
  } catch (error) {
    return new Response(
      {
        error: `Could not load the catalogue: ${
          error instanceof Error ? error.message : String(error)
        }`,
      },
      { status: 500 },
    );
  }
};

export default defineLogicFunction({
  universalIdentifier: LIST_PRODUCTS_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'list-products',
  description: 'Returns the active catalogue for the Add items panel',
  timeoutSeconds: 10,
  handler,
  httpRouteTriggerSettings: {
    path: '/products',
    httpMethod: 'GET',
    isAuthRequired: true,
  },
});
