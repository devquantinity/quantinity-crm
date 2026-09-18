import { defineLogicFunction } from 'twenty-sdk/define';
import { Response, type RoutePayload } from 'twenty-sdk/logic-function';
import { CoreApiClient } from 'twenty-client-sdk/core';

import { LIST_LINK_TARGETS_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/messaging-identifiers';

/**
 * The contacts and deals you can attach a conversation to.
 *
 * Searched here rather than in the browser. Fetching everything and filtering
 * in the front component works right up until the CRM has more contacts than
 * the page size, and then it silently stops finding people - which looks like
 * "that contact does not exist" rather than like a bug.
 */
const run = async (payload: RoutePayload) => {
  const client = new CoreApiClient();
  const q = String(payload.queryStringParameters?.q ?? '').trim();
  const like = `%${q}%`;

  const [{ people }, { opportunities }] = await Promise.all([
    client.query({
      people: {
        __args: {
          first: 60,
          ...(q
            ? {
                filter: {
                  or: [
                    { name: { firstName: { ilike: like } } },
                    { name: { lastName: { ilike: like } } },
                  ],
                },
              }
            : {}),
        },
        edges: {
          node: {
            id: true,
            name: { firstName: true, lastName: true },
            company: { id: true, name: true },
          },
        },
      },
    }),
    client.query({
      opportunities: {
        __args: {
          first: 60,
          ...(q ? { filter: { name: { ilike: like } } } : {}),
        },
        edges: {
          node: { id: true, name: true, stage: true, company: { id: true, name: true } },
        },
      },
    }),
  ]);

  return {
    people: (people?.edges ?? []).map((edge: any) => ({
      id: edge.node.id,
      name:
        [edge.node.name?.firstName, edge.node.name?.lastName].filter(Boolean).join(' ') ||
        'Unnamed contact',
      companyId: edge.node.company?.id ?? null,
      companyName: edge.node.company?.name ?? '',
    })),
    opportunities: (opportunities?.edges ?? []).map((edge: any) => ({
      id: edge.node.id,
      name: edge.node.name ?? 'Untitled deal',
      stage: edge.node.stage ?? '',
      companyName: edge.node.company?.name ?? '',
    })),
  };
};

const handler = async (payload: RoutePayload) => {
  try {
    return await run(payload);
  } catch (error) {
    return new Response(
      {
        error: `Could not load contacts and deals: ${
          error instanceof Error ? error.message : String(error)
        }`,
      },
      { status: 500 },
    );
  }
};

export default defineLogicFunction({
  universalIdentifier: LIST_LINK_TARGETS_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'list-link-targets',
  description: 'Contacts and deals a conversation can be attached to',
  timeoutSeconds: 10,
  handler,
  httpRouteTriggerSettings: {
    path: '/conversations/link-targets',
    httpMethod: 'GET',
    isAuthRequired: true,
  },
});
