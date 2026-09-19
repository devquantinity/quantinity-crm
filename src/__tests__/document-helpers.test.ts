import { describe, expect, it } from 'vitest';

import { escapeHtml } from 'src/lib/html';
import { commandErrorMessage } from 'src/lib/command-error';
import {
  addDays,
  formatDocumentNumber,
  formatMoney,
  fromMicros,
  lineAmountMicros,
} from 'src/lib/quote-math';

describe('escapeHtml', () => {
  it('neutralises a script tag in a client name', () => {
    // These pages are public and unauthenticated, and the client is the reader.
    expect(escapeHtml('<script>alert(1)</script>')).toBe(
      '&lt;script&gt;alert(1)&lt;/script&gt;',
    );
  });

  it('escapes both kinds of quote', () => {
    expect(escapeHtml('He said "hi"')).toBe('He said &quot;hi&quot;');
    expect(escapeHtml("O'Brien & Sons")).toBe('O&#39;Brien &amp; Sons');
  });

  it('escapes the ampersand first, so nothing is double-escaped', () => {
    // & after < would turn &lt; into &amp;lt; and the client would read the
    // markup rather than the name.
    expect(escapeHtml('<')).toBe('&lt;');
    expect(escapeHtml('&lt;')).toBe('&amp;lt;');
  });

  it('breaks an attribute escape attempt', () => {
    const attack = '" onmouseover="steal()';

    expect(escapeHtml(attack)).not.toContain('"');
  });

  it('renders nothing for nothing, rather than "null"', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
    expect(escapeHtml('')).toBe('');
  });

  it('keeps numbers and ordinary text intact', () => {
    expect(escapeHtml(1250)).toBe('1250');
    expect(escapeHtml('Quantinity Sdn Bhd')).toBe('Quantinity Sdn Bhd');
  });
});

describe('commandErrorMessage', () => {
  it('prefers the sentence the server actually wrote', () => {
    // Without this, every refusal reads "failed with status 422" and the real
    // explanation - the one the person needs - is thrown away.
    expect(
      commandErrorMessage(
        { body: { error: 'There is nobody to address this to' } },
        'fallback',
      ),
    ).toBe('There is nobody to address this to');
  });

  it('takes message when there is no error field', () => {
    expect(commandErrorMessage({ body: { message: 'Quote not found' } }, 'fallback')).toBe(
      'Quote not found',
    );
  });

  it('takes a plain string body', () => {
    expect(commandErrorMessage({ body: 'Bad signature' }, 'fallback')).toBe('Bad signature');
  });

  it('falls back to the thrown error before the generic text', () => {
    expect(commandErrorMessage(new Error('network died'), 'fallback')).toBe('network died');
  });

  it('uses the fallback only when there is genuinely nothing better', () => {
    expect(commandErrorMessage({}, 'Could not issue this quote')).toBe(
      'Could not issue this quote',
    );
    expect(commandErrorMessage(null, 'Could not issue this quote')).toBe(
      'Could not issue this quote',
    );
    expect(commandErrorMessage({ body: {} }, 'fallback')).toBe('fallback');
    expect(commandErrorMessage({ body: '   ' }, 'fallback')).toBe('fallback');
  });
});

describe('formatDocumentNumber', () => {
  it('pads to the configured width', () => {
    expect(formatDocumentNumber('Q-', 4, 53)).toBe('Q-0053');
    expect(formatDocumentNumber('INV-', 4, 5)).toBe('INV-0005');
    expect(formatDocumentNumber('Q-', 4, 1)).toBe('Q-0001');
  });

  it('does not truncate once the sequence outgrows the padding', () => {
    // Year five of the business should read Q-12345, not Q-2345.
    expect(formatDocumentNumber('Q-', 4, 12345)).toBe('Q-12345');
  });

  it('copes with no prefix and no padding', () => {
    expect(formatDocumentNumber('', 0, 7)).toBe('7');
  });
});

describe('formatMoney', () => {
  it('always shows two decimal places', () => {
    // A quotation reading "MYR 7,950" invites "7,950 what?" from an accountant.
    expect(formatMoney(7_950_000_000, 'MYR')).toBe('MYR 7,950.00');
    expect(formatMoney(1_500_000, 'MYR')).toBe('MYR 1.50');
  });

  it('groups thousands', () => {
    expect(formatMoney(1_234_567_000_000, 'MYR')).toContain('1,234,567');
  });

  it('shows zero as zero', () => {
    expect(formatMoney(0, 'MYR')).toBe('MYR 0.00');
  });

  it('carries whatever currency it was given', () => {
    expect(formatMoney(1_000_000, 'SGD')).toBe('SGD 1.00');
  });
});

describe('micros', () => {
  it('multiplies quantity by unit price without floating-point dust', () => {
    // 0.1 * 3 in floats is 0.30000000000000004. On an invoice that is a cent
    // that does not reconcile.
    expect(lineAmountMicros({ quantity: 3, unitPriceMicros: 100_000, isTaxable: true })).toBe(300_000);
    expect(lineAmountMicros({ quantity: 2.5, unitPriceMicros: 1_000_000, isTaxable: true })).toBe(2_500_000);
  });

  it('rounds to whole micros rather than carrying a fraction', () => {
    expect(lineAmountMicros({ quantity: 1 / 3, unitPriceMicros: 1_000_000, isTaxable: true })).toBe(333_333);
  });

  it('converts back for display', () => {
    expect(fromMicros(7_950_000_000)).toBe(7950);
  });
});

describe('addDays', () => {
  it('adds the validity period', () => {
    expect(addDays(new Date('2026-09-19T00:00:00Z'), 30).toISOString().slice(0, 10)).toBe(
      '2026-10-19',
    );
  });

  it('rolls over a month end', () => {
    expect(addDays(new Date('2026-01-31T00:00:00Z'), 1).toISOString().slice(0, 10)).toBe(
      '2026-02-01',
    );
  });

  it('rolls over a year end', () => {
    expect(addDays(new Date('2026-12-20T00:00:00Z'), 30).toISOString().slice(0, 10)).toBe(
      '2027-01-19',
    );
  });

  it('handles a leap day', () => {
    expect(addDays(new Date('2028-02-28T00:00:00Z'), 1).toISOString().slice(0, 10)).toBe(
      '2028-02-29',
    );
  });

  it('does not mutate the date it was given', () => {
    const issued = new Date('2026-09-19T00:00:00Z');
    addDays(issued, 30);

    expect(issued.toISOString().slice(0, 10)).toBe('2026-09-19');
  });
});
