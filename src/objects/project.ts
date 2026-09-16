import { defineObject, FieldType } from 'twenty-sdk/define';

import {
  PROJECT_OBJECT_UNIVERSAL_IDENTIFIER,
  PROJECT_STATUS_FIELD_UNIVERSAL_IDENTIFIER,
  PROJECT_SUMMARY_FIELD_UNIVERSAL_IDENTIFIER,
  PROJECT_START_DATE_FIELD_UNIVERSAL_IDENTIFIER,
  PROJECT_TARGET_DATE_FIELD_UNIVERSAL_IDENTIFIER,
  PROJECT_COMPLETED_AT_FIELD_UNIVERSAL_IDENTIFIER,
  PROJECT_VALUE_FIELD_UNIVERSAL_IDENTIFIER,
  PROJECT_SOURCE_QUOTE_NUMBER_FIELD_UNIVERSAL_IDENTIFIER,
} from 'src/constants/project-identifiers';

/**
 * The work, after the deal is won.
 *
 * This is the half a CRM usually drops: the pipeline ends at "won" and delivery
 * moves to a spreadsheet, so nobody can answer "where is the Acme job at?"
 * without asking a person.
 *
 * A project is deliberately NOT related to Company directly - it reaches the
 * client through its opportunity. Two paths to the same company is two paths
 * that can disagree, and the one on the opportunity is the one that was sold.
 */
export default defineObject({
  universalIdentifier: PROJECT_OBJECT_UNIVERSAL_IDENTIFIER,
  nameSingular: 'project',
  namePlural: 'projects',
  labelSingular: 'Project',
  labelPlural: 'Projects',
  description: 'Delivery work handed off from a won opportunity',
  icon: 'IconBriefcase',
  fields: [
    {
      universalIdentifier: PROJECT_STATUS_FIELD_UNIVERSAL_IDENTIFIER,
      name: 'status',
      type: FieldType.SELECT,
      label: 'Status',
      icon: 'IconProgressCheck',
      defaultValue: "'NOT_STARTED'",
      options: [
        { value: 'NOT_STARTED', label: 'Not started', position: 0, color: 'gray' },
        { value: 'IN_PROGRESS', label: 'In progress', position: 1, color: 'blue' },
        { value: 'ON_HOLD', label: 'On hold', position: 2, color: 'orange' },
        { value: 'COMPLETED', label: 'Completed', position: 3, color: 'green' },
        { value: 'CANCELLED', label: 'Cancelled', position: 4, color: 'red' },
      ],
    },
    {
      universalIdentifier: PROJECT_SUMMARY_FIELD_UNIVERSAL_IDENTIFIER,
      name: 'summary',
      type: FieldType.TEXT,
      label: 'Summary',
      description:
        'What was sold, in plain words. Written for the client to read, not for internal notes.',
      icon: 'IconFileText',
    },
    {
      universalIdentifier: PROJECT_START_DATE_FIELD_UNIVERSAL_IDENTIFIER,
      name: 'startDate',
      type: FieldType.DATE,
      label: 'Start date',
      icon: 'IconCalendarPlus',
    },
    {
      universalIdentifier: PROJECT_TARGET_DATE_FIELD_UNIVERSAL_IDENTIFIER,
      name: 'targetDate',
      type: FieldType.DATE,
      label: 'Target date',
      description: 'What the client was promised. Kept separate from any internal plan.',
      icon: 'IconCalendarEvent',
    },
    {
      universalIdentifier: PROJECT_COMPLETED_AT_FIELD_UNIVERSAL_IDENTIFIER,
      name: 'completedAt',
      type: FieldType.DATE_TIME,
      label: 'Completed at',
      icon: 'IconCheck',
    },
    {
      universalIdentifier: PROJECT_VALUE_FIELD_UNIVERSAL_IDENTIFIER,
      name: 'contractValue',
      type: FieldType.CURRENCY,
      label: 'Contract value',
      description:
        'What the client agreed to pay, copied from the accepted quotation. Invoices are billed against this.',
      icon: 'IconCurrencyDollar',
    },
    {
      universalIdentifier: PROJECT_SOURCE_QUOTE_NUMBER_FIELD_UNIVERSAL_IDENTIFIER,
      name: 'sourceQuoteNumber',
      type: FieldType.TEXT,
      label: 'From quotation',
      description:
        'The quotation this work was sold on, e.g. Q-0007. A note of where the contract value came from.',
      icon: 'IconFileDollar',
    },
  ],
});
