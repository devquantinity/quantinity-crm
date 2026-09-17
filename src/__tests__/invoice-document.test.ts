import { describe, expect, it } from 'vitest';

import { invoiceNotFoundHtml, renderInvoiceHtml } from 'src/lib/invoice-document';

const issuer = {
  name: 'Quantinity Sdn Bhd',
  registrationNo: '202601234567',
  address: 'Kuala Lumpur',
  email: 'billing@quantinity.my',
  phone: '+60 12-345 6789',
  paymentInstructions: 'Maybank 5123 4567 8910',
};

const base = {
  documentNumber: 'INV-0001',
  kind: 'DEPOSIT',
  status: 'ISSUED',
  issuedAt: '2026-09-17T02:00:00.000Z',
  dueDate: '2026-10-01',
  amount: { amountMicros: 9_000_000_000, currencyCode: 'MYR' },
  issuerSnapshot: issuer,
  billToSnapshot: { companyName: 'Sri Murni Sdn Bhd', address: 'Subang Jaya' },
  project: { name: 'Website rebuild' },
  milestone: { name: 'Design' },
};

describe('renderInvoiceHtml', () => {
  it('prints the number, the money and the due date', () => {
    const html = renderInvoiceHtml(base);

    expect(html).toContain('INV-0001');
    expect(html).toContain('MYR 9,000.00');
    expect(html).toContain('2026-10-01');
  });

  it('never prints undefined or NaN when the snapshots are empty', () => {
    const html = renderInvoiceHtml({
      ...base,
      issuerSnapshot: {},
      billToSnapshot: {},
      project: null,
      milestone: null,
    });

    expect(html).not.toContain('undefined');
    expect(html).not.toContain('NaN');
  });

  it('escapes anything that came from a record', () => {
    const html = renderInvoiceHtml({
      ...base,
      project: { name: '<script>alert(1)</script>' },
      milestone: { name: '<img src=x onerror=alert(1)>' },
      notes: '<b>bold</b>',
    });

    expect(html).not.toMatch(/<(script|img)\b/i);
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&lt;img');
  });

  it('shows how to pay while money is owed', () => {
    expect(renderInvoiceHtml(base)).toContain('How to pay');
  });

  it('drops how to pay once it is paid, and says so', () => {
    const html = renderInvoiceHtml({ ...base, status: 'PAID', paidAt: '2026-09-20T00:00:00.000Z' });

    expect(html).not.toContain('How to pay');
    expect(html).toContain('Paid on 2026-09-20');
  });

  it('calls a voided invoice cancelled rather than asking for money', () => {
    const html = renderInvoiceHtml({ ...base, status: 'VOID' });

    expect(html).toContain('Cancelled');
    expect(html).not.toContain('Amount due');
    expect(html).not.toContain('How to pay');
  });

  it('flags an issued invoice past its due date', () => {
    const html = renderInvoiceHtml({ ...base, dueDate: '2020-01-01' });

    expect(html).toContain('Overdue since 2020-01-01');
  });

  it('does not flag one that is still in date', () => {
    const html = renderInvoiceHtml({ ...base, dueDate: '2099-01-01' });

    expect(html).not.toContain('Overdue');
  });

  it('names the kind in words a client understands', () => {
    expect(renderInvoiceHtml({ ...base, kind: 'DEPOSIT' })).toContain('Deposit');
    expect(renderInvoiceHtml({ ...base, kind: 'PROGRESS' })).toContain('Progress payment');
    expect(renderInvoiceHtml({ ...base, kind: 'FINAL' })).toContain('Final payment');
  });
});

describe('invoiceNotFoundHtml', () => {
  it('gives nothing away about whether the invoice exists', () => {
    const html = invoiceNotFoundHtml();

    expect(html).toContain('not available');
    expect(html).not.toContain('draft');
    expect(html).not.toContain('Draft');
  });
});
