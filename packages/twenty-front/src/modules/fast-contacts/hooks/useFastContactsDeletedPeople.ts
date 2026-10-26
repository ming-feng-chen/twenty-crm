import { atom, useStore } from 'jotai';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { type FastContactsPerson } from '@/fast-contacts/types/FastContactsPerson';
import { fetchFastContactsPeople } from '@/fast-contacts/utils/fetchFastContactsPeople';
import { sortFastContactsPeople } from '@/fast-contacts/utils/sortFastContactsPeople';
import { useApolloCoreClient } from '@/object-metadata/hooks/useApolloCoreClient';

export const useFastContactsDeletedPeople = () => {
  const apolloCoreClient = useApolloCoreClient();
  const store = useStore();
  const [deletedPeople, setDeletedPeople] = useState<FastContactsPerson[]>([]);
  // Only the latest load may replace the list.
  const [latestLoadIdAtom] = useState(() => atom(0));

  const reloadDeletedPeople = useCallback(async () => {
    const loadId = store.get(latestLoadIdAtom) + 1;

    store.set(latestLoadIdAtom, loadId);

    try {
      const loadedPeople = await fetchFastContactsPeople({
        apolloCoreClient,
        filter: { deletedAt: { is: 'NOT_NULL' } },
      });

      if (store.get(latestLoadIdAtom) === loadId) {
        setDeletedPeople(sortFastContactsPeople(loadedPeople));
      }
    } catch {
      // The Deleted sheet keeps its last list; the next delete, restore or visit reloads it.
    }
  }, [apolloCoreClient, latestLoadIdAtom, store]);

  useEffect(() => {
    void reloadDeletedPeople();
  }, [reloadDeletedPeople]);

  const deletedPeopleById = useMemo(
    () => new Map(deletedPeople.map((person) => [person.id, person])),
    [deletedPeople],
  );

  return { deletedPeople, deletedPeopleById, reloadDeletedPeople };
};
