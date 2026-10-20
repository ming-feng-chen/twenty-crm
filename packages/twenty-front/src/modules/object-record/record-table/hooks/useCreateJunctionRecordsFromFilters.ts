import { useCallback } from 'react';
import { isDefined } from 'twenty-shared/utils';

import { currentWorkspaceMemberState } from '@/auth/states/currentWorkspaceMemberState';
import { objectMetadataItemsSelector } from '@/object-metadata/states/objectMetadataItemsSelector';
import { type EnrichedObjectMetadataItem } from '@/object-metadata/types/EnrichedObjectMetadataItem';
import { useCreateManyRecords } from '@/object-record/hooks/useCreateManyRecords';
import { useRefetchFindManyRecords } from '@/object-record/hooks/useRefetchFindManyRecords';
import { currentRecordFiltersComponentState } from '@/object-record/record-filter/states/currentRecordFiltersComponentState';
import { buildJunctionRecordsFromFilters } from '@/object-record/record-table/utils/buildJunctionRecordsFromFilters';
import { useAtomComponentStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomComponentStateValue';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';

export const useCreateJunctionRecordsFromFilters = ({
  objectMetadataItem,
  instanceId,
}: {
  objectMetadataItem: EnrichedObjectMetadataItem;
  instanceId?: string;
}) => {
  const currentRecordFilters = useAtomComponentStateValue(
    currentRecordFiltersComponentState,
    instanceId,
  );

  const currentWorkspaceMember = useAtomStateValue(currentWorkspaceMemberState);
  const objectMetadataItems = useAtomStateValue(objectMetadataItemsSelector);

  const buildJunctionRecords = useCallback(
    (recordId: string) =>
      buildJunctionRecordsFromFilters({
        currentRecordFilters,
        objectMetadataItem,
        objectMetadataItems,
        currentWorkspaceMemberId: currentWorkspaceMember?.id,
        recordId,
      }),
    [
      currentRecordFilters,
      currentWorkspaceMember?.id,
      objectMetadataItem,
      objectMetadataItems,
    ],
  );

  const junctionObjectNameSingular =
    buildJunctionRecords('')?.junctionObjectNameSingular;

  // The hook needs an object either way; it is only called with a junction
  const { createManyRecords: createJunctionRecords } = useCreateManyRecords({
    objectNameSingular:
      junctionObjectNameSingular ?? objectMetadataItem.nameSingular,
  });

  const { refetchFindManyRecords } = useRefetchFindManyRecords({
    objectMetadataNamePlural: objectMetadataItem.namePlural,
  });

  const createJunctionRecordsFromFilters = useCallback(
    async (recordId: string) => {
      const junctionRecords = buildJunctionRecords(recordId);

      if (!isDefined(junctionRecords)) {
        return;
      }

      await createJunctionRecords({
        recordsToCreate: junctionRecords.recordsToCreate,
        upsert: true,
      });

      // The new record only matches the view's filter once its junction rows exist
      await refetchFindManyRecords();
    },
    [buildJunctionRecords, createJunctionRecords, refetchFindManyRecords],
  );

  return { createJunctionRecordsFromFilters };
};
