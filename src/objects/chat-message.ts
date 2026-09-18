import { defineObject, FieldType } from 'twenty-sdk/define';

import {
  CHAT_MESSAGE_OBJECT_UNIVERSAL_IDENTIFIER,
  CHAT_MESSAGE_DIRECTION_FIELD_UNIVERSAL_IDENTIFIER,
  CHAT_MESSAGE_BODY_FIELD_UNIVERSAL_IDENTIFIER,
  CHAT_MESSAGE_SENT_AT_FIELD_UNIVERSAL_IDENTIFIER,
  CHAT_MESSAGE_DELIVERY_STATUS_FIELD_UNIVERSAL_IDENTIFIER,
  CHAT_MESSAGE_DELIVERY_DETAIL_FIELD_UNIVERSAL_IDENTIFIER,
  CHAT_MESSAGE_EXTERNAL_ID_FIELD_UNIVERSAL_IDENTIFIER,
} from 'src/constants/messaging-identifiers';

/**
 * One message, in or out.
 *
 * Called chatMessage, not message, because Twenty 2.40 already ships a standard
 * `message` object - the one its Gmail/IMAP sync writes into, with subjects,
 * headerMessageId and participants. Taking that name would have collided with
 * it, and building ON it would have been worse: that model is owned by the sync
 * machinery, has no delivery status and no unread count, and the email roadmap
 * item would later be fighting WhatsApp for the same table.
 *
 * Messages are append-only. The only field that moves after a message is
 * written is deliveryStatus, and only forwards, as the provider reports back.
 *
 * externalId is the provider's own id and it is what makes an inbound webhook
 * safe to receive twice - WhatsApp retries, and without a dedupe key the same
 * message lands in the thread three times. Nothing uses it yet because no
 * transport is connected, which is exactly why it has to exist before one is.
 *
 * deliveryDetail carries the sentence a person needs when the status is not
 * DELIVERED: which window closed, which number was rejected, or - today - that
 * there is no transport connected at all. A bare FAILED with no reason is the
 * kind of thing you end up debugging by reading logs.
 */
export default defineObject({
  universalIdentifier: CHAT_MESSAGE_OBJECT_UNIVERSAL_IDENTIFIER,
  nameSingular: 'chatMessage',
  namePlural: 'chatMessages',
  labelSingular: 'Message',
  labelPlural: 'Messages',
  description: 'One message in a conversation',
  icon: 'IconMessage',
  fields: [
    {
      universalIdentifier: CHAT_MESSAGE_DIRECTION_FIELD_UNIVERSAL_IDENTIFIER,
      name: 'direction',
      type: FieldType.SELECT,
      label: 'Direction',
      icon: 'IconArrowsExchange',
      defaultValue: "'OUTBOUND'",
      options: [
        { value: 'INBOUND', label: 'From them', position: 0, color: 'blue' },
        { value: 'OUTBOUND', label: 'From us', position: 1, color: 'green' },
      ],
    },
    {
      universalIdentifier: CHAT_MESSAGE_BODY_FIELD_UNIVERSAL_IDENTIFIER,
      name: 'body',
      type: FieldType.TEXT,
      label: 'Message',
      icon: 'IconAbc',
    },
    {
      universalIdentifier: CHAT_MESSAGE_SENT_AT_FIELD_UNIVERSAL_IDENTIFIER,
      name: 'sentAt',
      type: FieldType.DATE_TIME,
      label: 'Sent at',
      description: 'When it left, or arrived. Orders the thread.',
      icon: 'IconClock',
    },
    {
      universalIdentifier: CHAT_MESSAGE_DELIVERY_STATUS_FIELD_UNIVERSAL_IDENTIFIER,
      name: 'deliveryStatus',
      type: FieldType.SELECT,
      label: 'Delivery',
      icon: 'IconChecks',
      defaultValue: "'QUEUED'",
      options: [
        { value: 'QUEUED', label: 'Queued', position: 0, color: 'gray' },
        { value: 'SENT', label: 'Sent', position: 1, color: 'blue' },
        { value: 'DELIVERED', label: 'Delivered', position: 2, color: 'turquoise' },
        { value: 'READ', label: 'Read', position: 3, color: 'green' },
        { value: 'FAILED', label: 'Failed', position: 4, color: 'red' },
        { value: 'RECEIVED', label: 'Received', position: 5, color: 'blue' },
      ],
    },
    {
      universalIdentifier: CHAT_MESSAGE_DELIVERY_DETAIL_FIELD_UNIVERSAL_IDENTIFIER,
      name: 'deliveryDetail',
      type: FieldType.TEXT,
      label: 'Delivery note',
      description: 'Why it is queued or failed, in words',
      icon: 'IconInfoCircle',
    },
    {
      universalIdentifier: CHAT_MESSAGE_EXTERNAL_ID_FIELD_UNIVERSAL_IDENTIFIER,
      name: 'externalId',
      type: FieldType.TEXT,
      label: 'Provider ID',
      description: 'The transport own id - what makes a repeated webhook safe',
      icon: 'IconHash',
    },
  ],
});
