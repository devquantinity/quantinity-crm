import { defineField, FieldType, RelationType } from 'twenty-sdk/define';

import { PROJECT_OBJECT_UNIVERSAL_IDENTIFIER } from 'src/constants/project-identifiers';
import {
  INVOICE_OBJECT_UNIVERSAL_IDENTIFIER,
  INVOICES_ON_PROJECT_FIELD_UNIVERSAL_IDENTIFIER,
  PROJECT_ON_INVOICE_FIELD_UNIVERSAL_IDENTIFIER,
} from 'src/constants/invoice-identifiers';

export default defineField({
  universalIdentifier: INVOICES_ON_PROJECT_FIELD_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier: PROJECT_OBJECT_UNIVERSAL_IDENTIFIER,
  type: FieldType.RELATION,
  name: 'invoices',
  label: 'Invoices',
  icon: 'IconReceipt2',
  relationTargetObjectMetadataUniversalIdentifier:
    INVOICE_OBJECT_UNIVERSAL_IDENTIFIER,
  relationTargetFieldMetadataUniversalIdentifier:
    PROJECT_ON_INVOICE_FIELD_UNIVERSAL_IDENTIFIER,
  universalSettings: { relationType: RelationType.ONE_TO_MANY },
});
