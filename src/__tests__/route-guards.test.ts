import { describe, expect, it } from 'vitest';

import {
  billMilestoneRefusal,
  issueInvoiceRefusal,
  issueQuoteRefusal,
  markPaidRefusal,
  missingId,
  reviseQuoteRefusal,
  startProjectRefusal,
  withdrawQuoteRefusal,
} from 'src/lib/route-guards';
// The real one, not a copy: a reimplemented helper drifts from the thing it
// stands in for, and then the test passes while the route does something else.
import { lineLabel as label } from 'src/lib/quote-math';

const aLine = { description: 'Website design' };

describe('issuing a quotation', () => {
  it('lets a draft with described lines through', () => {
    expect(
      issueQuoteRefusal({ quote: { status: 'DRAFT' }, lines: [aLine], lineLabel: label }),
    ).toBeNull();
  });

  it('will not issue a quote that does not exist', () => {
    const refusal = issueQuoteRefusal({ quote: null, lines: [aLine], lineLabel: label });

    expect(refusal?.status).toBe(404);
  });

  it('will not issue anything that is not a draft', () => {
    // The double-click case, and the "re-send it" case. Both must refuse:
    // issuing twice means two document numbers for one quotation.
    (['ISSUED', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'WITHDRAWN', 'SUPERSEDED'] as const).forEach(
      (status) => {
        const refusal = issueQuoteRefusal({ quote: { status }, lines: [aLine], lineLabel: label });

        expect(refusal?.status).toBe(409);
        expect(refusal?.error).toContain(status);
      },
    );
  });

  it('will not send a client an empty quotation', () => {
    const refusal = issueQuoteRefusal({ quote: { status: 'DRAFT' }, lines: [], lineLabel: label });

    expect(refusal?.status).toBe(422);
    expect(refusal?.error).toContain('at least one line item');
  });

  it('will not ask a client to accept a blank line', () => {
    const refusal = issueQuoteRefusal({
      quote: { status: 'DRAFT' },
      lines: [aLine, { description: '   ' }],
      lineLabel: label,
    });

    expect(refusal?.status).toBe(422);
    expect(refusal?.error).toContain('1 line item has no description');
  });

  it('counts blank lines in readable English', () => {
    const refusal = issueQuoteRefusal({
      quote: { status: 'DRAFT' },
      lines: [{ description: '' }, { description: null }],
      lineLabel: label,
    });

    expect(refusal?.error).toContain('2 line items have no description');
  });

  it('accepts a line labelled by name when it has no description', () => {
    expect(
      issueQuoteRefusal({
        quote: { status: 'DRAFT' },
        lines: [{ description: '', name: 'Hosting' }],
        lineLabel: label,
      }),
    ).toBeNull();
  });
});

describe('issuing an invoice', () => {
  const draft = { status: 'DRAFT' };

  it('lets a priced draft through when the business is not tax registered', () => {
    expect(
      issueInvoiceRefusal({
        invoice: draft,
        amountMicros: 3_000_000_000,
        isTaxRegistered: false,
        taxLabel: 'SST',
      }),
    ).toBeNull();
  });

  it('will not issue one that does not exist', () => {
    expect(
      issueInvoiceRefusal({ invoice: null, amountMicros: 1, isTaxRegistered: false, taxLabel: 'SST' })
        ?.status,
    ).toBe(404);
  });

  it('will not issue anything already issued, paid or void', () => {
    (['ISSUED', 'PAID', 'VOID', 'OVERDUE'] as const).forEach((status) => {
      const refusal = issueInvoiceRefusal({
        invoice: { status },
        amountMicros: 1_000_000,
        isTaxRegistered: false,
        taxLabel: 'SST',
      });

      expect(refusal?.status).toBe(409);
      expect(refusal?.error).toContain(status.toLowerCase());
    });
  });

  it('will not issue an invoice for nothing', () => {
    [0, -1].forEach((amountMicros) => {
      const refusal = issueInvoiceRefusal({
        invoice: draft,
        amountMicros,
        isTaxRegistered: false,
        taxLabel: 'SST',
      });

      expect(refusal?.status).toBe(422);
    });
  });

  it('refuses rather than underbill a tax-registered business', () => {
    // The whole point of this one. Milestones carry pre-tax line amounts, so
    // issuing would bill the client less than they owe - quietly, and in a
    // document they pay from.
    const refusal = issueInvoiceRefusal({
      invoice: draft,
      amountMicros: 3_000_000_000,
      isTaxRegistered: true,
      taxLabel: 'SST',
    });

    expect(refusal?.status).toBe(501);
    expect(refusal?.error).toContain('SST');
    expect(refusal?.error).toContain('pre-tax');
  });

  it('still says something sensible when no tax label is set', () => {
    const refusal = issueInvoiceRefusal({
      invoice: draft,
      amountMicros: 1_000_000,
      isTaxRegistered: true,
      taxLabel: '',
    });

    expect(refusal?.error).toContain('tax');
  });

  it('checks the status before the amount', () => {
    // An already-paid invoice for zero should read "already paid", not
    // "set an amount first" - the first sentence is the true one.
    const refusal = issueInvoiceRefusal({
      invoice: { status: 'PAID' },
      amountMicros: 0,
      isTaxRegistered: false,
      taxLabel: 'SST',
    });

    expect(refusal?.status).toBe(409);
  });
});

