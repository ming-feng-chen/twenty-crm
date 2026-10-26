import { type FastContactsColumnFilter } from '@/fast-contacts/types/FastContactsColumnFilter';
import { type FastContactsColumnKey } from '@/fast-contacts/types/FastContactsColumn';

export type FastContactsSortDirection = 'asc' | 'desc';

export type FastContactsSort = {
  columnKey: FastContactsColumnKey;
  direction: FastContactsSortDirection;
};

export type FastContactsSheetLayout = {
  columnOrder: FastContactsColumnKey[];
  hiddenColumnKeys: FastContactsColumnKey[];
  frozenColumnCount: number;
  sort: FastContactsSort | null;
  filters: Partial<Record<FastContactsColumnKey, FastContactsColumnFilter>>;
};
