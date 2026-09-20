import { kv } from 'twenty-sdk/logic-function';

/**
 * Billing settings, Gotka's "Settings -> Billing" screen as a single key-value
 * record rather than an object. It is one row per workspace that only an admin
 * ever touches, so it does not need a table, a view, or permissions of its own.
 */

export type QuoteIssuer = {
  name: string;
  registrationNo: string;
  address: string;
  email: string;
  phone: string;
};

export type QuoteSettings = {
  currencyCode: string;
  quotePrefix: string;
  quotePadding: number;
  nextQuoteSequence: number;
  // Invoices run their own sequence. An accountant expects INV-0001 to be the
  // first invoice, not the first document of any kind.
  invoicePrefix: string;
  invoicePadding: number;
  nextInvoiceSequence: number;
  paymentTermsDays: number;
  paymentInstructions: string;
  // Where a client opens a quotation or invoice link. Empty means "work it out
  // from the request", which is right in development and wrong the moment this
  // is deployed behind a domain.
  publicBaseUrl: string;
  validityDays: number;
  taxLabel: string;
  taxRate: number;
  isTaxRegistered: boolean;
  defaultTerms: string;
  issuer: QuoteIssuer;
};

const SETTINGS_KEY = 'quote-settings';

export const DEFAULT_QUOTE_SETTINGS: QuoteSettings = {
  currencyCode: 'MYR',
  quotePrefix: 'Q-',
  quotePadding: 4,
  nextQuoteSequence: 1,
  invoicePrefix: 'INV-',
  invoicePadding: 4,
  nextInvoiceSequence: 1,
  paymentTermsDays: 14,
  paymentInstructions: '',
  publicBaseUrl: '',
  validityDays: 30,
  taxLabel: 'SST',
  taxRate: 0,
  // Tax is built in but stays off until the business actually registers.
  isTaxRegistered: false,
  defaultTerms:
    '50% deposit on acceptance, balance on delivery. Quotation valid for 30 days from the issue date.',
  issuer: {
    name: '',
    registrationNo: '',
    address: '',
    email: '',
    phone: '',
  },
};

export const getQuoteSettings = async (): Promise<QuoteSettings> => {
  const stored = await kv.get<Partial<QuoteSettings>>(SETTINGS_KEY, {
    scope: 'WORKSPACE',
  });

  return {
    ...DEFAULT_QUOTE_SETTINGS,
    ...(stored ?? {}),
    issuer: { ...DEFAULT_QUOTE_SETTINGS.issuer, ...(stored?.issuer ?? {}) },
  };
};

/**
 * Keep only the keys that are actually settings.
 *
 * The save route answers with `{ ok, ...settings, nextDocumentNumberPreview }`,
 * and the settings screen holds on to what it was given. Post that back and the
 * answer's own fields get stored alongside the real ones - the workspace record
 * had picked up an `ok` and a stale `nextDocumentNumberPreview` before this
 * existed. Harmless, but it is the kind of harmless that compounds.
 */
const onlySettings = (settings: QuoteSettings): QuoteSettings =>
  Object.fromEntries(
    Object.keys(DEFAULT_QUOTE_SETTINGS).map((key) => [
      key,
      settings[key as keyof QuoteSettings],
    ]),
  ) as QuoteSettings;

export const saveQuoteSettings = async (settings: QuoteSettings) => {
  await kv.set(SETTINGS_KEY, onlySettings(settings), { scope: 'WORKSPACE' });
};

/**
 * Take the next number in the sequence and persist the increment.
 *
 * KNOWN LIMITATION: kv has no atomic increment, so two people issuing a quote in
 * the same instant could both read the same sequence. That is survivable today
 * (one small team, one person quoting) but it must become a real counter -
 * a dedicated row with a conditional update, or a Postgres sequence - before
 * this ships to a client who has several people quoting at once. A duplicate
 * document number is the kind of bug an accountant finds, not a developer.
 */
export const takeNextQuoteSequence = async (settings: QuoteSettings) => {
  const sequence = settings.nextQuoteSequence;

  await saveQuoteSettings({ ...settings, nextQuoteSequence: sequence + 1 });

  return sequence;
};

/** Same counter, same caveat, different series. */
export const takeNextInvoiceSequence = async (settings: QuoteSettings) => {
  const sequence = settings.nextInvoiceSequence;

  await saveQuoteSettings({ ...settings, nextInvoiceSequence: sequence + 1 });

  return sequence;
};
