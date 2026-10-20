import {
  defineNavigationMenuItem,
  NavigationMenuItemType,
} from 'twenty-sdk/define';

import {
  PARTNERS_NAVIGATION_MENU_ITEM_UNIVERSAL_IDENTIFIER,
  PARTNERS_VIEW_UNIVERSAL_IDENTIFIER,
} from 'src/constants/partners-airports-identifiers';

export default defineNavigationMenuItem({
  universalIdentifier: PARTNERS_NAVIGATION_MENU_ITEM_UNIVERSAL_IDENTIFIER,
  icon: 'IconBuildingStore',
  position: 1.2,
  type: NavigationMenuItemType.VIEW,
  viewUniversalIdentifier: PARTNERS_VIEW_UNIVERSAL_IDENTIFIER,
});
