import {
  defineNavigationMenuItem,
  NavigationMenuItemType,
} from 'twenty-sdk/define';

import {
  AIRPORTS_NAVIGATION_MENU_ITEM_UNIVERSAL_IDENTIFIER,
  AIRPORTS_VIEW_UNIVERSAL_IDENTIFIER,
} from 'src/constants/partners-airports-identifiers';

export default defineNavigationMenuItem({
  universalIdentifier: AIRPORTS_NAVIGATION_MENU_ITEM_UNIVERSAL_IDENTIFIER,
  icon: 'IconPlaneDeparture',
  position: 1.6,
  type: NavigationMenuItemType.VIEW,
  viewUniversalIdentifier: AIRPORTS_VIEW_UNIVERSAL_IDENTIFIER,
});
