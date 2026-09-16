import {
  defineCommandMenuItem,
  CommandMenuItemAvailabilityType,
} from 'twenty-sdk/define';

import {
  QUOTE_OBJECT_UNIVERSAL_IDENTIFIER,
  ISSUE_QUOTE_COMMAND_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  ISSUE_QUOTE_COMMAND_MENU_ITEM_UNIVERSAL_IDENTIFIER,
} from 'src/constants/quote-identifiers';

// Shows on a selected Quote record. Pinned, because issuing is the whole point
// of the record and should not be hidden behind a search.
export default defineCommandMenuItem({
  universalIdentifier: ISSUE_QUOTE_COMMAND_MENU_ITEM_UNIVERSAL_IDENTIFIER,
  label: 'Issue quotation',
  shortLabel: 'Issue',
  isPinned: true,
  availabilityType: CommandMenuItemAvailabilityType.RECORD_SELECTION,
  availabilityObjectUniversalIdentifier: QUOTE_OBJECT_UNIVERSAL_IDENTIFIER,
  frontComponentUniversalIdentifier:
    ISSUE_QUOTE_COMMAND_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
});
