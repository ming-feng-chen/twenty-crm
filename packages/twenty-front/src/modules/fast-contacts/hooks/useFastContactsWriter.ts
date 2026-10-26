import { useLingui } from '@lingui/react/macro';
import { atom, type PrimitiveAtom, useStore } from 'jotai';
import { useState } from 'react';
import { isDefined } from 'twenty-shared/utils';
import { useToast } from 'twenty-ui/components/feedback';

import { FAST_CONTACTS_HANDOVER_DIALOG_ID } from '@/fast-contacts/constants/FastContactsHandoverDialogId';
import { FAST_CONTACTS_OWNER_CHANGE_ROUTE_PATH } from '@/fast-contacts/constants/FastContactsOwnerChangeRoutePath';
import { FAST_CONTACTS_SAVE_CONCURRENCY } from '@/fast-contacts/constants/FastContactsSaveConcurrency';
import { CREATE_FAST_CONTACTS_COMPANY_MUTATION } from '@/fast-contacts/graphql/mutations/CreateFastContactsCompanyMutation';
import { CREATE_FAST_CONTACTS_PERSON_MUTATION } from '@/fast-contacts/graphql/mutations/CreateFastContactsPersonMutation';
import { UPDATE_FAST_CONTACTS_PERSON_MUTATION } from '@/fast-contacts/graphql/mutations/UpdateFastContactsPersonMutation';
import { type FastContactsCellValue } from '@/fast-contacts/types/FastContactsCellValue';
import {
  type FastContactsCellChange,
  type FastContactsCellWrite,
  type FastContactsOwnerChangeMode,
  type FastContactsSkippedCell,
} from '@/fast-contacts/types/FastContactsCellWrite';
import {
  type FastContactsCompany,
  type FastContactsOwner,
  type FastContactsPerson,
} from '@/fast-contacts/types/FastContactsPerson';
import { applyFastContactsCellValue } from '@/fast-contacts/utils/applyFastContactsCellValue';
import { buildFastContactsPersonUpdateInput } from '@/fast-contacts/utils/buildFastContactsPersonUpdateInput';
import { changeFastContactsOwnerThroughCadence } from '@/fast-contacts/utils/changeFastContactsOwnerThroughCadence';
import { fetchFastContactsPeople } from '@/fast-contacts/utils/fetchFastContactsPeople';
import { formatFastContactsSkippedCells } from '@/fast-contacts/utils/formatFastContactsSkippedCells';
import { getFastContactsCellValueKey } from '@/fast-contacts/utils/getFastContactsCellValueKey';
import { isFastContactsOwnerHandover } from '@/fast-contacts/utils/isFastContactsOwnerHandover';
import { runFastContactsTasksWithConcurrency } from '@/fast-contacts/utils/runFastContactsTasksWithConcurrency';
import { useGetLogicFunctionHttpUrl } from '@/logic-functions/hooks/useGetLogicFunctionHttpUrl';
import { useApolloCoreClient } from '@/object-metadata/hooks/useApolloCoreClient';
import { useDialog } from '@/ui/layout/dialog/hooks/useDialog';

export type FastContactsHandoverRequest = {
  handoverCount: number;
  owedReplyNames: string[];
  resolve: (mode: FastContactsOwnerChangeMode | null) => void;
};

type SaveOutcome = {
  savedChanges: FastContactsCellChange[];
  failedCells: FastContactsSkippedCell[];
};

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

const isSameValue = (
  change: Pick<FastContactsCellChange, 'columnKey'>,
  firstValue: FastContactsCellValue,
  secondValue: FastContactsCellValue,
) =>
  getFastContactsCellValueKey(change.columnKey, firstValue) ===
  getFastContactsCellValueKey(change.columnKey, secondValue);

