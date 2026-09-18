import { defineLogicFunction } from 'twenty-sdk/define';
import { Response, type RoutePayload } from 'twenty-sdk/logic-function';
import { CoreApiClient } from 'twenty-client-sdk/core';

import { LINK_CONVERSATION_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/messaging-identifiers';

/**
 * Attach a conversation to a contact or a deal, by hand.
 *
 * The webhook links what it can recognise, but a number nobody has filed, or
 * one where two contacts share a tail, arrives attached to nothing on purpose.
 * This is how that gets fixed from the inbox instead of from a table.
 *
 * Passing null clears a link. That matters: the wrong link is the thing you
 * most want to undo, and an endpoint that can only add is not much help.
 */
const run = async (payload: RoutePayload) => {
  const client = new CoreApiClient();
  const body = (payload.body ?? {}) as {
    conversationId?: string;
    personId?: string | null;
    companyId?: string | null;
    opportunityId?: string | null;
  };

  if (!body.conversationId) {
    return new Response({ error: 'No conversation was given.' }, { status: 400 });
  }

  const data: Record<string, string | null> = {};

  if ('personId' in body) data.personId = body.personId || null;
  if ('companyId' in body) data.companyId = body.companyId || null;
  if ('opportunityId' in body) data.opportunityId = body.opportunityId || null;

  if (Object.keys(data).length === 0) {
    return new Response({ error: 'Nothing to change.' }, { status: 400 });
  }

  // Attaching a contact brings their company along, unless one was named.
  if (data.personId && !('companyId' in body)) {
    const { people } = await client.query({
      people: {
        __args: { filter: { id: { eq: data.personId } }, first: 1 },
        edges: { node: { id: true, company: { id: true } } },
      },
    });

    const companyId = (people?.edges ?? [])[0]?.node?.company?.id;

    if (companyId) data.companyId = companyId;
  }

  await client.mutation({
    updateConversation: { __args: { id: body.conversationId, data }, id: true },
  });

  return { ok: true, ...data };
};

const handler = async (payload: RoutePayload) => {
  try {
    return await run(payload);
  } catch (error) {
    return new Response(
      {
        error: `Could not attach that: ${
          error instanceof Error ? error.message : String(error)
        }`,
      },
      { status: 500 },
    );
  }
};

export default defineLogicFunction({
  universalIdentifier: LINK_CONVERSATION_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'link-conversation',
  description: 'Attaches a conversation to a contact, company or deal',
  timeoutSeconds: 10,
  handler,
  httpRouteTriggerSettings: {
    path: '/conversations/link',
    httpMethod: 'POST',
    isAuthRequired: true,
  },
});
