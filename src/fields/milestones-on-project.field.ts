import { defineField, FieldType, RelationType } from 'twenty-sdk/define';

import {
  PROJECT_OBJECT_UNIVERSAL_IDENTIFIER,
  MILESTONE_OBJECT_UNIVERSAL_IDENTIFIER,
  MILESTONES_ON_PROJECT_FIELD_UNIVERSAL_IDENTIFIER,
  PROJECT_ON_MILESTONE_FIELD_UNIVERSAL_IDENTIFIER,
} from 'src/constants/project-identifiers';

export default defineField({
  universalIdentifier: MILESTONES_ON_PROJECT_FIELD_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier: PROJECT_OBJECT_UNIVERSAL_IDENTIFIER,
  type: FieldType.RELATION,
  name: 'milestones',
  label: 'Milestones',
  icon: 'IconFlag',
  relationTargetObjectMetadataUniversalIdentifier:
    MILESTONE_OBJECT_UNIVERSAL_IDENTIFIER,
  relationTargetFieldMetadataUniversalIdentifier:
    PROJECT_ON_MILESTONE_FIELD_UNIVERSAL_IDENTIFIER,
  universalSettings: { relationType: RelationType.ONE_TO_MANY },
});
