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

export const saveQuoteSettings = async (settings: QuoteSettings) => {
  await kv.set(SETTINGS_KEY, settings, { scope: 'WORKSPACE' });
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
