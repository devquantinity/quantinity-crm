import { defineLogicFunction } from 'twenty-sdk/define';
import { Response, type RoutePayload } from 'twenty-sdk/logic-function';
import { CoreApiClient } from 'twenty-client-sdk/core';

import { LIST_MESSAGES_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/messaging-identifiers';
import { serviceWindow, sortMessages } from 'src/lib/messaging';

/**
 * One thread.
 *
 * Opening a thread marks it read, because that is what opening a thread means.
 * It is a side effect on a GET, which is not lovely, but the alternative is a
 * second round trip whose only job is to say "yes, really, I opened it".
 * markRead=0 turns it off for anything that wants to peek without clearing the
 * badge.
 */

const run = async (payload: RoutePayload) => {
  const client = new CoreApiClient();
  const conversationId = payload.queryStringParameters?.conversationId;
  const shouldMarkRead = payload.queryStringParameters?.markRead !== '0';

  if (!conversationId) {
    return new Response(
      { error: 'Which conversation? No conversationId was given.' },
      { status: 400 },
    );
  }

  const { chatMessages } = await client.query({
    chatMessages: {
      __args: {
        filter: { conversationId: { eq: conversationId } },
        first: 300,
      },
      edges: {
        node: {
          id: true,
          direction: true,
          body: true,
          sentAt: true,
          deliveryStatus: true,
          deliveryDetail: true,
          externalId: true,
        },
      },
    },
  });

  // The singular finder THROWS "Record not found" rather than returning null,
  // so this is a filtered list even though exactly one row is wanted.
  const { conversations } = await client.query({
    conversations: {
      __args: { filter: { id: { eq: conversationId } }, first: 1 },
      edges: {
        node: {
          id: true,
          handle: true,
          channel: true,
          status: true,
          lastInboundAt: true,
          unreadCount: true,
        },
      },
    },
  });

  const conversation = (conversations?.edges ?? [])[0]?.node;

  if (!conversation) {
    return new Response({ error: 'That conversation no longer exists.' }, { status: 404 });
  }

  if (shouldMarkRead && Number(conversation.unreadCount ?? 0) > 0) {
    await client.mutation({
      updateConversation: {
        __args: { id: conversationId, data: { unreadCount: 0 } },
        id: true,
      },
    });
  }

  const rows = (chatMessages?.edges ?? []).map((edge: any) => edge.node);

  return {
    conversationId,
    handle: conversation.handle ?? '',
    channel: conversation.channel ?? 'WHATSAPP',
    status: conversation.status ?? 'OPEN',
    window: serviceWindow({ lastInboundAt: conversation.lastInboundAt }),
    messages: sortMessages(rows),
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
  universalIdentifier: LIST_MESSAGES_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'list-messages',
  description: 'Returns one conversation thread and marks it read',
  timeoutSeconds: 10,
  handler,
  httpRouteTriggerSettings: {
    path: '/messages',
    httpMethod: 'GET',
    isAuthRequired: true,
  },
});
