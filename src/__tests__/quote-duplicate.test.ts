import { describe, expect, it } from 'vitest';

import {
  draftFromQuote,
  duplicateName,
  linesFromQuote,
} from 'src/lib/quote-duplicate';

const issued = {
  id: 'q1',
  name: 'Q-0051',
  documentNumber: 'Q-0051',
  status: 'ISSUED',
  isTemplate: false,
  discountType: 'PERCENT',
  discountValue: 10,
  terms: '50% deposit on acceptance',
};

describe('duplicateName', () => {
  it('marks a copy of a real quotation as a copy', () => {
    expect(duplicateName(issued)).toBe('Copy of Q-0051');
  });

  it('keeps a template name as it is - the copy IS the new quotation', () => {
    expect(
      duplicateName({ id: 't', name: 'Standard website build', isTemplate: true }),
    ).toBe('Standard website build');
  });

  it('falls back to the document number, then to something printable', () => {
    expect(duplicateName({ id: 'q', name: '   ', documentNumber: 'Q-0007' })).toBe(
      'Copy of Q-0007',
    );
    expect(duplicateName({ id: 'q' })).toBe('Copy of Quotation');
  });
});

describe('draftFromQuote', () => {
  const draft = draftFromQuote(issued);

  it('always starts as a draft, never a template', () => {
    expect(draft.status).toBe('DRAFT');
    expect(draft.isTemplate).toBe(false);
  });

  it('carries the commercial terms across', () => {
    expect(draft.discountType).toBe('PERCENT');
    expect(draft.discountValue).toBe(10);
    expect(draft.terms).toBe('50% deposit on acceptance');
  });

  it('carries NOTHING that identifies the document it was copied from', () => {
    const keys = Object.keys(draft);

    [
      'documentNumber',
      'revision',
      'issuedAt',
      'validUntil',
      'acceptedAt',
      'acceptedByName',
      'acceptedVia',
      'shareToken',
      'subtotal',
      'total',
      'issuerSnapshot',
      'billToSnapshot',
      'opportunityId',
    ].forEach((field) => expect(keys).not.toContain(field));
  });
});

describe('linesFromQuote', () => {
  const lines = [
    { name: 'B', description: 'Hosting', quantity: 12, unit: 'month', lineOrder: 7,
      isTaxable: true, product: { id: 'p2' },
      unitPrice: { amountMicros: 150_000_000, currencyCode: 'MYR' } },
    { name: 'A', description: 'Design', quantity: 1, unit: 'project', lineOrder: 4,
      isTaxable: true, product: { id: 'p1' },
      unitPrice: { amountMicros: 6_000_000_000, currencyCode: 'MYR' } },
  ];

  it('keeps the source order but renumbers from one, closing any gaps', () => {
    const copied = linesFromQuote(lines);

    expect(copied.map((line) => line.description)).toEqual(['Design', 'Hosting']);
    expect(copied.map((line) => line.lineOrder)).toEqual([1, 2]);
  });

  it('copies the frozen price, not a fresh catalogue lookup', () => {
    const [design] = linesFromQuote(lines);

    expect(design.unitPrice).toEqual({ amountMicros: 6_000_000_000, currencyCode: 'MYR' });
  });

  it('keeps the product link so the copy is still traceable', () => {
    expect(linesFromQuote(lines).map((line) => line.productId)).toEqual(['p1', 'p2']);
  });

  it('survives a line whose product was deleted', () => {
    const [line] = linesFromQuote([{ description: 'One-off', quantity: 1 }]);

    expect(line.productId).toBeNull();
    expect(line.quantity).toBe(1);
    expect(line.name).toBe('Item');
  });
});
