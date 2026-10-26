import { type FastContactsColumnKey } from '@/fast-contacts/types/FastContactsColumn';
import { type FastContactsPerson } from '@/fast-contacts/types/FastContactsPerson';
import { getFastContactsColumn } from '@/fast-contacts/utils/getFastContactsColumn';

// A yyyy-mm-dd day: DATE fields as stored, date-times on the viewer's calendar.
export const getFastContactsCellDate = ({
  person,
  columnKey,
  timeZone,
}: {
  person: FastContactsPerson;
  columnKey: FastContactsColumnKey;
  timeZone: string;
}): string | null => {
  const value = person[columnKey];

  if (typeof value !== 'string' || value === '') {
    return null;
  }

  return getFastContactsColumn(columnKey).kind === 'dateTime'
    ? new Date(value).toLocaleDateString('en-CA', { timeZone })
    : value.slice(0, 10);
};
