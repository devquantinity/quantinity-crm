import {
  defineField,
  FieldType,
  RelationType,
  OnDeleteAction,
} from 'twenty-sdk/define';

import { MILESTONE_OBJECT_UNIVERSAL_IDENTIFIER } from 'src/constants/project-identifiers';
import {
  INVOICE_OBJECT_UNIVERSAL_IDENTIFIER,
  INVOICES_ON_MILESTONE_FIELD_UNIVERSAL_IDENTIFIER,
  MILESTONE_ON_INVOICE_FIELD_UNIVERSAL_IDENTIFIER,
} from 'src/constants/invoice-identifiers';

export default defineField({
  universalIdentifier: MILESTONE_ON_INVOICE_FIELD_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier: INVOICE_OBJECT_UNIVERSAL_IDENTIFIER,
  type: FieldType.RELATION,
  name: 'milestone',
  label: 'Milestone',
  icon: 'IconFlag',
  relationTargetObjectMetadataUniversalIdentifier:
    MILESTONE_OBJECT_UNIVERSAL_IDENTIFIER,
  relationTargetFieldMetadataUniversalIdentifier:
    INVOICES_ON_MILESTONE_FIELD_UNIVERSAL_IDENTIFIER,
  universalSettings: {
    relationType: RelationType.MANY_TO_ONE,
    onDelete: OnDeleteAction.SET_NULL,
    joinColumnName: 'milestoneId',
  },
});
