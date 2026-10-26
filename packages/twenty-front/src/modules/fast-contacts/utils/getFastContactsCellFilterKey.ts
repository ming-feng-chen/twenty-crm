import { type FastContactsColumnKey } from '@/fast-contacts/types/FastContactsColumn';
import { type FastContactsPerson } from '@/fast-contacts/types/FastContactsPerson';

// What a tick-box filter compares: the option value, member id or company id; null is "(Blank)".
export const getFastContactsCellFilterKey = (
  person: FastContactsPerson,
  columnKey: FastContactsColumnKey,
): string | null => {
  if (columnKey === 'company') {
    return person.company?.id ?? null;
  }

  if (columnKey === 'cadenceOwner') {
    return person.cadenceOwner?.id ?? null;
  }

  const value = person[columnKey];

  return typeof value === 'string' && value !== '' ? value : null;
};
