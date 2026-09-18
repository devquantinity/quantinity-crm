/**
 * Meta's Cloud API, as pure functions.
 *
 * The transport itself is a fetch and lives elsewhere. Everything that can be
 * got wrong without a network - which number a message is from, whether this
 * webhook is even ours, what "failed" means in words, which of Meta's dozen
 * message shapes carries text - is here, where it can be tested against real
 * payload shapes rather than discovered in production at 2am.
 *
 * Two formats meet at this boundary and they are NOT the same. Meta's wa_id is
 * digits only with no plus (60123456789). Quantinity stores +60123456789,
 * because a stored number should be unambiguous on sight. Every crossing goes
 * through waIdOf or handleFromWaId - never a raw string.
 */

import { normaliseHandle, previewOf, type DeliveryStatus } from 'src/lib/messaging';

export const GRAPH_API_VERSION = 'v21.0';
export const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

// --- the two number formats ----------------------------------------------

/** Quantinity -> Meta. "+60 12-345 6789" becomes "60123456789". */
export const waIdOf = (handle: string | null | undefined) =>
  normaliseHandle(handle).replace(/^\+/, '');

/** Meta -> Quantinity. "60123456789" becomes "+60123456789". */
export const handleFromWaId = (waId: string | null | undefined) => {
  const digits = String(waId ?? '').replace(/\D/g, '');

  // Already international - a wa_id always is - so do not let the local-number
  // rule in normaliseHandle mistake a leading digit for a trunk code.
  return digits.length >= 8 ? `+${digits}` : '';
};

// --- reading what Meta sends ---------------------------------------------

export type InboundMessage = {
  externalId: string;
  waId: string;
  handle: string;
  profileName: string;
  body: string;
  sentAt: string;
  isText: boolean;
};

export type StatusUpdate = {
  externalId: string;
  deliveryStatus: DeliveryStatus;
  deliveryDetail: string;
};

const secondsToIso = (timestamp: unknown) => {
  const seconds = Number(timestamp);

  return Number.isFinite(seconds) && seconds > 0
    ? new Date(seconds * 1000).toISOString()
    : new Date().toISOString();
};

/**
 * What a non-text message says in the thread.
 *
 * Dropping these was the tempting shortcut and it is the wrong one: the client
 * sent a photo of the signed quotation, and an inbox that shows nothing at all
 * is worse than one that says a photo arrived. The caption is theirs, so it is
 * preferred over the label whenever there is one.
 */
const describeNonText = (message: any): string => {
  const type = String(message?.type ?? 'unknown');
  const caption = String(message?.[type]?.caption ?? '').trim();

  if (caption) return caption;

  switch (type) {
    case 'image':
      return '[photo]';
    case 'video':
      return '[video]';
    case 'audio':
      return '[voice message]';
    case 'document':
      return `[document${message?.document?.filename ? `: ${message.document.filename}` : ''}]`;
    case 'sticker':
      return '[sticker]';
    case 'location':
      return '[location]';
    case 'contacts':
      return '[contact card]';
    case 'button':
      return String(message?.button?.text ?? '[button]');
    case 'interactive':
      return String(
        message?.interactive?.button_reply?.title ??
          message?.interactive?.list_reply?.title ??
          '[reply]',
      );
    default:
      return `[${type}]`;
  }
};

const changesOf = (body: any) =>
  (body?.entry ?? []).flatMap((entry: any) => entry?.changes ?? []);

/**
 * Is this webhook even about our number?
 *
 * One Meta app can be subscribed to several businesses, and a webhook for
 * somebody else's number must not land in this workspace's inbox. Meta puts the
 * phone_number_id in every payload precisely so this check is possible.
 */
export const isForPhoneNumber = (body: any, phoneNumberId: string) => {
  if (!phoneNumberId) return false;

  return changesOf(body).some(
    (change: any) =>
      String(change?.value?.metadata?.phone_number_id ?? '') === phoneNumberId,
  );
};

