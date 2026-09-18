import { createHmac, timingSafeEqual } from 'node:crypto';

import { defineLogicFunction } from 'twenty-sdk/define';
import { Response, type RoutePayload } from 'twenty-sdk/logic-function';
import { CoreApiClient } from 'twenty-client-sdk/core';

import { WHATSAPP_WEBHOOK_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/messaging-identifiers';
import {
  conversationAfterMessage,
  messageLabel,
  normaliseHandle,
} from 'src/lib/messaging';
import {
  inboundConversationName,
  isForPhoneNumber,
  parseInboundMessages,
  parseStatusUpdates,
  shouldAdvanceStatus,
  type InboundMessage,
} from 'src/lib/whatsapp-cloud';
import { whatsAppConfig } from 'src/lib/whatsapp-config';
import { matchContact, narrowingSuffix } from 'src/lib/contact-match';

/**
 * Everything WhatsApp sends us: messages in, and delivery news about messages
 * out.
 *
 * This endpoint is public and unauthenticated, so the app secret signature is
 * the only thing between it and anyone who finds the URL. It is checked against
 * the RAW body, before parsing - re-serialising the JSON would not reproduce
 * the same bytes and the check would fail for honest requests.
 *
 * It always answers 200. Meta retries anything else, and a retry storm caused
 * by our own bug is a worse outcome than a dropped message we can see in the
 * logs. The one exception is a bad signature, which is a 401 on purpose.
 */

const signatureIsValid = (payload: RoutePayload, appSecret: string) => {
  const header =
    payload.headers?.['x-hub-signature-256'] ??
    payload.headers?.['X-Hub-Signature-256'];
  const raw = payload.rawBody;

  // No secret configured, no raw body to check, or no signature sent: refuse.
  // A check that cannot run must never be a check that passes.
  if (!appSecret || typeof raw !== 'string' || !header?.startsWith('sha256=')) {
    return false;
  }

  const expected = Buffer.from(
    createHmac('sha256', appSecret).update(raw, 'utf8').digest('hex'),
    'hex',
  );
  const provided = Buffer.from(header.slice('sha256='.length), 'hex');

  return (
    expected.length === provided.length && timingSafeEqual(expected, provided)
  );
};

const findConversationByHandle = async (client: any, handle: string) => {
  const { conversations } = await client.query({
    conversations: {
      __args: { first: 200 },
      edges: {
        node: {
          id: true,
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

  // Matched on the normalised number, not the stored string: the same person is
  // one conversation whether the handle was typed as 012-345 6789 or +60...
  return (conversations?.edges ?? [])
    .map((edge: any) => edge.node)
    .find((node: any) => normaliseHandle(node.handle) === handle);
};

/**
 * Who does this number belong to?
 *
 * Narrowed in the query on the last seven digits, then matched in memory. The
 * shapes a phone gets stored in - split across a calling code, pasted whole,
 * typed with dashes - are not something one filter can normalise, but they all
 * end the same way, so the suffix is a cheap way to get from every contact in
 * the CRM down to the few worth looking at properly.
 */
const matchPersonForHandle = async (client: any, handle: string) => {
  const suffix = narrowingSuffix(handle);

  if (!suffix) return { personId: null, companyId: null, reason: 'unusable number' };

  const { people } = await client.query({
    people: {
      __args: {
        filter: { phones: { primaryPhoneNumber: { ilike: `%${suffix}` } } },
        first: 50,
      },
      edges: {
        node: {
          id: true,
          phones: {
            primaryPhoneNumber: true,
            primaryPhoneCallingCode: true,
            additionalPhones: { number: true, callingCode: true },
          },
          company: { id: true },
        },
      },
    },
  });

  return matchContact({
    handle,
    contacts: (people?.edges ?? []).map((edge: any) => edge.node),
  });
};

const alreadyStored = async (client: any, externalId: string) => {
  const { chatMessages } = await client.query({
    chatMessages: {
      __args: { filter: { externalId: { eq: externalId } }, first: 1 },
      edges: { node: { id: true } },
    },
  });

  return (chatMessages?.edges ?? []).length > 0;
};

const receive = async (client: any, message: InboundMessage) => {
  // Meta retries, so the same message arrives more than once. Without this the
  // thread shows it twice and the unread count is wrong forever after.
  if (await alreadyStored(client, message.externalId)) return 'duplicate';

  let conversation = await findConversationByHandle(client, message.handle);

  if (!conversation) {
    // A number we already know belongs on the right contact from the first
    // message, not after somebody notices and links it by hand.
    const match = await matchPersonForHandle(client, message.handle);

    const { createConversation } = await client.mutation({
      createConversation: {
        __args: {
          data: {
            name: inboundConversationName(message),
            channel: 'WHATSAPP',
            handle: message.handle,
            status: 'OPEN',
            unreadCount: 0,
            ...(match.personId ? { personId: match.personId } : {}),
            ...(match.companyId ? { companyId: match.companyId } : {}),
          },
        },
        id: true,
        status: true,
        lastMessageAt: true,
        lastInboundAt: true,
        lastMessagePreview: true,
        unreadCount: true,
      },
    });

    conversation = createConversation;
  }

  if (!conversation?.id) return 'skipped';

  await client.mutation({
    createChatMessage: {
      __args: {
        data: {
          name: messageLabel(message.body),
          direction: 'INBOUND',
          body: message.body,
          sentAt: message.sentAt,
          deliveryStatus: 'RECEIVED',
          externalId: message.externalId,
          conversationId: conversation.id,
        },
      },
      id: true,
    },
  });

  const next = conversationAfterMessage({
    conversation,
    message: { direction: 'INBOUND', body: message.body, sentAt: message.sentAt },
  });

  await client.mutation({
    updateConversation: {
      __args: {
        id: conversation.id,
        data: {
          lastMessageAt: next.lastMessageAt,
          lastInboundAt: next.lastInboundAt,
          lastMessagePreview: next.lastMessagePreview,
          unreadCount: next.unreadCount,
          status: next.status,
        },
      },
      id: true,
    },
  });

  return 'stored';
};

const applyStatus = async (
  client: any,
  update: { externalId: string; deliveryStatus: string; deliveryDetail: string },
) => {
  const { chatMessages } = await client.query({
    chatMessages: {
      __args: { filter: { externalId: { eq: update.externalId } }, first: 1 },
      edges: { node: { id: true, deliveryStatus: true } },
    },
  });

  const existing = (chatMessages?.edges ?? [])[0]?.node;

  if (!existing?.id) return false;

  if (!shouldAdvanceStatus(existing.deliveryStatus, update.deliveryStatus as any)) {
    return false;
  }

  await client.mutation({
    updateChatMessage: {
      __args: {
        id: existing.id,
        data: {
          deliveryStatus: update.deliveryStatus,
          deliveryDetail: update.deliveryDetail,
        },
      },
      id: true,
    },
  });

  return true;
};

const run = async (payload: RoutePayload) => {
  const config = whatsAppConfig();

  if (!signatureIsValid(payload, config.appSecret)) {
    return new Response({ error: 'Bad signature' }, { status: 401 });
  }

  const body = payload.body ?? {};

  if (!isForPhoneNumber(body, config.phoneNumberId)) {
    return { ok: true, ignored: 'not this workspace number' };
  }

  const client = new CoreApiClient();
  const inbound = parseInboundMessages(body);
  const statuses = parseStatusUpdates(body);

  let stored = 0;
  let duplicates = 0;

  for (const message of inbound) {
    const outcome = await receive(client, message);

    if (outcome === 'stored') stored += 1;
    if (outcome === 'duplicate') duplicates += 1;
  }

  let updated = 0;

  for (const update of statuses) {
    if (await applyStatus(client, update)) updated += 1;
  }

  return { ok: true, stored, duplicates, updated };
};

const handler = async (payload: RoutePayload) => {
  try {
    return await run(payload);
  } catch (error) {
    // 200 on purpose. Meta retries a non-2xx for hours, and a bug of ours must
    // not turn into a retry storm against our own server.
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

export default defineLogicFunction({
  universalIdentifier: WHATSAPP_WEBHOOK_LOGIC_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'whatsapp-webhook',
  description: 'Receives WhatsApp messages and delivery statuses from Meta',
  timeoutSeconds: 30,
  handler,
  httpRouteTriggerSettings: {
    path: '/whatsapp/webhook',
    httpMethod: 'POST',
    isAuthRequired: false,
    forwardedRequestHeaders: ['x-hub-signature-256'],
  },
});
