import { describe, expect, it } from 'vitest';

import {
  cloudApiError,
  handleFromWaId,
  inboundConversationName,
  isForPhoneNumber,
  parseInboundMessages,
  parseStatusUpdates,
  shouldAdvanceStatus,
  textMessagePayload,
  waIdOf,
} from 'src/lib/whatsapp-cloud';

const PHONE_NUMBER_ID = '123456789012345';

const webhook = (value: Record<string, unknown>) => ({
  object: 'whatsapp_business_account',
  entry: [
    {
      id: 'WABA_ID',
      changes: [
        {
          field: 'messages',
          value: {
            messaging_product: 'whatsapp',
            metadata: {
              display_phone_number: '60123456789',
              phone_number_id: PHONE_NUMBER_ID,
            },
            ...value,
          },
        },
      ],
    },
  ],
});

const textMessage = webhook({
  contacts: [{ profile: { name: 'Nurul Huda' }, wa_id: '60123456789' }],
  messages: [
    {
      from: '60123456789',
      id: 'wamid.ABC123',
      timestamp: '1789700000',
      type: 'text',
      text: { body: 'Can you send the quotation again?' },
    },
  ],
});

describe('the two number formats', () => {
  it('strips the plus on the way out to Meta', () => {
    expect(waIdOf('+60123456789')).toBe('60123456789');
    expect(waIdOf('012-345 6789')).toBe('60123456789');
  });

  it('adds it back on the way in', () => {
    expect(handleFromWaId('60123456789')).toBe('+60123456789');
  });

  it('round-trips without drifting', () => {
    expect(handleFromWaId(waIdOf('012-345 6789'))).toBe('+60123456789');
    expect(waIdOf(handleFromWaId('60123456789'))).toBe('60123456789');
  });

  it('does not mistake a wa_id for a local number', () => {
    // 60... is already international. The local-number rule would turn a
    // leading 0 into a country code; a wa_id must never go through it.
    expect(handleFromWaId('60123456789')).toBe('+60123456789');
    expect(handleFromWaId('14155550123')).toBe('+14155550123');
  });

  it('refuses something that cannot be a number', () => {
    expect(handleFromWaId('')).toBe('');
    expect(handleFromWaId('123')).toBe('');
    expect(waIdOf('not a phone')).toBe('');
  });
});

describe('is this webhook ours', () => {
  it('accepts our own number and rejects everyone else', () => {
    expect(isForPhoneNumber(textMessage, PHONE_NUMBER_ID)).toBe(true);
    expect(isForPhoneNumber(textMessage, '999999999999999')).toBe(false);
  });

  it('refuses when nothing is configured, rather than accepting everything', () => {
    expect(isForPhoneNumber(textMessage, '')).toBe(false);
  });

  it('survives a payload shape it has never seen', () => {
    expect(isForPhoneNumber({}, PHONE_NUMBER_ID)).toBe(false);
    expect(isForPhoneNumber({ entry: [{}] }, PHONE_NUMBER_ID)).toBe(false);
  });
});

describe('reading inbound messages', () => {
  it('pulls out the text, the number and the profile name', () => {
    const [message] = parseInboundMessages(textMessage);

    expect(message.externalId).toBe('wamid.ABC123');
    expect(message.handle).toBe('+60123456789');
    expect(message.profileName).toBe('Nurul Huda');
    expect(message.body).toBe('Can you send the quotation again?');
    expect(message.isText).toBe(true);
    expect(message.sentAt).toBe(new Date(1789700000 * 1000).toISOString());
  });

  it('describes a photo rather than dropping it', () => {
    const [message] = parseInboundMessages(
      webhook({
        messages: [
          { from: '60123456789', id: 'wamid.IMG', timestamp: '1789700000', type: 'image', image: { id: 'm1' } },
        ],
      }),
    );

    expect(message.body).toBe('[photo]');
    expect(message.isText).toBe(false);
  });

  it('prefers the caption the client actually wrote', () => {
    const [message] = parseInboundMessages(
      webhook({
        messages: [
          {
            from: '60123456789',
            id: 'wamid.IMG2',
            timestamp: '1789700000',
            type: 'image',
            image: { id: 'm1', caption: 'signed copy' },
          },
        ],
      }),
    );

    expect(message.body).toBe('signed copy');
  });

  it('names a document so it is findable later', () => {
    const [message] = parseInboundMessages(
      webhook({
        messages: [
          {
            from: '60123456789',
            id: 'wamid.DOC',
            timestamp: '1789700000',
            type: 'document',
            document: { id: 'd1', filename: 'PO-2291.pdf' },
          },
        ],
      }),
    );

    expect(message.body).toBe('[document: PO-2291.pdf]');
  });

  it('skips a message with no id, because it could not be deduped on a retry', () => {
    expect(
      parseInboundMessages(
        webhook({
          messages: [{ from: '60123456789', timestamp: '1789700000', type: 'text', text: { body: 'hi' } }],
        }),
      ),
    ).toHaveLength(0);
  });

  it('returns nothing for a status-only webhook', () => {
    expect(
      parseInboundMessages(webhook({ statuses: [{ id: 'wamid.X', status: 'delivered' }] })),
    ).toHaveLength(0);
  });

  it('falls back to the number when WhatsApp has no profile name', () => {
    const [message] = parseInboundMessages(
      webhook({
        messages: [
          { from: '60999888777', id: 'wamid.NEW', timestamp: '1789700000', type: 'text', text: { body: 'hello' } },
        ],
      }),
    );

    expect(inboundConversationName(message)).toBe('+60999888777');
  });
});

