import {
  defineField,
  FieldType,
  RelationType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

import {
  QUOTE_OBJECT_UNIVERSAL_IDENTIFIER,
  QUOTES_ON_OPPORTUNITY_FIELD_UNIVERSAL_IDENTIFIER,
  OPPORTUNITY_ON_QUOTE_FIELD_UNIVERSAL_IDENTIFIER,
} from 'src/constants/quote-identifiers';

// Opportunity -> many Quotes. This is what puts a Quotes section on the deal page.
export default defineField({
  universalIdentifier: QUOTES_ON_OPPORTUNITY_FIELD_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier:
    STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.opportunity.universalIdentifier,
  type: FieldType.RELATION,
  name: 'quotes',
  label: 'Quotes',
  icon: 'IconFileDollar',
  relationTargetObjectMetadataUniversalIdentifier:
    QUOTE_OBJECT_UNIVERSAL_IDENTIFIER,
  relationTargetFieldMetadataUniversalIdentifier:
    OPPORTUNITY_ON_QUOTE_FIELD_UNIVERSAL_IDENTIFIER,
  universalSettings: {
    relationType: RelationType.ONE_TO_MANY,
  },
});
