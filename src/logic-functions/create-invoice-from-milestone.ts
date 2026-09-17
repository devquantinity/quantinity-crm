import { defineLogicFunction } from 'twenty-sdk/define';
import { Response, type RoutePayload } from 'twenty-sdk/logic-function';
import { CoreApiClient } from 'twenty-client-sdk/core';

import { CREATE_INVOICE_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/invoice-identifiers';
import { getQuoteSettings } from 'src/lib/quote-settings';
import {
  remainingMicros,
  billedMicros,
  inferInvoiceKind,
  unbilledMilestoneCount,
} from 'src/lib/invoice-math';
import { formatMoney } from 'src/lib/quote-math';

/**
 * Bill a milestone.
 *
 * Amount is whatever is still unbilled on that milestone, never the full figure
 * again - billing something twice is the mistake this function exists to make
 * impossible. Drafts count towards billed, because a forgotten draft for the
 * same money is exactly how it happens.
 */

type CreateInvoiceBody = { milestoneId?: string };

const run = async (payload: RoutePayload<CreateInvoiceBody>) => {
  const milestoneId = payload.body?.milestoneId;

  if (!milestoneId) {
    return new Response({ error: 'milestoneId is required' }, { status: 400 });
  }

  const client = new CoreApiClient();

  const { milestone } = await client.query({
    milestone: {
      __args: { filter: { id: { eq: milestoneId } } },
      id: true,
      name: true,
      amount: { amountMicros: true, currencyCode: true },
      project: { id: true, name: true },
      invoices: {
        edges: {
          node: {
            id: true,
            status: true,
            amount: { amountMicros: true, currencyCode: true },
          },
        },
      },
    },
  });

  if (!milestone) {
    return new Response({ error: 'Milestone not found' }, { status: 404 });
  }

  if (!milestone.project?.id) {
    return new Response(
      { error: 'This milestone is not attached to a project, so there is nothing to bill against.' },
      { status: 409 },
    );
  }

  const settings = await getQuoteSettings();
  const currencyCode = milestone.amount?.currencyCode ?? settings.currencyCode;
  const milestoneMicros = Number(milestone.amount?.amountMicros ?? 0);

  if (milestoneMicros <= 0) {
    return new Response(
      { error: `"${milestone.name}" has no amount on it, so there is nothing to bill.` },
      { status: 422 },
    );
  }

  const existing = (milestone.invoices?.edges ?? []).map((edge: any) => edge.node);
  const remaining = remainingMicros(milestoneMicros, existing);

  if (remaining <= 0) {
    return new Response(
      {
        error: `"${milestone.name}" is already fully billed (${formatMoney(billedMicros(existing), currencyCode)}). Void an existing invoice first if that is wrong.`,
      },
      { status: 409 },
    );
  }

  // Two separate queries, not a nested one: project -> invoices and
  // project -> milestones are both one-to-many, and Twenty refuses that
  // nesting. The invoice query carries its milestone (many-to-one, allowed),
  // which is what lets us tell a billed milestone from an unbilled one.
  const { project } = await client.query({
    project: {
      __args: { filter: { id: { eq: milestone.project.id } } },
      invoices: {
        edges: {
          node: {
            id: true,
            status: true,
            amount: { amountMicros: true },
            milestone: { id: true },
          },
        },
      },
    },
  });

  const { project: withMilestones } = await client.query({
    project: {
      __args: { filter: { id: { eq: milestone.project.id } } },
      milestones: {
        edges: {
          node: { id: true, status: true, amount: { amountMicros: true } },
        },
      },
    },
  });

  const projectInvoices = (project?.invoices?.edges ?? []).map(
    (edge: any) => edge.node,
  );

  const kind = inferInvoiceKind({
    projectInvoiceCount: projectInvoices.length,
    // This invoice takes the whole remainder of its own milestone, so the
    // question is only what is left on the others.
    milestonesRemainingAfterThis: unbilledMilestoneCount({
      milestones: (withMilestones?.milestones?.edges ?? []).map(
        (edge: any) => edge.node,
      ),
      invoices: projectInvoices,
      excludeMilestoneId: milestone.id,
    }),
  });

  const { createInvoice } = await client.mutation({
    createInvoice: {
      __args: {
        data: {
          name: `${milestone.project.name} — ${milestone.name}`,
          status: 'DRAFT',
          kind,
          projectId: milestone.project.id,
          milestoneId: milestone.id,
          amount: { amountMicros: remaining, currencyCode },
        },
      },
      id: true,
      name: true,
      kind: true,
      amount: { amountMicros: true, currencyCode: true },
    },
  });

  if (!createInvoice) {
    return new Response({ error: 'Could not create the invoice' }, { status: 500 });
  }

  return {
    ok: true,
    invoiceId: createInvoice.id,
    name: createInvoice.name,
    kind: createInvoice.kind,
    amount: formatMoney(remaining, currencyCode),
    partial: remaining < milestoneMicros,
  };
};

const handler = async (payload: RoutePayload<CreateInvoiceBody>) => {
  try {
    return await run(payload);
  } catch (error) {
    return new Response(
      {
        error: `Could not create the invoice: ${
          error instanceof Error ? error.message : String(error)
        }`,
      },
      { status: 500 },
    );
  }
};

export default defineLogicFunction({
  universalIdentifier: CREATE_INVOICE_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'create-invoice-from-milestone',
  description:
    'Drafts an invoice for whatever is still unbilled on a milestone, inferring deposit/progress/final',
  timeoutSeconds: 20,
  handler,
  httpRouteTriggerSettings: {
    path: '/invoices/create-from-milestone',
    httpMethod: 'POST',
    isAuthRequired: true,
  },
});
