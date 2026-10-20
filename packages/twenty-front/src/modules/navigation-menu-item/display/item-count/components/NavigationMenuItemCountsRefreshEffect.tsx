import { useEffect, useMemo } from 'react';
import { CoreObjectNameSingular } from 'twenty-shared/types';
import {
  computeRelationGqlFieldJoinColumnName,
  isDefined,
} from 'twenty-shared/utils';
import { useDebouncedCallback } from 'use-debounce';

import { useListenToObjectRecordOperationBrowserEvent } from '@/browser-event/hooks/useListenToObjectRecordOperationBrowserEvent';
import { MY_DAY_COUNT_SOURCE } from '@/navigation-menu-item/display/item-count/constants/MyDayCountSource';
import { NAVIGATION_MENU_ITEM_COUNT_POLL_INTERVAL_IN_MS } from '@/navigation-menu-item/display/item-count/constants/NavigationMenuItemCountPollIntervalInMs';
import { useMyDayCount } from '@/navigation-menu-item/display/item-count/hooks/useMyDayCount';
import { useOpenTasksAssignedToMeCount } from '@/navigation-menu-item/display/item-count/hooks/useOpenTasksAssignedToMeCount';
import { objectMetadataItemsSelector } from '@/object-metadata/states/objectMetadataItemsSelector';
import { useListenToEventsForQuery } from '@/sse-db-event/hooks/useListenToEventsForQuery';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';

const REFETCH_DEBOUNCE_IN_MS = 300;

export const NavigationMenuItemCountsRefreshEffect = () => {
  const objectMetadataItems = useAtomStateValue(objectMetadataItemsSelector);

  const {
    refetch: refetchOpenTasksCount,
    taskAssigneeSource,
    workspaceMemberId,
  } = useOpenTasksAssignedToMeCount();

  const { refetch: refetchMyDayCount } = useMyDayCount();

  const findObjectMetadataItemId = (nameSingular: string) =>
    objectMetadataItems.find(
      (objectMetadataItem) => objectMetadataItem.nameSingular === nameSingular,
    )?.id;

  const taskObjectMetadataItemId = findObjectMetadataItemId(
    CoreObjectNameSingular.Task,
  );
  const personObjectMetadataItemId = findObjectMetadataItemId(
    CoreObjectNameSingular.Person,
  );
  const taskAssigneeJunctionObjectMetadata =
    taskAssigneeSource?.type === 'junction'
      ? taskAssigneeSource.junctionObjectMetadata
      : undefined;

  const debouncedRefetchOpenTasksCount = useDebouncedCallback(() => {
    void refetchOpenTasksCount?.();
  }, REFETCH_DEBOUNCE_IN_MS);

  const debouncedRefetchMyDayCount = useDebouncedCallback(() => {
    void refetchMyDayCount?.();
  }, REFETCH_DEBOUNCE_IN_MS);

  // Any task change can move the count, since status is not part of the
  // assignment the junction listener below watches
  const tasksOperationSignature = useMemo(
    () => ({ objectNameSingular: CoreObjectNameSingular.Task, variables: {} }),
    [],
  );

  const taskAssigneesOperationSignature = useMemo(
    () => ({
      objectNameSingular:
        taskAssigneeJunctionObjectMetadata?.nameSingular ?? '',
      variables: {
        filter: {
          [taskAssigneeSource?.workspaceMemberJoinColumnName ?? '']: {
            eq: workspaceMemberId,
          },
        },
      },
    }),
    [
      taskAssigneeJunctionObjectMetadata?.nameSingular,
      taskAssigneeSource?.workspaceMemberJoinColumnName,
      workspaceMemberId,
    ],
  );

  const myDayPeopleOperationSignature = useMemo(
    () => ({
      objectNameSingular: CoreObjectNameSingular.Person,
      variables: {
        filter: {
          [computeRelationGqlFieldJoinColumnName({
            name: MY_DAY_COUNT_SOURCE.ownerFieldName,
          })]: { eq: workspaceMemberId },
        },
      },
    }),
    [workspaceMemberId],
  );

  const isOpenTasksCountAvailable = isDefined(refetchOpenTasksCount);
  const isMyDayCountAvailable = isDefined(refetchMyDayCount);

  useListenToEventsForQuery({
    queryId: 'navigation-menu-item-count-tasks',
    operationSignature: tasksOperationSignature,
    skip: !isOpenTasksCountAvailable,
    onSseReconnected: debouncedRefetchOpenTasksCount,
  });

  useListenToEventsForQuery({
    queryId: 'navigation-menu-item-count-task-assignees',
    operationSignature: taskAssigneesOperationSignature,
    skip:
      !isOpenTasksCountAvailable ||
      !isDefined(taskAssigneeJunctionObjectMetadata),
    onSseReconnected: debouncedRefetchOpenTasksCount,
  });

  useListenToEventsForQuery({
    queryId: 'navigation-menu-item-count-my-day',
    operationSignature: myDayPeopleOperationSignature,
    skip: !isMyDayCountAvailable,
    onSseReconnected: debouncedRefetchMyDayCount,
  });

  useListenToObjectRecordOperationBrowserEvent({
    onObjectRecordOperationBrowserEvent: debouncedRefetchOpenTasksCount,
    objectMetadataItemId: taskObjectMetadataItemId,
    enabled: isOpenTasksCountAvailable && isDefined(taskObjectMetadataItemId),
  });

  useListenToObjectRecordOperationBrowserEvent({
    onObjectRecordOperationBrowserEvent: debouncedRefetchOpenTasksCount,
    objectMetadataItemId: taskAssigneeJunctionObjectMetadata?.id,
    enabled:
      isOpenTasksCountAvailable &&
      isDefined(taskAssigneeJunctionObjectMetadata),
  });

  useListenToObjectRecordOperationBrowserEvent({
    onObjectRecordOperationBrowserEvent: debouncedRefetchMyDayCount,
    objectMetadataItemId: personObjectMetadataItemId,
    enabled: isMyDayCountAvailable && isDefined(personObjectMetadataItemId),
  });

  useEffect(() => {
    if (!isOpenTasksCountAvailable && !isMyDayCountAvailable) {
      return;
    }

    const intervalId = window.setInterval(() => {
      if (document.hidden) {
        return;
      }

      debouncedRefetchOpenTasksCount();
      debouncedRefetchMyDayCount();
    }, NAVIGATION_MENU_ITEM_COUNT_POLL_INTERVAL_IN_MS);

    return () => window.clearInterval(intervalId);
  }, [
    debouncedRefetchMyDayCount,
    debouncedRefetchOpenTasksCount,
    isMyDayCountAvailable,
    isOpenTasksCountAvailable,
  ]);

  return null;
};
