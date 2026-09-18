import {
  defineField,
  FieldType,
  RelationType,
  OnDeleteAction,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

import {
  CONVERSATION_OBJECT_UNIVERSAL_IDENTIFIER,
  PERSON_ON_CONVERSATION_FIELD_UNIVERSAL_IDENTIFIER,
  CONVERSATIONS_ON_PERSON_FIELD_UNIVERSAL_IDENTIFIER,
} from 'src/constants/messaging-identifiers';

// Nullable on purpose. A number can message before anyone has made a contact
// for it, and the inbox must still show that message rather than drop it.
// SET_NULL: deleting a contact must not delete what they said.
export default defineField({
  universalIdentifier: PERSON_ON_CONVERSATION_FIELD_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier: CONVERSATION_OBJECT_UNIVERSAL_IDENTIFIER,
  type: FieldType.RELATION,
  name: 'person',
  label: 'Contact',
  icon: 'IconUser',
  relationTargetObjectMetadataUniversalIdentifier:
    STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  relationTargetFieldMetadataUniversalIdentifier:
    CONVERSATIONS_ON_PERSON_FIELD_UNIVERSAL_IDENTIFIER,
  universalSettings: {
    relationType: RelationType.MANY_TO_ONE,
    onDelete: OnDeleteAction.SET_NULL,
    joinColumnName: 'personId',
  },
});
