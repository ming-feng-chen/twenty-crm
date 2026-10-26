import { type FastContactsColumn } from '@/fast-contacts/types/FastContactsColumn';
import { type FastContactsSelectedCells } from '@/fast-contacts/utils/getFastContactsSelectedCells';
import { type FastContactsCellInput } from '@/fast-contacts/utils/planFastContactsCellInputs';

export type FastContactsPasteInputs = {
  inputs: FastContactsCellInput[];
  outsideCellCount: number;
};

// Like Sheets: one copied value fills the whole selection; a block fills down
// and right from the selection's first cell (or onto the selected rows, in order).
export const getFastContactsPasteInputs = ({
  values,
  selectedCells,
  rowIds,
  visibleColumns,
}: {
  values: string[][];
  selectedCells: FastContactsSelectedCells;
  rowIds: string[];
  visibleColumns: FastContactsColumn[];
}): FastContactsPasteInputs => {
  const firstPersonId = selectedCells.personIds[0];
  const firstColumn = selectedCells.columns[0];

  if (firstPersonId === undefined || firstColumn === undefined) {
    return { inputs: [], outsideCellCount: 0 };
  }

  const isSingleValue = values.length === 1 && values[0].length === 1;

  if (isSingleValue) {
    return {
      inputs: selectedCells.personIds.flatMap((personId) =>
        selectedCells.columns.map((column) => ({
          personId,
          column,
          text: values[0][0],
        })),
      ),
      outsideCellCount: 0,
    };
  }

  const targetPersonIds =
    selectedCells.isRowSelection && selectedCells.personIds.length > 1
      ? selectedCells.personIds
      : rowIds.slice(rowIds.indexOf(firstPersonId));
  const targetColumns = visibleColumns.slice(
    visibleColumns.findIndex((column) => column.key === firstColumn.key),
  );

  const inputs: FastContactsCellInput[] = [];
  let outsideCellCount = 0;

  values.forEach((rowValues, rowOffset) => {
    rowValues.forEach((text, columnOffset) => {
      const personId = targetPersonIds[rowOffset];
      const column = targetColumns[columnOffset];

      if (personId === undefined || column === undefined) {
        outsideCellCount += 1;

        return;
      }

      inputs.push({ personId, column, text });
    });
  });

  return { inputs, outsideCellCount };
};
