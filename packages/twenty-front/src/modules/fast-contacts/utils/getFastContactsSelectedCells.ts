import { isDefined } from 'twenty-shared/utils';

import { type FastContactsColumn } from '@/fast-contacts/types/FastContactsColumn';
import { type FastContactsSelection } from '@/fast-contacts/types/FastContactsSelection';

export type FastContactsSelectedCells = {
  personIds: string[];
  columns: FastContactsColumn[];
  isRowSelection: boolean;
};

// The selected rectangle in display order, clamped to the rows and columns on screen.
export const getFastContactsSelectedCells = ({
  selection,
  rowIds,
  visibleColumns,
}: {
  selection: FastContactsSelection;
  rowIds: string[];
  visibleColumns: FastContactsColumn[];
}): FastContactsSelectedCells => {
  if (isDefined(selection.selectedRowIds)) {
    const selectedRowIdSet = new Set(selection.selectedRowIds);

    return {
      personIds: rowIds.filter((rowId) => selectedRowIdSet.has(rowId)),
      columns: visibleColumns,
      isRowSelection: true,
    };
  }

  const lastRowIndex = rowIds.length - 1;
  const lastColumnIndex = visibleColumns.length - 1;
  const clampRow = (rowIndex: number) =>
    Math.min(Math.max(rowIndex, 0), lastRowIndex);
  const clampColumn = (columnIndex: number) =>
    Math.min(Math.max(columnIndex, 0), lastColumnIndex);

  if (lastRowIndex < 0) {
    return { personIds: [], columns: [], isRowSelection: false };
  }

  const firstRowIndex = clampRow(
    Math.min(selection.anchor.rowIndex, selection.focus.rowIndex),
  );
  const endRowIndex = clampRow(
    Math.max(selection.anchor.rowIndex, selection.focus.rowIndex),
  );
  const firstColumnIndex = clampColumn(
    Math.min(selection.anchor.columnIndex, selection.focus.columnIndex),
  );
  const endColumnIndex = clampColumn(
    Math.max(selection.anchor.columnIndex, selection.focus.columnIndex),
  );

  return {
    personIds: rowIds.slice(firstRowIndex, endRowIndex + 1),
    columns: visibleColumns.slice(firstColumnIndex, endColumnIndex + 1),
    isRowSelection: false,
  };
};
