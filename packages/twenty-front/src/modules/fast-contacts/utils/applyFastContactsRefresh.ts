import { type FastContactsPerson } from '@/fast-contacts/types/FastContactsPerson';

export const applyFastContactsRefresh = ({
  currentPeopleById,
  refreshedPeople,
  recordIdsToRemoveIfMissing,
}: {
  currentPeopleById: Map<string, FastContactsPerson>;
  refreshedPeople: FastContactsPerson[];
  recordIdsToRemoveIfMissing: string[];
}): Map<string, FastContactsPerson> => {
  const nextPeopleById = new Map(currentPeopleById);
  const refreshedRecordIds = new Set(
    refreshedPeople.map((person) => person.id),
  );

  for (const recordId of recordIdsToRemoveIfMissing) {
    if (!refreshedRecordIds.has(recordId)) {
      nextPeopleById.delete(recordId);
    }
  }

  for (const person of refreshedPeople) {
    nextPeopleById.set(person.id, person);
  }

  return nextPeopleById;
};
