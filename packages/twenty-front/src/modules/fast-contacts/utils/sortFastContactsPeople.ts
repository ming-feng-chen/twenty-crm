import { isDefined } from 'twenty-shared/utils';

import { type FastContactsPerson } from '@/fast-contacts/types/FastContactsPerson';

const compareIds = (firstId: string, secondId: string) =>
  firstId < secondId ? -1 : firstId > secondId ? 1 : 0;

// Same order as the people query: position ascending with nulls first, then id.
export const sortFastContactsPeople = (
  people: FastContactsPerson[],
): FastContactsPerson[] =>
  people.sort((firstPerson, secondPerson) => {
    const firstPosition = firstPerson.position;
    const secondPosition = secondPerson.position;

    if (firstPosition === secondPosition) {
      return compareIds(firstPerson.id, secondPerson.id);
    }

    if (!isDefined(firstPosition)) {
      return -1;
    }

    if (!isDefined(secondPosition)) {
      return 1;
    }

    return firstPosition - secondPosition;
  });
