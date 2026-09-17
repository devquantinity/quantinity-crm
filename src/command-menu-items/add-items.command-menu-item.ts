import {
  defineCommandMenuItem,
  CommandMenuItemAvailabilityType,
} from 'twenty-sdk/define';

import { QUOTE_OBJECT_UNIVERSAL_IDENTIFIER } from 'src/constants/quote-identifiers';
import {
  ADD_ITEMS_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  ADD_ITEMS_COMMAND_MENU_ITEM_UNIVERSAL_IDENTIFIER,
} from 'src/constants/catalogue-identifiers';

export default defineCommandMenuItem({
  universalIdentifier: ADD_ITEMS_COMMAND_MENU_ITEM_UNIVERSAL_IDENTIFIER,
  label: 'Add items from catalogue',
  shortLabel: 'Add items',
  isPinned: true,
  availabilityType: CommandMenuItemAvailabilityType.RECORD_SELECTION,
  availabilityObjectUniversalIdentifier: QUOTE_OBJECT_UNIVERSAL_IDENTIFIER,
  frontComponentUniversalIdentifier: ADD_ITEMS_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
});