describe('marking an invoice paid', () => {
  it('lets an issued invoice be paid', () => {
    expect(markPaidRefusal({ invoice: { status: 'ISSUED' } })).toBeNull();
  });

  it('lets an overdue invoice be paid', () => {
    // Overdue is late, not dead. Refusing here would leave money unrecorded.
    expect(markPaidRefusal({ invoice: { status: 'OVERDUE' } })).toBeNull();
  });

  it('will not pay one twice, and says when the first payment was', () => {
    const refusal = markPaidRefusal({
      invoice: { status: 'PAID', documentNumber: 'INV-0004', paidAt: '2026-09-17' },
    });

    expect(refusal?.status).toBe(409);
    expect(refusal?.error).toContain('INV-0004');
    expect(refusal?.error).toContain('2026-09-17');
  });

  it('will not pay an invoice nobody has been sent', () => {
    const refusal = markPaidRefusal({ invoice: { status: 'DRAFT' } });

    expect(refusal?.status).toBe(409);
    expect(refusal?.error).toContain('not been issued');
  });

  it('will not pay a voided invoice', () => {
    const refusal = markPaidRefusal({ invoice: { status: 'VOID' } });

    expect(refusal?.error).toContain('Raise a new one');
  });

  it('will not pay one that does not exist', () => {
    expect(markPaidRefusal({ invoice: null })?.status).toBe(404);
  });
});

describe('starting a project', () => {
  it('starts one for a deal that has none', () => {
    expect(
      startProjectRefusal({ opportunity: { id: 'o1' }, existingProjects: [] }),
    ).toBeNull();
  });

  it('will not give a deal a second project', () => {
    // Two projects on one deal means two sets of milestones, and invoices
    // raised against whichever one you happened to open.
    const refusal = startProjectRefusal({
      opportunity: { id: 'o1' },
      existingProjects: [{ name: 'iMac Office Workstation Refresh' }],
    });

    expect(refusal?.status).toBe(409);
    expect(refusal?.error).toContain('iMac Office Workstation Refresh');
  });

  it('will not start one for a deal that does not exist', () => {
    expect(startProjectRefusal({ opportunity: null, existingProjects: [] })?.status).toBe(404);
  });
});

describe('missingId', () => {
  it('accepts a real id and refuses everything else', () => {
    expect(missingId('abc', 'quoteId')).toBeNull();
    expect(missingId('', 'quoteId')?.status).toBe(400);
    expect(missingId('   ', 'quoteId')?.error).toContain('quoteId is required');
    expect(missingId(undefined, 'invoiceId')?.error).toContain('invoiceId');
    expect(missingId(null, 'invoiceId')?.status).toBe(400);
  });
});

