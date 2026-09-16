import { definePageLayout, PageLayoutTabLayoutMode } from 'twenty-sdk/define';

import {
  APP_DISPLAY_NAME,
  MAIN_PAGE_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  MAIN_PAGE_LAYOUT_TAB_UNIVERSAL_IDENTIFIER,
  MAIN_PAGE_LAYOUT_UNIVERSAL_IDENTIFIER,
  MAIN_PAGE_WIDGET_UNIVERSAL_IDENTIFIER,
  INBOX_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  INBOX_PAGE_LAYOUT_TAB_UNIVERSAL_IDENTIFIER,
  INBOX_WIDGET_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

export default definePageLayout({
  universalIdentifier: MAIN_PAGE_LAYOUT_UNIVERSAL_IDENTIFIER,
  name: APP_DISPLAY_NAME,
  type: 'STANDALONE_PAGE',
  tabs: [
    {
      universalIdentifier: MAIN_PAGE_LAYOUT_TAB_UNIVERSAL_IDENTIFIER,
      title: 'Overview',
      position: 0,
      icon: 'IconApps',
      layoutMode: PageLayoutTabLayoutMode.VERTICAL_LIST,
      widgets: [
        {
          universalIdentifier: MAIN_PAGE_WIDGET_UNIVERSAL_IDENTIFIER,
          title: ' ',
          type: 'FRONT_COMPONENT',
          position: {
            layoutMode: PageLayoutTabLayoutMode.VERTICAL_LIST,
            index: 0,
          },
          configuration: {
            configurationType: 'FRONT_COMPONENT',
            frontComponentUniversalIdentifier:
              MAIN_PAGE_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
          },
        },
      ],
    },
    {
      // SPIKE B - a CANVAS tab is the one place a scrolling surface is allowed.
      universalIdentifier: INBOX_PAGE_LAYOUT_TAB_UNIVERSAL_IDENTIFIER,
      title: 'Inbox spike',
      position: 1,
      icon: 'IconBrandWhatsapp',
      layoutMode: PageLayoutTabLayoutMode.CANVAS,
      widgets: [
        {
          universalIdentifier: INBOX_WIDGET_UNIVERSAL_IDENTIFIER,
          title: ' ',
          type: 'FRONT_COMPONENT',
          position: {
            layoutMode: PageLayoutTabLayoutMode.CANVAS,
          },
          configuration: {
            configurationType: 'FRONT_COMPONENT',
            frontComponentUniversalIdentifier:
              INBOX_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
          },
        },
      ],
    },
  ],
});
