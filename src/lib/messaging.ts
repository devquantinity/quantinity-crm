/**
 * The messaging rules, with no Twenty in them.
 *
 * Everything here is a pure function of its arguments, for two reasons. One:
 * the interesting parts - which number is which, whether a reply is still free,
 * what the inbox row should say after a message lands - are decisions, and
 * decisions are worth testing without a server. Two: the transport is not
 * chosen yet. WhatsApp can be reached through Meta's official Cloud API or
 * through an unofficial bridge, and that choice changes ONE object in this
 * file. Nothing above it needs to know which one won.
 */

export type Channel = 'WHATSAPP' | 'SMS' | 'EMAIL';
export type Direction = 'INBOUND' | 'OUTBOUND';
export type DeliveryStatus =
  | 'QUEUED'
  | 'SENT'
  | 'DELIVERED'
  | 'READ'
  | 'FAILED'
  | 'RECEIVED';
export type ConversationStatus = 'OPEN' | 'SNOOZED' | 'CLOSED';

export type MessageLike = {
  id?: string;
  direction: Direction;
  body?: string | null;
  sentAt?: string | null;
  deliveryStatus?: DeliveryStatus | null;
};

export type ConversationLike = {
  id?: string;
  status?: ConversationStatus | null;
  lastMessageAt?: string | null;
  lastInboundAt?: string | null;
  lastMessagePreview?: string | null;
  unreadCount?: number | null;
};

// --- phone numbers -------------------------------------------------------

const DEFAULT_DIAL_CODE = '60';
const MIN_DIGITS = 8;

/**
 * Put a phone number into one shape so the same person is one conversation.
 *
 * People type 012-345 6789, +60 12 345 6789 and 60123456789 for the same
 * number, and a threading key that treats those as three contacts produces
 * three half-conversations. A number that cannot be a number comes back empty
 * rather than as a plausible-looking wrong one - the caller refuses, loudly.
 */
export const normaliseHandle = (
  raw: string | null | undefined,
  defaultDialCode: string = DEFAULT_DIAL_CODE,
): string => {
  const trimmed = String(raw ?? '').trim();

  if (trimmed.length === 0) return '';

  const hadPlus = trimmed.startsWith('+');
  let digits = trimmed.replace(/\D/g, '');

  if (digits.length === 0) return '';

  // 00 is the other way of writing +, in most of the world.
  if (!hadPlus && digits.startsWith('00')) {
    digits = digits.slice(2);
  } else if (!hadPlus && digits.startsWith('0')) {
    // A local number: 012... is really +60 12...
    digits = `${defaultDialCode}${digits.replace(/^0+/, '')}`;
  }

  if (digits.length < MIN_DIGITS) return '';

  return `+${digits}`;
};

export const sameHandle = (
  left: string | null | undefined,
  right: string | null | undefined,
) => {
  const a = normaliseHandle(left);
  return a.length > 0 && a === normaliseHandle(right);
};

/** What a person reads. +60123456789 -> +60 12-345 6789 is not worth the bugs. */
export const displayHandle = (handle: string | null | undefined) =>
  normaliseHandle(handle) || String(handle ?? '').trim();

// --- previews and labels -------------------------------------------------

const collapse = (body: string | null | undefined) =>
  String(body ?? '')
    .replace(/\s+/g, ' ')
    .trim();

/** One line for the inbox list. Ellipsis only when something was actually cut. */
export const previewOf = (body: string | null | undefined, max = 90) => {
  const flat = collapse(body);

  if (flat.length <= max) return flat;

  return `${flat.slice(0, max - 1).trimEnd()}…`;
};

/** Twenty shows `name` everywhere a record is referenced, so give it one. */
export const messageLabel = (body: string | null | undefined) =>
  previewOf(body, 50) || 'Message';

export const conversationLabel = ({
  personName,
  companyName,
  handle,
}: {
  personName?: string | null;
  companyName?: string | null;
  handle?: string | null;
}) =>
  collapse(personName) ||
  collapse(companyName) ||
  displayHandle(handle) ||
  'Unknown number';

// --- time ----------------------------------------------------------------

const toTime = (value: string | number | Date | null | undefined) => {
  if (value === null || value === undefined || value === '') return null;

  const time = value instanceof Date ? value.getTime() : new Date(value).getTime();

  return Number.isFinite(time) ? time : null;
};

