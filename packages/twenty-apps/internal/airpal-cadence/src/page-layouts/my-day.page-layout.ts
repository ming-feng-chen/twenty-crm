import {
  definePageLayout,
  PageLayoutTabLayoutMode,
  PageLayoutWidgetVerticalListHeightBehavior,
} from 'twenty-sdk/define';

import {
  CADENCE_RULES_SETTINGS_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  MY_DAY_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  MY_DAY_PAGE_LAYOUT_TAB_UNIVERSAL_IDENTIFIER,
  MY_DAY_PAGE_LAYOUT_UNIVERSAL_IDENTIFIER,
  MY_DAY_PAGE_LAYOUT_WIDGET_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';
import {
  MY_DAY_RULES_TAB_UNIVERSAL_IDENTIFIER,
  MY_DAY_RULES_WIDGET_UNIVERSAL_IDENTIFIER,
} from 'src/ui/universal-identifiers';

// My Day, plus the Cadence rules as a second tab: the settings tab lives under
// Settings > Applications, which members cannot open, and SPEC §1 Q5 says
// everyone can read the rules.
export default definePageLayout({
  universalIdentifier: MY_DAY_PAGE_LAYOUT_UNIVERSAL_IDENTIFIER,
  name: 'My Day',
  type: 'STANDALONE_PAGE',
  tabs: [
    {
      universalIdentifier: MY_DAY_PAGE_LAYOUT_TAB_UNIVERSAL_IDENTIFIER,
      title: 'Today',
      position: 0,
      icon: 'IconCalendarDue',
      layoutMode: PageLayoutTabLayoutMode.VERTICAL_LIST,
      widgets: [
        {
          universalIdentifier: MY_DAY_PAGE_LAYOUT_WIDGET_UNIVERSAL_IDENTIFIER,
          title: ' ',
          type: 'FRONT_COMPONENT',
          heightBehavior:
            PageLayoutWidgetVerticalListHeightBehavior.TAB_VIEWPORT,
          configuration: {
            configurationType: 'FRONT_COMPONENT',
            frontComponentUniversalIdentifier:
              MY_DAY_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
          },
        },
      ],
    },
    {
      universalIdentifier: MY_DAY_RULES_TAB_UNIVERSAL_IDENTIFIER,
      title: 'Cadence rules',
      position: 1,
      icon: 'IconAdjustments',
      layoutMode: PageLayoutTabLayoutMode.VERTICAL_LIST,
      widgets: [
        {
          universalIdentifier: MY_DAY_RULES_WIDGET_UNIVERSAL_IDENTIFIER,
          title: ' ',
          type: 'FRONT_COMPONENT',
          heightBehavior:
            PageLayoutWidgetVerticalListHeightBehavior.TAB_VIEWPORT,
          configuration: {
            configurationType: 'FRONT_COMPONENT',
            frontComponentUniversalIdentifier:
              CADENCE_RULES_SETTINGS_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
          },
        },
      ],
    },
  ],
});
