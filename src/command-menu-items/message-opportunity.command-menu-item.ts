import {
  defineCommandMenuItem,
  CommandMenuItemAvailabilityType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

import {
  CONTACT_CHAT_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  MESSAGE_OPPORTUNITY_COMMAND_MENU_ITEM_UNIVERSAL_IDENTIFIER,
} from 'src/constants/messaging-identifiers';

// Same panel. A deal has no number of its own, so the route resolves it
// through the deal's point of contact.
export default defineCommandMenuItem({
  universalIdentifier: MESSAGE_OPPORTUNITY_COMMAND_MENU_ITEM_UNIVERSAL_IDENTIFIER,
  label: 'Message on WhatsApp',
  shortLabel: 'Message',
  isPinned: true,
  availabilityType: CommandMenuItemAvailabilityType.RECORD_SELECTION,
  availabilityObjectUniversalIdentifier:
    STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.opportunity.universalIdentifier,
  frontComponentUniversalIdentifier: CONTACT_CHAT_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
});
