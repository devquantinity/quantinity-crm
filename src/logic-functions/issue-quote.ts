import { defineLogicFunction } from 'twenty-sdk/define';
import { Response, type RoutePayload } from 'twenty-sdk/logic-function';
import { CoreApiClient } from 'twenty-client-sdk/core';

import { ISSUE_QUOTE_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/quote-identifiers';
import {
  calculateTotals,
  formatDocumentNumber,
  addDays,
  findCurrencyMismatches,
  lineLabel,
  type DiscountType,
} from 'src/lib/quote-math';
import {
  getQuoteSettings,
  takeNextQuoteSequence,
} from 'src/lib/quote-settings';
import {
  billToSnapshotFromCompany,
  isBillToEmpty,
} from 'src/lib/document-parties';
import { absoluteShareUrl } from 'src/lib/share-url';

/**
 * Issue a draft quote.
 *
 * This is the one irreversible step in the quote lifecycle, and everything it
 * does is about making the document stop moving:
 *
 *   1. assigns the next continuous number (Q-0001)
 *   2. freezes the issuer and bill-to details onto the record, so changing your
 *      business address next year never rewrites a document already sent
 *   3. locks the totals, so a later price change in the catalog cannot alter
 *      what the client agreed to
 *   4. sets the expiry from the settings' validity window
 *
 * After this the quote is read-only. A change means a revision, which is a new
 * record that supersedes this one - never an edit in place.
 */

type IssueQuoteBody = { quoteId?: string };

const handler = async (payload: RoutePayload<IssueQuoteBody>) => {
  const quoteId = payload.body?.quoteId;

  if (!quoteId) {
    return new Response(
      { error: 'quoteId is required' },
      { status: 400 },
    );
  }

  const client = new CoreApiClient();

  const { quote } = await client.query({
    quote: {
      __args: { filter: { id: { eq: quoteId } } },
      id: true,
      name: true,
      status: true,
      revision: true,
      documentNumber: true,
      discountType: true,
      discountValue: true,
      terms: true,
      opportunity: { id: true, name: true },
      quoteItems: {
        edges: {
          node: {
            id: true,
            name: true,
            description: true,
            quantity: true,
            isTaxable: true,
            unitPrice: { amountMicros: true, currencyCode: true },
          },
        },
      },
    },
  });

  if (!quote) {
    return new Response({ error: 'Quote not found' }, { status: 404 });
  }

  // Issuing is only legal from DRAFT. Anything else is a double-click, a retry,
  // or someone trying to re-issue a document a client already has.
  if (quote.status !== 'DRAFT') {
    return new Response(
      {
        error: `Quote is ${quote.status}, only a DRAFT can be issued`,
        documentNumber: quote.documentNumber,
      },
      { status: 409 },
    );
  }

  const settings = await getQuoteSettings();

  const items = (quote.quoteItems?.edges ?? []).map((edge: any) => edge.node);

  if (items.length === 0) {
    return new Response(
      { error: 'A quote needs at least one line item before it can be issued' },
      { status: 422 },
    );
  }

  // Every check below runs BEFORE the sequence number is taken. A refused issue
  // must not leave a hole in the numbering.
  const unlabelled = items.filter((item: any) => lineLabel(item).length === 0);

  if (unlabelled.length > 0) {
    return new Response(
      {
        error: `${unlabelled.length} line item${unlabelled.length === 1 ? ' has' : 's have'} no description. A client cannot be asked to accept a blank line.`,
      },
      { status: 422 },
    );
  }

  const mismatches = findCurrencyMismatches(
    items.map((item: any) => ({ currencyCode: item.unitPrice?.currencyCode })),
    settings.currencyCode,
  );

  if (mismatches.length > 0) {
    const found = [...new Set(mismatches.map((m) => m.currencyCode))].join(', ');

    return new Response(
      {
        error: `This quote is in ${settings.currencyCode} but ${mismatches.length} line item${mismatches.length === 1 ? ' is' : 's are'} priced in ${found}. Reprice the line${mismatches.length === 1 ? '' : 's'}, or change the quote currency in settings - amounts are never converted automatically.`,
        lineNumbers: mismatches.map((m) => m.index + 1),
      },
      { status: 422 },
    );
  }

  const lines = items.map((item: any) => ({
    quantity: Number(item.quantity ?? 0),
    unitPriceMicros: Number(item.unitPrice?.amountMicros ?? 0),
    isTaxable: item.isTaxable !== false,
  }));

  const totals = calculateTotals({
    lines,
    discountType: (quote.discountType ?? 'NONE') as DiscountType,
    discountValue: Number(quote.discountValue ?? 0),
    taxRate: settings.taxRate,
    isTaxRegistered: settings.isTaxRegistered,
  });

  // A revision already carries the number of the quote it replaces, so it must
  // NOT take another one - Q-0001 Rev 2 is the same document, not a second one.
  const isRevision = Boolean(quote.documentNumber);

  const issuedAt = new Date();
  const validUntil = addDays(issuedAt, settings.validityDays);
  // Fetched separately: asking for quote -> opportunity -> company in one
  // query returns a null company rather than an error, and a quotation with a
  // blank "Bill to" looks fine in the app and wrong in the client's inbox.
  let company = null;

  if (quote.opportunity?.id) {
    const { opportunity } = await client.query({
      opportunity: {
        __args: { filter: { id: { eq: quote.opportunity.id } } },
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

  // Same rule as an invoice: a quotation with a blank "Bill to" looks fine in
  // the app and wrong in the client's inbox. Refuse before the number is taken.
  if (isBillToEmpty(billToSnapshot)) {
    const missing = !quote.opportunity?.id
      ? 'this quotation is not attached to a deal'
      : !company
        ? 'that deal has no company on it'
        : 'that company has no name';

    return new Response(
      {
        error: `There is nobody to address this to: ${missing}. A quotation cannot go out with a blank "Bill to".`,
      },
      { status: 422 },
    );
  }

  // Last look before anything irreversible happens.
  //
  // Everything above this line is reads and arithmetic, and some of it is slow -
  // the company is a second round trip on purpose. That is a long time to hold a
  // decision made from a snapshot. If a second request got here first while we
  // were working, the quote is no longer DRAFT and this one must not issue it
  // again: two document numbers, two client links, one quotation.
  //
  // This is not a lock. Two requests that pass this check within the same
  // instant will both proceed, and closing that properly needs a conditional
  // update the API does not offer. What it does remove is the realistic case -
  // a second click landing while the first is still doing its round trips -
  // which is a window of hundreds of milliseconds rather than none.
  const { quotes: recheck } = await client.query({
    quotes: {
      __args: { filter: { id: { eq: quoteId } }, first: 1 },
      edges: { node: { id: true, status: true, documentNumber: true } },
    },
  });

  const current = (recheck?.edges ?? [])[0]?.node;

  if (current && current.status !== 'DRAFT') {
    return new Response(
      {
        error: `This quotation was issued a moment ago${
          current.documentNumber ? ` as ${current.documentNumber}` : ''
        }. Refresh to see it.`,
      },
      { status: 409 },
    );
  }

  // The number is taken HERE, last, and only once nothing can still refuse.
  //
  // It used to be assigned before the "nobody to bill" check below, which meant
  // a quotation with no client on it consumed Q-0053 and then refused - leaving
  // a hole in the sequence with no document to explain it. An accountant finds
  // that gap a year later and nobody can say what happened to it.
  const documentNumber = isRevision
    ? String(quote.documentNumber)
    : formatDocumentNumber(
        settings.quotePrefix,
        settings.quotePadding,
        await takeNextQuoteSequence(settings),
      );

  const revision = Number(quote.revision ?? 1);
  const documentLabel =
    revision > 1 ? `${documentNumber} Rev ${revision}` : documentNumber;

  const { updateQuote } = await client.mutation({
    updateQuote: {
      __args: {
        id: quoteId,
        data: {
          name: documentLabel,
          documentNumber,
          status: 'ISSUED',
          issuedAt: issuedAt.toISOString(),
          validUntil: validUntil.toISOString(),
          taxLabel: settings.taxLabel,
          taxRate: settings.taxRate,
          isTaxRegistered: settings.isTaxRegistered,
          terms: quote.terms || settings.defaultTerms,
          subtotal: {
            amountMicros: totals.subtotalMicros,
            currencyCode: settings.currencyCode,
          },
          total: {
            amountMicros: totals.totalMicros,
            currencyCode: settings.currencyCode,
          },
          issuerSnapshot: settings.issuer,
          billToSnapshot,
        },
      },
      id: true,
      documentNumber: true,
      status: true,
      shareToken: true,
      total: { amountMicros: true, currencyCode: true },
    },
  });

  if (!updateQuote) {
    // The number was already consumed, so surface this rather than silently
    // leaving a gap in the sequence with no document to explain it.
    return new Response(
      { error: 'Quote update failed after the number was assigned', documentNumber },
      { status: 500 },
    );
  }

  // Only now, with the revision safely issued, does the version it replaces stop
  // being the live offer. Doing this earlier would leave the client holding a
  // superseded quote and nothing to replace it with.
  let supersededCount = 0;

  if (isRevision) {
    const { quotes: predecessors } = await client.query({
      quotes: {
        __args: {
          filter: {
            documentNumber: { eq: documentNumber },
            status: { in: ['ISSUED', 'ACCEPTED'] },
          },
        },
        edges: { node: { id: true, revision: true, status: true } },
      },
    });

    for (const edge of predecessors?.edges ?? []) {
      const node = (edge as any).node;

      if (node.id === quoteId || Number(node.revision ?? 1) >= revision) {
        continue;
      }

      await client.mutation({
        updateQuote: {
          __args: { id: node.id, data: { status: 'SUPERSEDED' } },
          id: true,
        },
      });

      supersededCount += 1;
    }
  }

  return {
    ok: true,
    supersededCount,
    documentNumber: updateQuote.documentNumber,
    status: updateQuote.status,
    // The link to hand the client.
    shareUrl: absoluteShareUrl(
      `/s/quote?token=${updateQuote.shareToken}`,
      payload.headers,
      settings.publicBaseUrl,
    ),
    total: updateQuote.total,
  };
};

export default defineLogicFunction({
  universalIdentifier: ISSUE_QUOTE_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'issue-quote',
  description:
    'Assigns the document number, freezes issuer and bill-to details and locks the totals. Irreversible.',
  timeoutSeconds: 10,
  handler,
  httpRouteTriggerSettings: {
    path: '/quotes/issue',
    httpMethod: 'POST',
    isAuthRequired: true,
  },
});
