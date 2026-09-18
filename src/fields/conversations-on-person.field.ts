import {
  defineField,
  FieldType,
  RelationType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

import {
  CONVERSATION_OBJECT_UNIVERSAL_IDENTIFIER,
  PERSON_ON_CONVERSATION_FIELD_UNIVERSAL_IDENTIFIER,
  CONVERSATIONS_ON_PERSON_FIELD_UNIVERSAL_IDENTIFIER,
} from 'src/constants/messaging-identifiers';

export default defineField({
  universalIdentifier: CONVERSATIONS_ON_PERSON_FIELD_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier:
    STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  type: FieldType.RELATION,
  name: 'conversations',
  label: 'Conversations',
  icon: 'IconMessageCircle',
  relationTargetObjectMetadataUniversalIdentifier:
    CONVERSATION_OBJECT_UNIVERSAL_IDENTIFIER,
  relationTargetFieldMetadataUniversalIdentifier:
    PERSON_ON_CONVERSATION_FIELD_UNIVERSAL_IDENTIFIER,
  universalSettings: { relationType: RelationType.ONE_TO_MANY },
});
