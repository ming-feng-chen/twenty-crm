import { type FastContactsColumn } from '@/fast-contacts/types/FastContactsColumn';
import { type FastContactsSheetLayout } from '@/fast-contacts/types/FastContactsSheetLayout';
import { getFastContactsColumn } from '@/fast-contacts/utils/getFastContactsColumn';

export const getFastContactsVisibleColumns = (
  layout: FastContactsSheetLayout,
): FastContactsColumn[] =>
  layout.columnOrder
    .filter((columnKey) => !layout.hiddenColumnKeys.includes(columnKey))
    .map(getFastContactsColumn);
