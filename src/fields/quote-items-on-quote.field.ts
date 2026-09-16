import { defineField, FieldType, RelationType } from 'twenty-sdk/define';

import {
  QUOTE_OBJECT_UNIVERSAL_IDENTIFIER,
  QUOTE_ITEM_OBJECT_UNIVERSAL_IDENTIFIER,
  QUOTE_ITEMS_ON_QUOTE_FIELD_UNIVERSAL_IDENTIFIER,
  QUOTE_ON_QUOTE_ITEM_FIELD_UNIVERSAL_IDENTIFIER,
} from 'src/constants/quote-identifiers';

// Quote -> many QuoteItems
export default defineField({
  universalIdentifier: QUOTE_ITEMS_ON_QUOTE_FIELD_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier: QUOTE_OBJECT_UNIVERSAL_IDENTIFIER,
  type: FieldType.RELATION,
  name: 'quoteItems',
  label: 'Line items',
  icon: 'IconListDetails',
  relationTargetObjectMetadataUniversalIdentifier:
    QUOTE_ITEM_OBJECT_UNIVERSAL_IDENTIFIER,
  relationTargetFieldMetadataUniversalIdentifier:
    QUOTE_ON_QUOTE_ITEM_FIELD_UNIVERSAL_IDENTIFIER,
  universalSettings: {
    relationType: RelationType.ONE_TO_MANY,
  },
});
