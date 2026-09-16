/**
 * Quote arithmetic, deliberately free of any Twenty import.
 *
 * Keeping this pure is the hedge against the SDK moving under us: a breaking
 * change in twenty-sdk costs us the wiring, never the rules. It is also the only
 * part of the quote worth unit testing.
 *
 * All money is handled in MICROS (1 unit = 1,000,000 micros), which is how
 * Twenty stores CURRENCY fields. Working in integers avoids the classic
 * 0.1 + 0.2 problem on a document a client is going to sign.
 */

export const MICROS = 1_000_000;

export type DiscountType = 'NONE' | 'PERCENT' | 'AMOUNT';

export type QuoteLine = {
  quantity: number;
  unitPriceMicros: number;
  isTaxable: boolean;
};

export type QuoteTotals = {
  subtotalMicros: number;
  discountMicros: number;
  taxableMicros: number;
  taxMicros: number;
  totalMicros: number;
};

export const toMicros = (amount: number) => Math.round(amount * MICROS);
export const fromMicros = (micros: number) => micros / MICROS;

export const lineAmountMicros = (line: QuoteLine) =>
  Math.round(line.quantity * line.unitPriceMicros);

/**
 * Discount applies to the whole quote, tax only to taxable lines.
 *
 * When a quote mixes taxable and non-taxable lines, the discount is spread
 * proportionally before tax is worked out - otherwise discounting a quote would
 * quietly change how much of it is taxable, which an auditor would query.
 */
export const calculateTotals = ({
  lines,
  discountType,
  discountValue,
  taxRate,
  isTaxRegistered,
}: {
  lines: QuoteLine[];
  discountType: DiscountType;
  discountValue: number;
  taxRate: number;
  isTaxRegistered: boolean;
}): QuoteTotals => {
  const subtotalMicros = lines.reduce(
    (sum, line) => sum + lineAmountMicros(line),
    0,
  );

  const rawDiscountMicros =
    discountType === 'PERCENT'
      ? Math.round((subtotalMicros * discountValue) / 100)
      : discountType === 'AMOUNT'
        ? toMicros(discountValue)
        : 0;

  // A discount can never exceed the quote, and never goes negative.
  const discountMicros = Math.min(Math.max(rawDiscountMicros, 0), subtotalMicros);
  const taxableMicros = subtotalMicros - discountMicros;

  let taxMicros = 0;

  if (isTaxRegistered && taxRate > 0 && subtotalMicros > 0) {
    const taxableLinesMicros = lines
      .filter((line) => line.isTaxable)
      .reduce((sum, line) => sum + lineAmountMicros(line), 0);

    // Spread the discount across taxable lines in proportion to their share.
    const discountOnTaxableMicros = Math.round(
      (discountMicros * taxableLinesMicros) / subtotalMicros,
    );

    const taxBaseMicros = taxableLinesMicros - discountOnTaxableMicros;
    taxMicros = Math.round((taxBaseMicros * taxRate) / 100);
  }

  return {
    subtotalMicros,
    discountMicros,
    taxableMicros,
    taxMicros,
    totalMicros: taxableMicros + taxMicros,
  };
};

/** Q-0001, Q-0042. Prefix and padding both come from settings. */
export const formatDocumentNumber = (
  prefix: string,
  padding: number,
  sequence: number,
) => `${prefix}${String(sequence).padStart(padding, '0')}`;

export const formatMoney = (micros: number, currencyCode: string) =>
  `${currencyCode} ${fromMicros(micros).toLocaleString('en-MY', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

/**
 * A quote carries ONE currency.
 *
 * Twenty stores a currency code on every CURRENCY value, and its picker
 * defaults to the workspace currency rather than the quote's - so it is easy to
 * price a line in USD on a quote that calls itself MYR. Formatting the total
 * with the quote's currency then prints a number that is simply wrong on a
 * document somebody signs.
 *
 * There is no safe automatic answer: converting needs a rate nobody supplied,
 * and picking one side silently changes what was agreed. So issuing refuses,
 * and says which lines disagree.
 */
export type LineCurrency = { currencyCode?: string | null };

export const findCurrencyMismatches = <T extends LineCurrency>(
  lines: T[],
  quoteCurrencyCode: string,
): { index: number; currencyCode: string }[] =>
  lines
    .map((line, index) => ({ index, currencyCode: line.currencyCode ?? '' }))
    // An unset code means the amount was entered without one - it inherits the
    // quote's currency, which is the behaviour people expect.
    .filter(
      (line) =>
        line.currencyCode !== '' && line.currencyCode !== quoteCurrencyCode,
    );

/** What prints in a line's Description column. Never blank on a real document. */
export const lineLabel = (line: {
  description?: string | null;
  name?: string | null;
}) => {
  const description = (line.description ?? '').trim();

  if (description.length > 0) {
    return description;
  }

  return (line.name ?? '').trim();
};

/**
 * Turn the lines of an accepted quotation into the milestones of a project.
 *
 * Kept pure and separate from the logic function because this is the part with
 * actual rules in it: the order the client saw must survive, a line with no
 * description still needs something printable, and the money per milestone has
 * to be the line's own amount rather than a share of the total.
 */
export type QuoteLineForMilestone = {
  name?: string | null;
  description?: string | null;
  quantity?: number | null;
  lineOrder?: number | null;
  unitPrice?: { amountMicros?: number | null; currencyCode?: string | null } | null;
};

export type SeededMilestone = {
  name: string;
  lineOrder: number;
  amountMicros: number;
  currencyCode: string;
};

export const milestonesFromQuoteLines = (
  lines: QuoteLineForMilestone[],
  fallbackCurrencyCode: string,
): SeededMilestone[] =>
  [...lines]
    // The client read the quotation in a particular order. Delivery should
    // present the same order back to them.
    .sort((a, b) => Number(a.lineOrder ?? 0) - Number(b.lineOrder ?? 0))
    .map((line, index) => ({
      name: lineLabel(line) || `Milestone ${index + 1}`,
      lineOrder: index,
      amountMicros: lineAmountMicros({
        quantity: Number(line.quantity ?? 0),
        unitPriceMicros: Number(line.unitPrice?.amountMicros ?? 0),
        isTaxable: true,
      }),
      currencyCode: line.unitPrice?.currencyCode || fallbackCurrencyCode,
    }));
