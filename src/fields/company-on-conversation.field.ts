import {
  defineField,
  FieldType,
  RelationType,
  OnDeleteAction,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

import {
  CONVERSATION_OBJECT_UNIVERSAL_IDENTIFIER,
  COMPANY_ON_CONVERSATION_FIELD_UNIVERSAL_IDENTIFIER,
  CONVERSATIONS_ON_COMPANY_FIELD_UNIVERSAL_IDENTIFIER,
} from 'src/constants/messaging-identifiers';

// The company is on the conversation directly, not read through the contact,
// because Twenty silently returns null past one relation hop - conversation ->
// person -> company would come back empty and the inbox would just quietly stop
// showing who anyone works for. Cheaper to store the link than to debug that.
export default defineField({
  universalIdentifier: COMPANY_ON_CONVERSATION_FIELD_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier: CONVERSATION_OBJECT_UNIVERSAL_IDENTIFIER,
  type: FieldType.RELATION,
  name: 'company',
  label: 'Company',
  icon: 'IconBuildingSkyscraper',
  relationTargetObjectMetadataUniversalIdentifier:
    STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.company.universalIdentifier,
  relationTargetFieldMetadataUniversalIdentifier:
    CONVERSATIONS_ON_COMPANY_FIELD_UNIVERSAL_IDENTIFIER,
  universalSettings: {
    relationType: RelationType.MANY_TO_ONE,
    onDelete: OnDeleteAction.SET_NULL,
    joinColumnName: 'companyId',
  },
});
