import { defineObject, FieldType } from 'twenty-sdk/define';

import {
  MILESTONE_OBJECT_UNIVERSAL_IDENTIFIER,
  MILESTONE_STATUS_FIELD_UNIVERSAL_IDENTIFIER,
  MILESTONE_DETAIL_FIELD_UNIVERSAL_IDENTIFIER,
  MILESTONE_DUE_DATE_FIELD_UNIVERSAL_IDENTIFIER,
  MILESTONE_COMPLETED_AT_FIELD_UNIVERSAL_IDENTIFIER,
  MILESTONE_AMOUNT_FIELD_UNIVERSAL_IDENTIFIER,
  MILESTONE_LINE_ORDER_FIELD_UNIVERSAL_IDENTIFIER,
} from 'src/constants/project-identifiers';

/**
 * A milestone is NOT a task, and that distinction is the whole point.
 *
 * Tasks are internal - "chase Nurul about the logo files", "fix staging". A
 * milestone is something the client agreed to, can see, and usually pays
 * against. Keeping them in separate objects is what makes it safe to show a
 * client their project later: you show milestones, and there is no chance of an
 * internal note about them appearing in the list.
 *
 * Twenty's own Tasks stay exactly where they are for the internal work.
 */
export default defineObject({
  universalIdentifier: MILESTONE_OBJECT_UNIVERSAL_IDENTIFIER,
  nameSingular: 'milestone',
  namePlural: 'milestones',
  labelSingular: 'Milestone',
  labelPlural: 'Milestones',
  description: 'A client-visible stage of a project, usually billable',
  icon: 'IconFlag',
  fields: [
    {
      universalIdentifier: MILESTONE_STATUS_FIELD_UNIVERSAL_IDENTIFIER,
      name: 'status',
      type: FieldType.SELECT,
      label: 'Status',
      icon: 'IconProgressCheck',
      defaultValue: "'PENDING'",
      options: [
        { value: 'PENDING', label: 'Pending', position: 0, color: 'gray' },
        { value: 'IN_PROGRESS', label: 'In progress', position: 1, color: 'blue' },
        { value: 'DONE', label: 'Done', position: 2, color: 'green' },
      ],
    },
    {
      universalIdentifier: MILESTONE_DETAIL_FIELD_UNIVERSAL_IDENTIFIER,
      name: 'detail',
      type: FieldType.TEXT,
      label: 'Detail',
      description: 'What this milestone covers, in words the client would use.',
      icon: 'IconAbc',
    },
    {
      universalIdentifier: MILESTONE_DUE_DATE_FIELD_UNIVERSAL_IDENTIFIER,
      name: 'dueDate',
      type: FieldType.DATE,
      label: 'Due',
      icon: 'IconCalendar',
    },
    {
      universalIdentifier: MILESTONE_COMPLETED_AT_FIELD_UNIVERSAL_IDENTIFIER,
      name: 'completedAt',
      type: FieldType.DATE_TIME,
      label: 'Completed at',
      icon: 'IconCheck',
    },
    {
      universalIdentifier: MILESTONE_AMOUNT_FIELD_UNIVERSAL_IDENTIFIER,
      name: 'amount',
      type: FieldType.CURRENCY,
      label: 'Amount',
      description:
        'The share of the contract billed when this milestone is reached. Leave empty for a milestone that is not billable.',
      icon: 'IconCurrencyDollar',
    },
    {
      universalIdentifier: MILESTONE_LINE_ORDER_FIELD_UNIVERSAL_IDENTIFIER,
      name: 'lineOrder',
      type: FieldType.NUMBER,
      label: 'Order',
      icon: 'IconSortAscending',
      defaultValue: 0,
    },
  ],
});
