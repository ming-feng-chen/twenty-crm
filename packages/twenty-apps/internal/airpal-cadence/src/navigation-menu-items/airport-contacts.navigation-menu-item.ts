import {
  defineNavigationMenuItem,
  NavigationMenuItemType,
} from 'twenty-sdk/define';

import {
  AIRPORT_CONTACTS_NAVIGATION_MENU_ITEM_UNIVERSAL_IDENTIFIER,
  AIRPORT_CONTACTS_VIEW_UNIVERSAL_IDENTIFIER,
} from 'src/constants/partners-airports-identifiers';

export default defineNavigationMenuItem({
  universalIdentifier: AIRPORT_CONTACTS_NAVIGATION_MENU_ITEM_UNIVERSAL_IDENTIFIER,
  icon: 'IconUsers',
  position: 1.8,
  type: NavigationMenuItemType.VIEW,
  viewUniversalIdentifier: AIRPORT_CONTACTS_VIEW_UNIVERSAL_IDENTIFIER,
});
