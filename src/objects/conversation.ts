import { defineObject, FieldType } from 'twenty-sdk/define';

import {
  CONVERSATION_OBJECT_UNIVERSAL_IDENTIFIER,
  CONVERSATION_CHANNEL_FIELD_UNIVERSAL_IDENTIFIER,
  CONVERSATION_HANDLE_FIELD_UNIVERSAL_IDENTIFIER,
  CONVERSATION_STATUS_FIELD_UNIVERSAL_IDENTIFIER,
  CONVERSATION_LAST_MESSAGE_AT_FIELD_UNIVERSAL_IDENTIFIER,
  CONVERSATION_LAST_INBOUND_AT_FIELD_UNIVERSAL_IDENTIFIER,
  CONVERSATION_LAST_MESSAGE_PREVIEW_FIELD_UNIVERSAL_IDENTIFIER,
  CONVERSATION_UNREAD_COUNT_FIELD_UNIVERSAL_IDENTIFIER,
} from 'src/constants/messaging-identifiers';

/**
 * One running chat with one contact on one channel.
 *
 * The identity of a conversation is (channel, handle) - a phone number on
 * WhatsApp - NOT the Person it is linked to. A number can arrive before anyone
 * has made a contact record for it, and the same human can message from two
 * numbers. So the handle threads the messages and the Person link is an
 * attachment made afterwards, which is also why it is nullable.
 *
 * lastMessageAt, lastInboundAt, lastMessagePreview and unreadCount are all
 * denormalised copies of facts that live on Message. That is deliberate:
 * Twenty refuses a one-to-many nested inside another one-to-many ("Query
 * complexity is too high"), so an inbox list CANNOT fetch each conversation's
 * last message in the same query. Without these four fields the list would be
 * one extra round trip per row. They are written by whatever records a message
 * and read by nothing else.
 *
 * lastInboundAt earns its place separately: WhatsApp's customer service window
 * runs 24 hours from the client's last message, and it decides whether a reply
 * goes out free-form or has to be a paid template. It is the one timestamp the
 * composer has to know.
 */
export default defineObject({
  universalIdentifier: CONVERSATION_OBJECT_UNIVERSAL_IDENTIFIER,
  nameSingular: 'conversation',
  namePlural: 'conversations',
  labelSingular: 'Conversation',
  labelPlural: 'Conversations',
  description: 'A running chat with one contact on one channel',
  icon: 'IconMessageCircle',
  fields: [
    {
      universalIdentifier: CONVERSATION_CHANNEL_FIELD_UNIVERSAL_IDENTIFIER,
      name: 'channel',
      type: FieldType.SELECT,
      label: 'Channel',
      description: 'Where the conversation happens',
      icon: 'IconBrandWhatsapp',
      defaultValue: "'WHATSAPP'",
      options: [
        { value: 'WHATSAPP', label: 'WhatsApp', position: 0, color: 'green' },
        { value: 'SMS', label: 'SMS', position: 1, color: 'blue' },
        { value: 'EMAIL', label: 'Email', position: 2, color: 'purple' },
      ],
    },
    {
      universalIdentifier: CONVERSATION_HANDLE_FIELD_UNIVERSAL_IDENTIFIER,
      name: 'handle',
      type: FieldType.TEXT,
      label: 'Handle',
      description: 'Phone number in +60... form. This is what threads the messages.',
      icon: 'IconPhone',
    },
    {
      universalIdentifier: CONVERSATION_STATUS_FIELD_UNIVERSAL_IDENTIFIER,
      name: 'status',
      type: FieldType.SELECT,
      label: 'Status',
      description: 'Open means it still wants an answer',
      icon: 'IconProgressCheck',
      defaultValue: "'OPEN'",
      options: [
        { value: 'OPEN', label: 'Open', position: 0, color: 'green' },
        { value: 'SNOOZED', label: 'Snoozed', position: 1, color: 'orange' },
        { value: 'CLOSED', label: 'Closed', position: 2, color: 'gray' },
      ],
    },
    {
      universalIdentifier: CONVERSATION_LAST_MESSAGE_AT_FIELD_UNIVERSAL_IDENTIFIER,
      name: 'lastMessageAt',
      type: FieldType.DATE_TIME,
      label: 'Last message at',
      description: 'Either direction. Orders the inbox.',
      icon: 'IconClock',
    },
    {
      universalIdentifier: CONVERSATION_LAST_INBOUND_AT_FIELD_UNIVERSAL_IDENTIFIER,
      name: 'lastInboundAt',
      type: FieldType.DATE_TIME,
      label: 'Last reply from them',
      description: 'Starts the 24h window in which a WhatsApp reply is free-form',
      icon: 'IconArrowDown',
    },
    {
      universalIdentifier: CONVERSATION_LAST_MESSAGE_PREVIEW_FIELD_UNIVERSAL_IDENTIFIER,
      name: 'lastMessagePreview',
      type: FieldType.TEXT,
      label: 'Preview',
      description: 'First line of the last message, for the list',
      icon: 'IconAbc',
    },
    {
      universalIdentifier: CONVERSATION_UNREAD_COUNT_FIELD_UNIVERSAL_IDENTIFIER,
      name: 'unreadCount',
      type: FieldType.NUMBER,
      label: 'Unread',
      icon: 'IconCircleDot',
      defaultValue: 0,
    },
  ],
});