const later = (
  left: string | null | undefined,
  right: string | null | undefined,
) => {
  const a = toTime(left);
  const b = toTime(right);

  if (a === null) return right ?? null;
  if (b === null) return left ?? null;

  return b > a ? right ?? null : left ?? null;
};

export const dayKey = (value: string | null | undefined) => {
  const time = toTime(value);

  if (time === null) return '';

  const date = new Date(time);
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');

  return `${date.getFullYear()}-${month}-${day}`;
};

export const timeLabel = (value: string | null | undefined) => {
  const time = toTime(value);

  if (time === null) return '';

  const date = new Date(time);

  return `${`${date.getHours()}`.padStart(2, '0')}:${`${date.getMinutes()}`.padStart(2, '0')}`;
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const dayLabel = (
  value: string | null | undefined,
  now: string | number | Date = Date.now(),
) => {
  const time = toTime(value);

  if (time === null) return '';

  const today = dayKey(new Date(toTime(now) ?? Date.now()).toISOString());
  const yesterday = dayKey(
    new Date((toTime(now) ?? Date.now()) - 24 * 60 * 60 * 1000).toISOString(),
  );
  const key = dayKey(value);

  if (key === today) return 'Today';
  if (key === yesterday) return 'Yesterday';

  const date = new Date(time);

  return `${date.getDate()} ${MONTHS[date.getMonth()]}`;
};

// --- ordering ------------------------------------------------------------

/** Newest chat first, the way every inbox on earth is ordered. */
export const sortConversations = <T extends ConversationLike>(rows: readonly T[]) =>
  [...rows].sort((a, b) => {
    const diff = (toTime(b.lastMessageAt) ?? 0) - (toTime(a.lastMessageAt) ?? 0);

    return diff !== 0 ? diff : String(a.id ?? '').localeCompare(String(b.id ?? ''));
  });

/** Oldest first, the way every thread on earth is ordered. */
export const sortMessages = <T extends MessageLike>(rows: readonly T[]) =>
  [...rows].sort((a, b) => {
    const diff = (toTime(a.sentAt) ?? 0) - (toTime(b.sentAt) ?? 0);

    return diff !== 0 ? diff : String(a.id ?? '').localeCompare(String(b.id ?? ''));
  });

/** Day separators, computed once rather than per rendered bubble. */
export const groupMessagesByDay = <T extends MessageLike>(rows: readonly T[]) => {
  const groups: Array<{ key: string; messages: T[] }> = [];

  sortMessages(rows).forEach((message) => {
    const key = dayKey(message.sentAt);
    const last = groups[groups.length - 1];

    if (last && last.key === key) {
      last.messages.push(message);

      return;
    }

    groups.push({ key, messages: [message] });
  });

  return groups;
};

export const unreadTotal = (rows: readonly ConversationLike[]) =>
  rows.reduce((total, row) => total + Math.max(0, Number(row.unreadCount ?? 0)), 0);

// --- the 24 hour window --------------------------------------------------

export const SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000;

export type ServiceWindow = {
  isOpen: boolean;
  closesAt: string | null;
  msLeft: number;
  reason: string;
};

/**
 * Whether a plain reply will actually be delivered.
 *
 * WhatsApp only lets a business answer freely for 24 hours after the customer's
 * last message. Outside that, a message has to be a pre-approved template and
 * is charged. This is not a detail to discover in production when a reply
 * silently does not arrive - the composer says so before you type.
 *
 * It is worth knowing which way the money runs here: inside the window, replies
 * are free. A CRM inbox that mostly answers people is mostly free.
 */
export const serviceWindow = ({
  lastInboundAt,
  now = Date.now(),
}: {
  lastInboundAt?: string | null;
  now?: string | number | Date;
}): ServiceWindow => {
  const from = toTime(lastInboundAt);
  const at = toTime(now) ?? Date.now();

  if (from === null) {
    return {
      isOpen: false,
      closesAt: null,
      msLeft: 0,
      reason:
        'They have not written to you yet, so the first message has to be an approved template.',
    };
  }

  const closes = from + SERVICE_WINDOW_MS;
  const msLeft = closes - at;

  if (msLeft <= 0) {
    return {
      isOpen: false,
      closesAt: new Date(closes).toISOString(),
      msLeft: 0,
      reason:
        'It is more than 24 hours since they last wrote, so a plain reply will not be delivered - it has to be an approved template.',
    };
  }

  return {
    isOpen: true,
    closesAt: new Date(closes).toISOString(),
    msLeft,
    reason: '',
  };
};

export const describeWindow = (window: ServiceWindow) => {
  if (!window.isOpen) return 'Reply window closed';

  const minutes = Math.floor(window.msLeft / 60000);
  const hours = Math.floor(minutes / 60);

  if (hours >= 1) return `Free replies for ${hours}h ${minutes % 60}m`;

  return `Free replies for ${Math.max(1, minutes)}m`;
};

// --- what a message does to its conversation ------------------------------

/**
 * The denormalised inbox fields, recomputed after a message lands.
 *
 * Conversation.lastMessageAt / lastInboundAt / lastMessagePreview / unreadCount
 * are copies, and copies drift. This is the single place they are derived, so
 * there is exactly one thing to get right and one thing to test.
 *
 * The ordering check matters more than it looks: providers redeliver, and a
 * webhook can hand you a message from an hour ago after you already have a
 * newer one. An older message must not overwrite the preview - but it still
 * counts as unread, because nobody read it either.
 */
export const conversationAfterMessage = ({
  conversation,
  message,
}: {
  conversation: ConversationLike;
  message: MessageLike;
}) => {
  const isNewest =
    (toTime(message.sentAt) ?? 0) >= (toTime(conversation.lastMessageAt) ?? 0);
  const isInbound = message.direction === 'INBOUND';
  const unread = Math.max(0, Number(conversation.unreadCount ?? 0));

  return {
    lastMessageAt: later(conversation.lastMessageAt, message.sentAt),
    lastInboundAt: isInbound
      ? later(conversation.lastInboundAt, message.sentAt)
      : conversation.lastInboundAt ?? null,
    lastMessagePreview: isNewest
      ? previewOf(message.body)
      : conversation.lastMessagePreview ?? '',
    unreadCount: isInbound ? unread + 1 : unread,
    // Someone writing again reopens a chat that was closed. Anything else and
    // a resolved thread swallows the next question silently.
    status: (isInbound ? 'OPEN' : conversation.status ?? 'OPEN') as ConversationStatus,
  };
};

// --- the transport --------------------------------------------------------

export type OutboundMessage = {
  channel: Channel;
  to: string;
  body: string;
  isWithinServiceWindow: boolean;
};

export type TransportResult = {
  externalId: string | null;
  deliveryStatus: DeliveryStatus;
  deliveryDetail: string;
};

export interface MessageTransport {
  readonly name: string;
  readonly isConnected: boolean;
  send(message: OutboundMessage): Promise<TransportResult>;
}

/**
 * What sending does until a real number is connected.
 *
 * It saves the message and says so. It does NOT report SENT: a green tick on a
 * message that never left is the worst possible lie for this app to tell, and
 * the whole point of writing the stub honestly is that the day a transport is
 * connected, nothing above this line changes.
 */
export const unconnectedTransport: MessageTransport = {
  name: 'none',
  isConnected: false,
  send: async () => ({
    externalId: null,
    deliveryStatus: 'QUEUED' as const,
    deliveryDetail:
      'Saved in Quantinity only. No WhatsApp number is connected yet, so this was not delivered.',
  }),
};

/**
 * The one line that changes when the WhatsApp route is decided.
 *
 * Meta's Cloud API or an unofficial bridge - either way it is a MessageTransport
 * returned from here, and every caller already handles a send that does not
 * arrive, because that is what the stub does today.
 */
export const transportFor = (_channel: Channel): MessageTransport =>
  unconnectedTransport;

/** Refuse before the transport is even asked. */
export const outboundProblem = ({
  handle,
  body,
}: {
  handle?: string | null;
  body?: string | null;
}) => {
  if (collapse(body).length === 0) return 'There is nothing to send.';

  if (normaliseHandle(handle).length === 0) {
    return 'This conversation has no usable phone number on it, so there is nowhere to send.';
  }

  return '';
};
