import {
  defineField,
  FieldType,
  RelationType,
  OnDeleteAction,
} from 'twenty-sdk/define';

import {
  CONVERSATION_OBJECT_UNIVERSAL_IDENTIFIER,
  CHAT_MESSAGE_OBJECT_UNIVERSAL_IDENTIFIER,
  CONVERSATION_ON_CHAT_MESSAGE_FIELD_UNIVERSAL_IDENTIFIER,
  MESSAGES_ON_CONVERSATION_FIELD_UNIVERSAL_IDENTIFIER,
} from 'src/constants/messaging-identifiers';

// CASCADE, unlike every other relation in this app. A message without its
// conversation is not a record of anything - there is no number to reply to and
// no thread to read it in. Deleting the chat deletes the chat.
export default defineField({
  universalIdentifier: CONVERSATION_ON_CHAT_MESSAGE_FIELD_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier: CHAT_MESSAGE_OBJECT_UNIVERSAL_IDENTIFIER,
  type: FieldType.RELATION,
  name: 'conversation',
  label: 'Conversation',
  icon: 'IconMessageCircle',
  relationTargetObjectMetadataUniversalIdentifier:
    CONVERSATION_OBJECT_UNIVERSAL_IDENTIFIER,
  relationTargetFieldMetadataUniversalIdentifier:
    MESSAGES_ON_CONVERSATION_FIELD_UNIVERSAL_IDENTIFIER,
  universalSettings: {
    relationType: RelationType.MANY_TO_ONE,
    onDelete: OnDeleteAction.CASCADE,
    joinColumnName: 'conversationId',
  },
});
