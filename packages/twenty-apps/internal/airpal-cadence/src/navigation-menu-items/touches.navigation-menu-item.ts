import {
  defineNavigationMenuItem,
  NavigationMenuItemType,
} from 'twenty-sdk/define';

import {
  ALL_TOUCHES_VIEW_UNIVERSAL_IDENTIFIER,
  TOUCHES_NAVIGATION_MENU_ITEM_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

export default defineNavigationMenuItem({
  universalIdentifier: TOUCHES_NAVIGATION_MENU_ITEM_UNIVERSAL_IDENTIFIER,
  position: 1,
  type: NavigationMenuItemType.VIEW,
  viewUniversalIdentifier: ALL_TOUCHES_VIEW_UNIVERSAL_IDENTIFIER,
});
