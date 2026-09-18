import {
  defineNavigationMenuItem,
  NavigationMenuItemType,
} from 'twenty-sdk/define';

import {
  CONVERSATION_OBJECT_UNIVERSAL_IDENTIFIER,
  CONVERSATIONS_NAVIGATION_MENU_ITEM_UNIVERSAL_IDENTIFIER,
} from 'src/constants/messaging-identifiers';

export default defineNavigationMenuItem({
  universalIdentifier: CONVERSATIONS_NAVIGATION_MENU_ITEM_UNIVERSAL_IDENTIFIER,
  name: 'Conversations',
  icon: 'IconMessageCircle',
  position: 2,
  type: NavigationMenuItemType.OBJECT,
  targetObjectUniversalIdentifier: CONVERSATION_OBJECT_UNIVERSAL_IDENTIFIER,
});
