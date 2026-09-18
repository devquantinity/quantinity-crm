import {
  defineCommandMenuItem,
  CommandMenuItemAvailabilityType,
  STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS,
} from 'twenty-sdk/define';

import {
  CONTACT_CHAT_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  MESSAGE_PERSON_COMMAND_MENU_ITEM_UNIVERSAL_IDENTIFIER,
} from 'src/constants/messaging-identifiers';

export default defineCommandMenuItem({
  universalIdentifier: MESSAGE_PERSON_COMMAND_MENU_ITEM_UNIVERSAL_IDENTIFIER,
  label: 'Message on WhatsApp',
  shortLabel: 'Message',
  isPinned: true,
  availabilityType: CommandMenuItemAvailabilityType.RECORD_SELECTION,
  availabilityObjectUniversalIdentifier:
    STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
  frontComponentUniversalIdentifier: CONTACT_CHAT_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
});