describe('reading delivery statuses', () => {
  it('maps Meta words onto ours', () => {
    const updates = parseStatusUpdates(
      webhook({
        statuses: [
          { id: 'wamid.A', status: 'sent' },
          { id: 'wamid.B', status: 'delivered' },
          { id: 'wamid.C', status: 'read' },
        ],
      }),
    );

    expect(updates.map((u) => u.deliveryStatus)).toEqual(['SENT', 'DELIVERED', 'READ']);
  });

  it('keeps the reason a message failed', () => {
    const [update] = parseStatusUpdates(
      webhook({
        statuses: [
          {
            id: 'wamid.D',
            status: 'failed',
            errors: [
              {
                code: 131047,
                title: 'Re-engagement message',
                message: 'More than 24 hours have passed since the customer last replied',
              },
            ],
          },
        ],
      }),
    );

    expect(update.deliveryStatus).toBe('FAILED');
    expect(update.deliveryDetail).toContain('24 hours');
  });

  it('ignores a status word it does not know instead of guessing', () => {
    expect(
      parseStatusUpdates(webhook({ statuses: [{ id: 'wamid.E', status: 'warp-speed' }] })),
    ).toHaveLength(0);
  });
});

describe('talking back', () => {
  it('builds the payload Meta expects', () => {
    expect(textMessagePayload({ waId: '60123456789', body: 'On its way' })).toEqual({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: '60123456789',
      type: 'text',
      text: { preview_url: false, body: 'On its way' },
    });
  });

  it('keeps the sentence Meta wrote rather than the status code', () => {
    expect(
      cloudApiError(400, {
        error: {
          message: 'Message failed to send',
          error_data: { details: 'more than 24 hours have passed' },
        },
      }),
    ).toBe('Message failed to send - more than 24 hours have passed');
  });

  it('does not repeat itself when Meta says the same thing twice', () => {
    expect(
      cloudApiError(400, {
        error: { message: 'Invalid parameter', error_data: { details: 'Invalid parameter' } },
      }),
    ).toBe('Invalid parameter');
  });

  it('still says something when Meta says nothing', () => {
    expect(cloudApiError(500, {})).toContain('500');
  });
});

describe('status only moves forwards', () => {
  it('advances through the normal run', () => {
    expect(shouldAdvanceStatus('QUEUED', 'SENT')).toBe(true);
    expect(shouldAdvanceStatus('SENT', 'DELIVERED')).toBe(true);
    expect(shouldAdvanceStatus('DELIVERED', 'READ')).toBe(true);
  });

  it('refuses to walk a read message back to one grey tick', () => {
    // Meta delivers these out of order and redelivers old ones. Going
    // backwards here looks exactly like a bug to whoever is watching.
    expect(shouldAdvanceStatus('READ', 'DELIVERED')).toBe(false);
    expect(shouldAdvanceStatus('DELIVERED', 'SENT')).toBe(false);
    expect(shouldAdvanceStatus('READ', 'READ')).toBe(false);
  });

  it('treats failure as the end of the story', () => {
    expect(shouldAdvanceStatus('FAILED', 'DELIVERED')).toBe(false);
    expect(shouldAdvanceStatus('FAILED', 'READ')).toBe(false);
    expect(shouldAdvanceStatus('SENT', 'FAILED')).toBe(true);
  });

  it('copes with a message that has no status yet', () => {
    expect(shouldAdvanceStatus(null, 'SENT')).toBe(true);
    expect(shouldAdvanceStatus(undefined, 'DELIVERED')).toBe(true);
  });
});
