import { defineObject, FieldType } from 'twenty-sdk/define';

import {
  PRODUCT_OBJECT_UNIVERSAL_IDENTIFIER,
  PRODUCT_CODE_FIELD_UNIVERSAL_IDENTIFIER,
  PRODUCT_DESCRIPTION_FIELD_UNIVERSAL_IDENTIFIER,
  PRODUCT_UNIT_FIELD_UNIVERSAL_IDENTIFIER,
  PRODUCT_UNIT_PRICE_FIELD_UNIVERSAL_IDENTIFIER,
  PRODUCT_IS_TAXABLE_FIELD_UNIVERSAL_IDENTIFIER,
  PRODUCT_CATEGORY_FIELD_UNIVERSAL_IDENTIFIER,
  PRODUCT_IS_ACTIVE_FIELD_UNIVERSAL_IDENTIFIER,
} from 'src/constants/catalogue-identifiers';

/**
 * Something you sell, with a price you do not want to retype.
 *
 * This is a starting point for a quotation line, not the line itself. Adding a
 * product to a quote COPIES its description, unit, price and taxable flag onto
 * the line; nothing here is read again afterwards. Repricing the catalogue in
 * March must not rewrite a draft from February, and must never touch a
 * quotation already sent.
 *
 * One price, deliberately. Per-client pricing is a second object and a
 * maintenance habit, and a stale client price is worse than none - it quotes
 * the wrong number and looks deliberate. Because prices are copied onto lines
 * either way, adding it later costs nothing that is built now.
 */
export default defineObject({
  universalIdentifier: PRODUCT_OBJECT_UNIVERSAL_IDENTIFIER,
  nameSingular: 'product',
  namePlural: 'products',
  labelSingular: 'Product',
  labelPlural: 'Products',
  description: 'Something you sell, with a price and a default line description',
  icon: 'IconPackage',
  fields: [
    {
      universalIdentifier: PRODUCT_CODE_FIELD_UNIVERSAL_IDENTIFIER,
      name: 'code',
      type: FieldType.TEXT,
      label: 'Code',
      description: 'Your own reference, if you use one',
      icon: 'IconHash',
    },
    {
      universalIdentifier: PRODUCT_DESCRIPTION_FIELD_UNIVERSAL_IDENTIFIER,
      name: 'description',
      type: FieldType.TEXT,
      label: 'Description',
      description: 'What the client reads on the quotation - copied onto the line',
      icon: 'IconAbc',
    },
    {
      universalIdentifier: PRODUCT_UNIT_FIELD_UNIVERSAL_IDENTIFIER,
      name: 'unit',
      type: FieldType.TEXT,
      label: 'Unit',
      description: 'project, session, month, unit',
      icon: 'IconRuler',
    },
    {
      universalIdentifier: PRODUCT_UNIT_PRICE_FIELD_UNIVERSAL_IDENTIFIER,
      name: 'unitPrice',
      type: FieldType.CURRENCY,
      label: 'Unit price',
      icon: 'IconCurrencyDollar',
    },
    {
      universalIdentifier: PRODUCT_IS_TAXABLE_FIELD_UNIVERSAL_IDENTIFIER,
      name: 'isTaxable',
      type: FieldType.BOOLEAN,
      label: 'Taxable',
      icon: 'IconReceiptTax',
      defaultValue: true,
    },
    {
      universalIdentifier: PRODUCT_CATEGORY_FIELD_UNIVERSAL_IDENTIFIER,
      name: 'category',
      type: FieldType.TEXT,
      label: 'Category',
      description: 'Groups the picker - Design, Development, Hosting',
      icon: 'IconCategory',
    },
    {
      universalIdentifier: PRODUCT_IS_ACTIVE_FIELD_UNIVERSAL_IDENTIFIER,
      name: 'isActive',
      type: FieldType.BOOLEAN,
      label: 'Active',
      description: 'Untick to retire it without deleting the quotations that used it',
      icon: 'IconEye',
      defaultValue: true,
    },
  ],
});
