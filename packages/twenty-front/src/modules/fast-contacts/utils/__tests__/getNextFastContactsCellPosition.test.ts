import { getNextFastContactsCellPosition } from '@/fast-contacts/utils/getNextFastContactsCellPosition';

const move = (key: string, rowIndex: number, columnIndex: number) =>
  getNextFastContactsCellPosition({
    key,
    cellPosition: { rowIndex, columnIndex },
    rowCount: 3,
    columnCount: 2,
  });

describe('getNextFastContactsCellPosition', () => {
  it('should move one cell with the arrow keys', () => {
    expect(move('ArrowDown', 0, 0)).toEqual({ rowIndex: 1, columnIndex: 0 });
    expect(move('ArrowRight', 0, 0)).toEqual({ rowIndex: 0, columnIndex: 1 });
  });

  it('should stop at the edges of the grid', () => {
    expect(move('ArrowUp', 0, 0)).toEqual({ rowIndex: 0, columnIndex: 0 });
    expect(move('ArrowDown', 2, 1)).toEqual({ rowIndex: 2, columnIndex: 1 });
    expect(move('ArrowRight', 2, 1)).toEqual({ rowIndex: 2, columnIndex: 1 });
  });

  it('should ignore other keys', () => {
    expect(move('Delete', 1, 1)).toBeNull();
  });
});
