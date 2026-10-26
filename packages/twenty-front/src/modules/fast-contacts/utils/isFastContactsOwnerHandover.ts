import { isDefined } from 'twenty-shared/utils';

import { type FastContactsCellWrite } from '@/fast-contacts/types/FastContactsCellWrite';
import {
  type FastContactsOwner,
  type FastContactsPerson,
} from '@/fast-contacts/types/FastContactsPerson';

// From one member to another (cadence SPEC §4); a first assignment or a removal is not.
export const isFastContactsOwnerHandover = (
  person: FastContactsPerson,
  write: FastContactsCellWrite,
): boolean => {
  const nextOwner = write.value as FastContactsOwner | null;

  return (
    write.columnKey === 'cadenceOwner' &&
    isDefined(person.cadenceOwner) &&
    isDefined(nextOwner) &&
    person.cadenceOwner.id !== nextOwner.id
  );
};
