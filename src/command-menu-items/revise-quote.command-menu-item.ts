import {
  defineCommandMenuItem,
  CommandMenuItemAvailabilityType,
} from 'twenty-sdk/define';

import {
  QUOTE_OBJECT_UNIVERSAL_IDENTIFIER,
  REVISE_QUOTE_COMMAND_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  REVISE_QUOTE_COMMAND_MENU_ITEM_UNIVERSAL_IDENTIFIER,
} from 'src/constants/quote-identifiers';

// Not pinned: revising is rarer than issuing, and a pinned row of three actions
// makes the important one harder to find.
export default defineCommandMenuItem({
  universalIdentifier: REVISE_QUOTE_COMMAND_MENU_ITEM_UNIVERSAL_IDENTIFIER,
  label: 'Revise quotation',
  shortLabel: 'Revise',
  availabilityType: CommandMenuItemAvailabilityType.RECORD_SELECTION,
  availabilityObjectUniversalIdentifier: QUOTE_OBJECT_UNIVERSAL_IDENTIFIER,
  frontComponentUniversalIdentifier:
    REVISE_QUOTE_COMMAND_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
});
