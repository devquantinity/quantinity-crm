import {
  defineField,
  FieldType,
  RelationType,
  OnDeleteAction,
} from 'twenty-sdk/define';

import {
  PRODUCT_OBJECT_UNIVERSAL_IDENTIFIER,
  QUOTE_ITEMS_ON_PRODUCT_FIELD_UNIVERSAL_IDENTIFIER,
  PRODUCT_ON_QUOTE_ITEM_FIELD_UNIVERSAL_IDENTIFIER,
} from 'src/constants/catalogue-identifiers';
import { QUOTE_ITEM_OBJECT_UNIVERSAL_IDENTIFIER } from 'src/constants/quote-identifiers';

// SET_NULL, and the link is provenance only. Everything the client reads -
// description, unit, price, taxable - was copied onto the line when it was
// added, so retiring or deleting a product cannot change a quotation that
// already went out, and a line outlives the product it came from.
export default defineField({
  universalIdentifier: PRODUCT_ON_QUOTE_ITEM_FIELD_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier: QUOTE_ITEM_OBJECT_UNIVERSAL_IDENTIFIER,
  type: FieldType.RELATION,
  name: 'product',
  label: 'From product',
  icon: 'IconPackage',
  relationTargetObjectMetadataUniversalIdentifier:
    PRODUCT_OBJECT_UNIVERSAL_IDENTIFIER,
  relationTargetFieldMetadataUniversalIdentifier:
    QUOTE_ITEMS_ON_PRODUCT_FIELD_UNIVERSAL_IDENTIFIER,
  universalSettings: {
    relationType: RelationType.MANY_TO_ONE,
    onDelete: OnDeleteAction.SET_NULL,
    joinColumnName: 'productId',
  },
});