describe('billing a milestone', () => {
  const milestone = { name: 'Deposit', project: { id: 'p1' } };

  it('bills a milestone with money still owing on it', () => {
    expect(
      billMilestoneRefusal({
        milestone,
        milestoneMicros: 6_000_000_000,
        remainingMicros: 6_000_000_000,
        billedDescription: 'MYR 0.00',
      }),
    ).toBeNull();
  });

  it('bills the remainder of a partly billed milestone', () => {
    // Milestones are billed in parts. Partly billed is the normal case, not
    // an error.
    expect(
      billMilestoneRefusal({
        milestone,
        milestoneMicros: 6_000_000_000,
        remainingMicros: 1_000_000_000,
        billedDescription: 'MYR 5,000.00',
      }),
    ).toBeNull();
  });

  it('will not bill the same stage twice', () => {
    // The one that matters. Billing a client twice for the same stage of the
    // same project is something they notice and you do not.
    const refusal = billMilestoneRefusal({
      milestone,
      milestoneMicros: 6_000_000_000,
      remainingMicros: 0,
      billedDescription: 'MYR 6,000.00',
    });

    expect(refusal?.status).toBe(409);
    expect(refusal?.error).toContain('already fully billed');
    expect(refusal?.error).toContain('MYR 6,000.00');
    expect(refusal?.error).toContain('Deposit');
  });

  it('will not bill past the milestone amount', () => {
    expect(
      billMilestoneRefusal({
        milestone,
        milestoneMicros: 6_000_000_000,
        remainingMicros: -1,
        billedDescription: 'MYR 6,500.00',
      })?.status,
    ).toBe(409);
  });

  it('will not bill a milestone with no amount', () => {
    const refusal = billMilestoneRefusal({
      milestone,
      milestoneMicros: 0,
      remainingMicros: 0,
      billedDescription: 'MYR 0.00',
    });

    expect(refusal?.status).toBe(422);
    expect(refusal?.error).toContain('no amount');
  });

  it('will not bill against a milestone with no project', () => {
    const refusal = billMilestoneRefusal({
      milestone: { name: 'Orphan', project: null },
      milestoneMicros: 1_000_000,
      remainingMicros: 1_000_000,
      billedDescription: 'MYR 0.00',
    });

    expect(refusal?.status).toBe(409);
    expect(refusal?.error).toContain('not attached to a project');
  });

  it('will not bill one that does not exist', () => {
    expect(
      billMilestoneRefusal({
        milestone: null,
        milestoneMicros: 1,
        remainingMicros: 1,
        billedDescription: '',
      })?.status,
    ).toBe(404);
  });
});

describe('revising a quotation', () => {
  it('revises something already sent', () => {
    expect(
      reviseQuoteRefusal({ quote: { status: 'ISSUED', documentNumber: 'Q-0051' } }),
    ).toBeNull();
  });

  it('revises a declined or expired one, because that is the point', () => {
    // A client said no, or ran out of time. Revising is how you go back with a
    // different offer under the same document number.
    (['DECLINED', 'EXPIRED', 'ACCEPTED'] as const).forEach((status) => {
      expect(reviseQuoteRefusal({ quote: { status, documentNumber: 'Q-0051' } })).toBeNull();
    });
  });

  it('will not revise a draft - that would just duplicate it', () => {
    const refusal = reviseQuoteRefusal({ quote: { status: 'DRAFT', documentNumber: null } });

    expect(refusal?.status).toBe(409);
    expect(refusal?.error).toContain('Edit it directly');
  });

  it('will not revise something with no number to carry forward', () => {
    // Q-0001 Rev 2 is the same document. Without a number there is no identity
    // for the revision to inherit.
    const refusal = reviseQuoteRefusal({ quote: { status: 'ISSUED', documentNumber: '' } });

    expect(refusal?.status).toBe(409);
    expect(refusal?.error).toContain('numbered');
  });

  it('will not revise one that does not exist', () => {
    expect(reviseQuoteRefusal({ quote: null })?.status).toBe(404);
  });
});

describe('withdrawing a quotation', () => {
  it('withdraws one that is out with a client', () => {
    expect(
      withdrawQuoteRefusal({ quote: { status: 'ISSUED', documentNumber: 'Q-0051' } }),
    ).toBeNull();
  });

  it('refuses an accepted one in its own words', () => {
    // Deliberately a different sentence from the generic refusal. Cancelling
    // something a client accepted is a conversation, and a CRM that does it
    // silently lets you forget you did.
    const refusal = withdrawQuoteRefusal({
      quote: { status: 'ACCEPTED', documentNumber: 'Q-0052' },
    });

    expect(refusal?.status).toBe(409);
    expect(refusal?.error).toContain('Q-0052');
    expect(refusal?.error).toContain('conversation with the client');
  });

  it('will not withdraw what was never issued', () => {
    const refusal = withdrawQuoteRefusal({ quote: { status: 'DRAFT' } });

    expect(refusal?.status).toBe(409);
    expect(refusal?.error).toContain('draft');
  });

  it('will not withdraw one twice', () => {
    expect(withdrawQuoteRefusal({ quote: { status: 'WITHDRAWN' } })?.status).toBe(409);
  });

  it('will not withdraw one that does not exist', () => {
    expect(withdrawQuoteRefusal({ quote: null })?.status).toBe(404);
  });
});
