import { defineLogicFunction } from 'twenty-sdk/define';
import { Response, type RoutePayload } from 'twenty-sdk/logic-function';

import { SAVE_QUOTE_SETTINGS_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/quote-identifiers';
import {
  getQuoteSettings,
  saveQuoteSettings,
  type QuoteSettings,
} from 'src/lib/quote-settings';
import { formatDocumentNumber } from 'src/lib/quote-math';

/**
 * Save the billing settings.
 *
 * Two things this deliberately will NOT do:
 *
 *   - move the sequence backwards. Reusing a document number means two
 *     different documents claiming to be Q-0007, which is the sort of thing an
 *     accountant finds months later. Forward is allowed (skipping numbers to
 *     match an existing paper series is a real need); backward is refused.
 *   - accept a nonsense tax rate. Everything else is the user's business.
 *
 * Settings are read at issue time and frozen onto the quote, so editing them
 * never changes a document that has already gone out.
 */

const clampPadding = (value: unknown) =>
  Math.min(Math.max(Math.round(Number(value) || 4), 1), 10);

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

  if (requestedSequence < current.nextQuoteSequence) {
    return new Response(
      {
        error: `The next number cannot go backwards. It is already at ${current.nextQuoteSequence} - moving it back would let two documents share a number.`,
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
  timeoutSeconds: 5,
  handler,
  httpRouteTriggerSettings: {
    path: '/quote-settings',
    httpMethod: 'POST',
    isAuthRequired: true,
  },
});
