import { defineObject, FieldType } from 'twenty-sdk/define';

import {
  QUOTE_ITEM_OBJECT_UNIVERSAL_IDENTIFIER,
  QUOTE_ITEM_DESCRIPTION_FIELD_UNIVERSAL_IDENTIFIER,
  QUOTE_ITEM_QUANTITY_FIELD_UNIVERSAL_IDENTIFIER,
  QUOTE_ITEM_UNIT_FIELD_UNIVERSAL_IDENTIFIER,
  QUOTE_ITEM_UNIT_PRICE_FIELD_UNIVERSAL_IDENTIFIER,
  QUOTE_ITEM_IS_TAXABLE_FIELD_UNIVERSAL_IDENTIFIER,
  QUOTE_ITEM_POSITION_FIELD_UNIVERSAL_IDENTIFIER,
} from 'src/constants/quote-identifiers';

/**
 * One line on a quotation.
 *
 * The line amount is deliberately NOT stored - it is quantity x unitPrice and
 * storing it invites the two drifting apart. Quote.subtotal and Quote.total ARE
 * stored, because once a quote is issued those numbers must never move again.
 */
export default defineObject({
  universalIdentifier: QUOTE_ITEM_OBJECT_UNIVERSAL_IDENTIFIER,
  nameSingular: 'quoteItem',
  namePlural: 'quoteItems',
  labelSingular: 'Quote Item',
  labelPlural: 'Quote Items',
  description: 'A line item on a quotation',
  icon: 'IconListDetails',
  fields: [
    {
      universalIdentifier: QUOTE_ITEM_DESCRIPTION_FIELD_UNIVERSAL_IDENTIFIER,
      name: 'description',
      type: FieldType.TEXT,
      label: 'Description',
      icon: 'IconAbc',
    },
    {
      universalIdentifier: QUOTE_ITEM_QUANTITY_FIELD_UNIVERSAL_IDENTIFIER,
      name: 'quantity',
      type: FieldType.NUMBER,
      label: 'Quantity',
      icon: 'IconNumbers',
      defaultValue: 1,
    },
    {
      universalIdentifier: QUOTE_ITEM_UNIT_FIELD_UNIVERSAL_IDENTIFIER,
      name: 'unit',
      type: FieldType.TEXT,
      label: 'Unit',
      description: 'project, session, month, unit',
      icon: 'IconRuler',
    },
    {
      universalIdentifier: QUOTE_ITEM_UNIT_PRICE_FIELD_UNIVERSAL_IDENTIFIER,
      name: 'unitPrice',
      type: FieldType.CURRENCY,
      label: 'Unit price',
      icon: 'IconCurrencyDollar',
    },
    {
      universalIdentifier: QUOTE_ITEM_IS_TAXABLE_FIELD_UNIVERSAL_IDENTIFIER,
      name: 'isTaxable',
      type: FieldType.BOOLEAN,
      label: 'Taxable',
      description: 'Per-line taxable flag, so mixed quotes are possible',
      icon: 'IconReceiptTax',
      defaultValue: true,
    },
    {
      universalIdentifier: QUOTE_ITEM_POSITION_FIELD_UNIVERSAL_IDENTIFIER,
      name: 'lineOrder',
      type: FieldType.NUMBER,
      label: 'Line order',
      description: 'Order the lines print in',
      icon: 'IconSortAscending',
      defaultValue: 0,
    },
  ],
});
