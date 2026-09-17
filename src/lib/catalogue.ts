/**
 * Turning catalogue entries into quotation lines.
 *
 * Pure, and the rule it exists to hold is one sentence: a line is a COPY, not
 * a reference. Everything the client will read is frozen onto the line the
 * moment it is added, so repricing a product later cannot change a quotation -
 * draft or sent - that was built from it.
 */

export type CatalogueProduct = {
  id: string;
  name?: string | null;
  code?: string | null;
  description?: string | null;
  unit?: string | null;
  isTaxable?: boolean | null;
  isActive?: boolean | null;
  category?: string | null;
  unitPrice?: { amountMicros?: number | null; currencyCode?: string | null } | null;
};

export type PickedProduct = { productId: string; quantity: number };

export type SeededQuoteLine = {
  name: string;
  description: string;
  quantity: number;
  unit: string;
  isTaxable: boolean;
  lineOrder: number;
  productId: string;
  unitPrice: { amountMicros: number; currencyCode: string };
};

/** A quantity a client could be billed for. Zero, blank and negative are not. */
export const normaliseQuantity = (value: unknown) => {
  const quantity = Number(value);

  if (!Number.isFinite(quantity) || quantity <= 0) {
    return 1;
  }

  return quantity;
};

export const productLabel = (product: CatalogueProduct) => {
  const description = (product.description ?? '').trim();
  const name = (product.name ?? '').trim();

  // The description is what the client reads; the name is the internal handle.
  // Falling back matters because issuing refuses a line with no description.
  return description.length > 0 ? description : name;
};

/**
 * Build the lines for a set of picked products.
 *
 * `startingOrder` is the highest lineOrder already on the quote, so adding to a
 * quotation that already has lines appends rather than interleaving.
 */
export const linesFromProducts = ({
  picked,
  products,
  fallbackCurrencyCode,
  startingOrder = 0,
}: {
  picked: PickedProduct[];
  products: CatalogueProduct[];
  fallbackCurrencyCode: string;
  startingOrder?: number;
}): SeededQuoteLine[] => {
  const byId = new Map(products.map((product) => [product.id, product]));
  const lines: SeededQuoteLine[] = [];

  // Ordered by the pick list, not by the catalogue - the document should print
  // in the order it was put together.
  picked.forEach((pick) => {
    const product = byId.get(pick.productId);

    if (!product) {
      return;
    }

    lines.push({
      name: (product.name ?? '').trim() || productLabel(product) || 'Item',
      description: productLabel(product),
      quantity: normaliseQuantity(pick.quantity),
      unit: (product.unit ?? '').trim(),
      isTaxable: product.isTaxable !== false,
      lineOrder: startingOrder + lines.length + 1,
      productId: product.id,
      unitPrice: {
        amountMicros: Number(product.unitPrice?.amountMicros ?? 0),
        currencyCode: product.unitPrice?.currencyCode ?? fallbackCurrencyCode,
      },
    });
  });

  return lines;
};

export const highestLineOrder = (
  existing: { lineOrder?: number | null }[],
) =>
  existing.reduce(
    (highest, line) => Math.max(highest, Number(line.lineOrder ?? 0)),
    0,
  );

/** Products with no price are a half-finished catalogue entry, not a free item. */
export const unpricedProducts = (
  picked: PickedProduct[],
  products: CatalogueProduct[],
) => {
  const byId = new Map(products.map((product) => [product.id, product]));

  return picked
    .map((pick) => byId.get(pick.productId))
    .filter(
      (product): product is CatalogueProduct =>
        Boolean(product) &&
        Number(product?.unitPrice?.amountMicros ?? 0) <= 0,
    );
};
