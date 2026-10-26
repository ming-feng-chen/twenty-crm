import { atom, useAtomValue, useStore } from 'jotai';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { CoreObjectNameSingular } from 'twenty-shared/types';

import { useListenToObjectRecordOperationBrowserEvent } from '@/browser-event/hooks/useListenToObjectRecordOperationBrowserEvent';
import { type ObjectRecordOperationBrowserEventDetail } from '@/browser-event/types/ObjectRecordOperationBrowserEventDetail';
import { FAST_CONTACTS_COMPANY_OPERATION_SIGNATURE } from '@/fast-contacts/constants/FastContactsCompanyOperationSignature';
import { FAST_CONTACTS_REFRESH_BATCH_DELAY_IN_MS } from '@/fast-contacts/constants/FastContactsRefreshBatchDelayInMs';
import { FAST_CONTACTS_PERSON_OPERATION_SIGNATURE } from '@/fast-contacts/constants/FastContactsPersonOperationSignature';
import { FAST_CONTACTS_RELOAD_ON_FOCUS_MIN_INTERVAL_IN_MS } from '@/fast-contacts/constants/FastContactsReloadOnFocusMinIntervalInMs';
import { fastContactsFullLoadState } from '@/fast-contacts/states/fastContactsFullLoadState';
import { type FastContactsPerson } from '@/fast-contacts/types/FastContactsPerson';
import { applyFastContactsRefresh } from '@/fast-contacts/utils/applyFastContactsRefresh';
import { fetchFastContactsPeople } from '@/fast-contacts/utils/fetchFastContactsPeople';
import { getRecordIdsFromRecordOperation } from '@/fast-contacts/utils/getRecordIdsFromRecordOperation';
import { mergeFastContactsFullLoad } from '@/fast-contacts/utils/mergeFastContactsFullLoad';
import { sortFastContactsPeople } from '@/fast-contacts/utils/sortFastContactsPeople';
import { useApolloCoreClient } from '@/object-metadata/hooks/useApolloCoreClient';
import { useObjectMetadataItem } from '@/object-metadata/hooks/useObjectMetadataItem';
import { useListenToEventsForQuery } from '@/sse-db-event/hooks/useListenToEventsForQuery';

type FastContactsLoadStatus = 'loading' | 'loaded' | 'failed';

