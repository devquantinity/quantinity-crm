import { describe, expect, it } from 'vitest';

import {
  calculateTotals,
  findCurrencyMismatches,
  highestSequenceInUse,
  lineLabel,
  milestonesFromQuoteLines,
  sequenceOfDocumentNumber,
  toMicros,
} from 'src/lib/quote-math';

describe('findCurrencyMismatches', () => {
  it('accepts lines with no currency code - they inherit the quote currency', () => {
    expect(
      findCurrencyMismatches([{ currencyCode: null }, {}], 'MYR'),
    ).toHaveLength(0);
  });

  it('flags a line priced in another currency, with its line number', () => {
    const found = findCurrencyMismatches(
      [{ currencyCode: 'MYR' }, { currencyCode: 'USD' }],
      'MYR',
    );

    expect(found).toEqual([{ index: 1, currencyCode: 'USD' }]);
  });
});

describe('lineLabel', () => {
  it('prefers the description', () => {
    expect(lineLabel({ description: 'Data migration', name: 'Migration' })).toBe(
      'Data migration',
    );
  });

  it('falls back to the name when the description is blank', () => {
    expect(lineLabel({ description: '   ', name: 'Migration' })).toBe(
      'Migration',
    );
  });

  it('is empty when there is nothing to print', () => {
    expect(lineLabel({})).toBe('');
  });
});

describe('calculateTotals', () => {
  it('spreads a discount across taxable and non-taxable lines', () => {
    const totals = calculateTotals({
      lines: [
        { quantity: 1, unitPriceMicros: toMicros(1000), isTaxable: true },
        { quantity: 1, unitPriceMicros: toMicros(1000), isTaxable: false },
      ],
      discountType: 'PERCENT',
      discountValue: 10,
      taxRate: 10,
      isTaxRegistered: true,
    });

    // 2000 subtotal, 200 discount, half of it lands on the taxable 1000,
    // so tax is 10% of 900 = 90.
    expect(totals.subtotalMicros).toBe(toMicros(2000));
    expect(totals.discountMicros).toBe(toMicros(200));
    expect(totals.taxMicros).toBe(toMicros(90));
    expect(totals.totalMicros).toBe(toMicros(1890));
  });

  it('charges no tax until the business is registered', () => {
    const totals = calculateTotals({
      lines: [{ quantity: 2, unitPriceMicros: toMicros(500), isTaxable: true }],
      discountType: 'NONE',
      discountValue: 0,
      taxRate: 8,
      isTaxRegistered: false,
    });

    expect(totals.taxMicros).toBe(0);
    expect(totals.totalMicros).toBe(toMicros(1000));
  });

  it('never lets a discount exceed the quote', () => {
    const totals = calculateTotals({
      lines: [{ quantity: 1, unitPriceMicros: toMicros(100), isTaxable: true }],
      discountType: 'AMOUNT',
      discountValue: 500,
      taxRate: 0,
      isTaxRegistered: false,
    });

    expect(totals.discountMicros).toBe(toMicros(100));
    expect(totals.totalMicros).toBe(0);
  });
});

describe('milestonesFromQuoteLines', () => {
  it('keeps the order the client saw, renumbering from zero', () => {
    const seeded = milestonesFromQuoteLines(
      [
        { name: 'Training', lineOrder: 5 },
        { name: 'Setup', lineOrder: 2 },
        { name: 'Migration', lineOrder: 3 },
      ],
      'MYR',
    );

    expect(seeded.map((m) => m.name)).toEqual(['Setup', 'Migration', 'Training']);
    expect(seeded.map((m) => m.lineOrder)).toEqual([0, 1, 2]);
  });

  it('bills each milestone its own line amount, not a share of the total', () => {
    const seeded = milestonesFromQuoteLines(
      [
        { name: 'Setup', lineOrder: 0, quantity: 1, unitPrice: { amountMicros: toMicros(5000), currencyCode: 'MYR' } },
        { name: 'Training', lineOrder: 1, quantity: 2, unitPrice: { amountMicros: toMicros(1200), currencyCode: 'MYR' } },
      ],
      'MYR',
    );

    expect(seeded[0].amountMicros).toBe(toMicros(5000));
    expect(seeded[1].amountMicros).toBe(toMicros(2400));
  });

  it('prefers the description, falls back to the name, then to a number', () => {
    const seeded = milestonesFromQuoteLines(
      [
        { description: 'Data migration', name: 'Migration', lineOrder: 0 },
        { name: 'Training', lineOrder: 1 },
        { lineOrder: 2 },
      ],
      'MYR',
    );

    expect(seeded.map((m) => m.name)).toEqual([
      'Data migration',
      'Training',
      'Milestone 3',
    ]);
  });

  it('falls back to the quote currency when a line has none', () => {
    const seeded = milestonesFromQuoteLines(
      [{ name: 'Setup', lineOrder: 0, quantity: 1, unitPrice: { amountMicros: toMicros(100) } }],
      'MYR',
    );

    expect(seeded[0].currencyCode).toBe('MYR');
  });

  it('returns nothing for a quote with no lines', () => {
    expect(milestonesFromQuoteLines([], 'MYR')).toEqual([]);
  });
});

describe('reading a sequence back out of a document number', () => {
  it('reads the padded number', () => {
    expect(sequenceOfDocumentNumber('Q-0051')).toBe(51);
    expect(sequenceOfDocumentNumber('INV-0003')).toBe(3);
  });

  it('does not care what the prefix was', () => {
    expect(sequenceOfDocumentNumber('QUO/2026/0007')).toBe(7);
    expect(sequenceOfDocumentNumber('7')).toBe(7);
  });

  it('ignores padding that has since changed', () => {
    expect(sequenceOfDocumentNumber('Q-51')).toBe(51);
  });

  it('counts a draft as nothing', () => {
    expect(sequenceOfDocumentNumber('')).toBe(0);
    expect(sequenceOfDocumentNumber(null)).toBe(0);
    expect(sequenceOfDocumentNumber(undefined)).toBe(0);
    expect(sequenceOfDocumentNumber('DRAFT')).toBe(0);
  });

  it('takes the highest across a series', () => {
    expect(highestSequenceInUse(['Q-0001', 'Q-0051', '', null, 'Q-0009'])).toBe(51);
  });

  it('is zero when nothing is numbered', () => {
    expect(highestSequenceInUse([])).toBe(0);
    expect(highestSequenceInUse([null, undefined, ''])).toBe(0);
  });

  it('is not fooled by string ordering', () => {
    expect(highestSequenceInUse(['Q-9', 'Q-0051'])).toBe(51);
  });
});
