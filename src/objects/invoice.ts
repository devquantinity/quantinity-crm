import { defineObject, FieldType } from 'twenty-sdk/define';

import {
  INVOICE_OBJECT_UNIVERSAL_IDENTIFIER,
  INVOICE_DOCUMENT_NUMBER_FIELD_UNIVERSAL_IDENTIFIER,
  INVOICE_KIND_FIELD_UNIVERSAL_IDENTIFIER,
  INVOICE_STATUS_FIELD_UNIVERSAL_IDENTIFIER,
  INVOICE_ISSUED_AT_FIELD_UNIVERSAL_IDENTIFIER,
  INVOICE_DUE_DATE_FIELD_UNIVERSAL_IDENTIFIER,
  INVOICE_PAID_AT_FIELD_UNIVERSAL_IDENTIFIER,
  INVOICE_PAID_VIA_FIELD_UNIVERSAL_IDENTIFIER,
  INVOICE_AMOUNT_FIELD_UNIVERSAL_IDENTIFIER,
  INVOICE_SHARE_TOKEN_FIELD_UNIVERSAL_IDENTIFIER,
  INVOICE_NOTES_FIELD_UNIVERSAL_IDENTIFIER,
  INVOICE_ISSUER_SNAPSHOT_FIELD_UNIVERSAL_IDENTIFIER,
  INVOICE_BILL_TO_SNAPSHOT_FIELD_UNIVERSAL_IDENTIFIER,
} from 'src/constants/invoice-identifiers';

/**
 * A request for money against work that was agreed.
 *
 * Invoices hang off the PROJECT, not the deal - you bill for delivery, not for
 * the sale. Most carry a milestone too, which is what makes "what have we
 * billed so far, and what is left?" answerable without a spreadsheet.
 *
 * Its own numbering sequence, separate from quotations: an accountant expects
 * INV-0001 to be the first invoice, not the first document of any kind.
 */
export default defineObject({
  universalIdentifier: INVOICE_OBJECT_UNIVERSAL_IDENTIFIER,
  nameSingular: 'invoice',
  namePlural: 'invoices',
  labelSingular: 'Invoice',
  labelPlural: 'Invoices',
  description: 'A billed amount against a project milestone',
  icon: 'IconReceipt2',
  fields: [
    {
      universalIdentifier: INVOICE_DOCUMENT_NUMBER_FIELD_UNIVERSAL_IDENTIFIER,
      name: 'documentNumber',
      type: FieldType.TEXT,
      label: 'Number',
      description: 'Assigned at issue, e.g. INV-0001. Empty while draft.',
      icon: 'IconHash',
    },
    {
      universalIdentifier: INVOICE_KIND_FIELD_UNIVERSAL_IDENTIFIER,
      name: 'kind',
      type: FieldType.SELECT,
      label: 'Kind',
      description: 'Where in the job this invoice sits. Gotka bills in these three shapes.',
      icon: 'IconStairs',
      defaultValue: "'PROGRESS'",
      options: [
        { value: 'DEPOSIT', label: 'Deposit', position: 0, color: 'blue' },
        { value: 'PROGRESS', label: 'Progress', position: 1, color: 'purple' },
        { value: 'FINAL', label: 'Final', position: 2, color: 'green' },
      ],
    },
    {
      universalIdentifier: INVOICE_STATUS_FIELD_UNIVERSAL_IDENTIFIER,
      name: 'status',
      type: FieldType.SELECT,
      label: 'Status',
      icon: 'IconProgressCheck',
      defaultValue: "'DRAFT'",
      options: [
        { value: 'DRAFT', label: 'Draft', position: 0, color: 'gray' },
        { value: 'ISSUED', label: 'Issued', position: 1, color: 'blue' },
        { value: 'PAID', label: 'Paid', position: 2, color: 'green' },
        { value: 'OVERDUE', label: 'Overdue', position: 3, color: 'red' },
        { value: 'VOID', label: 'Void', position: 4, color: 'gray' },
      ],
    },
    {
      universalIdentifier: INVOICE_AMOUNT_FIELD_UNIVERSAL_IDENTIFIER,
      name: 'amount',
      type: FieldType.CURRENCY,
      label: 'Amount',
      description: 'Locked at issue. An issued invoice never changes its figure.',
      icon: 'IconCurrencyDollar',
    },
    {
      universalIdentifier: INVOICE_ISSUED_AT_FIELD_UNIVERSAL_IDENTIFIER,
      name: 'issuedAt',
      type: FieldType.DATE_TIME,
      label: 'Issued at',
      icon: 'IconSend',
    },
    {
      universalIdentifier: INVOICE_DUE_DATE_FIELD_UNIVERSAL_IDENTIFIER,
      name: 'dueDate',
      type: FieldType.DATE,
      label: 'Due',
      description: 'Issue date plus the payment terms set in Billing.',
      icon: 'IconCalendarDue',
    },
    {
      universalIdentifier: INVOICE_PAID_AT_FIELD_UNIVERSAL_IDENTIFIER,
      name: 'paidAt',
      type: FieldType.DATE_TIME,
      label: 'Paid at',
      icon: 'IconCheck',
    },
    {
      universalIdentifier: INVOICE_PAID_VIA_FIELD_UNIVERSAL_IDENTIFIER,
      name: 'paidVia',
      type: FieldType.SELECT,
      label: 'Paid via',
      description: 'How the money arrived. Worth recording - reconciliation asks later.',
      icon: 'IconBuildingBank',
      options: [
        { value: 'BANK_TRANSFER', label: 'Bank transfer', position: 0, color: 'blue' },
        { value: 'CHEQUE', label: 'Cheque', position: 1, color: 'gray' },
        { value: 'CASH', label: 'Cash', position: 2, color: 'green' },
        { value: 'CARD', label: 'Card', position: 3, color: 'purple' },
        { value: 'OTHER', label: 'Other', position: 4, color: 'gray' },
      ],
    },
    {
      universalIdentifier: INVOICE_SHARE_TOKEN_FIELD_UNIVERSAL_IDENTIFIER,
      name: 'shareToken',
      type: FieldType.TEXT,
      label: 'Share token',
      description: 'Secret path segment for the client-facing invoice page',
      icon: 'IconLink',
      defaultValue: 'uuid',
    },
    {
      universalIdentifier: INVOICE_NOTES_FIELD_UNIVERSAL_IDENTIFIER,
      name: 'notes',
      type: FieldType.TEXT,
      label: 'Notes',
      description: 'Printed on the invoice - payment instructions, a PO number, a reference.',
      icon: 'IconFileText',
    },
    {
      universalIdentifier: INVOICE_ISSUER_SNAPSHOT_FIELD_UNIVERSAL_IDENTIFIER,
      name: 'issuerSnapshot',
      type: FieldType.RAW_JSON,
      label: 'Issuer snapshot',
      description: 'Your business details frozen at issue',
      icon: 'IconBuildingStore',
    },
    {
      universalIdentifier: INVOICE_BILL_TO_SNAPSHOT_FIELD_UNIVERSAL_IDENTIFIER,
      name: 'billToSnapshot',
      type: FieldType.RAW_JSON,
      label: 'Bill to snapshot',
      description: 'Client details frozen at issue',
      icon: 'IconAddressBook',
    },
  ],
});
