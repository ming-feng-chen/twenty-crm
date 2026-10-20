import { useMemo } from 'react';
import { CoreObjectNameSingular } from 'twenty-shared/types';
import { isDefined } from 'twenty-shared/utils';

import { currentWorkspaceMemberState } from '@/auth/states/currentWorkspaceMemberState';
import { RECORD_COUNT_AGGREGATE } from '@/navigation-menu-item/display/item-count/constants/RecordCountAggregate';
import { buildOpenTasksAssignedToWorkspaceMemberFilter } from '@/navigation-menu-item/display/item-count/utils/buildOpenTasksAssignedToWorkspaceMemberFilter';
import { getTaskAssigneeSource } from '@/navigation-menu-item/display/item-count/utils/getTaskAssigneeSource';
import { objectMetadataItemsSelector } from '@/object-metadata/states/objectMetadataItemsSelector';
import { useAggregateRecords } from '@/object-record/hooks/useAggregateRecords';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';

export const useOpenTasksAssignedToMeCount = ({
  skip = false,
}: { skip?: boolean } = {}) => {
  const currentWorkspaceMember = useAtomStateValue(currentWorkspaceMemberState);
  const objectMetadataItems = useAtomStateValue(objectMetadataItemsSelector);

  const taskAssigneeSource = useMemo(
    () => getTaskAssigneeSource(objectMetadataItems),
    [objectMetadataItems],
  );

  const workspaceMemberId = currentWorkspaceMember?.id;

  const filter = useMemo(
    () =>
      isDefined(taskAssigneeSource) && isDefined(workspaceMemberId)
        ? buildOpenTasksAssignedToWorkspaceMemberFilter({
            taskAssigneeSource,
            workspaceMemberId,
          })
        : undefined,
    [taskAssigneeSource, workspaceMemberId],
  );

  const isAvailable = isDefined(filter);

  const { data, refetch } = useAggregateRecords<{ id: { COUNT: number } }>({
    objectNameSingular: CoreObjectNameSingular.Task,
    filter,
    recordGqlFieldsAggregate: RECORD_COUNT_AGGREGATE,
    skip: skip || !isAvailable,
  });

  return {
    count: isAvailable ? data?.id?.COUNT : undefined,
    refetch: isAvailable ? refetch : undefined,
    taskAssigneeSource,
    workspaceMemberId,
  };
};
