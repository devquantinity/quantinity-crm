import {
  defineCommandMenuItem,
  CommandMenuItemAvailabilityType,
} from 'twenty-sdk/define';

import {
  QUOTE_OBJECT_UNIVERSAL_IDENTIFIER,
  DUPLICATE_QUOTE_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  DUPLICATE_QUOTE_COMMAND_MENU_ITEM_UNIVERSAL_IDENTIFIER,
} from 'src/constants/quote-identifiers';

export default defineCommandMenuItem({
  universalIdentifier: DUPLICATE_QUOTE_COMMAND_MENU_ITEM_UNIVERSAL_IDENTIFIER,
  label: 'Duplicate quotation',
  shortLabel: 'Duplicate',
  availabilityType: CommandMenuItemAvailabilityType.RECORD_SELECTION,
  availabilityObjectUniversalIdentifier: QUOTE_OBJECT_UNIVERSAL_IDENTIFIER,
  frontComponentUniversalIdentifier:
    DUPLICATE_QUOTE_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
});