export const parseInboundMessages = (body: any): InboundMessage[] => {
  const inbound: InboundMessage[] = [];

  changesOf(body).forEach((change: any) => {
    const value = change?.value ?? {};
    const namesByWaId = new Map<string, string>();

    (value.contacts ?? []).forEach((contact: any) => {
      const waId = String(contact?.wa_id ?? '');
      const name = String(contact?.profile?.name ?? '').trim();

      if (waId && name) namesByWaId.set(waId, name);
    });

    (value.messages ?? []).forEach((message: any) => {
      const waId = String(message?.from ?? '');
      const externalId = String(message?.id ?? '');
      const handle = handleFromWaId(waId);

      // No id means no dedupe key, and a message we cannot recognise on a
      // retry would be posted into the thread twice.
      if (!externalId || !handle) return;

      const isText = message?.type === 'text';

      inbound.push({
        externalId,
        waId,
        handle,
        profileName: namesByWaId.get(waId) ?? '',
        body: isText ? String(message?.text?.body ?? '') : describeNonText(message),
        sentAt: secondsToIso(message?.timestamp),
        isText,
      });
    });
  });

  return inbound;
};

const STATUS_BY_META: Record<string, DeliveryStatus> = {
  sent: 'SENT',
  delivered: 'DELIVERED',
  read: 'READ',
  failed: 'FAILED',
};

export const parseStatusUpdates = (body: any): StatusUpdate[] => {
  const updates: StatusUpdate[] = [];

  changesOf(body).forEach((change: any) => {
    (change?.value?.statuses ?? []).forEach((status: any) => {
      const externalId = String(status?.id ?? '');
      const deliveryStatus = STATUS_BY_META[String(status?.status ?? '')];

      if (!externalId || !deliveryStatus) return;

      const error = (status?.errors ?? [])[0];
      const detail = error
        ? [error.title, error.message ?? error.error_data?.details]
            .filter(Boolean)
            .map(String)
            .join(' - ')
        : '';

      updates.push({ externalId, deliveryStatus, deliveryDetail: detail });
    });
  });

  return updates;
};

// --- talking back --------------------------------------------------------

/**
 * The sentence Meta actually wrote, rather than "request failed with 400".
 *
 * Meta is unusually good at saying what is wrong - "Message failed to send
 * because more than 24 hours have passed since the customer last replied" - and
 * throwing that away in favour of a status code is throwing away the answer.
 */
export const cloudApiError = (status: number, body: any): string => {
  const error = body?.error;

  if (error) {
    const parts = [error.message, error.error_data?.details]
      .filter(Boolean)
      .map(String);
    const unique = [...new Set(parts)];

    if (unique.length > 0) return unique.join(' - ');
  }

  return `WhatsApp returned ${status} with no explanation.`;
};

export const textMessagePayload = ({
  waId,
  body,
}: {
  waId: string;
  body: string;
}) => ({
  messaging_product: 'whatsapp',
  recipient_type: 'individual',
  to: waId,
  type: 'text',
  text: { preview_url: false, body },
});

/** The label a new conversation gets when only WhatsApp knows who this is. */
export const inboundConversationName = (message: InboundMessage) =>
  message.profileName.trim() || message.handle;

export const inboundPreview = (message: InboundMessage) => previewOf(message.body);

/**
 * Should this status replace the one already on the message?
 *
 * Delivery events arrive out of order - "read" can land before "delivered",
 * and Meta redelivers old ones. Without this rule a message that a client has
 * already read visibly drops back to one grey tick, which looks exactly like a
 * bug to the person watching. Status only ever moves forwards.
 */
const STATUS_RANK: Record<string, number> = {
  QUEUED: 0,
  SENT: 1,
  DELIVERED: 2,
  READ: 3,
  // Terminal: a failure is the end of the story, and a received message has no
  // onward journey to report.
  FAILED: 4,
  RECEIVED: 4,
};

export const shouldAdvanceStatus = (
  current: DeliveryStatus | null | undefined,
  next: DeliveryStatus,
) => (STATUS_RANK[next] ?? 0) > (STATUS_RANK[current ?? 'QUEUED'] ?? 0);