export const useFastContactsPeople = () => {
  const apolloCoreClient = useApolloCoreClient();
  const store = useStore();

  const { objectMetadataItem: personObjectMetadataItem } =
    useObjectMetadataItem({
      objectNameSingular: CoreObjectNameSingular.Person,
    });
  const { objectMetadataItem: companyObjectMetadataItem } =
    useObjectMetadataItem({
      objectNameSingular: CoreObjectNameSingular.Company,
    });

  // Edits read and update people synchronously through the store, so a
  // second edit right after a first one sees its result.
  const [peopleByIdAtom] = useState(() =>
    atom(new Map<string, FastContactsPerson>()),
  );
  const peopleById = useAtomValue(peopleByIdAtom);
  const setPeopleById = useCallback(
    (
      update: (
        currentPeopleById: Map<string, FastContactsPerson>,
      ) => Map<string, FastContactsPerson>,
    ) => store.set(peopleByIdAtom, update),
    [peopleByIdAtom, store],
  );
  const [loadStatus, setLoadStatus] =
    useState<FastContactsLoadStatus>('loading');
  const [fullLoadCount, setFullLoadCount] = useState(0);

  const markRecordIdsChanged = useCallback(
    (recordIds: string[]) => {
      const { recordIdsChangedDuringLoad } = store.get(
        fastContactsFullLoadState.atom,
      );

      for (const recordId of recordIds) {
        recordIdsChangedDuringLoad?.add(recordId);
      }
    },
    [store],
  );

  const loadAllPeople = useCallback(async () => {
    const fullLoadId = store.get(fastContactsFullLoadState.atom).loadId + 1;
    const recordIdsChangedDuringLoad = new Set<string>();
    const isLatestFullLoad = () =>
      store.get(fastContactsFullLoadState.atom).loadId === fullLoadId;

    store.set(fastContactsFullLoadState.atom, {
      loadId: fullLoadId,
      startedAt: Date.now(),
      recordIdsChangedDuringLoad,
    });

    try {
      const loadedPeople = await fetchFastContactsPeople({ apolloCoreClient });

      if (!isLatestFullLoad()) {
        return;
      }

      setPeopleById((currentPeopleById) =>
        mergeFastContactsFullLoad({
          currentPeopleById,
          loadedPeople,
          recordIdsChangedDuringLoad,
        }),
      );
      setLoadStatus('loaded');
      setFullLoadCount((count) => count + 1);
    } catch {
      if (isLatestFullLoad()) {
        setLoadStatus('failed');
      }
    } finally {
      if (isLatestFullLoad()) {
        store.set(fastContactsFullLoadState.atom, (fullLoad) => ({
          ...fullLoad,
          recordIdsChangedDuringLoad: null,
        }));
      }
    }
  }, [apolloCoreClient, setPeopleById, store]);

  const refreshPeople = useCallback(
    async ({
      filter,
      recordIdsToRemoveIfMissing,
    }: {
      filter: Record<string, unknown>;
      recordIdsToRemoveIfMissing: string[];
    }) => {
      try {
        const refreshedPeople = await fetchFastContactsPeople({
          apolloCoreClient,
          filter,
        });

        markRecordIdsChanged([
          ...recordIdsToRemoveIfMissing,
          ...refreshedPeople.map((person) => person.id),
        ]);

        setPeopleById((currentPeopleById) =>
          applyFastContactsRefresh({
            currentPeopleById,
            refreshedPeople,
            recordIdsToRemoveIfMissing,
          }),
        );
      } catch {
        await loadAllPeople();
      }
    },
    [apolloCoreClient, loadAllPeople, markRecordIdsChanged, setPeopleById],
  );

  const removePeople = useCallback(
    (recordIds: string[]) => {
      markRecordIdsChanged(recordIds);

      setPeopleById((currentPeopleById) =>
        applyFastContactsRefresh({
          currentPeopleById,
          refreshedPeople: [],
          recordIdsToRemoveIfMissing: recordIds,
        }),
      );
    },
    [markRecordIdsChanged, setPeopleById],
  );

  // A paste or bulk change emits one event per person; refresh them in one query.
  const [pendingRefreshAtom] = useState(() =>
    atom<{
      recordIds: Set<string>;
      timeoutId: ReturnType<typeof setTimeout> | undefined;
    }>({ recordIds: new Set<string>(), timeoutId: undefined }),
  );

  const queuePeopleRefresh = useCallback(
    (recordIds: string[]) => {
      const pendingRefresh = store.get(pendingRefreshAtom);

      clearTimeout(pendingRefresh.timeoutId);

      const timeoutId = setTimeout(() => {
        const idsToRefresh = [...store.get(pendingRefreshAtom).recordIds];

        store.set(pendingRefreshAtom, {
          recordIds: new Set<string>(),
          timeoutId: undefined,
        });
        void refreshPeople({
          filter: { id: { in: idsToRefresh } },
          recordIdsToRemoveIfMissing: idsToRefresh,
        });
      }, FAST_CONTACTS_REFRESH_BATCH_DELAY_IN_MS);

      store.set(pendingRefreshAtom, {
        recordIds: new Set([...pendingRefresh.recordIds, ...recordIds]),
        timeoutId,
      });
    },
    [pendingRefreshAtom, refreshPeople, store],
  );

  useEffect(
    () => () => clearTimeout(store.get(pendingRefreshAtom).timeoutId),
    [pendingRefreshAtom, store],
  );

  const handlePersonOperation = useCallback(
    ({ operation }: ObjectRecordOperationBrowserEventDetail) => {
      if (operation.type === 'delete-one' || operation.type === 'delete-many') {
        removePeople(getRecordIdsFromRecordOperation(operation) ?? []);

        return;
      }

      const recordIds = getRecordIdsFromRecordOperation(operation);

      if (recordIds === null) {
        void loadAllPeople();

        return;
      }

      queuePeopleRefresh(recordIds);
    },
    [loadAllPeople, queuePeopleRefresh, removePeople],
  );

  const upsertPeopleLocally = useCallback(
    (upsertedPeople: FastContactsPerson[]) => {
      markRecordIdsChanged(upsertedPeople.map((person) => person.id));

      setPeopleById((currentPeopleById) =>
        applyFastContactsRefresh({
          currentPeopleById,
          refreshedPeople: upsertedPeople,
          recordIdsToRemoveIfMissing: [],
        }),
      );
    },
    [markRecordIdsChanged, setPeopleById],
  );

  // A company event only matters for its people's Company and group columns.
  const handleCompanyOperation = useCallback(
    ({ operation }: ObjectRecordOperationBrowserEventDetail) => {
      if (operation.type === 'create-one') {
        return;
      }

      const companyIds = getRecordIdsFromRecordOperation(operation);

      if (companyIds === null) {
        void loadAllPeople();

        return;
      }

      void refreshPeople({
        filter: { companyId: { in: companyIds } },
        recordIdsToRemoveIfMissing: [],
      });
    },
    [loadAllPeople, refreshPeople],
  );

  useListenToObjectRecordOperationBrowserEvent({
    objectMetadataItemId: personObjectMetadataItem.id,
    onObjectRecordOperationBrowserEvent: handlePersonOperation,
  });

  useListenToObjectRecordOperationBrowserEvent({
    objectMetadataItemId: companyObjectMetadataItem.id,
    onObjectRecordOperationBrowserEvent: handleCompanyOperation,
  });

  useListenToEventsForQuery({
    queryId: 'fast-contacts-people',
    operationSignature: FAST_CONTACTS_PERSON_OPERATION_SIGNATURE,
    onSseReconnected: loadAllPeople,
  });

  useListenToEventsForQuery({
    queryId: 'fast-contacts-companies',
    operationSignature: FAST_CONTACTS_COMPANY_OPERATION_SIGNATURE,
  });

  useEffect(() => {
    void loadAllPeople();
  }, [loadAllPeople]);

  // SSE events are missed while a laptop sleeps, so reload when the tab is shown again.
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (
        document.visibilityState === 'visible' &&
        Date.now() - store.get(fastContactsFullLoadState.atom).startedAt >
          FAST_CONTACTS_RELOAD_ON_FOCUS_MIN_INTERVAL_IN_MS
      ) {
        void loadAllPeople();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [loadAllPeople, store]);

  const people = useMemo(
    () => sortFastContactsPeople([...peopleById.values()]),
    [peopleById],
  );

  return {
    people,
    peopleById,
    peopleByIdAtom,
    loadStatus,
    fullLoadCount,
    personObjectMetadataItem,
    reloadPeople: loadAllPeople,
    upsertPeopleLocally,
    removePeopleLocally: removePeople,
  };
};
