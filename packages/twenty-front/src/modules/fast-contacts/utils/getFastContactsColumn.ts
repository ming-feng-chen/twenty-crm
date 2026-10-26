import { FAST_CONTACTS_COLUMNS } from '@/fast-contacts/constants/FastContactsColumns';
import {
  type FastContactsColumn,
  type FastContactsColumnKey,
} from '@/fast-contacts/types/FastContactsColumn';

const COLUMN_BY_KEY = new Map(
  FAST_CONTACTS_COLUMNS.map((column) => [column.key, column]),
);

export const getFastContactsColumn = (
  columnKey: FastContactsColumnKey,
): FastContactsColumn => COLUMN_BY_KEY.get(columnKey) as FastContactsColumn;

export const isFastContactsColumnKey = (
  value: unknown,
): value is FastContactsColumnKey =>
  typeof value === 'string' &&
  COLUMN_BY_KEY.has(value as FastContactsColumnKey);
