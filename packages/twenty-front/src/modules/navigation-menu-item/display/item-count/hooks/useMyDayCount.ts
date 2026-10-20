import { useMemo } from 'react';
import { CoreObjectNameSingular } from 'twenty-shared/types';
import { isDefined } from 'twenty-shared/utils';

import { currentWorkspaceMemberState } from '@/auth/states/currentWorkspaceMemberState';
import { RECORD_COUNT_AGGREGATE } from '@/navigation-menu-item/display/item-count/constants/RecordCountAggregate';
import { buildMyDayRowsFilter } from '@/navigation-menu-item/display/item-count/utils/buildMyDayRowsFilter';
import { objectMetadataItemsSelector } from '@/object-metadata/states/objectMetadataItemsSelector';
import { useAggregateRecords } from '@/object-record/hooks/useAggregateRecords';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';

export const useMyDayCount = ({ skip = false }: { skip?: boolean } = {}) => {
  const currentWorkspaceMember = useAtomStateValue(currentWorkspaceMemberState);
  const objectMetadataItems = useAtomStateValue(objectMetadataItemsSelector);

  const workspaceMemberId = currentWorkspaceMember?.id;

  const filter = useMemo(
    () =>
      isDefined(workspaceMemberId)
        ? buildMyDayRowsFilter({ objectMetadataItems, workspaceMemberId })
        : undefined,
    [objectMetadataItems, workspaceMemberId],
  );

  const isAvailable = isDefined(filter);

  const { data, refetch } = useAggregateRecords<{ id: { COUNT: number } }>({
    objectNameSingular: CoreObjectNameSingular.Person,
    filter,
    recordGqlFieldsAggregate: RECORD_COUNT_AGGREGATE,
    skip: skip || !isAvailable,
  });

  return {
    count: isAvailable ? data?.id?.COUNT : undefined,
    refetch: isAvailable ? refetch : undefined,
    workspaceMemberId,
  };
};
