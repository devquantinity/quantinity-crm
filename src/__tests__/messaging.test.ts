import { describe, expect, it } from 'vitest';

import {
  conversationAfterMessage,
  conversationLabel,
  describeWindow,
  groupMessagesByDay,
  messageLabel,
  normaliseHandle,
  outboundProblem,
  previewOf,
  sameHandle,
  serviceWindow,
  sortConversations,
  sortMessages,
  unconnectedTransport,
  unreadTotal,
  type MessageLike,
} from 'src/lib/messaging';

const at = (iso: string) => iso;

describe('normaliseHandle', () => {
  it('collapses the ways one Malaysian number gets typed', () => {
    const spellings = [
      '012-345 6789',
      '+60 12 345 6789',
      '60123456789',
      '0060123456789',
      '+60123456789',
    ];

    spellings.forEach((spelling) => {
      expect(normaliseHandle(spelling)).toBe('+60123456789');
    });
  });

  it('leaves a foreign number alone', () => {
    expect(normaliseHandle('+1 415 555 0123')).toBe('+14155550123');
  });

  it('is idempotent', () => {
    expect(normaliseHandle(normaliseHandle('012-345 6789'))).toBe('+60123456789');
  });

  it('returns nothing rather than a plausible wrong number', () => {
    expect(normaliseHandle('')).toBe('');
    expect(normaliseHandle('   ')).toBe('');
    expect(normaliseHandle('not a phone')).toBe('');
    expect(normaliseHandle('12345')).toBe('');
  });

  it('matches two spellings of the same number', () => {
    expect(sameHandle('012-345 6789', '+60123456789')).toBe(true);
    expect(sameHandle('012-345 6789', '+60129999999')).toBe(false);
    expect(sameHandle('', '')).toBe(false);
  });
});

describe('previews', () => {
  it('flattens newlines so a list row stays one line', () => {
    expect(previewOf('Hello\n\nthere   friend')).toBe('Hello there friend');
  });

  it('only adds an ellipsis when it actually cut something', () => {
    expect(previewOf('short', 10)).toBe('short');
    expect(previewOf('a'.repeat(20), 10)).toBe(`${'a'.repeat(9)}…`);
  });

  it('never leaves a record without a name', () => {
    expect(messageLabel('')).toBe('Message');
    expect(messageLabel('   ')).toBe('Message');
  });
});

describe('conversationLabel', () => {
  const handle = '012-345 6789';

  it('prefers the linked contact, because that name stays current', () => {
    expect(
      conversationLabel({
        personName: 'Nurul Huda',
        conversationName: 'whoever this is',
        companyName: 'Acme Trading',
        handle,
      }),
    ).toBe('Nurul Huda');
  });

  it('falls back to the name someone typed on the conversation', () => {
    expect(conversationLabel({ conversationName: 'Nurul Huda', handle })).toBe(
      'Nurul Huda',
    );
  });

  it('then the company, then the number - never a blank row', () => {
    expect(conversationLabel({ companyName: 'Acme Trading', handle })).toBe(
      'Acme Trading',
    );
    expect(conversationLabel({ handle })).toBe('+60123456789');
    expect(conversationLabel({})).toBe('Unknown number');
  });

  it('ignores whitespace-only names rather than heading a row with nothing', () => {
    expect(conversationLabel({ personName: '   ', conversationName: 'Nurul', handle })).toBe(
      'Nurul',
    );
  });
});

describe('ordering', () => {
  it('puts the newest chat at the top and the oldest message first', () => {
    const conversations = [
      { id: 'a', lastMessageAt: at('2026-09-10T08:00:00.000Z') },
      { id: 'b', lastMessageAt: at('2026-09-12T08:00:00.000Z') },
      { id: 'c', lastMessageAt: null },
    ];

    expect(sortConversations(conversations).map((row) => row.id)).toEqual([
      'b',
      'a',
      'c',
    ]);

    const messages: MessageLike[] = [
      { id: '2', direction: 'OUTBOUND', sentAt: at('2026-09-12T09:00:00.000Z') },
      { id: '1', direction: 'INBOUND', sentAt: at('2026-09-12T08:00:00.000Z') },
    ];

    expect(sortMessages(messages).map((row) => row.id)).toEqual(['1', '2']);
  });

  it('does not mutate what it was given', () => {
    const messages: MessageLike[] = [
      { id: '2', direction: 'OUTBOUND', sentAt: at('2026-09-12T09:00:00.000Z') },
      { id: '1', direction: 'INBOUND', sentAt: at('2026-09-12T08:00:00.000Z') },
    ];

    sortMessages(messages);

    expect(messages.map((row) => row.id)).toEqual(['2', '1']);
  });

  it('groups a thread into days in order', () => {
    const base = new Date('2026-09-12T03:00:00.000Z').getTime();
    const messages: MessageLike[] = [
      { id: '3', direction: 'INBOUND', sentAt: new Date(base + 48 * 3600_000).toISOString() },
      { id: '1', direction: 'INBOUND', sentAt: new Date(base).toISOString() },
      { id: '2', direction: 'OUTBOUND', sentAt: new Date(base + 3600_000).toISOString() },
    ];

    const groups = groupMessagesByDay(messages);

    expect(groups).toHaveLength(2);
    expect(groups[0].messages.map((row) => row.id)).toEqual(['1', '2']);
    expect(groups[1].messages.map((row) => row.id)).toEqual(['3']);
  });

  it('adds up the badge', () => {
    expect(
      unreadTotal([{ unreadCount: 2 }, { unreadCount: null }, { unreadCount: 3 }]),
    ).toBe(5);
  });
});

