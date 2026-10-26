import { isDefined, isPlainObject } from 'twenty-shared/utils';

import { type FastContactsCellValue } from '@/fast-contacts/types/FastContactsCellValue';
import { type FastContactsColumnKey } from '@/fast-contacts/types/FastContactsColumn';

const sortKeysDeep = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.length === 0 ? null : value.map(sortKeysDeep);
  }

  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.keys(value)
        .filter((key) => key !== '__typename')
        .sort()
        .map((key) => [key, sortKeysDeep(value[key])]),
    );
  }

  return value === '' ? null : value;
};

// Compares stored values the way the server sees them: relations by id, and
// an empty string or list the same as null.
export const getFastContactsCellValueKey = (
  columnKey: FastContactsColumnKey,
  value: FastContactsCellValue,
): string => {
  if (columnKey === 'company' || columnKey === 'cadenceOwner') {
    return JSON.stringify(
      isDefined(value) ? (value as { id: string }).id : null,
    );
  }

  return JSON.stringify(sortKeysDeep(value ?? null));
};
