import {
  defineCommandMenuItem,
  CommandMenuItemAvailabilityType,
} from 'twenty-sdk/define';

import {
  QUOTE_OBJECT_UNIVERSAL_IDENTIFIER,
  WITHDRAW_QUOTE_COMMAND_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  WITHDRAW_QUOTE_COMMAND_MENU_ITEM_UNIVERSAL_IDENTIFIER,
} from 'src/constants/quote-identifiers';

export default defineCommandMenuItem({
  universalIdentifier: WITHDRAW_QUOTE_COMMAND_MENU_ITEM_UNIVERSAL_IDENTIFIER,
  label: 'Withdraw quotation',
  shortLabel: 'Withdraw',
  availabilityType: CommandMenuItemAvailabilityType.RECORD_SELECTION,
  availabilityObjectUniversalIdentifier: QUOTE_OBJECT_UNIVERSAL_IDENTIFIER,
  frontComponentUniversalIdentifier:
    WITHDRAW_QUOTE_COMMAND_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
});
