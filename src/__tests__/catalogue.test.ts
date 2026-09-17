import { describe, expect, it } from 'vitest';

import {
  highestLineOrder,
  linesFromProducts,
  normaliseQuantity,
  productLabel,
  unpricedProducts,
} from 'src/lib/catalogue';

const price = (amount: number, currencyCode = 'MYR') => ({
  amountMicros: amount * 1_000_000,
  currencyCode,
});

const design = {
  id: 'design',
  name: 'Website design',
  description: 'Design of up to 8 pages, two rounds of revisions',
  unit: 'project',
  category: 'Design',
  isTaxable: true,
  unitPrice: price(6000),
};

const hosting = {
  id: 'hosting',
  name: 'Hosting',
  description: 'Managed hosting and backups',
  unit: 'month',
  category: 'Hosting',
  isTaxable: true,
  unitPrice: price(150),
};

describe('normaliseQuantity', () => {
  it('refuses zero, blank and negative - a client cannot be billed for those', () => {
    expect(normaliseQuantity(0)).toBe(1);
    expect(normaliseQuantity(-4)).toBe(1);
    expect(normaliseQuantity('')).toBe(1);
    expect(normaliseQuantity(undefined)).toBe(1);
  });

  it('keeps fractional quantities - half a day is a real thing to sell', () => {
    expect(normaliseQuantity(0.5)).toBe(0.5);
    expect(normaliseQuantity('12')).toBe(12);
  });
});

describe('productLabel', () => {
  it('prefers the description, because that is what the client reads', () => {
    expect(productLabel(design)).toBe(design.description);
  });

  it('falls back to the name so a line is never blank at issue time', () => {
    expect(productLabel({ id: 'x', name: 'Retainer', description: '  ' })).toBe('Retainer');
  });
});

describe('linesFromProducts', () => {
  it('copies the price onto the line rather than pointing at the product', () => {
    const [line] = linesFromProducts({
      picked: [{ productId: 'design', quantity: 1 }],
      products: [design],
      fallbackCurrencyCode: 'MYR',
    });

    expect(line.unitPrice).toEqual({ amountMicros: 6_000_000_000, currencyCode: 'MYR' });
    expect(line.description).toBe(design.description);
    expect(line.unit).toBe('project');
    expect(line.productId).toBe('design');
  });

  it('is unaffected when the product is repriced afterwards - the whole point', () => {
    const picked = [{ productId: 'design', quantity: 1 }];
    const before = linesFromProducts({ picked, products: [design], fallbackCurrencyCode: 'MYR' });

    const repriced = { ...design, unitPrice: price(9000) };
    const after = linesFromProducts({ picked, products: [repriced], fallbackCurrencyCode: 'MYR' });

    expect(before[0].unitPrice.amountMicros).toBe(6_000_000_000);
    expect(after[0].unitPrice.amountMicros).toBe(9_000_000_000);
    // the already-built line is a plain object - nothing can reach back and change it
    expect(before[0].unitPrice.amountMicros).not.toBe(after[0].unitPrice.amountMicros);
  });

  it('keeps the order things were picked in, not catalogue order', () => {
    const lines = linesFromProducts({
      picked: [
        { productId: 'hosting', quantity: 12 },
        { productId: 'design', quantity: 1 },
      ],
      products: [design, hosting],
      fallbackCurrencyCode: 'MYR',
    });

    expect(lines.map((line) => line.productId)).toEqual(['hosting', 'design']);
    expect(lines.map((line) => line.lineOrder)).toEqual([1, 2]);
  });

  it('appends after lines the quotation already has', () => {
    const lines = linesFromProducts({
      picked: [{ productId: 'design', quantity: 1 }],
      products: [design],
      fallbackCurrencyCode: 'MYR',
      startingOrder: 4,
    });

    expect(lines[0].lineOrder).toBe(5);
  });

  it('falls back to the quote currency when a product has none', () => {
    const [line] = linesFromProducts({
      picked: [{ productId: 'x', quantity: 1 }],
      products: [{ id: 'x', name: 'Odd one', unitPrice: { amountMicros: 1_000_000 } }],
      fallbackCurrencyCode: 'MYR',
    });

    expect(line.unitPrice.currencyCode).toBe('MYR');
  });

  it('skips a product that is no longer in the catalogue instead of failing', () => {
    const lines = linesFromProducts({
      picked: [
        { productId: 'design', quantity: 1 },
        { productId: 'deleted', quantity: 1 },
      ],
      products: [design],
      fallbackCurrencyCode: 'MYR',
    });

    expect(lines).toHaveLength(1);
    expect(lines[0].lineOrder).toBe(1);
  });

  it('treats a missing taxable flag as taxable', () => {
    const [line] = linesFromProducts({
      picked: [{ productId: 'x', quantity: 1 }],
      products: [{ id: 'x', name: 'No flag', unitPrice: price(10) }],
      fallbackCurrencyCode: 'MYR',
    });

    expect(line.isTaxable).toBe(true);
  });
});

describe('highestLineOrder', () => {
  it('finds where to append', () => {
    expect(highestLineOrder([{ lineOrder: 2 }, { lineOrder: 7 }, { lineOrder: 3 }])).toBe(7);
    expect(highestLineOrder([])).toBe(0);
    expect(highestLineOrder([{ lineOrder: null }])).toBe(0);
  });
});

describe('unpricedProducts', () => {
  it('catches a half-finished catalogue entry before it quotes zero', () => {
    const free = { id: 'free', name: 'Discovery call', unitPrice: price(0) };

    expect(
      unpricedProducts([{ productId: 'free', quantity: 1 }], [free]).map((p) => p.id),
    ).toEqual(['free']);
  });

  it('says nothing about properly priced ones', () => {
    expect(unpricedProducts([{ productId: 'design', quantity: 1 }], [design])).toHaveLength(0);
  });
});
