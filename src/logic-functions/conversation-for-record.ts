import { defineLogicFunction } from 'twenty-sdk/define';
import { Response, type RoutePayload } from 'twenty-sdk/logic-function';
import { CoreApiClient } from 'twenty-client-sdk/core';

import { CONVERSATION_FOR_RECORD_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/messaging-identifiers';
import { conversationLabel, normaliseHandle, serviceWindow } from 'src/lib/messaging';
import { contactDigits } from 'src/lib/contact-match';

/**
 * The conversation for a contact or a deal, made if it does not exist yet.
 *
 * This is what "Message on WhatsApp" on a record calls. It never creates a
 * second conversation for a number that already has one - the whole point of
 * threading on (channel, handle) is that there is one thread per person, and
 * a duplicate would split their history in half.
 *
 * A deal has no phone of its own, so it resolves through its point of contact.
 */

const fullNumberOf = (person: any) => {
  const spellings = contactDigits({ id: person?.id ?? '', phones: person?.phones });

  // The longest spelling is the one that includes the country code.
  const best = spellings.sort((a, b) => b.length - a.length)[0] ?? '';

  return best ? normaliseHandle(best.startsWith('0') ? best : `+${best}`) : '';
};

const run = async (payload: RoutePayload) => {
  const client = new CoreApiClient();
  const body = (payload.body ?? {}) as {
    personId?: string;
    opportunityId?: string;
  };

  let personId = body.personId ?? null;
  let opportunityId = body.opportunityId ?? null;

  // A deal points at a contact; a contact does not point back at one deal.
  if (!personId && opportunityId) {
    const { opportunities } = await client.query({
      opportunities: {
        __args: { filter: { id: { eq: opportunityId } }, first: 1 },
        edges: { node: { id: true, pointOfContact: { id: true } } },
      },
    });

    personId = (opportunities?.edges ?? [])[0]?.node?.pointOfContact?.id ?? null;

    if (!personId) {
      return new Response(
        {
          error:
            'This deal has no point of contact, so there is no number to message. Set one on the deal first.',
        },
        { status: 422 },
      );
    }
  }

  if (!personId) {
    return new Response({ error: 'No contact was given.' }, { status: 400 });
  }

  const { people } = await client.query({
    people: {
      __args: { filter: { id: { eq: personId } }, first: 1 },
      edges: {
        node: {
          id: true,
          name: { firstName: true, lastName: true },
          phones: {
            primaryPhoneNumber: true,
            primaryPhoneCallingCode: true,
            additionalPhones: { number: true, callingCode: true },
          },
          company: { id: true, name: true },
        },
      },
    },
  });

  const person = (people?.edges ?? [])[0]?.node;

  if (!person) {
    return new Response({ error: 'That contact no longer exists.' }, { status: 404 });
  }

  const handle = fullNumberOf(person);
  const personName = [person.name?.firstName, person.name?.lastName]
    .filter(Boolean)
    .join(' ');

  if (!handle) {
    return new Response(
      {
        error: `${personName || 'That contact'} has no phone number on their record, so there is nowhere to send.`,
      },
      { status: 422 },
    );
  }

  const { conversations } = await client.query({
    conversations: {
      __args: { first: 200 },
      edges: {
        node: {
          id: true,
          handle: true,
          person: { id: true },
          opportunity: { id: true },
          lastInboundAt: true,
        },
      },
    },
  });

  const existing = (conversations?.edges ?? [])
    .map((edge: any) => edge.node)
    .find((node: any) => normaliseHandle(node.handle) === handle);

  const title = conversationLabel({
    personName,
    companyName: person.company?.name,
    handle,
  });

  if (existing) {
    // Fill in links it is missing, without overwriting ones already set by hand.
    const patch: Record<string, string> = {};

    if (!existing.person?.id) patch.personId = person.id;
    if (!existing.opportunity?.id && opportunityId) patch.opportunityId = opportunityId;

    if (Object.keys(patch).length > 0) {
      await client.mutation({
        updateConversation: { __args: { id: existing.id, data: patch }, id: true },
      });
    }

    return {
      conversationId: existing.id,
      title,
      handle,
      created: false,
      window: serviceWindow({ lastInboundAt: existing.lastInboundAt }),
    };
  }

  const { createConversation } = await client.mutation({
    createConversation: {
      __args: {
        data: {
          name: title,
          channel: 'WHATSAPP',
          handle,
          status: 'OPEN',
          unreadCount: 0,
          personId: person.id,
          ...(person.company?.id ? { companyId: person.company.id } : {}),
          ...(opportunityId ? { opportunityId } : {}),
        },
      },
      id: true,
    },
  });

  return {
    conversationId: createConversation?.id ?? null,
    title,
    handle,
    created: true,
    // Nobody has written yet, so this is honestly a closed window.
    window: serviceWindow({ lastInboundAt: null }),
  };
};

const handler = async (payload: RoutePayload) => {
  try {
    return await run(payload);
  } catch (error) {
    return new Response(
      {
        error: `Could not open that conversation: ${
          error instanceof Error ? error.message : String(error)
        }`,
      },
      { status: 500 },
    );
  }
};

export default defineLogicFunction({
  universalIdentifier: CONVERSATION_FOR_RECORD_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'conversation-for-record',
  description: 'Finds or creates the WhatsApp conversation for a contact or deal',
  timeoutSeconds: 15,
  handler,
  httpRouteTriggerSettings: {
    path: '/conversations/for-record',
    httpMethod: 'POST',
    isAuthRequired: true,
  },
});
