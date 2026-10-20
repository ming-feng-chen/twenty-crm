import {
  defineNavigationMenuItem,
  NavigationMenuItemType,
} from 'twenty-sdk/define';

import {
  COLD_NAVIGATION_MENU_ITEM_UNIVERSAL_IDENTIFIER,
  COLD_VIEW_UNIVERSAL_IDENTIFIER,
} from 'src/ui/universal-identifiers';

export default defineNavigationMenuItem({
  universalIdentifier: COLD_NAVIGATION_MENU_ITEM_UNIVERSAL_IDENTIFIER,
  name: 'Cold',
  icon: 'IconSnowflake',
  position: 0,
  type: NavigationMenuItemType.VIEW,
  viewUniversalIdentifier: COLD_VIEW_UNIVERSAL_IDENTIFIER,
});
