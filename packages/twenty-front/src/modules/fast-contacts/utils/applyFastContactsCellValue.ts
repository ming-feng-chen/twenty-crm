import { type FastContactsCellValue } from '@/fast-contacts/types/FastContactsCellValue';
import { type FastContactsColumnKey } from '@/fast-contacts/types/FastContactsColumn';
import { type FastContactsPerson } from '@/fast-contacts/types/FastContactsPerson';

export const applyFastContactsCellValue = (
  person: FastContactsPerson,
  columnKey: FastContactsColumnKey,
  value: FastContactsCellValue,
): FastContactsPerson => ({ ...person, [columnKey]: value });
