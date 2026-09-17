import { defineField, FieldType, RelationType } from 'twenty-sdk/define';

import { MILESTONE_OBJECT_UNIVERSAL_IDENTIFIER } from 'src/constants/project-identifiers';
import {
  INVOICE_OBJECT_UNIVERSAL_IDENTIFIER,
  INVOICES_ON_MILESTONE_FIELD_UNIVERSAL_IDENTIFIER,
  MILESTONE_ON_INVOICE_FIELD_UNIVERSAL_IDENTIFIER,
} from 'src/constants/invoice-identifiers';

// One-to-many rather than one-to-one: a milestone can be part-billed, and a
// voided invoice has to be replaceable without losing the first one.
export default defineField({
  universalIdentifier: INVOICES_ON_MILESTONE_FIELD_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier: MILESTONE_OBJECT_UNIVERSAL_IDENTIFIER,
  type: FieldType.RELATION,
  name: 'invoices',
  label: 'Invoices',
  icon: 'IconReceipt2',
  relationTargetObjectMetadataUniversalIdentifier:
    INVOICE_OBJECT_UNIVERSAL_IDENTIFIER,
  relationTargetFieldMetadataUniversalIdentifier:
    MILESTONE_ON_INVOICE_FIELD_UNIVERSAL_IDENTIFIER,
  universalSettings: { relationType: RelationType.ONE_TO_MANY },
});
