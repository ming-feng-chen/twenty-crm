import {
  CoreObjectNameSingular,
  NavigationMenuItemType,
} from 'twenty-shared/types';
import { isDefined } from 'twenty-shared/utils';

import { useMyDayCount } from '@/navigation-menu-item/display/item-count/hooks/useMyDayCount';
import { useMyDayPageLayoutId } from '@/navigation-menu-item/display/item-count/hooks/useMyDayPageLayoutId';
import { useOpenTasksAssignedToMeCount } from '@/navigation-menu-item/display/item-count/hooks/useOpenTasksAssignedToMeCount';
import { type NavigationMenuItem } from '~/generated-metadata/graphql';

// Only the Tasks object item and the My Day page carry a count; views of
// tasks are left alone.
export const useNavigationMenuItemCount = ({
  navigationMenuItem,
  objectNameSingular,
}: {
  navigationMenuItem?: Pick<NavigationMenuItem, 'type' | 'pageLayoutId'>;
  objectNameSingular?: string;
}): number | undefined => {
  const isTasksObjectItem =
    objectNameSingular === CoreObjectNameSingular.Task &&
    (!isDefined(navigationMenuItem) ||
      navigationMenuItem.type === NavigationMenuItemType.OBJECT);

  const isPageLayoutItem =
    navigationMenuItem?.type === NavigationMenuItemType.PAGE_LAYOUT;

  const { myDayPageLayoutId } = useMyDayPageLayoutId({
    skip: !isPageLayoutItem,
  });

  const isMyDayItem =
    isPageLayoutItem &&
    isDefined(myDayPageLayoutId) &&
    navigationMenuItem?.pageLayoutId === myDayPageLayoutId;

  const { count: openTasksCount } = useOpenTasksAssignedToMeCount({
    skip: !isTasksObjectItem,
  });

  const { count: myDayCount } = useMyDayCount({ skip: !isMyDayItem });

  if (isTasksObjectItem) {
    return openTasksCount;
  }

  return isMyDayItem ? myDayCount : undefined;
};
