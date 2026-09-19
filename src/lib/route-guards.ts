/**
 * Every reason a route says no, in one place, as plain functions.
 *
 * These lived inline in the handlers, which meant the only way to exercise them
 * was to stand up a server and a database and put a record into exactly the
 * wrong state. So they were never tested - and the refusals are the part worth
 * testing. The happy path announces itself the first time you use the app; a
 * refusal that stops working is silent, and what it stops is a client receiving
 * a quotation addressed to nobody, or a second invoice for the same money.
 *
 * Each returns the sentence the person should read, or '' for "no objection".
 * The HTTP status stays with the handler, since that is a transport concern.
 */

export type GuardResult = { error: string; status: number } | null;

const ok: GuardResult = null;

// --- issuing a quotation --------------------------------------------------

export type QuoteLineForGuard = {
  description?: string | null;
  name?: string | null;
};

export const issueQuoteRefusal = ({
  quote,
  lines,
  lineLabel,
}: {
  quote: { status?: string | null } | null | undefined;
  lines: readonly QuoteLineForGuard[];
  lineLabel: (line: QuoteLineForGuard) => string;
}): GuardResult => {
  if (!quote) return { error: 'Quote not found', status: 404 };

  if (quote.status !== 'DRAFT') {
    return {
      error: `Quote is ${quote.status}, only a DRAFT can be issued`,
      status: 409,
    };
  }

  if (lines.length === 0) {
    return {
      error: 'A quote needs at least one line item before it can be issued',
      status: 422,
    };
  }

  const unlabelled = lines.filter((line) => lineLabel(line).length === 0);

  if (unlabelled.length > 0) {
    return {
      error: `${unlabelled.length} line item${
        unlabelled.length === 1 ? ' has' : 's have'
      } no description. A client cannot be asked to accept a blank line.`,
      status: 422,
    };
  }

  // The currency check stays in the handler: it uses findCurrencyMismatches,
  // which is already pure and already tested, and it returns the offending line
  // numbers - detail this shape cannot carry without getting clumsy.
  return ok;
};

// --- issuing an invoice ---------------------------------------------------

export const issueInvoiceRefusal = ({
  invoice,
  amountMicros,
  isTaxRegistered,
  taxLabel,
}: {
  invoice: { status?: string | null } | null | undefined;
  amountMicros: number;
  isTaxRegistered: boolean;
  taxLabel: string;
}): GuardResult => {
  if (!invoice) return { error: 'Invoice not found', status: 404 };

  if (invoice.status !== 'DRAFT') {
    return {
      error: `This invoice is ${String(
        invoice.status,
      ).toLowerCase()}, only a draft can be issued.`,
      status: 409,
    };
  }

  if (amountMicros <= 0) {
    return {
      error: 'An invoice for nothing cannot be issued. Set an amount first.',
      status: 422,
    };
  }

  // 501, not 422: this is not the user's mistake, it is a feature that does not
  // exist yet. Refusing is the only honest option - milestones carry pre-tax
  // line amounts, so issuing would bill the client the wrong figure.
  if (isTaxRegistered) {
    return {
      error: `Invoices do not carry ${
        taxLabel || 'tax'
      } yet, and this workspace is registered for it - issuing would bill the client the pre-tax figure. Raise this invoice outside Quantinity for now.`,
      status: 501,
    };
  }

  return ok;
};

// --- marking an invoice paid ----------------------------------------------

export const markPaidRefusal = ({
  invoice,
}: {
  invoice:
    | { status?: string | null; documentNumber?: string | null; paidAt?: string | null }
    | null
    | undefined;
}): GuardResult => {
  if (!invoice) return { error: 'Invoice not found', status: 404 };

  if (invoice.status === 'PAID') {
    return {
      error: `${invoice.documentNumber} is already marked paid${
        invoice.paidAt ? ` (${invoice.paidAt})` : ''
      }`,
      status: 409,
    };
  }

  if (invoice.status === 'DRAFT') {
    return {
      error: 'This invoice has not been issued yet, so it cannot have been paid.',
      status: 409,
    };
  }

  if (invoice.status === 'VOID') {
    return { error: 'A voided invoice cannot be paid. Raise a new one.', status: 409 };
  }

  return ok;
};

// --- starting a project ---------------------------------------------------

export const startProjectRefusal = ({
  opportunity,
  existingProjects,
}: {
  opportunity: { id?: string | null } | null | undefined;
  existingProjects: ReadonlyArray<{ name?: string | null }>;
}): GuardResult => {
  if (!opportunity) return { error: 'Opportunity not found', status: 404 };

  if (existingProjects.length > 0) {
    return {
      error: `This deal already has a project (${
        existingProjects[0]?.name ?? 'unnamed'
      }). Open that one rather than starting a second.`,
      status: 409,
    };
  }

  return ok;
};

// --- billing a milestone --------------------------------------------------

/**
 * Whether this milestone can produce another invoice.
 *
 * "Already fully billed" is the one that earns its keep. Milestones are billed
 * in parts, so the question is never "has this been invoiced" but "how much of
 * it is left" - and getting that wrong bills a client twice for the same stage
 * of the same project, which they notice and you do not.
 */
export const billMilestoneRefusal = ({
  milestone,
  milestoneMicros,
  remainingMicros,
  billedDescription,
}: {
  milestone:
    | { name?: string | null; project?: { id?: string | null } | null }
    | null
    | undefined;
  milestoneMicros: number;
  remainingMicros: number;
  billedDescription: string;
}): GuardResult => {
  if (!milestone) return { error: 'Milestone not found', status: 404 };

  if (!milestone.project?.id) {
    return {
      error:
        'This milestone is not attached to a project, so there is nothing to bill against.',
      status: 409,
    };
  }

  if (milestoneMicros <= 0) {
    return {
      error: `"${milestone.name}" has no amount on it, so there is nothing to bill.`,
      status: 422,
    };
  }

  if (remainingMicros <= 0) {
    return {
      error: `"${milestone.name}" is already fully billed (${billedDescription}). Void an existing invoice first if that is wrong.`,
      status: 409,
    };
  }

  return ok;
};

// --- a required id --------------------------------------------------------

/** The dullest guard, and the one a typo in a front component lands on first. */
export const missingId = (id: unknown, field: string): GuardResult =>
  typeof id === 'string' && id.trim().length > 0
    ? ok
    : { error: `${field} is required`, status: 400 };
