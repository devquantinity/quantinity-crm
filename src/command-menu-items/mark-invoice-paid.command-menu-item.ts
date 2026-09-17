import {
  defineCommandMenuItem,
  CommandMenuItemAvailabilityType,
} from 'twenty-sdk/define';

import {
  INVOICE_OBJECT_UNIVERSAL_IDENTIFIER,
  MARK_PAID_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  MARK_PAID_COMMAND_MENU_ITEM_UNIVERSAL_IDENTIFIER,
} from 'src/constants/invoice-identifiers';

export default defineCommandMenuItem({
  universalIdentifier: MARK_PAID_COMMAND_MENU_ITEM_UNIVERSAL_IDENTIFIER,
  label: 'Mark invoice paid',
  shortLabel: 'Paid',
  isPinned: false,
  availabilityType: CommandMenuItemAvailabilityType.RECORD_SELECTION,
  availabilityObjectUniversalIdentifier: INVOICE_OBJECT_UNIVERSAL_IDENTIFIER,
  frontComponentUniversalIdentifier:
    MARK_PAID_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
});
