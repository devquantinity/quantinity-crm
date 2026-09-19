import { defineLogicFunction } from 'twenty-sdk/define';
import { Response, type RoutePayload } from 'twenty-sdk/logic-function';
import { CoreApiClient } from 'twenty-client-sdk/core';

import { startProjectRefusal } from 'src/lib/route-guards';

import { CREATE_PROJECT_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/project-identifiers';
import { milestonesFromQuoteLines } from 'src/lib/quote-math';

/**
 * Hand a won deal off to delivery.
 *
 * The point of doing this in code rather than by hand is that nothing gets
 * retyped: the contract value comes from the accepted quotation, not from
 * someone's memory, and the milestones start as the lines the client actually
 * agreed to buy. Both are editable afterwards - this is a starting point, not
 * a straitjacket.
 *
 * Refuses if a project already exists for the deal. A second project on the
 * same deal is nearly always a double-click, and two projects claiming the same
 * contract value is a number nobody can trust.
 */

type CreateProjectBody = { opportunityId?: string };

const run = async (payload: RoutePayload<CreateProjectBody>) => {
  const opportunityId = payload.body?.opportunityId;

  if (!opportunityId) {
    return new Response({ error: 'opportunityId is required' }, { status: 400 });
  }

  const client = new CoreApiClient();

  const { opportunity } = await client.query({
    opportunity: {
      __args: { filter: { id: { eq: opportunityId } } },
      id: true,
      name: true,
      amount: { amountMicros: true, currencyCode: true },
      projects: { edges: { node: { id: true, name: true } } },
      quotes: {
        edges: {
          node: {
            id: true,
            status: true,
            documentNumber: true,
            revision: true,
            acceptedAt: true,
            total: { amountMicros: true, currencyCode: true },
          },
        },
      },
    },
  });

  if (!opportunity) {
    return new Response({ error: 'Opportunity not found' }, { status: 404 });
  }

  const refusal = startProjectRefusal({
    opportunity,
    existingProjects: (opportunity.projects?.edges ?? []).map(
      (edge: any) => edge.node,
    ),
  });

  if (refusal) {
    return new Response({ error: refusal.error }, { status: refusal.status });
  }

  // Most recently accepted quote wins - a revision supersedes what came before.
  // Filtered here rather than in the query: a nested filter on a relation is not
  // something the generated schema accepts.
  const acceptedQuotes = (opportunity.quotes?.edges ?? [])
    .map((edge: any) => edge.node)
    .filter((node: any) => node.status === 'ACCEPTED')
    .sort(
      (a: any, b: any) =>
        Number(b.revision ?? 1) - Number(a.revision ?? 1),
    );

  const quote = acceptedQuotes[0];

  const contractValue = quote?.total ?? opportunity.amount ?? null;

  // Last look. The "already has a project" check above reads the projects that
  // came back with the opportunity at the top of this handler, which by now is a
  // snapshot several steps old. A second request that got here first would
  // otherwise give this deal two projects, each with its own milestones, and
  // invoices would start being raised against whichever one you happened to
  // open. Re-reading costs one round trip and is worth it.
  const { projects: recheck } = await client.query({
    projects: {
      __args: { filter: { opportunityId: { eq: opportunityId } }, first: 1 },
      edges: { node: { id: true, name: true } },
    },
  });

  const alreadyThere = (recheck?.edges ?? [])[0]?.node;

  if (alreadyThere) {
    return new Response(
      {
        error: `A project (${alreadyThere.name}) was just started for this deal. Open that one rather than starting a second.`,
      },
      { status: 409 },
    );
  }

  const { createProject } = await client.mutation({
    createProject: {
      __args: {
        data: {
          name: opportunity.name,
          status: 'NOT_STARTED',
          opportunityId: opportunity.id,
          ...(quote?.documentNumber
            ? {
                sourceQuoteNumber:
                  Number(quote.revision ?? 1) > 1
                    ? `${quote.documentNumber} Rev ${quote.revision}`
                    : quote.documentNumber,
              }
            : {}),
          ...(contractValue?.amountMicros != null
            ? {
                contractValue: {
                  amountMicros: contractValue.amountMicros,
                  currencyCode: contractValue.currencyCode ?? 'MYR',
                },
              }
            : {}),
        },
      },
      id: true,
      name: true,
    },
  });

  if (!createProject) {
    return new Response({ error: 'Could not create the project' }, { status: 500 });
  }

  // Seed milestones from what was sold. A blank project just moves the retyping
  // one screen later.
  //
  // The lines are fetched separately rather than nested under the opportunity:
  // Twenty refuses a one-to-many inside another one-to-many, and
  // opportunity -> quotes -> quoteItems is exactly that.
  const lineSource = quote
    ? await client.query({
        quote: {
          __args: { filter: { id: { eq: quote.id } } },
          quoteItems: {
            edges: {
              node: {
                id: true,
                name: true,
                description: true,
                quantity: true,
                lineOrder: true,
                unitPrice: { amountMicros: true, currencyCode: true },
              },
            },
          },
        },
      })
    : null;

  const milestones = milestonesFromQuoteLines(
    (lineSource?.quote?.quoteItems?.edges ?? []).map((edge: any) => edge.node),
    contractValue?.currencyCode ?? 'MYR',
  );

  let seeded = 0;

  for (const milestone of milestones) {
    await client.mutation({
      createMilestone: {
        __args: {
          data: {
            name: milestone.name,
            status: 'PENDING',
            lineOrder: milestone.lineOrder,
            projectId: createProject.id,
            ...(milestone.amountMicros > 0
              ? {
                  amount: {
                    amountMicros: milestone.amountMicros,
                    currencyCode: milestone.currencyCode,
                  },
                }
              : {}),
          },
        },
        id: true,
      },
    });

    seeded += 1;
  }

  return {
    ok: true,
    projectId: createProject.id,
    name: createProject.name,
    seededMilestones: seeded,
    fromQuote: quote?.documentNumber ?? null,
  };
};

/**
 * A bare 500 tells the user nothing and tells the developer almost as little.
 * Anything unexpected in here is worth naming, because this function writes
 * several records in sequence and "it failed" does not say how far it got.
 */
const handler = async (payload: RoutePayload<CreateProjectBody>) => {
  try {
    return await run(payload);
  } catch (error) {
    return new Response(
      {
        error: `Could not start the project: ${
          error instanceof Error ? error.message : String(error)
        }`,
      },
      { status: 500 },
    );
  }
};

export default defineLogicFunction({
  universalIdentifier: CREATE_PROJECT_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'create-project-from-opportunity',
  description:
    'Creates a delivery project from a won deal, carrying the accepted quotation value and seeding milestones from its lines',
  timeoutSeconds: 25,
  handler,
  httpRouteTriggerSettings: {
    path: '/projects/create-from-opportunity',
    httpMethod: 'POST',
    isAuthRequired: true,
  },
});
