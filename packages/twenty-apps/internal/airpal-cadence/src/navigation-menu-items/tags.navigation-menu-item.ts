import {
  defineNavigationMenuItem,
  NavigationMenuItemType,
} from 'twenty-sdk/define';

import {
  TAGS_NAVIGATION_MENU_ITEM_UNIVERSAL_IDENTIFIER,
  TAGS_VIEW_UNIVERSAL_IDENTIFIER,
} from 'src/constants/tags-identifiers';

export default defineNavigationMenuItem({
  universalIdentifier: TAGS_NAVIGATION_MENU_ITEM_UNIVERSAL_IDENTIFIER,
  position: 1.9,
  type: NavigationMenuItemType.VIEW,
  viewUniversalIdentifier: TAGS_VIEW_UNIVERSAL_IDENTIFIER,
});
