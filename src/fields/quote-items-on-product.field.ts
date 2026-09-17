import { defineField, FieldType, RelationType } from 'twenty-sdk/define';

import {
  PRODUCT_OBJECT_UNIVERSAL_IDENTIFIER,
  QUOTE_ITEMS_ON_PRODUCT_FIELD_UNIVERSAL_IDENTIFIER,
  PRODUCT_ON_QUOTE_ITEM_FIELD_UNIVERSAL_IDENTIFIER,
} from 'src/constants/catalogue-identifiers';
import { QUOTE_ITEM_OBJECT_UNIVERSAL_IDENTIFIER } from 'src/constants/quote-identifiers';

// Product -> the lines that came from it. Useful later for the only question
// this link is really for: what do we actually sell.
export default defineField({
  universalIdentifier: QUOTE_ITEMS_ON_PRODUCT_FIELD_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier: PRODUCT_OBJECT_UNIVERSAL_IDENTIFIER,
  type: FieldType.RELATION,
  name: 'quoteItems',
  label: 'Quoted on',
  icon: 'IconListDetails',
  relationTargetObjectMetadataUniversalIdentifier:
    QUOTE_ITEM_OBJECT_UNIVERSAL_IDENTIFIER,
  relationTargetFieldMetadataUniversalIdentifier:
    PRODUCT_ON_QUOTE_ITEM_FIELD_UNIVERSAL_IDENTIFIER,
  universalSettings: { relationType: RelationType.ONE_TO_MANY },
});
