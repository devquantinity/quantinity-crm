/**
 * Billing arithmetic. No Twenty imports, same reasoning as the quote maths:
 * these are the rules, and rules deserve tests.
 */

export type ExistingInvoice = {
  status?: string | null;
  amount?: { amountMicros?: number | null } | null;
};

/**
 * A voided invoice never happened. Everything else - draft, issued, paid,
 * overdue - counts against the milestone, because a draft sitting there for
 * the same money is exactly how a client gets billed twice.
 */
export const billedMicros = (invoices: ExistingInvoice[]) =>
  invoices
    .filter((invoice) => invoice.status !== 'VOID')
    .reduce(
      (sum, invoice) => sum + Number(invoice.amount?.amountMicros ?? 0),
      0,
    );

export const remainingMicros = (
  milestoneAmountMicros: number,
  invoices: ExistingInvoice[],
) => Math.max(milestoneAmountMicros - billedMicros(invoices), 0);

/**
 * Which shape of invoice this is.
 *
 * The first money out of a job is a deposit, the last is the final, everything
 * between is progress. Inferred rather than asked, because it is nearly always
 * obvious from where you are - and it stays editable for when it isn't.
 */
export const inferInvoiceKind = ({
  projectInvoiceCount,
  milestonesRemainingAfterThis,
}: {
  projectInvoiceCount: number;
  milestonesRemainingAfterThis: number;
}): 'DEPOSIT' | 'PROGRESS' | 'FINAL' => {
  if (projectInvoiceCount === 0) {
    return 'DEPOSIT';
  }

  if (milestonesRemainingAfterThis <= 0) {
    return 'FINAL';
  }

  return 'PROGRESS';
};

export const addDaysToDate = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

export type MilestoneForBilling = {
  id: string;
  amount?: { amountMicros?: number | null } | null;
};

export type InvoiceWithMilestone = ExistingInvoice & {
  milestone?: { id?: string | null } | null;
};

/**
 * How many OTHER milestones still have money on them that nobody has billed.
 *
 * This is what decides whether an invoice is the final one. Counting
 * milestones, rather than counting unbilled ones, was the first version and it
 * was wrong: on a two-milestone project the second invoice would still see the
 * first milestone sitting there and call itself a progress payment forever.
 * A project would never produce a FINAL invoice.
 */
export const unbilledMilestoneCount = ({
  milestones,
  invoices,
  excludeMilestoneId,
}: {
  milestones: MilestoneForBilling[];
  invoices: InvoiceWithMilestone[];
  excludeMilestoneId?: string;
}) => {
  const billedByMilestone = new Map<string, number>();

  for (const invoice of invoices) {
    const milestoneId = invoice.milestone?.id;

    if (!milestoneId || invoice.status === 'VOID') {
      continue;
    }

    billedByMilestone.set(
      milestoneId,
      (billedByMilestone.get(milestoneId) ?? 0) +
        Number(invoice.amount?.amountMicros ?? 0),
    );
  }

  return milestones.filter((milestone) => {
    if (milestone.id === excludeMilestoneId) {
      return false;
    }

    const amount = Number(milestone.amount?.amountMicros ?? 0);

    if (amount <= 0) {
      return false;
    }

    return amount - (billedByMilestone.get(milestone.id) ?? 0) > 0;
  }).length;
};
