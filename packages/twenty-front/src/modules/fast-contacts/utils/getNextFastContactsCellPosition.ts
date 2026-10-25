import { type FastContactsCellPosition } from '@/fast-contacts/types/FastContactsCellPosition';

const clamp = (value: number, max: number) =>
  Math.min(Math.max(value, 0), Math.max(max, 0));

export const getNextFastContactsCellPosition = ({
  key,
  cellPosition,
  rowCount,
  columnCount,
}: {
  key: string;
  cellPosition: FastContactsCellPosition;
  rowCount: number;
  columnCount: number;
}): FastContactsCellPosition | null => {
  const rowDelta = key === 'ArrowDown' ? 1 : key === 'ArrowUp' ? -1 : 0;
  const columnDelta = key === 'ArrowRight' ? 1 : key === 'ArrowLeft' ? -1 : 0;

  if (rowDelta === 0 && columnDelta === 0) {
    return null;
  }

  return {
    rowIndex: clamp(cellPosition.rowIndex + rowDelta, rowCount - 1),
    columnIndex: clamp(cellPosition.columnIndex + columnDelta, columnCount - 1),
  };
};
