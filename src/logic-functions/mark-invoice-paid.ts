import { defineLogicFunction } from 'twenty-sdk/define';
import { Response, type RoutePayload } from 'twenty-sdk/logic-function';
import { CoreApiClient } from 'twenty-client-sdk/core';

import { MARK_INVOICE_PAID_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/invoice-identifiers';

/**
 * Record that the money arrived.
 *
 * Deliberately does NOT touch the milestone or the project. Being paid and
 * being delivered are different facts, and a client paying a deposit does not
 * mean the work is done. Conflating them is how a project shows as complete
 * because someone transferred a deposit.
 *
 * `paidVia` is left for the person to set on the record - guessing how money
 * arrived puts a wrong answer in a field that reconciliation later trusts.
 */

type MarkPaidBody = { invoiceId?: string };

const run = async (payload: RoutePayload<MarkPaidBody>) => {
  const invoiceId = payload.body?.invoiceId;

  if (!invoiceId) {
    return new Response({ error: 'invoiceId is required' }, { status: 400 });
  }

  const client = new CoreApiClient();

  const { invoice } = await client.query({
    invoice: {
      __args: { filter: { id: { eq: invoiceId } } },
      id: true,
      status: true,
      documentNumber: true,
      paidAt: true,
    },
  });

  if (!invoice) {
    return new Response({ error: 'Invoice not found' }, { status: 404 });
  }

  if (invoice.status === 'PAID') {
    return new Response(
      {
        error: `${invoice.documentNumber} is already marked paid${
          invoice.paidAt ? ` (${String(invoice.paidAt).slice(0, 10)})` : ''
        }.`,
      },
      { status: 409 },
    );
  }

  if (invoice.status === 'DRAFT') {
    return new Response(
      { error: 'This invoice has not been issued yet, so it cannot have been paid.' },
      { status: 409 },
    );
  }

  if (invoice.status === 'VOID') {
    return new Response(
      { error: 'A voided invoice cannot be paid. Raise a new one.' },
      { status: 409 },
    );
  }

  await client.mutation({
    updateInvoice: {
      __args: {
        id: invoice.id,
        data: { status: 'PAID', paidAt: new Date().toISOString() },
      },
      id: true,
    },
  });

  return { ok: true, documentNumber: invoice.documentNumber, status: 'PAID' };
};

const handler = async (payload: RoutePayload<MarkPaidBody>) => {
  try {
    return await run(payload);
  } catch (error) {
    return new Response(
      {
        error: `Could not mark the invoice paid: ${
          error instanceof Error ? error.message : String(error)
        }`,
      },
      { status: 500 },
    );
  }
};

export default defineLogicFunction({
  universalIdentifier: MARK_INVOICE_PAID_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'mark-invoice-paid',
  description: 'Records payment of an issued invoice',
  timeoutSeconds: 10,
  handler,
  httpRouteTriggerSettings: {
    path: '/invoices/mark-paid',
    httpMethod: 'POST',
    isAuthRequired: true,
  },
});
