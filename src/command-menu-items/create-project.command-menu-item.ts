import {
  defineCommandMenuItem,
  CommandMenuItemAvailabilityType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

import {
  CREATE_PROJECT_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  CREATE_PROJECT_COMMAND_MENU_ITEM_UNIVERSAL_IDENTIFIER,
} from 'src/constants/project-identifiers';

// Pinned on a deal: this is the action you take the moment one is won, and it
// should not be hidden behind a search.
export default defineCommandMenuItem({
  universalIdentifier: CREATE_PROJECT_COMMAND_MENU_ITEM_UNIVERSAL_IDENTIFIER,
  label: 'Start project',
  shortLabel: 'Project',
  isPinned: true,
  availabilityType: CommandMenuItemAvailabilityType.RECORD_SELECTION,
  availabilityObjectUniversalIdentifier:
    STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.opportunity.universalIdentifier,
  frontComponentUniversalIdentifier:
    CREATE_PROJECT_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
});
