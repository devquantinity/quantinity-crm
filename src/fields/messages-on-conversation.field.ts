import { defineField, FieldType, RelationType } from 'twenty-sdk/define';

import {
  CONVERSATION_OBJECT_UNIVERSAL_IDENTIFIER,
  CHAT_MESSAGE_OBJECT_UNIVERSAL_IDENTIFIER,
  CONVERSATION_ON_CHAT_MESSAGE_FIELD_UNIVERSAL_IDENTIFIER,
  MESSAGES_ON_CONVERSATION_FIELD_UNIVERSAL_IDENTIFIER,
} from 'src/constants/messaging-identifiers';

export default defineField({
  universalIdentifier: MESSAGES_ON_CONVERSATION_FIELD_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier: CONVERSATION_OBJECT_UNIVERSAL_IDENTIFIER,
  type: FieldType.RELATION,
  name: 'messages',
  label: 'Messages',
  icon: 'IconMessage',
  relationTargetObjectMetadataUniversalIdentifier:
    CHAT_MESSAGE_OBJECT_UNIVERSAL_IDENTIFIER,
  relationTargetFieldMetadataUniversalIdentifier:
    CONVERSATION_ON_CHAT_MESSAGE_FIELD_UNIVERSAL_IDENTIFIER,
  universalSettings: { relationType: RelationType.ONE_TO_MANY },
});
