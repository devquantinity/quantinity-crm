import {
  defineField,
  FieldType,
  RelationType,
  OnDeleteAction,
} from 'twenty-sdk/define';

import { PROJECT_OBJECT_UNIVERSAL_IDENTIFIER } from 'src/constants/project-identifiers';
import {
  INVOICE_OBJECT_UNIVERSAL_IDENTIFIER,
  INVOICES_ON_PROJECT_FIELD_UNIVERSAL_IDENTIFIER,
  PROJECT_ON_INVOICE_FIELD_UNIVERSAL_IDENTIFIER,
} from 'src/constants/invoice-identifiers';

// SET_NULL: an issued invoice is an accounting record. It outlives the project.
export default defineField({
  universalIdentifier: PROJECT_ON_INVOICE_FIELD_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier: INVOICE_OBJECT_UNIVERSAL_IDENTIFIER,
  type: FieldType.RELATION,
  name: 'project',
  label: 'Project',
  icon: 'IconBriefcase',
  relationTargetObjectMetadataUniversalIdentifier:
    PROJECT_OBJECT_UNIVERSAL_IDENTIFIER,
  relationTargetFieldMetadataUniversalIdentifier:
    INVOICES_ON_PROJECT_FIELD_UNIVERSAL_IDENTIFIER,
  universalSettings: {
    relationType: RelationType.MANY_TO_ONE,
    onDelete: OnDeleteAction.SET_NULL,
    joinColumnName: 'projectId',
  },
});
