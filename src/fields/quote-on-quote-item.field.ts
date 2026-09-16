import {
  defineField,
  FieldType,
  RelationType,
  OnDeleteAction,
} from 'twenty-sdk/define';

import {
  QUOTE_OBJECT_UNIVERSAL_IDENTIFIER,
  QUOTE_ITEM_OBJECT_UNIVERSAL_IDENTIFIER,
  QUOTE_ITEMS_ON_QUOTE_FIELD_UNIVERSAL_IDENTIFIER,
  QUOTE_ON_QUOTE_ITEM_FIELD_UNIVERSAL_IDENTIFIER,
} from 'src/constants/quote-identifiers';

// QuoteItem -> one Quote. Deleting the quote takes its lines with it.
export default defineField({
  universalIdentifier: QUOTE_ON_QUOTE_ITEM_FIELD_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier: QUOTE_ITEM_OBJECT_UNIVERSAL_IDENTIFIER,
  type: FieldType.RELATION,
  name: 'quote',
  label: 'Quote',
  icon: 'IconFileDollar',
  relationTargetObjectMetadataUniversalIdentifier:
    QUOTE_OBJECT_UNIVERSAL_IDENTIFIER,
  relationTargetFieldMetadataUniversalIdentifier:
    QUOTE_ITEMS_ON_QUOTE_FIELD_UNIVERSAL_IDENTIFIER,
  universalSettings: {
    relationType: RelationType.MANY_TO_ONE,
    onDelete: OnDeleteAction.CASCADE,
    joinColumnName: 'quoteId',
  },
});
