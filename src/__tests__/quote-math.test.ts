import { describe, expect, it } from 'vitest';

import {
  calculateTotals,
  findCurrencyMismatches,
  lineLabel,
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
