import { defineFrontComponent } from 'twenty-sdk/define';
import { useEffect, useState } from 'react';
import { enqueueSnackbar } from 'twenty-sdk/front-component';
import { RestApiClient } from 'twenty-client-sdk/rest';

import { commandErrorMessage } from 'src/lib/command-error';

import { BILLING_SETTINGS_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/constants/quote-identifiers';

/**
 * Settings -> Billing.
 *
 * These values are read at issue time and frozen onto the quote, so editing
 * anything here never rewrites a document already sent. The page says so,
 * because that is the question people actually have when they change an address.
 */

type Settings = {
  currencyCode: string;
  quotePrefix: string;
  quotePadding: number;
  nextQuoteSequence: number;
  invoicePrefix: string;
  invoicePadding: number;
  nextInvoiceSequence: number;
  paymentTermsDays: number;
  paymentInstructions: string;
  publicBaseUrl: string;
  validityDays: number;
  taxLabel: string;
  taxRate: number;
  isTaxRegistered: boolean;
  defaultTerms: string;
  issuer: {
    name: string;
    registrationNo: string;
    address: string;
    email: string;
    phone: string;
  };
  nextDocumentNumberPreview?: string;
};

const COLORS = {
  ink: '#15181c',
  muted: '#6b747f',
  line: '#e0e4e8',
  accent: '#0c6e66',
  surface: '#ffffff',
  ground: '#f6f7f8',
};

const input: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  fontSize: '13px',
  border: `1px solid ${COLORS.line}`,
  borderRadius: '6px',
  outline: 'none',
  background: COLORS.surface,
  color: COLORS.ink,
  fontFamily: 'inherit',
};

