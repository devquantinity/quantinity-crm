import {
  defineField,
  FieldType,
  RelationType,
  OnDeleteAction,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

import {
  QUOTE_OBJECT_UNIVERSAL_IDENTIFIER,
  QUOTES_ON_OPPORTUNITY_FIELD_UNIVERSAL_IDENTIFIER,
  OPPORTUNITY_ON_QUOTE_FIELD_UNIVERSAL_IDENTIFIER,
} from 'src/constants/quote-identifiers';

// Quote -> one Opportunity. SET_NULL, not CASCADE: an issued quote is a record
// of what was sent and must survive the deal being deleted.
export default defineField({
  universalIdentifier: OPPORTUNITY_ON_QUOTE_FIELD_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier: QUOTE_OBJECT_UNIVERSAL_IDENTIFIER,
  type: FieldType.RELATION,
  name: 'opportunity',
  label: 'Opportunity',
  icon: 'IconTargetArrow',
  relationTargetObjectMetadataUniversalIdentifier:
    STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.opportunity.universalIdentifier,
  relationTargetFieldMetadataUniversalIdentifier:
    QUOTES_ON_OPPORTUNITY_FIELD_UNIVERSAL_IDENTIFIER,
  universalSettings: {
    relationType: RelationType.MANY_TO_ONE,
    onDelete: OnDeleteAction.SET_NULL,
    joinColumnName: 'opportunityId',
  },
});
