import { defineLogicFunction } from 'twenty-sdk/define';
import { Response, type RoutePayload } from 'twenty-sdk/logic-function';
import { CoreApiClient } from 'twenty-client-sdk/core';

import { SAVE_QUOTE_SETTINGS_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/quote-identifiers';
import {
  getQuoteSettings,
  saveQuoteSettings,
  type QuoteSettings,
} from 'src/lib/quote-settings';
import {
  formatDocumentNumber,
  highestSequenceInUse,
} from 'src/lib/quote-math';
import { sequenceRewindRefusal } from 'src/lib/route-guards';

/**
 * Save the billing settings.
 *
 * Two things this deliberately will NOT do:
 *
 *   - move the sequence onto a number a document already carries. Two
 *     documents claiming to be Q-0007 is the sort of thing an accountant finds
 *     months later. Forward is always allowed (skipping numbers to match an
 *     existing paper series is a real need); backward is allowed only over
 *     ground nothing stands on, which is what makes starting the real series at
 *     Q-0001 possible once the test documents are gone.
 *   - accept a nonsense tax rate. Everything else is the user's business.
 *
 * Settings are read at issue time and frozen onto the quote, so editing them
 * never changes a document that has already gone out.
 */

const clampPadding = (value: unknown) =>
  Math.min(Math.max(Math.round(Number(value) || 4), 1), 10);

/**
 * The highest number any document in a series currently carries.
 *
 * Asked only when someone tries to move a counter backwards, so the cost lands
 * on the once-in-the-life-of-a-workspace action rather than on every save.
 *
 * Two queries, because a document in the trash still owns its number - undelete
 * is one click - and Twenty leaves soft-deleted records out unless the filter
 * asks for them. Ordering is by the number as text, which is exactly right
 * while the padding is fixed; the page of 200 is the margin for a workspace
 * whose padding changed mid-series.
 */
const LOOKUP_PAGE = 200;

type NumberedEdge = { node?: { documentNumber?: string | null } | null } | null;

const numbersFrom = async (
  fetchPage: (trashed: boolean) => Promise<NumberedEdge[]>,
) => {
  const numbers: (string | null | undefined)[] = [];

  for (const edge of await fetchPage(false)) {
    numbers.push(edge?.node?.documentNumber);
  }

  // The trash is the half of this that matters and the half that might not
  // answer: if the deletedAt filter is ever refused, a settings save should
  // not 500 over it. Fall back to what the live pass knows and say so in the
  // log - the worst case is the counter allowing a number a trashed document
  // still holds, which only bites if that document is ever restored.
  try {
    for (const edge of await fetchPage(true)) {
      numbers.push(edge?.node?.documentNumber);
    }
  } catch (error) {
    console.warn('could not read the trash for document numbers', error);
  }

  return highestSequenceInUse(numbers);
};

const highestQuoteNumberInUse = () =>
  numbersFrom(async (trashed) => {
    const client = new CoreApiClient();

    const { quotes } = await client.query({
      quotes: {
        __args: {
          filter: {
            documentNumber: { is: 'NOT_NULL' },
            ...(trashed ? { deletedAt: { is: 'NOT_NULL' } } : {}),
          },
          orderBy: [{ documentNumber: 'DescNullsLast' }],
          first: LOOKUP_PAGE,
        },
        edges: { node: { documentNumber: true } },
      },
    });

    return (quotes?.edges ?? []) as unknown as NumberedEdge[];
  });

const highestInvoiceNumberInUse = () =>
  numbersFrom(async (trashed) => {
    const client = new CoreApiClient();

    const { invoices } = await client.query({
      invoices: {
        __args: {
          filter: {
            documentNumber: { is: 'NOT_NULL' },
            ...(trashed ? { deletedAt: { is: 'NOT_NULL' } } : {}),
          },
          orderBy: [{ documentNumber: 'DescNullsLast' }],
          first: LOOKUP_PAGE,
        },
        edges: { node: { documentNumber: true } },
      },
    });

    return (invoices?.edges ?? []) as unknown as NumberedEdge[];
  });

const handler = async (payload: RoutePayload<Partial<QuoteSettings>>) => {
  const incoming = payload.body ?? {};
  const current = await getQuoteSettings();

  const taxRate = Number(incoming.taxRate ?? current.taxRate);

  if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100) {
    return new Response(
      { error: 'Tax rate must be between 0 and 100' },
      { status: 422 },
    );
  }

  const requestedSequence = Math.round(
    Number(incoming.nextQuoteSequence ?? current.nextQuoteSequence),
  );

  const quoteRefusal = sequenceRewindRefusal({
    label: 'quotation',
    requested: requestedSequence,
    current: current.nextQuoteSequence,
    highestInUse:
      requestedSequence < current.nextQuoteSequence
        ? await highestQuoteNumberInUse()
        : 0,
  });

  if (quoteRefusal) {
    return new Response(
      { error: quoteRefusal.error },
      { status: quoteRefusal.status },
    );
  }

  const requestedInvoiceSequence = Math.round(
    Number(incoming.nextInvoiceSequence ?? current.nextInvoiceSequence),
  );

  const invoiceRefusal = sequenceRewindRefusal({
    label: 'invoice',
    requested: requestedInvoiceSequence,
    current: current.nextInvoiceSequence,
    highestInUse:
      requestedInvoiceSequence < current.nextInvoiceSequence
        ? await highestInvoiceNumberInUse()
        : 0,
  });

  if (invoiceRefusal) {
    return new Response(
      { error: invoiceRefusal.error },
      { status: invoiceRefusal.status },
    );
  }

  const publicBaseUrl = String(incoming.publicBaseUrl ?? current.publicBaseUrl)
    .trim()
    .replace(/\/+$/, '');

  if (publicBaseUrl.length > 0 && !/^https?:\/\/.+/i.test(publicBaseUrl)) {
    return new Response(
      {
        error:
          'The client link address must start with http:// or https://, or be left empty.',
      },
      { status: 422 },
    );
  }

  const next: QuoteSettings = {
    ...current,
    ...incoming,
    currencyCode: (incoming.currencyCode ?? current.currencyCode)
      .trim()
      .toUpperCase()
      .slice(0, 3),
    quotePrefix: (incoming.quotePrefix ?? current.quotePrefix).trim().slice(0, 10),
    quotePadding: clampPadding(incoming.quotePadding ?? current.quotePadding),
    nextQuoteSequence: Math.max(requestedSequence, 1),
    invoicePrefix: (incoming.invoicePrefix ?? current.invoicePrefix)
      .trim()
      .slice(0, 10),
    invoicePadding: clampPadding(incoming.invoicePadding ?? current.invoicePadding),
    nextInvoiceSequence: Math.max(requestedInvoiceSequence, 1),
    publicBaseUrl,
    paymentTermsDays: Math.min(
      Math.max(
        Math.round(Number(incoming.paymentTermsDays ?? current.paymentTermsDays) || 14),
        0,
      ),
      365,
    ),
    validityDays: Math.min(
      Math.max(Math.round(Number(incoming.validityDays ?? current.validityDays) || 30), 1),
      365,
    ),
    taxRate,
    isTaxRegistered: incoming.isTaxRegistered === true,
    issuer: { ...current.issuer, ...(incoming.issuer ?? {}) },
  };

  await saveQuoteSettings(next);

  return {
    ok: true,
    ...next,
    nextDocumentNumberPreview: formatDocumentNumber(
      next.quotePrefix,
      next.quotePadding,
      next.nextQuoteSequence,
    ),
  };
};

export default defineLogicFunction({
  universalIdentifier: SAVE_QUOTE_SETTINGS_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'save-quote-settings',
  description: 'Saves the billing settings used when a quote is issued',
  timeoutSeconds: 10,
  handler,
  httpRouteTriggerSettings: {
    path: '/quote-settings',
    httpMethod: 'POST',
    isAuthRequired: true,
  },
});
