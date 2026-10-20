import {
  defineNavigationMenuItem,
  NavigationMenuItemType,
} from 'twenty-sdk/define';

import {
  PARTNER_CONTACTS_NAVIGATION_MENU_ITEM_UNIVERSAL_IDENTIFIER,
  PARTNER_CONTACTS_VIEW_UNIVERSAL_IDENTIFIER,
} from 'src/constants/partners-airports-identifiers';

export default defineNavigationMenuItem({
  universalIdentifier: PARTNER_CONTACTS_NAVIGATION_MENU_ITEM_UNIVERSAL_IDENTIFIER,
  icon: 'IconUsers',
  position: 1.4,
  type: NavigationMenuItemType.VIEW,
  viewUniversalIdentifier: PARTNER_CONTACTS_VIEW_UNIVERSAL_IDENTIFIER,
});
