import {
  defineCommandMenuItem,
  CommandMenuItemAvailabilityType,
} from 'twenty-sdk/define';

import { MILESTONE_OBJECT_UNIVERSAL_IDENTIFIER } from 'src/constants/project-identifiers';
import {
  CREATE_INVOICE_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  CREATE_INVOICE_COMMAND_MENU_ITEM_UNIVERSAL_IDENTIFIER,
} from 'src/constants/invoice-identifiers';

export default defineCommandMenuItem({
  universalIdentifier: CREATE_INVOICE_COMMAND_MENU_ITEM_UNIVERSAL_IDENTIFIER,
  label: 'Bill this milestone',
  shortLabel: 'Bill',
  isPinned: true,
  availabilityType: CommandMenuItemAvailabilityType.RECORD_SELECTION,
  availabilityObjectUniversalIdentifier: MILESTONE_OBJECT_UNIVERSAL_IDENTIFIER,
  frontComponentUniversalIdentifier:
    CREATE_INVOICE_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
});
