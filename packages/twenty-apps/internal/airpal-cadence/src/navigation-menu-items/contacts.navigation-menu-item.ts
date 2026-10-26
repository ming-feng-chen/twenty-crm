import {
  defineNavigationMenuItem,
  NavigationMenuItemType,
} from 'twenty-sdk/define';

import { CONTACTS_NAVIGATION_MENU_ITEM_UNIVERSAL_IDENTIFIER } from 'src/ui/universal-identifiers';

// A relative link opens in the same tab. The Contacts page replaces the
// People, Cold, Partner contacts and Airport contacts sidebar items.
export default defineNavigationMenuItem({
  universalIdentifier: CONTACTS_NAVIGATION_MENU_ITEM_UNIVERSAL_IDENTIFIER,
  name: 'Contacts',
  icon: 'IconUser',
  position: -2,
  type: NavigationMenuItemType.LINK,
  link: '/contacts',
});
