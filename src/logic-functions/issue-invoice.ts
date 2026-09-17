import { defineLogicFunction } from 'twenty-sdk/define';
import { Response, type RoutePayload } from 'twenty-sdk/logic-function';
import { CoreApiClient } from 'twenty-client-sdk/core';

import { ISSUE_INVOICE_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/invoice-identifiers';
import {
  getQuoteSettings,
  takeNextInvoiceSequence,
} from 'src/lib/quote-settings';
import { formatDocumentNumber, formatMoney } from 'src/lib/quote-math';
import { addDaysToDate } from 'src/lib/invoice-math';

/**
 * Issue an invoice.
 *
 * Same discipline as a quotation: the number is assigned, the business and
 * client details are frozen onto the record, the figure stops moving, and a due
 * date is set from the payment terms. After this the document is what the
 * client has in their hand, and it must not quietly change behind them.
 *
 * Every check runs before the number is taken, so a refusal never leaves a gap
 * in the invoice series.
 */

type IssueInvoiceBody = { invoiceId?: string };

const run = async (payload: RoutePayload<IssueInvoiceBody>) => {
  const invoiceId = payload.body?.invoiceId;

  if (!invoiceId) {
    return new Response({ error: 'invoiceId is required' }, { status: 400 });
  }

  const client = new CoreApiClient();

  const { invoice } = await client.query({
    invoice: {
      __args: { filter: { id: { eq: invoiceId } } },
      id: true,
      name: true,
      status: true,
      documentNumber: true,
      notes: true,
      amount: { amountMicros: true, currencyCode: true },
      project: {
        id: true,
        name: true,
        opportunity: {
          id: true,
          company: {
            id: true,
            name: true,
            address: {
              addressStreet1: true,
              addressStreet2: true,
              addressCity: true,
              addressState: true,
              addressPostcode: true,
              addressCountry: true,
            },
          },
        },
      },
    },
  });

  if (!invoice) {
    return new Response({ error: 'Invoice not found' }, { status: 404 });
  }

  if (invoice.status !== 'DRAFT') {
    return new Response(
      {
        error: `This invoice is ${String(invoice.status).toLowerCase()}, only a draft can be issued.`,
        documentNumber: invoice.documentNumber,
      },
      { status: 409 },
    );
  }

  const amountMicros = Number(invoice.amount?.amountMicros ?? 0);

  if (amountMicros <= 0) {
    return new Response(
      { error: 'An invoice for nothing cannot be issued. Set an amount first.' },
      { status: 422 },
    );
  }

  const settings = await getQuoteSettings();
  const currencyCode = invoice.amount?.currencyCode ?? settings.currencyCode;

  const issuedAt = new Date();
  const dueDate = addDaysToDate(issuedAt, settings.paymentTermsDays);

  const company = invoice.project?.opportunity?.company;
  const address = company?.address;

  const billToSnapshot = {
    companyName: company?.name ?? '',
    address: [
      address?.addressStreet1,
      address?.addressStreet2,
      [address?.addressPostcode, address?.addressCity].filter(Boolean).join(' '),
      address?.addressState,
      address?.addressCountry,
    ]
      .filter((part) => part && String(part).trim().length > 0)
      .join(', '),
  };

  const documentNumber = formatDocumentNumber(
    settings.invoicePrefix,
    settings.invoicePadding,
    await takeNextInvoiceSequence(settings),
  );

  const { updateInvoice } = await client.mutation({
    updateInvoice: {
      __args: {
        id: invoice.id,
        data: {
          name: documentNumber,
          documentNumber,
          status: 'ISSUED',
          issuedAt: issuedAt.toISOString(),
          dueDate: dueDate.toISOString(),
          // Payment instructions travel with the issuer, frozen here rather
          // than read live when the client opens the page - changing the bank
          // details next month must not rewrite an invoice already sent.
          issuerSnapshot: {
            ...settings.issuer,
            paymentInstructions: settings.paymentInstructions,
          },
          billToSnapshot,
        },
      },
      id: true,
      documentNumber: true,
      shareToken: true,
      dueDate: true,
    },
  });

  if (!updateInvoice) {
    return new Response(
      {
        error: 'Invoice update failed after the number was assigned',
        documentNumber,
      },
      { status: 500 },
    );
  }

  return {
    ok: true,
    documentNumber: updateInvoice.documentNumber,
    amount: formatMoney(amountMicros, currencyCode),
    dueDate: String(updateInvoice.dueDate ?? '').slice(0, 10),
    shareUrl: `/s/invoice?token=${updateInvoice.shareToken}`,
  };
};

const handler = async (payload: RoutePayload<IssueInvoiceBody>) => {
  try {
    return await run(payload);
  } catch (error) {
    return new Response(
      {
        error: `Could not issue the invoice: ${
          error instanceof Error ? error.message : String(error)
        }`,
      },
      { status: 500 },
    );
  }
};

export default defineLogicFunction({
  universalIdentifier: ISSUE_INVOICE_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'issue-invoice',
  description:
    'Assigns the invoice number, freezes issuer and client details, sets the due date from payment terms',
  timeoutSeconds: 10,
  handler,
  httpRouteTriggerSettings: {
    path: '/invoices/issue',
    httpMethod: 'POST',
    isAuthRequired: true,
  },
});
