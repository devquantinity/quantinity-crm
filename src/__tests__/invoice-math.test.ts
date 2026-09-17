import { describe, expect, it } from 'vitest';

import {
  addDaysToDate,
  billedMicros,
  inferInvoiceKind,
  remainingMicros,
  unbilledMilestoneCount,
} from 'src/lib/invoice-math';

const m = (amount: number) => ({ amountMicros: amount * 1_000_000 });

describe('billedMicros', () => {
  it('ignores voided invoices - a void never happened', () => {
    expect(
      billedMicros([
        { status: 'ISSUED', amount: m(1000) },
        { status: 'VOID', amount: m(5000) },
      ]),
    ).toBe(1_000_000_000);
  });

  it('counts drafts, because a forgotten draft is how a client gets billed twice', () => {
    expect(billedMicros([{ status: 'DRAFT', amount: m(400) }])).toBe(400_000_000);
  });
});

describe('remainingMicros', () => {
  it('never goes negative when someone has over-billed', () => {
    expect(remainingMicros(m(1000).amountMicros, [{ status: 'PAID', amount: m(1500) }])).toBe(0);
  });

  it('returns the unbilled part', () => {
    expect(remainingMicros(m(1000).amountMicros, [{ status: 'PAID', amount: m(300) }])).toBe(
      700_000_000,
    );
  });
});

describe('unbilledMilestoneCount', () => {
  const milestones = [
    { id: 'a', amount: m(1000) },
    { id: 'b', amount: m(2000) },
    { id: 'c', amount: m(3000) },
  ];

  it('excludes the milestone being billed right now', () => {
    expect(
      unbilledMilestoneCount({ milestones, invoices: [], excludeMilestoneId: 'a' }),
    ).toBe(2);
  });

  it('does not count a milestone that is already fully billed', () => {
    expect(
      unbilledMilestoneCount({
        milestones,
        invoices: [{ status: 'ISSUED', amount: m(2000), milestone: { id: 'b' } }],
        excludeMilestoneId: 'a',
      }),
    ).toBe(1);
  });

  it('still counts a milestone that is only part-billed', () => {
    expect(
      unbilledMilestoneCount({
        milestones,
        invoices: [{ status: 'ISSUED', amount: m(500), milestone: { id: 'b' } }],
        excludeMilestoneId: 'a',
      }),
    ).toBe(2);
  });

  it('counts a milestone again once its only invoice is voided', () => {
    expect(
      unbilledMilestoneCount({
        milestones,
        invoices: [{ status: 'VOID', amount: m(2000), milestone: { id: 'b' } }],
        excludeMilestoneId: 'a',
      }),
    ).toBe(2);
  });

  it('ignores milestones carrying no money', () => {
    expect(
      unbilledMilestoneCount({
        milestones: [{ id: 'a', amount: m(1000) }, { id: 'kickoff', amount: m(0) }],
        invoices: [],
        excludeMilestoneId: 'a',
      }),
    ).toBe(0);
  });
});

describe('inferInvoiceKind', () => {
  it('calls the first invoice on a project a deposit', () => {
    expect(
      inferInvoiceKind({ projectInvoiceCount: 0, milestonesRemainingAfterThis: 3 }),
    ).toBe('DEPOSIT');
  });

  it('calls the last one final', () => {
    expect(
      inferInvoiceKind({ projectInvoiceCount: 2, milestonesRemainingAfterThis: 0 }),
    ).toBe('FINAL');
  });

  it('calls everything in between a progress payment', () => {
    expect(
      inferInvoiceKind({ projectInvoiceCount: 1, milestonesRemainingAfterThis: 1 }),
    ).toBe('PROGRESS');
  });

  it('a two-milestone project reaches FINAL on its second invoice', () => {
    const milestones = [{ id: 'a', amount: m(5000) }, { id: 'b', amount: m(5000) }];
    const first = [{ status: 'ISSUED', amount: m(5000), milestone: { id: 'a' } }];

    expect(
      inferInvoiceKind({
        projectInvoiceCount: first.length,
        milestonesRemainingAfterThis: unbilledMilestoneCount({
          milestones,
          invoices: first,
          excludeMilestoneId: 'b',
        }),
      }),
    ).toBe('FINAL');
  });
});

describe('addDaysToDate', () => {
  it('adds payment terms without mutating the issue date', () => {
    const issued = new Date('2026-09-16T10:00:00.000Z');
    const due = addDaysToDate(issued, 14);

    expect(due.toISOString().slice(0, 10)).toBe('2026-09-30');
    expect(issued.toISOString().slice(0, 10)).toBe('2026-09-16');
  });

  it('rolls over a month end', () => {
    expect(
      addDaysToDate(new Date('2026-01-25T00:00:00.000Z'), 14).toISOString().slice(0, 10),
    ).toBe('2026-02-08');
  });
});
