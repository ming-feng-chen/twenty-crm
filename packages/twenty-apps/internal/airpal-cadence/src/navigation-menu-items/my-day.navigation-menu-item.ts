import {
  defineNavigationMenuItem,
  NavigationMenuItemType,
} from 'twenty-sdk/define';

import {
  MY_DAY_NAVIGATION_MENU_ITEM_UNIVERSAL_IDENTIFIER,
  MY_DAY_PAGE_LAYOUT_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

export default defineNavigationMenuItem({
  universalIdentifier: MY_DAY_NAVIGATION_MENU_ITEM_UNIVERSAL_IDENTIFIER,
  name: 'My Day',
  icon: 'IconCalendarDue',
  position: -1,
  type: NavigationMenuItemType.PAGE_LAYOUT,
  pageLayoutUniversalIdentifier: MY_DAY_PAGE_LAYOUT_UNIVERSAL_IDENTIFIER,
});
