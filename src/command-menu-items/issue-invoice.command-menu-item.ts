import {
  defineCommandMenuItem,
  CommandMenuItemAvailabilityType,
} from 'twenty-sdk/define';

import {
  INVOICE_OBJECT_UNIVERSAL_IDENTIFIER,
  ISSUE_INVOICE_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  ISSUE_INVOICE_COMMAND_MENU_ITEM_UNIVERSAL_IDENTIFIER,
} from 'src/constants/invoice-identifiers';

export default defineCommandMenuItem({
  universalIdentifier: ISSUE_INVOICE_COMMAND_MENU_ITEM_UNIVERSAL_IDENTIFIER,
  label: 'Issue invoice',
  shortLabel: 'Issue',
  isPinned: true,
  availabilityType: CommandMenuItemAvailabilityType.RECORD_SELECTION,
  availabilityObjectUniversalIdentifier: INVOICE_OBJECT_UNIVERSAL_IDENTIFIER,
  frontComponentUniversalIdentifier:
    ISSUE_INVOICE_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
});
