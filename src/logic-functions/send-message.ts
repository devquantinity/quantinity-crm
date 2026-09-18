import { defineLogicFunction } from 'twenty-sdk/define';
import { Response, type RoutePayload } from 'twenty-sdk/logic-function';
import { CoreApiClient } from 'twenty-client-sdk/core';

import { SEND_MESSAGE_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/messaging-identifiers';
import {
  conversationAfterMessage,
  messageLabel,
  outboundProblem,
  serviceWindow,
  type Channel,
} from 'src/lib/messaging';
import { transportFor } from 'src/lib/transport';

/**
 * Send a reply.
 *
 * Order matters here, and it is the opposite of the obvious one: the message is
 * written to the database FIRST, then handed to the transport, then updated
 * with whatever the transport said. Sending first and recording after loses the
 * message entirely whenever the provider succeeds and the write fails - the
 * client got it, and Quantinity has no idea it was ever sent.
 *
 * So a message always exists, and its deliveryStatus is the truth about where
 * it got to. Today that truth is QUEUED, because no transport is connected.
 */

const run = async (payload: RoutePayload) => {
  const client = new CoreApiClient();
  const body = (payload.body ?? {}) as {
    conversationId?: string;
    body?: string;
  };

  const conversationId = body.conversationId;
  const text = String(body.body ?? '');

  if (!conversationId) {
    return new Response({ error: 'No conversation was given.' }, { status: 400 });
  }

  const { conversations } = await client.query({
    conversations: {
      __args: { filter: { id: { eq: conversationId } }, first: 1 },
      edges: {
        node: {
          id: true,
          channel: true,
          handle: true,
          status: true,
          lastMessageAt: true,
          lastInboundAt: true,
          lastMessagePreview: true,
          unreadCount: true,
        },
      },
    },
  });

  const conversation = (conversations?.edges ?? [])[0]?.node;

  if (!conversation) {
    return new Response({ error: 'That conversation no longer exists.' }, { status: 404 });
  }

  const problem = outboundProblem({ handle: conversation.handle, body: text });

  if (problem) {
    return new Response({ error: problem }, { status: 422 });
  }

  const channel = (conversation.channel ?? 'WHATSAPP') as Channel;
  const window = serviceWindow({ lastInboundAt: conversation.lastInboundAt });
  const sentAt = new Date().toISOString();

  const { createChatMessage } = await client.mutation({
    createChatMessage: {
      __args: {
        data: {
          name: messageLabel(text),
          direction: 'OUTBOUND',
          body: text,
          sentAt,
          deliveryStatus: 'QUEUED',
          conversationId,
        },
      },
      id: true,
    },
  });

  const messageId = createChatMessage?.id;

  const result = await transportFor(channel).send({
    channel,
    to: conversation.handle ?? '',
    body: text,
    isWithinServiceWindow: window.isOpen,
  });

  if (messageId) {
    await client.mutation({
      updateChatMessage: {
        __args: {
          id: messageId,
          data: {
            deliveryStatus: result.deliveryStatus,
            deliveryDetail: result.deliveryDetail,
            externalId: result.externalId ?? '',
          },
        },
        id: true,
      },
    });
  }

  const next = conversationAfterMessage({
    conversation,
    message: { direction: 'OUTBOUND', body: text, sentAt },
  });

  await client.mutation({
    updateConversation: {
      __args: {
        id: conversationId,
        data: {
          lastMessageAt: next.lastMessageAt,
          lastMessagePreview: next.lastMessagePreview,
          status: next.status,
        },
      },
      id: true,
    },
  });

  return {
    ok: true,
    messageId: messageId ?? null,
    sentAt,
    deliveryStatus: result.deliveryStatus,
    deliveryDetail: result.deliveryDetail,
    window,
  };
};

const handler = async (payload: RoutePayload) => {
  try {
    return await run(payload);
  } catch (error) {
    return new Response(
      {
        error: `Could not send that message: ${
          error instanceof Error ? error.message : String(error)
        }`,
      },
      { status: 500 },
    );
  }
};

export default defineLogicFunction({
  universalIdentifier: SEND_MESSAGE_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'send-message',
  description: 'Records an outbound message and hands it to the transport',
  timeoutSeconds: 20,
  handler,
  httpRouteTriggerSettings: {
    path: '/messages/send',
    httpMethod: 'POST',
    isAuthRequired: true,
  },
});