describe('the 24 hour window', () => {
  const now = '2026-09-12T12:00:00.000Z';

  it('is open while they wrote within a day', () => {
    const window = serviceWindow({ lastInboundAt: '2026-09-12T06:00:00.000Z', now });

    expect(window.isOpen).toBe(true);
    expect(window.reason).toBe('');
    expect(describeWindow(window)).toBe('Free replies for 18h 0m');
  });

  it('is shut once a day has passed, and says so in words', () => {
    const window = serviceWindow({ lastInboundAt: '2026-09-11T06:00:00.000Z', now });

    expect(window.isOpen).toBe(false);
    expect(window.msLeft).toBe(0);
    expect(window.reason).toContain('approved template');
    expect(describeWindow(window)).toBe('Reply window closed');
  });

  it('shuts exactly on the boundary, not a minute after', () => {
    expect(serviceWindow({ lastInboundAt: '2026-09-11T12:00:00.000Z', now }).isOpen).toBe(
      false,
    );
    expect(serviceWindow({ lastInboundAt: '2026-09-11T12:01:00.000Z', now }).isOpen).toBe(
      true,
    );
  });

  it('treats a contact who never wrote as a first-contact template', () => {
    const window = serviceWindow({ lastInboundAt: null, now });

    expect(window.isOpen).toBe(false);
    expect(window.closesAt).toBeNull();
    expect(window.reason).toContain('have not written');
  });
});

describe('conversationAfterMessage', () => {
  const conversation = {
    status: 'OPEN' as const,
    lastMessageAt: '2026-09-12T10:00:00.000Z',
    lastInboundAt: '2026-09-12T09:00:00.000Z',
    lastMessagePreview: 'earlier message',
    unreadCount: 1,
  };

  it('counts an inbound message and moves both timestamps', () => {
    const next = conversationAfterMessage({
      conversation,
      message: {
        direction: 'INBOUND',
        body: 'Can you send the quotation again?',
        sentAt: '2026-09-12T11:00:00.000Z',
      },
    });

    expect(next.unreadCount).toBe(2);
    expect(next.lastMessageAt).toBe('2026-09-12T11:00:00.000Z');
    expect(next.lastInboundAt).toBe('2026-09-12T11:00:00.000Z');
    expect(next.lastMessagePreview).toBe('Can you send the quotation again?');
  });

  it('leaves the reply window and the badge alone when we are the ones talking', () => {
    const next = conversationAfterMessage({
      conversation,
      message: {
        direction: 'OUTBOUND',
        body: 'Sending it now',
        sentAt: '2026-09-12T11:00:00.000Z',
      },
    });

    expect(next.unreadCount).toBe(1);
    expect(next.lastInboundAt).toBe('2026-09-12T09:00:00.000Z');
    expect(next.lastMessageAt).toBe('2026-09-12T11:00:00.000Z');
  });

  it('does not let a late redelivered message rewrite the preview', () => {
    const next = conversationAfterMessage({
      conversation,
      message: {
        direction: 'INBOUND',
        body: 'this one arrived late',
        sentAt: '2026-09-12T08:00:00.000Z',
      },
    });

    expect(next.lastMessagePreview).toBe('earlier message');
    expect(next.lastMessageAt).toBe('2026-09-12T10:00:00.000Z');
    expect(next.lastInboundAt).toBe('2026-09-12T09:00:00.000Z');
    // Nobody read it either, so it is still unread.
    expect(next.unreadCount).toBe(2);
  });

  it('reopens a closed chat when they write again', () => {
    const next = conversationAfterMessage({
      conversation: { ...conversation, status: 'CLOSED' },
      message: {
        direction: 'INBOUND',
        body: 'One more thing',
        sentAt: '2026-09-12T11:00:00.000Z',
      },
    });

    expect(next.status).toBe('OPEN');
  });

  it('does not reopen a closed chat just because we sent something', () => {
    const next = conversationAfterMessage({
      conversation: { ...conversation, status: 'CLOSED' },
      message: {
        direction: 'OUTBOUND',
        body: 'Closing the loop',
        sentAt: '2026-09-12T11:00:00.000Z',
      },
    });

    expect(next.status).toBe('CLOSED');
  });

  it('starts a brand new conversation from nothing', () => {
    const next = conversationAfterMessage({
      conversation: {},
      message: {
        direction: 'INBOUND',
        body: 'Hi, saw your website',
        sentAt: '2026-09-12T11:00:00.000Z',
      },
    });

    expect(next.unreadCount).toBe(1);
    expect(next.status).toBe('OPEN');
    expect(next.lastMessageAt).toBe('2026-09-12T11:00:00.000Z');
    expect(next.lastInboundAt).toBe('2026-09-12T11:00:00.000Z');
  });
});

describe('sending', () => {
  it('refuses before the transport is even asked', () => {
    expect(outboundProblem({ handle: '+60123456789', body: 'hello' })).toBe('');
    expect(outboundProblem({ handle: '+60123456789', body: '   ' })).toContain(
      'nothing to send',
    );
    expect(outboundProblem({ handle: '', body: 'hello' })).toContain(
      'no usable phone number',
    );
  });

  it('does not claim a message was sent when nothing is connected', async () => {
    const result = await unconnectedTransport.send({
      channel: 'WHATSAPP',
      to: '+60123456789',
      body: 'hello',
      isWithinServiceWindow: true,
    });

    expect(unconnectedTransport.isConnected).toBe(false);
    expect(result.deliveryStatus).toBe('QUEUED');
    expect(result.externalId).toBeNull();
    expect(result.deliveryDetail).toContain('not delivered');
  });
});