const Field = ({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) => (
  <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
    <span style={{ fontSize: '12px', fontWeight: 600, color: COLORS.ink }}>
      {label}
    </span>
    {children}
    {hint && (
      <span style={{ fontSize: '11.5px', color: COLORS.muted, lineHeight: 1.4 }}>
        {hint}
      </span>
    )}
  </label>
);

const Section = ({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) => (
  <section
    style={{
      background: COLORS.surface,
      border: `1px solid ${COLORS.line}`,
      borderRadius: '10px',
      padding: '18px 20px',
      display: 'flex',
      flexDirection: 'column',
      gap: '14px',
    }}
  >
    <div>
      <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>{title}</h3>
      {description && (
        <p
          style={{
            margin: '3px 0 0',
            fontSize: '12.5px',
            color: COLORS.muted,
            lineHeight: 1.45,
          }}
        >
          {description}
        </p>
      )}
    </div>
    {children}
  </section>
);

const BillingSettings = () => {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    new RestApiClient()
      .get<Settings>('/s/quote-settings')
      .then(setSettings)
      .catch((error) =>
        setLoadError(
          error instanceof Error ? error.message : 'Could not load settings',
        ),
      );
  }, []);

  const set = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    setSettings((previous) =>
      previous ? { ...previous, [key]: value } : previous,
    );

  const setIssuer = (key: keyof Settings['issuer'], value: string) =>
    setSettings((previous) =>
      previous
        ? { ...previous, issuer: { ...previous.issuer, [key]: value } }
        : previous,
    );

  const save = async () => {
    if (!settings) return;

    setSaving(true);
    setSaveError(null);

    const client = new RestApiClient();

    try {
      const saved = await client.post<Settings>('/s/quote-settings', settings);

      setSettings(saved);
      await enqueueSnackbar({
        message: 'Billing settings saved',
        variant: 'success',
      });
    } catch (error) {
      // Same trap as the quote commands: RestApiClient throws on a 422, so the
      // server's explanation lives on the thrown error, not in a return value.
      const message = commandErrorMessage(error, 'Could not save settings');

      setSaveError(message);
      await enqueueSnackbar({ message, variant: 'error' });

      // A refused save leaves the form showing values the server rejected,
      // which reads exactly like a successful save. Put the stored values back
      // so what is on screen is what is actually stored.
      try {
        setSettings(await client.get<Settings>('/s/quote-settings'));
      } catch {
        // If even the re-read fails, the banner above is still the honest
        // signal - better a stale form with a visible error than a silent lie.
      }
    } finally {
      setSaving(false);
    }
  };

  if (loadError) {
    return (
      <div style={{ padding: '20px', fontSize: '13px', color: '#b02525' }}>
        {loadError}
      </div>
    );
  }

  if (!settings) {
    return (
      <div style={{ padding: '20px', fontSize: '13px', color: COLORS.muted }}>
        Loading billing settings…
      </div>
    );
  }

  return (
    <div
      style={{
        height: '100%',
        overflowY: 'auto',
        background: COLORS.ground,
        padding: '20px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        color: COLORS.ink,
      }}
    >
      <div
        style={{
          maxWidth: '620px',
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: '19px', fontWeight: 600 }}>
            Billing
          </h2>
          <p
            style={{
              margin: '4px 0 0',
              fontSize: '13px',
              color: COLORS.muted,
              lineHeight: 1.5,
            }}
          >
            These details are copied onto a quotation or invoice the moment it
            is issued. Changing them here affects future documents only —
            anything already sent keeps the details it was issued with.
          </p>
        </div>

        <Section
          title="Your business"
          description="Printed at the top of every quotation and invoice."
        >
          <Field label="Business name">
            <input
              id="issuer-name"
              style={input}
              value={settings.issuer.name}
              onChange={(e) => setIssuer('name', e.target.value)}
              placeholder="Quantinity Sdn Bhd"
            />
          </Field>
          <Field label="Registration number">
            <input
              id="issuer-reg"
              style={input}
              value={settings.issuer.registrationNo}
              onChange={(e) => setIssuer('registrationNo', e.target.value)}
              placeholder="202601234567 (1500123-X)"
            />
          </Field>
          <Field label="Address">
            <textarea
              id="issuer-address"
              style={{ ...input, minHeight: '64px', resize: 'vertical' }}
              value={settings.issuer.address}
              onChange={(e) => setIssuer('address', e.target.value)}
            />
          </Field>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 220px' }}>
              <Field label="Email">
                <input
                  id="issuer-email"
                  style={input}
                  value={settings.issuer.email}
                  onChange={(e) => setIssuer('email', e.target.value)}
                />
              </Field>
            </div>
            <div style={{ flex: '1 1 180px' }}>
              <Field label="Phone">
                <input
                  id="issuer-phone"
                  style={input}
                  value={settings.issuer.phone}
                  onChange={(e) => setIssuer('phone', e.target.value)}
                />
              </Field>
            </div>
          </div>
        </Section>

        <Section
          title="Quotation numbering"
          description="Quotations are numbered in one continuous sequence."
        >
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 120px' }}>
              <Field label="Prefix">
                <input
                  id="quote-prefix"
                  style={input}
                  value={settings.quotePrefix}
                  onChange={(e) => set('quotePrefix', e.target.value)}
                />
              </Field>
            </div>
            <div style={{ flex: '1 1 100px' }}>
              <Field label="Digits">
                <input
                  id="quote-padding"
                  type="number"
                  min={1}
                  max={10}
                  style={input}
                  value={settings.quotePadding}
                  onChange={(e) =>
                    set('quotePadding', Number(e.target.value))
                  }
                />
              </Field>
            </div>
            <div style={{ flex: '1 1 140px' }}>
              <Field
                label="Next number"
                hint="Moves forward freely. Moves back only onto a number nothing is using yet."
              >
                <input
                  id="quote-sequence"
                  type="number"
                  min={1}
                  style={input}
                  value={settings.nextQuoteSequence}
                  onChange={(e) =>
                    set('nextQuoteSequence', Number(e.target.value))
                  }
                />
              </Field>
            </div>
          </div>
          <div
            style={{
              background: COLORS.ground,
              border: `1px solid ${COLORS.line}`,
              borderRadius: '6px',
              padding: '10px 12px',
              fontSize: '13px',
            }}
          >
            <span style={{ color: COLORS.muted }}>Next quotation will be </span>
            <b style={{ fontFamily: 'ui-monospace, monospace' }}>
              {settings.quotePrefix}
              {String(settings.nextQuoteSequence).padStart(
                Math.min(Math.max(settings.quotePadding, 1), 10),
                '0',
              )}
            </b>
          </div>
        </Section>

        <Section
          title="Invoice numbering and payment"
          description="Invoices run their own sequence, separate from quotations."
        >
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 120px' }}>
              <Field label="Prefix">
                <input
                  id="invoice-prefix"
                  style={input}
                  value={settings.invoicePrefix}
                  onChange={(e) => set('invoicePrefix', e.target.value)}
                />
              </Field>
            </div>
            <div style={{ flex: '1 1 100px' }}>
              <Field label="Digits">
                <input
                  id="invoice-padding"
                  type="number"
                  min={1}
                  max={10}
                  style={input}
                  value={settings.invoicePadding}
                  onChange={(e) => set('invoicePadding', Number(e.target.value))}
                />
              </Field>
            </div>
            <div style={{ flex: '1 1 140px' }}>
              <Field
                label="Next number"
                hint="Moves forward freely. Moves back only onto a number nothing is using yet."
              >
                <input
                  id="invoice-sequence"
                  type="number"
                  min={1}
                  style={input}
                  value={settings.nextInvoiceSequence}
                  onChange={(e) =>
                    set('nextInvoiceSequence', Number(e.target.value))
                  }
                />
              </Field>
            </div>
          </div>
          <div
            style={{
              background: COLORS.ground,
              border: `1px solid ${COLORS.line}`,
              borderRadius: '6px',
              padding: '10px 12px',
              fontSize: '13px',
            }}
          >
            <span style={{ color: COLORS.muted }}>Next invoice will be </span>
            <b style={{ fontFamily: 'ui-monospace, monospace' }}>
              {settings.invoicePrefix}
              {String(settings.nextInvoiceSequence).padStart(
                Math.min(Math.max(settings.invoicePadding, 1), 10),
                '0',
              )}
            </b>
          </div>

          <Field
            label="Payment terms (days)"
            hint="The due date is the issue date plus this many days."
          >
            <input
              id="payment-terms-days"
              type="number"
              min={0}
              max={365}
              style={input}
              value={settings.paymentTermsDays}
              onChange={(e) => set('paymentTermsDays', Number(e.target.value))}
            />
          </Field>

          <Field
            label="Client link address"
            hint="Where clients open a quotation or invoice link. Leave empty while developing; set it to your real address before sending anything out."
          >
            <input
              id="public-base-url"
              style={input}
              value={settings.publicBaseUrl}
              onChange={(e) => set('publicBaseUrl', e.target.value)}
              placeholder="https://crm.quantinity.my"
            />
          </Field>

          <Field
            label="Payment instructions"
            hint="Bank name, account number and reference — printed on every invoice."
          >
            <textarea
              id="payment-instructions"
              style={{ ...input, minHeight: '72px', resize: 'vertical' }}
              value={settings.paymentInstructions}
              onChange={(e) => set('paymentInstructions', e.target.value)}
              placeholder={'Maybank 5123 4567 8910\nQuantinity Sdn Bhd\nPlease quote the invoice number as reference.'}
            />
          </Field>
        </Section>

        <Section title="Currency, tax and terms">
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 110px' }}>
              <Field label="Currency" hint="Three-letter code, e.g. MYR.">
                <input
                  id="currency-code"
                  style={input}
                  maxLength={3}
                  value={settings.currencyCode}
                  onChange={(e) => set('currencyCode', e.target.value)}
                />
              </Field>
            </div>
            <div style={{ flex: '1 1 150px' }}>
              <Field label="Quotation valid for (days)">
                <input
                  id="validity-days"
                  type="number"
                  min={1}
                  max={365}
                  style={input}
                  value={settings.validityDays}
                  onChange={(e) => set('validityDays', Number(e.target.value))}
                />
              </Field>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 120px' }}>
              <Field label="Tax label">
                <input
                  id="tax-label"
                  style={input}
                  value={settings.taxLabel}
                  onChange={(e) => set('taxLabel', e.target.value)}
                />
              </Field>
            </div>
            <div style={{ flex: '1 1 120px' }}>
              <Field label="Tax rate (%)">
                <input
                  id="tax-rate"
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  style={input}
                  value={settings.taxRate}
                  onChange={(e) => set('taxRate', Number(e.target.value))}
                />
              </Field>
            </div>
          </div>

          <label
            style={{
              display: 'flex',
              gap: '8px',
              alignItems: 'flex-start',
              fontSize: '13px',
              lineHeight: 1.45,
            }}
          >
            <input
              id="tax-registered"
              type="checkbox"
              checked={settings.isTaxRegistered}
              onChange={(e) => set('isTaxRegistered', e.target.checked)}
              style={{ marginTop: '2px' }}
            />
            <span>
              We are registered for {settings.taxLabel || 'tax'}
              <span style={{ display: 'block', color: COLORS.muted, fontSize: '11.5px' }}>
                Until this is ticked, quotations print “{settings.taxLabel || 'tax'} not
                applicable” and no tax is charged.
              </span>
            </span>
          </label>

          <Field
            label="Default terms"
            hint="Used when a quotation has none of its own."
          >
            <textarea
              id="default-terms"
              style={{ ...input, minHeight: '72px', resize: 'vertical' }}
              value={settings.defaultTerms}
              onChange={(e) => set('defaultTerms', e.target.value)}
            />
          </Field>
        </Section>

        {saveError && (
          <div
            role="alert"
            style={{
              background: '#fdecec',
              border: '1px solid #f3c9c9',
              borderRadius: '8px',
              padding: '12px 14px',
              fontSize: '13px',
              lineHeight: 1.45,
              color: '#8c1d1d',
            }}
          >
            <b style={{ display: 'block', marginBottom: '2px' }}>
              Not saved
            </b>
            {saveError}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingBottom: '8px' }}>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            style={{
              background: COLORS.accent,
              color: '#fff',
              border: 0,
              borderRadius: '6px',
              padding: '10px 20px',
              fontSize: '14px',
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? 'Saving…' : 'Save settings'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default defineFrontComponent({
  universalIdentifier: BILLING_SETTINGS_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: 'billing-settings',
  description:
    'Business details, numbering, tax, payment terms and default terms for quotations and invoices',
  component: BillingSettings,
});
