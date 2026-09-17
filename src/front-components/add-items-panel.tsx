import { defineFrontComponent } from 'twenty-sdk/define';
import { useEffect, useMemo, useState } from 'react';
import {
  useSelectedRecordIds,
  enqueueSnackbar,
} from 'twenty-sdk/front-component';
import { RestApiClient } from 'twenty-client-sdk/rest';

import { commandErrorMessage } from 'src/lib/command-error';
import { formatMoney } from 'src/lib/quote-math';
import { ADD_ITEMS_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/constants/catalogue-identifiers';

/**
 * Pick several catalogue items and put them on the quotation in one go.
 *
 * The whole reason this exists: adding a line through Twenty's table takes four
 * separate interactions, and a quotation is rarely one line. Here it is one
 * pass - search, tick, set quantities, add.
 */

type Product = {
  id: string;
  name?: string | null;
  code?: string | null;
  description?: string | null;
  unit?: string | null;
  category?: string | null;
  unitPrice?: { amountMicros?: number | null; currencyCode?: string | null } | null;
};

type Catalogue = { currencyCode: string; products: Product[] };

const COLORS = {
  ink: '#15181c',
  muted: '#6b747f',
  line: '#e0e4e8',
  accent: '#0c6e66',
  surface: '#ffffff',
  ground: '#f6f7f8',
};

const microsOf = (product: Product) =>
  Number(product.unitPrice?.amountMicros ?? 0);

const AddItemsPanel = () => {
  const [recordId] = useSelectedRecordIds();
  const [catalogue, setCatalogue] = useState<Catalogue | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    new RestApiClient()
      .get<Catalogue>('/s/products')
      .then(setCatalogue)
      .catch((error) =>
        setLoadError(commandErrorMessage(error, 'Could not load the catalogue')),
      );
  }, []);

  const currencyCode = catalogue?.currencyCode ?? 'MYR';

  const matches = useMemo(() => {
    const products = catalogue?.products ?? [];
    const needle = search.trim().toLowerCase();

    if (needle.length === 0) return products;

    return products.filter((product) =>
      [product.name, product.code, product.description, product.category]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle)),
    );
  }, [catalogue, search]);

  const grouped = useMemo(() => {
    const groups = new Map<string, Product[]>();

    matches.forEach((product) => {
      const key = (product.category ?? '').trim() || 'Uncategorised';
      groups.set(key, [...(groups.get(key) ?? []), product]);
    });

    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [matches]);

  const pickedIds = Object.keys(picked);

  const runningTotal = useMemo(() => {
    const byId = new Map((catalogue?.products ?? []).map((p) => [p.id, p]));

    return pickedIds.reduce((sum, id) => {
      const product = byId.get(id);
      return product ? sum + microsOf(product) * (picked[id] || 0) : sum;
    }, 0);
  }, [picked, pickedIds, catalogue]);

  const toggle = (product: Product) =>
    setPicked((previous) => {
      if (previous[product.id]) {
        const { [product.id]: _removed, ...rest } = previous;
        return rest;
      }
      return { ...previous, [product.id]: 1 };
    });

  const setQuantity = (id: string, value: string) =>
    setPicked((previous) => ({ ...previous, [id]: Number(value) }));

  const add = async () => {
    if (!recordId) {
      await enqueueSnackbar({ message: 'Open a quotation first', variant: 'error' });
      return;
    }

    setSaving(true);

    try {
      const response = (await new RestApiClient().post('/s/quotes/add-items', {
        quoteId: recordId,
        items: pickedIds.map((productId) => ({
          productId,
          quantity: picked[productId],
        })),
      })) as { added?: number; total?: string };

      await enqueueSnackbar({
        message: `${response.added} ${
          response.added === 1 ? 'line' : 'lines'
        } added · ${response.total}`,
        variant: 'success',
      });

      // Clear the picks. The panel stays open so you can keep adding, and
      // pressing Add twice cannot quietly put the same lines on the quotation
      // a second time.
      setPicked({});
    } catch (error) {
      await enqueueSnackbar({
        message: commandErrorMessage(error, 'Could not add the items'),
        variant: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loadError) {
    return (
      <div style={{ padding: '18px', fontSize: '13px', color: '#b02525' }}>
        {loadError}
      </div>
    );
  }

  if (!catalogue) {
    return (
      <div style={{ padding: '18px', fontSize: '13px', color: COLORS.muted }}>
        Loading the catalogue…
      </div>
    );
  }

  if (catalogue.products.length === 0) {
    return (
      <div style={{ padding: '18px', fontSize: '13px', color: COLORS.muted, lineHeight: 1.5 }}>
        Nothing in the catalogue yet. Add a few products — the things you quote
        over and over — and they will show up here.
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: COLORS.ground,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        color: COLORS.ink,
      }}
    >
      <div style={{ padding: '12px 14px 10px', borderBottom: `1px solid ${COLORS.line}` }}>
        <input
          id="catalogue-search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search the catalogue"
          style={{
            width: '100%',
            padding: '8px 10px',
            fontSize: '13px',
            border: `1px solid ${COLORS.line}`,
            borderRadius: '6px',
            outline: 'none',
            background: COLORS.surface,
            color: COLORS.ink,
            fontFamily: 'inherit',
          }}
        />
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 14px 14px' }}>
        {grouped.length === 0 && (
          <p style={{ fontSize: '13px', color: COLORS.muted, margin: '8px 0' }}>
            Nothing matches “{search}”.
          </p>
        )}

        {grouped.map(([category, products]) => (
          <div key={category} style={{ marginBottom: '14px' }}>
            <div
              style={{
                fontSize: '10.5px',
                letterSpacing: '.09em',
                textTransform: 'uppercase',
                color: COLORS.muted,
                margin: '4px 0 6px',
              }}
            >
              {category}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {products.map((product) => {
                const isPicked = Boolean(picked[product.id]);

                return (
                  <div
                    key={product.id}
                    style={{
                      background: COLORS.surface,
                      border: `1px solid ${isPicked ? COLORS.accent : COLORS.line}`,
                      borderRadius: '8px',
                      padding: '9px 11px',
                    }}
                  >
                    <label
                      style={{
                        display: 'flex',
                        gap: '9px',
                        alignItems: 'flex-start',
                        cursor: 'pointer',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isPicked}
                        onChange={() => toggle(product)}
                        style={{ marginTop: '3px', flexShrink: 0 }}
                      />
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: 'block', fontSize: '13.5px', fontWeight: 600 }}>
                          {product.name}
                        </span>
                        {product.description && (
                          <span
                            style={{
                              display: 'block',
                              fontSize: '12px',
                              color: COLORS.muted,
                              lineHeight: 1.4,
                              marginTop: '1px',
                            }}
                          >
                            {product.description}
                          </span>
                        )}
                        <span
                          style={{
                            display: 'block',
                            fontSize: '12.5px',
                            color: COLORS.ink,
                            marginTop: '3px',
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          {formatMoney(microsOf(product), currencyCode)}
                          {product.unit ? ` / ${product.unit}` : ''}
                        </span>
                      </span>
                    </label>

                    {isPicked && (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          marginTop: '8px',
                          paddingTop: '8px',
                          borderTop: `1px solid ${COLORS.line}`,
                        }}
                      >
                        <span style={{ fontSize: '12px', color: COLORS.muted }}>Qty</span>
                        <input
                          id={`qty-${product.id}`}
                          type="number"
                          min={1}
                          step="any"
                          value={picked[product.id]}
                          onChange={(e) => setQuantity(product.id, e.target.value)}
                          style={{
                            width: '76px',
                            padding: '5px 8px',
                            fontSize: '13px',
                            border: `1px solid ${COLORS.line}`,
                            borderRadius: '6px',
                            outline: 'none',
                            background: COLORS.surface,
                            color: COLORS.ink,
                            fontFamily: 'inherit',
                          }}
                        />
                        <span
                          style={{
                            marginLeft: 'auto',
                            fontSize: '13px',
                            fontWeight: 600,
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          {formatMoney(
                            Math.round(microsOf(product) * (picked[product.id] || 0)),
                            currencyCode,
                          )}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          borderTop: `1px solid ${COLORS.line}`,
          background: COLORS.surface,
          padding: '11px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}
      >
        <span style={{ fontSize: '12.5px', color: COLORS.muted, flex: 1, minWidth: 0 }}>
          {pickedIds.length === 0 ? (
            'Nothing picked yet'
          ) : (
            <>
              {pickedIds.length} {pickedIds.length === 1 ? 'item' : 'items'} ·{' '}
              <b style={{ color: COLORS.ink, fontVariantNumeric: 'tabular-nums' }}>
                {formatMoney(Math.round(runningTotal), currencyCode)}
              </b>
            </>
          )}
        </span>
        <button
          type="button"
          onClick={add}
          disabled={saving || pickedIds.length === 0}
          style={{
            background: COLORS.accent,
            color: '#fff',
            border: 0,
            borderRadius: '6px',
            padding: '8px 16px',
            fontSize: '13.5px',
            cursor: saving || pickedIds.length === 0 ? 'not-allowed' : 'pointer',
            opacity: saving || pickedIds.length === 0 ? 0.5 : 1,
            flexShrink: 0,
          }}
        >
          {saving ? 'Adding…' : 'Add'}
        </button>
      </div>
    </div>
  );
};

export default defineFrontComponent({
  universalIdentifier: ADD_ITEMS_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: 'add-items-panel',
  description: 'Pick catalogue items and add them to a draft quotation in one go',
  component: AddItemsPanel,
});
