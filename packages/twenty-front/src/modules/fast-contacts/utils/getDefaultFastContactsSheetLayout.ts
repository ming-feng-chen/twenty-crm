import { FAST_CONTACTS_COLUMNS } from '@/fast-contacts/constants/FastContactsColumns';
import { type FastContactsSheetLayout } from '@/fast-contacts/types/FastContactsSheetLayout';

export const getDefaultFastContactsSheetLayout =
  (): FastContactsSheetLayout => ({
    columnOrder: FAST_CONTACTS_COLUMNS.map((column) => column.key),
    hiddenColumnKeys: FAST_CONTACTS_COLUMNS.filter(
      (column) => !column.isVisibleByDefault,
    ).map((column) => column.key),
    frozenColumnCount: 1,
    sort: null,
    filters: {},
  });
