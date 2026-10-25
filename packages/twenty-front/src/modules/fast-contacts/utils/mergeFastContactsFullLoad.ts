import { type FastContactsPerson } from '@/fast-contacts/types/FastContactsPerson';

// A full load can take a few seconds; records changed live while it ran are
// fresher in the current state than in the load result.
export const mergeFastContactsFullLoad = ({
  currentPeopleById,
  loadedPeople,
  recordIdsChangedDuringLoad,
}: {
  currentPeopleById: Map<string, FastContactsPerson>;
  loadedPeople: FastContactsPerson[];
  recordIdsChangedDuringLoad: Set<string>;
}): Map<string, FastContactsPerson> => {
  const mergedPeopleById = new Map(
    loadedPeople.map((person) => [person.id, person]),
  );

  for (const recordId of recordIdsChangedDuringLoad) {
    const currentPerson = currentPeopleById.get(recordId);

    if (currentPerson === undefined) {
      mergedPeopleById.delete(recordId);
    } else {
      mergedPeopleById.set(recordId, currentPerson);
    }
  }

  return mergedPeopleById;
};
