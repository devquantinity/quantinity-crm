import { defineLogicFunction } from 'twenty-sdk/define';
import { Response, type RoutePayload } from 'twenty-sdk/logic-function';
import { CoreApiClient } from 'twenty-client-sdk/core';

import { issueInvoiceRefusal } from 'src/lib/route-guards';

import { ISSUE_INVOICE_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/invoice-identifiers';
import {
  getQuoteSettings,
  takeNextInvoiceSequence,
} from 'src/lib/quote-settings';
import { formatDocumentNumber, formatMoney } from 'src/lib/quote-math';
import { addDaysToDate } from 'src/lib/invoice-math';
import {
  billToSnapshotFromCompany,
  isBillToEmpty,
} from 'src/lib/document-parties';
import { absoluteShareUrl } from 'src/lib/share-url';

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
      project: { id: true, name: true },
    },
  });

  if (!invoice) {
    return new Response({ error: 'Invoice not found' }, { status: 404 });
  }

  const amountMicros = Number(invoice.amount?.amountMicros ?? 0);
  const settings = await getQuoteSettings();

  // Every reason to refuse lives in src/lib/route-guards.ts, where it can be
  // tested without standing up a database. Notably the tax one: milestones
  // carry the quotation's pre-tax LINE amounts, so a registered business would
  // be billing the client less than they owe. That refusal is a 501 - not the
  // user's mistake, a feature that does not exist yet.
  const refusal = issueInvoiceRefusal({
    invoice,
    amountMicros,
    isTaxRegistered: settings.isTaxRegistered,
    taxLabel: settings.taxLabel,
  });

  if (refusal) {
    return new Response(
      {
        error: refusal.error,
        ...(refusal.status === 409
          ? { documentNumber: invoice.documentNumber }
          : {}),
      },
      { status: refusal.status },
    );
  }

  const currencyCode = invoice.amount?.currencyCode ?? settings.currencyCode;

  const issuedAt = new Date();
  const dueDate = addDaysToDate(issuedAt, settings.paymentTermsDays);

  // The company is fetched on its own. invoice -> project -> opportunity ->
  // company is three relations deep and Twenty hands back a null company
  // rather than an error, which is how quotations went out with a blank
  // "Bill to" for days without anyone noticing.
  // One relation hop per query. invoice -> project -> opportunity came back
  // with a null opportunity even though the project plainly has one in the UI,
  // and it fails silently rather than erroring, so each hop is asked for from
  // the root of its own query.
  let opportunityId: string | null = null;

  if (invoice.project?.id) {
    const { project } = await client.query({
      project: {
        __args: { filter: { id: { eq: invoice.project.id } } },
        id: true,
        opportunity: { id: true },
      },
    });

    opportunityId = project?.opportunity?.id ?? null;
  }

  let company = null;

  if (opportunityId) {
    const { opportunity } = await client.query({
      opportunity: {
        __args: { filter: { id: { eq: opportunityId } } },
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
    });

    company = opportunity?.company ?? null;
  }

  const billToSnapshot = billToSnapshotFromCompany(company);

  // An invoice with a blank "Bill to" is not a document you can send. Refuse
  // before the number is taken, and say exactly where the chain breaks -
  // invoice -> project -> opportunity -> company - so it can be fixed in one
  // go rather than guessed at.
  if (isBillToEmpty(billToSnapshot)) {
    const missing = !invoice.project?.id
      ? 'this invoice is not attached to a project'
      : !opportunityId
        ? `the project "${invoice.project.name}" is not attached to a deal`
        : !company
          ? 'that deal has no company on it'
          : 'that company has no name';

    return new Response(
      {
        error: `There is nobody to bill: ${missing}. An invoice cannot go out with a blank "Bill to".`,
      },
      { status: 422 },
    );
  }

  // Last look before the number is taken. Everything above is reads, and the
  // project and company are separate round trips, so a second request can have
  // arrived and finished while this one was still gathering. See the longer
  // note in issue-quote.ts - this narrows the window, it does not close it.
  const { invoices: recheck } = await client.query({
    invoices: {
      __args: { filter: { id: { eq: invoice.id } }, first: 1 },
      edges: { node: { id: true, status: true, documentNumber: true } },
    },
  });

  const current = (recheck?.edges ?? [])[0]?.node;

  if (current && current.status !== 'DRAFT') {
    return new Response(
      {
        error: `This invoice was issued a moment ago${
          current.documentNumber ? ` as ${current.documentNumber}` : ''
        }. Refresh to see it.`,
      },
      { status: 409 },
    );
  }

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
    shareUrl: absoluteShareUrl(
      `/s/invoice?token=${updateInvoice.shareToken}`,
      payload.headers,
      settings.publicBaseUrl,
    ),
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
