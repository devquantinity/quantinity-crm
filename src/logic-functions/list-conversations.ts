import { defineLogicFunction } from 'twenty-sdk/define';
import { Response, type RoutePayload } from 'twenty-sdk/logic-function';
import { CoreApiClient } from 'twenty-client-sdk/core';

import { LIST_CONVERSATIONS_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/messaging-identifiers';
import {
  conversationLabel,
  displayHandle,
  serviceWindow,
  sortConversations,
} from 'src/lib/messaging';

/**
 * The inbox list.
 *
 * Note what is NOT here: each conversation's last message. Twenty refuses a
 * one-to-many nested inside another one-to-many, so asking for it would either
 * fail outright or cost one query per row. That is exactly what
 * Conversation.lastMessagePreview and lastMessageAt are for - they are written
 * when a message lands and read here, and the list is one query however many
 * chats there are.
 *
 * person and company are a single hop each. Reading the company THROUGH the
 * person would be two, which Twenty answers with a silent null.
 */

const run = async (_payload: RoutePayload) => {
  const client = new CoreApiClient();

  const { conversations } = await client.query({
    conversations: {
      __args: { first: 200 },
      edges: {
        node: {
          id: true,
          name: true,
          channel: true,
          handle: true,
          status: true,
          lastMessageAt: true,
          lastInboundAt: true,
          lastMessagePreview: true,
          unreadCount: true,
          person: { id: true, name: { firstName: true, lastName: true } },
          company: { id: true, name: true },
          opportunity: { id: true, name: true },
        },
      },
    },
  });

  const now = Date.now();

  const rows = (conversations?.edges ?? []).map((edge: any) => {
    const node = edge.node;
    const personName = [node.person?.name?.firstName, node.person?.name?.lastName]
      .filter(Boolean)
      .join(' ');

    return {
      id: node.id,
      channel: node.channel ?? 'WHATSAPP',
      handle: displayHandle(node.handle),
      status: node.status ?? 'OPEN',
      lastMessageAt: node.lastMessageAt ?? null,
      lastInboundAt: node.lastInboundAt ?? null,
      preview: node.lastMessagePreview ?? '',
      unreadCount: Math.max(0, Number(node.unreadCount ?? 0)),
      title: conversationLabel({
        personName,
        companyName: node.company?.name,
        handle: node.handle,
      }),
      personId: node.person?.id ?? null,
      companyName: node.company?.name ?? '',
      opportunityId: node.opportunity?.id ?? null,
      opportunityName: node.opportunity?.name ?? '',
      window: serviceWindow({ lastInboundAt: node.lastInboundAt, now }),
    };
  });

  return { conversations: sortConversations(rows) };
};

const handler = async (payload: RoutePayload) => {
  try {
    return await run(payload);
  } catch (error) {
    return new Response(
      {
        error: `Could not load the inbox: ${
          error instanceof Error ? error.message : String(error)
        }`,
      },
      { status: 500 },
    );
  }
};

export default defineLogicFunction({
  universalIdentifier: LIST_CONVERSATIONS_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'list-conversations',
  description: 'Returns the conversation list for the inbox',
  timeoutSeconds: 10,
  handler,
  httpRouteTriggerSettings: {
    path: '/conversations',
    httpMethod: 'GET',
    isAuthRequired: true,
  },
});
