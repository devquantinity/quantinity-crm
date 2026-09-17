import type { DiscountType } from 'src/lib/quote-math';

/**
 * What survives a duplicate, and what must not.
 *
 * Pure, and separate from the route because the interesting part of Duplicate
 * is the list of things it deliberately drops. Getting that list wrong means a
 * new quotation carrying another one's number, acceptance or frozen client
 * details - and those are the fields a client would act on.
 */

export type SourceQuote = {
  id: string;
  name?: string | null;
  documentNumber?: string | null;
  status?: string | null;
  isTemplate?: boolean | null;
  discountType?: string | null;
  discountValue?: number | null;
  terms?: string | null;
};

export type SourceLine = {
  name?: string | null;
  description?: string | null;
  quantity?: number | null;
  unit?: string | null;
  isTaxable?: boolean | null;
  lineOrder?: number | null;
  product?: { id?: string | null } | null;
  unitPrice?: { amountMicros?: number | null; currencyCode?: string | null } | null;
};

/**
 * The name of the copy.
 *
 * A template keeps its own name on the copy - "Standard website build" is what
 * you want to see on the new draft, not "Copy of Standard website build".
 * Copying a real quotation is the other way round: the copy must not be
 * mistakable for the document that was actually sent.
 */
export const duplicateName = (quote: SourceQuote) => {
  const source = (quote.name ?? '').trim() || quote.documentNumber || 'Quotation';

  return quote.isTemplate ? String(source) : `Copy of ${source}`;
};

/**
 * Everything the copy carries over. Note what is NOT here: documentNumber,
 * revision, status, issuedAt, validUntil, the three accepted* fields,
 * shareToken, subtotal, total, issuerSnapshot, billToSnapshot - and the
 * opportunity.
 *
 * The opportunity is dropped on purpose. Revise is the command for "same deal,
 * next version"; Duplicate is for "another job that looks like this one", and
 * that is usually a different client. Carrying the deal over would quietly
 * address a quotation to whoever the last one was for. Leaving it empty means
 * issuing refuses until someone attaches the right deal, which is a loud
 * failure instead of a silent one.
 */
export const draftFromQuote = (quote: SourceQuote) => ({
  name: duplicateName(quote),
  status: 'DRAFT' as const,
  isTemplate: false,
  discountType: (quote.discountType ?? 'NONE') as DiscountType,
  discountValue: Number(quote.discountValue ?? 0),
  terms: quote.terms ?? '',
});

export const linesFromQuote = (lines: SourceLine[]) =>
  [...lines]
    .sort((a, b) => Number(a.lineOrder ?? 0) - Number(b.lineOrder ?? 0))
    .map((line, index) => ({
      name: (line.name ?? '').trim() || 'Item',
      description: line.description ?? '',
      quantity: Number(line.quantity ?? 1),
      unit: line.unit ?? '',
      isTaxable: line.isTaxable !== false,
      // Renumbered from one. A source whose lines were 4, 7, 9 should not hand
      // its gaps to the copy.
      lineOrder: index + 1,
      productId: line.product?.id ?? null,
      unitPrice: {
        amountMicros: Number(line.unitPrice?.amountMicros ?? 0),
        currencyCode: line.unitPrice?.currencyCode ?? null,
      },
    }));