export const useFastContactsWriter = ({
  peopleByIdAtom,
  upsertPeopleLocally,
  formatPersonName,
}: {
  peopleByIdAtom: PrimitiveAtom<Map<string, FastContactsPerson>>;
  upsertPeopleLocally: (people: FastContactsPerson[]) => void;
  formatPersonName: (personId: string) => string;
}) => {
  const { t } = useLingui();
  const apolloCoreClient = useApolloCoreClient();
  const { enqueueToast } = useToast();
  const { openDialog } = useDialog();
  const { getLogicFunctionHttpUrl } = useGetLogicFunctionHttpUrl();

  const store = useStore();
  // Read through the store inside async flows, which must see edits made since they started.
  const getPeopleById = () => store.get(peopleByIdAtom);
  // One step per edit, paste or bulk change, kept for this visit of the page.
  const [undoStepsAtom] = useState(() => atom<FastContactsCellChange[][]>([]));
  const [handoverRequest, setHandoverRequest] =
    useState<FastContactsHandoverRequest | null>(null);

  const askHandoverMode = (handoverChanges: FastContactsCellChange[]) =>
    new Promise<FastContactsOwnerChangeMode | null>((resolve) => {
      setHandoverRequest({
        handoverCount: handoverChanges.length,
        owedReplyNames: handoverChanges
          .filter(
            (change) =>
              getPeopleById().get(change.personId)?.cadenceState ===
              'REPLY_OWED',
          )
          .map((change) => formatPersonName(change.personId)),
        resolve: (mode) => {
          setHandoverRequest(null);
          resolve(mode);
        },
      });
      openDialog(FAST_CONTACTS_HANDOVER_DIALOG_ID);
    });

  const applyValuesLocally = (
    changes: FastContactsCellChange[],
    getValue: (change: FastContactsCellChange) => FastContactsCellValue,
    shouldApply: (
      person: FastContactsPerson,
      change: FastContactsCellChange,
    ) => boolean = () => true,
  ) => {
    const patchedPeopleById = new Map<string, FastContactsPerson>();

    for (const change of changes) {
      const person =
        patchedPeopleById.get(change.personId) ??
        getPeopleById().get(change.personId);

      if (isDefined(person) && shouldApply(person, change)) {
        patchedPeopleById.set(
          change.personId,
          applyFastContactsCellValue(
            person,
            change.columnKey,
            getValue(change),
          ),
        );
      }
    }

    if (patchedPeopleById.size > 0) {
      upsertPeopleLocally([...patchedPeopleById.values()]);
    }
  };

  const refreshPeopleFromServer = async (personIds: string[]) => {
    if (personIds.length === 0) {
      return;
    }

    const refreshedPeople = await fetchFastContactsPeople({
      apolloCoreClient,
      filter: { id: { in: personIds } },
    });

    upsertPeopleLocally(refreshedPeople);
  };

  // Shows the new values at once, saves them, and puts back the old value of
  // any cell the server refused.
  const saveChanges = async (
    changes: FastContactsCellChange[],
    ownerChangeMode: FastContactsOwnerChangeMode,
  ): Promise<SaveOutcome> => {
    applyValuesLocally(changes, (change) => change.value);

    const ownerChanges = changes.filter(
      (change) => change.columnKey === 'cadenceOwner',
    );
    const changesByPersonId = new Map<string, FastContactsCellChange[]>();

    for (const change of changes) {
      if (change.columnKey !== 'cadenceOwner') {
        changesByPersonId.set(change.personId, [
          ...(changesByPersonId.get(change.personId) ?? []),
          change,
        ]);
      }
    }

    const updateTasks = [...changesByPersonId.entries()].map(
      ([personId, personChanges]) =>
        async () => {
          const { data } = await apolloCoreClient.mutate<{
            updatePerson: FastContactsPerson;
          }>({
            mutation: UPDATE_FAST_CONTACTS_PERSON_MUTATION,
            variables: {
              id: personId,
              data: Object.assign(
                {},
                ...personChanges.map((change) =>
                  buildFastContactsPersonUpdateInput(
                    change.columnKey,
                    change.value,
                  ),
                ),
              ),
            },
            fetchPolicy: 'no-cache',
          });

          return data?.updatePerson ?? null;
        },
    );

    const routeUrl = getLogicFunctionHttpUrl(
      FAST_CONTACTS_OWNER_CHANGE_ROUTE_PATH,
    );
    const ownerTasks = ownerChanges.map(
      (change) => () =>
        changeFastContactsOwnerThroughCadence({
          routeUrl,
          personId: change.personId,
          ownerId: (change.value as FastContactsOwner | null)?.id ?? null,
          mode: ownerChangeMode,
        }),
    );

    const [updateResults, ownerResults] = await Promise.all([
      runFastContactsTasksWithConcurrency(
        updateTasks,
        FAST_CONTACTS_SAVE_CONCURRENCY,
      ),
      runFastContactsTasksWithConcurrency(
        ownerTasks,
        FAST_CONTACTS_SAVE_CONCURRENCY,
      ),
    ]);

    const savedChanges: FastContactsCellChange[] = [];
    const failedChanges: FastContactsCellChange[] = [];
    const failedCells: FastContactsSkippedCell[] = [];
    const savedPeople: FastContactsPerson[] = [];

    [...changesByPersonId.values()].forEach((personChanges, index) => {
      const result = updateResults[index];

      if (result.status === 'fulfilled') {
        savedChanges.push(...personChanges);

        if (isDefined(result.value)) {
          savedPeople.push(result.value);
        }

        return;
      }

      failedChanges.push(...personChanges);
      failedCells.push(
        ...personChanges.map((change) => ({
          personId: change.personId,
          columnKey: change.columnKey,
          reason: getErrorMessage(result.reason),
        })),
      );
    });

    ownerChanges.forEach((change, index) => {
      const result = ownerResults[index];

      if (result.status === 'fulfilled') {
        savedChanges.push(change);

        return;
      }

      failedChanges.push(change);
      failedCells.push({
        personId: change.personId,
        columnKey: change.columnKey,
        reason: getErrorMessage(result.reason),
      });
    });

    if (savedPeople.length > 0) {
      upsertPeopleLocally(savedPeople);
    }

    applyValuesLocally(
      failedChanges,
      (change) => change.previousValue,
      (person, change) =>
        isSameValue(change, person[change.columnKey], change.value),
    );

    // The handover also moves cadence fields (owner since, step, next action date).
    await refreshPeopleFromServer([
      ...new Set(
        ownerChanges
          .filter((change) => savedChanges.includes(change))
          .map((change) => change.personId),
      ),
    ]).catch(() => undefined);

    return { savedChanges, failedCells };
  };

  const undoLastStep = async () => {
    const undoSteps = store.get(undoStepsAtom);
    const undoStep = undoSteps.at(-1);

    store.set(undoStepsAtom, undoSteps.slice(0, -1));

    if (!isDefined(undoStep)) {
      enqueueToast({ status: 'neutral', children: t`Nothing to undo` });

      return;
    }

    const reversibleChanges = undoStep.filter((change) => {
      const person = getPeopleById().get(change.personId);

      return (
        isDefined(person) &&
        isSameValue(change, person[change.columnKey], change.value)
      );
    });
    const changedSinceCount = undoStep.length - reversibleChanges.length;

    const { failedCells } = await saveChanges(
      reversibleChanges.map((change) => ({
        personId: change.personId,
        columnKey: change.columnKey,
        value: change.previousValue,
        previousValue: change.value,
      })),
      'KEEP_POSITION',
    );

    const skippedCount = changedSinceCount + failedCells.length;

    enqueueToast(
      skippedCount === 0
        ? { status: 'success', children: t`Undone` }
        : {
            status: 'warning',
            children:
              changedSinceCount > 0
                ? t`Undone, except ${changedSinceCount} cell(s) someone changed since`
                : t`Undone, except ${skippedCount} cell(s) that could not be saved`,
            description: formatFastContactsSkippedCells({
              skippedCells: failedCells,
              formatPersonName,
            }),
          },
    );
  };

  const writeCells = async ({
    writes,
    skippedCells = [],
    isSingleCellEdit = false,
  }: {
    writes: FastContactsCellWrite[];
    skippedCells?: FastContactsSkippedCell[];
    isSingleCellEdit?: boolean;
  }) => {
    const changes = writes.flatMap((write) => {
      const person = getPeopleById().get(write.personId);

      if (!isDefined(person)) {
        return [];
      }

      const previousValue = person[write.columnKey];

      return isSameValue(write, previousValue, write.value)
        ? []
        : [{ ...write, previousValue }];
    });

    let ownerChangeMode: FastContactsOwnerChangeMode = 'START_FRESH';
    const handoverChanges = changes.filter((change) => {
      const person = getPeopleById().get(change.personId);

      return isDefined(person) && isFastContactsOwnerHandover(person, change);
    });

    if (handoverChanges.length > 0) {
      const chosenMode = await askHandoverMode(handoverChanges);

      if (!isDefined(chosenMode)) {
        enqueueToast({
          status: 'neutral',
          children: t`Nothing was changed`,
        });

        return;
      }

      ownerChangeMode = chosenMode;
    }

    const { savedChanges, failedCells } =
      changes.length > 0
        ? await saveChanges(changes, ownerChangeMode)
        : { savedChanges: [], failedCells: [] };

    if (savedChanges.length > 0) {
      store.set(undoStepsAtom, [...store.get(undoStepsAtom), savedChanges]);
    }

    const allSkippedCells = [...skippedCells, ...failedCells];
    const savedCount = savedChanges.length;
    const skippedCount = allSkippedCells.length;

    if (skippedCount > 0) {
      enqueueToast({
        status: savedCount > 0 ? 'warning' : 'error',
        children: isSingleCellEdit
          ? allSkippedCells[0].reason
          : t`${savedCount} cell(s) saved, ${skippedCount} skipped`,
        description: isSingleCellEdit
          ? undefined
          : formatFastContactsSkippedCells({
              skippedCells: allSkippedCells,
              formatPersonName,
            }),
      });

      return;
    }

    if (!isSingleCellEdit && savedCount > 0) {
      enqueueToast({
        status: 'success',
        children: t`${savedCount} cell(s) changed. Ctrl+Z to undo.`,
      });
    }
  };

  const createPerson = async ({
    firstName,
    lastName,
    ownerId,
  }: {
    firstName: string;
    lastName: string;
    ownerId: string | null;
  }): Promise<FastContactsPerson | null> => {
    try {
      const { data } = await apolloCoreClient.mutate<{
        createPerson: FastContactsPerson;
      }>({
        mutation: CREATE_FAST_CONTACTS_PERSON_MUTATION,
        variables: {
          data: { name: { firstName, lastName }, cadenceOwnerId: ownerId },
        },
        fetchPolicy: 'no-cache',
      });
      const createdPerson = data?.createPerson ?? null;

      if (isDefined(createdPerson)) {
        upsertPeopleLocally([createdPerson]);
      }

      return createdPerson;
    } catch (error) {
      enqueueToast({
        status: 'error',
        children: t`The contact could not be created`,
        description: getErrorMessage(error),
      });

      return null;
    }
  };

  const createCompany = async (
    name: string,
  ): Promise<FastContactsCompany | null> => {
    try {
      const { data } = await apolloCoreClient.mutate<{
        createCompany: FastContactsCompany;
      }>({
        mutation: CREATE_FAST_CONTACTS_COMPANY_MUTATION,
        variables: { data: { name } },
        fetchPolicy: 'no-cache',
      });

      return data?.createCompany ?? null;
    } catch (error) {
      enqueueToast({
        status: 'error',
        children: t`The company could not be created`,
        description: getErrorMessage(error),
      });

      return null;
    }
  };

  return {
    writeCells,
    undoLastStep,
    createPerson,
    createCompany,
    handoverRequest,
  };
};
