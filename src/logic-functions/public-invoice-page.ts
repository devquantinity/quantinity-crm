import { defineLogicFunction } from 'twenty-sdk/define';
import { Response, type RoutePayload } from 'twenty-sdk/logic-function';
import { CoreApiClient } from 'twenty-client-sdk/core';

import { PUBLIC_INVOICE_PAGE_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/invoice-identifiers';
import {
  invoiceNotFoundHtml,
  renderInvoiceHtml,
  type InvoiceDocumentData,
} from 'src/lib/invoice-document';

/**
 * The invoice the client opens from the link you send.
 *
 * Unauthenticated, looked up by share token only - same reasoning as the quote
 * page. A DRAFT is never shown: it has no number, no frozen details, and a
 * figure that can still move.
 *
 * There is no button on this page. An invoice asks for money; it does not ask
 * for a click. The document itself lives in src/lib/invoice-document.ts, which
 * has no Twenty imports, so it can be rendered and inspected without a server.
 */

const notFoundPage = () =>
  new Response(invoiceNotFoundHtml(), {
    status: 404,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });

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

  return new Response(renderInvoiceHtml(invoice as InvoiceDocumentData), {
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
