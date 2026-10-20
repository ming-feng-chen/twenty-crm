import { NAVIGATION_DRAWER_ITEM_MAX_DISPLAYED_COUNT } from '@/ui/navigation/navigation-drawer/constants/NavigationDrawerItemMaxDisplayedCount';

export const formatNavigationDrawerItemCount = (count: number) =>
  count > NAVIGATION_DRAWER_ITEM_MAX_DISPLAYED_COUNT
    ? `${NAVIGATION_DRAWER_ITEM_MAX_DISPLAYED_COUNT}+`
    : `${count}`;
